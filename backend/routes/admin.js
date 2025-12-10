// backend/routes/admin.js

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
const { getClientIp } = require('../utils/ipUtils');
const { logBalanceChange, CHANGE_TYPES } = require('../utils/balanceChangeLogger');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

// 用于存储 io 和 connectedUsers
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
 * @description 後台管理员登入
 * @route POST /api/admin/login
 */
router.post('/login', async (req, res) => {
    const { username, password, googleAuthCode } = req.body;
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

        // 检查帐号狀态
        if (user.status !== 'active') {
            return res.status(403).json({ error: 'Account is disabled.' });
        }

        // 验证谷歌验证码
        if (user.google_auth_secret) {
            // 如果账号已绑定谷歌验证，必须提供验证码
            if (!googleAuthCode) {
                return res.status(400).json({ 
                    error: 'Google Authenticator code is required.',
                    requiresGoogleAuth: true 
                });
            }
            
            // 验证谷歌验证码
            const verified = speakeasy.totp.verify({
                secret: user.google_auth_secret,
                encoding: 'base32',
                token: googleAuthCode,
                window: 2 // 允许前后2个时间窗口的误差
            });
            
            if (!verified) {
                return res.status(401).json({ 
                    error: 'Invalid Google Authenticator code.',
                    requiresGoogleAuth: true 
                });
            }
        }
        // 如果账号未绑定谷歌验证，googleAuthCode可以留空，不做验证

        // 記錄登錄IP
        try {
            const clientIp = getClientIp(req);
            if (clientIp) {
                await db.query(
                    'UPDATE admin_users SET last_login_ip = $1, last_login_at = NOW() WHERE id = $2',
                    [clientIp, user.id]
                );
                console.log(`[Admin Login] User ${user.username} (ID: ${user.id}) logged in from IP: ${clientIp}`);
            }
        } catch (ipError) {
            console.error('[Admin Login] Failed to record login IP:', ipError.message);
            // 不阻擋登錄，僅記錄錯誤
        }

        // 3. 签发 JWT（包含 role）
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
 * @description 获取当前用户个人资料
 * @route GET /api/admin/profile
 * @access Private (需要 Token)
 */
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await db.query(
            'SELECT id, username, nickname, google_auth_secret FROM admin_users WHERE id = $1',
            [userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = result.rows[0];
        res.status(200).json({
            id: user.id,
            username: user.username,
            nickname: user.nickname || '',
            hasGoogleAuth: !!user.google_auth_secret
        });
    } catch (error) {
        console.error('[Profile] Error fetching profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 更新当前用户个人资料（昵称和密码）
 * @route PUT /api/admin/profile
 * @access Private (需要 Token)
 */
router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { nickname, password } = req.body;
        
        // 构建更新字段
        const updates = [];
        const params = [];
        let paramIndex = 1;
        
        // 更新昵称
        if (nickname !== undefined) {
            updates.push(`nickname = $${paramIndex++}`);
            params.push(nickname || '');
        }
        
        // 更新密码（如果提供了新密码）
        if (password && password.trim() !== '') {
            const passwordHash = await bcrypt.hash(password, 10);
            updates.push(`password_hash = $${paramIndex++}`);
            params.push(passwordHash);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        // 添加WHERE条件的参数
        params.push(userId);
        
        const query = `
            UPDATE admin_users 
            SET ${updates.join(', ')} 
            WHERE id = $${paramIndex}
            RETURNING id, username, nickname
        `;
        
        const result = await db.query(query, params);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // 记录审计日志
        try {
            await recordAuditLog({
                adminId: userId,
                action: 'update',
                resource: 'admin_profile',
                resourceId: userId.toString(),
                details: { fields: updates },
                ipAddress: getClientIp(req)
            });
        } catch (auditError) {
            console.warn('[Profile] Failed to record audit log:', auditError);
        }
        
        res.status(200).json({
            message: 'Profile updated successfully',
            user: {
                id: result.rows[0].id,
                username: result.rows[0].username,
                nickname: result.rows[0].nickname || ''
            }
        });
    } catch (error) {
        console.error('[Profile] Error updating profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 获取谷歌验证设置（生成二维码）
 * @route GET /api/admin/google-auth/setup
 * @access Private (需要 Token)
 */
router.get('/google-auth/setup', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 检查是否已经绑定
        const userResult = await db.query(
            'SELECT google_auth_secret FROM admin_users WHERE id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (userResult.rows[0].google_auth_secret) {
            return res.status(400).json({ error: 'Google Authenticator is already bound' });
        }
        
        // 获取用户昵称，如果没有昵称则使用用户名
        const userInfoResult = await db.query(
            'SELECT nickname, username FROM admin_users WHERE id = $1',
            [userId]
        );
        const displayName = userInfoResult.rows[0]?.nickname || userInfoResult.rows[0]?.username || req.user.username;
        
        // 获取平台名称
        const platformNameResult = await db.query(
            "SELECT value FROM system_settings WHERE key = 'PLATFORM_NAME' LIMIT 1"
        );
        const platformName = platformNameResult.rows[0]?.value || 'FlipCoin';
        
        // 生成新的密钥
        const secret = speakeasy.generateSecret({
            name: `${platformName} Admin (${displayName})`,
            issuer: platformName
        });
        
        // 生成二维码
        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
        
        // 临时存储密钥（在绑定验证前不保存到数据库）
        // 这里我们返回secret.base32，前端在绑定时会发送回来
        res.status(200).json({
            secret: secret.base32,
            qrCode: qrCodeUrl
        });
    } catch (error) {
        console.error('[Google Auth] Error generating setup:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 绑定谷歌验证
 * @route POST /api/admin/google-auth/bind
 * @access Private (需要 Token)
 */
router.post('/google-auth/bind', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { secret, code } = req.body;
        
        if (!secret || !code) {
            return res.status(400).json({ error: 'Secret and code are required' });
        }
        
        // 验证验证码
        const verified = speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: code,
            window: 2 // 允许前后2个时间窗口的误差
        });
        
        if (!verified) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }
        
        // 保存密钥到数据库
        await db.query(
            'UPDATE admin_users SET google_auth_secret = $1 WHERE id = $2',
            [secret, userId]
        );
        
        // 记录审计日志
        try {
            await recordAuditLog({
                adminId: userId,
                action: 'create',
                resource: 'admin_google_auth',
                resourceId: userId.toString(),
                details: { action: 'bind' },
                ipAddress: getClientIp(req)
            });
        } catch (auditError) {
            console.warn('[Google Auth] Failed to record audit log:', auditError);
        }
        
        res.status(200).json({ message: 'Google Authenticator bound successfully' });
    } catch (error) {
        console.error('[Google Auth] Error binding:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 管理员解绑其他账号的谷歌验证（需要操作者的谷歌验证码）
 * @route POST /api/admin/accounts/:id/unbind-google-auth
 * @access Private (需要 Token 和权限)
 */
router.post('/accounts/:id/unbind-google-auth', authMiddleware, checkPermission('admin_accounts', 'cud'), async (req, res) => {
    try {
        const targetUserId = parseInt(req.params.id);
        const { googleAuthCode } = req.body;
        const operatorId = req.user.id; // 操作者ID
        
        if (!googleAuthCode) {
            return res.status(400).json({ error: 'Google Authenticator code is required.' });
        }
        
        // 1. 获取操作者的谷歌验证密钥（验证操作者的身份）
        const operatorResult = await db.query(
            'SELECT google_auth_secret FROM admin_users WHERE id = $1',
            [operatorId]
        );
        
        if (operatorResult.rows.length === 0) {
            return res.status(404).json({ error: 'Operator not found' });
        }
        
        const operatorSecret = operatorResult.rows[0].google_auth_secret;
        
        // 必须验证操作者的谷歌验证码
        if (!operatorSecret) {
            return res.status(400).json({ error: 'You must have Google Authenticator bound to perform this operation.' });
        }
        
        const verified = speakeasy.totp.verify({
            secret: operatorSecret,
            encoding: 'base32',
            token: googleAuthCode,
            window: 2
        });
        
        if (!verified) {
            return res.status(401).json({ error: 'Invalid Google Authenticator code.' });
        }
        
        // 2. 检查目标账号是否存在且已绑定谷歌验证
        const targetResult = await db.query(
            'SELECT id, username, google_auth_secret FROM admin_users WHERE id = $1',
            [targetUserId]
        );
        
        if (targetResult.rows.length === 0) {
            return res.status(404).json({ error: 'Target account not found' });
        }
        
        const targetUser = targetResult.rows[0];
        
        if (!targetUser.google_auth_secret) {
            return res.status(400).json({ error: 'Target account does not have Google Authenticator bound' });
        }
        
        // 3. 解绑目标账号的谷歌验证
        await db.query(
            'UPDATE admin_users SET google_auth_secret = NULL WHERE id = $1',
            [targetUserId]
        );
        
        // 4. 记录审计日志
        try {
            await recordAuditLog({
                adminId: operatorId,
                action: 'delete',
                resource: 'admin_google_auth',
                resourceId: targetUserId.toString(),
                details: { 
                    action: 'unbind_by_admin',
                    target_username: targetUser.username,
                    operator_username: req.user.username
                },
                ipAddress: getClientIp(req)
            });
        } catch (auditError) {
            console.warn('[Google Auth] Failed to record audit log:', auditError);
        }
        
        res.status(200).json({ message: 'Google Authenticator unbound successfully' });
    } catch (error) {
        console.error('[Google Auth] Error unbinding by admin:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 解绑谷歌验证（用户自己解绑）
 * @route POST /api/admin/google-auth/unbind
 * @access Private (需要 Token)
 */
router.post('/google-auth/unbind', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { code } = req.body;
        
        if (!code) {
            return res.status(400).json({ error: 'Verification code is required' });
        }
        
        // 获取用户的密钥
        const userResult = await db.query(
            'SELECT google_auth_secret FROM admin_users WHERE id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const secret = userResult.rows[0].google_auth_secret;
        
        if (!secret) {
            return res.status(400).json({ error: 'Google Authenticator is not bound' });
        }
        
        // 验证验证码
        const verified = speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: code,
            window: 2
        });
        
        if (!verified) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }
        
        // 清除密钥
        await db.query(
            'UPDATE admin_users SET google_auth_secret = NULL WHERE id = $1',
            [userId]
        );
        
        // 记录审计日志
        try {
            await recordAuditLog({
                adminId: userId,
                action: 'delete',
                resource: 'admin_google_auth',
                resourceId: userId.toString(),
                details: { action: 'unbind' },
                ipAddress: getClientIp(req)
            });
        } catch (auditError) {
            console.warn('[Google Auth] Failed to record audit log:', auditError);
        }
        
        res.status(200).json({ message: 'Google Authenticator unbound successfully' });
    } catch (error) {
        console.error('[Google Auth] Error unbinding:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 获取核心统计数据 (范例)
 * @route GET /api/admin/stats
 * @access Private (需要 Token)
 */
router.get('/stats', authMiddleware, checkPermission('dashboard', 'read'), async (req, res) => {
    try {
        const userCountResult = await db.query('SELECT COUNT(*) FROM users');
        const totalUsers = userCountResult.rows[0].count;

        const betCountResult = await db.query('SELECT COUNT(*) FROM bets');
        const totalBets = betCountResult.rows[0].count;

        // 不再有 prize_pending
        const pendingWithdrawalsResult = await db.query("SELECT COUNT(*) FROM platform_transactions WHERE type = 'withdraw' AND status = 'pending'");
        const pendingPayouts = pendingWithdrawalsResult.rows[0].count;

        // 即时线上人数
        const onlineUsers = connectedUsers ? Object.keys(connectedUsers).length : 0;

        // 当日/当周/当月/上月投注量和盈亏统计 + 時間序列數據
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // 本周一
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        // 輔助函數：生成當日24小時的時間點數組
        const generateTodayHours = () => {
            const hours = [];
            for (let i = 0; i < 24; i++) {
                hours.push(`${i.toString().padStart(2, '0')}:00`);
            }
            return hours;
        };

        // 輔助函數：生成當週每2小時的時間點數組（從週一開始到現在）
        const generateWeekHours = () => {
            const hours = [];
            const daysSinceMonday = now.getDay() === 0 ? 6 : now.getDay() - 1;
            const currentHour = now.getHours();
            for (let day = 0; day <= daysSinceMonday; day++) {
                const maxHour = (day === daysSinceMonday) ? currentHour : 23;
                for (let h = 0; h <= maxHour; h += 2) {
                    const dayName = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'][day];
                    hours.push(`${dayName} ${h.toString().padStart(2, '0')}:00`);
                }
            }
            return hours;
        };

        // 輔助函數：生成當月每日的日期數組
        const generateMonthDays = (startDate, endDate) => {
            const days = [];
            const current = new Date(startDate);
            while (current <= endDate) {
                const month = current.getMonth() + 1;
                const day = current.getDate();
                days.push(`${month}/${day}`);
                current.setDate(current.getDate() + 1);
            }
            return days;
        };

        // 當日統計 + 時間序列（按小時）
        const todayHours = generateTodayHours();
        const todayTimeSeries = await db.query(`
            SELECT 
                EXTRACT(HOUR FROM bet_time)::int as hour,
                COUNT(*) as bet_count,
                COALESCE(SUM(amount), 0) as total_bet_amount,
                COALESCE(SUM(CASE WHEN status = 'won' THEN amount * payout_multiplier ELSE 0 END), 0) as total_payout,
                COALESCE(SUM(amount), 0) - COALESCE(SUM(CASE WHEN status = 'won' THEN amount * payout_multiplier ELSE 0 END), 0) as profit_loss
            FROM bets 
            WHERE bet_time >= $1
            GROUP BY EXTRACT(HOUR FROM bet_time)
            ORDER BY hour
        `, [todayStart]);
        const todayStatsMap = {};
        todayTimeSeries.rows.forEach(row => {
            todayStatsMap[parseInt(row.hour)] = {
                betCount: parseInt(row.bet_count),
                totalBetAmount: parseFloat(row.total_bet_amount),
                totalPayout: parseFloat(row.total_payout),
                profitLoss: parseFloat(row.profit_loss)
            };
        });
        const todayStatsData = {
            betCount: todayTimeSeries.rows.reduce((sum, row) => sum + parseInt(row.bet_count || 0), 0),
            totalBetAmount: todayTimeSeries.rows.reduce((sum, row) => sum + parseFloat(row.total_bet_amount || 0), 0),
            totalPayout: todayTimeSeries.rows.reduce((sum, row) => sum + parseFloat(row.total_payout || 0), 0),
            profitLoss: 0,
            timeSeries: {
                labels: todayHours,
                betAmount: todayHours.map((_, idx) => todayStatsMap[idx]?.totalBetAmount || 0),
                payout: todayHours.map((_, idx) => todayStatsMap[idx]?.totalPayout || 0),
                profitLoss: todayHours.map((_, idx) => todayStatsMap[idx]?.profitLoss || 0)
            }
        };
        todayStatsData.profitLoss = todayStatsData.totalBetAmount - todayStatsData.totalPayout;

        // 當週統計 + 時間序列（每2小時）
        const weekHours = generateWeekHours();
        const weekTimeSeries = await db.query(`
            SELECT 
                DATE_TRUNC('hour', bet_time) as time_slot,
                COUNT(*) as bet_count,
                COALESCE(SUM(amount), 0) as total_bet_amount,
                COALESCE(SUM(CASE WHEN status = 'won' THEN amount * payout_multiplier ELSE 0 END), 0) as total_payout,
                COALESCE(SUM(amount), 0) - COALESCE(SUM(CASE WHEN status = 'won' THEN amount * payout_multiplier ELSE 0 END), 0) as profit_loss
            FROM bets 
            WHERE bet_time >= $1
            GROUP BY DATE_TRUNC('hour', bet_time)
            ORDER BY time_slot
        `, [weekStart]);
        
        // 將每小時數據按每2小時分組
        const weekStatsMap = {};
        weekTimeSeries.rows.forEach(row => {
            const betTime = new Date(row.time_slot);
            const dayOfWeek = betTime.getDay() === 0 ? 6 : betTime.getDay() - 1;
            const hour = betTime.getHours();
            const hourSlot = Math.floor(hour / 2) * 2; // 向下取整到最近的2小時倍數
            const dayName = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'][dayOfWeek];
            const key = `${dayName} ${hourSlot.toString().padStart(2, '0')}:00`;
            
            if (!weekStatsMap[key]) {
                weekStatsMap[key] = {
                    betCount: 0,
                    totalBetAmount: 0,
                    totalPayout: 0,
                    profitLoss: 0
                };
            }
            weekStatsMap[key].betCount += parseInt(row.bet_count || 0);
            weekStatsMap[key].totalBetAmount += parseFloat(row.total_bet_amount || 0);
            weekStatsMap[key].totalPayout += parseFloat(row.total_payout || 0);
            weekStatsMap[key].profitLoss += parseFloat(row.profit_loss || 0);
        });
        
        const weekStatsData = {
            betCount: weekTimeSeries.rows.reduce((sum, row) => sum + parseInt(row.bet_count || 0), 0),
            totalBetAmount: weekTimeSeries.rows.reduce((sum, row) => sum + parseFloat(row.total_bet_amount || 0), 0),
            totalPayout: weekTimeSeries.rows.reduce((sum, row) => sum + parseFloat(row.total_payout || 0), 0),
            profitLoss: 0,
            timeSeries: {
                labels: weekHours,
                betAmount: weekHours.map(label => weekStatsMap[label]?.totalBetAmount || 0),
                payout: weekHours.map(label => weekStatsMap[label]?.totalPayout || 0),
                profitLoss: weekHours.map(label => weekStatsMap[label]?.profitLoss || 0)
            }
        };
        weekStatsData.profitLoss = weekStatsData.totalBetAmount - weekStatsData.totalPayout;

        // 當月統計 + 時間序列（按日）
        const monthDays = generateMonthDays(monthStart, now);
        const monthTimeSeries = await db.query(`
            SELECT 
                DATE(bet_time) as date,
                COUNT(*) as bet_count,
                COALESCE(SUM(amount), 0) as total_bet_amount,
                COALESCE(SUM(CASE WHEN status = 'won' THEN amount * payout_multiplier ELSE 0 END), 0) as total_payout,
                COALESCE(SUM(amount), 0) - COALESCE(SUM(CASE WHEN status = 'won' THEN amount * payout_multiplier ELSE 0 END), 0) as profit_loss
            FROM bets 
            WHERE bet_time >= $1
            GROUP BY DATE(bet_time)
            ORDER BY date
        `, [monthStart]);
        const monthStatsMap = {};
        monthTimeSeries.rows.forEach(row => {
            const date = new Date(row.date);
            const key = `${date.getMonth() + 1}/${date.getDate()}`;
            monthStatsMap[key] = {
                betCount: parseInt(row.bet_count),
                totalBetAmount: parseFloat(row.total_bet_amount),
                totalPayout: parseFloat(row.total_payout),
                profitLoss: parseFloat(row.profit_loss)
            };
        });
        const monthStatsData = {
            betCount: monthTimeSeries.rows.reduce((sum, row) => sum + parseInt(row.bet_count || 0), 0),
            totalBetAmount: monthTimeSeries.rows.reduce((sum, row) => sum + parseFloat(row.total_bet_amount || 0), 0),
            totalPayout: monthTimeSeries.rows.reduce((sum, row) => sum + parseFloat(row.total_payout || 0), 0),
            profitLoss: 0,
            timeSeries: {
                labels: monthDays,
                betAmount: monthDays.map(day => monthStatsMap[day]?.totalBetAmount || 0),
                payout: monthDays.map(day => monthStatsMap[day]?.totalPayout || 0),
                profitLoss: monthDays.map(day => monthStatsMap[day]?.profitLoss || 0)
            }
        };
        monthStatsData.profitLoss = monthStatsData.totalBetAmount - monthStatsData.totalPayout;

        // 上月統計 + 時間序列（按日）
        const lastMonthDays = generateMonthDays(lastMonthStart, lastMonthEnd);
        const lastMonthTimeSeries = await db.query(`
            SELECT 
                DATE(bet_time) as date,
                COUNT(*) as bet_count,
                COALESCE(SUM(amount), 0) as total_bet_amount,
                COALESCE(SUM(CASE WHEN status = 'won' THEN amount * payout_multiplier ELSE 0 END), 0) as total_payout,
                COALESCE(SUM(amount), 0) - COALESCE(SUM(CASE WHEN status = 'won' THEN amount * payout_multiplier ELSE 0 END), 0) as profit_loss
            FROM bets 
            WHERE bet_time >= $1 AND bet_time <= $2
            GROUP BY DATE(bet_time)
            ORDER BY date
        `, [lastMonthStart, lastMonthEnd]);
        const lastMonthStatsMap = {};
        lastMonthTimeSeries.rows.forEach(row => {
            const date = new Date(row.date);
            const key = `${date.getMonth() + 1}/${date.getDate()}`;
            lastMonthStatsMap[key] = {
                betCount: parseInt(row.bet_count),
                totalBetAmount: parseFloat(row.total_bet_amount),
                totalPayout: parseFloat(row.total_payout),
                profitLoss: parseFloat(row.profit_loss)
            };
        });
        const lastMonthStatsData = {
            betCount: lastMonthTimeSeries.rows.reduce((sum, row) => sum + parseInt(row.bet_count || 0), 0),
            totalBetAmount: lastMonthTimeSeries.rows.reduce((sum, row) => sum + parseFloat(row.total_bet_amount || 0), 0),
            totalPayout: lastMonthTimeSeries.rows.reduce((sum, row) => sum + parseFloat(row.total_payout || 0), 0),
            profitLoss: 0,
            timeSeries: {
                labels: lastMonthDays,
                betAmount: lastMonthDays.map(day => lastMonthStatsMap[day]?.totalBetAmount || 0),
                payout: lastMonthDays.map(day => lastMonthStatsMap[day]?.totalPayout || 0),
                profitLoss: lastMonthDays.map(day => lastMonthStatsMap[day]?.profitLoss || 0)
            }
        };
        lastMonthStatsData.profitLoss = lastMonthStatsData.totalBetAmount - lastMonthStatsData.totalPayout;

        res.status(200).json({
            totalUsers: parseInt(totalUsers),
            totalBets: parseInt(totalBets),
            pendingPayouts: parseInt(pendingPayouts),
            onlineUsers: onlineUsers,
            today: todayStatsData,
            week: weekStatsData,
            month: monthStatsData,
            lastMonth: lastMonthStatsData
        });
    } catch (error) {
        console.error('[Admin Stats] Error fetching stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- 用户管理  ---
/**
 * @description 获取用户列表
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
        console.error('[Admin Users] Error fetching users:', error);
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
        // 如果调整余额，先获取旧余额用于记录账变
        let oldBalance = null;
        if (balance !== undefined) {
            const userResult = await db.query('SELECT balance, user_id FROM users WHERE id = $1', [id]);
            if (userResult.rows.length === 0) {
                return res.status(404).json({ error: 'User not found.' });
            }
            oldBalance = parseFloat(userResult.rows[0].balance || 0);
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
        res.status(200).json(result.rows[0]);

    } catch (error) {
        console.error('[Admin Users] Error updating user (v6):', error);
        res.status(500).json({ error: 'Internal server error' });
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
        
        res.status(200).json(result.rows);

    } catch (error) {
        console.error(`[Admin Users] Error fetching referrals for code ${invite_code}:`, error);
        res.status(500).json({ error: 'Internal server error' });
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
            ipAddress: getClientIp(req),
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
                b.bet_ip, b.bet_time, b.settle_time, 
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
        
        // 查询 platform_wallets
        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const countSql = `SELECT COUNT(*) FROM platform_wallets ${whereSql}`;
        const countResult = await db.query(countSql, params);
        const total = parseInt(countResult.rows[0].count, 10);

        if (total === 0) {
            return res.status(200).json({ total: 0, list: [] });
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
        
        res.status(200).json({ total, list });

    } catch (error) {
        console.error('[Admin Wallets] Error fetching wallets:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 新增平台钱包 
 */
router.post('/wallets', authMiddleware, checkPermission('wallets', 'cud'), async (req, res) => {
    // 获取新栏位
    const { name, chain_type, address, is_gas_reserve, is_collection, is_opener_a, is_opener_b, is_active, is_payout } = req.body;
    if (!name || !chain_type || !address) {
        return res.status(400).json({ error: 'Name, chain_type, and address are required.' });
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
    // 获取新栏位
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
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent']
        });

        res.status(200).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { return res.status(409).json({ error: 'Wallet address already exists.' }); }
        console.error(`[Admin Wallets] Error updating wallet ${id}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 刪除 platform_wallets
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
            ipAddress: getClientIp(req),
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
    // (验证) - 注意：PAYOUT_MULTIPLIER 已遷移到遊戲管理，此驗證保留以防直接調用 API
    if (key === 'PAYOUT_MULTIPLIER') {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue <= 0) { return res.status(400).json({ error: 'PAYOUT_MULTIPLIER must be a positive number.' }); }
    }
    // 验证 AUTO_WITHDRAW_THRESHOLD
    if (key === 'AUTO_WITHDRAW_THRESHOLD') {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < 0) { return res.status(400).json({ error: 'AUTO_WITHDRAW_THRESHOLD 必须是有效的数字 (例如 10)' }); }
        validatedValue = numValue.toString();
    }
    // 验证链开关
    if (key.startsWith('ALLOW_')) {
        if (value.toString() !== 'true' && value.toString() !== 'false') {
            return res.status(400).json({ error: 'Value must be true or false string.' });
        }
        validatedValue = value.toString();
    }
    // 验证平台名称
    if (key === 'PLATFORM_NAME') {
        const name = value.toString().trim();
        if (!name || name.length === 0) {
            return res.status(400).json({ error: '平台名称不能为空' });
        }
        if (name.length > 50) {
            return res.status(400).json({ error: '平台名称不能超过50个字符' });
        }
        validatedValue = name;
    }
    // 验证多语系设置
    if (key === 'DEFAULT_LANGUAGE') {
        const lang = value.toString().trim();
        if (lang !== 'zh-CN' && lang !== 'en-US') {
            return res.status(400).json({ error: '默认语言必须是 zh-CN 或 en-US' });
        }
        validatedValue = lang;
    }
    if (key === 'SUPPORTED_LANGUAGES') {
        // 验证是否为有效的 JSON 数组
        try {
            const langs = JSON.parse(value.toString());
            if (!Array.isArray(langs)) {
                return res.status(400).json({ error: '支持的语言必须是数组格式' });
            }
            // 验证数组中的语言代码
            const validLangs = ['zh-CN', 'en-US'];
            for (const lang of langs) {
                if (!validLangs.includes(lang)) {
                    return res.status(400).json({ error: `不支持的语言代码: ${lang}` });
                }
            }
            validatedValue = value.toString(); // 保持 JSON 字符串格式
        } catch (e) {
            return res.status(400).json({ error: '支持的语言必须是有效的 JSON 数组格式' });
        }
    }

    try {
        // 先尝试更新
        let result = await db.query(
            'UPDATE system_settings SET value = $1, updated_at = NOW() WHERE key = $2 RETURNING key, value',
            [validatedValue, key]
        );
        
        // 如果设置不存在，尝试创建（仅对 I18n 分类的设置）
        if (result.rows.length === 0) {
            // 检查是否为 I18n 分类的设置
            if (key === 'DEFAULT_LANGUAGE' || key === 'SUPPORTED_LANGUAGES') {
                const description = key === 'DEFAULT_LANGUAGE' 
                    ? '系统默认语言，可选值：zh-CN（简体中文）或 en-US（英文）'
                    : '系统支持的语言列表，JSON 数组格式，可选值：zh-CN（简体中文）、en-US（英文）';
                
                result = await db.query(
                    `INSERT INTO system_settings (key, value, description, category, created_at, updated_at)
                     VALUES ($1, $2, $3, 'I18n', NOW(), NOW())
                     RETURNING key, value`,
                    [key, validatedValue, description]
                );
                console.log(`[Admin Settings] Created new I18n setting '${key}' with value '${validatedValue}'`);
            } else {
                return res.status(404).json({ error: `Setting key '${key}' not found.` });
            }
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
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent']
        });

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(`[Admin Settings] Error updating setting '${key}':`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ★★★ 系统设定 - 多语系 (i18n) API ★★★
/**
 * @description 获取指定语言的翻译文件
 * @route GET /api/admin/i18n/:lang
 * @access Private
 */
router.get('/i18n/:lang', authMiddleware, checkPermission('settings_game', 'read'), async (req, res) => {
    try {
        const { lang } = req.params
        const validLangs = ['en', 'zh-CN', 'zh-TW']
        
        if (!validLangs.includes(lang)) {
            return res.status(400).json({ error: `Invalid language code. Supported: ${validLangs.join(', ')}` })
        }
        
        // 读取前台语言文件
        const fs = require('fs')
        const path = require('path')
        // 在 Docker 容器中，frontend-vue3/src/locales 被挂载到 /usr/src/app/frontend-vue3/src/locales
        // __dirname 是 /usr/src/app/routes，所以路径是 ../frontend-vue3/src/locales
        const localeFile = path.join(__dirname, '../frontend-vue3/src/locales', `${lang}.json`)
        
        console.log(`[Admin I18n] Loading language file: ${localeFile}`)
        console.log(`[Admin I18n] File exists: ${fs.existsSync(localeFile)}`)
        
        if (!fs.existsSync(localeFile)) {
            // 如果文件不存在，返回空对象
            console.log(`[Admin I18n] File not found: ${localeFile}`)
            return res.status(200).json({})
        }
        
        const content = fs.readFileSync(localeFile, 'utf-8')
        const translations = JSON.parse(content)
        
        console.log(`[Admin I18n] Loaded ${Object.keys(translations).length} top-level keys for ${lang}`)
        
        res.status(200).json(translations)
    } catch (error) {
        console.error('[Admin I18n] Error fetching language file:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

/**
 * @description 更新指定语言的翻译文件
 * @route POST /api/admin/i18n/:lang
 * @access Private
 */
router.post('/i18n/:lang', authMiddleware, checkPermission('settings_game', 'update'), async (req, res) => {
    try {
        const { lang } = req.params
        const { data } = req.body
        const validLangs = ['en', 'zh-CN', 'zh-TW']
        
        if (!validLangs.includes(lang)) {
            return res.status(400).json({ error: `Invalid language code. Supported: ${validLangs.join(', ')}` })
        }
        
        if (!data || typeof data !== 'object') {
            return res.status(400).json({ error: 'Invalid data format. Expected JSON object.' })
        }
        
        // 写入前台语言文件
        const fs = require('fs')
        const path = require('path')
        // 在 Docker 容器中，frontend-vue3/src/locales 被挂载到 /usr/src/app/frontend-vue3/src/locales
        // __dirname 是 /usr/src/app/routes，所以路径是 ../frontend-vue3/src/locales
        const localeDir = path.join(__dirname, '../frontend-vue3/src/locales')
        const localeFile = path.join(localeDir, `${lang}.json`)
        
        console.log(`[Admin I18n] Saving language file: ${localeFile}`)
        
        // 确保目录存在
        if (!fs.existsSync(localeDir)) {
            fs.mkdirSync(localeDir, { recursive: true })
        }
        
        // 排序并写入文件
        const sortedData = sortObject(data)
        fs.writeFileSync(
            localeFile,
            JSON.stringify(sortedData, null, 2) + '\n',
            'utf-8'
        )
        
        console.log(`[Admin I18n] Language file '${lang}.json' updated by ${req.user.username}`)
        
        await recordAuditLog({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'update_i18n',
            resource: 'i18n',
            resourceId: lang,
            description: `更新多语系文件 ${lang}.json`,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent']
        })
        
        res.status(200).json({ success: true, message: 'Language file updated successfully' })
    } catch (error) {
        console.error(`[Admin I18n] Error updating language file '${req.params.lang}':`, error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

/**
 * 递归排序对象
 */
function sortObject(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
        return obj
    }
    
    const sorted = {}
    const keys = Object.keys(obj).sort()
    
    for (const key of keys) {
        sorted[key] = sortObject(obj[key])
    }
    
    return sorted
}

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
        // (★★★ Y-6: JOIN admin_roles 获取角色名称，添加谷歌验证状态 ★★★)
        const result = await db.query(`
            SELECT u.id, u.username, u.status, u.created_at, u.role_id, r.name as role_name,
                   CASE WHEN u.google_auth_secret IS NOT NULL THEN true ELSE false END as has_google_auth
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
            ipAddress: getClientIp(req),
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
            ipAddress: getClientIp(req),
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
            ipAddress: getClientIp(req),
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
            ipAddress: getClientIp(req),
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
            ipAddress: getClientIp(req),
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
            ipAddress: getClientIp(req),
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
            ipAddress: getClientIp(req),
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
            ipAddress: getClientIp(req),
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
    const { page = 1, limit = 10, username, tx_hash, status, user_id, start_time, end_time, user_address, platform_address } = req.query;
    
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
        if (user_address) { 
            params.push(user_address); 
            whereClauses.push(`cl.user_deposit_address = $${paramIndex++}`); 
        }
        if (platform_address) { 
            params.push(platform_address); 
            whereClauses.push(`(
                cl.collection_wallet_address = $${paramIndex} OR 
                (pt.chain = 'TRC20' AND u.tron_deposit_address = $${paramIndex}) OR
                (pt.chain != 'TRC20' AND u.evm_deposit_address = $${paramIndex})
            )`); 
            paramIndex++;
        }
        
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
            LEFT JOIN collection_logs cl ON pt.tx_hash = cl.tx_hash AND pt.user_id = cl.user_id
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
                u.user_id,
                cl.user_deposit_address AS user_address,
                COALESCE(
                    cl.collection_wallet_address,
                    CASE 
                        WHEN pt.chain = 'TRC20' THEN u.tron_deposit_address
                        ELSE u.evm_deposit_address
                    END
                ) AS platform_address
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
        const updatedUser = userResult.rows[0];
        
        // 4. 更新对应的 platform_transaction
        await client.query(
            "UPDATE platform_transactions SET status = 'cancelled' WHERE user_id = $1 AND type = 'withdraw_request' AND amount = $2 AND status = 'pending'",
            [withdrawal.user_id, -Math.abs(withdrawal.amount)]
        );

        // 4b. 记录账变（提款拒绝退款）
        try {
            const newBalance = parseFloat(updatedUser.balance);
            await logBalanceChange({
                user_id: withdrawal.user_id,
                change_type: CHANGE_TYPES.WITHDRAWAL,
                amount: withdrawal.amount,  // 正数表示退款
                balance_after: newBalance,
                remark: `提款拒绝退款 ${withdrawal.amount} USDT, 提款单ID: ${id}, 理由: ${reason}, 管理员: ${req.user.username}`,
                client: client
            });
        } catch (error) {
            console.error('[Admin Withdrawals] Failed to log balance change (reject refund):', error);
            // 不阻止主流程，只记录错误
        }

        await client.query('COMMIT');
        
        // 5. 记录稽核日志
        await recordAuditLog({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'reject_withdrawal',
            resource: 'withdrawals',
            resourceId: id.toString(),
            description: `拒絕提款 (提款單ID: ${id}, 用戶ID: ${withdrawal.user_id}, 金額: ${withdrawal.amount} USDT, 理由: ${reason})`,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent']
        });
        
        // 6. 通知用户 (如果在线)
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
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent']
        });

        res.status(200).json({ message: '提款已批准，狀态变更为 [处理中]，请手动出款' });

    } catch (error) {
        console.error(`[Admin Withdrawals] Error approving withdrawal ${id}:`, error);
        res.status(500).json({ error: '操作失败' });
    }
});

/**
 * @description 获取账变记录列表
 * @route GET /api/admin/balance-changes
 */
router.get('/balance-changes', authMiddleware, checkPermission('balance_changes', 'read'), async (req, res) => {
    const { 
        page = 1, 
        limit = 10, 
        user_id, 
        username, 
        change_type, 
        start_time, 
        end_time 
    } = req.query;
    
    try {
        const params = [];
        let whereClauses = [];
        let paramIndex = 1;

        // 时间范围处理
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

        // 查询条件
        if (user_id) {
            const parsedUserId = parseInt(user_id, 10);
            if (Number.isNaN(parsedUserId)) {
                return res.status(400).json({ error: 'user_id 必须为整数' });
            }
            params.push(user_id);
            whereClauses.push(`bc.user_id = $${paramIndex++}`);
        }

        if (username) {
            params.push(`%${username}%`);
            whereClauses.push(`u.username ILIKE $${paramIndex++}`);
        }

        if (change_type) {
            params.push(change_type);
            whereClauses.push(`bc.change_type = $${paramIndex++}`);
        }

        if (startTimeValue) {
            params.push(startTimeValue);
            whereClauses.push(`bc.created_at >= $${paramIndex++}`);
        }

        if (endTimeValue) {
            params.push(endTimeValue);
            whereClauses.push(`bc.created_at <= $${paramIndex++}`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        
        const fromSql = `
            FROM balance_changes bc
            LEFT JOIN users u ON bc.user_id = u.user_id
        `;
        
        // 获取总数
        const countSql = `SELECT COUNT(bc.id) ${fromSql} ${whereSql}`;
        const countResult = await db.query(countSql, params);
        const total = parseInt(countResult.rows[0].count, 10);

        if (total === 0) {
            return res.status(200).json({ total: 0, list: [] });
        }

        // 获取列表
        const dataSql = `
            SELECT 
                bc.id,
                bc.user_id,
                u.username,
                bc.change_type,
                bc.amount,
                bc.balance_after,
                bc.remark,
                bc.created_at
            ${fromSql}
            ${whereSql}
            ORDER BY bc.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;
        
        const offset = (page - 1) * limit;
        params.push(limit);
        params.push(offset);
        const dataResult = await db.query(dataSql, params);

        res.status(200).json({ total: total, list: dataResult.rows });

    } catch (error) {
        console.error('[Admin Balance Changes] Error fetching list:', error);
        res.status(500).json({ error: 'Internal server error' });
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
            ipAddress: getClientIp(req),
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

// ★★★ 钱包监控 - 获取各类钱包余额 ★★★
/**
 * @description 获取钱包监控数据（各类钱包余额）
 * @route GET /api/admin/wallet-monitoring
 */
router.get('/wallet-monitoring', authMiddleware, checkPermission('wallets', 'read'), async (req, res) => {
    try {
        const TronWeb = require('tronweb');
        
        const NILE_NODE_HOST = process.env.NILE_NODE_HOST;
        const USDT_CONTRACT_ADDRESS = process.env.USDT_CONTRACT_ADDRESS || 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';
        const USDT_DECIMALS = 6;
        
        const tronWeb = new TronWeb({
            fullHost: NILE_NODE_HOST,
            solidityHost: NILE_NODE_HOST,
            privateKey: '01'
        });
        tronWeb.setFullNode(NILE_NODE_HOST);
        tronWeb.setSolidityNode(NILE_NODE_HOST);
        
        const usdtContractHex = tronWeb.address.toHex(USDT_CONTRACT_ADDRESS);
        
        // 获取所有 TRC20 平台钱包
        const walletsResult = await db.query(
            "SELECT * FROM platform_wallets WHERE chain_type = 'TRC20' AND is_active = true"
        );
        
        const walletMonitoring = {
            payout: [],      // 自动出款类型
            collection: [],  // 归集类型
            gasReserve: []   // Gas储备类型
        };
        
        // 获取余额的辅助函数
        const getTrxBalance = async (address) => {
            try {
                const balance = await tronWeb.trx.getBalance(address);
                return parseFloat(tronWeb.fromSun(balance));
            } catch (error) {
                console.error(`[Wallet Monitoring] Error getting TRX balance for ${address}:`, error.message);
                return 0;
            }
        };
        
        const getUsdtBalance = async (address) => {
            try {
                const addressHex = tronWeb.address.toHex(address);
                const transaction = await tronWeb.transactionBuilder.triggerConstantContract(
                    usdtContractHex,
                    'balanceOf(address)',
                    {},
                    [{ type: 'address', value: addressHex }],
                    addressHex
                );
                
                if (!transaction || !transaction.constant_result || !transaction.constant_result[0]) {
                    return 0;
                }
                
                const balance = '0x' + transaction.constant_result[0];
                const balanceBigInt = BigInt(balance);
                return parseFloat(balanceBigInt.toString()) / Math.pow(10, USDT_DECIMALS);
            } catch (error) {
                console.error(`[Wallet Monitoring] Error getting USDT balance for ${address}:`, error.message);
                return 0;
            }
        };
        
        const getEnergy = async (address) => {
            try {
                const account = await tronWeb.trx.getAccount(address);
                return account.energy || 0;
            } catch (error) {
                console.error(`[Wallet Monitoring] Error getting energy for ${address}:`, error.message);
                return 0;
            }
        };
        
        // 处理每个钱包
        for (const wallet of walletsResult.rows) {
            const walletInfo = {
                id: wallet.id,
                name: wallet.name,
                address: wallet.address,
                trxBalance: 0,
                usdtBalance: 0,
                energy: 0
            };
            
            try {
                walletInfo.trxBalance = await getTrxBalance(wallet.address);
                walletInfo.usdtBalance = await getUsdtBalance(wallet.address);
                
                // 只有归集类型需要获取能量
                if (wallet.is_collection) {
                    walletInfo.energy = await getEnergy(wallet.address);
                }
            } catch (error) {
                console.error(`[Wallet Monitoring] Error processing wallet ${wallet.address}:`, error.message);
            }
            
            // 分类钱包
            if (wallet.is_payout) {
                walletMonitoring.payout.push(walletInfo);
            }
            if (wallet.is_collection) {
                walletMonitoring.collection.push(walletInfo);
            }
            if (wallet.is_gas_reserve) {
                walletMonitoring.gasReserve.push(walletInfo);
            }
        }
        
        res.status(200).json(walletMonitoring);
    } catch (error) {
        console.error('[Admin Wallet Monitoring] Error:', error);
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

// ★★★ 登录查询 API (v9.2 新增) ★★★
/**
 * @description 获取登录查询列表
 * @route GET /api/admin/login-query
 */
router.get('/login-query', authMiddleware, checkPermission('users', 'read'), async (req, res) => {
    try {
        const { userId, loginIp, registrationIp, betIp, dateRange, page = 1, limit = 20 } = req.query;
        
        const whereClauses = [];
        const params = [];
        let paramIndex = 1;

        if (userId) {
            params.push(`%${userId}%`);
            whereClauses.push(`u.user_id::text ILIKE $${paramIndex++}`);
        }

        if (loginIp) {
            params.push(loginIp);
            whereClauses.push(`EXISTS (SELECT 1 FROM user_login_logs WHERE user_id = u.user_id AND login_ip = $${paramIndex++})`);
        }

        if (registrationIp) {
            params.push(registrationIp);
            whereClauses.push(`u.registration_ip = $${paramIndex++}`);
        }

        if (betIp) {
            params.push(betIp);
            whereClauses.push(`EXISTS (SELECT 1 FROM bets WHERE user_id = u.user_id AND bet_ip = $${paramIndex++})`);
        }

        if (dateRange) {
            try {
                const [startDate, endDate] = JSON.parse(dateRange);
                params.push(startDate);
                whereClauses.push(`u.created_at >= $${paramIndex++}`);
                params.push(endDate);
                whereClauses.push(`u.created_at <= $${paramIndex++}`);
            } catch (e) {
                console.error('[Login Query] Error parsing dateRange:', e);
            }
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // 统计总数
        const countSql = `SELECT COUNT(*) as count FROM users u ${whereSql}`;
        const countResult = await db.query(countSql, params);
        const total = parseInt(countResult.rows[0].count, 10);
        
        if (total === 0) {
            return res.status(200).json({ total: 0, list: [] });
        }

        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        params.push(parseInt(limit, 10));
        params.push(offset);

        // 查询用户列表，包含统计信息
        const dataSql = `
            SELECT 
                u.user_id,
                u.username,
                u.first_login_country,
                u.registration_ip,
                u.first_login_ip,
                u.device_id,
                u.created_at,
                -- 统计同登录IP数量
                -- 優先從登入日誌中查詢，如果沒有登入日誌，則使用首次登入IP或註冊IP來查詢
                (
                    SELECT COUNT(DISTINCT u2.user_id) 
                    FROM user_login_logs ull
                    JOIN users u2 ON ull.user_id = u2.user_id
                    WHERE ull.login_ip IN (SELECT DISTINCT login_ip FROM user_login_logs WHERE user_id = u.user_id)
                    AND u2.user_id != u.user_id
                ) + 
                -- 如果沒有登入日誌，使用首次登入IP或註冊IP來計算
                CASE 
                    WHEN EXISTS (SELECT 1 FROM user_login_logs WHERE user_id = u.user_id) THEN 0
                    ELSE (
                        SELECT COUNT(DISTINCT u2.user_id)
                        FROM users u2
                        WHERE u2.user_id != u.user_id
                          AND (
                              (u.first_login_ip IS NOT NULL AND (
                                  u2.first_login_ip = u.first_login_ip
                                  OR EXISTS (SELECT 1 FROM user_login_logs WHERE user_id = u2.user_id AND login_ip = u.first_login_ip)
                              ))
                              OR (u.first_login_ip IS NULL AND u.registration_ip IS NOT NULL AND (
                                  u2.registration_ip = u.registration_ip
                                  OR u2.first_login_ip = u.registration_ip
                                  OR EXISTS (SELECT 1 FROM user_login_logs WHERE user_id = u2.user_id AND login_ip = u.registration_ip)
                              ))
                          )
                    )
                END as same_login_ip_count,
                -- 统计同注册IP数量
                (SELECT COUNT(*) FROM users u2 WHERE u2.registration_ip = u.registration_ip AND u2.registration_ip IS NOT NULL AND u2.user_id != u.user_id) as same_registration_ip_count,
                -- 统计同投注IP数量
                (SELECT COUNT(DISTINCT u2.user_id)
                 FROM bets b
                 JOIN users u2 ON b.user_id = u2.user_id
                 WHERE b.bet_ip IN (SELECT DISTINCT bet_ip FROM bets WHERE user_id = u.user_id AND bet_ip IS NOT NULL)
                 AND u2.user_id != u.user_id) as same_bet_ip_count,
                -- 统计同注册密码数量（使用密碼指紋來比較，因為 bcrypt hash 每次都不同）
                (SELECT COUNT(*) 
                 FROM users u2 
                 WHERE u2.password_fingerprint = u.password_fingerprint
                 AND u2.user_id != u.user_id
                 AND u.password_fingerprint IS NOT NULL) as same_registration_password_count,
                -- 统计同提现密码数量（使用資金密碼指紋來比較）
                (SELECT COUNT(*) 
                 FROM users u2 
                 WHERE u2.withdrawal_password_fingerprint = u.withdrawal_password_fingerprint
                 AND u2.user_id != u.user_id
                 AND u.withdrawal_password_fingerprint IS NOT NULL) as same_withdrawal_password_count,
                -- 统计同设备ID数量
                (SELECT COUNT(*) FROM users u2 WHERE u2.device_id = u.device_id 
                 AND u.device_id IS NOT NULL AND u2.device_id IS NOT NULL AND u2.user_id != u.user_id) as same_device_id_count
            FROM users u
            ${whereSql}
            ORDER BY u.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;
        
        const dataResult = await db.query(dataSql, params);

        res.status(200).json({
            total,
            list: dataResult.rows
        });
    } catch (error) {
        console.error('[Login Query] Error fetching login query data:', error);
        console.error('[Login Query] Error stack:', error.stack);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

/**
 * @description 获取同登录IP的用户列表
 * @route GET /api/admin/login-query/same-login-ip/:userId
 */
router.get('/login-query/same-login-ip/:userId', authMiddleware, checkPermission('users', 'read'), async (req, res) => {
    try {
        const { userId } = req.params;
        
        // 获取该用户的登录IP（優先從登入日誌，如果沒有則使用first_login_ip或last_login_ip）
        const userResult = await db.query(
            `SELECT first_login_ip, last_login_ip FROM users WHERE user_id = $1`,
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = userResult.rows[0];
        
        // 获取该用户的所有登录IP（從登入日誌）
        const userIpsResult = await db.query(
            `SELECT DISTINCT login_ip FROM user_login_logs WHERE user_id = $1 AND login_ip IS NOT NULL`,
            [userId]
        );
        
        const ipsFromLogs = userIpsResult.rows.map(r => r.login_ip);
        
        // 如果沒有登入日誌，使用first_login_ip或last_login_ip
        const ipsToSearch = [];
        if (ipsFromLogs.length > 0) {
            ipsToSearch.push(...ipsFromLogs);
        } else {
            // 使用first_login_ip或last_login_ip
            if (user.first_login_ip) {
                ipsToSearch.push(user.first_login_ip);
            }
            if (user.last_login_ip && !ipsToSearch.includes(user.last_login_ip)) {
                ipsToSearch.push(user.last_login_ip);
            }
        }
        
        if (ipsToSearch.length === 0) {
            return res.status(200).json({ list: [] });
        }
        
        // 查询使用相同IP的其他用户（從登入日誌）
        const resultFromLogs = await db.query(
            `SELECT DISTINCT 
                u.user_id,
                ull.login_ip,
                u.created_at as registration_time,
                MAX(ull.login_at) as last_login_time
            FROM user_login_logs ull
            JOIN users u ON ull.user_id = u.user_id
            WHERE ull.login_ip = ANY($1) AND u.user_id != $2
            GROUP BY u.user_id, ull.login_ip, u.created_at
            ORDER BY last_login_time DESC`,
            [ipsToSearch, userId]
        );
        
        // 如果沒有從登入日誌找到，也查詢first_login_ip或last_login_ip相同的用戶
        const resultFromUserTable = await db.query(
            `SELECT DISTINCT 
                u.user_id,
                COALESCE(u.last_login_ip, u.first_login_ip) as login_ip,
                u.created_at as registration_time,
                u.last_activity_at as last_login_time
            FROM users u
            WHERE (u.first_login_ip = ANY($1) OR u.last_login_ip = ANY($1))
              AND u.user_id != $2
              AND (u.first_login_ip IS NOT NULL OR u.last_login_ip IS NOT NULL)
            ORDER BY u.last_activity_at DESC NULLS LAST`,
            [ipsToSearch, userId]
        );
        
        // 合併結果，去重
        const allResults = [...resultFromLogs.rows];
        const existingUserIds = new Set(resultFromLogs.rows.map(r => r.user_id));
        
        resultFromUserTable.rows.forEach(row => {
            if (!existingUserIds.has(row.user_id)) {
                allResults.push(row);
                existingUserIds.add(row.user_id);
            }
        });
        
        res.status(200).json({ list: allResults });
    } catch (error) {
        console.error('[Login Query] Error fetching same login IP:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 获取同注册IP的用户列表
 * @route GET /api/admin/login-query/same-registration-ip/:userId
 */
router.get('/login-query/same-registration-ip/:userId', authMiddleware, checkPermission('users', 'read'), async (req, res) => {
    try {
        const { userId } = req.params;
        
        // 获取用户的注册IP
        const userResult = await db.query(
            `SELECT registration_ip FROM users WHERE user_id = $1`,
            [userId]
        );
        
        if (userResult.rows.length === 0 || !userResult.rows[0].registration_ip) {
            return res.status(200).json({ list: [] });
        }
        
        const registrationIp = userResult.rows[0].registration_ip;
        
        // 查询使用相同注册IP的其他用户
        const result = await db.query(
            `SELECT 
                u.user_id,
                u.registration_ip,
                u.created_at as registration_time,
                (SELECT MAX(login_at) FROM user_login_logs WHERE user_id = u.user_id) as last_login_time
            FROM users u
            WHERE u.registration_ip = $1 AND u.user_id != $2
            ORDER BY registration_time DESC`,
            [registrationIp, userId]
        );
        
        res.status(200).json({ list: result.rows });
    } catch (error) {
        console.error('[Login Query] Error fetching same registration IP:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 获取同投注IP的用户列表
 * @route GET /api/admin/login-query/same-bet-ip/:userId
 */
router.get('/login-query/same-bet-ip/:userId', authMiddleware, checkPermission('users', 'read'), async (req, res) => {
    try {
        const { userId } = req.params;
        
        // 获取该用户的所有投注IP
        const userBetIps = await db.query(
            `SELECT DISTINCT bet_ip FROM bets WHERE user_id = $1 AND bet_ip IS NOT NULL`,
            [userId]
        );
        
        if (userBetIps.rows.length === 0) {
            return res.status(200).json({ list: [] });
        }
        
        const ips = userBetIps.rows.map(r => r.bet_ip);
        
        // 查询使用相同投注IP的其他用户
        const result = await db.query(
            `SELECT DISTINCT 
                u.user_id,
                b.bet_ip,
                u.created_at as registration_time,
                (SELECT MAX(login_at) FROM user_login_logs WHERE user_id = u.user_id) as last_login_time
            FROM bets b
            JOIN users u ON b.user_id = u.user_id
            WHERE b.bet_ip = ANY($1) AND u.user_id != $2
            ORDER BY last_login_time DESC`,
            [ips, userId]
        );
        
        res.status(200).json({ list: result.rows });
    } catch (error) {
        console.error('[Login Query] Error fetching same bet IP:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 获取同注册密码的用户列表
 * @route GET /api/admin/login-query/same-registration-password/:userId
 */
router.get('/login-query/same-registration-password/:userId', authMiddleware, checkPermission('users', 'read'), async (req, res) => {
    try {
        const { userId } = req.params;
        
        // 获取用户的密碼指紋（用於比較相同密碼）
        const userResult = await db.query(
            `SELECT password_fingerprint FROM users WHERE user_id = $1`,
            [userId]
        );
        
        if (userResult.rows.length === 0 || !userResult.rows[0].password_fingerprint) {
            return res.status(200).json({ list: [] });
        }
        
        const passwordFingerprint = userResult.rows[0].password_fingerprint;
        
        // 查询使用相同註冊密碼的其他用户（使用密碼指紋來比較）
        const result = await db.query(
            `SELECT 
                u.user_id,
                CASE 
                    WHEN LENGTH(u.password_fingerprint) >= 8 
                    THEN SUBSTRING(u.password_fingerprint, 1, 4) || '****' || SUBSTRING(u.password_fingerprint, LENGTH(u.password_fingerprint) - 3)
                    ELSE '****'
                END as masked_password,
                u.created_at as registration_time,
                (SELECT MAX(login_at) FROM user_login_logs WHERE user_id = u.user_id) as last_login_time
            FROM users u
            WHERE u.password_fingerprint = $1 AND u.user_id != $2
            ORDER BY registration_time DESC`,
            [passwordFingerprint, userId]
        );
        
        res.status(200).json({ list: result.rows });
    } catch (error) {
        console.error('[Login Query] Error fetching same registration password:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 获取同提现密码的用户列表
 * @route GET /api/admin/login-query/same-withdrawal-password/:userId
 */
router.get('/login-query/same-withdrawal-password/:userId', authMiddleware, checkPermission('users', 'read'), async (req, res) => {
    try {
        const { userId } = req.params;
        
        // 获取用户的資金密碼指紋（用於比較相同密碼）
        const userResult = await db.query(
            `SELECT withdrawal_password_fingerprint FROM users WHERE user_id = $1`,
            [userId]
        );
        
        if (userResult.rows.length === 0 || !userResult.rows[0].withdrawal_password_fingerprint) {
            return res.status(200).json({ list: [] });
        }
        
        const withdrawalPasswordFingerprint = userResult.rows[0].withdrawal_password_fingerprint;
        
        // 查询使用相同資金密碼的其他用户（使用密碼指紋來比較）
        const result = await db.query(
            `SELECT 
                u.user_id,
                CASE 
                    WHEN LENGTH(u.withdrawal_password_fingerprint) >= 8 
                    THEN SUBSTRING(u.withdrawal_password_fingerprint, 1, 4) || '****' || SUBSTRING(u.withdrawal_password_fingerprint, LENGTH(u.withdrawal_password_fingerprint) - 3)
                    ELSE '****'
                END as masked_password,
                u.created_at as registration_time,
                (SELECT MAX(login_at) FROM user_login_logs WHERE user_id = u.user_id) as last_login_time
            FROM users u
            WHERE u.withdrawal_password_fingerprint = $1 AND u.user_id != $2
            ORDER BY registration_time DESC`,
            [withdrawalPasswordFingerprint, userId]
        );
        
        res.status(200).json({ list: result.rows });
    } catch (error) {
        console.error('[Login Query] Error fetching same withdrawal password:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 获取同设备ID的用户列表
 * @route GET /api/admin/login-query/same-device-id/:userId
 */
router.get('/login-query/same-device-id/:userId', authMiddleware, checkPermission('users', 'read'), async (req, res) => {
    try {
        const { userId } = req.params;
        
        // 获取用户的设备ID
        const userResult = await db.query(
            `SELECT device_id FROM users WHERE user_id = $1`,
            [userId]
        );
        
        if (userResult.rows.length === 0 || !userResult.rows[0].device_id) {
            return res.status(200).json({ list: [] });
        }
        
        const deviceId = userResult.rows[0].device_id;
        
        // 查询使用相同设备ID的其他用户
        const result = await db.query(
            `SELECT 
                u.user_id,
                u.device_id,
                u.created_at as registration_time,
                (SELECT MAX(login_at) FROM user_login_logs WHERE user_id = u.user_id) as last_login_time
            FROM users u
            WHERE u.device_id = $1 AND u.user_id != $2
            ORDER BY registration_time DESC`,
            [deviceId, userId]
        );
        
        res.status(200).json({ list: result.rows });
    } catch (error) {
        console.error('[Login Query] Error fetching same device ID:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 获取波场异常通知列表
 * @route GET /api/admin/tron-notifications
 */
router.get('/tron-notifications', authMiddleware, checkPermission('wallets', 'read'), async (req, res) => {
    try {
        const { resolved, limit = 50 } = req.query;
        
        let query = 'SELECT * FROM tron_notifications';
        const params = [];
        let paramIndex = 1;
        
        if (resolved !== undefined && resolved !== '') {
            query += ' WHERE resolved = $' + paramIndex;
            params.push(resolved === 'true');
            paramIndex++;
        }
        
        query += ' ORDER BY created_at DESC LIMIT $' + paramIndex;
        params.push(parseInt(limit, 10));
        
        const result = await db.query(query, params);
        
        res.status(200).json({ 
            success: true,
            data: result.rows 
        });
    } catch (error) {
        console.error('[Admin Tron Notifications] Error:', error);
        console.error('[Admin Tron Notifications] Error details:', error.stack);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

/**
 * @description 获取未解决的波场异常通知数量
 * @route GET /api/admin/tron-notifications/count
 */
router.get('/tron-notifications/count', authMiddleware, checkPermission('wallets', 'read'), async (req, res) => {
    try {
        const result = await db.query(
            'SELECT COUNT(*) as count FROM tron_notifications WHERE resolved = false',
            []
        );
        
        const count = result.rows && result.rows[0] ? parseInt(result.rows[0].count, 10) : 0;
        
        res.status(200).json({ 
            success: true,
            data: { count: count }
        });
    } catch (error) {
        console.error('[Admin Tron Notifications Count] Error:', error);
        console.error('[Admin Tron Notifications Count] Error details:', error.stack);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

/**
 * @description 标记异常通知为已解决
 * @route POST /api/admin/tron-notifications/:id/resolve
 */
router.post('/tron-notifications/:id/resolve', authMiddleware, checkPermission('wallets', 'cud'), async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await db.query(
            'UPDATE tron_notifications SET resolved = true, resolved_at = NOW() WHERE id = $1 RETURNING id',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: '通知不存在' });
        }
        
        res.status(200).json({ 
            success: true,
            message: '通知已标记为已解决'
        });
    } catch (error) {
        console.error('[Admin Tron Notifications Resolve] Error:', error);
        console.error('[Admin Tron Notifications Resolve] Error details:', error.stack);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

/**
 * @description 获取游戏列表
 * @route GET /api/admin/games
 */
router.get('/games', authMiddleware, checkPermission('settings_game', 'read'), async (req, res) => {
    try {
        const { provider, status, page = 1, limit = 20 } = req.query;
        
        // 构建 WHERE 条件
        let whereClause = 'WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        
        if (provider) {
            whereClause += ` AND provider = $${paramIndex}`;
            params.push(provider);
            paramIndex++;
        }
        
        if (status) {
            whereClause += ` AND status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }
        
        // 获取总数（不包含 ORDER BY）
        const countQuery = `SELECT COUNT(*) as total FROM games ${whereClause}`;
        const countResult = await db.query(countQuery, params);
        const total = parseInt(countResult.rows[0].total, 10);
        
        // 获取数据（包含 ORDER BY 和分页）
        const dataQuery = `SELECT * FROM games ${whereClause} ORDER BY sort_order ASC, id ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        const dataParams = [...params, parseInt(limit, 10), (parseInt(page, 10) - 1) * parseInt(limit, 10)];
        const result = await db.query(dataQuery, dataParams);
        
        res.status(200).json({
            success: true,
            data: {
                list: result.rows,
                total: total,
                page: parseInt(page, 10),
                limit: parseInt(limit, 10)
            }
        });
    } catch (error) {
        console.error('[Admin Games] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 获取单个游戏详情
 * @route GET /api/admin/games/:id
 */
router.get('/games/:id', authMiddleware, checkPermission('settings_game', 'read'), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('SELECT * FROM games WHERE id = $1', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: '游戏不存在' });
        }
        
        res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('[Admin Games] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 创建游戏
 * @route POST /api/admin/games
 */
router.post('/games', authMiddleware, checkPermission('settings_game', 'update'), async (req, res) => {
    try {
        const { provider, provider_params, game_code, name_zh, name_en, game_status, status, sort_order, payout_multiplier } = req.body;
        
        if (!name_zh) {
            return res.status(400).json({ error: '游戏名字（中文）不能为空' });
        }
        
        if (!payout_multiplier || isNaN(payout_multiplier) || payout_multiplier <= 0) {
            return res.status(400).json({ error: '派奖倍数必须大于0' });
        }
        
        const result = await db.query(
            `INSERT INTO games (provider, provider_params, game_code, name_zh, name_en, game_status, status, sort_order, payout_multiplier, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
             RETURNING *`,
            [
                provider || '自营',
                provider_params || null,
                game_code || null,
                name_zh,
                name_en || null,
                game_status || null,
                status || 'enabled',
                sort_order || 0,
                parseFloat(payout_multiplier)
            ]
        );
        
        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('[Admin Games] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 更新游戏
 * @route PUT /api/admin/games/:id
 */
router.put('/games/:id', authMiddleware, checkPermission('settings_game', 'update'), async (req, res) => {
    try {
        const { id } = req.params;
        const { provider, provider_params, game_code, name_zh, name_en, game_status, status, sort_order, payout_multiplier } = req.body;
        
        // 检查游戏是否存在
        const existing = await db.query('SELECT * FROM games WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: '游戏不存在' });
        }
        
        // 构建更新字段
        const updates = [];
        const params = [];
        let paramIndex = 1;
        
        if (provider !== undefined) {
            updates.push(`provider = $${paramIndex}`);
            params.push(provider);
            paramIndex++;
        }
        if (provider_params !== undefined) {
            updates.push(`provider_params = $${paramIndex}`);
            params.push(provider_params);
            paramIndex++;
        }
        if (name_zh !== undefined) {
            updates.push(`name_zh = $${paramIndex}`);
            params.push(name_zh);
            paramIndex++;
        }
        if (name_en !== undefined) {
            updates.push(`name_en = $${paramIndex}`);
            params.push(name_en);
            paramIndex++;
        }
        if (game_status !== undefined) {
            updates.push(`game_status = $${paramIndex}`);
            params.push(game_status);
            paramIndex++;
        }
        if (status !== undefined) {
            updates.push(`status = $${paramIndex}`);
            params.push(status);
            paramIndex++;
        }
        if (sort_order !== undefined) {
            updates.push(`sort_order = $${paramIndex}`);
            params.push(parseInt(sort_order, 10));
            paramIndex++;
        }
        if (payout_multiplier !== undefined) {
            // 确保是数字类型
            const multiplierValue = typeof payout_multiplier === 'string' 
                ? parseFloat(payout_multiplier) 
                : parseFloat(payout_multiplier);
            
            if (isNaN(multiplierValue) || multiplierValue <= 0) {
                return res.status(400).json({ error: '派奖倍数必须大于0' });
            }
            updates.push(`payout_multiplier = $${paramIndex}`);
            params.push(multiplierValue);
            paramIndex++;
        }
        if (req.body.streak_multipliers !== undefined) {
            // 验证 JSON 格式
            let streakMultipliers = null;
            if (req.body.streak_multipliers) {
                try {
                    if (typeof req.body.streak_multipliers === 'string') {
                        streakMultipliers = JSON.parse(req.body.streak_multipliers);
                    } else {
                        streakMultipliers = req.body.streak_multipliers;
                    }
                    // 验证格式：应该是对象，key 为数字字符串，value 为数字
                    if (typeof streakMultipliers !== 'object' || Array.isArray(streakMultipliers)) {
                        return res.status(400).json({ error: 'streak_multipliers 必须是对象格式' });
                    }
                    // 验证每个值都是正数
                    for (const [key, value] of Object.entries(streakMultipliers)) {
                        if (isNaN(parseInt(key, 10)) || isNaN(parseFloat(value)) || parseFloat(value) <= 0) {
                            return res.status(400).json({ error: `streak_multipliers 中的 ${key} 胜赔率必须大于0` });
                        }
                    }
                    streakMultipliers = JSON.stringify(streakMultipliers);
                } catch (error) {
                    return res.status(400).json({ error: 'streak_multipliers JSON 格式错误' });
                }
            }
            updates.push(`streak_multipliers = $${paramIndex}`);
            params.push(streakMultipliers);
            paramIndex++;
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: '没有要更新的字段' });
        }
        
        updates.push(`updated_at = NOW()`);
        params.push(id);
        
        const result = await db.query(
            `UPDATE games SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            params
        );
        
        res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('[Admin Games] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 删除游戏
 * @route DELETE /api/admin/games/:id
 */
router.delete('/games/:id', authMiddleware, checkPermission('settings_game', 'update'), async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await db.query('DELETE FROM games WHERE id = $1 RETURNING id', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: '游戏不存在' });
        }
        
        res.status(200).json({
            success: true,
            message: '游戏已删除'
        });
    } catch (error) {
        console.error('[Admin Games] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 获取游戏派奖倍数（用于前端游戏逻辑）
 * @route GET /api/admin/games/:id/payout-multiplier
 */
router.get('/games/:id/payout-multiplier', authMiddleware, checkPermission('settings_game', 'read'), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('SELECT payout_multiplier FROM games WHERE id = $1', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: '游戏不存在' });
        }
        
        res.status(200).json({
            success: true,
            data: { payout_multiplier: result.rows[0].payout_multiplier }
        });
    } catch (error) {
        console.error('[Admin Games] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
