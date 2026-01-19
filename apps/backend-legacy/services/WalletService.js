// 檔案: apps/backend-legacy/services/WalletService.js
// 功能: 錢包相關業務邏輯服務

const TronWeb = require('tronweb');
// p-limit@5.0.0 是 ES Module，不能使用 require()，需要使用動態 import()
// 我們將在 getOnChainBalances 方法中動態導入

// 從環境變數讀取配置
const NILE_NODE_HOST = process.env.NILE_NODE_HOST;
const USDT_CONTRACT_ADDRESS = process.env.USDT_CONTRACT_ADDRESS || 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';
const USDT_DECIMALS = 6;

// 並發限制：最多同時 8 個請求（避免觸發 TronGrid 429 錯誤）
const CONCURRENT_LIMIT = 8;

class WalletService {
    constructor() {
        if (!NILE_NODE_HOST) {
            throw new Error("CRITICAL: NILE_NODE_HOST is not set in .env file!");
        }

        try {
            this.tronWeb = new TronWeb({
                fullHost: NILE_NODE_HOST,
                solidityHost: NILE_NODE_HOST,
                privateKey: '01',
                timeout: 120000
            });
            this.tronWeb.setFullNode(NILE_NODE_HOST);
            this.tronWeb.setSolidityNode(NILE_NODE_HOST);
            this.usdtContractHex = this.tronWeb.address.toHex(USDT_CONTRACT_ADDRESS);
        } catch (error) {
            console.error('[WalletService] Failed to initialize TronWeb:', error.message);
            throw error;
        }
    }

    /**
     * @description 獲取單個地址的 TRX 餘額
     * @param {string} address - TRON 地址
     * @returns {Promise<number>} TRX 餘額
     */
    async getTrxBalance(address) {
        try {
            const balance = await this.tronWeb.trx.getBalance(address);
            return parseFloat(this.tronWeb.fromSun(balance));
        } catch (error) {
            console.error(`[WalletService] Error getting TRX balance for ${address}:`, error.message);
            return 0;
        }
    }

    /**
     * @description 獲取單個地址的 USDT 餘額
     * @param {string} address - TRON 地址
     * @returns {Promise<number>} USDT 餘額
     */
    async getUsdtBalance(address) {
        try {
            const addressHex = this.tronWeb.address.toHex(address);
            const transaction = await this.tronWeb.transactionBuilder.triggerConstantContract(
                this.usdtContractHex,
                'balanceOf(address)',
                {},
                [{ type: 'address', value: addressHex }],
                addressHex
            );

            if (!transaction || !transaction.constant_result || !transaction.constant_result[0]) {
                return 0;
            }

            const balance = '0x' + transaction.constant_result[0];
            const balanceBigInt = BigInt(balance);
            return parseFloat(balanceBigInt.toString()) / Math.pow(10, USDT_DECIMALS);
        } catch (error) {
            console.error(`[WalletService] Error getting USDT balance for ${address}:`, error.message);
            return 0;
        }
    }

    /**
     * @description 獲取單個地址的剩餘能量
     * @param {string} address - TRON 地址
     * @returns {Promise<number>} 剩餘能量
     */
    async getEnergy(address) {
        try {
            const resources = await this.tronWeb.trx.getAccountResources(address);
            const energyLimit = Number(resources?.EnergyLimit || 0);
            const energyUsed = Number(resources?.EnergyUsed || 0);
            const remaining = energyLimit - energyUsed;
            if (Number.isFinite(remaining)) {
                return Math.max(0, remaining);
            }
            return 0;
        } catch (error) {
            console.error(`[WalletService] Error getting energy for ${address}:`, error.message);
            return 0;
        }
    }

