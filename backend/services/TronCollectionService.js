// 檔案: backend/services/TronCollectionService.js (★★★ v8.16 最終修正版 ★★★)

const TronWeb = require('tronweb');
const db = require('../db');
const { getKmsInstance } = require('./KmsService');

const USDT_CONTRACT_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; 
const USDT_DECIMALS = 6; // (你已加入)
const ACTIVATION_TRX_AMOUNT_SUN = 1000000; // 1 TRX
const COLLECTION_THRESHOLD_USDT = 1.0; 
const COLLECTION_GAS_TOPUP_SUN = 2000000; // 2 TRX

class TronCollectionService {
    
    constructor() {
        // (★★★ 修正 1：增加 60 秒超時設定 ★★★)
        this.tronWeb = new TronWeb({
            fullHost: 'https://nile.trongrid.io', 
            headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' },
            privateKey: '01',
            timeout: 60000 // (設定 60 秒超時)
        });

        this.kmsService = getKmsInstance();
        
        this.gasReserveWallet = null; 
        this.collectionWallets = []; 
        
        this._loadPlatformWallets();
        console.log("✅ [v7] TronCollectionService (NILE TESTNET) initialized (API Key Used).");
    }

    // (_loadPlatformWallets 函數保持不變)
    async _loadPlatformWallets() {
        try {
            const wallets = await db.query(
                "SELECT * FROM platform_wallets WHERE chain_type = 'TRC20' AND is_active = true"
            );
            
            // 1. 查找 Gas 儲備錢包 (激活錢包)
            const gasWalletRow = wallets.rows.find(w => w.is_gas_reserve);
            if (gasWalletRow) {
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

    // (activateAddress 函數保持不變)
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

    // (collectFunds 函數)
    async collectFunds() {
        if (!this.gasReserveWallet || this.collectionWallets.length === 0) {
            console.warn("[v7 Collect] Skipping collection run: Gas or Collection wallet not configured.");
            return;
        }
        
        console.log("[v7 Collect] Starting collection sweep...");

        const usersResult = await db.query(
            "SELECT id, user_id, deposit_path_index, tron_deposit_address FROM users WHERE tron_deposit_address IS NOT NULL"
        );
        
        let collectedCount = 0;

        for (const user of usersResult.rows) {
            const userAddress = user.tron_deposit_address;
            const userPathIndex = user.deposit_path_index;
            
            try {
                const contract = await this.tronWeb.contract().at(USDT_CONTRACT_ADDRESS);
                const usdtBalanceBigNumber = await contract.balanceOf(userAddress).call();
                const usdtBalance = parseFloat(usdtBalanceBigNumber.toString()) / (10**USDT_DECIMALS);

                if (usdtBalance >= COLLECTION_THRESHOLD_USDT) {
                    console.log(`[v7 Collect] Found ${usdtBalance} USDT in ${userAddress} (User: ${user.user_id})`);
                    
                    const userPrivateKey = this.kmsService.getPrivateKey('TRC20', userPathIndex);
                    const trxBalance = await this.tronWeb.trx.getBalance(userAddress);
                    
                    if (trxBalance < 1000000) {
                        await this._topUpGas(userAddress);
                    }

                    await this._transferUsdt(userPrivateKey, userAddress, usdtBalanceBigNumber);
                    collectedCount++;
                }

            } catch (error) {
                // (★★★ 修正 2：打印完整的 error 物件 ★★★)
                console.error(`[v7 Collect] Error processing address ${userAddress}:`, error);
            }
        }
        
        if (collectedCount > 0) {
            console.log(`[v7 Collect] Collection sweep finished. ${collectedCount} addresses processed.`);
        }
    }

    // (_topUpGas 函數保持不變)
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
            await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (error) {
            console.error(`[v7 Collect] Error topping up gas for ${toAddress}:`, error.message);
            throw new Error("Gas top-up failed"); 
        }
    }

    // (_transferUsdt 函數保持不變)
    async _transferUsdt(userPrivateKey, userAddress, amountBigNumber) {
        const collectionAddress = this.collectionWallets[0]; 
        
        console.log(`[v7 Collect] Transferring ${Number(amountBigNumber) / (10**USDT_DECIMALS)} USDT from ${userAddress} to ${collectionAddress}...`);
        
        try {
            this.tronWeb.setPrivateKey(userPrivateKey);
            const contract = await this.tronWeb.contract().at(USDT_CONTRACT_ADDRESS);
            
            const txid = await contract.transfer(collectionAddress, amountBigNumber).send({
                feeLimit: 15000000, 
                callValue: 0,
                shouldPollResponse: false 
            });
            
            console.log(`[v7 Collect] SUCCESS: Transfer initiated. TX: ${txid}`);
            
        } catch (error) {
             console.error(`[v7 Collect] CRITICAL Error transferring USDT from ${userAddress}:`, error.message);
        }
    }
}

// (單例模式保持不變)
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