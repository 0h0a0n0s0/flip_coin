// 檔案: backend/services/TronCollectionService.js (★★★ v7-M3 新檔案 ★★★)

const TronWeb = require('tronweb');
const db = require('../db');
const { getKmsInstance } = require('./KmsService');

// (TRC20 USDT (Mainnet) 合約地址)
const USDT_CONTRACT_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
// (激活地址所需的 TRX 數量 (單位 SUN, 1 TRX = 1,000,000 SUN))
const ACTIVATION_TRX_AMOUNT_SUN = 1000000; // 1 TRX
// (歸集觸發的最小 USDT 餘額 (單位 USDT))
const COLLECTION_THRESHOLD_USDT = 1.0; 
// (歸集時補足的 Gas (TRX) 數量 (單位 SUN))
const COLLECTION_GAS_TOPUP_SUN = 2000000; // 2 TRX (假設一次歸集消耗 1 TRX)

class TronCollectionService {
    
    constructor() {
        this.tronWeb = new TronWeb({
            fullHost: 'https://api.trongrid.io',
            headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' },
            privateKey: '01' // (初始化時隨便填一個，實際操作時會動態載入)
        });

        this.kmsService = getKmsInstance();
        
        // (快取平台錢包)
        this.gasReserveWallet = null; // { address, privateKey }
        this.collectionWallets = []; // string[]
        
        this._loadPlatformWallets();
        console.log("✅ [v7] TronCollectionService initialized.");
    }

    /**
     * 從 DB 載入並快取 Gas 儲備錢包和歸集錢包
     */
    async _loadPlatformWallets() {
        try {
            const wallets = await db.query(
                "SELECT * FROM platform_wallets WHERE chain_type = 'TRC20' AND is_active = true"
            );
            
            // 1. 查找 Gas 儲備錢包 (激活錢包)
            const gasWalletRow = wallets.rows.find(w => w.is_gas_reserve);
            if (gasWalletRow) {
                // (★★★ 警告：私鑰必須在 .env 中按地址命名 ★★★)
                // 例如：TRON_PK_T...
                const pkEnvVar = `TRON_PK_${gasWalletRow.address}`;
                const privateKey = process.env[pkEnvVar];
                
                if (!privateKey) {
                    console.error(`[v7 Collection] CRITICAL: Gas Reserve Wallet (${gasWalletRow.address}) found in DB, but its Private Key (${pkEnvVar}) is NOT in .env!`);
                } else {
                    this.gasReserveWallet = {
                        address: gasWalletRow.address,
                        privateKey: privateKey
                    };
                    console.log(`[v7 Collection] Gas Reserve Wallet (TRC20) loaded: ${this.gasReserveWallet.address}`);
                }
            } else {
                 console.error("[v7 Collection] CRITICAL: No active 'is_gas_reserve' wallet (TRC20) found in 'platform_wallets' table.");
            }
            
            // 2. 查找歸集錢包
            this.collectionWallets = wallets.rows
                .filter(w => w.is_collection)
                .map(w => w.address);
                
            if (this.collectionWallets.length === 0) {
                 console.error("[v7 Collection] CRITICAL: No active 'is_collection' wallet (TRC20) found in 'platform_wallets' table.");
            } else {
                 console.log(`[v7 Collection] Collection Wallets (TRC20) loaded: ${this.collectionWallets.join(', ')}`);
            }
            
        } catch (error) {
            console.error("[v7 Collection] Error loading platform wallets:", error);
        }
    }

    /**
     * (M3 需求) 激活新用戶的 TRC20 地址
     * @param {string} toAddress - 用戶的 tron_deposit_address
     */
    async activateAddress(toAddress) {
        if (!this.gasReserveWallet) {
            console.error(`[v7 Activate] Failed: No Gas Reserve Wallet loaded.`);
            return false;
        }
        
        console.log(`[v7 Activate] Attempting to activate ${toAddress} with 1 TRX...`);
        
        try {
            this.tronWeb.setPrivateKey(this.gasReserveWallet.privateKey);
            const tx = await this.tronWeb.transactionBuilder.sendTrx(
                toAddress,
                ACTIVATION_TRX_AMOUNT_SUN,
                this.gasReserveWallet.address
            );
            const signedTx = await this.tronWeb.trx.sign(tx);
            const receipt = await this.tronWeb.trx.sendRawTransaction(signedTx);
            
            if (receipt.result) {
                console.log(`[v7 Activate] SUCCESS: Address ${toAddress} activated. TX: ${receipt.txid}`);
                return true;
            } else {
                 console.error(`[v7 Activate] FAILED (No Result): Address ${toAddress}. Receipt:`, receipt);
                 return false;
            }
        } catch (error) {
            console.error(`[v7 Activate] CRITICAL Error activating ${toAddress}:`, error.message || error);
            return false;
        }
    }

