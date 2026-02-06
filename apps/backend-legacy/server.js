// apps/backend-legacy/server.js

require('dns').setDefaultResultOrder('ipv4first');

const express = require('express');
const cors = require('cors');
const db = require('@flipcoin/database');
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
const { sendError, sendSuccess } = require('./utils/safeResponse');
const userService = require('./services/UserService');
const gameService = require('./services/GameService');
const withdrawalService = require('./services/WithdrawalService');
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

// --- 健康檢查端點（用於 Docker healthcheck）---
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Passport.js 策略设定 ---
// 策略 1：本地注册 (local-signup)
passport.use('local-signup', new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password',
    passReqToCallback: true 
}, async (req, username, password, done) => {
    
    const client = await db.pool.connect(); 
    
    // (★★★ 修復競態條件：添加重試邏輯處理唯一約束錯誤 ★★★)
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
        try {
            await client.query('BEGIN');
            
            // (★★★ 調整鎖定順序：先獲取索引，再鎖定 users 表 ★★★)
            // 這樣可以減少鎖定時間，降低死鎖風險
            
            // 檢查用戶名是否已存在（使用行級鎖定，而不是表級鎖定）
            const existingUser = await client.query(
                'SELECT 1 FROM users WHERE username = $1 FOR UPDATE', 
                [username]
            );
            if (existingUser.rows.length > 0) {
                await client.query('ROLLBACK');
                client.release();
                return done(null, false, { message: '用户名已重复' });
            }
            
            // 先獲取索引（在鎖定 users 之前）
            let deposit_path_index, evm_deposit_address, tron_deposit_address;
            let isIndexValid = false;
            
            // (★★★ 修復：確保獲取的索引未被使用 ★★★)
            while (!isIndexValid) {
                const walletResult = await kmsService.getNewDepositWallets(client);
                deposit_path_index = walletResult.deposit_path_index;
                evm_deposit_address = walletResult.evm_deposit_address;
                tron_deposit_address = walletResult.tron_deposit_address;
                
                // 檢查索引是否已被使用（在鎖定 users 表之前）
                const existingIndex = await client.query(
                    'SELECT 1 FROM users WHERE deposit_path_index = $1',
                    [deposit_path_index]
                );
                if (existingIndex.rows.length === 0) {
                    isIndexValid = true;
                } else {
                    // 索引已被使用，需要重新獲取
                    console.warn(`[Signup] Index ${deposit_path_index} already in use, retrying...`);
                    // 等待一小段時間後重試
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }
            
            // 現在鎖定 users 表，確保插入的原子性
            await client.query('LOCK TABLE users IN EXCLUSIVE MODE');
            
            // 再次檢查用戶名（在表鎖定後，確保沒有併發插入）
            const doubleCheckUser = await client.query('SELECT 1 FROM users WHERE username = $1', [username]);
            if (doubleCheckUser.rows.length > 0) {
                await client.query('ROLLBACK');
                client.release();
                return done(null, false, { message: '用户名已重复' });
            }
            
            // 再次檢查索引（在表鎖定後，確保沒有併發插入）
            const doubleCheckIndex = await client.query('SELECT 1 FROM users WHERE deposit_path_index = $1', [deposit_path_index]);
            if (doubleCheckIndex.rows.length > 0) {
                await client.query('ROLLBACK');
                // 索引已被使用，需要重新獲取（但這不應該發生，因為我們已經檢查過了）
                console.warn(`[Signup] Index ${deposit_path_index} conflict detected after table lock, retrying...`);
                retryCount++;
                if (retryCount >= maxRetries) {
                    client.release();
                    return done(new Error('Failed to get unique deposit_path_index after maximum retries'));
                }
                const waitTime = Math.min(50 * retryCount, 200);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }
            
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(password, salt);
            // 生成密碼指紋（SHA256）用於比較相同密碼
            const password_fingerprint = crypto.createHash('sha256').update(password).digest('hex');
            
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
            
            // (★★★ 添加唯一約束錯誤處理和重試邏輯 ★★★)
            try {
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

                client.release();
                return done(null, newUser);
                
            } catch (insertError) {
                // (★★★ 確保在錯誤時正確 rollback ★★★)
                try {
                    await client.query('ROLLBACK');
                } catch (rollbackError) {
                    console.error('[Signup] Rollback Error:', rollbackError);
                }
                // (★★★ 捕獲唯一約束錯誤（錯誤碼 23505）並重試 ★★★)
                if (insertError.code === '23505' && retryCount < maxRetries - 1) {
                    // 檢查是否是 deposit_path_index 的唯一約束錯誤
                    if (insertError.constraint === 'users_deposit_path_index_key') {
                        // rollback 已經在上面執行了
                        retryCount++;
                        const waitTime = Math.min(50 * retryCount, 200); // 指數退避
                        console.warn(`[Signup] Duplicate deposit_path_index detected (${deposit_path_index}), retrying (${retryCount}/${maxRetries}) after ${waitTime}ms`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        // 重新開始循環，獲取新的索引
                        continue;
                    }
                }
                // 其他錯誤或達到最大重試次數，直接拋出
                throw insertError;
            }
        } catch (error) {
            console.error("[Signup] Transaction Error:", error);
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error("[Signup] Rollback Error:", rollbackError);
            }
            
            // 如果達到最大重試次數，返回錯誤
            if (retryCount >= maxRetries - 1) {
                client.release();
                return done(error);
            }
            
            // 其他錯誤也進行重試（但限制重試次數）
            retryCount++;
            const waitTime = Math.min(50 * retryCount, 200);
            console.warn(`[Signup] Error occurred, retrying (${retryCount}/${maxRetries}) after ${waitTime}ms:`, error.message);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            // 繼續重試
        }
    }
    
    // 理論上不會到達這裡，但作為安全措施
    client.release();
    return done(new Error('[Signup] Failed to register user after maximum retries'));
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
        // 檢查是否為管理員（admin_users 表）或用戶（users 表）
        const adminResult = await db.query('SELECT id, username, status FROM admin_users WHERE id = $1', [decoded.id]);
        if (adminResult.rows.length > 0) {
            // 管理員用戶
            const admin = adminResult.rows[0];
            if (admin.status !== 'active') {
                return next(new Error('认证失败：管理員帳號已停用'));
            }
            socket.isAdmin = true;
            socket.admin_id = admin.id;
            socket.username = admin.username;
        } else {
            // 普通用戶
            const result = await db.query('SELECT user_id, status FROM users WHERE id = $1', [decoded.id]);
            const user = result.rows[0];
            if (!user || user.status !== 'active') {
                return next(new Error('认证失败：用户不存在或已停用'));
            }
            socket.user_id = user.user_id;
            socket.isAdmin = false;
        }
        next();
    } catch (err) {
        return next(new Error('认证失败：凭证无效。'));
    }
});
io.on('connection', (socket) => { 
    if (socket.isAdmin) {
        // 管理員用戶：加入 admin room
        socket.join('admin');
        console.log(`[Socket.IO] Admin ${socket.username} (ID: ${socket.admin_id}) joined admin room`);
    } else {
        // 普通用戶：記錄連接
        const userId = socket.user_id;
        connectedUsers[userId] = socket.id;
    }
    
    // 處理加入 admin room 的請求（用於前端手動加入）
    socket.on('join_admin_room', () => {
        if (socket.isAdmin) {
            socket.join('admin');
            console.log(`[Socket.IO] Admin ${socket.username} manually joined admin room`);
        }
    });
    
    socket.on('disconnect', () => {
        if (socket.isAdmin) {
            console.log(`[Socket.IO] Admin ${socket.username} disconnected`);
        } else {
            const userId = socket.user_id;
            if (connectedUsers[userId] === socket.id) {
                delete connectedUsers[userId];
            }
        }
    });
});

