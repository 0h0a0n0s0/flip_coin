// routes/admin/wallets.js
// 錢包管理相關路由

const db = require('@flipcoin/database');
const authMiddleware = require('../../middleware/auth');
const checkPermission = require('../../middleware/checkPermissionMiddleware');
const { recordAuditLog } = require('../../services/auditLogService');
const { maskAddress } = require('../../utils/maskUtils');
const { getClientIp } = require('../../utils/ipUtils');
const { sendError, sendSuccess } = require('../../utils/safeResponse');

/**
 * 錢包管理相關路由
 * @param {Router} router - Express router 實例
 */
function walletsRoutes(router) {


    /**
     * @description 获取平台钱包列表 
     */
    router.get('/wallets', authMiddleware, checkPermission('wallets', 'read'), async (req, res) => {
        const { 
            page = 1, limit = 10,
            name, 
            chain_type,
            address
        } = req.query;

        try {
            const params = [];
            let whereClauses = [];
            let paramIndex = 1;

            if (name) { params.push(`%${name}%`); whereClauses.push(`name ILIKE $${paramIndex++}`); }
            if (chain_type) { params.push(chain_type); whereClauses.push(`chain_type = $${paramIndex++}`); } 
            if (address) { params.push(address); whereClauses.push(`LOWER(address) = LOWER($${paramIndex++})`); }

            // 查询 platform_wallets
            const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
            const countSql = `SELECT COUNT(*) FROM platform_wallets ${whereSql}`;
            const countResult = await db.query(countSql, params);
            const total = parseInt(countResult.rows[0].count, 10);

            if (total === 0) {
                return sendSuccess(res, { total: 0, list: [] });
            }

            // 查询 platform_wallets
            const dataSql = `SELECT * FROM platform_wallets ${whereSql} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
            const offset = (page - 1) * limit;
            params.push(limit); params.push(offset);
            const dataResult = await db.query(dataSql, params);
            const list = dataResult.rows.map(row => ({
                ...row,
                address_masked: maskAddress(row.address || '')
            }));

            sendSuccess(res, { total, list });

        } catch (error) {
            console.error('[Admin Wallets] Error fetching wallets:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 新增平台钱包 
     */
    router.post('/wallets', authMiddleware, checkPermission('wallets', 'cud'), async (req, res) => {
        // 获取新栏位
        const { name, chain_type, address, is_gas_reserve, is_collection, is_opener_a, is_opener_b, is_active, is_payout } = req.body;
        if (!name || !chain_type || !address) {
            return sendError(res, 400, 'Name, chain_type, and address are required.');
        }

        try {
            // 插入 platform_wallets
            const result = await db.query(
                `INSERT INTO platform_wallets (name, chain_type, address, is_gas_reserve, is_collection, is_opener_a, is_opener_b, is_active, is_payout) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                [name, chain_type, address, !!is_gas_reserve, !!is_collection, !!is_opener_a, !!is_opener_b, !!is_active, !!is_payout]
            );
            console.log(`[Admin Wallets] Wallet ${result.rows[0].id} created by ${req.user.username}`);

            await recordAuditLog({
                adminId: req.user.id,
                adminUsername: req.user.username,
                action: 'create_wallet',
                resource: 'platform_wallets',
                resourceId: result.rows[0].id?.toString(),
                description: `新增钱包：${result.rows[0].name} (${result.rows[0].address})`,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent']
            });

            sendSuccess(res, result.rows[0], 201);
        } catch (error) {
            if (error.code === '23505') { return sendError(res, 409, 'Wallet address already exists.'); }
            console.error('[Admin Wallets] Error creating wallet (v7):', error);
            return sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 更新平台钱包
     */
    router.put('/wallets/:id', authMiddleware, checkPermission('wallets', 'cud'), async (req, res) => {
        const { id } = req.params;
        // 获取新栏位
        const { name, chain_type, address, is_gas_reserve, is_collection, is_opener_a, is_opener_b, is_active, is_payout } = req.body;
        if (!name || !chain_type || !address) { return sendError(res, 400, 'Fields are required.'); }

        try {
            const result = await db.query(
                `UPDATE platform_wallets SET 
                 name = $1, chain_type = $2, address = $3, 
                 is_gas_reserve = $4, is_collection = $5, 
                 is_opener_a = $6, is_opener_b = $7, is_active = $8,
                 is_payout = $9
                 WHERE id = $10 RETURNING *`,
                [name, chain_type, address, !!is_gas_reserve, !!is_collection, !!is_opener_a, !!is_opener_b, !!is_active, !!is_payout, id]
            );
            if (result.rows.length === 0) {
                return sendError(res, 404, 'Wallet not found.');
            }
            console.log(`[Admin Wallets] Wallet ${id} updated by ${req.user.username}`);

            await recordAuditLog({
                adminId: req.user.id,
                adminUsername: req.user.username,
                action: 'update_wallet',
                resource: 'platform_wallets',
                resourceId: id.toString(),
                description: `更新钱包：${result.rows[0].name} (${result.rows[0].address})`,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent']
            });

            sendSuccess(res, result.rows[0]);
        } catch (error) {
            if (error.code === '23505') { return sendError(res, 409, 'Wallet address already exists.'); }
            console.error(`[Admin Wallets] Error updating wallet ${id}:`, error);
            return sendError(res, 500, 'Internal server error');
        }
    });

    // 刪除 platform_wallets
    router.delete('/wallets/:id', authMiddleware, checkPermission('wallets', 'cud'), async (req, res) => {
        const { id } = req.params;
        try {
            const result = await db.query('DELETE FROM platform_wallets WHERE id = $1 RETURNING id, name, address', [id]); // (查询 platform_wallets)
            if (result.rows.length === 0) { return sendError(res, 404, 'Wallet not found.'); }
            console.log(`[Admin Wallets] Wallet ${id} deleted by ${req.user.username}`);

            await recordAuditLog({
                adminId: req.user.id,
                adminUsername: req.user.username,
                action: 'delete_wallet',
                resource: 'platform_wallets',
                resourceId: id.toString(),
                description: `刪除钱包：${result.rows[0].name || ''} (${result.rows[0].address || ''})`,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent']
            });

            res.status(204).send();
        } catch (error) {
            console.error(`[Admin Wallets] Error deleting wallet ${id}:`, error);
            sendError(res, 500, 'Internal server error');
        }
    });

}

module.exports = walletsRoutes;
