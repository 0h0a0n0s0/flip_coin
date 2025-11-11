// 檔案: backend/services/TronCollectionService.js (★★★ v8.36 繞過 Bug 版 ★★★)

const TronWeb = require('tronweb');
const db = require('../db');
const { getKmsInstance } = require('./KmsService');
const util = require('util'); 

const USDT_CONTRACT_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; 
const USDT_DECIMALS = 6;
const ACTIVATION_TRX_AMOUNT_SUN = 1000000; // 1 TRX
const COLLECTION_THRESHOLD_USDT = 1.0; 
// (v8.29 修正：_topUpGas 日誌使用 ACTIVATION_TRX_AMOUNT_SUN)

// (日誌輔助函數保持不變)
function logError(error, context, address) {
    console.error(`[v7 Collect] ${context} for address ${address}. Details:`);
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


class TronCollectionService {
    
    constructor() {
        // (★★★ v8.35 修正：手動強制設定所有節點 ★★★)
        this.tronWeb = new TronWeb({
            fullHost: 'https://nile.trongrid.io',
            privateKey: '01',
            timeout: 60000 
        });
        this.tronWeb.setFullNode('https://nile.trongrid.io');
        this.tronWeb.setSolidityNode('https://nile.trongrid.io');
        this.tronWeb.setEventServer('https://nile.trongrid.io');
        // (★★★ v8.35 日誌 ★★★)
        console.log("✅ [v7] TronCollectionService (NILE TESTNET) initialized (v8.35 Force Set Nodes).");


        this.kmsService = getKmsInstance();
        this.gasReserveWallet = null; 
        this.collectionWallets = []; 
        
        this._loadPlatformWallets();
    }

    // (_loadPlatformWallets 保持不變)
    async _loadPlatformWallets() {
        try {
            const wallets = await db.query(
                "SELECT * FROM platform_wallets WHERE chain_type = 'TRC20' AND is_active = true"
            );
            const gasWalletRow = wallets.rows.find(w => w.is_gas_reserve);
            if (gasWalletRow) {
                const pkEnvVar = `TRON_PK_${gasWalletRow.address}`;
                const privateKey = process.env[pkEnvVar];
                if (!privateKey) {
                    console.error(`[v7 Collection] CRITICAL: Gas Reserve Wallet (${gasWalletRow.address}) found in DB, but its Private Key (${pkEnvVar}) is NOT in .env!`);
                } else {
                    this.gasReserveWallet = { address: gasWalletRow.address, privateKey: privateKey };
                    console.log(`[v7 Collection] Gas Reserve Wallet (TRC20) loaded: ${this.gasReserveWallet.address}`);
                }
            } else {
                 console.error("[v7 Collection] CRITICAL: No active 'is_gas_reserve' wallet (TRC20) found in 'platform_wallets' table.");
            }
            this.collectionWallets = wallets.rows.filter(w => w.is_collection).map(w => w.address);
            if (this.collectionWallets.length === 0) {
                 console.error("[v7 Collection] CRITICAL: No active 'is_collection' wallet (TRC20) found in 'platform_wallets' table.");
            } else {
                 console.log(`[v7 Collection] Collection Wallets (TRC20) loaded: ${this.collectionWallets.join(', ')}`);
            }
        } catch (error) {
            console.error("[v7 Collection] Error loading platform wallets:", error);
        }
    }

    // (activateAddress 保持不變)
    async activateAddress(toAddress) {
        if (!this.gasReserveWallet) {
            console.error(`[v7 Activate] Failed: No Gas Reserve Wallet loaded.`);
            return false;
        }
        console.log(`[v7 Activate] Attempting to activate ${toAddress} with 1 TRX...`);
        try {
            this.tronWeb.setPrivateKey(this.gasReserveWallet.privateKey);
            const tx = await this.tronWeb.transactionBuilder.sendTrx(toAddress, ACTIVATION_TRX_AMOUNT_SUN, this.gasReserveWallet.address);
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
            logError(error, 'CRITICAL Error activating', toAddress);
            return false;
        }
    }
    
    // (★★★ v8.36 輔助函數：取代 .call() ★★★)
    async _getUsdtBalance(userAddress) {
        try {
            const transaction = await this.tronWeb.transactionBuilder.triggerConstantContract(
                USDT_CONTRACT_ADDRESS,
                'balanceOf(address)', // 函數選擇器
                {}, // 選項
                [{ type: 'address', value: userAddress }], // 參數
                // (issuer address - 隨便填一個我們已知的地址，例如 Gas 錢包)
                this.tronWeb.address.toHex(this.gasReserveWallet.address) 
            );

            if (!transaction || !transaction.constant_result || !transaction.constant_result[0]) {
                throw new Error('balanceOf call failed: No constant_result');
            }
            
            // (返回未格式化的 BigNumber 字符串)
            return '0x' + transaction.constant_result[0];
            
        } catch (error) {
            // (如果節點返回 "Smart contract is not exist"，錯誤會在這裡被捕獲)
            logError(error, `_getUsdtBalance (triggerConstantContract)`, userAddress);
            throw error;
        }
    }


    // (collectFunds 函數 - ★★★ v8.36 邏輯重排 ★★★)
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
        
        // (我們不再需要 usdtContract 實例)

        for (const user of usersResult.rows) {
            const userAddress = user.tron_deposit_address;
            const userPathIndex = user.deposit_path_index;
            
            let usdtBalance = 0;
            let trxBalance = 0;

            // --- 步驟 1: 檢查 TRX 餘額 (getBalance) ---
            try {
                trxBalance = await this.tronWeb.trx.getBalance(userAddress);
            } catch (gasCheckError) {
                trxBalance = 0; 
                logError(gasCheckError, `STEP 1 INFO (getBalance failed, assuming 0 TRX)`, userAddress);
            }

            // --- 步驟 2: 補 Gas (如果帳戶未啟用) ---
            if (trxBalance < 1000000) { // (小於 1 TRX - 包含 0)
                try {
                    await this._topUpGas(userAddress);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                } catch (topUpError) {
                    logError(topUpError, `STEP 2 FAILED (_topUpGas)`, userAddress);
                    continue; // 處理下一個用戶
                }
            }
            
            let usdtBalanceBigNumberStr;
            // --- 步驟 3: 檢查 USDT 餘額 (使用 triggerConstantContract) ---
            try {
                usdtBalanceBigNumberStr = await this._getUsdtBalance(userAddress);
                usdtBalance = parseFloat(BigInt(usdtBalanceBigNumberStr).toString()) / (10**USDT_DECIMALS);
            } catch (balanceError) {
                logError(balanceError, `STEP 3 FAILED (_getUsdtBalance)`, userAddress);
                continue; // 處理下一個用戶
            }

            if (usdtBalance < COLLECTION_THRESHOLD_USDT) {
                continue; // 餘額不足，跳過
            }
            
            console.log(`[v7 Collect] Found ${usdtBalance} USDT in ${userAddress} (User: ${user.user_id})`);

            // --- 步驟 4: 歸集 (使用 triggerSmartContract) ---
            try {
                const userPrivateKey = this.kmsService.getPrivateKey('TRC20', userPathIndex);
                // (重新獲取一次餘額，確保準確)
                const amountBigNumberStr = (await this._getUsdtBalance(userAddress)).toString();
                
                await this._transferUsdt(userPrivateKey, userAddress, amountBigNumberStr);
                collectedCount++;
            } catch (transferError) {
                logError(transferError, `STEP 4 FAILED (_transferUsdt)`, userAddress);
                continue; // 處理下一個用戶
            }
        }
        
        if (collectedCount > 0) {
            console.log(`[v7 Collect] Collection sweep finished. ${collectedCount} addresses processed.`);
        }
    }

    // (_topUpGas 函數 - v8.29 修正日誌)
    async _topUpGas(toAddress) {
        console.log(`[v7 Collect] Topping up ${toAddress} with ${ACTIVATION_TRX_AMOUNT_SUN / 1000000} TRX for collection/activation...`);
        try {
            this.tronWeb.setPrivateKey(this.gasReserveWallet.privateKey);
            const tx = await this.tronWeb.transactionBuilder.sendTrx(toAddress, ACTIVATION_TRX_AMOUNT_SUN, this.gasReserveWallet.address);
            const signedTx = await this.tronWeb.trx.sign(tx);
            await this.tronWeb.trx.sendRawTransaction(signedTx);
            console.log(`[v7 Collect] Gas/Activation top-up sent to ${toAddress}.`);
        } catch (error) {
            logError(error, `Error in _topUpGas`, toAddress);
            throw error; 
        }
    }

    // (_transferUsdt 函數 - ★★★ v8.36 修正：使用 triggerSmartContract ★★★)
    async _transferUsdt(userPrivateKey, userAddress, amountBigNumberStr) {
        const collectionAddress = this.collectionWallets[0]; 
        
        console.log(`[v7 Collect] Transferring ${Number(BigInt(amountBigNumberStr)) / (10**USDT_DECIMALS)} USDT from ${userAddress} to ${collectionAddress}...`);
        
        try {
            this.tronWeb.setPrivateKey(userPrivateKey);
            
            // 1. 建立交易
            const transaction = await this.tronWeb.transactionBuilder.triggerSmartContract(
                USDT_CONTRACT_ADDRESS,
                'transfer(address,uint256)', // 函數選擇器
                { feeLimit: 15000000, callValue: 0 }, // 選項
                [ // 參數
                    { type: 'address', value: collectionAddress },
                    { type: 'uint256', value: amountBigNumberStr } 
                ],
                userAddress // 交易發起人地址
            );

            if (!transaction || !transaction.result || !transaction.result.result) {
                throw new Error('transfer build failed: No transaction object returned');
            }

            // 2. 簽名
            const signedTx = await this.tronWeb.trx.sign(transaction.transaction);

            // 3. 廣播 (我們知道這個 fullNode 操作是可用的)
            const receipt = await this.tronWeb.trx.sendRawTransaction(signedTx);
            
            if (!receipt || !receipt.txid) {
                throw new Error('transfer broadcast failed: No txid returned');
            }
            
            console.log(`[v7 Collect] SUCCESS: Transfer initiated. TX: ${receipt.txid}`);
            
        } catch (error) {
             logError(error, `Error in _transferUsdt (triggerSmartContract)`, userAddress);
             throw error; 
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