    /**
     * (M3 需求) 執行歸集 (由定時任務調用)
     */
    async collectFunds() {
        if (!this.gasReserveWallet || this.collectionWallets.length === 0) {
            console.warn("[v7 Collect] Skipping collection run: Gas or Collection wallet not configured.");
            return;
        }
        
        console.log("[v7 Collect] Starting collection sweep...");

        // 1. 查找所有*可能*有餘額的用戶地址
        // (優化：只查找今天有活動的用戶，或餘額 > 0 的用戶，但為簡單起見，我們先掃描所有用戶)
        const usersResult = await db.query(
            "SELECT id, user_id, deposit_path_index, tron_deposit_address FROM users WHERE tron_deposit_address IS NOT NULL"
        );
        
        let collectedCount = 0;

        for (const user of usersResult.rows) {
            const userAddress = user.tron_deposit_address;
            const userPathIndex = user.deposit_path_index;
            
            try {
                // 2. 查詢 USDT 餘額
                const usdtBalance = await this.tronWeb.trx.getTokenBalance(userAddress, USDT_CONTRACT_ADDRESS);

                if (usdtBalance >= (COLLECTION_THRESHOLD_USDT * (10**6))) {
                    console.log(`[v7 Collect] Found ${usdtBalance / (10**6)} USDT in ${userAddress} (User: ${user.user_id})`);
                    
                    // 3. 獲取用戶地址的私鑰 (★★★ 關鍵 ★★★)
                    const userPrivateKey = this.kmsService.getPrivateKey('TRC20', userPathIndex);
                    
                    // 4. 檢查 TRX (Gas) 餘額
                    const trxBalance = await this.tronWeb.trx.getBalance(userAddress);
                    
                    // (如果 Gas 不足 1 TRX)
                    if (trxBalance < 1000000) {
                        await this._topUpGas(userAddress);
                    }

                    // 5. 執行歸集
                    await this._transferUsdt(userPrivateKey, userAddress, usdtBalance);
                    collectedCount++;
                }

            } catch (error) {
                console.error(`[v7 Collect] Error processing address ${userAddress}:`, error.message);
            }
        }
        
        if (collectedCount > 0) {
            console.log(`[v7 Collect] Collection sweep finished. ${collectedCount} addresses processed.`);
        }
    }

    /**
     * (輔助) 補足 Gas
     */
    async _topUpGas(toAddress) {
        console.log(`[v7 Collect] Topping up ${toAddress} with ${COLLECTION_GAS_TOPUP_SUN / 1000000} TRX for collection...`);
        try {
            this.tronWeb.setPrivateKey(this.gasReserveWallet.privateKey);
            const tx = await this.tronWeb.transactionBuilder.sendTrx(
                toAddress,
                COLLECTION_GAS_TOPUP_SUN,
                this.gasReserveWallet.address
            );
            const signedTx = await this.tronWeb.trx.sign(tx);
            await this.tronWeb.trx.sendRawTransaction(signedTx);
            console.log(`[v7 Collect] Gas top-up sent to ${toAddress}.`);
            // (等待幾秒鐘讓 Gas 到帳)
            await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (error) {
            console.error(`[v7 Collect] Error topping up gas for ${toAddress}:`, error.message);
            throw new Error("Gas top-up failed"); // (拋出錯誤，中斷此次歸集)
        }
    }

    /**
     * (輔助) 轉移 USDT
     */
    async _transferUsdt(userPrivateKey, userAddress, amount) {
        // (輪巡隨機選擇一個歸集地址)
        const collectionAddress = this.collectionWallets[0]; // (為簡單起見，先用第一個)
        
        console.log(`[v7 Collect] Transferring ${amount / (10**6)} USDT from ${userAddress} to ${collectionAddress}...`);
        
        try {
            this.tronWeb.setPrivateKey(userPrivateKey);
            const contract = await this.tronWeb.contract().at(USDT_CONTRACT_ADDRESS);
            
            // (注意：USDT 轉帳金額是原始單位)
            const txid = await contract.transfer(collectionAddress, amount).send({
                feeLimit: 15000000, // 15 TRX
                callValue: 0,
                shouldPollResponse: false // (我們不需要等待結果)
            });
            
            console.log(`[v7 Collect] SUCCESS: Transfer initiated. TX: ${txid}`);
            
        } catch (error) {
             console.error(`[v7 Collect] CRITICAL Error transferring USDT from ${userAddress}:`, error.message);
        }
    }
}

// (使用單例模式)
let instance = null;
function getTronCollectionInstance() {
    if (!instance) {
        instance = new TronCollectionService();
    }
    return instance;
}

module.exports = {
    getTronCollectionInstance
};