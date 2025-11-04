// 檔案: backend/server.js (★★★ v7.1 HD 錢包修正版 ★★★)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
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
const jwt = require('jsonwebtoken');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');

// (★★★ 1. 導入 KmsService ★★★)
const { getKmsInstance } = require('./services/KmsService.js');
const TronListener = require('./services/TronListener.js');
const { getTronCollectionInstance } = require('./services/TronCollectionService.js');
const { getGameOpenerInstance } = require('./services/GameOpenerService.js');
const { getBetQueueInstance } = require('./services/BetQueueService.js');

// --- 全局變數 ---
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);
let userLevelsCache = {};
let settingsCache = {};
module.exports.getSettingsCache = () => { return settingsCache; };

// (★★★ 立即初始化 KmsService ★★★)
let kmsService;
try {
    kmsService = getKmsInstance(); // (這將觸發 KmsService.js 中的 console.log)
} catch (error) {
    console.error("CRITICAL KMS ERROR: FAILED TO INITIALIZE.", error.message);
    console.error("Ensure MASTER_MNEMONIC is set in .env file.");
    process.exit(1); // 如果 KMS 失敗 (例如 .env 遺失)，必須停止服務
}

// (★★★ 初始化 Collection Service ★★★)
let tronCollectionService;
try {
    tronCollectionService = getTronCollectionInstance();
} catch (error) {
    console.error("CRITICAL: FAILED TO INITIALIZE TronCollectionService.", error.message);
    process.exit(1); 
}

// (★★★ 初始化 GameOpener ★★★)
let gameOpenerService;
try {
    gameOpenerService = getGameOpenerInstance();
} catch (error) {
    console.error("CRITICAL: FAILED TO INITIALIZE GameOpenerService.", error.message);
    process.exit(1);
}

// (★★★ M5 延後：BetQueue 需要 io 和 settingsCache，在 listen 時才初始化 ★★★)
let betQueueService;

// --- Express 實例 ---
const app = express();
const PORT = 3000;
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: "*", methods: ["GET", "POST"] } });

console.log(`✅ [v6] 中心化服務啟動...`); // (這個日誌現在會在 KMS 之後)
console.log(`✅ 連接到區塊鏈 (用於開獎): ${process.env.SEPOLIA_RPC_URL}`);

// --- 中間件設定 ---
app.use(cors());
app.use(express.json());
app.set('trust proxy', true);
app.use(passport.initialize());

// --- Passport.js 策略設定 (★★★ v7 修改 ★★★) ---

// 策略 1：本地註冊 (local-signup)
passport.use('local-signup', new LocalStrategy({
    // ... (config 不變)
    usernameField: 'username',
    passwordField: 'password',
    passReqToCallback: true 
}, async (req, username, password, done) => {
    try {
        // ... (1. 檢查用戶名, 2. 密碼加密, 3. KMS 獲取地址 不變) ...
        // 1. 檢查用戶名
        const existingUser = await db.query('SELECT 1 FROM users WHERE username = $1', [username]);
        if (existingUser.rows.length > 0) {
            return done(null, false, { message: 'Username already taken.' });
        }
        
        // 2. 密碼加密
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        
        // ( 3. v7 核心修改：從 KMS 獲取新地址和索引 )
        const { 
            deposit_path_index, 
            evm_deposit_address, 
            tron_deposit_address 
        } = await kmsService.getNewDepositWallets();

        // 4. 生成唯一 user_id (v6 邏輯)
        let newUserId, isUserIdUnique = false;
        do {
            newUserId = Math.floor(10000000 + Math.random() * 90000000).toString();
            const existingId = await db.query('SELECT 1 FROM users WHERE user_id = $1', [newUserId]);
            if (existingId.rows.length === 0) isUserIdUnique = true;
        } while (!isUserIdUnique);
        
        // ( 4. v7 核心修改：生成 invite_code (保留 v6 邏輯) )
        const newInviteCode = await generateUniqueInviteCode();

        // 5. 獲取 IP
        const clientIp = req.headers['x-real-ip'] || req.ip;

        // 6. 插入新用戶 (使用 v7 init.sql 的新欄位)
        const newUserResult = await db.query(
            `INSERT INTO users (
                username, password_hash, user_id, invite_code,
                deposit_path_index, evm_deposit_address, tron_deposit_address, 
                last_login_ip, last_activity_at
             ) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) 
             RETURNING *`,
            [
                username, password_hash, newUserId, newInviteCode,
                deposit_path_index, evm_deposit_address, tron_deposit_address,
                clientIp
            ]
        );
        
        const newUser = newUserResult.rows[0];
        console.log(`[v7 Auth] New user registered: ${username} (User ID: ${newUserId}, Path: ${deposit_path_index})`);

        // (★★★ M3 關鍵：觸發地址激活 ★★★)
        // (我們非同步執行，不需要等待激活完成)
        if (tron_deposit_address && tronCollectionService) {
            tronCollectionService.activateAddress(tron_deposit_address)
                .catch(err => console.error(`[v7 Activate] Async activation failed for ${tron_deposit_address}:`, err.message));
        }

        return done(null, newUser);

    } catch (error) {
        console.error("[v7 signup] Error:", error);
        return done(error);
    }
}));

