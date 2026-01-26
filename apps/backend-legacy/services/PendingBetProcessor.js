// 档案: backend/services/PendingBetProcessor.js
// 处理待处理注单的服务

const db = require('@flipcoin/database');
const { getGameOpenerInstance } = require('./GameOpenerService.js');
const { logBalanceChange, CHANGE_TYPES } = require('../utils/balanceChangeLogger');
const { getSettingsCache } = require('./settingsCache.js');
const { checkAndUpgradeUserLevel } = require('./UserService.js');

class PendingBetProcessor {
    constructor(io, connectedUsers) {
        this.io = io;
        this.connectedUsers = connectedUsers;
        this.gameOpener = getGameOpenerInstance();
        this.isProcessing = false;
        this.checkInterval = null;
        this.checkIntervalMs = 30000; // 每30秒检查一次
        
        console.log("✅ [PendingBetProcessor] Initialized.");
    }

    /**
     * 开始监控和处理待处理注单
     */
    start() {
        if (this.checkInterval) {
            return; // 已经在运行
        }
        
        console.log(`[PendingBetProcessor] Starting to monitor pending bets (check interval: ${this.checkIntervalMs}ms)`);
        
        // 立即检查一次
        this._processPendingBets();
        
        // 定期检查
        this.checkInterval = setInterval(() => {
            this._processPendingBets();
        }, this.checkIntervalMs);
    }

