// 檔案: backend/server.js (★★★ v8.9 修正版 ★★★)



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
const jwt = require('jsonwebtoken');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');

// (★★★ 1. 導入 KmsService ★★★)
const { getKmsInstance } = require('./services/KmsService.js');
const TronListener = require('./services/TronListener.js');
const { getTronCollectionInstance } = require('./services/TronCollectionService.js');
const { getGameOpenerInstance } = require('./services/GameOpenerService.js');
const { getBetQueueInstance } = require('./services/BetQueueService.js');
// (★★★ v8.9 修正：導入新的快取模組 ★★★)
const settingsCacheModule = require('./services/settingsCache.js');



// --- 全局變數 ---
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);
// (★★★ v8.9 移除：舊的快取)
// let userLevelsCache = {};
// let settingsCache = {};
// module.exports.getSettingsCache = () => { return settingsCache; }; // (移除)

// (★★★ 立即初始化 KmsService ★★★)
let kmsService;
try {
    kmsService = getKmsInstance(); 
} catch (error) {
    console.error("CRITICAL KMS ERROR: FAILED TO INITIALIZE.", error.message);
    console.error("Ensure MASTER_MNEMONIC is set in .env file.");
    process.exit(1); 
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

console.log(`✅ [v6] 中心化服務啟動...`);
// (★★★ v8.9 修正：移除 misleading log ★★★)
// console.log(`✅ 連接到區塊鏈 (用於開獎): ${process.env.SEPOLIA_RPC_URL}`);

// --- 中間件設定 ---
app.use(cors());
app.use(express.json());
app.set('trust proxy', true);
app.use(passport.initialize());

// --- Passport.js 策略設定  ---
// 策略 1：本地註冊 (local-signup)
passport.use('local-signup', new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password',
    passReqToCallback: true 
}, async (req, username, password, done) => {
    
    const client = await db.pool.connect(); 
    
    try {
        await client.query('BEGIN');
        await client.query('LOCK TABLE users IN EXCLUSIVE MODE');

        // 1. 檢查用戶名 (使用 client)
        const existingUser = await client.query('SELECT 1 FROM users WHERE username = $1', [username]);
        if (existingUser.rows.length > 0) {
            await client.query('ROLLBACK'); // (回滾事務)
            client.release();
            return done(null, false, { message: 'Username already taken.' });
        }
        
        // 2. 密碼加密 (DB 無關)
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        
        // 3. v7 核心修改：從 KMS 獲取新地址和索引 (使用 client)
        const { 
            deposit_path_index, 
            evm_deposit_address, 
            tron_deposit_address 
        } = await kmsService.getNewDepositWallets(client); // (傳入 client)

        // 4. 生成唯一 user_id (v6 邏輯) (使用 client)
        let newUserId, isUserIdUnique = false;
        do {
            newUserId = Math.floor(10000000 + Math.random() * 90000000).toString();
            const existingId = await client.query('SELECT 1 FROM users WHERE user_id = $1', [newUserId]); 
            if (existingId.rows.length === 0) isUserIdUnique = true;
        } while (!isUserIdUnique);
        
        // 4. v7 核心修改：生成 invite_code (保留 v6 邏輯) (使用 client)
        const newInviteCode = await generateUniqueInviteCode(client); // (傳入 client)

        // 5. 獲取 IP (DB 無關)
        const clientIp = req.headers['x-real-ip'] || req.ip;

        // 6. 插入新用戶 (使用 client)
        const newUserResult = await client.query(
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
        
        await client.query('COMMIT'); 
        
        const newUser = newUserResult.rows[0];
        console.log(`[v7 Auth] New user registered: ${username} (User ID: ${newUserId}, Path: ${deposit_path_index})`);

        // (M3 關鍵：觸發地址激活)
        if (tron_deposit_address && tronCollectionService) {
            tronCollectionService.activateAddress(tron_deposit_address)
                .catch(err => console.error(`[v7 Activate] Async activation failed for ${tron_deposit_address}:`, err.message));
        }

        return done(null, newUser);

    } catch (error) {
        console.error("[v7 signup] Transaction Error:", error);
        await client.query('ROLLBACK'); 
        return done(error); // (這將導致 500 錯誤)
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

// --- 輔助函數 ---
async function generateUniqueInviteCode(client) { // (★★★ 接收 client ★★★)
    let inviteCode;
    let isUnique = false;
    do {
        inviteCode = nanoid();
        // (★★★ 使用 client 查詢 ★★★)
        const existing = await client.query('SELECT 1 FROM users WHERE invite_code = $1', [inviteCode]);
        if (existing.rows.length === 0) isUnique = true;
    } while (!isUnique);
    return inviteCode;
}

// --- 代理設定 ---
const adminUiProxy = createProxyMiddleware({
    target: 'http://admin-ui:80', 
    changeOrigin: true,
    pathRewrite: { '^/admin': '' }, 
});

// --- 路由順序 ---
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

// --- v1 API 路由定義函數 ---
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

    // (★★★ PATCH /api/v1/users/nickname ★★★)
    router.patch('/api/v1/users/nickname', passport.authenticate('jwt', { session: false }), async (req, res) => {
        const { nickname } = req.body;
        const userId = req.user.id; // (來自 JWT)

        if (!nickname || nickname.trim().length === 0) {
            return res.status(400).json({ error: 'Nickname cannot be empty.' });
        }
        if (nickname.length > 50) {
            return res.status(400).json({ error: 'Nickname is too long (max 50 chars).' });
        }

        try {
            const result = await db.query(
                'UPDATE users SET nickname = $1 WHERE id = $2 RETURNING *',
                [nickname.trim(), userId]
            );
            
            const updatedUser = result.rows[0];
            delete updatedUser.password_hash;
            console.log(`[v7 API] User ${updatedUser.user_id} updated nickname to: ${updatedUser.nickname}`);
            res.status(200).json(updatedUser);

        } catch (error) {
            console.error(`[v7 API] Error updating nickname for user ${userId}:`, error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // (★★★ POST /api/v1/users/bind-referrer ★★★)
    router.post('/api/v1/users/bind-referrer', passport.authenticate('jwt', { session: false }), async (req, res) => {
        const { referrer_code } = req.body;
        const user = req.user; // (來自 JWT)

        if (!referrer_code || referrer_code.trim().length === 0) {
            return res.status(400).json({ error: 'Referrer code cannot be empty.' });
        }
        
        // (開始事務)
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            
            // 1. 再次檢查用戶是否已被綁定 (防止重複請求)
            // (我們需要從 DB 獲取最新的 user record 並鎖定它)
            const userCheckResult = await client.query(
                'SELECT referrer_code, invite_code FROM users WHERE id = $1 FOR UPDATE', 
                [user.id]
            );
            const currentUserData = userCheckResult.rows[0];

            if (currentUserData.referrer_code) {
                await client.query('ROLLBACK');
                client.release();
                return res.status(400).json({ error: 'Account already has a referrer.' });
            }
            
            // 2. 檢查是否綁定自己
            if (currentUserData.invite_code === referrer_code) {
                await client.query('ROLLBACK');
                client.release();
                return res.status(400).json({ error: 'Cannot set referrer code to own invite code.' });
            }

            // 3. 檢查推薦人是否存在
            const referrerExists = await client.query('SELECT 1 FROM users WHERE invite_code = $1', [referrer_code]);
            if (referrerExists.rows.length === 0) {
                await client.query('ROLLBACK');
                client.release();
                return res.status(400).json({ error: 'Invaerrer code. Code does not exist.' });
            }
            
            // 4. 更新用戶的 referrer_code
            const updateResult = await client.query(
                'UPDATE users SET referrer_code = $1 WHERE id = $2 RETURNING *',
                [referrer_code, user.id]
            );
            
            await client.query('COMMIT');
            
            const updatedUser = updateResult.rows[0];
            delete updatedUser.password_hash;
            console.log(`[v7 API] User ${updatedUser.user_id} bound referrer to: ${updatedUser.referrer_code}`);
            res.status(200).json(updatedUser);

        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`[v7 API] Error binding referrer for user ${user.id}:`, error);
            res.status(500).json({ error: 'Internal server error' });
        } finally {
            client.release();
        }
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
        
    /**
     * @description (新) 設置初始提款密碼
     * @body { login_password, new_password }
     */
    router.post('/api/v1/users/set-withdrawal-password', passport.authenticate('jwt', { session: false }), async (req, res) => {
        const { login_password, new_password } = req.body;
        const user = req.user;

        if (!login_password || !new_password || new_password.length < 6) {
            return res.status(400).json({ error: '登入密碼為必填，且新提款密碼長度至少 6 位' });
        }

        try {
            // 1. 重新驗證登入密碼
            const fullUser = await db.query('SELECT password_hash, has_withdrawal_password FROM users WHERE id = $1', [user.id]);
            if (fullUser.rows[0].has_withdrawal_password) {
                 return res.status(400).json({ error: '提款密碼已設置' });
            }
            
            const isMatch = await bcrypt.compare(login_password, fullUser.rows[0].password_hash);
            if (!isMatch) {
                return res.status(401).json({ error: '登入密碼錯誤' });
            }

            // 2. 設置提款密碼
            const salt = await bcrypt.genSalt(10);
            const withdrawal_hash = await bcrypt.hash(new_password, salt);
            
            await db.query(
                'UPDATE users SET withdrawal_password_hash = $1, has_withdrawal_password = true WHERE id = $2',
                [withdrawal_hash, user.id]
            );
            
            res.status(200).json({ message: '提款密碼設置成功' });
        } catch (error) {
            console.error(`[API v1] Error setting withdrawal pwd for ${user.user_id}:`, error);
            res.status(500).json({ error: '伺服器內部錯誤' });
        }
    });

    /**
     * @description (新) 修改提款密碼
     * @body { old_password, new_password }
     */
    router.patch('/api/v1/users/update-withdrawal-password', passport.authenticate('jwt', { session: false }), async (req, res) => {
        const { old_password, new_password } = req.body;
        const user = req.user;

        if (!old_password || !new_password || new_password.length < 6) {
            return res.status(400).json({ error: '舊密碼為必填，且新提款密碼長度至少 6 位' });
        }

        try {
            // 1. 驗證舊的提款密碼
            const fullUser = await db.query('SELECT withdrawal_password_hash FROM users WHERE id = $1', [user.id]);
            if (!fullUser.rows[0].withdrawal_password_hash) {
                 return res.status(400).json({ error: '尚未設置提款密碼' });
            }

            const isMatch = await bcrypt.compare(old_password, fullUser.rows[0].withdrawal_password_hash);
            if (!isMatch) {
                return res.status(401).json({ error: '舊提款密碼錯誤' });
            }

            // 2. 設置新密碼
            const salt = await bcrypt.genSalt(10);
            const withdrawal_hash = await bcrypt.hash(new_password, salt);
            
            await db.query(
                'UPDATE users SET withdrawal_password_hash = $1 WHERE id = $2',
                [withdrawal_hash, user.id]
            );
            
            res.status(200).json({ message: '提款密碼修改成功' });
        } catch (error) {
            console.error(`[API v1] Error updating withdrawal pwd for ${user.user_id}:`, error);
            res.status(500).json({ error: '伺服器內部錯誤' });
        }
    });
    
    /**
     * @description (新) 請求提款
     * @body { chain_type, address, amount, withdrawal_password }
     */
    router.post('/api/v1/users/request-withdrawal', passport.authenticate('jwt', { session: false }), async (req, res) => {
        const { chain_type, address, amount, withdrawal_password } = req.body;
        const user = req.user;
        const withdrawalAmount = parseFloat(amount);
        
        // (簡易驗證)
        if (!chain_type || !address || !withdrawalAmount || withdrawalAmount <= 0 || !withdrawal_password) {
             return res.status(400).json({ error: '所有欄位均為必填' });
        }
        // (您應在 .env 中定義最小提款金額)
        const MIN_WITHDRAWAL = parseFloat(process.env.MIN_WITHDRAWAL_AMOUNT || '10');
        if (withdrawalAmount < MIN_WITHDRAWAL) {
             return res.status(400).json({ error: `最小提款金額為 ${MIN_WITHDRAWAL} USDT` });
        }

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            
            // 1. 鎖定用戶並檢查所有條件
            const userResult = await client.query(
                'SELECT balance, withdrawal_password_hash, has_withdrawal_password FROM users WHERE id = $1 FOR UPDATE',
                [user.id]
            );
            const userData = userResult.rows[0];

            if (!userData.has_withdrawal_password) {
                throw new Error('尚未設置提款密碼');
            }
            if (parseFloat(userData.balance) < withdrawalAmount) {
                throw new Error('餘額不足');
            }
            
            const isPwdMatch = await bcrypt.compare(withdrawal_password, userData.withdrawal_password_hash);
            if (!isPwdMatch) {
                throw new Error('提款密碼錯誤');
            }

            // 2. 扣款
            const updatedUserResult = await client.query(
                'UPDATE users SET balance = balance - $1 WHERE id = $2 RETURNING *',
                [withdrawalAmount, user.id]
            );

            // 3. 創建提款單
            await client.query(
                `INSERT INTO withdrawals (user_id, chain_type, address, amount, status)
                 VALUES ($1, $2, $3, $4, 'pending')`,
                [user.user_id, chain_type, address, withdrawalAmount]
            );
            
            // 4. 創建資金流水 (重要！)
            await client.query(
                `INSERT INTO platform_transactions (user_id, type, chain, amount, status)
                 VALUES ($1, 'withdraw_request', $2, $3, 'pending')`,
                 [user.user_id, chain_type, -Math.abs(withdrawalAmount)] // 存為負數
            );

            await client.query('COMMIT');
            
            // 5. 通知前台
            delete updatedUserResult.rows[0].password_hash;
            delete updatedUserResult.rows[0].withdrawal_password_hash;
            io.to(connectedUsers[user.user_id]).emit('user_info_updated', updatedUserResult.rows[0]);

            res.status(201).json({ message: '提款請求已提交，待審核' });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`[API v1] Withdrawal request failed for ${user.user_id}:`, error);
            res.status(400).json({ error: error.message || '提款失敗' });
        } finally {
            client.release();
        }
    });
    
    /**
     * @description (新) 獲取用戶提款歷史
     */
    router.get('/api/v1/users/withdrawals', passport.authenticate('jwt', { session: false }), async (req, res) => {
        try {
            const history = await db.query(
                "SELECT chain_type, address, amount, status, rejection_reason, request_time, review_time, tx_hash FROM withdrawals WHERE user_id = $1 ORDER BY request_time DESC LIMIT 20",
                [req.user.user_id]
            );
            res.status(200).json(history.rows);
        } catch (error) {
            console.error(`[API v1] Error fetching withdrawal history for ${req.user.user_id}:`, error);
            res.status(500).json({ error: '伺服器內部錯誤' });
        }
    });
    
    /**
     * @description (新) 獲取用戶充值歷史
     */
    router.get('/api/v1/users/deposits', passport.authenticate('jwt', { session: false }), async (req, res) => {
        try {
            // (從 platform_transactions 查詢 'deposit' 類型的記錄)
            // (TronListener.js 寫入的 status 總是 'completed')
            const history = await db.query(
                `SELECT id, chain, amount, status, tx_hash, created_at 
                 FROM platform_transactions 
                 WHERE user_id = $1 AND type = 'deposit' 
                 ORDER BY created_at DESC 
                 LIMIT 20`,
                [req.user.user_id]
            );
            res.status(200).json(history.rows);
        } catch (error) {
            console.error(`[API v1] Error fetching deposit history for ${req.user.user_id}:`, error);
            res.status(500).json({ error: '伺服器內部錯誤' });
        }
    });
}

// --- 啟動伺服器 ---
httpServer.listen(PORT, async () => { 
    console.log(`Server (with Socket.io) is listening on port ${PORT}`);

    // (v8.9 修正：使用新模組)
    await settingsCacheModule.loadSettings();
    
    betQueueService = getBetQueueInstance(
        io, 
        connectedUsers, 
        gameOpenerService
    );

    // (TronListener 啟動延遲)
    // (給予服務 20 秒鐘的緩衝時間來等待 DB 和 Docker 網路完全就緒)
// (★★★ v8.12 修正：移除 20 秒延遲，讓 TronListener 自己重試 ★★★)
    try {
        const tronListener = new TronListener(io, connectedUsers);
        tronListener.start(); // (v8.11 版的 TronListener 內部會自動重試)
    } catch (listenerError) {
         console.error("[v7] Error initializing TronListener:", listenerError);
    }
    
    // (Collection Service 啟動邏輯不變)
    if (tronCollectionService) {
        console.log(`[v7 Collect] Starting collection service timer (Interval: 10 minutes)`);
        // (v8.11 修正：延遲 30 秒再開始第一次歸集，避免和 TronListener 衝突)
        setTimeout(() => {
            tronCollectionService.collectFunds().catch(err => console.error("[v7 Collect] Initial run failed:", err));
            setInterval(() => {
                tronCollectionService.collectFunds().catch(err => console.error("[v7 Collect] Timed run failed:", err));
            }, 10 * 60 * 1000); 
        }, 30000); // 延遲 30 秒
    }
});