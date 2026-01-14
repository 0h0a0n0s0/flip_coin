// routes/admin/users.js
// 管理員用戶管理相關路由

const db = require('@flipcoin/database');
const authMiddleware = require('../../middleware/auth');
const checkPermission = require('../../middleware/checkPermissionMiddleware');
const { recordAuditLog } = require('../../services/auditLogService');
const { maskAddress } = require('../../utils/maskUtils');
const { getClientIp } = require('../../utils/ipUtils');
const { logBalanceChange, CHANGE_TYPES } = require('../../utils/balanceChangeLogger');
const { sendError, sendSuccess } = require('../../utils/safeResponse');

/**
 * 用戶管理相關路由
 * @param {Router} router - Express router 實例
 */
function usersRoutes(router) {
    /**
     * @description 獲取用戶列表
     * @params query {
     * 移除 walletAddress, 新增 username, balance
     * }
     */
    router.get('/users', authMiddleware, checkPermission('users', 'read'), async (req, res) => {
    const { 
        page = 1, limit = 10,
        userId,
        username,
        dateRange, 
        nickname, 
        status,
        inviteCode,
        referrerCode,
        lastLoginIp,
        activityDateRange
    } = req.query;

    try {
        const params = [];
        let whereClauses = [];
        let paramIndex = 1;

        if (userId) { params.push(`%${userId}%`); whereClauses.push(`user_id ILIKE $${paramIndex++}`); }
        if (username) { params.push(`%${username}%`); whereClauses.push(`username ILIKE $${paramIndex++}`); }
        
        // (省略 dateRange 和 activityDateRange 的程式码，它们保持不变)
        if (dateRange) { 
            try {
                const [startDate, endDate] = JSON.parse(dateRange);
                params.push(startDate); whereClauses.push(`created_at >= $${paramIndex++}`);
                params.push(endDate); whereClauses.push(`created_at <= $${paramIndex++}`);
            } catch (e) {}
        }
        
        if (nickname) { params.push(nickname); whereClauses.push(`nickname = $${paramIndex++}`); }
        if (status) { params.push(status); whereClauses.push(`status = $${paramIndex++}`); }
        if (inviteCode) { params.push(inviteCode); whereClauses.push(`invite_code = $${paramIndex++}`); }
        if (referrerCode) { params.push(referrerCode); whereClauses.push(`referrer_code = $${paramIndex++}`); }
        if (lastLoginIp) { params.push(lastLoginIp); whereClauses.push(`last_login_ip = $${paramIndex++}`); }

        if (activityDateRange) {
             try {
                const [startDate, endDate] = JSON.parse(activityDateRange);
                params.push(startDate); whereClauses.push(`last_activity_at >= $${paramIndex++}`);
                params.push(endDate); whereClauses.push(`last_activity_at <= $${paramIndex++}`);
            } catch (e) {}
        }
        
        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const countSql = `SELECT COUNT(*) FROM users ${whereSql}`;
        const countResult = await db.query(countSql, params);
        const total = parseInt(countResult.rows[0].count, 10);

        if (total === 0) {
            return sendSuccess(res, { total: 0, list: [] });
        }

        const dataSql = `
            SELECT 
                id, user_id, username, balance,
                current_streak, max_streak, created_at,
                nickname, level, invite_code, referrer_code, status,
                last_login_ip, last_activity_at, user_agent,
                tron_deposit_address, evm_deposit_address
            FROM users 
            ${whereSql}
            ORDER BY created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;
        
        const offset = (page - 1) * limit;
        params.push(limit);
        params.push(offset);
        const dataResult = await db.query(dataSql, params);
        const list = dataResult.rows.map(row => ({
            ...row,
            tron_deposit_address_masked: maskAddress(row.tron_deposit_address || ''),
            evm_deposit_address_masked: maskAddress(row.evm_deposit_address || '')
        }));

        sendSuccess(res, { total: total, list });
    } catch (error) {
        // (★★★ 500 错误会在這里被捕获并记录 ★★★)
        console.error('[Admin Users] Error fetching users:', error);
        sendError(res, 500, 'Internal server error');
    }
});


    /**
     * @description (管理员) 更新用户资料
     */
    router.put('/users/:id', authMiddleware, async (req, res, next) => {
    // (這是一個特例，我们需要基于 req.body 内容進行动态权限检查)
    const { id } = req.params;
    const { nickname, level, referrer_code, balance } = req.body;
    const { role_id, username } = req.user;

    try {
        // 1. 检查基础权限 ('update_info')
        const hasInfoPerm = await db.query(
            `SELECT 1 FROM admin_role_permissions arp
             JOIN admin_permissions ap ON arp.permission_id = ap.id
             WHERE arp.role_id = $1 AND ap.resource = 'users' AND ap.action = 'update_info' LIMIT 1`,
            [role_id]
        );
        if (hasInfoPerm.rows.length === 0) {
            console.warn(`[RBAC] Denied: User ${username} (RoleID: ${role_id}) tried to access users:update_info.`);
            return sendError(res, 403, 'Forbidden: You do not have permission to update user info.');
        }

        // 2. 如果请求中包含 'balance'，則 *额外* 检查 'update_balance' 权限
        if (balance !== undefined) {
            const hasBalancePerm = await db.query(
                `SELECT 1 FROM admin_role_permissions arp
                 JOIN admin_permissions ap ON arp.permission_id = ap.id
                 WHERE arp.role_id = $1 AND ap.resource = 'users' AND ap.action = 'update_balance' LIMIT 1`,
                [role_id]
            );
            if (hasBalancePerm.rows.length === 0) {
                console.warn(`[RBAC] Denied: User ${username} (RoleID: ${role_id}) tried to access users:update_balance.`);
                return sendError(res, 403, 'Forbidden: You do not have permission to update user balance.');
            }
        }
        
        // 3. (权限检查通过) 执行更新逻辑
        // ... (更新逻辑保持不变) ...
        const updates = []; const params = []; let paramIndex = 1;
        if (nickname !== undefined) { updates.push(`nickname = $${paramIndex++}`); params.push(nickname); }
        if (level !== undefined) {
            const newLevel = parseInt(level, 10);
            if (isNaN(newLevel) || newLevel <= 0) { return sendError(res, 400, 'Invalid level.'); }
            const levelExists = await db.query('SELECT 1 FROM user_levels WHERE level = $1', [newLevel]);
            if (levelExists.rows.length === 0) { return sendError(res, 400, `Level ${newLevel} does not exist.`); }
            updates.push(`level = $${paramIndex++}`); params.push(newLevel);
        }
        if (referrer_code !== undefined) {
            if (referrer_code === null || referrer_code === '') {
                updates.push(`referrer_code = $${paramIndex++}`); params.push(null);
            } else {
                const referrerExists = await db.query('SELECT 1 FROM users WHERE invite_code = $1', [referrer_code]);
                if (referrerExists.rows.length === 0) { return sendError(res, 400, 'Invalid referrer code.'); }
                const selfCheck = await db.query('SELECT 1 FROM users WHERE id = $1 AND invite_code = $2', [id, referrer_code]);
                if (selfCheck.rows.length > 0) { return sendError(res, 400, 'Cannot set self as referrer.'); }
                updates.push(`referrer_code = $${paramIndex++}`); params.push(referrer_code);
            }
        }
        // 如果调整余额，先获取旧余额用于记录账变
        let oldBalance = null;
        if (balance !== undefined) {
            const userResult = await db.query('SELECT balance, user_id FROM users WHERE id = $1', [id]);
            if (userResult.rows.length === 0) {
                return sendError(res, 404, 'User not found.');
            }
            oldBalance = parseFloat(userResult.rows[0].balance || 0);
        }

        if (balance !== undefined) {
            const newBalance = parseFloat(balance);
            if (isNaN(newBalance) || newBalance < 0) { return sendError(res, 400, 'Invalid balance.'); }
            updates.push(`balance = $${paramIndex++}`); params.push(newBalance);
        }
        if (updates.length === 0) { return sendError(res, 400, 'No valid fields provided for update.'); }
        params.push(id); 
        const updateSql = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        const result = await db.query(updateSql, params);
        if (result.rows.length === 0) { return sendError(res, 404, 'User not found.'); }
        console.log(`[Admin Users] User ID ${result.rows[0].id} updated by ${req.user.username}`);
        
        // 记录账变（如果调整了余额）
        if (balance !== undefined && oldBalance !== null) {
            const newBalance = parseFloat(balance);
            const balanceChange = newBalance - oldBalance;
            const user_id = result.rows[0].user_id;
            
            if (balanceChange !== 0) {
                try {
                    await logBalanceChange({
                        user_id: user_id,
                        change_type: CHANGE_TYPES.MANUAL_ADJUST,
                        amount: balanceChange,
                        balance_after: newBalance,
                        remark: `管理员 ${req.user.username} 人工调整余额，旧余额: ${oldBalance}, 新余额: ${newBalance}`
                    });
                } catch (error) {
                    console.error('[Admin Users] Failed to log balance change:', error);
                    // 不阻止主流程，只记录错误
                }
            }
        }
        
        const updateFields = [];
        if (nickname !== undefined) updateFields.push(`昵称: ${nickname}`);
        if (level !== undefined) updateFields.push(`等级: ${level}`);
        if (referrer_code !== undefined) updateFields.push(`推荐人: ${referrer_code || '清除'}`);
        if (balance !== undefined) updateFields.push(`余额: ${balance}`);
        await recordAuditLog({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'update_user',
            resource: 'users',
            resourceId: id.toString(),
            description: `更新用戶資料 (用戶ID: ${id})：${updateFields.join(', ')}`,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent']
        });
        sendSuccess(res, result.rows[0]);

    } catch (error) {
        console.error('[Admin Users] Error updating user (v6):', error);
        sendError(res, 500, 'Internal server error');
    }
});


    // GET /api/admin/users/by-referrer/:invite_code
    /**
     * @description 根据邀请码查询推薦的用户列表
     * @route GET /api/admin/users/by-referrer/:invite_code
     * @access Private (需要 Token)
     */
    router.get('/users/by-referrer/:invite_code', authMiddleware, checkPermission('users', 'read'), async (req, res) => {
    const { invite_code } = req.params;

    try {
        // 移除 wallet_address
        const result = await db.query(
            'SELECT user_id, nickname, created_at FROM users WHERE referrer_code = $1 ORDER BY created_at DESC',
            [invite_code]
        );
        
        sendSuccess(res, result.rows);

    } catch (error) {
        console.error(`[Admin Users] Error fetching referrals for code ${invite_code}:`, error);
        sendError(res, 500, 'Internal server error');
    }
});

    // 用户管理 - 更新用户狀态 (禁用投注)
    /**
     * @description 更新用户狀态 (例如 'active' 或 'banned')
     * @route PATCH /api/admin/users/:id/status
     * @access Private (需要 Token)
     * @body { status: string }
     */
    router.patch('/users/:id/status', authMiddleware, checkPermission('users', 'update_status'), async (req, res) => {
    const { id } = req.params; // 要更新的用户 DB ID
    const { status } = req.body; // 新的狀态 ('active' or 'banned')

    if (!status) {
        return sendError(res, 400, 'Status is required.');
    }
    
    // (我们也可以在這里检查 v1 的 API，如果狀态是 'banned'，則拒绝 /api/bets 请求，但這一步我们先完成後台)

    try {
        const result = await db.query(
            'UPDATE users SET status = $1 WHERE id = $2 RETURNING id, status, username',
            [status, id]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, 'User not found.');
        }
        await recordAuditLog({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'update_user_status',
            resource: 'users',
            resourceId: id.toString(),
            description: `更新用戶狀態 (用戶ID: ${id}, 用戶名: ${result.rows[0].username || 'N/A'})：${status}`,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent']
        });

        console.log(`[Admin Users] User ID ${result.rows[0].id} status updated to ${result.rows[0].status} by ${req.user.username}`);
        sendSuccess(res, result.rows[0]);

    } catch (error) {
        console.error('[Admin Users] Error updating user status:', error);
        sendError(res, 500, 'Internal server error');
    }
});

    /**
     * @description 获取用户充值地址列表
     * @route GET /api/admin/users/deposit-addresses
     * @access Private
     */
    router.get('/users/deposit-addresses', authMiddleware, checkPermission('users_addresses', 'read'), async (req, res) => {
    const { 
        page = 1, limit = 10,
        userId, username, 
        tronAddress, evmAddress, 
        pathIndex 
    } = req.query;

    try {
        const params = [];
        let whereClauses = [];
        let paramIndex = 1;

        if (userId) { params.push(`%${userId}%`); whereClauses.push(`u.user_id ILIKE $${paramIndex++}`); }
        if (username) { params.push(`%${username}%`); whereClauses.push(`u.username ILIKE $${paramIndex++}`); }
        if (tronAddress) { params.push(tronAddress); whereClauses.push(`u.tron_deposit_address = $${paramIndex++}`); }
        if (evmAddress) { params.push(evmAddress); whereClauses.push(`u.evm_deposit_address = $${paramIndex++}`); }
        if (pathIndex) { params.push(parseInt(pathIndex, 10)); whereClauses.push(`u.deposit_path_index = $${paramIndex++}`); }
        
        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        
        const countSql = `SELECT COUNT(u.id) FROM users u ${whereSql}`;
        const countResult = await db.query(countSql, params);
        const total = parseInt(countResult.rows[0].count, 10);

        if (total === 0) {
            return sendSuccess(res, { total: 0, list: [] });
        }

        const dataSql = `
            SELECT 
                u.user_id, u.username, 
                u.deposit_path_index, 
                u.tron_deposit_address, u.evm_deposit_address
            FROM users u
            ${whereSql}
            ORDER BY u.deposit_path_index DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;
        
        const offset = (page - 1) * limit;
        params.push(limit);
        params.push(offset);
        const dataResult = await db.query(dataSql, params);

        sendSuccess(res, { total: total, list: dataResult.rows });
    } catch (error) {
        console.error('[Admin Addr] Error fetching user addresses (v7):', error);
        sendError(res, 500, 'Internal server error');
    }
});
}

module.exports = usersRoutes;
