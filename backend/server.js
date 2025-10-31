// backend/server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const db = require('./db'); //
const http = require('http');
const { Server } = require('socket.io');
const path = require('path'); // (★★★ v2 IP 阻擋 新增 ★★★)
const adminRoutes = require('./routes/admin'); //
const ipBlockerMiddleware = require('./middleware/ipBlockerMiddleware');
const adminIpWhitelistMiddleware = require('./middleware/adminIpWhitelistMiddleware');
const { createProxyMiddleware } = require('http-proxy-middleware');

// --- 全局變數 ---
let userLevelsCache = {}; //
let rewardWallet = null; //
let settingsCache = {}; //
module.exports.getSettingsCache = () => { return settingsCache; }; //

const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL); //
module.exports.provider = provider;
const gameWallet = new ethers.Wallet(process.env.GAME_WALLET_PRIVATE_KEY, provider); //

// --- Express 實例 ---
const app = express();
const PORT = 3000;
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: "*", methods: ["GET", "POST"] } }); //

console.log(`✅ Game wallet address: ${gameWallet.address}`); //
// (★★★ 注意：server.js 檔案 中沒有初始化 rewardWallet 的程式碼，我們在 listen 處補上 ★★★)
console.log(`✅ Connected to blockchain via: ${process.env.SEPOLIA_RPC_URL}`); //

// --- 中間件設定 ---
app.use(cors());
app.use(express.json()); //
app.set('trust proxy', 'loopback'); // (★★★ v2 IP 阻擋 新增 ★★★)

// (★★★ 路由 1: v2 後台 API ★★★)
// (應用 IP 白名單中間件)
app.use('/api/admin', adminIpWhitelistMiddleware, adminRoutes);

// (★★★ 路由 2: v2 後台頁面 (代理) ★★★)
// (應用 IP 白名單中間件)
app.use('/admin', adminIpWhitelistMiddleware, createProxyMiddleware({ 
    target: 'http://admin-ui:80', //
    changeOrigin: true,
    pathRewrite: { '^/admin': '' }, // (重寫路徑，移除 /admin)
}));

// (★★★ 路由 3: v1 dApp (網站 + API) ★★★)
const v1Router = express.Router();
v1Router.use(ipBlockerMiddleware); // (應用 v1 地區阻擋)
v1ApiRouter(v1Router); // (掛載 v1 API 路由)
// (掛載 v1 靜態檔案)
const frontendPath = path.join(__dirname, 'v1_frontend'); // (指向 docker-compose 掛載的路徑)
v1Router.use(express.static(frontendPath));
// (v1 SPA 回退)
v1Router.get(/^(?!\/api\/).*$/, (req, res) => { // (Turn 74 修正後的 Regex)
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found.' });
    }
    // (★★★ 修正：確保回退路徑正確 ★★★)
    res.sendFile(path.join(frontendPath, 'index.html')); //
});
app.use('/', v1Router);

// ---------------------------------
// --- Socket.IO (來自您的 server.js) ---
// ---------------------------------
let connectedUsers = {}; //
io.on('connection', (socket) => { //
    console.log(`[Socket.io] User connected: ${socket.id}`);
    socket.on('register', (walletAddress) => {
        if (walletAddress) {
            const lowerAddr = walletAddress.toLowerCase();
            console.log(`[Socket.io] Registering wallet ${lowerAddr} to socket ${socket.id}`);
            connectedUsers[lowerAddr] = socket.id;
        }
    });
    socket.on('disconnect', () => {
        console.log(`[Socket.io] User disconnected: ${socket.id}`);
        for (let address in connectedUsers) {
            if (connectedUsers[address] === socket.id) {
                delete connectedUsers[address];
                break;
            }
        }
    });
});

