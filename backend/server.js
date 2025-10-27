// backend/server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const db = require('./db');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = 3000;
// ★★★ 讀取派獎倍數 ★★★
const PAYOUT_MULTIPLIER = BigInt(process.env.PAYOUT_MULTIPLIER || 2); // 讀取並轉為 BigInt，預設為 2

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
const gameWallet = new ethers.Wallet(process.env.GAME_WALLET_PRIVATE_KEY, provider);

console.log(`✅ Game wallet address: ${gameWallet.address}`);
console.log(`✅ Connected to blockchain via: ${process.env.SEPOLIA_RPC_URL}`);

app.use(cors());
app.use(express.json());

let connectedUsers = {};
io.on('connection', (socket) => {
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
        // ★★★ 使用 PAYOUT_MULTIPLIER 計算獎金 ★★★
        const prizeAmount = ethers.parseEther(bet.amount) * PAYOUT_MULTIPLIER; 
        const requiredGas = ethers.parseEther('0.001'); 
        
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

// --- 核心業務邏輯：處理投注驗證與派獎 (健壯版) ---
async function processBet(betId, txHash, userWalletAddress, userChoice, betAmount) {
    let finalStatus = 'failed'; 
    let prizeTxHash = null;     
    let user = null; // 用來儲存用戶資訊

    try {
        // --- 1. 驗證下注交易並裁定勝負 ---
        console.log(`[Processing Bet #${betId}] Waiting for transaction ${txHash}...`);
        const receipt = await provider.waitForTransaction(txHash);
        if (!receipt || receipt.status !== 1) throw new Error('Transaction failed or was reverted.');
        
        console.log(`[Processing Bet #${betId}] Transaction confirmed...`);
        const numericHash = receipt.hash.replace(/[^0-9]/g, '');
        const lastDigit = parseInt(numericHash.slice(-1));
        const result = lastDigit <= 4 ? 'head' : 'tail';
        finalStatus = (userChoice === result) ? 'won' : 'lost';
        console.log(`[Processing Bet #${betId}] Status determined: ${finalStatus}`);

    } catch (error) {
        console.error(`[Error Processing Bet #${betId} - STEP 1: VERIFY]`, error.message);
        finalStatus = 'failed';
    }

    // --- 2. 更新連勝紀錄 (★★★ 新增邏輯 ★★★) ---
    // (無論輸贏，只要不是 failed，都要更新連勝)
    let newStreak = 0;
    let newMaxStreak = 0;

    if (finalStatus === 'won' || finalStatus === 'lost') {
        try {
            const userResult = await db.query('SELECT * FROM users WHERE LOWER(wallet_address) = $1', [userWalletAddress.toLowerCase()]);
            if (!userResult.rows[0]) throw new Error('User not found when updating streak.');
            user = userResult.rows[0];
            let currentStreak = user.current_streak;
            newMaxStreak = user.max_streak; // ★★★ 從 user 初始化 ★★★

            if (finalStatus === 'won') {
                newStreak = (currentStreak > 0) ? currentStreak + 1 : 1;
            } else { 
                newStreak = (currentStreak < 0) ? currentStreak - 1 : -1;
            }

            // 比較並更新 newMaxStreak
            if (newStreak > newMaxStreak) {
                newMaxStreak = newStreak;
                // leaderboardNeedsUpdate = true; // <-- 不再需要設定標記
            }

            await db.query(
                'UPDATE users SET current_streak = $1, max_streak = $2 WHERE id = $3',
                [newStreak, newMaxStreak, user.id]
            );
            console.log(`[Processing Bet #${betId}] User ${user.user_id} streak updated: ${newStreak} (Max: ${newMaxStreak})`);
        } catch (streakError) { console.error(`[Error Processing Bet #${betId} - STEP 1.5: STREAK UPDATE]`, streakError.message); }
    }

    // --- 3. 如果中獎，嘗試派獎 (不變) ---
    if (finalStatus === 'won') {
        try {
            // ★★★ 使用 PAYOUT_MULTIPLIER 計算獎金 ★★★
            const prizeAmount = ethers.parseEther(betAmount) * PAYOUT_MULTIPLIER; 
            
            console.log(`[Processing Bet #${betId} - STEP 2: PAYOUT] Sending prize (${ethers.formatEther(prizeAmount)} ETH)...`);
            const prizeTx = await gameWallet.sendTransaction({ to: userWalletAddress, value: prizeAmount });
            prizeTxHash = prizeTx.hash;
            console.log(`[Processing Bet #${betId} - STEP 2: PAYOUT] Prize transaction sent! Hash: ${prizeTxHash}`);
        
        } catch (payoutError) {
            console.error(`[Error Processing Bet #${betId} - STEP 2: PAYOUT FAILED]`, payoutError.message);
            finalStatus = 'prize_pending';
        }
    }

    // --- 4. 將投注結果更新到資料庫 (不變) ---
    try {
        await db.query(
            'UPDATE bets SET status = $1, settle_time = NOW(), prize_tx_hash = $2 WHERE id = $3',
            [finalStatus, prizeTxHash, betId]
        );
    } catch (dbError) { /* ... 程式碼不變 ... */ }

    // --- 5. 將最終結果推送給前端 (★★★ 確保包含 3 個部分 ★★★) ---
    const targetSocketId = connectedUsers[userWalletAddress.toLowerCase()];
    if (targetSocketId) {
        // ★★★ 推送 1：投注結果 (您的版本，包含 console.log) ★★★
        console.log(`[Socket.io] Pushing 'bet_updated' to wallet ${userWalletAddress.toLowerCase()}`);
        const updatedBet = await db.query('SELECT * FROM bets WHERE id = $1', [betId]);
        if (updatedBet.rows.length > 0) {
            io.to(targetSocketId).emit('bet_updated', updatedBet.rows[0]);
        }
        
        // ★★★ 推送 2：用戶狀態 (連勝) (補上) ★★★
        if (newStreak !== 0 || newMaxStreak !== 0) { // 只有在 streak 有變化時才推送
             console.log(`[Socket.io] Pushing 'stats_updated' to wallet ${userWalletAddress.toLowerCase()}`);
            io.to(targetSocketId).emit('stats_updated', {
                current_streak: newStreak,
                max_streak: newMaxStreak
            });
        }
    }
    
    // --- 6. ★★★ 總是嘗試廣播排行榜 ★★★ ---
    // (不再需要 if (leaderboardNeedsUpdate) 判斷)
    console.log(`[Socket.io] Attempting to broadcast 'leaderboard_updated' after Bet #${betId}`);
    try {
        const leaderboardResult = await db.query(
            `SELECT LEFT(wallet_address, 6) || '...' || RIGHT(wallet_address, 4) AS display_address, max_streak 
             FROM users WHERE max_streak > 0 ORDER BY max_streak DESC LIMIT 10`
        );
        // ★★★ 直接廣播 ★★★
        io.emit('leaderboard_updated', leaderboardResult.rows); 
        console.log(`[Socket.io] Broadcast 'leaderboard_updated' successful.`); // <-- 新增成功日誌
    } catch (lbError) {
        console.error('[Error Broadcasting Leaderboard]', lbError);
    }
}

app.get('/', (req, res) => res.send('Flip Coin API is running!'));

// --- API 路由 (register) (★★★ 更新：返回新欄位 ★★★) ---
app.post('/api/register', async (req, res) => {
    const walletAddress = req.body.walletAddress;
    if (!walletAddress) return res.status(400).json({ error: 'Wallet address is required' });
    const lowerAddress = walletAddress.toLowerCase();

    try {
        let result = await db.query('SELECT * FROM users WHERE LOWER(wallet_address) = $1', [lowerAddress]);
        
        if (result.rows.length === 0) {
            let newUserId, isUnique = false;
            do {
                newUserId = Math.floor(10000000 + Math.random() * 90000000).toString();
                const existingUser = await db.query('SELECT user_id FROM users WHERE user_id = $1', [newUserId]);
                if (existingUser.rows.length === 0) isUnique = true;
            } while (!isUnique);
            
            // ★★★ 插入新用戶時，欄位名稱要對齊 (current_streak 和 max_streak 會使用 DEFAULT 0) ★★★
            const newUserResult = await db.query('INSERT INTO users (wallet_address, user_id) VALUES ($1, $2) RETURNING *', [lowerAddress, newUserId]);
            result = newUserResult;
        }
        // ★★★ 返回的資料會自動包含 current_streak 和 max_streak ★★★
        res.status(200).json(result.rows[0]); 
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/bets', async (req, res) => {
    // ★★★ 獲取地址並轉為小寫 ★★★
    const { choice, amount, txHash } = req.body;
    const walletAddress = req.body.walletAddress;
    const lowerAddress = walletAddress.toLowerCase();

    if (!lowerAddress || !choice || !amount || !txHash) return res.status(400).json({ error: 'Missing required fields' });
    
    try {
        // ★★★ 使用 LOWER() 函數進行查詢 ★★★
        const userResult = await db.query('SELECT user_id FROM users WHERE LOWER(wallet_address) = $1', [lowerAddress]);
        if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        
        const { user_id } = userResult.rows[0];
        const betResult = await db.query('INSERT INTO bets (user_id, choice, amount, status, tx_hash) VALUES ($1, $2, $3, $4, $5) RETURNING *', [user_id, choice, amount, 'pending', txHash]);
        const newBet = betResult.rows[0];
        res.status(201).json(newBet);
        processBet(newBet.id, txHash, lowerAddress, choice, newBet.amount); // 傳遞小寫地址
    } catch (error) {
        console.error('Error placing bet:', error);
        if (error.code === '23505') return res.status(409).json({ error: 'Transaction hash already exists.' });
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/history/:walletAddress', async (req, res) => {
    // ★★★ 獲取地址並轉為小寫 ★★★
    const walletAddress = req.params.walletAddress;
    const lowerAddress = walletAddress.toLowerCase();

    try {
        // ★★★ 使用 LOWER() 函數進行查詢 ★★★
        const userResult = await db.query('SELECT user_id FROM users WHERE LOWER(wallet_address) = $1', [lowerAddress]);
        if (userResult.rows.length === 0) {
            // 即使是新註冊用戶，也應該能找到自己，如果找不到，返回空陣列是安全的
            return res.status(200).json([]); 
        }
        const { user_id } = userResult.rows[0];
        const historyResult = await db.query('SELECT * FROM bets WHERE user_id = $1 ORDER BY bet_time DESC', [user_id]);
        res.status(200).json(historyResult.rows);
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 獲取最高連勝排行榜
 * @route GET /api/leaderboard
 */
app.get('/api/leaderboard', async (req, res) => {
    try {
        // 查詢 users 資料表，按 max_streak 降序排列，取前 10 名
        const leaderboardResult = await db.query(
            `SELECT 
                user_id, 
                max_streak, 
                -- 為了隱私，只選擇錢包地址的前後部分
                LEFT(wallet_address, 6) || '...' || RIGHT(wallet_address, 4) AS display_address 
             FROM users 
             WHERE max_streak > 0 -- 只顯示有紀錄的玩家
             ORDER BY max_streak DESC 
             LIMIT 10`
        );

        res.status(200).json(leaderboardResult.rows);

    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Internal server error fetching leaderboard' });
    }
});

// --- 啟動伺服器 (加入定時任務) ---
httpServer.listen(PORT, () => {
    console.log(`Server (with Socket.io) is listening on port ${PORT}`);
    
    // ★★★ 啟動定時任務：每 60 秒檢查一次 ★★★
    setInterval(retryPendingPayouts, 60000); 
});