// 档案: backend/services/PayoutService.js (★★★ v8.1 新档案 ★★★)

const TronWeb = require('tronweb');
const db = require('../db');
const util = require('util');

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
     * @description 执行 TRC20-USDT 转帐
     * @param {object} withdrawalRequest - { id, chain_type, address (recipient), amount }
     * @returns {Promise<string>} 交易 Hash
     */
    async sendTrc20Payout(withdrawalRequest) {
        const { id, chain_type, address: recipientAddress, amount } = withdrawalRequest;

        if (chain_type !== 'TRC20') {
            throw new Error(`Auto-payout for chain ${chain_type} is not supported.`);
        }
        
        // (★★★ v8.1 修改：确保钱包已载入 ★★★)
        await this.ensureWalletsLoaded();
        
        if (!this.payoutWallet) {
             throw new Error("Payout wallet is not loaded or configured.");
        }

        const wallet = this.payoutWallet;
        console.log(`[v8 Payout] Attempting payout for WID-${id}: ${amount} USDT to ${recipientAddress} from ${wallet.address}`);
        
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