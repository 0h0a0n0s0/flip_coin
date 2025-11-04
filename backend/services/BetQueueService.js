// 檔案: backend/services/BetQueueService.js (★★★ v7-M5 新檔案 ★★★)

const db = require('../db');

class BetQueueService {
    /**
     * @param {object} io - Socket.IO 實例
     * @param {object} connectedUsers - (user_id -> socket.id) 的 Map
     * @param {object} gameOpener - GameOpenerService 實例
     * @param {object} settingsCache - 系統設定快取
     */
    constructor(io, connectedUsers, gameOpener, settingsCache) {
        this.io = io;
        this.connectedUsers = connectedUsers;
        this.gameOpener = gameOpener;
        this.settingsCache = settingsCache;

        this.queue = []; // 儲存 { user, choice, amount, resolve, reject }
        this.isProcessing = false;

        console.log("✅ [v7] BetQueueService initialized.");
    }

    /**
     * (由 API 路由調用) 將下注請求加入隊列
     * @returns {Promise<object>} 結算後的 Bet 物件
     */
    addBetToQueue(user, choice, amount) {
        console.log(`[v7 Queue] Received bet from ${user.user_id} ($${amount} on ${choice}). Queue size: ${this.queue.length}`);
        return new Promise((resolve, reject) => {
            this.queue.push({ user, choice, amount, resolve, reject });
            // (非同步觸發處理，如果不在處理中，它會立即開始)
            this._processQueue();
        });
    }

    /**
     * (內部) 依序處理隊列
     */
    async _processQueue() {
        if (this.isProcessing || this.queue.length === 0) {
            return; // (正在處理中 或 隊列已空)
        }

        this.isProcessing = true;
        const item = this.queue.shift();
        
        console.log(`[v7 Queue] Processing bet for ${item.user.user_id}...`);

        try {
            // (★★★ 執行完整的下注生命週期 ★★★)
            const settledBet = await this._handleBetLifecycle(item);
            item.resolve(settledBet);
        } catch (error) {
            console.error(`[v7 Queue] Bet failed for ${item.user.user_id}:`, error.message);
            item.reject(error); // (將錯誤返回給 API 路由)
        } finally {
            this.isProcessing = false;
            // (處理下一筆)
            this._processQueue();
        }
    }