    /**
     * @description 獲取單個地址的質押 TRX
     * @param {string} address - TRON 地址
     * @returns {Promise<number>} 質押的 TRX 數量
     */
    async getStakedTrx(address) {
        try {
            const account = await this.tronWeb.trx.getAccount(address);
            const toNumber = (v) => {
                if (v === null || v === undefined) return 0;
                const n = Number(v);
                return Number.isFinite(n) ? n : 0;
            };
            let totalSun = 0;
            const frozen = account && account.frozen ? account.frozen : [];
            if (Array.isArray(frozen)) {
                for (const f of frozen) totalSun += toNumber(f?.frozen_balance);
            } else if (typeof frozen === 'object') {
                totalSun += toNumber(frozen.frozen_balance);
            }
            const frozenV2 = account && account.frozenV2 ? account.frozenV2 : [];
            if (Array.isArray(frozenV2)) {
                for (const f of frozenV2) totalSun += toNumber(f?.amount);
            }
            return totalSun / 1_000_000;
        } catch (error) {
            console.error(`[WalletService] Error getting staked TRX for ${address}:`, error.message);
            return 0;
        }
    }

    /**
     * @description 批量獲取多個錢包的鏈上餘額（並發控制）
     * @param {Array<{address: string, type: string}>} wallets - 錢包列表
     * @returns {Promise<Array<{address: string, usdt: number, trx: number, staked: number, energy: number}>>}
     */
    async getOnChainBalances(wallets) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H2',location:'WalletService.js:getOnChainBalances',message:'Method entry',data:{walletCount:wallets?.length},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        
        if (!Array.isArray(wallets) || wallets.length === 0) {
            return [];
        }

        // 過濾出有效的 TRC20 地址
        const validWallets = wallets.filter(w => 
            w && 
            w.address && 
            typeof w.address === 'string' && 
            w.address.startsWith('T')
        );

        if (validWallets.length === 0) {
            return [];
        }

        // 動態導入 p-limit（因為它是 ES Module）
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H2',location:'WalletService.js:getOnChainBalances',message:'Attempting dynamic import of p-limit',data:{},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        let pLimitModule;
        try {
            pLimitModule = await import('p-limit');
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H2',location:'WalletService.js:getOnChainBalances',message:'p-limit dynamic import succeeded',data:{hasDefault:'default' in pLimitModule},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
        } catch (error) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H2',location:'WalletService.js:getOnChainBalances',message:'p-limit dynamic import failed',data:{error:error.message},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            console.error('[WalletService] Failed to import p-limit:', error);
            throw new Error('Failed to load p-limit module: ' + error.message);
        }

        // p-limit@5.0.0 使用默認導出
        const pLimit = pLimitModule.default || pLimitModule;
        const limit = pLimit(CONCURRENT_LIMIT);

        // 為每個錢包創建獲取任務
        const tasks = validWallets.map(wallet => 
            limit(async () => {
                try {
                    const [usdt, trx, energy, staked] = await Promise.all([
                        this.getUsdtBalance(wallet.address),
                        this.getTrxBalance(wallet.address),
                        this.getEnergy(wallet.address),
                        this.getStakedTrx(wallet.address)
                    ]);

                    return {
                        address: wallet.address,
                        usdt: usdt,
                        trx: trx,
                        staked: staked,
                        energy: energy
                    };
                } catch (error) {
                    console.error(`[WalletService] Error processing wallet ${wallet.address}:`, error.message);
                    // 返回默認值而不是拋出錯誤
                    return {
                        address: wallet.address,
                        usdt: 0,
                        trx: 0,
                        staked: 0,
                        energy: 0
                    };
                }
            })
        );

        // 等待所有任務完成
        const results = await Promise.all(tasks);
        return results;
    }
}

// 單例模式
let walletServiceInstance = null;

function getWalletServiceInstance() {
    if (!walletServiceInstance) {
        try {
            walletServiceInstance = new WalletService();
        } catch (error) {
            console.error('[WalletService] Failed to create instance:', error.message);
            throw error;
        }
    }
    return walletServiceInstance;
}

module.exports = {
    getWalletServiceInstance,
    WalletService
};
