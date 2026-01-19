// routes/admin/wallets.js
// 錢包管理相關路由

const db = require('@flipcoin/database');
const authMiddleware = require('../../middleware/auth');
const checkPermission = require('../../middleware/checkPermissionMiddleware');
const { recordAuditLog } = require('../../services/auditLogService');
const { maskAddress } = require('../../utils/maskUtils');
const { getClientIp } = require('../../utils/ipUtils');
const { sendError, sendSuccess } = require('../../utils/safeResponse');

// 延遲加載 WalletService，避免在模組加載時就初始化
let getWalletServiceInstance = null;
try {
    const walletServiceModule = require('../../services/WalletService');
    getWalletServiceInstance = walletServiceModule.getWalletServiceInstance;
} catch (error) {
    console.error('[Admin Wallets] Failed to load WalletService:', error.message);
    // 提供一個安全的 fallback 函數
    getWalletServiceInstance = () => {
        throw new Error('WalletService is not available: ' + error.message);
    };
}

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

            if (name) { params.push(`%${name}%`); whereClauses.push(`pw.name ILIKE $${paramIndex++}`); }
            if (chain_type) { params.push(chain_type); whereClauses.push(`pw.chain_type = $${paramIndex++}`); } 
            if (address) { params.push(address); whereClauses.push(`LOWER(pw.address) = LOWER($${paramIndex++})`); }

            // 查询 platform_wallets (COUNT 查詢使用表別名 pw 以重用 WHERE 子句)
            const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
            const countSql = `SELECT COUNT(*) FROM platform_wallets pw ${whereSql}`;
            const countResult = await db.query(countSql, params);
            const total = parseInt(countResult.rows[0].count, 10);

            if (total === 0) {
                return sendSuccess(res, { total: 0, list: [] });
            }

            // 查询 platform_wallets，LEFT JOIN collection_settings 以獲取歸集設定
            const dataSql = `SELECT 
                pw.*,
                cs.scan_interval_days,
                cs.days_without_deposit,
                cs.is_active as collection_settings_active
            FROM platform_wallets pw
            LEFT JOIN collection_settings cs ON pw.address = cs.collection_wallet_address AND pw.is_collection = true
            ${whereSql} ORDER BY pw.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
            const offset = (page - 1) * limit;
            params.push(limit); params.push(offset);
            const dataResult = await db.query(dataSql, params);
            const list = dataResult.rows.map(row => ({
                ...row,
                address_masked: maskAddress(row.address || '')
            }));

            // #region agent log
            const collectionWallets = list.filter(r => r.is_collection);
            fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'wallets.js:GET /wallets',message:'後端返回數據檢查',data:{totalRows:list.length,collectionWalletsCount:collectionWallets.length,collectionWallets:collectionWallets.map(r=>({name:r.name,is_collection:r.is_collection,is_collectionType:typeof r.is_collection,is_collectionValue:r.is_collection}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
            // #endregion

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
        const { name, chain_type, address, is_gas_reserve, is_collection, is_opener_a, is_opener_b, is_active, is_payout, is_energy_provider } = req.body;
        if (!name || !chain_type || !address) {
            return sendError(res, 400, 'Name, chain_type, and address are required.');
        }

        try {
            // 插入 platform_wallets
            const result = await db.query(
                `INSERT INTO platform_wallets (name, chain_type, address, is_gas_reserve, is_collection, is_opener_a, is_opener_b, is_active, is_payout, is_energy_provider) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
                [name, chain_type, address, !!is_gas_reserve, !!is_collection, !!is_opener_a, !!is_opener_b, !!is_active, !!is_payout, !!is_energy_provider]
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
        const { name, chain_type, address, is_gas_reserve, is_collection, is_opener_a, is_opener_b, is_active, is_payout, is_energy_provider, scan_interval_days, days_without_deposit } = req.body;
        if (!name || !chain_type || !address) { return sendError(res, 400, 'Fields are required.'); }

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // 更新 platform_wallets
            const result = await client.query(
                `UPDATE platform_wallets SET 
                 name = $1, chain_type = $2, address = $3, 
                 is_gas_reserve = $4, is_collection = $5, 
                 is_opener_a = $6, is_opener_b = $7, is_active = $8,
                 is_payout = $9, is_energy_provider = $10
                 WHERE id = $11 RETURNING *`,
                [name, chain_type, address, !!is_gas_reserve, !!is_collection, !!is_opener_a, !!is_opener_b, !!is_active, !!is_payout, !!is_energy_provider, id]
            );
            if (result.rows.length === 0) {
                await client.query('ROLLBACK');
                return sendError(res, 404, 'Wallet not found.');
            }

            const updatedWallet = result.rows[0];

            // 如果是歸集錢包且有歸集設定參數，則更新或插入 collection_settings
            if (!!is_collection && address && scan_interval_days !== undefined && days_without_deposit !== undefined) {
                await client.query(
                    `INSERT INTO collection_settings 
                     (collection_wallet_address, scan_interval_days, days_without_deposit, is_active, updated_at) 
                     VALUES ($1, $2, $3, $4, NOW())
                     ON CONFLICT (collection_wallet_address) 
                     DO UPDATE SET 
                         scan_interval_days = $2, 
                         days_without_deposit = $3, 
                         is_active = $4, 
                         updated_at = NOW()`,
                    [address, scan_interval_days, days_without_deposit, true]
                );
                console.log(`[Admin Wallets] Collection settings updated for wallet ${address} by ${req.user.username}`);
            }

            await client.query('COMMIT');
            console.log(`[Admin Wallets] Wallet ${id} updated by ${req.user.username}`);

            await recordAuditLog({
                adminId: req.user.id,
                adminUsername: req.user.username,
                action: 'update_wallet',
                resource: 'platform_wallets',
                resourceId: id.toString(),
                description: `更新钱包：${updatedWallet.name} (${updatedWallet.address})`,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent']
            });

            sendSuccess(res, updatedWallet);
        } catch (error) {
            await client.query('ROLLBACK');
            if (error.code === '23505') { return sendError(res, 409, 'Wallet address already exists.'); }
            console.error(`[Admin Wallets] Error updating wallet ${id}:`, error);
            return sendError(res, 500, 'Internal server error');
        } finally {
            client.release();
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

    /**
     * @description 手動觸發歸集任務
     * @route POST /api/admin/wallets/manual-collection
     */
    router.post('/wallets/manual-collection', authMiddleware, checkPermission('wallets', 'cud'), async (req, res) => {
        try {
            const TronCollectionService = require('../../services/TronCollectionService');
            const collectionService = TronCollectionService.getTronCollectionInstance();
            
            // 異步執行，不等待完成
            collectionService.executeManualCollection(req.user.id, req.user.username, getClientIp(req), req.headers['user-agent'])
                .catch(error => {
                    console.error('[Admin Wallets] Manual collection execution error:', error);
                });
            
            // 立即返回響應
            return sendSuccess(res, { message: '歸集任務已啟動，請留意右上角通知' });
        } catch (error) {
            console.error('[Admin Wallets] Error triggering manual collection:', error);
            return sendError(res, 500, '觸發歸集任務失敗');
        }
    });

    /**
     * @description 批量獲取錢包的鏈上餘額（USDT, TRX, 質押, 能量）
     * @route POST /api/admin/wallets/on-chain-balances
     */
    router.post('/wallets/on-chain-balances', authMiddleware, checkPermission('wallets', 'read'), async (req, res) => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H3',location:'wallets.js:on-chain-balances',message:'Endpoint called',data:{walletCount:req.body?.wallets?.length},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        const { wallets } = req.body;

        if (!Array.isArray(wallets) || wallets.length === 0) {
            return sendError(res, 400, 'wallets array is required and must not be empty');
        }

        try {
            if (!getWalletServiceInstance) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H3',location:'wallets.js:on-chain-balances',message:'WalletService instance not available',data:{},timestamp:Date.now()})}).catch(()=>{});
                // #endregion
                return sendError(res, 503, 'WalletService is not available. Please check server configuration.');
            }

            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H3',location:'wallets.js:on-chain-balances',message:'Calling getWalletServiceInstance',data:{},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            const walletService = getWalletServiceInstance();
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H3',location:'wallets.js:on-chain-balances',message:'Calling getOnChainBalances',data:{},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            const balances = await walletService.getOnChainBalances(wallets);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H3',location:'wallets.js:on-chain-balances',message:'getOnChainBalances succeeded',data:{resultCount:balances?.length},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            return sendSuccess(res, balances);
        } catch (error) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H3',location:'wallets.js:on-chain-balances',message:'Error caught',data:{error:error.message,stack:error.stack?.substring(0,200)},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            console.error('[Admin Wallets] Error fetching on-chain balances:', error);
            // 提供更詳細的錯誤信息（但不暴露敏感信息）
            let errorMessage = 'Internal server error';
            if (error.message) {
                if (error.message.includes('NILE_NODE_HOST')) {
                    errorMessage = 'TronWeb configuration error';
                } else if (error.message.includes('not available')) {
                    errorMessage = 'WalletService is not available';
                } else if (error.message.includes('p-limit')) {
                    errorMessage = 'Concurrency module error';
                }
            }
            return sendError(res, 500, errorMessage);
        }
    });

}

module.exports = walletsRoutes;
