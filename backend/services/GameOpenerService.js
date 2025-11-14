// 檔案: backend/services/GameOpenerService.js (★★★ v8.49 修正版 ★★★)

const TronWeb = require('tronweb'); 
const db = require('../db');
const { getSettingsCache } = require('./settingsCache.js'); 
const util = require('util');

// (★★★ v8.49 修正：從 .env 讀取節點 ★★★)
const NILE_NODE_HOST = process.env.NILE_NODE_HOST;
if (!NILE_NODE_HOST) {
    throw new Error("CRITICAL: NILE_NODE_HOST is not set in .env file!");
}

class GameOpenerService {
    constructor() {
        this.settingsCache = getSettingsCache();

        // (★★★ v8.49 修正：使用 tronweb@5.3.2 的建構函式並指定新節點 ★★★)
        this.tronWeb = new TronWeb({
            fullHost: NILE_NODE_HOST,
            solidityHost: NILE_NODE_HOST,
            privateKey: '01', 
            timeout: 60000 
        });
        
        this.tronWeb.setFullNode(NILE_NODE_HOST);
        this.tronWeb.setSolidityNode(NILE_NODE_HOST);
        this.tronWeb.setEventServer(NILE_NODE_HOST);

        this.walletA_PrivateKey = null; 
        this.addressA = null;
        this.addressB = null;

        this._loadPlatformWallets();
        // (★★★ v8.49 修改日誌 ★★★)
        console.log(`✅ [v7] GameOpenerService initialized (v8.49 tronweb@5.3.2 / GetBlock Node).`);
    }

    // (_loadPlatformWallets 保持不變)
    async _loadPlatformWallets() {
        // ... (保持不變) ...
        try {
            const chainType = 'TRC20'; 
            const wallets = await db.query(
                "SELECT * FROM platform_wallets WHERE chain_type = $1 AND is_active = true",
                [chainType]
            );
            const openerA = wallets.rows.find(w => w.is_opener_a);
            if (openerA) {
                const pkEnvVar = `TRON_PK_${openerA.address}`;
                const privateKey = process.env[pkEnvVar];
                if (!privateKey) {
                    console.error(`[v7 Opener] CRITICAL: Opener Wallet A (${openerA.address}) found in DB, but its Private Key (${pkEnvVar}) is NOT in .env!`);
                } else {
                    this.walletA_PrivateKey = privateKey;
                    this.addressA = openerA.address;
                    console.log(`[v7 Opener] Opener Wallet A (TRC20) loaded: ${this.addressA}`);
                }
            } else {
                 console.error(`[v7 Opener] CRITICAL: No active 'is_opener_a' wallet (chain: ${chainType}) found.`);
            }
            const openerB = wallets.rows.find(w => w.is_opener_b);
            if (openerB) {
                 this.addressB = openerB.address;
                 console.log(`[v7 Opener] Opener Wallet B (TRC20) loaded: ${this.addressB}`);
            } else {
                 console.error(`[v7 Opener] CRITICAL: No active 'is_opener_b' wallet (chain: ${chainType}) found.`);
            }
        } catch (error) {
            console.error("[v7 Opener] Error loading platform wallets:", error);
        }
    }

    // (triggerBetTransaction 保持不變)
    async triggerBetTransaction() {
        if (!this.walletA_PrivateKey || !this.addressA || !this.addressB) {
            throw new Error("Opener wallets (A or B) are not configured.");
        }
        
        console.log(`[v7 Opener] Sending 0 TRX TX from ${this.addressA} to ${this.addressB}...`);
        
        try {
            this.tronWeb.setPrivateKey(this.walletA_PrivateKey);
            
            const tx = await this.tronWeb.transactionBuilder.sendTrx(
                this.addressB, // toAddress
                0, // amount (0 SUN)
                this.addressA // fromAddress
            );
            
            const signedTx = await this.tronWeb.trx.sign(tx);
            const receipt = await this.tronWeb.trx.sendRawTransaction(signedTx);
            
            if (!receipt || !receipt.txid) {
                 // (v8.49 修正：tronweb@5.x 成功時 receipt.result 為 true)
                if (receipt && receipt.result === true) {
                    // 這是成功的
                } else {
                    throw new Error("Transaction failed to broadcast or txid not returned.");
                }
            }
            
            const txHash = receipt.txid;
            
            console.log(`[v7 Opener] TX sent successfully. Hash: ${txHash}`);
            return txHash;

        } catch (error) {
            console.error("[v7 Opener] CRITICAL: Failed to send opener transaction (TRON):", error.message || error);
            logError(error, `Error in triggerBetTransaction`, this.addressA);
            throw new Error("On-chain transaction failed.");
        }
    }

    // (determineOutcome 保持不變)
    determineOutcome(txHash) {
        // ... (保持不變) ...
        const lastChar = txHash.slice(-1);
        const decimalValue = parseInt(lastChar, 16);
        const isHead = decimalValue % 2 === 0;
        console.log(`[v7 Opener] Outcome determined: Hash: ...${lastChar} (${decimalValue}) -> ${isHead ? 'HEAD' : 'TAIL'}`);
        return isHead;
    }
}

// (日誌輔助函數 保持不變)
function logError(error, context, address) {
    // ... (保持不變) ...
    console.error(`[v7 Opener] ${context} for address ${address}. Details:`);
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

// (單例模式保持不變)
let instance = null;
function getGameOpenerInstance() {
    if (!instance) {
        instance = new GameOpenerService();
    }
    return instance;
}

module.exports = {
    getGameOpenerInstance
};