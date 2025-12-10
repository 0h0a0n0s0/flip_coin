// backend/server.js

require('dns').setDefaultResultOrder('ipv4first');

const express = require('express');
const cors = require('cors');
const db = require('./db');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const adminRoutes = require('./routes/admin');
const adminIpWhitelistMiddleware = require('./middleware/adminIpWhitelistMiddleware');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { customAlphabet } = require('nanoid');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const axios = require('axios');

// 导入服务
const { getKmsInstance } = require('./services/KmsService.js');
const TronListener = require('./services/TronListener.js');
const { getTronCollectionInstance } = require('./services/TronCollectionService.js');
const { getGameOpenerInstance } = require('./services/GameOpenerService.js');
const { getBetQueueInstance } = require('./services/BetQueueService.js');
const { getPayoutServiceInstance } = require('./services/PayoutService.js');
const settingsCacheModule = require('./services/settingsCache.js');
const { setRiskControlSockets, enforceSameIpRiskControl } = require('./services/riskControlService');
const { getPendingBetProcessorInstance } = require('./services/PendingBetProcessor.js');
const { getWalletBalanceMonitorInstance } = require('./services/WalletBalanceMonitor.js');
const { sendError } = require('./utils/safeResponse');
const { maskAddress, maskTxHash } = require('./utils/maskUtils');
const { logBalanceChange, CHANGE_TYPES } = require('./utils/balanceChangeLogger');
const { loginRateLimiter, registerRateLimiter, withdrawRateLimiter } = require('./middleware/rateLimiter');
const { validateRegisterInput, validateLoginInput, validateWithdrawalInput } = require('./validators/authValidators');


// --- 全局变数 ---
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);

// (KMS Service)
let kmsService;
try {
    kmsService = getKmsInstance(); 
} catch (error) {
    console.error("CRITICAL KMS ERROR: FAILED TO INITIALIZE.", error.message);
    process.exit(1); 
}

// (Collection Service)
let tronCollectionService;
try {
    tronCollectionService = getTronCollectionInstance();
} catch (error) {
    console.error("CRITICAL: FAILED TO INITIALIZE TronCollectionService.", error.message);
    process.exit(1); 
}

// (GameOpener Service)
let gameOpenerService;
try {
    gameOpenerService = getGameOpenerInstance();
} catch (error) {
    console.error("CRITICAL: FAILED TO INITIALIZE GameOpenerService.", error.message);
    process.exit(1);
}

// (Payout Service)
let payoutService;

// (BetQueue Service)
let betQueueService;

// --- Express 實例 ---
const app = express();
const PORT = 3000;
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: "*", methods: ["GET", "POST"] } });

console.log('✅ 中心化服务启动...');

// --- 中间件设定 ---
app.use(cors());
app.use(express.json());
app.set('trust proxy', true);
app.use(passport.initialize());

// --- Passport.js 策略设定 ---
// 策略 1：本地注册 (local-signup)
passport.use('local-signup', new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password',
    passReqToCallback: true 
}, async (req, username, password, done) => {
    
    const client = await db.pool.connect(); 
    
    try {
        await client.query('BEGIN');
        await client.query('LOCK TABLE users IN EXCLUSIVE MODE');
        const existingUser = await client.query('SELECT 1 FROM users WHERE username = $1', [username]);
        if (existingUser.rows.length > 0) {
            await client.query('ROLLBACK');
            client.release();
            return done(null, false, { message: '用户名已重复' });
        }
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        // 生成密碼指紋（SHA256）用於比較相同密碼
        const password_fingerprint = crypto.createHash('sha256').update(password).digest('hex');
        const { 
            deposit_path_index, 
            evm_deposit_address, 
            tron_deposit_address 
        } = await kmsService.getNewDepositWallets(client); 
        let newUserId, isUserIdUnique = false;
        do {
            newUserId = Math.floor(10000000 + Math.random() * 90000000).toString();
            const existingId = await client.query('SELECT 1 FROM users WHERE user_id = $1', [newUserId]); 
            if (existingId.rows.length === 0) isUserIdUnique = true;
        } while (!isUserIdUnique);
        const newInviteCode = await generateUniqueInviteCode(client); 
        const { getClientIp } = require('./utils/ipUtils');
        const clientIp = getClientIp(req);
        const userAgent = req.headers['user-agent'] || null;
        
        // 提取设备ID和注册IP相关信息
        const { extractDeviceId } = require('./utils/ipUtils');
        const deviceId = extractDeviceId(req);
        
        const newUserResult = await client.query(
            `INSERT INTO users (
                username, password_hash, original_password_hash, password_fingerprint, user_id, invite_code,
                deposit_path_index, evm_deposit_address, tron_deposit_address, 
                registration_ip, device_id, last_activity_at, user_agent
             ) 
             VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11) 
             RETURNING *`,
            [
                username, password_hash, password_fingerprint, newUserId, newInviteCode,
                deposit_path_index, evm_deposit_address, tron_deposit_address,
                clientIp, deviceId, userAgent
            ]
        );
        await client.query('COMMIT'); 
        const newUser = newUserResult.rows[0];
        // 注册时不激活地址，只在归集时按需激活

        // (Risk Control) 检查同 IP 是否超过阈值
        try {
            const riskResult = await enforceSameIpRiskControl(clientIp);
            if (riskResult.triggered && riskResult.affectedUsers.includes(newUser.user_id)) {
                console.warn(`[RiskControl] Signup blocked due to same IP rule. IP: ${clientIp}, Users: ${riskResult.affectedUsers.join(',')}`);
                return done(null, false, { message: '该 IP 触发风控，账户已暂时封锁。' });
            }
        } catch (riskError) {
            console.error('[RiskControl] Failed to run same IP check after signup:', riskError);
        }

        return done(null, newUser);
    } catch (error) {
        console.error("[Signup] Transaction Error:", error);
        await client.query('ROLLBACK'); 
        return done(error);
    } finally {
        client.release(); 
    }
}));

