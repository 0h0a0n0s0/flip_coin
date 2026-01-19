// 档案: apps/backend-legacy/services/MonitoringService.js
// 功能: 监控能源提供者钱包的能源和 TRX 余额

const TronWeb = require('tronweb');
const db = require('@flipcoin/database');

// (从 .env 读取节点)
const NILE_NODE_HOST = process.env.NILE_NODE_HOST;
if (!NILE_NODE_HOST) {
    throw new Error("CRITICAL: NILE_NODE_HOST is not set in .env file!");
}

// 阈值配置
const LOW_ENERGY_THRESHOLD = 64000; // 约 2 次转账
const LOW_TRX_THRESHOLD = 50; // TRX

class MonitoringService {
    constructor() {
        this.tronWeb = new TronWeb({
            fullHost: NILE_NODE_HOST,
            solidityHost: NILE_NODE_HOST,
            privateKey: '01',
            timeout: 120000
        });
        
        this.tronWeb.setFullNode(NILE_NODE_HOST);
        this.tronWeb.setSolidityNode(NILE_NODE_HOST);
        this.tronWeb.setEventServer(NILE_NODE_HOST);
        
        console.log(`✅ [MonitoringService] Initialized.`);
    }

    /**
     * @description 检查所有能源提供者钱包
     */
    async checkWallets() {
        try {
            console.log('[MonitoringService] Starting wallet check...');
            
            // 获取所有 is_energy_provider = true 的钱包
            const walletsResult = await db.query(
                `SELECT * FROM platform_wallets 
                 WHERE is_energy_provider = true 
                   AND is_active = true
                 ORDER BY address`
            );

            if (walletsResult.rows.length === 0) {
                console.log('[MonitoringService] No energy provider wallets found.');
                return;
            }

            console.log(`[MonitoringService] Found ${walletsResult.rows.length} energy provider wallet(s).`);

            // 检查每个钱包
            for (const wallet of walletsResult.rows) {
                try {
                    await this.checkWallet(wallet);
                } catch (error) {
                    console.error(`[MonitoringService] Error checking wallet ${wallet.address}:`, error.message);
                }
            }

            console.log('[MonitoringService] Wallet check completed.');
        } catch (error) {
            console.error('[MonitoringService] Error in checkWallets:', error);
        }
    }

    /**
     * @description 检查单个钱包
     * @param {Object} wallet - 钱包对象
     */
    async checkWallet(wallet) {
        try {
            const address = wallet.address;

            // 获取账户信息
            const account = await this.tronWeb.trx.getAccount(address);
            const balance = account.balance || 0;
            const balanceTRX = balance / 1000000; // 转换为 TRX

            // 计算质押 TRX（Stake 1.0 + Stake 2.0）
            const stakedTrx = this.calculateStakedTrxFromAccount(account);

            // 计算剩余能量（更贴近 TronScan: EnergyLimit - EnergyUsed）
            const remainingEnergy = await this.getRemainingEnergy(address, account);

            console.log(
                `[MonitoringService] Wallet ${address}: RemainingEnergy=${remainingEnergy}, TRX=${balanceTRX.toFixed(2)}, StakedTRX=${stakedTrx.toFixed(2)}`
            );

            // (★★★ 安全檢查：警告能量提供者钱包被用于其他功能 ★★★)
            if (wallet.is_energy_provider) {
                if (wallet.is_collection) {
                    console.warn(`[MonitoringService] ⚠️ WARNING: Energy Provider Wallet (${address}) is also used for collection!`);
                    console.warn(`[MonitoringService] Collection operations will consume energy from this wallet.`);
                }
                if (wallet.is_payout) {
                    console.warn(`[MonitoringService] ⚠️ WARNING: Energy Provider Wallet (${address}) is also used for payout!`);
                    console.warn(`[MonitoringService] Payout operations will consume energy from this wallet.`);
                }
            }

            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MonitoringService.js:checkWallet',message:'Energy monitoring check',data:{address,walletName:wallet.name,remainingEnergy,balanceTRX,stakedTrx,isEnergyProvider:wallet.is_energy_provider,isCollection:wallet.is_collection,isPayout:wallet.is_payout,threshold:LOW_ENERGY_THRESHOLD,isLow:remainingEnergy < LOW_ENERGY_THRESHOLD,hasConflict:wallet.is_energy_provider && (wallet.is_collection || wallet.is_payout)},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'C'})}).catch(()=>{});
            // #endregion

            // 检查低能量
            if (remainingEnergy < LOW_ENERGY_THRESHOLD) {
                const walletName = wallet.name || '能量钱包';
                const shortAddress = this.shortAddress(address);
                await this.createNotificationIfNeeded(
                    address,
                    'LOW_ENERGY',
                    `[${walletName}] 能量告警: 剩余能量仅 ${Math.floor(remainingEnergy)} (地址: ${shortAddress})`,
                    remainingEnergy
                );
            }

            // 检查低 TRX
            if (balanceTRX < LOW_TRX_THRESHOLD) {
                const walletName = wallet.name || '钱包';
                const shortAddress = this.shortAddress(address);
                await this.createNotificationIfNeeded(
                    address,
                    'LOW_TRX',
                    `[${walletName}] TRX余额不足: 仅剩 ${balanceTRX.toFixed(2)} TRX (地址: ${shortAddress})`,
                    balanceTRX
                );
            }

        } catch (error) {
            console.error(`[MonitoringService] Error checking wallet ${wallet.address}:`, error.message);
            throw error;
        }
    }