    /**
     * (內部) 處理單個下注的完整生命週期
     */
    async _handleBetLifecycle({ user, choice, amount }) {
        const userId = user.user_id;
        let betId = null;
        let client;

        // --- 1. 交易 1：扣款 & 建立 Pending 注單 ---
        try {
            client = await db.pool.connect();
            await client.query('BEGIN');

            // 1a. 鎖定並檢查餘額
            const balanceResult = await client.query(
                "SELECT balance, status FROM users WHERE id = $1 FOR UPDATE", 
                [user.id]
            );
            const currentBalance = parseFloat(balanceResult.rows[0].balance);
            const userStatus = balanceResult.rows[0].status;

            if (userStatus !== 'active') {
                throw new Error("帳號已被禁用 (Account disabled)");
            }
            if (currentBalance < amount) {
                throw new Error("餘額不足 (Insufficient balance)");
            }
            // (未來可在此檢查 user_levelsCache[user.level].max_bet_amount)

            // 1b. 扣款
            await client.query(
                "UPDATE users SET balance = balance - $1 WHERE id = $2",
                [amount, user.id]
            );
            
            // 1c. 寫入 Pending 注單
            const betResult = await client.query(
                `INSERT INTO bets (user_id, choice, amount, status, bet_time) 
                 VALUES ($1, $2, $3, 'pending', NOW()) 
                 RETURNING *`,
                [userId, choice, amount]
            );
            betId = betResult.rows[0].id;
            
            await client.query('COMMIT');
            client.release(); // (釋放 TX 1)
            
            console.log(`[v7 Bet] User ${userId} bet ${betId} (Pending). Balance deducted.`);
            // (通知 Socket.IO 注單已建立)
            this._notifySocketBetUpdate(userId, betResult.rows[0]);

        } catch (error) {
            if (client) {
                await client.query('ROLLBACK');
                client.release();
            }
            console.error(`[v7 Bet] TX 1 Failed (Deduct):`, error.message);
            throw error; // (終止此注單)
        }

        // --- 2. 鏈上開獎 (A -> B) ---
        let txHash;
        try {
            txHash = await this.gameOpener.triggerBetTransaction();
        } catch (onChainError) {
            // (鏈上開獎失敗，必須退款)
            console.error(`[v7 Bet] On-Chain TX failed for bet ${betId}. Refunding...`);
            await this._refundBet(betId, userId, amount, 'failed', onChainError.message);
            throw onChainError; // (終止此注單)
        }

        // --- 3. 交易 2：結算 & 派獎 ---
        try {
            // 3a. 判斷輸贏
            const isHead = this.gameOpener.determineOutcome(txHash);
            const didWin = (isHead && choice === 'head') || (!isHead && choice === 'tail');
            const status = didWin ? 'won' : 'lost';

            // 3b. 獲取派彩
            const multiplier = parseInt(this.settingsCache['PAYOUT_MULTIPLIER']?.value || 2, 10);
            const payoutAmount = didWin ? (amount * multiplier) : 0;
            
            client = await db.pool.connect();
            await client.query('BEGIN');

            // 3c. 更新注單
            const settledBetResult = await client.query(
                `UPDATE bets 
                 SET status = $1, tx_hash = $2, settle_time = NOW(), payout_multiplier = $3
                 WHERE id = $4 RETURNING *`,
                [status, txHash, multiplier, betId]
            );
            const settledBet = settledBetResult.rows[0];

            // 3d. 更新餘額 (如果贏了) 和 連勝
            let updatedUser;
            if (didWin) {
                const userResult = await client.query(
                    `UPDATE users 
                     SET balance = balance + $1,
                         current_streak = CASE WHEN current_streak >= 0 THEN current_streak + 1 ELSE 1 END,
                         max_streak = CASE WHEN (current_streak + 1) > max_streak THEN current_streak + 1 ELSE max_streak END
                     WHERE id = $2 RETURNING *`,
                    [payoutAmount, user.id]
                );
                updatedUser = userResult.rows[0];
            } else {
                 const userResult = await client.query(
                    `UPDATE users 
                     SET current_streak = CASE WHEN current_streak <= 0 THEN current_streak - 1 ELSE -1 END
                     WHERE id = $1 RETURNING *`,
                    [user.id]
                );
                updatedUser = userResult.rows[0];
            }

            await client.query('COMMIT');
            client.release(); // (釋放 TX 2)

            console.log(`[v7 Bet] Bet ${betId} Settled. User ${userId} ${status}.`);
            
            // 3e. 通知 Socket.IO
            this._notifySocketBetUpdate(userId, settledBet); // (更新注單狀態)
            delete updatedUser.password_hash;
            this._notifySocketUserInfo(userId, updatedUser); // (更新餘額和連勝)

            return settledBet; // (返回給 API 路由)

        } catch (error) {
            if (client) {
                await client.query('ROLLBACK');
                client.release();
            }
            console.error(`[v7 Bet] CRITICAL: TX 2 Failed (Settle) for bet ${betId}. Refunding...`, error.message);
            // (結算失敗，必須退款)
            await this._refundBet(betId, userId, amount, 'failed', 'Settlement DB Error');
            throw error; // (終止此注單)
        }
    }
    
    /**
     * (輔助) 處理退款 (當開獎或結算失敗時)
     */
    async _refundBet(betId, userId, amount, status, errorMsg) {
        try {
            await db.query("UPDATE bets SET status = $1, notes = $2 WHERE id = $3", [status, errorMsg, betId]);
            const userResult = await db.query(
                "UPDATE users SET balance = balance + $1 WHERE user_id = $2 RETURNING *",
                [amount, userId]
            );
            // (通知用戶注單失敗 + 餘額退回)
            this._notifySocketBetUpdate(userId, { id: betId, status: status, notes: errorMsg });
            delete userResult.rows[0].password_hash;
            this._notifySocketUserInfo(userId, userResult.rows[0]);
        } catch (refundError) {
            console.error(`[v7 Bet] CRITICAL PANIC: REFUND FAILED for bet ${betId} (User: ${userId})!`, refundError);
        }
    }

    // (輔助) Socket.IO 通知
    _notifySocketBetUpdate(userId, betData) {
        const socketId = this.connectedUsers[userId];
        if (socketId) {
            this.io.to(socketId).emit('bet_updated', betData);
        }
    }
    _notifySocketUserInfo(userId, userData) {
        const socketId = this.connectedUsers[userId];
        if (socketId) {
            this.io.to(socketId).emit('user_info_updated', userData);
        }
    }
}

// (使用單例模式)
let instance = null;
function getBetQueueInstance(io, connectedUsers, gameOpener, settingsCache) {
    if (!instance) {
        instance = new BetQueueService(io, connectedUsers, gameOpener, settingsCache);
    }
    return instance;
}

module.exports = {
    getBetQueueInstance
};