// --- 路由顺序 (不变) ---
// (★★★ v8.1 修改：将 io 和 connectedUsers 传遞给 adminRoutes（必须在 Socket.IO 初始化之後）★★★)
adminRoutes.setIoAndConnectedUsers(io, connectedUsers);
// 設置 WithdrawalService 的 io 實例
withdrawalService.setIo(io);
// 設置 TronCollectionService 的 io 實例
tronCollectionService.setIo(io);
app.use('/api/admin', adminIpWhitelistMiddleware, adminRoutes);
app.use('/admin', adminIpWhitelistMiddleware, adminUiProxy);

const v1Router = express.Router();
const v1ApiRouter = require('./routes/v1');
v1ApiRouter(v1Router, passport, {
    betQueueService,
    payoutService,
    settingsCacheModule,
    connectedUsers,
    io
});
const frontendPath = path.join(__dirname, 'v1_frontend');
v1Router.use(express.static(frontendPath));
v1Router.get(/^(?!\/api\/).*$/, (req, res) => {
    if (req.path.startsWith('/api/')) {
        return sendError(res, 404, '找不到对应的 API 接口。');
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
});
app.use('/', v1Router);


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

    // 6. 启动 Collection Service（每 1 小时执行一次，高吞吐量配置）
    if (tronCollectionService) {
        console.log('[Collection] Scheduling high-throughput collection service (every 1 hour)');
        console.log('[Collection] Target: 500 users/hour, 10,000+ users/day');
        
        // 等待錢包加載後執行第一次歸集
        (async () => {
            try {
                await tronCollectionService.ensureWalletsLoaded();
                console.log('[Collection] Wallets loaded, starting initial collection...');
                await tronCollectionService.collectFunds();
            } catch (err) {
                console.error("[Collection] Initial run failed:", err);
            }
        })();
        
        // 之后每小时执行一次
        setInterval(() => {
            console.log('[Collection] Starting scheduled collection sweep...');
            tronCollectionService.collectFunds().catch(err => 
                console.error("[Collection] Scheduled run failed:", err)
            );
        }, 60 * 60 * 1000); // 1小时
    }

    // 7. 启动 Collection Retry Job (每 30 分钟执行一次)
    try {
        const { getCollectionRetryJobInstance } = require('./services/CollectionRetryJob.js');
        const collectionRetryJob = getCollectionRetryJobInstance();
        collectionRetryJob.start();
        console.log("✅ [CollectionRetryJob] Started.");
    } catch (error) {
        console.error("[CollectionRetryJob] Error starting:", error);
    }

    // 8. 启动能源监控服务 (每 5 分钟执行一次)
    try {
        const cron = require('node-cron');
        const { getMonitoringServiceInstance } = require('./services/MonitoringService.js');
        const monitoringService = getMonitoringServiceInstance();
        
        // 每 5 分钟执行一次：'*/5 * * * *'
        cron.schedule('*/5 * * * *', () => {
            monitoringService.checkWallets().catch(err => {
                console.error("[MonitoringService] Error in scheduled check:", err);
            });
        });
        
        console.log("✅ [MonitoringService] Started (runs every 5 minutes).");
    } catch (error) {
        console.error("[MonitoringService] Error starting:", error);
    }
});