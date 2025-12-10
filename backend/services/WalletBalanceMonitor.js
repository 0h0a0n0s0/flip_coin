// 档案: backend/services/WalletBalanceMonitor.js
// 监控开奖钱包余额，当余额不足时创建异常通知

const db = require('../db');
const { getGameOpenerInstance } = require('./GameOpenerService.js');

class WalletBalanceMonitor {
    constructor() {
        this.gameOpener = getGameOpenerInstance();
        this.checkInterval = null;
        this.checkIntervalMs = 60000; // 每60秒检查一次
        this.minBalanceThreshold = 1000000; // 最小余额阈值：1 TRX (1,000,000 SUN)
        this.lastBalanceStatus = {}; // 记录每个地址的上次状态 { address: { isLow: boolean, lastChecked: timestamp } }
        
        console.log("✅ [WalletBalanceMonitor] Initialized.");
    }

    /**
     * 开始监控
     */
    start() {
        if (this.checkInterval) {
            return; // 已经在运行
        }
        
        console.log(`[WalletBalanceMonitor] Starting to monitor wallet balances (check interval: ${this.checkIntervalMs}ms)`);
        
        // 立即检查一次
        this._checkBalances();
        
        // 定期检查
        this.checkInterval = setInterval(() => {
            this._checkBalances();
        }, this.checkIntervalMs);
    }

    /**
     * 停止监控
     */
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            console.log("[WalletBalanceMonitor] Stopped monitoring.");
        }
    }

    /**
     * 检查所有开奖钱包余额
     */
    async _checkBalances() {
        try {
            if (!this.gameOpener.addressA) {
                return; // 钱包未配置
            }

            const address = this.gameOpener.addressA;
            const balance = await this.gameOpener.checkWalletABalance();
            const balanceTRX = balance / 1000000;
            const isLow = balance < this.minBalanceThreshold;

            // 检查状态是否发生变化
            const lastStatus = this.lastBalanceStatus[address];
            const statusChanged = !lastStatus || lastStatus.isLow !== isLow;

            // 更新状态
            this.lastBalanceStatus[address] = {
                isLow: isLow,
                lastChecked: new Date()
            };

            // 如果余额不足且状态发生变化（从充足变为不足），创建异常通知
            if (isLow && statusChanged) {
                await this._createLowBalanceNotification(address, balanceTRX);
            }

            // 如果余额恢复充足且状态发生变化（从不足变为充足），标记通知为已解决
            if (!isLow && statusChanged && lastStatus && lastStatus.isLow) {
                await this._resolveLowBalanceNotification(address);
            }

        } catch (error) {
            console.error(`[WalletBalanceMonitor] Error checking balances:`, error.message);
        }
    }

    /**
     * 创建余额不足异常通知
     */
    async _createLowBalanceNotification(address, balanceTRX) {
        try {
            // 检查是否已有未解决的相同通知
            const existing = await db.query(
                "SELECT id FROM tron_notifications WHERE address = $1 AND type = 'low_balance' AND resolved = false",
                [address]
            );

            if (existing.rows.length > 0) {
                // 更新现有通知的时间
                await db.query(
                    "UPDATE tron_notifications SET created_at = NOW() WHERE id = $1",
                    [existing.rows[0].id]
                );
                return;
            }

            // 创建新通知
            await db.query(
                `INSERT INTO tron_notifications (type, address, message, resolved, created_at)
                 VALUES ($1, $2, $3, false, NOW())`,
                ['low_balance', address, `开奖地址A (${address}) TRX余额不足，当前余额: ${balanceTRX.toFixed(6)} TRX`]
            );

            console.log(`[WalletBalanceMonitor] Created low balance notification for ${address}`);
        } catch (error) {
            console.error(`[WalletBalanceMonitor] Failed to create notification:`, error.message);
        }
    }

    /**
     * 标记余额不足通知为已解决
     */
    async _resolveLowBalanceNotification(address) {
        try {
            await db.query(
                "UPDATE tron_notifications SET resolved = true, resolved_at = NOW() WHERE address = $1 AND type = 'low_balance' AND resolved = false",
                [address]
            );

            console.log(`[WalletBalanceMonitor] Resolved low balance notification for ${address}`);
        } catch (error) {
            console.error(`[WalletBalanceMonitor] Failed to resolve notification:`, error.message);
        }
    }
}

// 单例模式
let instance = null;
function getWalletBalanceMonitorInstance() {
    if (!instance) {
        instance = new WalletBalanceMonitor();
    }
    return instance;
}

module.exports = {
    getWalletBalanceMonitorInstance
};