// 策略 2：本地登入 (local-login) (不變)
passport.use('local-login', new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password'
}, async (username, password, done) => {
    try {
        const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user) {
            return done(null, false, { message: 'Incorrect username or password.' });
        }
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return done(null, false, { message: 'Incorrect username or password.' });
        }
        if (user.status !== 'active') {
             return done(null, false, { message: 'Account is disabled.' });
        }
        console.log(`[v6 Auth] User logged in: ${user.username}`);
        return done(null, user);
    } catch (error) {
        return done(error);
    }
}));

// 策略 3：JWT 驗證 (jwt) (不變)
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


// --- 輔助函數 (★★★ v7 保留 ★★★) ---
// (這個是生成*邀請碼*，KMS Service 負責*錢包地址*)
async function generateUniqueInviteCode() {
    let inviteCode;
    let isUnique = false;
    do {
        inviteCode = nanoid();
        const existing = await db.query('SELECT 1 FROM users WHERE invite_code = $1', [inviteCode]);
        if (existing.rows.length === 0) isUnique = true;
    } while (!isUnique);
    return inviteCode;
}

// --- 代理設定 (不變) ---
const adminUiProxy = createProxyMiddleware({
    target: 'http://admin-ui:80', 
    changeOrigin: true,
    pathRewrite: { '^/admin': '' }, 
});

// --- 路由順序 (不變) ---
app.use('/api/admin', adminIpWhitelistMiddleware, adminRoutes);
app.use('/admin', adminIpWhitelistMiddleware, adminUiProxy);

const v1Router = express.Router();
v1ApiRouter(v1Router, passport); // (★★★ 傳入 passport ★★★)
const frontendPath = path.join(__dirname, 'v1_frontend');
v1Router.use(express.static(frontendPath));
v1Router.get(/^(?!\/api\/).*$/, (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found.' });
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
});
app.use('/', v1Router);

// --- Socket.IO ---
let connectedUsers = {}; // (★★★ 保持這個 Map ★★★)
io.use(async (socket, next) => {
    // ... (socket.io auth 邏輯不變) ...
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error: No token'));
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const result = await db.query('SELECT user_id, status FROM users WHERE id = $1', [decoded.id]);
        const user = result.rows[0];
        if (!user || user.status !== 'active') {
             return next(new Error('Authentication error: User not found or disabled.'));
        }
        socket.user_id = user.user_id; 
        next();
    } catch (err) {
        return next(new Error('Authentication error: Invalid token'));
    }
});
io.on('connection', (socket) => { 
    const userId = socket.user_id;
    console.log(`[Socket.io] User connected: ${userId} (Socket: ${socket.id})`);
    connectedUsers[userId] = socket.id; // (★★★ 關鍵：儲存 socket id ★★★)
    socket.on('disconnect', () => {
        console.log(`[Socket.io] User disconnected: ${userId} (Socket: ${socket.id})`);
        if (connectedUsers[userId] === socket.id) {
            delete connectedUsers[userId]; // (★★★ 關鍵：移除 socket id ★★★)
        }
    });
});

