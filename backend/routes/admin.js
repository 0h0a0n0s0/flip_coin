// 档案: backend/routes/admin.js (★★★ v7.2 栏位修复版 ★★★)

const { ethers } = require('ethers');
const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermissionMiddleware');
const superAdminOnly = checkPermission(['super_admin']);
const settingsCacheModule = require('../services/settingsCache');
const { recordAuditLog } = require('../services/auditLogService');
const riskControlService = require('../services/riskControlService');
const { maskAddress, maskTxHash } = require('../utils/maskUtils');

// (★★★ v8.1 新增：用于存储 io 和 connectedUsers ★★★)
let io = null;
let connectedUsers = null;

/**
 * @description 设置 io 和 connectedUsers（从 server.js 调用）
 */
router.setIoAndConnectedUsers = (socketIO, users) => {
    io = socketIO;
    connectedUsers = users;
};

/**
 * @description 後台管理员登入 (★★★ 侦错日志已移除 ★★★)
 * @route POST /api/admin/login
 */
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }
    try {
        // 1. 查找用户 (包含 role 和 status)
        const result = await db.query('SELECT * FROM admin_users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // 2. 验证密码
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // (★★★ v2 新增：检查帐号狀态 ★★★)
        if (user.status !== 'active') {
            return res.status(403).json({ error: 'Account is disabled.' });
        }

        // 3. 签发 JWT (★★★ v2 新增：加入 role ★★★)
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username,
                role_id: user.role_id // (将角色 寫入 Token)
            },
            process.env.JWT_SECRET,
            { expiresIn: '8h' } 
        );
        res.status(200).json({ message: 'Login successful', token: token });
    } catch (error) {
        console.error('[Admin Login] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 获取当前登入用户的所有权限 (用于前端 UI 显示/隐藏)
 * @route GET /api/admin/my-permissions
 */
router.get('/my-permissions', authMiddleware, async (req, res) => {
    if (!req.user || !req.user.role_id) {
        console.warn(`[RBAC] Denied /my-permissions: User object or role_id not found in request.`);
        return res.status(403).json({ error: 'Forbidden: User role not found (old token?).' });
    }
    const { role_id } = req.user;
    try {
        const query = `
            SELECT DISTINCT ap.resource, ap.action
            FROM admin_role_permissions arp
            JOIN admin_permissions ap ON arp.permission_id = ap.id
            WHERE arp.role_id = $1;
        `;
        const result = await db.query(query, [role_id]);
        const permissionsMap = result.rows.reduce((acc, perm) => {
            acc[`${perm.resource}:${perm.action}`] = true;
            return acc;
        }, {});
        res.status(200).json(permissionsMap);
    } catch (error) {
        console.error(`[RBAC] Error fetching permissions for RoleID ${role_id}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 获取核心统计数据 (范例)
 * @route GET /api/admin/stats
 * @access Private (需要 Token)
 */
router.get('/stats', authMiddleware, checkPermission('dashboard', 'read'), async (req, res) => {
    console.log(`[Admin Stats] User ${req.user.username} is requesting stats...`);
    try {
        const userCountResult = await db.query('SELECT COUNT(*) FROM users');
        const totalUsers = userCountResult.rows[0].count;

        const betCountResult = await db.query('SELECT COUNT(*) FROM bets');
        const totalBets = betCountResult.rows[0].count;

        // (★★★ v6 修改：不再有 prize_pending ★★★)
        const pendingWithdrawalsResult = await db.query("SELECT COUNT(*) FROM platform_transactions WHERE type = 'withdraw' AND status = 'pending'");
        const pendingPayouts = pendingWithdrawalsResult.rows[0].count;

        res.status(200).json({
            totalUsers: parseInt(totalUsers),
            totalBets: parseInt(totalBets),
            pendingPayouts: parseInt(pendingPayouts) // (改为 待处理提現)
        });
    } catch (error) {
        console.error('[Admin Stats] Error fetching stats (v6):', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- 用户管理  ---
/**
 * @description 获取用户列表
 * @params query {
 * (★★★ 移除 walletAddress, 新增 username, balance ★★★)
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
            return res.status(200).json({ total: 0, list: [] });
        }

        const dataSql = `
            SELECT 
                id, user_id, username, balance,
                current_streak, max_streak, created_at,
                nickname, level, invite_code, referrer_code, status,
                last_login_ip, last_activity_at, user_agent
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

        res.status(200).json({ total: total, list });
    } catch (error) {
        // (★★★ 500 错误会在這里被捕获并记录 ★★★)
        console.error('[Admin Users] Error fetching users (v7.2):', error);
        res.status(500).json({ error: 'Internal server error' });
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
            return res.status(403).json({ error: 'Forbidden: You do not have permission to update user info.' });
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
                return res.status(403).json({ error: 'Forbidden: You do not have permission to update user balance.' });
            }
        }
        
        // 3. (权限检查通过) 执行更新逻辑
        // ... (更新逻辑保持不变) ...
        const updates = []; const params = []; let paramIndex = 1;
        if (nickname !== undefined) { updates.push(`nickname = $${paramIndex++}`); params.push(nickname); }
        if (level !== undefined) {
            const newLevel = parseInt(level, 10);
            if (isNaN(newLevel) || newLevel <= 0) { return res.status(400).json({ error: 'Invalid level.' }); }
            const levelExists = await db.query('SELECT 1 FROM user_levels WHERE level = $1', [newLevel]);
            if (levelExists.rows.length === 0) { return res.status(400).json({ error: `Level ${newLevel} does not exist.` }); }
            updates.push(`level = $${paramIndex++}`); params.push(newLevel);
        }
        if (referrer_code !== undefined) {
            if (referrer_code === null || referrer_code === '') {
                updates.push(`referrer_code = $${paramIndex++}`); params.push(null);
            } else {
                const referrerExists = await db.query('SELECT 1 FROM users WHERE invite_code = $1', [referrer_code]);
                if (referrerExists.rows.length === 0) { return res.status(400).json({ error: 'Invalid referrer code.' }); }
                const selfCheck = await db.query('SELECT 1 FROM users WHERE id = $1 AND invite_code = $2', [id, referrer_code]);
                if (selfCheck.rows.length > 0) { return res.status(400).json({ error: 'Cannot set self as referrer.' }); }
                updates.push(`referrer_code = $${paramIndex++}`); params.push(referrer_code);
            }
        }
        if (balance !== undefined) {
            const newBalance = parseFloat(balance);
            if (isNaN(newBalance) || newBalance < 0) { return res.status(400).json({ error: 'Invalid balance.' }); }
            updates.push(`balance = $${paramIndex++}`); params.push(newBalance);
        }
        if (updates.length === 0) { return res.status(400).json({ error: 'No valid fields provided for update.' }); }
        params.push(id); 
        const updateSql = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        const result = await db.query(updateSql, params);
        if (result.rows.length === 0) { return res.status(404).json({ error: 'User not found.' }); }
        console.log(`[Admin Users] User ID ${result.rows[0].id} updated by ${req.user.username}`);
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
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        res.status(200).json(result.rows[0]);

    } catch (error) {
        console.error('[Admin Users] Error updating user (v6):', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// (★★★ 新增 GET /api/admin/users/by-referrer/:invite_code ★★★)
/**
 * @description 根据邀请码查询推薦的用户列表
 * @route GET /api/admin/users/by-referrer/:invite_code
 * @access Private (需要 Token)
 */
router.get('/users/by-referrer/:invite_code', authMiddleware, checkPermission('users', 'read'), async (req, res) => {
    const { invite_code } = req.params;

    try {
        // (★★★ 移除 wallet_address ★★★)
        const result = await db.query(
            'SELECT user_id, nickname, created_at FROM users WHERE referrer_code = $1 ORDER BY created_at DESC',
            [invite_code]
        );
        
        res.status(200).json(result.rows);

    } catch (error) {
        console.error(`[Admin Users] Error fetching referrals for code ${invite_code}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ★★★用户管理 - 更新用户狀态 (禁用投注) ★★★
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
        return res.status(400).json({ error: 'Status is required.' });
    }
    
    // (我们也可以在這里检查 v1 的 API，如果狀态是 'banned'，則拒绝 /api/bets 请求，但這一步我们先完成後台)

    try {
        const result = await db.query(
            'UPDATE users SET status = $1 WHERE id = $2 RETURNING id, status, username',
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        await recordAuditLog({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'update_user_status',
            resource: 'users',
            resourceId: id.toString(),
            description: `更新用戶狀態 (用戶ID: ${id}, 用戶名: ${result.rows[0].username || 'N/A'})：${status}`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        console.log(`[Admin Users] User ID ${result.rows[0].id} status updated to ${result.rows[0].status} by ${req.user.username}`);
        res.status(200).json(result.rows[0]);

    } catch (error) {
        console.error('[Admin Users] Error updating user status:', error);
        res.status(500).json({ error: 'Internal server error' });
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
            return res.status(200).json({ total: 0, list: [] });
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

        res.status(200).json({ total: total, list: dataResult.rows });
    } catch (error) {
        console.error('[Admin Addr] Error fetching user addresses (v7):', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// --- 注单管理  ---
router.get('/bets', authMiddleware, checkPermission('bets', 'read'), async (req, res) => {
    const {
        page = 1, limit = 10,
        betId, userId, 
        status, dateRange
    } = req.query;

    try {
        const params = [];
        let whereClauses = [];
        let paramIndex = 1;

        if (betId) { params.push(`%${betId}%`); whereClauses.push(`b.id::text ILIKE $${paramIndex++}`); }
        if (userId) { params.push(`%${userId}%`); whereClauses.push(`b.user_id ILIKE $${paramIndex++}`); }
        if (status) { params.push(status); whereClauses.push(`b.status = $${paramIndex++}`); }
        if (dateRange) { 
            try {
                const [startDate, endDate] = JSON.parse(dateRange);
                params.push(startDate); whereClauses.push(`b.bet_time >= $${paramIndex++}`);
                params.push(endDate); whereClauses.push(`b.bet_time <= $${paramIndex++}`);
            } catch (e) {}
        }
        
        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const fromSql = 'FROM bets b';

        const countSql = `SELECT COUNT(b.id) ${fromSql} ${whereSql}`;
        const countResult = await db.query(countSql, params);
        const total = parseInt(countResult.rows[0].count, 10);
        if (total === 0) {
            return res.status(200).json({ total: 0, list: [] });
        }

        const dataSql = `
            SELECT 
                b.id, b.user_id,
                b.game_type, b.choice, b.amount, b.status, 
                b.bet_time, b.settle_time, 
                b.tx_hash,
                b.payout_multiplier
            ${fromSql}
            ${whereSql}
            ORDER BY b.bet_time DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;
        
        const offset = (page - 1) * limit;
        params.push(limit);
        params.push(offset);
        const dataResult = await db.query(dataSql, params);
        res.status(200).json({ total: total, list: dataResult.rows });
    } catch (error) {
        console.error('[Admin Bets] Error fetching bets (v6):', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- 盈虧报表 ---
router.get('/reports/profit-loss', authMiddleware, checkPermission('reports', 'read'), async (req, res) => {
    const { userQuery, dateRange } = req.query; 
    if (!dateRange) { return res.status(400).json({ error: 'Date range is required.' }); }
    
    try {
        // --- 1. 准备 bets 查询的参数 ---
        const betParams = [];
        let betWhereClauses = [];
        let betParamIndex = 1;
        let timeParamsAdded = false;
        
        try {
            const [startDate, endDate] = JSON.parse(dateRange);
            betParams.push(startDate);
            betWhereClauses.push(`b.bet_time >= $${betParamIndex++}`);
            betParams.push(endDate);
            betWhereClauses.push(`b.bet_time <= $${betParamIndex++}`);
            timeParamsAdded = true;
        } catch (e) { /* 必须有时间 */ }

        if (userQuery && userQuery.toLowerCase() !== 'system') {
            betParams.push(`%${userQuery}%`);
            const userFilterIndex = betParamIndex++;
            betWhereClauses.push(`(u.user_id ILIKE $${userFilterIndex} OR u.username ILIKE $${userFilterIndex})`);
        }
        
        const betWhereSql = `WHERE ${betWhereClauses.join(' AND ')}`;
        const betJoinSql = 'FROM bets b JOIN users u ON b.user_id = u.user_id';

        // --- 2. 查询 Bets 相关数据 (投注, 派奖) ---
        const betReportSql = `
            SELECT
                COALESCE(SUM(b.amount), 0) AS total_bet,
                COALESCE(SUM(
                    CASE 
                        WHEN b.status = 'won' THEN b.amount * b.payout_multiplier 
                        ELSE 0 
                    END
                ), 0) AS total_payout
            ${betJoinSql}
            ${betWhereSql}
        `;
        const betReportResult = await db.query(betReportSql, betParams);
        const betData = betReportResult.rows[0];

        // --- 3. 准备 platform_transactions 查询的参数 ---
        const bonusParams = [];
        let bonusWhereClauses = [];
        let bonusParamIndex = 1;
        
        if (timeParamsAdded) {
             const [startDate, endDate] = JSON.parse(dateRange);
             bonusParams.push(startDate);
             bonusWhereClauses.push(`pt.created_at >= $${bonusParamIndex++}`);
             bonusParams.push(endDate);
             bonusWhereClauses.push(`pt.created_at <= $${bonusParamIndex++}`);
        }
        
        if (userQuery && userQuery.toLowerCase() !== 'system') {
            bonusParams.push(`%${userQuery}%`);
            const userFilterIndex = bonusParamIndex++;
            bonusWhereClauses.push(`(u.user_id ILIKE $${userFilterIndex} OR u.username ILIKE $${userFilterIndex})`);
        }
        
        const bonusWhereSql = bonusWhereClauses.length > 0 ? `WHERE ${bonusWhereClauses.join(' AND ')}` : '';
        const bonusJoinSql = 'FROM platform_transactions pt JOIN users u ON pt.user_id = u.user_id';

        // --- 4. 查询其他支出 (奖金, 提現, Gas) ---
        const bonusReportSql = `
            SELECT
                COALESCE(SUM(CASE WHEN pt.type = 'level_up_reward' THEN pt.amount ELSE 0 END), 0) AS bonus_level,
                COALESCE(SUM(CASE WHEN pt.type = 'event_bonus' THEN pt.amount ELSE 0 END), 0) AS bonus_event,
                COALESCE(SUM(CASE WHEN pt.type = 'commission' THEN pt.amount ELSE 0 END), 0) AS bonus_commission,
                COALESCE(SUM(pt.gas_fee), 0) AS total_gas_fee
            ${userQuery && userQuery.toLowerCase() !== 'system' ? bonusJoinSql : 'FROM platform_transactions pt'}
            ${bonusWhereSql}
        `;
        const bonusReportResult = await db.query(bonusReportSql, bonusParams);
        const bonusData = bonusReportResult.rows[0];

        // --- 5. 汇总计算 ---
        const total_bet = parseFloat(betData.total_bet);
        const total_payout = parseFloat(betData.total_payout);
        const bonus_level = parseFloat(bonusData.bonus_level);
        const bonus_event = parseFloat(bonusData.bonus_event);
        const bonus_commission = parseFloat(bonusData.bonus_commission);
        const total_gas_fee = parseFloat(bonusData.total_gas_fee);
        
        const platform_profit = total_bet - total_payout; 
        const platform_net_profit = total_bet - total_payout - bonus_level - bonus_event - bonus_commission - total_gas_fee;

        // --- 6. 返回结果 ---
        res.status(200).json({
            total_bet, total_payout, platform_profit,
            bonus_event, bonus_level, bonus_commission,
            total_gas_fee, platform_net_profit
        });

    } catch (error) {
        console.error('[Admin Report] CRITICAL ERROR (v6):', error); 
        res.status(500).json({ error: 'Internal server error' });
    }
});


// --- 钱包监控 ---
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
        
        // (★★★ 查询 platform_wallets ★★★)
        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const countSql = `SELECT COUNT(*) FROM platform_wallets ${whereSql}`;
        const countResult = await db.query(countSql, params);
        const total = parseInt(countResult.rows[0].count, 10);

        if (total === 0) {
            return res.status(200).json({ total: 0, list: [] });
        }

        // (★★★ 查询 platform_wallets ★★★)
        const dataSql = `SELECT * FROM platform_wallets ${whereSql} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        const offset = (page - 1) * limit;
        params.push(limit); params.push(offset);
        const dataResult = await db.query(dataSql, params);
        const list = dataResult.rows.map(row => ({
            ...row,
            address_masked: maskAddress(row.address || '')
        }));
        
        res.status(200).json({ total, list });

    } catch (error) {
        console.error('[Admin Wallets] Error fetching wallets (v7):', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 新增平台钱包 
 */
router.post('/wallets', authMiddleware, checkPermission('wallets', 'cud'), async (req, res) => {
    // (★★★ 获取新栏位 ★★★)
    const { name, chain_type, address, is_gas_reserve, is_collection, is_opener_a, is_opener_b, is_active, is_payout } = req.body;
    if (!name || !chain_type || !address) {
        return res.status(400).json({ error: 'Name, chain_type, and address are required.' });
    }

    try {
        // (★★★ 插入 platform_wallets ★★★)
        const result = await db.query(
            `INSERT INTO platform_wallets (name, chain_type, address, is_gas_reserve, is_collection, is_opener_a, is_opener_b, is_active, is_payout) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [name, chain_type, address, !!is_gas_reserve, !!is_collection, !!is_opener_a, !!is_opener_b, !!is_active, !!is_payout] // (★★★ v8.1 修改 ★★★)
        );
        console.log(`[Admin Wallets] Wallet ${result.rows[0].id} created by ${req.user.username}`);

        await recordAuditLog({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'create_wallet',
            resource: 'platform_wallets',
            resourceId: result.rows[0].id?.toString(),
            description: `新增钱包：${result.rows[0].name} (${result.rows[0].address})`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { return res.status(409).json({ error: 'Wallet address already exists.' }); }
        console.error('[Admin Wallets] Error creating wallet (v7):', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 更新平台钱包
 */
router.put('/wallets/:id', authMiddleware, checkPermission('wallets', 'cud'), async (req, res) => {
    const { id } = req.params;
    // (★★★ 获取新栏位 ★★★)
    const { name, chain_type, address, is_gas_reserve, is_collection, is_opener_a, is_opener_b, is_active, is_payout } = req.body;
    if (!name || !chain_type || !address) { return res.status(400).json({ error: 'Fields are required.' }); }

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
            return res.status(404).json({ error: 'Wallet not found.' });
        }
        console.log(`[Admin Wallets] Wallet ${id} updated by ${req.user.username}`);

        await recordAuditLog({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'update_wallet',
            resource: 'platform_wallets',
            resourceId: id.toString(),
            description: `更新钱包：${result.rows[0].name} (${result.rows[0].address})`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(200).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { return res.status(409).json({ error: 'Wallet address already exists.' }); }
        console.error(`[Admin Wallets] Error updating wallet ${id} (v7):`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// (★★★ 刪除 platform_wallets ★★★)
router.delete('/wallets/:id', authMiddleware, checkPermission('wallets', 'cud'), async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('DELETE FROM platform_wallets WHERE id = $1 RETURNING id, name, address', [id]); // (查询 platform_wallets)
        if (result.rows.length === 0) { return res.status(404).json({ error: 'Wallet not found.' }); }
        console.log(`[Admin Wallets] Wallet ${id} deleted by ${req.user.username}`);

        await recordAuditLog({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'delete_wallet',
            resource: 'platform_wallets',
            resourceId: id.toString(),
            description: `刪除钱包：${result.rows[0].name || ''} (${result.rows[0].address || ''})`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(204).send();
    } catch (error) {
        console.error(`[Admin Wallets] Error deleting wallet ${id}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- 系统设定 ---
router.get('/settings', authMiddleware, checkPermission('settings_game', 'read'), async (req, res) => {
    try {
        const result = await db.query('SELECT key, value, description, category FROM system_settings');
        const settingsByCategory = result.rows.reduce((acc, row) => {
            if (!acc[row.category]) {
                acc[row.category] = {};
            }
            acc[row.category][row.key] = { 
                value: row.value, 
                description: row.description 
            };
            return acc;
        }, {});
        
        res.status(200).json(settingsByCategory);
    } catch (error) {
        console.error('[Admin Settings] Error fetching settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.put('/settings/:key', authMiddleware, checkPermission('settings_game', 'update'), async (req, res) => {
    const { key } = req.params;
    const { value } = req.body;
    if (value === undefined || value === null) { return res.status(400).json({ error: 'Value is required.' }); }

    let validatedValue = value.toString(); // 预设
    // (验证)
    if (key === 'PAYOUT_MULTIPLIER') {
        const numValue = parseInt(value, 10);
        if (isNaN(numValue) || numValue <= 0) { return res.status(400).json({ error: 'PAYOUT_MULTIPLIER must be a positive integer.' }); }
    }
    // (★★★ 验证 AUTO_WITHDRAW_THRESHOLD ★★★)
    if (key === 'AUTO_WITHDRAW_THRESHOLD') {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < 0) { return res.status(400).json({ error: 'AUTO_WITHDRAW_THRESHOLD 必须是有效的数字 (例如 10)' }); }
        validatedValue = numValue.toString();
    }
    // (★★★ 验证链开关 ★★★)
    if (key.startsWith('ALLOW_')) {
        if (value.toString() !== 'true' && value.toString() !== 'false') {
            return res.status(400).json({ error: 'Value must be true or false string.' });
        }
        validatedValue = value.toString();
    }

    try {
        const result = await db.query(
            'UPDATE system_settings SET value = $1, updated_at = NOW() WHERE key = $2 RETURNING key, value',
            [validatedValue, key]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: `Setting key '${key}' not found.` });
        }
        // (★★★ 触发快取更新 ★★★)
        await settingsCacheModule.loadSettings();
        console.log(`[Admin Settings] Setting '${key}' updated to '${value}' by ${req.user.username}`);

        await recordAuditLog({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'update_setting',
            resource: 'system_settings',
            resourceId: key,
            description: `更新系统设定 ${key} -> ${validatedValue}`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(`[Admin Settings] Error updating setting '${key}':`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ★★★ 系统设定 - 阻挡地区 API ★★★
/**
 * @description 获取阻挡地区列表 (不分页，一次全取)
 * @route GET /api/admin/blocked-regions
 * @access Private
 */
router.get('/blocked-regions', authMiddleware, checkPermission('settings_regions', 'read'), async (req, res) => {
    try {
        // (通常阻挡列表不会非常大，先不加分页)
        const result = await db.query('SELECT id, ip_range::text, description, created_at FROM blocked_regions ORDER BY created_at DESC');
        // (将 CIDR 转为 text 方便前端显示)
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('[Admin BlockedRegions] Error fetching regions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 新增阻挡地区
 * @route POST /api/admin/blocked-regions
 * @access Private
 * @body { ip_range: string, description?: string }
 */
router.post('/blocked-regions', authMiddleware, checkPermission('settings_regions', 'cud'), async (req, res) => {
    const { ip_range, description } = req.body;
    if (!ip_range) {
        return res.status(400).json({ error: 'IP range (CIDR format) is required.' });
    }
    // (未来可加强验证 ip_range 格式)

    try {
        const result = await db.query(
            'INSERT INTO blocked_regions (ip_range, description) VALUES ($1, $2) RETURNING id, ip_range::text, description, created_at',
            [ip_range, description || null] // description 可为空
        );
        console.log(`[Admin BlockedRegions] Region ${result.rows[0].ip_range} added by ${req.user.username}`);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // unique_violation
             return res.status(409).json({ error: 'IP range already exists.' });
        }
         // (处理可能的 CIDR 格式错误)
        if (error.code === '22P02') { // invalid_text_representation (通常是 CIDR 格式错误)
             return res.status(400).json({ error: 'Invalid IP range format. Please use CIDR notation (e.g., 1.2.3.4/32 or 1.2.3.0/24).' });
        }
        console.error('[Admin BlockedRegions] Error adding region:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 刪除阻挡地区
 * @route DELETE /api/admin/blocked-regions/:id
 * @access Private
 */
router.delete('/blocked-regions/:id', authMiddleware, checkPermission('settings_regions', 'cud'), async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('DELETE FROM blocked_regions WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Blocked region not found.' });
        }
        console.log(`[Admin BlockedRegions] Region ID ${id} deleted by ${req.user.username}`);
        res.status(204).send(); // No Content
    } catch (error) {
        console.error(`[Admin BlockedRegions] Error deleting region ${id}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ★★★ 系统设定 - 用户等级 CRUD API ★★★
/**
 * @description 获取所有用户等级设定
 * @route GET /api/admin/user-levels
 * @access Private
 */
router.get('/user-levels', authMiddleware, checkPermission('settings_levels', 'read'), async (req, res) => {
    try {
        // 按等级排序
        const result = await db.query('SELECT * FROM user_levels ORDER BY level ASC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('[Admin UserLevels] Error fetching levels:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 新增用户等级设定
 * @route POST /api/admin/user-levels
 * @access Private
 * @body { level, name, max_bet_amount, required_bets_for_upgrade, min_bet_amount_for_upgrade, upgrade_reward_amount }
 */
router.post('/user-levels', authMiddleware, checkPermission('settings_levels', 'cud'), async (req, res) => {
    const { level, name, max_bet_amount, required_bets_for_upgrade, min_bet_amount_for_upgrade, upgrade_reward_amount } = req.body;
    // (简单验证)
    if (!level || level <= 0 || !max_bet_amount || max_bet_amount < 0 || required_bets_for_upgrade < 0 || min_bet_amount_for_upgrade < 0 || upgrade_reward_amount < 0) {
        return res.status(400).json({ error: 'Invalid input data.' });
    }

    try {
        const result = await db.query(
            `INSERT INTO user_levels (level, name, max_bet_amount, required_bets_for_upgrade, min_bet_amount_for_upgrade, upgrade_reward_amount, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
             RETURNING *`,
            [level, name || `Level ${level}`, max_bet_amount, required_bets_for_upgrade, min_bet_amount_for_upgrade, upgrade_reward_amount]
        );
        console.log(`[Admin UserLevels] Level ${level} created by ${req.user.username}`);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // unique_violation (level 已存在)
             return res.status(409).json({ error: `Level ${level} already exists.` });
        }
        console.error('[Admin UserLevels] Error creating level:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 更新用户等级设定
 * @route PUT /api/admin/user-levels/:level
 * @access Private
 * @body { name, max_bet_amount, required_bets_for_upgrade, min_bet_amount_for_upgrade, upgrade_reward_amount }
 */
router.put('/user-levels/:level', authMiddleware, checkPermission('settings_levels', 'cud'), async (req, res) => {
    const level = parseInt(req.params.level, 10);
    const { name, max_bet_amount, required_bets_for_upgrade, min_bet_amount_for_upgrade, upgrade_reward_amount } = req.body;
    if (isNaN(level) || level <= 0 || !max_bet_amount || max_bet_amount < 0 || required_bets_for_upgrade < 0 || min_bet_amount_for_upgrade < 0 || upgrade_reward_amount < 0) {
         return res.status(400).json({ error: 'Invalid input data.' });
    }

    try {
        const result = await db.query(
            `UPDATE user_levels 
             SET name = $1, max_bet_amount = $2, required_bets_for_upgrade = $3, min_bet_amount_for_upgrade = $4, upgrade_reward_amount = $5, updated_at = NOW() 
             WHERE level = $6 
             RETURNING *`,
            [name || `Level ${level}`, max_bet_amount, required_bets_for_upgrade, min_bet_amount_for_upgrade, upgrade_reward_amount, level]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: `Level ${level} not found.` });
        }
        console.log(`[Admin UserLevels] Level ${level} updated by ${req.user.username}`);
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(`[Admin UserLevels] Error updating level ${level}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 刪除用户等级设定
 * @route DELETE /api/admin/user-levels/:level
 * @access Private
 */
router.delete('/user-levels/:level', authMiddleware, checkPermission('settings_levels', 'cud'), async (req, res) => {
    const level = parseInt(req.params.level, 10);
     if (isNaN(level) || level <= 0) {
        return res.status(400).json({ error: 'Invalid level.' });
    }
    // (安全机制：通常不允许刪除 Level 1)
    if (level === 1) {
        return res.status(400).json({ error: 'Cannot delete Level 1.' });
    }
    // (未来可扩充：检查是否有用户正在此等级，若有則阻止刪除)

    try {
        const result = await db.query('DELETE FROM user_levels WHERE level = $1 RETURNING level', [level]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: `Level ${level} not found.` });
        }
        console.log(`[Admin UserLevels] Level ${level} deleted by ${req.user.username}`);
        res.status(204).send(); // No Content
    } catch (error) {
        console.error(`[Admin UserLevels] Error deleting level ${level}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ★★★ 後台管理 - 帐号管理 CRUD API ★★★
/**
 * @description 获取後台帐号列表
 * @route GET /api/admin/accounts
 * @access Private (未来应限制为 super_admin)
 */
router.get('/accounts', authMiddleware, checkPermission('admin_accounts', 'read'), async (req, res) => {
    try {
        // (★★★ Y-6: JOIN admin_roles 获取角色名称 ★★★)
        const result = await db.query(`
            SELECT u.id, u.username, u.status, u.created_at, u.role_id, r.name as role_name 
            FROM admin_users u
            LEFT JOIN admin_roles r ON u.role_id = r.id
            ORDER BY u.id ASC
        `);
        res.status(200).json(result.rows);
    } catch (error) { console.error('[Admin Accounts] Error fetching accounts:', error); res.status(500).json({ error: 'Internal server error' }); }
});
router.post('/accounts', authMiddleware, checkPermission('admin_accounts', 'cud'), async (req, res) => {
    // (★★★ Y-7: 栏位改为 role_id ★★★)
    const { username, password, role_id, status } = req.body;
    if (!username || !password || !role_id || !status) {
        return res.status(400).json({ error: 'Username, password, role_id, and status are required.' });
    }
    try {
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        const result = await db.query(
            'INSERT INTO admin_users (username, password_hash, role_id, status) VALUES ($1, $2, $3, $4) RETURNING id, username, role_id, status, created_at',
            [username, password_hash, role_id, status]
        );
        console.log(`[Admin Accounts] Account ${username} created by ${req.user.username}`);
        await recordAuditLog({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'create_admin_account',
            resource: 'admin_users',
            resourceId: result.rows[0].id.toString(),
            description: `新增後台帳號：${username} (角色ID: ${role_id}, 狀態: ${status})`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        res.status(201).json(result.rows[0]);
    } catch (error) { if (error.code === '23505') { return res.status(409).json({ error: 'Username already exists.' }); } console.error('[Admin Accounts] Error creating account:', error); res.status(500).json({ error: 'Internal server error' }); }
});
router.put('/accounts/:id', authMiddleware, checkPermission('admin_accounts', 'cud'), async (req, res) => {
    const { id } = req.params;
    // (★★★ Y-7: 栏位改为 role_id ★★★)
    const { username, password, role_id, status } = req.body;
    if (!username || !role_id || !status) {
        return res.status(400).json({ error: 'Username, role_id, and status are required.' });
    }
    try {
        let result;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(password, salt);
            result = await db.query(
                'UPDATE admin_users SET username = $1, role_id = $2, status = $3, password_hash = $4 WHERE id = $5 RETURNING id, username, role_id, status',
                [username, role_id, status, password_hash, id]
            );
        } else {
            result = await db.query(
                'UPDATE admin_users SET username = $1, role_id = $2, status = $3 WHERE id = $4 RETURNING id, username, role_id, status',
                [username, role_id, status, id]
            );
        }
        if (result.rows.length === 0) { return res.status(404).json({ error: 'Account not found.' }); }
        console.log(`[Admin Accounts] Account ID ${id} updated by ${req.user.username}`);
        await recordAuditLog({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'update_admin_account',
            resource: 'admin_users',
            resourceId: id.toString(),
            description: `更新後台帳號：${username} (角色ID: ${role_id}, 狀態: ${status}${password ? ', 已更新密碼' : ''})`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        res.status(200).json(result.rows[0]);
    } catch (error) { if (error.code === '23505') { return res.status(409).json({ error: 'Username already exists.' }); } console.error(`[Admin Accounts] Error updating account ${id}:`, error); res.status(500).json({ error: 'Internal server error' }); }
});

/**
 * @description 刪除後台帐号
 * @route DELETE /api/admin/accounts/:id
 * @access Private
 */
router.delete('/accounts/:id', authMiddleware, checkPermission('admin_accounts', 'cud'), async (req, res) => {
    const { id } = req.params;
    const currentUserId = req.user.id; // (从 JWT 获取)

    // (安全机制：不允许刪除自己)
    if (parseInt(id, 10) === currentUserId) {
        return res.status(403).json({ error: 'Cannot delete your own account.' });
    }
    // (安全机制：不允许刪除 ID=1 的 super_admin 帐号)
    if (parseInt(id, 10) === 1) {
         return res.status(403).json({ error: 'Cannot delete the primary super admin account.' });
    }

    try {
        const result = await db.query('DELETE FROM admin_users WHERE id = $1 RETURNING id, username', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Account not found.' });
        }
        console.log(`[Admin Accounts] Account ID ${id} deleted by ${req.user.username}`);
        await recordAuditLog({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'delete_admin_account',
            resource: 'admin_users',
            resourceId: id.toString(),
            description: `刪除後台帳號：${result.rows[0].username || id}`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        res.status(204).send(); // No Content
    } catch (error) {
        console.error(`[Admin Accounts] Error deleting account ${id}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/ip-whitelist', authMiddleware, checkPermission('admin_ip_whitelist', 'read'), async (req, res) => {
    try {
        const result = await db.query('SELECT id, ip_range::text, description, created_at FROM admin_ip_whitelist ORDER BY created_at DESC');
        res.status(200).json(result.rows);
    } catch (error) { 
        console.error('[Admin IP Whitelist] Error fetching list:', error);
        res.status(500).json({ error: 'Internal server error' }); 
    }
});

router.post('/ip-whitelist', authMiddleware, checkPermission('admin_ip_whitelist', 'cud'), async (req, res) => {
    const { ip_range, description } = req.body;
    if (!ip_range) {
        return res.status(400).json({ error: 'IP range (CIDR format) is required.' });
    }
    try {
        const result = await db.query(
            'INSERT INTO admin_ip_whitelist (ip_range, description) VALUES ($1, $2) RETURNING id, ip_range::text, description, created_at', 
            [ip_range, description || null]
        );
        await recordAuditLog({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'add_ip_whitelist',
            resource: 'admin_ip_whitelist',
            resourceId: result.rows[0].id.toString(),
            description: `新增IP白名單：${ip_range}${description ? ` (${description})` : ''}`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        res.status(201).json(result.rows[0]);
    } catch (error) { 
        if (error.code === '23505') { return res.status(409).json({ error: 'IP range already exists.' }); }
        if (error.code === '22P02') { return res.status(400).json({ error: 'Invalid IP range format (use CIDR).' }); }
        console.error('[Admin IP Whitelist] Error adding IP:', error);
        res.status(500).json({ error: 'Internal server error' }); 
    }
});

router.delete('/ip-whitelist/:id', authMiddleware, checkPermission('admin_ip_whitelist', 'cud'), async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('DELETE FROM admin_ip_whitelist WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'IP rule not found.' });
        }
        await recordAuditLog({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'delete_ip_whitelist',
            resource: 'admin_ip_whitelist',
            resourceId: id.toString(),
            description: `刪除IP白名單：${id}`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        res.status(204).send();
    } catch (error) { 
        console.error(`[Admin IP Whitelist] Error deleting IP ${id}:`, error);
        res.status(500).json({ error: 'Internal server error' }); 
    }
});

/**
 * @description 获取所有权限组 (Roles) 列表
 * @route GET /api/admin/roles
 */
router.get('/roles', authMiddleware, checkPermission('admin_permissions', 'read'), async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM admin_roles ORDER BY id ASC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('[Admin RBAC] Error fetching roles:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 获取所有可用的权限 (Permissions) 列表 (用于前端渲染)
 * @route GET /api/admin/permissions
 */
router.get('/permissions', authMiddleware, checkPermission('admin_permissions', 'read'), async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM admin_permissions ORDER BY category, resource, action');
        // (按 category 分组，方便前端渲染)
        const permissionsByCategory = result.rows.reduce((acc, perm) => {
            if (!acc[perm.category]) {
                acc[perm.category] = [];
            }
            acc[perm.category].push(perm);
            return acc;
        }, {});
        res.status(200).json(permissionsByCategory);
    } catch (error) {
        console.error('[Admin RBAC] Error fetching permissions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 获取单一权限组及其拥有的权限 ID
 * @route GET /api/admin/roles/:id
 */
router.get('/roles/:id', authMiddleware, checkPermission('admin_permissions', 'read'), async (req, res) => {
    const { id } = req.params;
    try {
        const roleResult = await db.query('SELECT * FROM admin_roles WHERE id = $1', [id]);
        if (roleResult.rows.length === 0) {
            return res.status(404).json({ error: 'Role not found.' });
        }
        const role = roleResult.rows[0];
        
        const permsResult = await db.query('SELECT permission_id FROM admin_role_permissions WHERE role_id = $1', [id]);
        // (将权限 ID 拍平为一個陣列)
        role.permission_ids = permsResult.rows.map(r => r.permission_id);
        
        res.status(200).json(role);
    } catch (error) {
        console.error(`[Admin RBAC] Error fetching role ${id}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 新增权限组
 * @route POST /api/admin/roles
 */
router.post('/roles', authMiddleware, checkPermission('admin_permissions', 'update'), async (req, res) => {
    const { name, description, permission_ids = [] } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Role name is required.' });
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        // 1. 建立 Role
        const roleResult = await client.query(
            'INSERT INTO admin_roles (name, description) VALUES ($1, $2) RETURNING *',
            [name, description || null]
        );
        const newRole = roleResult.rows[0];

        // 2. 绑定权限
        if (permission_ids.length > 0) {
            const values = permission_ids.map((permId, i) => `($1, $${i + 2})`).join(', ');
            await client.query(
                `INSERT INTO admin_role_permissions (role_id, permission_id) VALUES ${values}`,
                [newRole.id, ...permission_ids]
            );
        }
        
        await client.query('COMMIT');
        await recordAuditLog({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'create_role',
            resource: 'admin_roles',
            resourceId: newRole.id.toString(),
            description: `新增權限組：${name}${description ? ` (${description})` : ''}，包含 ${permission_ids.length} 個權限`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        res.status(201).json(newRole);
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') { return res.status(409).json({ error: 'Role name already exists.' }); }
        console.error('[Admin RBAC] Error creating role:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

/**
 * @description 更新权限组
 * @route PUT /api/admin/roles/:id
 */
router.put('/roles/:id', authMiddleware, checkPermission('admin_permissions', 'update'), async (req, res) => {
    const { id } = req.params;
    const { name, description, permission_ids = [] } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Role name is required.' });
    }
    // (安全机制：不允许修改 Super Admin (ID 1))
    if (parseInt(id, 10) === 1) {
        return res.status(403).json({ error: 'Cannot modify the Super Admin role.' });
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        // 1. 更新 Role 基本资料
        const roleResult = await client.query(
            'UPDATE admin_roles SET name = $1, description = $2 WHERE id = $3 RETURNING *',
            [name, description || null, id]
        );
        if (roleResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Role not found.' });
        }
        
        // 2. 刪除所有旧权限
        await client.query('DELETE FROM admin_role_permissions WHERE role_id = $1', [id]);

        // 3. 绑定新权限
        if (permission_ids.length > 0) {
            const values = permission_ids.map((permId, i) => `($1, $${i + 2})`).join(', ');
            await client.query(
                `INSERT INTO admin_role_permissions (role_id, permission_id) VALUES ${values}`,
                [id, ...permission_ids]
            );
        }
        
        await client.query('COMMIT');
        await recordAuditLog({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'update_role',
            resource: 'admin_roles',
            resourceId: id.toString(),
            description: `更新權限組：${name}${description ? ` (${description})` : ''}，包含 ${permission_ids.length} 個權限`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        res.status(200).json(roleResult.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') { return res.status(409).json({ error: 'Role name already exists.' }); }
        console.error(`[Admin RBAC] Error updating role ${id}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

/**
 * @description 刪除权限组
 * @route DELETE /api/admin/roles/:id
 */
router.delete('/roles/:id', authMiddleware, checkPermission('admin_permissions', 'update'), async (req, res) => {
    const { id } = req.params;
    // (安全机制：不允许刪除 Super Admin / Admin / Operator (ID 1, 2, 3))
    if ([1, 2, 3].includes(parseInt(id, 10))) {
        return res.status(403).json({ error: 'Cannot delete default system roles.' });
    }
    
    // (注：刪除 role 会透过 ON DELETE CASCADE 自动刪除 role_permissions, 
    // 并透过 ON DELETE SET NULL 将 admin_users.role_id 设为 null)
    try {
        const result = await db.query('DELETE FROM admin_roles WHERE id = $1 RETURNING id, name', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Role not found.' });
        }
        await recordAuditLog({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'delete_role',
            resource: 'admin_roles',
            resourceId: id.toString(),
            description: `刪除權限組：${result.rows[0].name || id}`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        res.status(204).send();
    } catch (error) {
        console.error(`[Admin RBAC] Error deleting role ${id}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// (★★★ 获取充值记录列表 ★★★)
/**
 * @description 获取充值记录列表
 * @route GET /api/admin/deposits
 */
router.get('/deposits', authMiddleware, checkPermission('deposits', 'read'), async (req, res) => {
    const { page = 1, limit = 10, username, tx_hash, status, user_id, start_time, end_time } = req.query;
    
    try {
        const params = [];
        let whereClauses = ["pt.type = 'deposit'"]; // (限定类型为 'deposit')
        let paramIndex = 1;

        let startTimeValue = null;
        let endTimeValue = null;

        if (start_time) {
            const parsed = new Date(start_time);
            if (Number.isNaN(parsed.getTime())) {
                return res.status(400).json({ error: 'start_time 格式不正确' });
            }
            startTimeValue = parsed.toISOString();
        }

        if (end_time) {
            const parsed = new Date(end_time);
            if (Number.isNaN(parsed.getTime())) {
                return res.status(400).json({ error: 'end_time 格式不正确' });
            }
            endTimeValue = parsed.toISOString();
        }

        if (startTimeValue && endTimeValue && new Date(startTimeValue) > new Date(endTimeValue)) {
            return res.status(400).json({ error: '开始时间不得晚于结束时间' });
        }

        if (username) { params.push(`%${username}%`); whereClauses.push(`u.username ILIKE $${paramIndex++}`); }
        if (status) { params.push(status); whereClauses.push(`pt.status = $${paramIndex++}`); }
        if (tx_hash) { params.push(tx_hash); whereClauses.push(`pt.tx_hash = $${paramIndex++}`); }
        
        if (user_id) {
            const parsedUserId = parseInt(user_id, 10);
            if (Number.isNaN(parsedUserId)) {
                return res.status(400).json({ error: 'user_id 必须为整数' });
            }
            params.push(parsedUserId);
            whereClauses.push(`pt.user_id = $${paramIndex++}`);
        }

        if (startTimeValue) {
            params.push(startTimeValue);
            whereClauses.push(`pt.created_at >= $${paramIndex++}`);
        }

        if (endTimeValue) {
            params.push(endTimeValue);
            whereClauses.push(`pt.created_at <= $${paramIndex++}`);
        }
        
        const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
        const fromSql = `
            FROM platform_transactions pt
            JOIN users u ON pt.user_id = u.user_id
        `;
        
        const countSql = `SELECT COUNT(pt.id) ${fromSql} ${whereSql}`;
        const countResult = await db.query(countSql, params);
        const total = parseInt(countResult.rows[0].count, 10);

        if (total === 0) {
            return res.status(200).json({ total: 0, list: [] });
        }

        const dataSql = `
            SELECT 
                pt.id, pt.chain, pt.amount, pt.status, pt.tx_hash, pt.created_at,
                u.username,
                u.user_id
            ${fromSql}
            ${whereSql}
            ORDER BY pt.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;
        
        const offset = (page - 1) * limit;
        params.push(limit);
        params.push(offset);
        const dataResult = await db.query(dataSql, params);

        res.status(200).json({ total: total, list: dataResult.rows });

    } catch (error) {
        console.error('[Admin Deposits] Error fetching list:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description (新) 获取提款審核列表
 * @route GET /api/admin/withdrawals
 */
router.get('/withdrawals', authMiddleware, checkPermission('withdrawals', 'read'), async (req, res) => {
    const { page = 1, limit = 10, username, status, address, tx_hash, user_id, start_time, end_time } = req.query;
    
    try {
        const params = [];
        let whereClauses = [];
        let paramIndex = 1;

        let startTimeValue = null;
        let endTimeValue = null;

        if (start_time) {
            const parsed = new Date(start_time);
            if (Number.isNaN(parsed.getTime())) {
                return res.status(400).json({ error: 'start_time 格式不正确' });
            }
            startTimeValue = parsed.toISOString();
        }

        if (end_time) {
            const parsed = new Date(end_time);
            if (Number.isNaN(parsed.getTime())) {
                return res.status(400).json({ error: 'end_time 格式不正确' });
            }
            endTimeValue = parsed.toISOString();
        }

        if (startTimeValue && endTimeValue && new Date(startTimeValue) > new Date(endTimeValue)) {
            return res.status(400).json({ error: '开始时间不得晚于结束时间' });
        }

        if (username) { params.push(`%${username}%`); whereClauses.push(`u.username ILIKE $${paramIndex++}`); }
        if (status) { params.push(status); whereClauses.push(`w.status = $${paramIndex++}`); }
        if (address) { params.push(address); whereClauses.push(`w.address = $${paramIndex++}`); }
        if (tx_hash) { params.push(tx_hash); whereClauses.push(`w.tx_hash = $${paramIndex++}`); }
        if (user_id) {
            const parsedUserId = parseInt(user_id, 10);
            if (Number.isNaN(parsedUserId)) {
                return res.status(400).json({ error: 'user_id 必须为整数' });
            }
            params.push(parsedUserId);
            whereClauses.push(`w.user_id = $${paramIndex++}`);
        }

        if (startTimeValue) {
            params.push(startTimeValue);
            whereClauses.push(`w.request_time >= $${paramIndex++}`);
        }

        if (endTimeValue) {
            params.push(endTimeValue);
            whereClauses.push(`w.request_time <= $${paramIndex++}`);
        }
        
        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : 'WHERE 1=1';
        
        // (★★★ 关键：计算累计盈虧的子查询 ★★★)
        // (這是一個简化版的 P&L，僅计算 投注盈虧+奖金。注意：這在资料量大时会很慢)
        const pnlSubQuery = `
            (
                COALESCE((SELECT SUM(CASE WHEN b.status = 'won' THEN b.amount * (b.payout_multiplier - 1) ELSE -b.amount END) FROM bets b WHERE b.user_id = u.user_id), 0)
                +
                COALESCE((SELECT SUM(pt.amount) FROM platform_transactions pt WHERE pt.user_id = u.user_id AND pt.type LIKE 'bonus_%' OR pt.type LIKE 'reward%'), 0)
            )
        `;

        const fromSql = `
            FROM withdrawals w
            JOIN users u ON w.user_id = u.user_id
            LEFT JOIN admin_users a ON w.reviewer_id = a.id
        `;
        
        const countSql = `SELECT COUNT(w.id) ${fromSql} ${whereSql}`;
        const countResult = await db.query(countSql, params);
        const total = parseInt(countResult.rows[0].count, 10);

        if (total === 0) {
            return res.status(200).json({ total: 0, list: [] });
        }

        const dataSql = `
            SELECT 
                w.*, 
                u.username,
                a.username AS reviewer_name,
                ${pnlSubQuery} AS total_profit_loss
            ${fromSql}
            ${whereSql}
            ORDER BY w.request_time DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;
        
        const offset = (page - 1) * limit;
        params.push(limit);
        params.push(offset);
        const dataResult = await db.query(dataSql, params);

        res.status(200).json({ total: total, list: dataResult.rows });

    } catch (error) {
        console.error('[Admin Withdrawals] Error fetching list:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description (新) 拒绝提款 (退款)
 * @route POST /api/admin/withdrawals/:id/reject
 */
router.post('/withdrawals/:id/reject', authMiddleware, checkPermission('withdrawals', 'update'), async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const reviewerId = req.user.id;

    if (!reason) {
        return res.status(400).json({ error: '拒绝理由为必填' });
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // 1. 查找并锁定提款单
        const wdResult = await client.query("SELECT * FROM withdrawals WHERE id = $1 AND status = 'pending' FOR UPDATE", [id]);
        if (wdResult.rows.length === 0) {
            throw new Error('提款单不存在或狀态已变更');
        }
        const withdrawal = wdResult.rows[0];

        // 2. 更新提款单狀态
        await client.query(
            "UPDATE withdrawals SET status = 'rejected', rejection_reason = $1, reviewer_id = $2, review_time = NOW() WHERE id = $3",
            [reason, reviewerId, id]
        );

        // 3. 退款给用户
        const userResult = await client.query(
            "UPDATE users SET balance = balance + $1 WHERE user_id = $2 RETURNING *",
            [withdrawal.amount, withdrawal.user_id]
        );
        
        // 4. 更新对应的 platform_transaction
        await client.query(
            "UPDATE platform_transactions SET status = 'cancelled' WHERE user_id = $1 AND type = 'withdraw_request' AND amount = $2 AND status = 'pending'",
            [withdrawal.user_id, -Math.abs(withdrawal.amount)]
        );

        await client.query('COMMIT');
        
        // 5. 记录稽核日志
        await recordAuditLog({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'reject_withdrawal',
            resource: 'withdrawals',
            resourceId: id.toString(),
            description: `拒絕提款 (提款單ID: ${id}, 用戶ID: ${withdrawal.user_id}, 金額: ${withdrawal.amount} USDT, 理由: ${reason})`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        
        // 6. 通知用户 (如果在线)
        const updatedUser = userResult.rows[0];
        delete updatedUser.password_hash;
        if (connectedUsers && io) {
            const socketId = connectedUsers[updatedUser.user_id];
            if (socketId) {
                io.to(socketId).emit('user_info_updated', updatedUser);
                // (您也可以发送一個自定义的 'withdrawal_rejected' 事件)
            }
        }

        res.status(200).json({ message: '提款已拒绝并退款' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`[Admin Withdrawals] Error rejecting withdrawal ${id}:`, error);
        res.status(400).json({ error: error.message || '操作失败' });
    } finally {
        client.release();
    }
});

/**
 * @description (新) 批准提款 (标记为处理中，等待手动出款)
 * @route POST /api/admin/withdrawals/:id/approve
 */
router.post('/withdrawals/:id/approve', authMiddleware, checkPermission('withdrawals', 'update'), async (req, res) => {
    const { id } = req.params;
    const reviewerId = req.user.id;

    try {
        const result = await db.query(
            "UPDATE withdrawals SET status = 'processing', reviewer_id = $1, review_time = NOW() WHERE id = $2 AND status = 'pending' RETURNING *",
            [reviewerId, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: '提款单不存在或狀态已变更' });
        }
        
        // 更新 platform_transaction
        await db.query(
             "UPDATE platform_transactions SET status = 'processing' WHERE user_id = $1 AND type = 'withdraw_request' AND amount = $2 AND status = 'pending'",
            [result.rows[0].user_id, -Math.abs(result.rows[0].amount)]
        );

        await recordAuditLog({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'approve_withdrawal',
            resource: 'withdrawals',
            resourceId: id.toString(),
            description: `批准提款 (提款單ID: ${id}, 用戶ID: ${result.rows[0].user_id}, 金額: ${result.rows[0].amount} USDT)`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(200).json({ message: '提款已批准，狀态变更为 [处理中]，请手动出款' });

    } catch (error) {
        console.error(`[Admin Withdrawals] Error approving withdrawal ${id}:`, error);
        res.status(500).json({ error: '操作失败' });
    }
});

/**
 * @description (新) 手动完成提款 (标记为完成，记录 TX Hash 和 Gas Fee)
 * @route POST /api/admin/withdrawals/:id/complete
 */
router.post('/withdrawals/:id/complete', authMiddleware, checkPermission('withdrawals', 'update'), async (req, res) => {
    const { id } = req.params;
    const { tx_hash, gas_fee } = req.body;
    const reviewerId = req.user.id;

    if (!tx_hash || !tx_hash.trim()) {
        return res.status(400).json({ error: 'TX Hash 为必填' });
    }

    const gasFeeValue = gas_fee !== undefined && gas_fee !== null ? parseFloat(gas_fee) : 0;
    if (isNaN(gasFeeValue) || gasFeeValue < 0) {
        return res.status(400).json({ error: 'Gas Fee 必须为有效的数字且大于等于 0' });
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // 1. 查找并锁定提款单 (狀态必须为 processing)
        const wdResult = await client.query(
            "SELECT * FROM withdrawals WHERE id = $1 AND status = 'processing' FOR UPDATE",
            [id]
        );
        
        if (wdResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: '提款单不存在或狀态不是 [处理中]' });
        }
        
        const withdrawal = wdResult.rows[0];

        // 2. 更新提款单狀态为 completed
        await client.query(
            `UPDATE withdrawals 
             SET status = 'completed', 
                 tx_hash = $1, 
                 gas_fee = $2, 
                 review_time = NOW() 
             WHERE id = $3`,
            [tx_hash.trim(), gasFeeValue, id]
        );

        // 3. 更新 platform_transactions 表的狀态为 completed
        await client.query(
            `UPDATE platform_transactions 
             SET status = 'completed', 
                 updated_at = NOW() 
             WHERE user_id = $1 
               AND type = 'withdraw_request' 
               AND amount = $2 
               AND status = 'processing'`,
            [withdrawal.user_id, -Math.abs(withdrawal.amount)]
        );

        await client.query('COMMIT');

        await recordAuditLog({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'complete_withdrawal',
            resource: 'withdrawals',
            resourceId: id.toString(),
            description: `完成提款 (提款單ID: ${id}, 用戶ID: ${withdrawal.user_id}, 金額: ${withdrawal.amount} USDT, TX Hash: ${tx_hash.trim()}, Gas Fee: ${gasFeeValue} USDT)`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(200).json({ message: '提款已标记为完成' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`[Admin Withdrawals] Error completing withdrawal ${id}:`, error);
        res.status(500).json({ error: error.message || '操作失败' });
    } finally {
        client.release();
    }
});

// ★★★ 归集管理 - 获取归集设定 ★★★
/**
 * @description 获取归集设定
 * @route GET /api/admin/collection/settings
 */
router.get('/collection/settings', authMiddleware, checkPermission('wallets', 'read'), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT cs.*, pw.name as wallet_name 
             FROM collection_settings cs
             JOIN platform_wallets pw ON cs.collection_wallet_address = pw.address
             WHERE pw.is_collection = true AND pw.is_active = true`
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('[Admin Collection] Error fetching settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 更新或創建归集设定
 * @route POST /api/admin/collection/settings
 */
router.post('/collection/settings', authMiddleware, checkPermission('wallets', 'cud'), async (req, res) => {
    const { collection_wallet_address, scan_interval_days, days_without_deposit, is_active } = req.body;
    
    if (!collection_wallet_address || !scan_interval_days || !days_without_deposit) {
        return res.status(400).json({ error: '所有栏位均为必填' });
    }
    
    if (scan_interval_days < 1 || days_without_deposit < 1) {
        return res.status(400).json({ error: '天数必须大于 0' });
    }
    
    try {
        const result = await db.query(
            `INSERT INTO collection_settings 
             (collection_wallet_address, scan_interval_days, days_without_deposit, is_active, updated_at) 
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (collection_wallet_address) 
             DO UPDATE SET 
                 scan_interval_days = $2, 
                 days_without_deposit = $3, 
                 is_active = $4, 
                 updated_at = NOW()
             RETURNING *`,
            [collection_wallet_address, scan_interval_days, days_without_deposit, !!is_active]
        );
        
        console.log(`[Admin Collection] Settings updated for wallet ${collection_wallet_address} by ${req.user.username}`);
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('[Admin Collection] Error updating settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ★★★ 归集管理 - 获取归集记录 ★★★
/**
 * @description 获取归集记录列表
 * @route GET /api/admin/collection/logs
 */
router.get('/collection/logs', authMiddleware, checkPermission('reports', 'read'), async (req, res) => {
    const { 
        page = 1, limit = 10,
        userId, 
        user_deposit_address,
        collection_wallet_address,
        dateRange,
        status
    } = req.query;
    
    try {
        const params = [];
        let whereClauses = [];
        let paramIndex = 1;
        
        if (userId) { 
            params.push(`%${userId}%`); 
            whereClauses.push(`cl.user_id ILIKE $${paramIndex++}`); 
        }
        if (user_deposit_address) { 
            params.push(user_deposit_address); 
            whereClauses.push(`cl.user_deposit_address = $${paramIndex++}`); 
        }
        if (collection_wallet_address) { 
            params.push(collection_wallet_address); 
            whereClauses.push(`cl.collection_wallet_address = $${paramIndex++}`); 
        }
        if (status) { 
            params.push(status); 
            whereClauses.push(`cl.status = $${paramIndex++}`); 
        }
        if (dateRange) { 
            try {
                const [startDate, endDate] = JSON.parse(dateRange);
                params.push(startDate); 
                whereClauses.push(`cl.created_at >= $${paramIndex++}`);
                params.push(endDate); 
                whereClauses.push(`cl.created_at <= $${paramIndex++}`);
            } catch (e) {}
        }
        
        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        
        // 获取总数
        const countSql = `SELECT COUNT(cl.id) FROM collection_logs cl ${whereSql}`;
        const countResult = await db.query(countSql, params);
        const total = parseInt(countResult.rows[0].count, 10);
        
        if (total === 0) {
            return res.status(200).json({ total: 0, list: [], totalAmount: 0 });
        }
        
        // 获取总金额
        const totalAmountSql = `SELECT COALESCE(SUM(cl.amount), 0) as total_amount FROM collection_logs cl ${whereSql}`;
        const totalAmountResult = await db.query(totalAmountSql, params);
        const totalAmount = parseFloat(totalAmountResult.rows[0].total_amount || 0);
        
        // 获取列表
        const dataSql = `
            SELECT 
                cl.id, cl.user_id, cl.user_deposit_address, 
                cl.collection_wallet_address, cl.amount, cl.tx_hash, 
                cl.energy_used, cl.status, cl.error_message, cl.created_at,
                u.username
            FROM collection_logs cl
            LEFT JOIN users u ON cl.user_id = u.user_id
            ${whereSql}
            ORDER BY cl.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;
        
        const offset = (page - 1) * limit;
        params.push(limit);
        params.push(offset);
        const dataResult = await db.query(dataSql, params);
        const list = dataResult.rows.map(row => ({
            ...row,
            user_deposit_address_masked: maskAddress(row.user_deposit_address || ''),
            collection_wallet_address_masked: maskAddress(row.collection_wallet_address || ''),
            tx_hash_masked: maskTxHash(row.tx_hash || '')
        }));
        
        // 计算当前页的总金额
        const pageTotalAmount = dataResult.rows.reduce((sum, row) => sum + parseFloat(row.amount || 0), 0);
        
        res.status(200).json({ 
            total, 
            list,
            totalAmount: totalAmount,
            pageTotalAmount: pageTotalAmount
        });
    } catch (error) {
        console.error('[Admin Collection] Error fetching logs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ★★★ 後台稽核日誌 ★★★
router.get('/audit-logs', authMiddleware, checkPermission('admin_permissions', 'read'), async (req, res) => {
    const {
        page = 1,
        limit = 20,
        adminUsername,
        action,
        dateRange
    } = req.query;

    try {
        const params = [];
        let whereClauses = [];
        let paramIndex = 1;

        if (adminUsername) {
            params.push(`%${adminUsername}%`);
            whereClauses.push(`aal.admin_username ILIKE $${paramIndex++}`);
        }

        if (action) {
            params.push(`%${action}%`);
            whereClauses.push(`aal.action ILIKE $${paramIndex++}`);
        }

        if (dateRange) {
            try {
                const [startDate, endDate] = JSON.parse(dateRange);
                params.push(startDate);
                whereClauses.push(`aal.created_at >= $${paramIndex++}`);
                params.push(endDate);
                whereClauses.push(`aal.created_at <= $${paramIndex++}`);
            } catch (e) {
                console.error('[Admin Audit] Error parsing dateRange:', e);
            }
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const countSql = `SELECT COUNT(*) as count FROM admin_audit_logs aal ${whereSql}`;
        const countResult = await db.query(countSql, params);
        const total = parseInt(countResult.rows[0].count, 10);
        
        if (total === 0) {
            return res.status(200).json({ total: 0, list: [] });
        }

        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        params.push(parseInt(limit, 10));
        params.push(offset);

        const dataSql = `
            SELECT aal.*, au.username AS admin_account
            FROM admin_audit_logs aal
            LEFT JOIN admin_users au ON aal.admin_id = au.id
            ${whereSql}
            ORDER BY aal.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;
        
        const dataResult = await db.query(dataSql, params);

        res.status(200).json({
            total,
            list: dataResult.rows
        });
    } catch (error) {
        console.error('[Admin Audit] Error fetching logs:', error);
        console.error('[Admin Audit] Error stack:', error.stack);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// ★★★ 同IP风控监控 ★★★
router.get('/risk/same-ip', authMiddleware, checkPermission('users', 'update_status'), async (req, res) => {
    try {
        const summary = await riskControlService.getSameIpSummary();
        res.status(200).json(summary);
    } catch (error) {
        console.error('[RiskControl] Failed to fetch same-ip summary:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/risk/same-ip/:ip/users', authMiddleware, checkPermission('users', 'update_status'), async (req, res) => {
    try {
        const ipAddress = decodeURIComponent(req.params.ip);
        const users = await riskControlService.getUsersByIp(ipAddress);
        res.status(200).json({ ip: ipAddress, list: users });
    } catch (error) {
        console.error('[RiskControl] Failed to fetch users by IP:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/risk/same-ip/:ip/ban', authMiddleware, checkPermission('users', 'update_status'), async (req, res) => {
    try {
        const ipAddress = decodeURIComponent(req.params.ip);
        const result = await riskControlService.updateUsersStatusByIp(ipAddress, 'banned');
        res.status(200).json({ ip: ipAddress, affectedUserIds: result.affectedUserIds || [] });
    } catch (error) {
        console.error('[RiskControl] Failed to ban users by IP:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/risk/same-ip/:ip/unban', authMiddleware, checkPermission('users', 'update_status'), async (req, res) => {
    try {
        const ipAddress = decodeURIComponent(req.params.ip);
        const result = await riskControlService.updateUsersStatusByIp(ipAddress, 'active');
        res.status(200).json({ ip: ipAddress, affectedUserIds: result.affectedUserIds || [] });
    } catch (error) {
        console.error('[RiskControl] Failed to unban users by IP:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