// 策略 2：本地登入 (local-login)
passport.use('local-login', new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password'
}, async (username, password, done) => {
    try {
        const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user) {
            return done(null, false, { message: '用户名或密码错误' });
        }
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return done(null, false, { message: '用户名或密码错误' });
        }
        if (user.status !== 'active') {
             return done(null, false, { message: '账户已被停用' });
        }
        return done(null, user);
    } catch (error) {
        return done(error);
    }
}));

// 策略 3：JWT 验证 (jwt)
passport.use('jwt', new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET
}, async (jwt_payload, done) => {
    try {
        const result = await db.query('SELECT * FROM users WHERE id = $1', [jwt_payload.id]);
        const user = result.rows[0];
        if (user) {
            delete user.password_hash;
            return done(null, user);
        } else {
            return done(null, false);
        }
    } catch (error) {
        return done(error, false);
    }
}));

// --- 辅助函数 (不变) ---
async function generateUniqueInviteCode(client) {
    let inviteCode;
    let isUnique = false;
    do {
        inviteCode = nanoid();
        const existing = await client.query('SELECT 1 FROM users WHERE invite_code = $1', [inviteCode]);
        if (existing.rows.length === 0) isUnique = true;
    } while (!isUnique);
    return inviteCode;
}

// --- 代理设定 (不变) ---
const adminUiProxy = createProxyMiddleware({
    target: 'http://admin-ui:80', 
    changeOrigin: true,
    pathRewrite: { '^/admin': '' }, 
});

// --- Socket.IO (不变) ---
let connectedUsers = {}; 
setRiskControlSockets(io, connectedUsers);

io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('认证失败：缺少凭证。'));
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const result = await db.query('SELECT user_id, status FROM users WHERE id = $1', [decoded.id]);
        const user = result.rows[0];
        if (!user || user.status !== 'active') {
             return next(new Error('认证失败：用户不存在或已停用'));
        }
        socket.user_id = user.user_id; 
        next();
    } catch (err) {
        return next(new Error('认证失败：凭证无效。'));
    }
});
io.on('connection', (socket) => { 
    const userId = socket.user_id;
    connectedUsers[userId] = socket.id;
    socket.on('disconnect', () => {
        if (connectedUsers[userId] === socket.id) {
            delete connectedUsers[userId];
        }
    });
});

// --- 路由顺序 (不变) ---
// (★★★ v8.1 修改：将 io 和 connectedUsers 传遞给 adminRoutes（必须在 Socket.IO 初始化之後）★★★)
adminRoutes.setIoAndConnectedUsers(io, connectedUsers);
app.use('/api/admin', adminIpWhitelistMiddleware, adminRoutes);
app.use('/admin', adminIpWhitelistMiddleware, adminUiProxy);