// --- v1 API 路由定義函數 (不變) ---
function v1ApiRouter(router, passport) {
    
    // ( /api/v1/register )
    router.post('/api/v1/register', (req, res, next) => {
        passport.authenticate('local-signup', { session: false }, (err, user, info) => {
            if (err) return next(err);
            if (!user) return res.status(400).json({ error: info.message || 'Registration failed.' });
            const payload = { id: user.id, username: user.username };
            const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
            delete user.password_hash;
            res.status(201).json({ user, token });
        })(req, res, next);
    });

    // ( /api/v1/login )
    router.post('/api/v1/login', (req, res, next) => {
        passport.authenticate('local-login', { session: false }, (err, user, info) => {
            if (err) return next(err);
            if (!user) return res.status(401).json({ error: info.message || 'Login failed.' });
            const payload = { id: user.id, username: user.username };
            const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
            delete user.password_hash;
            res.status(200).json({ user, token });
        })(req, res, next);
    });

    // ( /api/v1/me )
    router.get('/api/v1/me', passport.authenticate('jwt', { session: false }), (req, res) => {
        res.status(200).json(req.user);
    });

    // ( /api/v1/history )
    router.get('/api/v1/history', passport.authenticate('jwt', { session: false }), async (req, res) => {
        try {
            const historyResult = await db.query('SELECT * FROM bets WHERE user_id = $1 ORDER BY bet_time DESC', [req.user.user_id]); 
            res.status(200).json(historyResult.rows); 
        } catch (error) {
            console.error('Error fetching history:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // ( /api/v1/bets 佔位符 )
    router.post('/api/v1/bets', passport.authenticate('jwt', { session: false }), async (req, res) => {
        const { choice, amount } = req.body;
        const user = req.user; // (來自 passport.authenticate)

        // 1. 基本驗證
        if (choice !== 'head' && choice !== 'tail') {
            return res.status(400).json({ error: 'Invalid choice.' });
        }
        const betAmount = parseFloat(amount);
        if (isNaN(betAmount) || betAmount <= 0) {
             return res.status(400).json({ error: 'Invalid bet amount.' });
        }
        // (v7.1 待辦：可在此處加入最小/最大投注額驗證)

        if (!betQueueService) {
             return res.status(503).json({ error: 'Betting service is not ready.' });
        }
        
        try {
            // 2. (★★★ 關鍵：加入隊列並等待結算 ★★★)
            const settledBet = await betQueueService.addBetToQueue(user, choice, betAmount);
            // 3. 返回結算結果
            res.status(200).json(settledBet);
            
        } catch (error) {
            // (BetQueueService 內部已處理退款)
            console.error(`[v7 API] Bet failed for user ${user.user_id}:`, error.message);
            // (返回由 BetQueueService reject 的錯誤)
            res.status(400).json({ error: error.message || 'Bet processing failed.' });
        }
    });


    // ( /api/v1/leaderboard )
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
            res.status(500).json({ error: 'Internal server error fetching leaderboard' });
        }
    });
}

// (★★★ 載入系統設定 ★★★)
async function loadSettings() {
    try {
        console.log("[v7 Settings] Loading system settings...");
        const result = await db.query('SELECT key, value FROM system_settings');
        settingsCache = result.rows.reduce((acc, row) => {
            acc[row.key] = { value: row.value };
            return acc;
        }, {});
        console.log(`[v7 Settings] Loaded ${Object.keys(settingsCache).length} settings.`);
    } catch (error) {
         console.error("[v7 Settings] CRITICAL: Failed to load system settings:", error);
    }
}


// --- 啟動伺服器 ---
httpServer.listen(PORT, async () => { 
    console.log(`Server (with Socket.io) is listening on port ${PORT}`);

    // (★★★ M5 新增：先載入設定 ★★★)
    await loadSettings();
    // (未來可加入 loadUserLevels() )

    // (★★★ M5 新增：在獲取 io 和 settings 後，才初始化 BetQueue ★★★)
    betQueueService = getBetQueueInstance(
        io, 
        connectedUsers, 
        gameOpenerService, 
        settingsCache
    );

    // (M2/M3：啟動 TRON 服務)
    try {
        const tronListener = new TronListener(io, connectedUsers);
        tronListener.start();
    } catch (listenerError) { /* ... */ }
    
    if (tronCollectionService) {
        console.log(`[v7 Collect] Starting collection service timer (Interval: 10 minutes)`);
        tronCollectionService.collectFunds().catch(err => console.error("[v7 Collect] Initial run failed:", err));
        setInterval(() => {
            tronCollectionService.collectFunds().catch(err => console.error("[v7 Collect] Timed run failed:", err));
        }, 10 * 60 * 1000); 
    }
});