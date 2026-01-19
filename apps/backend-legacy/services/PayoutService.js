// 档案: backend/services/PayoutService.js (★★★ v8.1 新档案 ★★★)

const TronWeb = require('tronweb');
const db = require('@flipcoin/database');
const util = require('util');
const { getAlertInstance } = require('./AlertService');

// (从 .env 读取节点)
const NILE_NODE_HOST = process.env.NILE_NODE_HOST;
if (!NILE_NODE_HOST) {
    throw new Error("CRITICAL: NILE_NODE_HOST is not set in .env file!");
}

// (Nile 測試网的 USDT 合约地址)
const DEFAULT_USDT_CONTRACT = 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';
const USDT_CONTRACT_ADDRESS = process.env.USDT_CONTRACT_ADDRESS || DEFAULT_USDT_CONTRACT;
const USDT_DECIMALS = 6;

// (日志辅助函数)
function logError(error, context, address) {
    console.error(`[v8 Payout] ${context} for address ${address}. Details:`);
    try {
        if (error && error.message) {
            console.error(JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        } else {
             console.error(JSON.stringify(error, null, 2));
        }
    } catch (e) {
        console.error(util.inspect(error, { depth: null, showHidden: true }));
    }
}

class PayoutService {
    
    constructor() {
        this.tronWeb = new TronWeb({
            fullHost: NILE_NODE_HOST,
            solidityHost: NILE_NODE_HOST,
            privateKey: '01', // 占位符
            timeout: 120000 
        });
        
        this.tronWeb.setFullNode(NILE_NODE_HOST);
        this.tronWeb.setSolidityNode(NILE_NODE_HOST);
        this.tronWeb.setEventServer(NILE_NODE_HOST);

        this.usdtContractHex = this.tronWeb.address.toHex(USDT_CONTRACT_ADDRESS);
        
        console.log(`✅ [v8 Payout] PayoutService (NILE TESTNET) initialized.`);
        console.log(`[v8 Payout] USDT Contract Address: ${USDT_CONTRACT_ADDRESS}`);

        this.payoutWallet = null; // (目前只支援一個出款钱包)
        this._loadPromise = null; // (用于追蹤载入狀态)
        this.alertService = getAlertInstance(); // (★★★ v9.0 新增：警報服務 ★★★)
        this.lastLowBalanceAlertTime = null; // (用於防止重複警報)
        this.LOW_BALANCE_THRESHOLD = parseFloat(process.env.PAYOUT_LOW_BALANCE_THRESHOLD || '100'); // 默認 100 USDT
        
        // (★★★ v8.1 修改：不在此处调用異步方法，改为在需要时调用 ★★★)
        // this._loadPayoutWallets();
    }

    /**
     * @description 载入标记为 'is_payout' 的钱包及其私钥
     */
    async _loadPayoutWallets() {
        // (★★★ v8.1 修改：如果正在载入中，返回現有的 Promise ★★★)
        if (this._loadPromise) {
            return this._loadPromise;
        }
        
        this._loadPromise = (async () => {
            try {
                const wallets = await db.query(
                    "SELECT * FROM platform_wallets WHERE chain_type = 'TRC20' AND is_payout = true AND is_active = true"
                );
                
                // (目前只使用第一個找到的钱包)
                const payoutWalletRow = wallets.rows.find(w => w.is_payout);
                
                if (payoutWalletRow) {
                    // (★★★ 安全檢查：防止能量提供者钱包被用于出款 ★★★)
                    if (payoutWalletRow.is_energy_provider) {
                        console.error(`[v8 Payout] ⚠️ SECURITY WARNING: Payout Wallet (${payoutWalletRow.address}) is also marked as energy provider!`);
                        console.error(`[v8 Payout] This will cause energy depletion. Please separate these roles.`);
                        console.error(`[v8 Payout] Payout wallet should NOT be used as energy provider.`);
                        // 不阻止加载，但记录警告
                    }
                    
                    const pkEnvVar = `TRON_PK_${payoutWalletRow.address}`;
                    const privateKey = process.env[pkEnvVar];
                    
                    if (!privateKey) {
                        console.error(`[v8 Payout] CRITICAL: Payout Wallet (${payoutWalletRow.address}) found in DB, but its Private Key (${pkEnvVar}) is NOT in .env!`);
                    } else {
                        this.payoutWallet = { address: payoutWalletRow.address, privateKey: privateKey };
                        console.log(`[v8 Payout] Payout Wallet (TRC20) loaded: ${this.payoutWallet.address}`);
                    }
                } else {
                     console.error("[v8 Payout] CRITICAL: No active 'is_payout' wallet (TRC20) found in 'platform_wallets' table.");
                }
            } catch (error) {
                console.error("[v8 Payout] Error loading platform wallets:", error);
                throw error; // (重新拋出错误以便调用者处理)
            } finally {
                this._loadPromise = null; // (载入完成後清除 Promise)
            }
        })();
        
        return this._loadPromise;
    }

    /**
     * @description 检查服务是否准备就绪 (是否有载入钱包)
     */
    isReady() {
        return !!this.payoutWallet;
    }

    /**
     * @description 确保钱包已载入（如果尚未载入，則異步载入）
     */
    async ensureWalletsLoaded() {
        if (!this.payoutWallet) {
            await this._loadPayoutWallets();
        }
    }

    /**
     * @description 檢查出款錢包餘額
     * @private
     */
    async _checkPayoutWalletBalance() {
        if (!this.payoutWallet) {
            return null;
        }
        
        try {
            const walletAddressHex = this.tronWeb.address.toHex(this.payoutWallet.address);
            const transaction = await this.tronWeb.transactionBuilder.triggerConstantContract(
                this.usdtContractHex,
                'balanceOf(address)',
                {},
                [{ type: 'address', value: walletAddressHex }],
                walletAddressHex
            );

            if (!transaction || !transaction.constant_result || !transaction.constant_result[0]) {
                throw new Error('balanceOf call failed: No constant_result');
            }
            
            const balance = '0x' + transaction.constant_result[0];
            const balanceBigInt = BigInt(balance);
            const balanceUSDT = Number(balanceBigInt) / (10**USDT_DECIMALS);
            
            return balanceUSDT;
        } catch (error) {
            console.error('[v8 Payout] Failed to check wallet balance:', error.message);
            return null;
        }
    }

    /**
     * @description 執行 TRC20-USDT 轉帳
     * @param {object} withdrawalRequest - { id, chain_type, address (recipient), amount }
     * @returns {Promise<string>} 交易 Hash
     */
    async sendTrc20Payout(withdrawalRequest) {
        const { id, chain_type, address: recipientAddress, amount } = withdrawalRequest;

        if (chain_type !== 'TRC20') {
            throw new Error(`Auto-payout for chain ${chain_type} is not supported.`);
        }
        
        // (★★★ v8.1 修改：確保錢包已載入 ★★★)
        await this.ensureWalletsLoaded();
        
        if (!this.payoutWallet) {
             throw new Error("Payout wallet is not loaded or configured.");
        }

        const wallet = this.payoutWallet;
        console.log(`[v8 Payout] Attempting payout for WID-${id}: ${amount} USDT to ${recipientAddress} from ${wallet.address}`);
        
        // #region agent log
        try {
            const payoutAccount = await this.tronWeb.trx.getAccount(wallet.address);
            const energyBefore = payoutAccount.energy || 0;
            fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PayoutService.js:sendTrc20Payout',message:'Before payout transfer - energy check',data:{payoutWallet:wallet.address,withdrawalId:id,recipientAddress,amount,energyBefore},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'D'})}).catch(()=>{});
        } catch (e) {
            // Ignore energy check errors
        }
        // #endregion
        
        // (★★★ v9.0 新增：檢查餘額並發送警報 ★★★)
        const balance = await this._checkPayoutWalletBalance();
        if (balance !== null && balance < this.LOW_BALANCE_THRESHOLD) {
            const now = Date.now();
            // 防止重複警報（每小時最多一次）
            if (!this.lastLowBalanceAlertTime || (now - this.lastLowBalanceAlertTime) > 3600000) {
                await this.alertService.sendCritical(
                    `出款錢包餘額不足！\n\n` +
                    `地址: ${wallet.address}\n` +
                    `當前餘額: ${balance.toFixed(2)} USDT\n` +
                    `閾值: ${this.LOW_BALANCE_THRESHOLD} USDT\n` +
                    `請立即充值！`,
                    { extra: `出款請求 ID: ${id}` }
                );
                this.lastLowBalanceAlertTime = now;
            }
        }
        
        try {
            this.tronWeb.setPrivateKey(wallet.privateKey);
            
            // 1. 准备参数
            const amountInSun = BigInt(Math.floor(amount * (10**USDT_DECIMALS))).toString();
            const recipientHex = this.tronWeb.address.toHex(recipientAddress);
            const fromHex = this.tronWeb.address.toHex(wallet.address);
            
            // 2. 建立交易
            const transaction = await this.tronWeb.transactionBuilder.triggerSmartContract(
                this.usdtContractHex,
                'transfer(address,uint256)',
                { feeLimit: 15000000, callValue: 0 },
                [
                    { type: 'address', value: recipientHex },
                    { type: 'uint256', value: amountInSun }
                ],
                fromHex
            );

            if (!transaction || !transaction.result || !transaction.result.result) {
                throw new Error('transfer build failed: No transaction object returned');
            }

            // 3. 签名
            const signedTx = await this.tronWeb.trx.sign(transaction.transaction);

            // 4. 广播
            const receipt = await this.tronWeb.trx.sendRawTransaction(signedTx);
            
            if (!receipt || (!receipt.txid && receipt.result !== true)) {
                 // (如果 receipt 有 code，表示失败)
                if (receipt && receipt.code) {
                    const errorMsg = receipt.message ? Buffer.from(receipt.message, 'hex').toString('utf8') : receipt.code;
                    throw new Error(`On-chain broadcast failed: ${errorMsg}`);
                }
                throw new Error('transfer broadcast failed: No txid returned');
            }
            
            const txHash = receipt.txid;
            console.log(`[v8 Payout] SUCCESS (WID-${id}): Transfer initiated. TX: ${txHash}`);
            
            // #region agent log
            try {
                const payoutAccountAfter = await this.tronWeb.trx.getAccount(wallet.address);
                const energyAfter = payoutAccountAfter.energy || 0;
                fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PayoutService.js:sendTrc20Payout',message:'After payout transfer - energy check',data:{payoutWallet:wallet.address,withdrawalId:id,txHash,energyAfter},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'D'})}).catch(()=>{});
            } catch (e) {
                // Ignore energy check errors
            }
            // #endregion
            
            return txHash;

        } catch (error) {
             logError(error, `Error in sendTrc20Payout (WID-${id})`, wallet.address);
             // (拋出错误，让 server.js 捕捉并将其转为人工審核)
             throw error; 
        }
    }
}

// (单例模式)
let instance = null;
function getPayoutServiceInstance() {
    if (!instance) {
        instance = new PayoutService();
    }
    return instance;
}

module.exports = {
    getPayoutServiceInstance
};