    /**
     * @description 计算质押 TRX（Stake 1.0 + Stake 2.0）
     * - Stake 1.0: account.frozen / frozen_balance (SUN)
     * - Stake 2.0: account.frozenV2[].amount (SUN)
     * @param {Object} account
     * @returns {number} TRX
     */
    calculateStakedTrxFromAccount(account) {
        const toNumber = (v) => {
            if (v === null || v === undefined) return 0;
            const n = Number(v);
            return Number.isFinite(n) ? n : 0;
        };

        let totalSun = 0;

        // Stake 1.0: frozen may be array or object depending on node response
        const frozen = account && account.frozen ? account.frozen : [];
        if (Array.isArray(frozen)) {
            for (const f of frozen) {
                totalSun += toNumber(f?.frozen_balance);
            }
        } else if (typeof frozen === 'object') {
            totalSun += toNumber(frozen.frozen_balance);
        }

        // Stake 2.0: frozenV2 array
        const frozenV2 = account && account.frozenV2 ? account.frozenV2 : [];
        if (Array.isArray(frozenV2)) {
            for (const f of frozenV2) {
                totalSun += toNumber(f?.amount);
            }
        }

        return totalSun / 1_000_000;
    }

    /**
     * @description 计算剩余能量（优先使用 getAccountResources，fallback 到 account.energy）
     * Remaining = (EnergyLimit || 0) - (EnergyUsed || 0)
     * @param {string} address
     * @param {Object} account
     * @returns {Promise<number>}
     */
    async getRemainingEnergy(address, account) {
        try {
            const resources = await this.tronWeb.trx.getAccountResources(address);
            const energyLimit = Number(resources?.EnergyLimit || 0);
            const energyUsed = Number(resources?.EnergyUsed || 0);
            const remaining = energyLimit - energyUsed;
            if (Number.isFinite(remaining)) {
                return Math.max(0, remaining);
            }
        } catch (e) {
            // ignore and fallback
        }

        const fallback = Number(account?.energy || 0);
        return Number.isFinite(fallback) ? Math.max(0, fallback) : 0;
    }

    /**
     * @description 短地址显示
     */
    shortAddress(address) {
        if (!address || typeof address !== 'string') return '';
        if (address.length <= 12) return address;
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    /**
     * @description 创建通知（如果不存在未解决的通知）
     * @param {string} address - 钱包地址
     * @param {string} type - 通知类型 ('LOW_ENERGY' 或 'LOW_TRX')
     * @param {string} message - 通知消息
     * @param {number} value - 当前值
     */
    async createNotificationIfNeeded(address, type, message, value) {
        try {
            // 检查过去 1 小时内是否已有未解决的相同类型和地址的通知（去重）
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            
            const existingNotification = await db.query(
                `SELECT id FROM tron_notifications 
                 WHERE address = $1 
                   AND type = $2 
                   AND resolved = false
                   AND created_at > $3
                 LIMIT 1`,
                [address, type, oneHourAgo]
            );

            if (existingNotification.rows.length > 0) {
                // 已存在未解决的通知，不重复创建
                return;
            }

            // 创建新通知
            await db.query(
                `INSERT INTO tron_notifications (type, address, message, resolved, created_at)
                 VALUES ($1, $2, $3, false, NOW())`,
                [type, address, message]
            );

            console.log(`[MonitoringService] Created ${type} notification for ${address}: ${message}`);
        } catch (error) {
            console.error(`[MonitoringService] Error creating notification:`, error);
            throw error;
        }
    }
}

// 单例模式
let monitoringServiceInstance = null;

function getMonitoringServiceInstance() {
    if (!monitoringServiceInstance) {
        monitoringServiceInstance = new MonitoringService();
    }
    return monitoringServiceInstance;
}

module.exports = {
    getMonitoringServiceInstance,
    MonitoringService
};
