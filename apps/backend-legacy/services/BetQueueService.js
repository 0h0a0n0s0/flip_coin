// 档案: backend/services/BetQueueService.js (★★★ v8.9 修正版 ★★★)

const db = require('@flipcoin/database');
// (★★★ v8.9 修正：从 server.js 改为 services/settingsCache ★★★)
const { getSettingsCache } = require('./settingsCache.js');
const { logBalanceChange, CHANGE_TYPES } = require('../utils/balanceChangeLogger');
const { checkAndUpgradeUserLevel } = require('./UserService.js'); 

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
     * @param {object} user - 用户对象
     * @param {string} choice - 投注选择
     * @param {number} amount - 投注金额
     * @param {string} betIp - (可选) 投注IP地址
     * @param {string} gameMode - (可选) 游戏模式 ('normal' 或 'streak')
     * @returns {Promise<object>} 结算後的 Bet 物件
     */
    addBetToQueue(user, choice, amount, betIp = null, gameMode = 'normal') {
        console.log(`[v7 Queue] Received bet from ${user.user_id} ($${amount} on ${choice}, mode: ${gameMode}). Queue size: ${this.queue.length}`);
        return new Promise((resolve, reject) => {
            this.queue.push({ user, choice, amount, betIp, gameMode, resolve, reject });
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
    async _handleBetLifecycle({ user, choice, amount, betIp, gameMode = 'normal' }) {
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

            // 1b. 扣款并获取更新后的用户信息
            const updateResult = await client.query(
                `UPDATE users SET balance = balance - $1 WHERE id = $2 
                 RETURNING id, user_id, username, balance, current_streak, max_streak, status, nickname, level, referrer_code`,
                [amount, user.id]
            );
            const updatedUser = updateResult.rows[0];
            const newBalance = parseFloat(updatedUser.balance);
            
            // 1c. 寫入 Pending 注单 (★★★ v9.2 新增：记录投注IP ★★★)
            const betResult = await client.query(
                `INSERT INTO bets (user_id, choice, amount, status, bet_ip, bet_time) 
                 VALUES ($1, $2, $3, 'pending', $4, NOW()) 
                 RETURNING *`,
                [userId, choice, amount, betIp || null]
            );
            betId = betResult.rows[0].id;
            
            // 1d. 记录账变（下注扣款）
            try {
                await logBalanceChange({
                    user_id: userId,
                    change_type: CHANGE_TYPES.BET,
                    amount: -amount,  // 负数表示扣款
                    balance_after: newBalance,
                    remark: `下注 ${amount} USDT, 注单ID: ${betId}`,
                    client: client
                });
            } catch (error) {
                console.error('[BetQueueService] Failed to log balance change (bet):', error);
                // 不阻止主流程，只记录错误
            }
            
            await client.query('COMMIT');
            client.release(); // (释放 TX 1)
            
            console.log(`[v7 Bet] User ${userId} bet ${betId} (Pending). Balance deducted.`);
            
            // 通知前端注单更新和用户信息更新（包含余额）
            this._notifySocketBetUpdate(userId, betResult.rows[0]);
            // 发送更新后的用户信息，确保右上角余额同步更新
            delete updatedUser.password_hash;
            this._notifySocketUserInfo(userId, updatedUser);

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
            const errorMessage = onChainError.message || 'Unknown on-chain transaction error';
            
            // 检查是否是余额不足错误
            if (errorMessage.includes('INSUFFICIENT_BALANCE') || errorMessage.includes('余额不足')) {
                console.warn(`[v7 Bet] On-Chain TX failed for bet ${betId} due to insufficient balance. Marking as pending_tx...`);
                
                // 将注单标记为 pending_tx（待处理交易），不退款
                try {
                    await db.query(
                        "UPDATE bets SET status = 'pending_tx' WHERE id = $1",
                        [betId]
                    );
                    console.log(`[v7 Bet] Bet ${betId} marked as pending_tx. Will be processed when wallet balance is sufficient.`);
                    
                    // 通知前端注单已提交（pending状态）
                    this._notifySocketBetUpdate(userId, { 
                        id: betId, 
                        status: 'pending_tx',
                        message: '注单已提交，等待链上开奖...'
                    });
                    
                    // 返回 pending 状态的注单，让前端显示正常提示
                    const pendingBet = await db.query(
                        "SELECT * FROM bets WHERE id = $1",
                        [betId]
                    );
                    return pendingBet.rows[0];
                } catch (markError) {
                    console.error(`[v7 Bet] Failed to mark bet ${betId} as pending_tx:`, markError);
                    // 如果标记失败，仍然退款
                    await this._refundBet(betId, userId, amount, 'failed', errorMessage);
                    throw new Error(`链上交易失败: ${errorMessage}`);
                }
            } else {
                // 其他错误，正常退款
                console.error(`[v7 Bet] On-Chain TX failed for bet ${betId}. Error: ${errorMessage}. Refunding...`);
                await this._refundBet(betId, userId, amount, 'failed', errorMessage);
                // 抛出更详细的错误信息
                throw new Error(`链上交易失败: ${errorMessage}`);
            }
        }

        // --- 3. 交易 2：结算 & 派奖 ---
        try {
            // 3a. 判断输赢
            const isHead = this.gameOpener.determineOutcome(txHash);
            const didWin = (isHead && choice === 'head') || (!isHead && choice === 'tail');
            const status = didWin ? 'won' : 'lost';

            // 3b. 获取派彩
            // (优先从 games 表获取派奖倍数，支持连胜模式)
            // 注意：在结算时，需要获取投注时的连胜数（在扣款时已获取）
            // 但由于扣款和结算是分开的事务，我们需要重新获取用户信息
            client = await db.pool.connect();
            await client.query('BEGIN');
            
            // 获取用户当前连胜数（投注时的连胜数，用于计算赔率）
            let currentStreak = 0;
            if (gameMode === 'streak') {
                // 从数据库中获取投注时的用户信息（在扣款前保存的）
                // 由于我们无法直接获取，我们需要在扣款时保存，或者从用户对象中获取
                // 这里我们从用户对象中获取（在扣款时已更新）
                const userResult = await client.query(
                    'SELECT current_streak FROM users WHERE id = $1 FOR UPDATE',
                    [user.id]
                );
                if (userResult.rows.length > 0) {
                    // 注意：这里获取的是投注时的连胜数，但由于扣款时没有更新连胜数，所以是正确的
                    // 如果用户之前有连胜，current_streak 是正数；如果是首次投注或之前输了，current_streak 是 0 或负数
                    const streakBeforeBet = userResult.rows[0].current_streak || 0;
                    // 如果是负数或0，表示首次投注或之前输了，使用0胜的赔率
                    currentStreak = streakBeforeBet >= 0 ? streakBeforeBet : 0;
                }
            }
            
            const { getGamePayoutMultiplier } = require('../utils/gameUtils.js');
            // 使用 game_code 获取赔率，FlipCoin 对应的 game_code 是 'flip-coin'
            const multiplier = await getGamePayoutMultiplier('flip-coin', gameMode, currentStreak);
            // 派奖金额 = 投注金额 * 赔率（包含本金）
            // 确保 amount 和 multiplier 都是数字类型
            const betAmount = parseFloat(amount);
            const payoutMultiplier = parseFloat(multiplier);
            const payoutAmount = didWin ? parseFloat((betAmount * payoutMultiplier).toFixed(2)) : 0;
            
            console.log(`[BetQueueService] Bet ${betId}: mode=${gameMode}, betAmount=${betAmount}, multiplier=${payoutMultiplier}, payoutAmount=${payoutAmount}, didWin=${didWin}`);
            
            // 验证派奖金额计算
            if (didWin && payoutAmount !== betAmount * payoutMultiplier) {
                console.error(`[BetQueueService] WARNING: Payout amount calculation mismatch! Expected: ${betAmount * payoutMultiplier}, Got: ${payoutAmount}`);
            }

            // 3c. 更新注单
            const settledBetResult = await client.query(
                `UPDATE bets 
                 SET status = $1, tx_hash = $2, settle_time = NOW(), payout_multiplier = $3
                 WHERE id = $4 RETURNING *`,
                [status, txHash, multiplier, betId]
            );
            const settledBet = settledBetResult.rows[0];

            // 3d. 更新余额 (如果赢了) 和 連胜（仅在连胜模式下更新连胜次数）
            let updatedUser;
            if (didWin) {
                // 根据游戏模式决定是否更新连胜次数
                if (gameMode === 'streak') {
                    // 连胜模式：更新连胜次数
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
                    // 原始模式：只更新余额，不更新连胜次数
                    const userResult = await client.query(
                        `UPDATE users 
                         SET balance = balance + $1
                         WHERE id = $2 RETURNING *`,
                        [payoutAmount, user.id]
                    );
                    updatedUser = userResult.rows[0];
                }
                
                // 记录账变（派奖）
                try {
                    const newBalance = parseFloat(updatedUser.balance);
                    await logBalanceChange({
                        user_id: user.user_id,
                        change_type: CHANGE_TYPES.PAYOUT,
                        amount: payoutAmount,  // 正数表示增加
                        balance_after: newBalance,
                        remark: `派奖 ${payoutAmount} USDT, 注单ID: ${betId}, 倍率: ${multiplier}x`,
                        client: client
                    });
                } catch (error) {
                    console.error('[BetQueueService] Failed to log balance change (payout):', error);
                    // 不阻止主流程，只记录错误
                }
            } else {
                // 输了：根据游戏模式决定是否更新连胜次数
                if (gameMode === 'streak') {
                    // 连胜模式：更新连胜次数（重置为负数）
                    const userResult = await client.query(
                        `UPDATE users 
                         SET current_streak = CASE WHEN current_streak <= 0 THEN current_streak - 1 ELSE -1 END
                         WHERE id = $1 RETURNING *`,
                        [user.id]
                    );
                    updatedUser = userResult.rows[0];
                } else {
                    // 原始模式：不更新连胜次数，只获取用户信息
                    const userResult = await client.query(
                        `SELECT * FROM users WHERE id = $1`,
                        [user.id]
                    );
                    updatedUser = userResult.rows[0];
                }
            }

            // 3d-2. 累加有效投注统计（用于等级升级计算）
            try {
                // 获取用户当前等级配置，以确定单个投注的有效性阈值
                const levelResult = await client.query(
                    'SELECT min_bet_amount_for_upgrade FROM user_levels WHERE level = (SELECT level FROM users WHERE user_id = $1)',
                    [userId]
                );
                const minValidBetAmount = levelResult.rows.length > 0 
                    ? parseFloat(levelResult.rows[0].min_bet_amount_for_upgrade) || 0 
                    : 0;
                
                // 只有金额 >= 阈值的投注才计入累加器
                if (betAmount >= minValidBetAmount) {
                    await client.query(
                        `UPDATE users 
                         SET total_valid_bet_amount = total_valid_bet_amount + $1,
                             total_valid_bet_count = total_valid_bet_count + 1
                         WHERE user_id = $2`,
                        [betAmount, userId]
                    );
                }
            } catch (error) {
                console.error('[BetQueueService] Failed to accumulate bet statistics:', error);
                // 不阻止主流程，只记录错误
            }

            // 3d-1. 檢查並處理用戶等級升級（在 COMMIT 之前，確保在同一事務中）
            try {
                await checkAndUpgradeUserLevel(userId, client);
            } catch (error) {
                console.error('[BetQueueService] Level upgrade check failed:', error);
                // 不阻止主流程，只記錄錯誤
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
        let client;
        try {
            // 使用事务确保数据一致性
            client = await db.pool.connect();
            await client.query('BEGIN');
            
            // 更新注单状态（bets 表中没有 notes 字段，使用 status 和可能的其他字段记录错误信息）
            await client.query(
                "UPDATE bets SET status = $1 WHERE id = $2",
                [status, betId]
            );
            
            // 退款给用户
            const userResult = await client.query(
                "UPDATE users SET balance = balance + $1 WHERE user_id = $2 RETURNING *",
                [amount, userId]
            );
            const updatedUser = userResult.rows[0];
            
            if (!updatedUser) {
                throw new Error(`User ${userId} not found for refund`);
            }
            
            // 记录账变（下注退款）
            try {
                const newBalance = parseFloat(updatedUser.balance);
                await logBalanceChange({
                    user_id: userId,
                    change_type: CHANGE_TYPES.PAYOUT,  // 使用PAYOUT类型表示退款
                    amount: amount,  // 正数表示退款
                    balance_after: newBalance,
                    remark: `下注失败退款 ${amount} USDT, 注单ID: ${betId}, 原因: ${errorMsg}`,
                    client: client
                });
            } catch (error) {
                console.error('[BetQueueService] Failed to log balance change (refund):', error);
                // 不阻止主流程，只记录错误
            }
            
            await client.query('COMMIT');
            client.release();
            
            // 通知 Socket.IO
            this._notifySocketBetUpdate(userId, { id: betId, status: status, notes: errorMsg });
            delete updatedUser.password_hash;
            this._notifySocketUserInfo(userId, updatedUser);
            
            console.log(`[v7 Bet] Refund completed for bet ${betId}, user ${userId}, amount ${amount}`);
        } catch (refundError) {
            if (client) {
                try {
                    await client.query('ROLLBACK');
                    client.release();
                } catch (rollbackError) {
                    console.error(`[v7 Bet] CRITICAL: Rollback failed during refund:`, rollbackError);
                }
            }
            console.error(`[v7 Bet] CRITICAL PANIC: REFUND FAILED for bet ${betId} (User: ${userId})!`, refundError);
            // 即使退款失败，也不抛出错误，避免影响主流程
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