const v1Router = express.Router();
v1ApiRouter(v1Router, passport); 
const frontendPath = path.join(__dirname, 'v1_frontend');
v1Router.use(express.static(frontendPath));
v1Router.get(/^(?!\/api\/).*$/, (req, res) => {
    if (req.path.startsWith('/api/')) {
        return sendError(res, 404, '找不到对应的 API 接口。');
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
});
app.use('/', v1Router);

// --- v1 API 路由定义函数 ---
function v1ApiRouter(router, passport) {
    
    // (★★★ v8.1 新增：自动出款的異步辅助函数 ★★★)
    /**
     * @description (異步执行) 尝試自动出款，并在成功或失败时更新资料库
     */
    async function executeAutoPayout(withdrawalRequest) {
        const { id, user_id, amount, chain_type, address } = withdrawalRequest;
        
        try {
            // (目前僅支援 TRC20)
            if (chain_type !== 'TRC20') {
                 throw new Error(`Chain ${chain_type} not supported for auto-payout.`);
            }
            
            if (!payoutService) {
                throw new Error('PayoutService is not initialized');
            }
            
            if (!payoutService.isReady()) {
                await payoutService.ensureWalletsLoaded();
                if (!payoutService.isReady()) {
                    throw new Error('PayoutService is not ready after attempting to load wallets');
                }
            }
            
            const txHash = await payoutService.sendTrc20Payout(withdrawalRequest);
            
            // (出款成功)
            const client = await db.pool.connect();
            try {
                await client.query('BEGIN');
                // 1. 更新 withdrawals
                await client.query(
                    `UPDATE withdrawals SET status = 'completed', tx_hash = $1, review_time = NOW(), 
                     rejection_reason = 'Auto-Approved', gas_fee = 0 WHERE id = $2`, // (自动出款 Gas 暂计为 0)
                    [txHash, id]
                );
                // 2. 更新 platform_transactions
                await client.query(
                    `UPDATE platform_transactions SET status = 'completed', tx_hash = $1, updated_at = NOW()
                     WHERE user_id = $2 AND type = 'withdraw_request' AND amount = $3 AND status = 'processing'`,
                    [txHash, user_id, -Math.abs(amount)]
                );
                await client.query('COMMIT');
            } catch (dbError) {
                await client.query('ROLLBACK');
                console.error(`[v8 Payout] CRITICAL! Payout ${id} SUCCEEDED on-chain but FAILED to update DB:`, dbError.message);
                // (此时需要人工介入)
            } finally {
                client.release();
            }

        } catch (payoutError) {
            // (出款失败 - 例如 Payout 钱包余额不足)
            console.error(`[v8 Payout] ========== AUTO-PAYOUT FAILED ==========`);
            console.error(`[v8 Payout] FAILED (WID: ${id}). Reason: ${payoutError.message}. Reverting to manual review...`);
            console.error(`[v8 Payout] Error stack:`, payoutError.stack);
            try {
                // (将狀态改回 'pending'，等待人工審核)
                const failureReason = `Auto-Payout Failed: ${payoutError.message.substring(0, 200)}`;
                await db.query(
                    `UPDATE withdrawals SET status = 'pending', rejection_reason = $1, review_time = NOW() WHERE id = $2`,
                    [failureReason, id]
                );
                await db.query(
                    `UPDATE platform_transactions SET status = 'pending', updated_at = NOW()
                     WHERE user_id = $1 AND type = 'withdraw_request' AND amount = $2 AND status = 'processing'`,
                    [user_id, -Math.abs(amount)]
                );
            } catch (dbError) {
                console.error(`[v8 Payout] CRITICAL! Payout ${id} FAILED and FAILED to revert status in DB:`, dbError.message);
            }
        }
    }
    
    // ( GET /api/v1/platform-name ) - 公開API，獲取平台名稱
    // ( /api/v1/games ) 获取游戏列表（前台使用）
    router.get('/api/v1/games', async (req, res) => {
        try {
            const { status = 'enabled' } = req.query;
            
            const result = await db.query(
                `SELECT id, provider, name_zh, name_en, game_code, game_status, status, sort_order, 
                        payout_multiplier, streak_multipliers
                 FROM games 
                 WHERE status = $1 
                 ORDER BY sort_order ASC, id ASC`,
                [status]
            );
            
            res.status(200).json({
                success: true,
                data: result.rows
            });
        } catch (error) {
            console.error('[API v1] Error fetching games:', error);
            return sendError(res, 500, '获取游戏列表失败。');
        }
    });

    router.get('/api/v1/platform-name', async (req, res) => {
        try {
            const result = await db.query(
                "SELECT value FROM system_settings WHERE key = 'PLATFORM_NAME' LIMIT 1"
            );
            const platformName = result.rows[0]?.value || 'FlipCoin';
            res.status(200).json({
                success: true,
                data: {
                    platform_name: platformName
                }
            });
        } catch (error) {
            console.error('[API v1] Error fetching platform name:', error);
            res.status(200).json({
                success: true,
                data: {
                    platform_name: 'FlipCoin' // 默认值
                }
            });
        }
    });
    
    // ( /api/v1/register ) (★★★ 新增：註冊後自動登入時記錄登錄IP ★★★)
    router.post('/api/v1/register', registerRateLimiter, validateRegisterInput, (req, res, next) => {
        passport.authenticate('local-signup', { session: false }, async (err, user, info) => {
            if (err) return next(err);
            if (!user) return sendError(res, 400, info.message || '注册失败。');
            
            // (★★★ 新增：註冊後自動登入時記錄首次登錄信息 ★★★)
            try {
                const { getClientIp, extractDeviceId, getCountryFromIp } = require('./utils/ipUtils');
                const clientIp = getClientIp(req);
                const userAgent = req.headers['user-agent'] || null;
                const deviceId = extractDeviceId(req);
                const country = await getCountryFromIp(clientIp);
                
                // 註冊後自動登入，記錄首次登錄信息
                await db.query(
                    `UPDATE users 
                     SET first_login_ip = $1, first_login_country = $2, first_login_at = NOW(),
                         last_login_ip = $1, last_activity_at = NOW(), user_agent = $3,
                         device_id = COALESCE(device_id, $4)
                     WHERE id = $5`,
                    [clientIp, country, userAgent, deviceId, user.id]
                );
                
                // 記錄登錄日誌
                await db.query(
                    `INSERT INTO user_login_logs (user_id, login_ip, login_country, device_id, user_agent) 
                     VALUES ($1, $2, $3, $4, $5)`,
                    [user.user_id, clientIp, country, deviceId, userAgent]
                );
                
            } catch (error) {
                console.error('[Register] Failed to record auto-login info:', error);
                // 不阻擋註冊流程，僅記錄錯誤
            }
            
            const payload = { id: user.id, username: user.username };
            const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
            delete user.password_hash;
            res.status(201).json({ user, token });
        })(req, res, next);
    });

    // ( /api/v1/login ) (更新：记录登录IP、活动时间和User Agent)
    router.post('/api/v1/login', loginRateLimiter, validateLoginInput, (req, res, next) => {
        passport.authenticate('local-login', { session: false }, async (err, user, info) => {
            if (err) return next(err);
            if (!user) return sendError(res, 401, info.message || '登录失败。');
            
            // (★★★ v9.2 更新：记录登录信息，包括首次登录和登录日志 ★★★)
            try {
                const { getClientIp, extractDeviceId, getCountryFromIp } = require('./utils/ipUtils');
                const clientIp = getClientIp(req);
                const userAgent = req.headers['user-agent'] || null;
                const deviceId = extractDeviceId(req);
                const country = await getCountryFromIp(clientIp);
                
                // 检查是否是首次登录
                const userInfo = await db.query(
                    'SELECT first_login_ip, first_login_at FROM users WHERE id = $1',
                    [user.id]
                );
                const isFirstLogin = !userInfo.rows[0].first_login_ip;
                
                if (isFirstLogin) {
                    // 首次登录，记录首次登录信息
                    await db.query(
                        `UPDATE users 
                         SET first_login_ip = $1, first_login_country = $2, first_login_at = NOW(),
                             last_login_ip = $1, last_activity_at = NOW(), user_agent = $3,
                             device_id = COALESCE(device_id, $4)
                         WHERE id = $5`,
                        [clientIp, country, userAgent, deviceId, user.id]
                    );
                } else {
                    // 非首次登录，只更新最后登录信息
                    await db.query(
                        `UPDATE users 
                         SET last_login_ip = $1, last_activity_at = NOW(), user_agent = $2,
                             device_id = COALESCE(device_id, $3)
                         WHERE id = $4`,
                        [clientIp, userAgent, deviceId, user.id]
                    );
                }
                
                // 记录登录日志
                await db.query(
                    `INSERT INTO user_login_logs (user_id, login_ip, login_country, device_id, user_agent) 
                     VALUES ($1, $2, $3, $4, $5)`,
                    [user.user_id, clientIp, country, deviceId, userAgent]
                );

                const riskResult = await enforceSameIpRiskControl(clientIp);
                if (riskResult.triggered && riskResult.affectedUsers.includes(user.user_id)) {
                    console.warn(`[RiskControl] Login blocked due to same IP rule. IP: ${clientIp}, Users: ${riskResult.affectedUsers.join(',')}`);
                    return sendError(res, 403, '该 IP 触发风控，账户已暂时封锁。');
                }
            } catch (error) {
                console.error('[Login] Failed to update user login info:', error);
            }
            
            const payload = { id: user.id, username: user.username };
            const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
            delete user.password_hash;
            res.status(200).json({ user, token });
        })(req, res, next);
    });

    // ( /api/v1/me ) (不变)
    router.get('/api/v1/me', passport.authenticate('jwt', { session: false }), (req, res) => {
        res.status(200).json(req.user);
    });

    // ( PATCH /api/v1/users/nickname ) (不变)
    router.patch('/api/v1/users/nickname', passport.authenticate('jwt', { session: false }), async (req, res) => {
        const { nickname } = req.body;
        const userId = req.user.id; 

        if (!nickname || nickname.trim().length === 0) {
            return sendError(res, 400, '昵称不能为空。');
        }
        if (nickname.length > 50) {
            return sendError(res, 400, '昵称过长（最多 50 个字符）。');
        }

        try {
            const result = await db.query(
                'UPDATE users SET nickname = $1 WHERE id = $2 RETURNING *',
                [nickname.trim(), userId]
            );
            
            const updatedUser = result.rows[0];
            delete updatedUser.password_hash;
            res.status(200).json(updatedUser);

        } catch (error) {
            console.error(`[v7 API] Error updating nickname for user ${userId}:`, error);
            return sendError(res, 500, '服务器内部错误。');
        }
    });

    // ( POST /api/v1/users/bind-referrer ) (不变)
    router.post('/api/v1/users/bind-referrer', passport.authenticate('jwt', { session: false }), async (req, res) => {
        const { referrer_code } = req.body;
        const user = req.user; 

        if (!referrer_code || referrer_code.trim().length === 0) {
            return sendError(res, 400, '推荐码不能为空。');
        }
        
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            
            const userCheckResult = await client.query(
                'SELECT referrer_code, invite_code FROM users WHERE id = $1 FOR UPDATE', 
                [user.id]
            );
            const currentUserData = userCheckResult.rows[0];

            if (currentUserData.referrer_code) {
                await client.query('ROLLBACK');
                client.release();
                return sendError(res, 400, '账户已绑定推荐人。');
            }
            
            if (currentUserData.invite_code === referrer_code) {
                await client.query('ROLLBACK');
                client.release();
                return sendError(res, 400, '不能使用自己的邀请码作为推荐码。');
            }

            const referrerExists = await client.query('SELECT 1 FROM users WHERE invite_code = $1', [referrer_code]);
            if (referrerExists.rows.length === 0) {
                await client.query('ROLLBACK');
                client.release();
                return sendError(res, 400, '推荐码无效，找不到对应的用户。');
            }
            
            const updateResult = await client.query(
                'UPDATE users SET referrer_code = $1 WHERE id = $2 RETURNING *',
                [referrer_code, user.id]
            );
            
            await client.query('COMMIT');
            
            const updatedUser = updateResult.rows[0];
            delete updatedUser.password_hash;
            res.status(200).json(updatedUser);

        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`[v7 API] Error binding referrer for user ${user.id}:`, error);
            return sendError(res, 500, '服务器内部错误。');
        } finally {
            client.release();
        }
    });

    // ( /api/v1/history ) (不变)
    router.get('/api/v1/history', passport.authenticate('jwt', { session: false }), async (req, res) => {
        try {
            const historyResult = await db.query('SELECT * FROM bets WHERE user_id = $1 ORDER BY bet_time DESC', [req.user.user_id]); 
            res.status(200).json(historyResult.rows); 
        } catch (error) {
            console.error('Error fetching history:', error);
            return sendError(res, 500, '服务器内部错误。');
        }
    });

    // ( /api/v1/bets ) (支持游戏模式)
    router.post('/api/v1/bets', passport.authenticate('jwt', { session: false }), async (req, res) => {
        const { choice, amount, gameMode = 'normal' } = req.body;
        const user = req.user; 
        if (choice !== 'head' && choice !== 'tail') {
            return sendError(res, 400, '投注选项无效。');
        }
        const betAmount = parseFloat(amount);
        if (isNaN(betAmount) || betAmount <= 0) {
             return sendError(res, 400, '投注金额无效。');
        }
        
        // 验证 gameMode
        if (gameMode !== 'normal' && gameMode !== 'streak') {
            return sendError(res, 400, '游戏模式无效。');
        }
        
        // 检查游戏是否开启
        const { isGameEnabled } = require('./utils/gameUtils.js');
        const gameEnabled = await isGameEnabled('FlipCoin');
        if (!gameEnabled) {
            return sendError(res, 403, '游戏尚未开放，敬请期待！');
        }
        
        if (!betQueueService) {
             return sendError(res, 503, '投注服务暂未就绪，请稍后重试。');
        }
        try {
            // (★★★ v9.2 新增：获取投注IP并传递 ★★★)
            const { getClientIp } = require('./utils/ipUtils');
            const betIp = getClientIp(req);
            const settledBet = await betQueueService.addBetToQueue(user, choice, betAmount, betIp, gameMode);
            res.status(200).json(settledBet);
        } catch (error) {
            console.error(`[v7 API] Bet failed for user ${user.user_id}:`, error.message);
            return sendError(res, 400, error.message || '下注失败。');
        }
    });

    // ( /api/v1/leaderboard ) (不变)
    router.get('/api/v1/leaderboard', async (req, res) => {
        try {
            const leaderboardResult = await db.query(
                `SELECT 
                    user_id, 
                    COALESCE(nickname, username) AS display_name,
                    max_streak 
                 FROM users 
                 WHERE max_streak > 0 
                 ORDER BY max_streak DESC 
                 LIMIT 10`
            ); 
            res.status(200).json(leaderboardResult.rows); 
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            return sendError(res, 500, '服务器内部错误，无法获取排行榜数据。');
        }
    });
        
    // ( POST /api/v1/users/set-withdrawal-password ) (不变)
    router.post('/api/v1/users/set-withdrawal-password', passport.authenticate('jwt', { session: false }), async (req, res) => {
        const { login_password, new_password } = req.body;
        const user = req.user;

        if (!login_password || !new_password || new_password.length < 6) {
            return sendError(res, 400, '登入密码为必填，且新提款密码长度至少 6 位。');
        }
        try {
            const fullUser = await db.query('SELECT password_hash, has_withdrawal_password FROM users WHERE id = $1', [user.id]);
            if (fullUser.rows[0].has_withdrawal_password) {
                 return sendError(res, 400, '提款密码已设置。');
            }
            const isMatch = await bcrypt.compare(login_password, fullUser.rows[0].password_hash);
            if (!isMatch) {
                return sendError(res, 401, '登入密码错误。');
            }
            const salt = await bcrypt.genSalt(10);
            const withdrawal_hash = await bcrypt.hash(new_password, salt);
            // 生成資金密碼指紋（SHA256）用於比較相同密碼
            const withdrawal_password_fingerprint = crypto.createHash('sha256').update(new_password).digest('hex');
            // 首次設置資金密碼時，同時保存到 original_withdrawal_password_hash 和指紋
            await db.query(
                `UPDATE users 
                 SET withdrawal_password_hash = $1, 
                     original_withdrawal_password_hash = COALESCE(original_withdrawal_password_hash, $1),
                     withdrawal_password_fingerprint = COALESCE(withdrawal_password_fingerprint, $2),
                     has_withdrawal_password = true 
                 WHERE id = $3`,
                [withdrawal_hash, withdrawal_password_fingerprint, user.id]
            );
            res.status(200).json({ message: '提款密码设置成功' });
        } catch (error) {
            console.error(`[API v1] Error setting withdrawal pwd for ${user.user_id}:`, error);
            return sendError(res, 500, '伺服器内部错误。');
        }
    });

    // ( PATCH /api/v1/users/update-withdrawal-password ) (不变)
    router.patch('/api/v1/users/update-withdrawal-password', passport.authenticate('jwt', { session: false }), async (req, res) => {
        const { old_password, new_password } = req.body;
        const user = req.user;
        if (!old_password || !new_password || new_password.length < 6) {
            return sendError(res, 400, '旧密码为必填，且新提款密码长度至少 6 位。');
        }
        try {
            const fullUser = await db.query('SELECT withdrawal_password_hash FROM users WHERE id = $1', [user.id]);
            if (!fullUser.rows[0].withdrawal_password_hash) {
                 return sendError(res, 400, '尚未设置提款密码。');
            }
            const isMatch = await bcrypt.compare(old_password, fullUser.rows[0].withdrawal_password_hash);
            if (!isMatch) {
                return sendError(res, 401, '旧提款密码错误。');
            }
            const salt = await bcrypt.genSalt(10);
            const withdrawal_hash = await bcrypt.hash(new_password, salt);
            await db.query(
                'UPDATE users SET withdrawal_password_hash = $1 WHERE id = $2',
                [withdrawal_hash, user.id]
            );
            res.status(200).json({ message: '提款密码修改成功' });
        } catch (error) {
            console.error(`[API v1] Error updating withdrawal pwd for ${user.user_id}:`, error);
            return sendError(res, 500, '伺服器内部错误。');
        }
    });
    
    // (★★★ v8.1 重点修改：POST /api/v1/users/request-withdrawal ★★★)
    /**
     * @description (新) 请求提款 (整合自动出款逻辑)
     * @body { chain_type, address, amount, withdrawal_password }
     */
    router.post('/api/v1/users/request-withdrawal',
        withdrawRateLimiter,
        validateWithdrawalInput,
        passport.authenticate('jwt', { session: false }),
        async (req, res) => {
        const { chain_type, address, amount, withdrawal_password } = req.body;
        const user = req.user;
        const withdrawalAmount = parseFloat(amount);
        
        // 1. 基本验证
        if (!chain_type || !address || !withdrawalAmount || withdrawalAmount <= 0 || !withdrawal_password) {
             return sendError(res, 400, '所有栏位均为必填。');
        }
        const MIN_WITHDRAWAL = parseFloat(process.env.MIN_WITHDRAWAL_AMOUNT || '10');
        if (withdrawalAmount < MIN_WITHDRAWAL) {
             return sendError(res, 400, `最小提款金额为 ${MIN_WITHDRAWAL} USDT。`);
        }

        // 2. 检查自动出款资格
        const settingsCache = settingsCacheModule.getSettingsCache();
        const threshold = parseFloat(settingsCache['AUTO_WITHDRAW_THRESHOLD']?.value || '0');
        
        const isAutoPayoutEligible = payoutService && 
                                     payoutService.isReady() &&
                                     threshold > 0 && 
                                     withdrawalAmount <= threshold && 
                                     chain_type === 'TRC20'; // (目前僅 TRC20 支援自动出款)

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            
            // 3. 锁定用户并检查所有条件 (余额、提款密码)
            const userResult = await client.query(
                'SELECT balance, withdrawal_password_hash, has_withdrawal_password FROM users WHERE id = $1 FOR UPDATE',
                [user.id]
            );
            const userData = userResult.rows[0];

            if (!userData.has_withdrawal_password) {
                throw new Error('尚未设置提款密码');
            }
            if (parseFloat(userData.balance) < withdrawalAmount) {
                throw new Error('余额不足');
            }
            
            const isPwdMatch = await bcrypt.compare(withdrawal_password, userData.withdrawal_password_hash);
            if (!isPwdMatch) {
                throw new Error('提款密码错误');
            }

            // 4. 扣款
            const updatedUserResult = await client.query(
                'UPDATE users SET balance = balance - $1 WHERE id = $2 RETURNING *',
                [withdrawalAmount, user.id]
            );
            const updatedUser = updatedUserResult.rows[0];

            let withdrawalStatus, platformTxStatus, responseMessage, rejectionReason;

            if (isAutoPayoutEligible) {
                // (符合自动出款：立即设为 'processing')
                withdrawalStatus = 'processing';
                platformTxStatus = 'processing';
                responseMessage = '提款请求已批准，正在自动出款...';
                rejectionReason = 'Auto-Payout Queued';
            } else {
                // (不符合：设为 'pending')
                withdrawalStatus = 'pending';
                platformTxStatus = 'pending';
                responseMessage = '提款请求已提交，待審核';
                rejectionReason = null;
            }

            // 5. 創建 withdrawals 提款单
            const wdResult = await client.query(
                `INSERT INTO withdrawals (user_id, chain_type, address, amount, status, rejection_reason)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, // (返回完整
                [user.user_id, chain_type, address, withdrawalAmount, withdrawalStatus, rejectionReason]
            );
            const withdrawalRequest = wdResult.rows[0];
            
            // 6. 創建 platform_transactions 资金流水
            await client.query(
                `INSERT INTO platform_transactions (user_id, type, chain, amount, status)
                 VALUES ($1, 'withdraw_request', $2, $3, $4)`,
                 [user.user_id, chain_type, -Math.abs(withdrawalAmount), platformTxStatus]
            );

            // 6b. 记录账变（提款扣款）
            try {
                const newBalance = parseFloat(updatedUser.balance);
                await logBalanceChange({
                    user_id: user.user_id,
                    change_type: CHANGE_TYPES.WITHDRAWAL,
                    amount: -withdrawalAmount,  // 负数表示扣款
                    balance_after: newBalance,
                    remark: `提款申请 ${withdrawalAmount} USDT, 提款单ID: ${withdrawalRequest.id}, 地址: ${address}`,
                    client: client
                });
            } catch (error) {
                console.error('[Server] Failed to log balance change (withdrawal):', error);
                // 不阻止主流程，只记录错误
            }

            // 7. 提交资料库事务
            await client.query('COMMIT');
            
            // 8. (同步) 通知前台余额变动
            delete updatedUser.password_hash;
            delete updatedUser.withdrawal_password_hash;
            const socketId = connectedUsers[user.user_id];
            if (socketId) {
                io.to(socketId).emit('user_info_updated', updatedUser);
            }

            // 9. (同步) 回应 HTTP 请求
            res.status(201).json({ message: responseMessage });
            
            // 10. 异步执行链上出款（在回应后）
            if (isAutoPayoutEligible) {
                executeAutoPayout(withdrawalRequest).catch(err => {
                    console.error('[Payout] Unhandled error in executeAutoPayout:', err);
                });
            }

        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`[API] Withdrawal request failed for ${user.user_id}:`, error);
            return sendError(res, 400, error.message || '提款失败。');
        } finally {
            client.release();
        }
    });
    
    // GET /api/v1/users/withdrawals
    router.get('/api/v1/users/withdrawals', passport.authenticate('jwt', { session: false }), async (req, res) => {
        try {
            const result = await db.query(
                "SELECT chain_type, address, amount, status, rejection_reason, request_time, review_time, tx_hash FROM withdrawals WHERE user_id = $1 ORDER BY request_time DESC LIMIT 20",
                [req.user.user_id]
            );
            const history = result.rows.map(item => ({
                ...item,
                address_masked: maskAddress(item.address || ''),
                tx_hash_masked: item.tx_hash ? maskTxHash(item.tx_hash) : null
            }));
            res.status(200).json(history);
        } catch (error) {
            console.error(`[API v1] Error fetching withdrawal history for ${req.user.user_id}:`, error);
            return sendError(res, 500, '伺服器内部错误。');
        }
    });
    
    // ( GET /api/v1/users/deposits ) (不变)
    router.get('/api/v1/users/deposits', passport.authenticate('jwt', { session: false }), async (req, res) => {
        try {
            const result = await db.query(
                `SELECT id, chain, amount, status, tx_hash, created_at 
                 FROM platform_transactions 
                 WHERE user_id = $1 AND type = 'deposit' 
                 ORDER BY created_at DESC 
                 LIMIT 20`,
                [req.user.user_id]
            );
            const history = result.rows.map(item => ({
                ...item,
                tx_hash_masked: item.tx_hash ? maskTxHash(item.tx_hash) : null
            }));
            res.status(200).json(history);
        } catch (error) {
            console.error(`[API v1] Error fetching deposit history for ${req.user.user_id}:`, error);
            return sendError(res, 500, '伺服器内部错误。');
        }
    });
}

// --- 启动伺服器 ---
httpServer.listen(PORT, async () => { 
    console.log(`Server (with Socket.io) is listening on port ${PORT}`);

    // 1. 载入系统设定
    await settingsCacheModule.loadSettings();
    
    // 2. 初始化 BetQueue (v8.1 修正：移除 settingsCache 传参)
    betQueueService = getBetQueueInstance(
        io, 
        connectedUsers, 
        gameOpenerService
    );
    
    // (★★★ v8.1 新增：初始化 PayoutService ★★★)
    payoutService = getPayoutServiceInstance();
    
    // (★★★ v8.1 新增：初始化後立即载入钱包 ★★★)
    try {
        await payoutService.ensureWalletsLoaded();
    } catch (payoutError) {
        console.error("[v8 Payout] Warning: Failed to load payout wallets during startup:", payoutError.message);
        // (不中断启动，允许後续重試)
    }

    // 3. 启动 TronListener
    try {
        const TronListener = require('./services/TronListener.js');
        const tronListener = new TronListener(io, connectedUsers);
        tronListener.start(); 
    } catch (listenerError) {
         console.error("[v7] Error initializing TronListener:", listenerError);
    }
    
    // 4. 启动待处理注单处理器
    try {
        const pendingBetProcessor = getPendingBetProcessorInstance(io, connectedUsers);
        pendingBetProcessor.start();
        console.log("✅ [PendingBetProcessor] Started.");
    } catch (error) {
        console.error("[PendingBetProcessor] Error starting:", error);
    }

    // 5. 启动钱包余额监控
    try {
        const walletBalanceMonitor = getWalletBalanceMonitorInstance();
        walletBalanceMonitor.start();
        console.log("✅ [WalletBalanceMonitor] Started.");
    } catch (error) {
        console.error("[WalletBalanceMonitor] Error starting:", error);
    }

    // 6. 启动 Collection Service (每日执行一次)
    if (tronCollectionService) {
        // 计算到明天凌晨的时间
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const msUntilTomorrow = tomorrow.getTime() - now.getTime();
        
        // 第一次执行：明天凌晨
        setTimeout(() => {
            tronCollectionService.collectFunds().catch(err => console.error("[Collection] Initial run failed:", err));
            
            // 之後每天执行一次
            setInterval(() => {
                tronCollectionService.collectFunds().catch(err => console.error("[Collection] Daily run failed:", err));
            }, 24 * 60 * 60 * 1000); // 24小时
        }, msUntilTomorrow);
    }
});