// ---------------------------------
// --- v1 API 路由定義函數 (★★★ 新增函數 ★★★) ---
// ---------------------------------
function v1ApiRouter(router) {
    
    // --- /api/register (來自您的 server.js) ---
    router.post('/api/register', async (req, res) => {
        const walletAddress = req.body.walletAddress;
        if (!walletAddress) return res.status(400).json({ error: 'Wallet address is required' });
        const lowerAddress = walletAddress.toLowerCase();
        try {
            let result = await db.query('SELECT * FROM users WHERE LOWER(wallet_address) = $1', [lowerAddress]); //
            if (result.rows.length === 0) {
                let newUserId, isUnique = false;
                do {
                    newUserId = Math.floor(10000000 + Math.random() * 90000000).toString();
                    const existingUser = await db.query('SELECT user_id FROM users WHERE user_id = $1', [newUserId]);
                    if (existingUser.rows.length === 0) isUnique = true;
                } while (!isUnique);
                const newUserResult = await db.query('INSERT INTO users (wallet_address, user_id) VALUES ($1, $2) RETURNING *', [lowerAddress, newUserId]); //
                result = newUserResult;
            }
            console.log(`[API Register] User ${result.rows[0].user_id} logged in. Status: ${result.rows[0].status}`);
            res.status(200).json(result.rows[0]); 
        } catch (error) {
            console.error('Error during registration:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // --- /api/users/nickname (來自您的 server.js) ---
    router.patch('/api/users/nickname', async (req, res) => {
        const { walletAddress, nickname } = req.body;
        const lowerAddress = walletAddress ? walletAddress.toLowerCase() : null;
        if (!lowerAddress || nickname === undefined) return res.status(400).json({ error: 'Wallet address and nickname are required.' });
        if (nickname.length > 50) return res.status(400).json({ error: 'Nickname is too long.' });
        try {
            const result = await db.query('UPDATE users SET nickname = $1 WHERE LOWER(wallet_address) = $2 RETURNING id, nickname', [nickname, lowerAddress]); //
            if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
            console.log(`[API Nickname] User ${result.rows[0].id} updated nickname to '${nickname}'`);
            res.status(200).json(result.rows[0]);
        } catch (error) {
            console.error('Error updating nickname:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // --- /api/bets (來自您的 server.js) ---
    router.post('/api/bets', async (req, res) => {
        const { choice, amount, txHash } = req.body;
        const walletAddress = req.body.walletAddress;
        const lowerAddress = walletAddress.toLowerCase();
        const betAmount = parseFloat(amount);
        if (!lowerAddress || !choice || isNaN(betAmount) || betAmount <= 0 || !txHash) { return res.status(400).json({ error: 'Missing or invalid required fields' }); }
        try {
            const userResult = await db.query('SELECT user_id, status, level FROM users WHERE LOWER(wallet_address) = $1', [lowerAddress]); //
            if (userResult.rows.length === 0) { return res.status(404).json({ error: 'User not found' }); } //
            const { user_id, status, level } = userResult.rows[0];
            if (status === 'banned') { return res.status(403).json({ error: '无法投注，请联系客服确认' }); } //
            const currentLevelSettings = userLevelsCache[level];
            if (!currentLevelSettings) { console.error(`[API Bets] CRITICAL ERROR: Cannot find settings for user ${user_id}'s level ${level}! Allowing bet.`); }
            else {
                const maxBet = currentLevelSettings.max_bet_amount;
                if (betAmount > maxBet) { return res.status(403).json({ error: `投注金额超过等级 ${level} 的上限 (${maxBet} ETH)` }); }
            }
            const betResult = await db.query('INSERT INTO bets (user_id, choice, amount, status, tx_hash, game_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [user_id, choice, amount, 'pending', txHash, 'FlipCoin']); //
            const newBet = betResult.rows[0];
            res.status(201).json(newBet);
            processBet(newBet.id, txHash, lowerAddress, choice, amount); //
        } catch (error) {
            console.error('Error placing bet:', error);
            if (error.code === '23505') return res.status(409).json({ error: 'Transaction hash already exists.' }); //
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // --- /api/history/:walletAddress (來自您的 server.js) ---
    router.get('/api/history/:walletAddress', async (req, res) => {
        const walletAddress = req.params.walletAddress;
        const lowerAddress = walletAddress.toLowerCase();
        try {
            const userResult = await db.query('SELECT user_id FROM users WHERE LOWER(wallet_address) = $1', [lowerAddress]); //
            if (userResult.rows.length === 0) { return res.status(200).json([]); } //
            const { user_id } = userResult.rows[0];
            const historyResult = await db.query('SELECT * FROM bets WHERE user_id = $1 ORDER BY bet_time DESC', [user_id]); //
            res.status(200).json(historyResult.rows); //
        } catch (error) {
            console.error('Error fetching history:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // --- /api/leaderboard (來自您的 server.js) ---
    router.get('/api/leaderboard', async (req, res) => {
        try {
            const leaderboardResult = await db.query(`SELECT user_id, max_streak, LEFT(wallet_address, 6) || '...' || RIGHT(wallet_address, 4) AS display_address FROM users WHERE max_streak > 0 ORDER BY max_streak DESC LIMIT 10`); //
            res.status(200).json(leaderboardResult.rows); //
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            res.status(500).json({ error: 'Internal server error fetching leaderboard' });
        }
    });
}

// (★★★ v2 新增：從 DB 加載設定的函數 ★★★)
async function loadSettings() {
    console.log('[Settings] Loading settings from database...');
    try {
        const result = await db.query('SELECT key, value FROM system_settings');
        settingsCache = result.rows.reduce((acc, row) => {
            acc[row.key] = row.value;
            console.log(`[Settings] Loaded: ${row.key} = ${row.value}`);
            return acc;
        }, {});
        console.log('[Settings] Settings loaded successfully.');
    } catch (error) {
        console.error('[Settings] CRITICAL ERROR: Failed to load settings from database!', error);
        // (如果讀取失敗，使用預設值以避免崩潰)
        if (!settingsCache.PAYOUT_MULTIPLIER) {
             console.warn('[Settings] Using default PAYOUT_MULTIPLIER = 2');
             settingsCache.PAYOUT_MULTIPLIER = '2';
        }
    }
}

// (★★★ v2 Level Up 新增：從 DB 加載用戶等級設定的函數 ★★★)
async function loadUserLevels() {
    console.log('[UserLevels] Loading user level settings from database...');
    try {
        const result = await db.query('SELECT * FROM user_levels ORDER BY level ASC');
        userLevelsCache = result.rows.reduce((acc, row) => {
            // (將 numeric 欄位轉為數字方便後續使用)
            acc[row.level] = {
                ...row,
                max_bet_amount: parseFloat(row.max_bet_amount),
                required_bets_for_upgrade: parseInt(row.required_bets_for_upgrade),
                min_bet_amount_for_upgrade: parseFloat(row.min_bet_amount_for_upgrade),
                upgrade_reward_amount: parseFloat(row.upgrade_reward_amount),
            };
            console.log(`[UserLevels] Loaded Level ${row.level}:`, acc[row.level]);
            return acc;
        }, {});
        console.log('[UserLevels] User level settings loaded successfully.');
    } catch (error) {
        console.error('[UserLevels] CRITICAL ERROR: Failed to load user levels from database!', error);
        // (如果載入失敗，至少確保有一個 Level 1 的預設值)
        if (!userLevelsCache[1]) {
             console.warn('[UserLevels] Using default Level 1 settings.');
             userLevelsCache[1] = { level: 1, name: 'Default L1', max_bet_amount: 100, required_bets_for_upgrade: 0, min_bet_amount_for_upgrade: 0, upgrade_reward_amount: 0 };
        }
    }
}

// ★★★ 修正後的自動重試派獎函數 ★★★
async function retryPendingPayouts() {
    console.log(`[CronJob] Checking for pending payouts...`);
    
    let pendingBets = [];
    try {
        const result = await db.query("SELECT * FROM bets WHERE status = 'prize_pending'");
        pendingBets = result.rows;
    } catch (dbError) {
        console.error('[CronJob] Failed to fetch pending bets:', dbError);
        return;
    }

    if (pendingBets.length === 0) {
        console.log(`[CronJob] No pending payouts found.`);
        return;
    }

    console.log(`[CronJob] Found ${pendingBets.length} pending payouts. Attempting to process...`);

    let walletBalance;
    try {
        walletBalance = await provider.getBalance(gameWallet.address);
    } catch (balanceError) {
        console.error('[CronJob] Failed to get wallet balance:', balanceError);
        return;
    }

    // ★★★ Bug 修正：在這裡定義 requiredGas ★★★
    const requiredGas = ethers.parseEther('0.001'); // 預留 Gas

    for (const bet of pendingBets) {
        const multiplierValue = settingsCache.PAYOUT_MULTIPLIER || '2';
        console.log(`[RetryPayout DEBUG] Bet #${bet.id}: Raw multiplier from cache = '${multiplierValue}' (Type: ${typeof multiplierValue})`);
        const multiplier = BigInt(multiplierValue); 
        console.log(`[RetryPayout DEBUG] Bet #${bet.id}: Converted multiplier = ${multiplier}`);
        const prizeAmount = ethers.parseEther(bet.amount) * multiplier;
        
        if (walletBalance > (prizeAmount + requiredGas)) {
            let userWalletAddress = ''; // 先宣告
            try {
                console.log(`[CronJob] Retrying payout for Bet #${bet.id}...`);

                // 1. 查詢用戶錢包地址
                const user = await db.query('SELECT wallet_address FROM users WHERE user_id = $1', [bet.user_id]);
                if (!user.rows[0]) throw new Error(`User ${bet.user_id} not found for payout.`);
                userWalletAddress = user.rows[0].wallet_address;

                // 2. 這是唯一、正確的派獎交易
                const prizeTx = await gameWallet.sendTransaction({
                    to: userWalletAddress,
                    value: prizeAmount
                });

                const prizeTxHash = prizeTx.hash;
                console.log(`[CronJob] Payout for Bet #${bet.id} SUCCESS. Hash: ${prizeTxHash}`);

                // 3. 更新資料庫
                await db.query(
                    'UPDATE bets SET status = $1, prize_tx_hash = $2 WHERE id = $3',
                    ['won', prizeTxHash, bet.id]
                );

                // 4. 從總餘額中扣除 (用於本次迴圈的後續檢查)
                walletBalance -= (prizeAmount + requiredGas); // 估算扣除

                // 5. 推送 WS 通知 (現在可以被執行到了)
                const targetSocketId = connectedUsers[userWalletAddress.toLowerCase()];
                if (targetSocketId) {
                    // 推送 1：投注結果
                    const updatedBet = await db.query('SELECT * FROM bets WHERE id = $1', [bet.id]);
                    io.to(targetSocketId).emit('bet_updated', updatedBet.rows[0]);
                    
                    // 推送 2：用戶狀態 (補發時不需要更新連勝，只需推送最新狀態)
                    const updatedUser = await db.query('SELECT current_streak, max_streak FROM users WHERE wallet_address = $1', [userWalletAddress]);
                    io.to(targetSocketId).emit('stats_updated', updatedUser.rows[0]);
                }
                // ★★★ 總是嘗試廣播排行榜 (補發成功後也廣播) ★★★
                console.log(`[CronJob] Attempting to broadcast 'leaderboard_updated' after retrying Bet #${bet.id}`);
                try {
                    const leaderboardResult = await db.query(/* ... 查詢排行榜 ... */);
                    io.emit('leaderboard_updated', leaderboardResult.rows);
                    console.log(`[CronJob] Broadcast 'leaderboard_updated' successful.`);
                } catch (lbError) {
                    console.error('[CronJob][Error Broadcasting Leaderboard]', lbError);
                }
            } catch (payoutError) {
                console.error(`[CronJob] Payout for Bet #${bet.id} FAILED again:`, payoutError.message);
                // 失敗了，等待下一輪
            }
        } else {
            console.log(`[CronJob] Wallet balance insufficient for Bet #${bet.id} (needs approx ${ethers.formatEther(prizeAmount + requiredGas)} ETH). Skipping.`);
            break; // 餘額不足，直接跳出迴圈，等下一輪
        }
    }
}

// (★★★ v2 Level Up 新增：派發升級獎勵的函數 ★★★)
async function payoutLevelUpgradeReward(userId, rewardAmountEth, userWalletAddress) {
    if (!rewardWallet) {
        console.warn(`[Reward Payout] Reward wallet not initialized. Cannot pay ${rewardAmountEth} ETH to user ${userId}.`);
        return;
    }
    if (rewardAmountEth <= 0) {
        console.log(`[Reward Payout] Reward amount is 0 for user ${userId}. No payout needed.`);
        return;
    }

    try {
        const rewardAmountWei = ethers.parseEther(rewardAmountEth.toString());
        console.log(`[Reward Payout] Attempting to send ${rewardAmountEth} ETH reward to ${userWalletAddress} (User ID: ${userId})...`);

        // 檢查獎勵錢包餘額 (簡單檢查，未考慮 Gas)
        const balance = await provider.getBalance(rewardWallet.address);
        if (balance < rewardAmountWei) {
            console.error(`[Reward Payout] FAILED: Reward wallet insufficient funds. Needs ${rewardAmountEth} ETH, has ${ethers.formatEther(balance)} ETH.`);
            // (未來可加入通知機制)
            return;
        }

        // 發送交易
        const tx = await rewardWallet.sendTransaction({
            to: userWalletAddress,
            value: rewardAmountWei
        });

        console.log(`[Reward Payout] SUCCESS: Sent ${rewardAmountEth} ETH reward to user ${userId}. TxHash: ${tx.hash}`);
        // (未來可將此 txHash 記錄到新的 bonus_log 表中)

    } catch (error) {
        console.error(`[Reward Payout] FAILED for user ${userId} (${userWalletAddress}):`, error.message);
        // (未來可加入重試機制，類似 retryPendingPayouts)
    }
}

// --- 核心業務邏輯：處理投注驗證與派獎 (健壯版) ---
async function processBet(betId, txHash, userWalletAddress, userChoice, betAmountString) { // (改名 betAmountString)
    let finalStatus = 'failed'; 
    let prizeTxHash = null;     
    let user = null; // 用來儲存用戶 DB 資訊 { id, user_id, level, last_level_up_time, ... }
    const betAmount = parseFloat(betAmountString); // (轉為數字)

    try {
        // --- 1. 驗證交易 & 裁定勝負 ---
        console.log(`[Processing Bet #${betId}] Waiting for transaction ${txHash}...`);
        // (★★★ 確保這裡有您的驗證邏輯，例如 provider.waitForTransaction ★★★)
        const receipt = await provider.waitForTransaction(txHash); //
        if (!receipt || receipt.status !== 1) throw new Error('Transaction failed or was reverted.'); //
        
        console.log(`[Processing Bet #${betId}] Transaction confirmed...`); //
        const numericHash = receipt.hash.replace(/[^0-9]/g, ''); //
        const lastDigit = parseInt(numericHash.slice(-1)); //
        const result = lastDigit <= 4 ? 'head' : 'tail'; //
        // (★★★ 驗證邏輯結束 ★★★)
        
        finalStatus = (userChoice === result) ? 'won' : 'lost';
        console.log(`[Processing Bet #${betId}] Status determined: ${finalStatus}`); //

        // (★★★ v2 Level Up 新增：在處理前先獲取用戶完整資訊 ★★★)
        const userResult = await db.query('SELECT * FROM users WHERE LOWER(wallet_address) = $1', [userWalletAddress.toLowerCase()]);
        if (!userResult.rows[0]) throw new Error(`User ${userWalletAddress} not found during bet processing.`);
        user = userResult.rows[0]; 

    } catch (error) {
        console.error(`[Error Processing Bet #${betId} - STEP 1: VERIFY]`, error.message);
        finalStatus = 'failed';
        // (如果驗證失敗，也需要更新 DB，但不觸發升級)
        try { await db.query('UPDATE bets SET status = $1, settle_time = NOW() WHERE id = $2', [finalStatus, betId]); } 
        catch (dbError) { console.error(`[DB Error Bet #${betId} - STEP 1 FAILED UPDATE]`, dbError); }
        // (★★★ 重要：驗證失敗直接返回，不執行後續 ★★★)
        return; 
    }

    // --- 2. 更新連勝紀錄 --- (邏輯與您的版本 基本一致)
    let newStreak = 0;
    let newMaxStreak = 0;
    if (finalStatus === 'won' || finalStatus === 'lost') {
        try {
            let currentStreak = user.current_streak; //
            newMaxStreak = user.max_streak; //
            newStreak = (finalStatus === 'won') ? (currentStreak > 0 ? currentStreak + 1 : 1) : (currentStreak < 0 ? currentStreak - 1 : -1); //
            if (newStreak > newMaxStreak) { newMaxStreak = newStreak; } //
            await db.query('UPDATE users SET current_streak = $1, max_streak = $2 WHERE id = $3', [newStreak, newMaxStreak, user.id]); //
            console.log(`[Processing Bet #${betId}] User ${user.user_id} streak updated: ${newStreak} (Max: ${newMaxStreak})`); //
        } catch (streakError) { console.error(`[Error Processing Bet #${betId} - STEP 2: STREAK UPDATE]`, streakError); }
    }

    // --- 3. 如果中獎，嘗試派獎 --- (使用快取倍數，加入 Debug Log)
    if (finalStatus === 'won') {
        try {
            const multiplierValue = settingsCache.PAYOUT_MULTIPLIER || '2'; //
            console.log(`[ProcessBet DEBUG] Bet #${betId}: Raw multiplier from cache = '${multiplierValue}' (Type: ${typeof multiplierValue})`); //
            const multiplier = BigInt(multiplierValue);
            console.log(`[ProcessBet DEBUG] Bet #${betId}: Converted multiplier = ${multiplier}`); //
            const prizeAmount = ethers.parseEther(betAmountString) * multiplier; // (使用字串)
            console.log(`[Processing Bet #${betId} - STEP 3: PAYOUT] Sending prize (${ethers.formatEther(prizeAmount)} ETH)...`); // (修改日誌步驟編號)
            const prizeTx = await gameWallet.sendTransaction({ to: userWalletAddress, value: prizeAmount }); //
            prizeTxHash = prizeTx.hash; //
            console.log(`[Processing Bet #${betId} - STEP 3: PAYOUT] Prize transaction sent! Hash: ${prizeTxHash}`); // (修改日誌步驟編號)
        } catch (payoutError) {
            console.error(`[Error Processing Bet #${betId} - STEP 3: PAYOUT FAILED]`, payoutError); // (修改日誌步驟編號)
            finalStatus = 'prize_pending'; 
        }
    }

    // --- 4. 將投注結果更新到資料庫 --- (與您的版本 一致)
    try {
        await db.query(
            'UPDATE bets SET status = $1, settle_time = NOW(), prize_tx_hash = $2 WHERE id = $3',
            [finalStatus, prizeTxHash, betId]
        ); //
        console.log(`[Processing Bet #${betId}] Bet status updated to ${finalStatus} in DB.`);
    } catch (dbError) { console.error(`[Error Processing Bet #${betId} - STEP 4: DB UPDATE]`, dbError); }

    // --- 5. (★★★ v2 Level Up 核心：檢查升級條件 ★★★) ---
    if (user && (finalStatus === 'won' || finalStatus === 'lost')) { 
        const currentLevel = user.level;
        const currentLevelSettings = userLevelsCache[currentLevel];
        const nextLevelSettings = userLevelsCache[currentLevel + 1];

        if (!currentLevelSettings || currentLevelSettings.required_bets_for_upgrade <= 0 || !nextLevelSettings) {
             console.log(`[Level Up Check Bet #${betId}] User ${user.user_id} is already at max level (${currentLevel}) or settings incomplete.`);
        } else {
            const minBetForUpgrade = currentLevelSettings.min_bet_amount_for_upgrade;
            if (betAmount < minBetForUpgrade) {
                 console.log(`[Level Up Check Bet #${betId}] User ${user.user_id} bet amount ${betAmount} < min required ${minBetForUpgrade}. Bet not counted for upgrade.`);
            } else {
                 console.log(`[Level Up Check Bet #${betId}] User ${user.user_id} bet amount ${betAmount} >= min required ${minBetForUpgrade}. Checking total eligible bets...`);
                 try {
                     const eligibleBetsCountResult = await db.query(
                         `SELECT COUNT(*) FROM bets 
                          WHERE user_id = $1 
                          AND status IN ('won', 'lost', 'prize_pending') 
                          AND amount >= $2 
                          AND bet_time > $3`,
                         [user.user_id, minBetForUpgrade, user.last_level_up_time] 
                     );
                     const eligibleBetsCount = parseInt(eligibleBetsCountResult.rows[0].count, 10);
                     const requiredBets = currentLevelSettings.required_bets_for_upgrade;
                     console.log(`[Level Up Check Bet #${betId}] User ${user.user_id} has ${eligibleBetsCount} eligible bets since last level up (requires ${requiredBets}).`);

                     if (eligibleBetsCount >= requiredBets) {
                         const nextLevel = currentLevel + 1;
                         const rewardAmount = nextLevelSettings.upgrade_reward_amount; 
                         console.log(`[Level Up!] User ${user.user_id} is upgrading from ${currentLevel} to ${nextLevel}! Reward: ${rewardAmount} ETH.`);
                         
                         await db.query(
                             'UPDATE users SET level = $1, last_level_up_time = NOW() WHERE id = $2',
                             [nextLevel, user.id]
                         );
                         user.level = nextLevel; 

                         payoutLevelUpgradeReward(user.user_id, rewardAmount, userWalletAddress);

                     }
                 } catch (countError) {
                     console.error(`[Error Level Up Check Bet #${betId}] Failed to count eligible bets for user ${user.user_id}:`, countError);
                 }
            }
        }
    }

    // --- 6. 推送 Socket 事件 --- (加入 user_info_updated)
    const targetSocketId = connectedUsers[userWalletAddress.toLowerCase()]; //
    if (targetSocketId) {
        // (推送 bet_updated [包含 prizeAmountEth])
        try { 
            const updatedBetResult = await db.query('SELECT * FROM bets WHERE id = $1', [betId]); //
            if (updatedBetResult.rows.length > 0) {
                const updatedBetData = updatedBetResult.rows[0];
                if (updatedBetData.status === 'won' || updatedBetData.status === 'prize_pending') {
                     const multiplierValue = settingsCache.PAYOUT_MULTIPLIER || '2'; //
                     const multiplier = BigInt(multiplierValue);
                     const prizeAmountWei = ethers.parseEther(betAmountString) * multiplier; // (使用字串)
                     updatedBetData.prizeAmountEth = ethers.formatEther(prizeAmountWei); 
                     console.log(`[Socket.io DEBUG] Attaching prizeAmountEth: ${updatedBetData.prizeAmountEth}`);
                }
                io.to(targetSocketId).emit('bet_updated', updatedBetData); //
            }
        } catch(e){ console.error('[Socket.io Error] Failed to push bet_updated:', e); }

        // (推送 stats_updated)
        try { 
            // (我們已經有 newStreak, newMaxStreak, 無需再查 DB)
            console.log(`[Socket.io] Pushing 'stats_updated' to wallet ${userWalletAddress.toLowerCase()}`); //
            io.to(targetSocketId).emit('stats_updated', { //
                current_streak: newStreak, //
                max_streak: newMaxStreak //
            });
        } catch(e){ console.error('[Socket.io Error] Failed to push stats_updated:', e); }

        // (★★★ v2 Level Up 新增：推送用戶等級更新 ★★★)
        try {
            // (我們已經有 user 物件，包含更新後的 level)
            const userInfoToSend = {
                user_id: user.user_id,
                nickname: user.nickname,
                level: user.level,
                current_streak: newStreak, // (使用計算出的最新值)
                max_streak: newMaxStreak,  // (使用計算出的最新值)
                status: user.status
            };
            console.log(`[Socket.io] Pushing 'user_info_updated' to wallet ${userWalletAddress.toLowerCase()}`);
            io.to(targetSocketId).emit('user_info_updated', userInfoToSend);
        } catch(e){ console.error('[Socket.io Error] Failed to push user_info_updated:', e); }
    }
    
    // --- 7. 廣播排行榜 --- (與您的版本 一致)
    console.log(`[Socket.io] Attempting to broadcast 'leaderboard_updated' after Bet #${betId}`); //
    try {
        const leaderboardResult = await db.query( /* ... 您的排行榜查詢 SQL ... */ ); //
        io.emit('leaderboard_updated', leaderboardResult.rows); //
        console.log(`[Socket.io] Broadcast 'leaderboard_updated' successful.`); //
    } catch (lbError) {
        console.error('[Error Broadcasting Leaderboard]', lbError); //
    }
}


// --- 啟動伺服器 (加入定時任務) ---
httpServer.listen(PORT, async () => { 
    console.log(`Server (with Socket.io) is listening on port ${PORT}`);
    
    await loadSettings(); //
    await loadUserLevels(); //

    if (process.env.REWARD_WALLET_PRIVATE_KEY) { //
        try {
            rewardWallet = new ethers.Wallet(process.env.REWARD_WALLET_PRIVATE_KEY, provider); //
            console.log(`✅ Reward wallet address: ${rewardWallet.address}`); //
        } catch (walletError) {
             console.error('❌ CRITICAL ERROR: Failed to initialize reward wallet!', walletError.message); //
        }
    } else {
         console.warn('⚠️ WARNING: REWARD_WALLET_PRIVATE_KEY not set. Level up rewards will not be paid.'); //
    }
    
    setInterval(retryPendingPayouts, 60000); //
});