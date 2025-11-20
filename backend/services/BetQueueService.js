// 档案: backend/services/BetQueueService.js (★★★ v8.9 修正版 ★★★)

const db = require('../db');
// (★★★ v8.9 修正：从 server.js 改为 services/settingsCache ★★★)
const { getSettingsCache } = require('./settingsCache.js'); 

class BetQueueService {
    /**
     * @param {object} io - Socket.IO 實例
     * @param {object} connectedUsers - (user_id -> socket.id) 的 Map
     * @param {object} gameOpener - GameOpenerService 實例
     */
    // (★★★ v8.9 修正：移除 settingsCache 参数 ★★★)
    constructor(io, connectedUsers, gameOpener) {
        this.io = io;
        this.connectedUsers = connectedUsers;
        this.gameOpener = gameOpener;
        // (★★★ v8.9 修正：在 constructor 中获取快取 ★★★)
        this.settingsCache = getSettingsCache(); 

        this.queue = []; // 储存 { user, choice, amount, resolve, reject }
        this.isProcessing = false;

        console.log("✅ [v7] BetQueueService initialized.");
    }

    /**
     * (由 API 路由调用) 将下注请求加入隊列
     * @returns {Promise<object>} 结算後的 Bet 物件
     */
    addBetToQueue(user, choice, amount) {
        // ... (此函数保持不变) ...
        console.log(`[v7 Queue] Received bet from ${user.user_id} ($${amount} on ${choice}). Queue size: ${this.queue.length}`);
        return new Promise((resolve, reject) => {
            this.queue.push({ user, choice, amount, resolve, reject });
            this._processQueue();
        });
    }

    /**
     * (内部) 依序处理隊列
     */
    async _processQueue() {
        // ... (此函数保持不变) ...
        if (this.isProcessing || this.queue.length === 0) {
            return; 
        }

        this.isProcessing = true;
        const item = this.queue.shift();
        
        console.log(`[v7 Queue] Processing bet for ${item.user.user_id}...`);

        try {
            const settledBet = await this._handleBetLifecycle(item);
            item.resolve(settledBet);
        } catch (error) {
            console.error(`[v7 Queue] Bet failed for ${item.user.user_id}:`, error.message);
            item.reject(error); 
        } finally {
            this.isProcessing = false;
            this._processQueue();
        }
    }

