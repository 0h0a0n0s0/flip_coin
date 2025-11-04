// 檔案: backend/services/GameOpenerService.js (★★★ v7-M5 新檔案 ★★★)

const { ethers } = require('ethers');
const db = require('../db');
const { getSettingsCache } = require('../server.js'); // (我們將從 server.js 導出快取)

class GameOpenerService {
    constructor() {
        if (!process.env.SEPOLIA_RPC_URL) {
            throw new Error("CRITICAL: SEPOLIA_RPC_URL is not set in .env!");
        }
        
        // 1. 初始化 Provider
        this.provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
        
        // 2. 錢包 A (發送方) 和 B (接收方)
        this.walletA = null; // (將從 _loadPlatformWallets 載入)
        this.addressB = null;

        this._loadPlatformWallets();
        console.log("✅ [v7] GameOpenerService initialized.");
    }

    /**
     * 從 DB 載入並快取開獎錢包 A (含私鑰) 和 B
     */
    async _loadPlatformWallets() {
        try {
            // (我們假設開獎也使用 EVM 鏈 (Sepolia)，因此 chain_type 可能是 ETH)
            // (如果您的 A/B 地址在 TRON，請修改 chain_type = 'TRC20')
            const chainType = 'ETH'; // (假設使用 Sepolia ETH)
            
            const wallets = await db.query(
                "SELECT * FROM platform_wallets WHERE chain_type = $1 AND is_active = true",
                [chainType]
            );

            // 1. 查找 Opener A (發送方)
            const openerA = wallets.rows.find(w => w.is_opener_a);
            if (openerA) {
                // (★★★ 警告：私鑰必須在 .env 中按地址命名 ★★★)
                // 例如：ETH_PK_0x...
                const pkEnvVar = `ETH_PK_${openerA.address}`;
                const privateKey = process.env[pkEnvVar];
                
                if (!privateKey) {
                    console.error(`[v7 Opener] CRITICAL: Opener Wallet A (${openerA.address}) found in DB, but its Private Key (${pkEnvVar}) is NOT in .env!`);
                } else {
                    // (★★★ 關鍵：使用 privateKey 和 provider 實例化錢包 ★★★)
                    this.walletA = new ethers.Wallet(privateKey, this.provider);
                    console.log(`[v7 Opener] Opener Wallet A (ETH) loaded: ${this.walletA.address}`);
                }
            } else {
                 console.error(`[v7 Opener] CRITICAL: No active 'is_opener_a' wallet (chain: ${chainType}) found.`);
            }
            
            // 2. 查找 Opener B (接收方)
            const openerB = wallets.rows.find(w => w.is_opener_b);
            if (openerB) {
                 this.addressB = openerB.address;
                 console.log(`[v7 Opener] Opener Wallet B (ETH) loaded: ${this.addressB}`);
            } else {
                 console.error(`[v7 Opener] CRITICAL: No active 'is_opener_b' wallet (chain: ${chainType}) found.`);
            }
            
        } catch (error) {
            console.error("[v7 Opener] Error loading platform wallets:", error);
        }
    }

    /**
     * 觸發一次開獎交易 (A -> B)
     * @returns {Promise<string>} 交易 Hash (tx.hash)
     */
    async triggerBetTransaction() {
        if (!this.walletA || !this.addressB) {
            throw new Error("Opener wallets (A or B) are not configured.");
        }
        
        console.log(`[v7 Opener] Sending 0 ETH TX from ${this.walletA.address} to ${this.addressB}...`);
        
        try {
            // (發送 0 ETH 交易)
            const txRequest = {
                to: this.addressB,
                value: ethers.parseEther("0")
                // (Gas 價格和限制將由 ethers.js 自動估算)
            };
            
            const txResponse = await this.walletA.sendTransaction(txRequest);
            
            // (★★★ 關鍵：根據用戶需求，我們只返回 hash，不等待確認 ★★★)
            console.log(`[v7 Opener] TX sent successfully. Hash: ${txResponse.hash}`);
            return txResponse.hash;

        } catch (error) {
            console.error("[v7 Opener] CRITICAL: Failed to send opener transaction:", error.message);
            throw new Error("On-chain transaction failed.");
        }
    }

    /**
     * 根據 TX Hash 決定輸贏
     * @param {string} txHash 
     * @returns {boolean} true for 'head' (正面), false for 'tail' (反面)
     */
    determineOutcome(txHash) {
        // (使用最後一個字符)
        const lastChar = txHash.slice(-1);
        const decimalValue = parseInt(lastChar, 16);
        
        // ( 0, 2, 4, 6, 8, A, C, E ) -> Head (true)
        // ( 1, 3, 5, 7, 9, B, D, F ) -> Tail (false)
        const isHead = decimalValue % 2 === 0;
        
        console.log(`[v7 Opener] Outcome determined: Hash: ...${lastChar} (${decimalValue}) -> ${isHead ? 'HEAD' : 'TAIL'}`);
        return isHead;
    }
}

// (使用單例模式)
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