    /**
     * 停止监控
     */
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            console.log("[PendingBetProcessor] Stopped monitoring.");
        }
    }

    /**
     * 处理待处理注单
     */
    async _processPendingBets() {
        if (this.isProcessing) {
            return; // 正在处理中，跳过本次
        }

        this.isProcessing = true;
        
        try {
            // 获取所有待处理的注单
            const pendingBets = await db.query(
                "SELECT * FROM bets WHERE status = 'pending_tx' ORDER BY bet_time ASC LIMIT 10",
                []
            );

            if (pendingBets.rows.length === 0) {
                this.isProcessing = false;
                return;
            }

            console.log(`[PendingBetProcessor] Found ${pendingBets.rows.length} pending bets. Processing...`);

            // 检查钱包余额是否足够
            const hasBalance = await this.gameOpener.hasSufficientBalance(10000);
            
            if (!hasBalance) {
                console.log(`[PendingBetProcessor] Wallet balance insufficient. Skipping processing.`);
                this.isProcessing = false;
                return;
            }

            // 处理每个待处理注单
            for (const bet of pendingBets.rows) {
                try {
                    await this._processSinglePendingBet(bet);
                } catch (error) {
                    const errorMsg = error.message || String(error);
                    console.error(`[PendingBetProcessor] Failed to process bet ${bet.id}: ${errorMsg}`);
                    // 检查是否是余额不足错误
                    if (errorMsg.includes('INSUFFICIENT_BALANCE') || errorMsg.includes('余额不足')) {
                        console.log(`[PendingBetProcessor] Bet ${bet.id} failed due to insufficient balance. Will retry when balance is sufficient.`);
                    } else {
                        console.warn(`[PendingBetProcessor] Bet ${bet.id} failed due to other error. Will retry in next cycle.`);
                    }
                    // 继续处理下一个
                }
            }

        } catch (error) {
            console.error(`[PendingBetProcessor] Error processing pending bets:`, error.message);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 处理单个待处理注单
     */
    async _processSinglePendingBet(bet) {
        const { id: betId, user_id: userId, choice, amount } = bet;
        let client;

        try {
            // 再次检查余额（在处理前）
            const hasBalance = await this.gameOpener.hasSufficientBalance(10000);
            if (!hasBalance) {
                const balance = await this.gameOpener.checkWalletABalance();
                const balanceTRX = (balance / 1000000).toFixed(6);
                console.log(`[PendingBetProcessor] Wallet balance insufficient for bet ${betId}. Current balance: ${balanceTRX} TRX. Skipping.`);
                return;
            }

            const balance = await this.gameOpener.checkWalletABalance();
            const balanceTRX = (balance / 1000000).toFixed(6);
            console.log(`[PendingBetProcessor] Processing pending bet ${betId} for user ${userId}... (Wallet balance: ${balanceTRX} TRX)`);

            // 1. 发送链上交易
            const txHash = await this.gameOpener.triggerBetTransaction();

            // 2. 判断输赢
            const isHead = this.gameOpener.determineOutcome(txHash);
            const didWin = (isHead && choice === 'head') || (!isHead && choice === 'tail');
            const status = didWin ? 'won' : 'lost';

            // 3. 获取派彩
            // (优先从 games 表获取派奖倍数，使用 game_code 'flip-coin')
            const { getGamePayoutMultiplier } = require('../utils/gameUtils.js');
            const multiplier = await getGamePayoutMultiplier('flip-coin');
            const payoutAmount = didWin ? (parseFloat(amount) * multiplier) : 0;

            // 4. 更新注单和用户余额（使用事务）
            client = await db.pool.connect();
            await client.query('BEGIN');

            // 4a. 更新注单
            const settledBetResult = await client.query(
                `UPDATE bets 
                 SET status = $1, tx_hash = $2, settle_time = NOW(), payout_multiplier = $3
                 WHERE id = $4 RETURNING *`,
                [status, txHash, multiplier, betId]
            );
            const settledBet = settledBetResult.rows[0];

            // 4b. 更新用户余额和连胜
            let updatedUser;
            if (didWin) {
                // (★★★ 修復：添加行鎖以確保並發安全 ★★★)
                await client.query(
                    'SELECT balance, current_streak FROM users WHERE user_id = $1 FOR UPDATE',
                    [userId]
                );
                
                const userResult = await client.query(
                    `UPDATE users 
                     SET balance = balance + $1,
                         current_streak = CASE WHEN current_streak >= 0 THEN current_streak + 1 ELSE 1 END,
                         max_streak = CASE WHEN (current_streak + 1) > max_streak THEN current_streak + 1 ELSE max_streak END
                     WHERE user_id = $2 RETURNING *`,
                    [payoutAmount, userId]
                );
                updatedUser = userResult.rows[0];

                // 记录账变（派奖）
                try {
                    const newBalance = parseFloat(updatedUser.balance);
                    await logBalanceChange({
                        user_id: userId,
                        change_type: CHANGE_TYPES.PAYOUT,
                        amount: payoutAmount,
                        balance_after: newBalance,
                        remark: `派奖 ${payoutAmount} USDT, 注单ID: ${betId}, 倍率: ${multiplier}x`,
                        client: client
                    });
                } catch (error) {
                    console.error('[PendingBetProcessor] Failed to log balance change (payout):', error);
                }
            } else {
                const userResult = await client.query(
                    `UPDATE users 
                     SET current_streak = CASE WHEN current_streak <= 0 THEN current_streak - 1 ELSE -1 END
                     WHERE user_id = $1 RETURNING *`,
                    [userId]
                );
                updatedUser = userResult.rows[0];
            }

            // 累加有效投注统计（用于等级升级计算）
            try {
                // 获取用户当前等级配置，以确定单个投注的有效性阈值
                const levelResult = await client.query(
                    'SELECT min_bet_amount_for_upgrade FROM user_levels WHERE level = (SELECT level FROM users WHERE user_id = $1)',
                    [userId]
                );
                const minValidBetAmount = levelResult.rows.length > 0 
                    ? parseFloat(levelResult.rows[0].min_bet_amount_for_upgrade) || 0 
                    : 0;
                
                const betAmount = parseFloat(amount);
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
                console.error('[PendingBetProcessor] Failed to accumulate bet statistics:', error);
                // 不阻止主流程，只记录错误
            }

            // 檢查並處理用戶等級升級（在 COMMIT 之前，確保在同一事務中）
            try {
                await checkAndUpgradeUserLevel(userId, client);
            } catch (error) {
                console.error('[PendingBetProcessor] Level upgrade check failed:', error);
                // 不阻止主流程，只記錄錯誤
            }

            await client.query('COMMIT');
            client.release();

            console.log(`[PendingBetProcessor] Bet ${betId} settled. User ${userId} ${status}.`);

            // 5. 通知 Socket.IO
            this._notifySocketBetUpdate(userId, settledBet);
            if (updatedUser) {
                delete updatedUser.password_hash;
                this._notifySocketUserInfo(userId, updatedUser);
            }

        } catch (error) {
            if (client) {
                try {
                    await client.query('ROLLBACK');
                    client.release();
                } catch (rollbackError) {
                    console.error(`[PendingBetProcessor] Rollback failed:`, rollbackError);
                }
            }
            throw error;
        }
    }

    /**
     * Socket.IO 通知
     */
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

// 单例模式
let instance = null;
function getPendingBetProcessorInstance(io, connectedUsers) {
    if (!instance) {
        instance = new PendingBetProcessor(io, connectedUsers);
    }
    return instance;
}

module.exports = {
    getPendingBetProcessorInstance
};