    /**
     * (内部) 处理单個下注的完整生命週期
     */
    async _handleBetLifecycle({ user, choice, amount }) {
        const userId = user.user_id;
        let betId = null;
        let client;

        // --- 1. 交易 1：扣款 & 建立 Pending 注单 ---
        try {
            client = await db.pool.connect();
            await client.query('BEGIN');

            // 1a. 锁定并检查余额
            const balanceResult = await client.query(
                "SELECT balance, status FROM users WHERE id = $1 FOR UPDATE", 
                [user.id]
            );
            const currentBalance = parseFloat(balanceResult.rows[0].balance);
            const userStatus = balanceResult.rows[0].status;

            if (userStatus !== 'active') {
                throw new Error("帐号已被禁用 (Account disabled)");
            }
            if (currentBalance < amount) {
                throw new Error("余额不足 (Insufficient balance)");
            }

            // 1b. 扣款
            await client.query(
                "UPDATE users SET balance = balance - $1 WHERE id = $2",
                [amount, user.id]
            );
            
            // 1c. 寫入 Pending 注单
            const betResult = await client.query(
                `INSERT INTO bets (user_id, choice, amount, status, bet_time) 
                 VALUES ($1, $2, $3, 'pending', NOW()) 
                 RETURNING *`,
                [userId, choice, amount]
            );
            betId = betResult.rows[0].id;
            
            await client.query('COMMIT');
            client.release(); // (释放 TX 1)
            
            console.log(`[v7 Bet] User ${userId} bet ${betId} (Pending). Balance deducted.`);
            this._notifySocketBetUpdate(userId, betResult.rows[0]);

        } catch (error) {
            if (client) {
                await client.query('ROLLBACK');
                client.release();
            }
            console.error(`[v7 Bet] TX 1 Failed (Deduct):`, error.message);
            throw error; 
        }

        // --- 2. 链上开奖 (A -> B) ---
        let txHash;
        try {
            txHash = await this.gameOpener.triggerBetTransaction();
        } catch (onChainError) {
            console.error(`[v7 Bet] On-Chain TX failed for bet ${betId}. Refunding...`);
            await this._refundBet(betId, userId, amount, 'failed', onChainError.message);
            throw onChainError; 
        }

        // --- 3. 交易 2：结算 & 派奖 ---
        try {
            // 3a. 判断输赢
            const isHead = this.gameOpener.determineOutcome(txHash);
            const didWin = (isHead && choice === 'head') || (!isHead && choice === 'tail');
            const status = didWin ? 'won' : 'lost';

            // 3b. 获取派彩
            // (★★★ v8.9 修正：确保 this.settingsCache 是最新的 ★★★)
            const multiplier = parseInt(getSettingsCache()['PAYOUT_MULTIPLIER']?.value || 2, 10);
            const payoutAmount = didWin ? (amount * multiplier) : 0;
            
            client = await db.pool.connect();
            await client.query('BEGIN');

            // 3c. 更新注单
            const settledBetResult = await client.query(
                `UPDATE bets 
                 SET status = $1, tx_hash = $2, settle_time = NOW(), payout_multiplier = $3
                 WHERE id = $4 RETURNING *`,
                [status, txHash, multiplier, betId]
            );
            const settledBet = settledBetResult.rows[0];

            // 3d. 更新余额 (如果赢了) 和 連胜
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
            client.release(); // (释放 TX 2)

            console.log(`[v7 Bet] Bet ${betId} Settled. User ${userId} ${status}.`);
            
            // 3e. 通知 Socket.IO
            this._notifySocketBetUpdate(userId, settledBet); 
            delete updatedUser.password_hash;
            this._notifySocketUserInfo(userId, updatedUser); 

            return settledBet; 

        } catch (error) {
            if (client) {
                await client.query('ROLLBACK');
                client.release();
            }
            console.error(`[v7 Bet] CRITICAL: TX 2 Failed (Settle) for bet ${betId}. Refunding...`, error.message);
            await this._refundBet(betId, userId, amount, 'failed', 'Settlement DB Error');
            throw error; 
        }
    }
    
    /**
     * (辅助) 处理退款 (当开奖或结算失败时)
     */
    async _refundBet(betId, userId, amount, status, errorMsg) {
        // ... (此函数保持不变) ...
        try {
            await db.query("UPDATE bets SET status = $1, notes = $2 WHERE id = $3", [status, errorMsg, betId]);
            const userResult = await db.query(
                "UPDATE users SET balance = balance + $1 WHERE user_id = $2 RETURNING *",
                [amount, userId]
            );
            this._notifySocketBetUpdate(userId, { id: betId, status: status, notes: errorMsg });
            delete userResult.rows[0].password_hash;
            this._notifySocketUserInfo(userId, userResult.rows[0]);
        } catch (refundError) {
            console.error(`[v7 Bet] CRITICAL PANIC: REFUND FAILED for bet ${betId} (User: ${userId})!`, refundError);
        }
    }

    // (辅助) Socket.IO 通知
    _notifySocketBetUpdate(userId, betData) {
        // ... (此函数保持不变) ...
        const socketId = this.connectedUsers[userId];
        if (socketId) {
            this.io.to(socketId).emit('bet_updated', betData);
        }
    }
    _notifySocketUserInfo(userId, userData) {
        // ... (此函数保持不变) ...
        const socketId = this.connectedUsers[userId];
        if (socketId) {
            this.io.to(socketId).emit('user_info_updated', userData);
        }
    }
}

// (★★★ v8.9 修正：移除 settingsCache 参数 ★★★)
let instance = null;
function getBetQueueInstance(io, connectedUsers, gameOpener) { // (移除 settingsCache)
    if (!instance) {
        instance = new BetQueueService(io, connectedUsers, gameOpener); // (移除 settingsCache)
    }
    return instance;
}

module.exports = {
    getBetQueueInstance
};