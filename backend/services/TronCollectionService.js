// 檔案: backend/services/TronCollectionService.js (★★★ v8.49 完整修正版 ★★★)

const TronWeb = require('tronweb');
const db = require('../db');
const { getKmsInstance } = require('./KmsService');
const util = require('util'); 

// (★★★ v8.49 修正：從 .env 讀取節點 ★★★)
const NILE_NODE_HOST = process.env.NILE_NODE_HOST;
if (!NILE_NODE_HOST) {
    throw new Error("CRITICAL: NILE_NODE_HOST is not set in .env file!");
}

// (★★★ v8.49 核心修正：使用 Nile 測試網的 USDT 合約地址 ★★★)
const DEFAULT_USDT_CONTRACT = 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';
const USDT_CONTRACT_ADDRESS = process.env.USDT_CONTRACT_ADDRESS || DEFAULT_USDT_CONTRACT; 
const USDT_DECIMALS = 6;
const ACTIVATION_TRX_AMOUNT_SUN = 1000000; // 1 TRX
const COLLECTION_THRESHOLD_USDT = 1.0; 

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
        // (★★★ v8.49 修正：使用 tronweb@5.3.2 的建構函式並指定新節點 ★★★)
        this.tronWeb = new TronWeb({
            fullHost: NILE_NODE_HOST,
            solidityHost: NILE_NODE_HOST,
            privateKey: '01',
            timeout: 120000 // (增加 timeout 從 60 秒到 120 秒)
        });
        
        this.tronWeb.setFullNode(NILE_NODE_HOST);
        this.tronWeb.setSolidityNode(NILE_NODE_HOST);
        this.tronWeb.setEventServer(NILE_NODE_HOST);

        this.usdtContractHex = this.tronWeb.address.toHex(USDT_CONTRACT_ADDRESS);
        
        // (★★★ v8.49 修改日誌 ★★★)
        console.log(`✅ [v7] TronCollectionService (NILE TESTNET) initialized (v8.49 tronweb@5.3.2 / Node: ${NILE_NODE_HOST}).`);
        console.log(`[v7 Collection] USDT Contract Address (Base58): ${USDT_CONTRACT_ADDRESS}`);
        console.log(`[v7 Collection] USDT Contract Address (HEX): ${this.usdtContractHex}`);


        this.kmsService = getKmsInstance();
        this.gasReserveWallet = null; 
        this.collectionWallets = []; 
        
        this._loadPlatformWallets();
    }

    // (_loadPlatformWallets 保持不變)
    async _loadPlatformWallets() {
        // ... (保持不變) ...
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

    // (activateAddress - v8.49)
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
            
            if (receipt && receipt.result === true) {
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
    
    // (★★★ v8.49 核心修正：使用 HEX 地址參數 (來自 GPT 分析) ★★★)
    async _getUsdtBalance(userAddress, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                // (★★★ v8.49 修正 1：將 T... 地址轉換為 41... HEX 地址 ★★★)
                const userAddressHex = this.tronWeb.address.toHex(userAddress);
                const gasWalletAddressHex = this.tronWeb.address.toHex(this.gasReserveWallet.address);

                // (預期請求: https://go.getblock.io/YOUR_API_KEY/wallet/triggerconstantcontract)
                const transaction = await this.tronWeb.transactionBuilder.triggerConstantContract(
                    this.usdtContractHex, // (使用 HEX 合約地址)
                    'balanceOf(address)', // 函數選擇器
                    {}, // 選項
                    [{ type: 'address', value: userAddressHex }], // (★★★ v8.49 修正 2：使用 HEX 參數 ★★★)
                    gasWalletAddressHex // (★★★ v8.49 修正 3：呼叫者也用 HEX ★★★)
                );

                if (!transaction || !transaction.constant_result || !transaction.constant_result[0]) {
                    throw new Error('balanceOf call failed: No constant_result');
                }
                
                const balance = '0x' + transaction.constant_result[0];
                return balance;
                
            } catch (error) {
                const isRetryable = error.message && (
                    error.message.includes('timeout') ||
                    error.message.includes('ECONNABORTED') ||
                    error.message.includes('EAI_AGAIN') ||
                    error.message.includes('ETIMEDOUT') ||
                    error.code === 'ECONNABORTED' ||
                    error.code === 'EAI_AGAIN' ||
                    error.code === 'ETIMEDOUT'
                );
                
                if (isRetryable && attempt < retries) {
                    console.warn(`[v7 Collect] balanceOf failed (attempt ${attempt}/${retries}) for ${userAddress}, retrying... Error:`, error.message);
                    await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
                    continue;
                }
                
                // (log19.txt 的 "Smart contract is not exist" 錯誤會在這裡被捕獲)
                logError(error, `_getUsdtBalance (triggerConstantContract) (attempt ${attempt}/${retries})`, userAddress);
                throw error;
            }
        }
    }


    // (collectFunds 函數 - v8.49)
    async collectFunds() {
        if (!this.gasReserveWallet || this.collectionWallets.length === 0) {
            console.warn("[v7 Collect] Skipping collection run: Gas or Collection wallet not configured.");
            return;
        }
        
        const usersResult = await db.query(
            "SELECT id, user_id, deposit_path_index, tron_deposit_address FROM users WHERE tron_deposit_address IS NOT NULL"
        );
        
        if (usersResult.rows.length === 0) {
            return; // (沒有用戶地址，直接返回)
        }

        console.log(`[v7 Collect] 🔍 Starting collection sweep for ${usersResult.rows.length} addresses...`);
        
        let collectedCount = 0;
        let topUpCount = 0;
        let skippedCount = 0;

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
                // (靜默處理，不輸出日誌)
            }

            // --- 步驟 2: 補 Gas (如果帳戶未啟用) ---
            if (trxBalance < 1000000) { // (小於 1 TRX - 包含 0)
                try {
                    await this._topUpGas(userAddress);
                    topUpCount++;
                    await new Promise(resolve => setTimeout(resolve, 5000));
                } catch (topUpError) {
                    // (永久性錯誤，跳過此地址)
                    if (topUpError.message && topUpError.message.includes('Permanent error')) {
                        skippedCount++;
                        continue;
                    }
                    // (臨時性錯誤，記錄並跳過)
                    console.warn(`[v7 Collect] ⚠️ Failed to top up gas for ${userAddress}: ${topUpError.message}`);
                    skippedCount++;
                    continue;
                }
            }
            
            let usdtBalanceBigNumberStr;
            // --- 步驟 3: 檢查 USDT 餘額 (使用 triggerConstantContract) ---
            try {
                usdtBalanceBigNumberStr = await this._getUsdtBalance(userAddress);
                usdtBalance = parseFloat(BigInt(usdtBalanceBigNumberStr).toString()) / (10**USDT_DECIMALS);
            } catch (balanceError) {
                // (靜默處理，跳過此地址)
                skippedCount++;
                continue;
            }

            if (usdtBalance < COLLECTION_THRESHOLD_USDT) {
                skippedCount++;
                continue; // (餘額不足，跳過)
            }
            
            console.log(`[v7 Collect] 💰 Found ${usdtBalance.toFixed(6)} USDT in ${userAddress} (User: ${user.user_id})`);

            // --- 步驟 4: 歸集 (使用 triggerSmartContract) ---
            try {
                const userPrivateKey = this.kmsService.getPrivateKey('TRC20', userPathIndex);
                const amountBigNumberStr = (await this._getUsdtBalance(userAddress)).toString();
                await this._transferUsdt(userPrivateKey, userAddress, amountBigNumberStr);
                collectedCount++;
            } catch (transferError) {
                console.error(`[v7 Collect] ❌ Failed to transfer USDT from ${userAddress}: ${transferError.message}`);
                skippedCount++;
                continue;
            }
        }
        
        // (輸出統計資訊)
        if (collectedCount > 0 || topUpCount > 0) {
            console.log(`[v7 Collect] ✅ Collection sweep finished: ${collectedCount} collected, ${topUpCount} topped up, ${skippedCount} skipped`);
        } else if (skippedCount > 0) {
            console.log(`[v7 Collect] ℹ️ Collection sweep finished: ${skippedCount} addresses skipped (no balance or errors)`);
        }
    }

    // (_topUpGas 函數 - v8.49)
    async _topUpGas(toAddress, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                this.tronWeb.setPrivateKey(this.gasReserveWallet.privateKey);
                
                const tx = await this.tronWeb.transactionBuilder.sendTrx(toAddress, ACTIVATION_TRX_AMOUNT_SUN, this.gasReserveWallet.address);
                const signedTx = await this.tronWeb.trx.sign(tx);
                const receipt = await this.tronWeb.trx.sendRawTransaction(signedTx);
                
                // (檢查 receipt 是否成功)
                if (receipt && receipt.result === true && receipt.txid) {
                    console.log(`[v7 Collect] ✅ Gas/Activation top-up sent to ${toAddress}. TXID: ${receipt.txid}`);
                    return receipt;
                } else if (receipt && receipt.code) {
                    // (檢查是否為永久性錯誤)
                    const isPermanentError = receipt.code === 'CONTRACT_VALIDATE_ERROR' || 
                                            receipt.code === 'BANDWIDTH_ERROR' ||
                                            receipt.message && receipt.message.includes('does not exist');
                    
                    if (isPermanentError) {
                        // (永久性錯誤，不解碼 HEX 訊息，直接拋出)
                        const errorMsg = receipt.message ? Buffer.from(receipt.message, 'hex').toString('utf8') : receipt.code;
                        console.error(`[v7 Collect] ❌ Permanent error in _topUpGas for ${toAddress}: ${receipt.code} - ${errorMsg}`);
                        throw new Error(`Permanent error: ${receipt.code} - ${errorMsg}`);
                    } else {
                        // (臨時性錯誤，可以重試)
                        console.warn(`[v7 Collect] ⚠️ Temporary error in _topUpGas for ${toAddress}: ${receipt.code}`);
                        if (attempt < retries) {
                            await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
                            continue;
                        }
                        throw new Error(`sendRawTransaction failed: ${receipt.code}`);
                    }
                } else {
                    // (未知格式的 receipt)
                    console.warn(`[v7 Collect] ⚠️ Unexpected receipt format:`, receipt);
                    if (attempt < retries) {
                        await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
                        continue;
                    }
                    throw new Error(`sendRawTransaction failed: Unexpected receipt format. Receipt: ${JSON.stringify(receipt)}`);
                }
            } catch (error) {
                // (檢查是否為永久性錯誤)
                const isPermanentError = error.message && (
                    error.message.includes('Permanent error') ||
                    error.message.includes('does not exist') ||
                    error.message.includes('CONTRACT_VALIDATE_ERROR')
                );
                
                if (isPermanentError) {
                    // (永久性錯誤，不重試)
                    logError(error, `Permanent error in _topUpGas (attempt ${attempt}/${retries})`, toAddress);
                    throw error;
                }
                
                // (臨時性錯誤，可以重試)
                const isRetryable = error.message && (
                    error.message.includes('timeout') ||
                    error.message.includes('ECONNABORTED') ||
                    error.message.includes('EAI_AGAIN') ||
                    error.message.includes('ETIMEDOUT') ||
                    error.code === 'ECONNABORTED' ||
                    error.code === 'EAI_AGAIN' ||
                    error.code === 'ETIMEDOUT'
                );
                
                if (isRetryable && attempt < retries) {
                    console.warn(`[v7 Collect] ⚠️ Temporary error in _topUpGas (attempt ${attempt}/${retries}) for ${toAddress}, retrying... Error:`, error.message);
                    await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
                    continue;
                }
                
                logError(error, `Error in _topUpGas (attempt ${attempt}/${retries})`, toAddress);
                throw error;
            }
        }
    }

    // (_transferUsdt 函數 - v8.49)
    async _transferUsdt(userPrivateKey, userAddress, amountBigNumberStr) {
        const collectionAddress = this.collectionWallets[0]; 
        
        console.log(`[v7 Collect] Transferring ${Number(BigInt(amountBigNumberStr)) / (10**USDT_DECIMALS)} USDT from ${userAddress} to ${collectionAddress}...`);
        
        try {
            this.tronWeb.setPrivateKey(userPrivateKey);
            
            // 1. 建立交易
            // (★★★ v8.49 核心修正：使用 HEX 地址參數 (來自 GPT 分析) ★★★)
            const collectionAddressHex = this.tronWeb.address.toHex(collectionAddress);
            const userAddressHex = this.tronWeb.address.toHex(userAddress);

            const transaction = await this.tronWeb.transactionBuilder.triggerSmartContract(
                this.usdtContractHex, // (使用 HEX 合約地址)
                'transfer(address,uint256)', // 函數選擇器
                { feeLimit: 15000000, callValue: 0 }, // 選項
                [ // 參數
                    { type: 'address', value: collectionAddressHex }, // (★★★ v8.49 修正 ★★★)
                    { type: 'uint256', value: amountBigNumberStr } 
                ],
                userAddressHex // (★★★ v8.49 修正 ★★★)
            );

            if (!transaction || !transaction.result || !transaction.result.result) {
                throw new Error('transfer build failed: No transaction object returned');
            }

            // 2. 簽名
            const signedTx = await this.tronWeb.trx.sign(transaction.transaction);

            // 3. 廣播
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