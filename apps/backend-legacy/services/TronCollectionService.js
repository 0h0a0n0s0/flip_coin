// 档案: backend/services/TronCollectionService.js (★★★ v9.0 新归集逻辑版 ★★★)

const TronWeb = require('tronweb');
const db = require('@flipcoin/database');
const { getKmsInstance } = require('./KmsService');
const { getTronEnergyInstance } = require('./TronEnergyService');
const { getAlertInstance } = require('./AlertService');
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

// (安全地提取错误消息 - 防止 undefined.substring 错误)
function safeErrorMessage(error, maxLength = 500) {
    if (!error) return 'Unknown error';
    if (typeof error === 'string') {
        return error.length > maxLength ? error.substring(0, maxLength) : error;
    }
    if (error.message) {
        const msg = String(error.message);
        return msg.length > maxLength ? msg.substring(0, maxLength) : msg;
    }
    if (error.toString && typeof error.toString === 'function') {
        try {
            const msg = error.toString();
            return msg.length > maxLength ? msg.substring(0, maxLength) : msg;
        } catch (e) {
            // toString 失败，继续尝试其他方法
        }
    }
    try {
        const msg = JSON.stringify(error);
        return msg.length > maxLength ? msg.substring(0, maxLength) : msg;
    } catch (e) {
        return 'Error object could not be serialized';
    }
}

// (日志辅助函数)
function logError(error, context, address) {
    console.error(`[Collection] ${context} for address ${address}. Details:`);
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
        this.tronWeb = new TronWeb({
            fullHost: NILE_NODE_HOST,
            solidityHost: NILE_NODE_HOST,
            privateKey: '01',
            timeout: 120000
        });
        
        this.tronWeb.setFullNode(NILE_NODE_HOST);
        this.tronWeb.setSolidityNode(NILE_NODE_HOST);
        this.tronWeb.setEventServer(NILE_NODE_HOST);

        this.usdtContractHex = this.tronWeb.address.toHex(USDT_CONTRACT_ADDRESS);
        
        console.log(`✅ [Collection] TronCollectionService (NILE TESTNET) initialized.`);
        console.log(`[Collection] USDT Contract Address: ${USDT_CONTRACT_ADDRESS}`);

        this.kmsService = getKmsInstance();
        this.energyService = getTronEnergyInstance(); // 能量租赁服务
        this.alertService = getAlertInstance(); // (★★★ v9.0 新增：警報服務 ★★★)
        this.collectionWallet = null; // 归集钱包（单一）
        // 注意：gasReserveWallet 功能已停用，系统不再自动激活用户地址
        this.gasReserveWallet = null; // (已停用) 用于启用/补 TRX 的钱包
        this.consecutiveFailures = 0; // (★★★ v9.0 新增：連續失敗計數 ★★★)
        this.lastEnergyExhaustedAlertTime = null; // (防止重複警報)
        this.io = null; // Socket.IO 實例（用於推送通知）
        
        this._loadPlatformWallets();
    }

    /**
     * 設置 Socket.IO 實例
     * @param {Object} socketIO - Socket.IO 實例
     */
    setIo(socketIO) {
        this.io = socketIO;
    }

    // (载入归集钱包)
    async _loadPlatformWallets() {
        try {
            const wallets = await db.query(
                "SELECT * FROM platform_wallets WHERE chain_type = 'TRC20' AND is_active = true"
            );

            const collectionRow = wallets.rows.find(w => w.is_collection);
            if (collectionRow) {
                // (★★★ 安全檢查：防止能量提供者钱包被用于归集 ★★★)
                if (collectionRow.is_energy_provider) {
                    console.error(`[Collection] ⚠️ SECURITY WARNING: Collection Wallet (${collectionRow.address}) is also marked as energy provider!`);
                    console.error(`[Collection] This will cause energy depletion. Please separate these roles.`);
                    console.error(`[Collection] Collection wallet should NOT be used as energy provider.`);
                    // 不阻止加载，但记录警告
                }
                
                const pkEnvVar = `TRON_PK_${collectionRow.address}`;
                const privateKey = process.env[pkEnvVar];
                if (!privateKey) {
                    console.error(`[Collection] CRITICAL: Collection Wallet (${collectionRow.address}) found in DB, but its Private Key (${pkEnvVar}) is NOT in .env!`);
                } else {
                    this.collectionWallet = { address: collectionRow.address, privateKey: privateKey };
                    console.log(`[Collection] Collection Wallet loaded: ${this.collectionWallet.address}`);
                }
            } else {
                console.warn("[Collection] No active collection wallet found.");
            }

            const gasRow = wallets.rows.find(w => w.is_gas_reserve);
            if (gasRow) {
                const pkEnvVar = `TRON_PK_${gasRow.address}`;
                const privateKey = process.env[pkEnvVar];
                if (!privateKey) {
                    console.error(`[Collection] CRITICAL: Gas Reserve Wallet (${gasRow.address}) found in DB, but its Private Key (${pkEnvVar}) is NOT in .env!`);
                } else {
                    this.gasReserveWallet = { address: gasRow.address, privateKey: privateKey };
                    console.log(`[Collection] Gas Reserve Wallet loaded: ${this.gasReserveWallet.address}`);
                }
            } else {
                console.warn("[Collection] No active gas reserve wallet found.");
            }
        } catch (error) {
            console.error("[Collection] Error loading platform wallets:", error);
        }
    }

    /**
     * @description 检查地址是否已激活 (已停用，保留用于兼容)
     * @returns {Promise<boolean>} true表示已激活，false表示未激活
     * @deprecated 系统不再自动激活用户地址
     */
    async _isAddressActivated(address) {
        try {
            const account = await this.tronWeb.trx.getAccount(address);
            // 在TRON网络中，已激活的地址会有 create_time 属性
            // create_time 表示账户首次创建（激活）的时间戳
            if (account && account.create_time) {
                return true;
            }
            // 如果没有 create_time，说明地址未激活
            return false;
        } catch (error) {
            // 如果获取账户信息失败，通常表示地址未激活
            // TRON网络对于未激活地址，getAccount可能会返回错误或空的account对象
            if (error.message && (error.message.includes('account') || error.message.includes('not found'))) {
                return false;
            }
            // 其他错误，记录日志但假设未激活
            console.warn(`[Collection] Error checking activation status for ${address}:`, error.message);
            return false;
        }
    }

    /**
     * @description 启用用户地址（转 1 TRX）(已停用，保留用于兼容)
     * @deprecated 系统不再自动激活用户地址
     */
    async activateAddress(toAddress) {
        if (!this.gasReserveWallet) {
            console.warn("[Collection] activateAddress skipped: gas reserve wallet not configured.");
            return false;
        }

        console.log(`[Collection] Attempting to activate ${toAddress} with 1 TRX...`);
        try {
            this.tronWeb.setPrivateKey(this.gasReserveWallet.privateKey);

            const tx = await this.tronWeb.transactionBuilder.sendTrx(
                toAddress,
                1_000_000, // 1 TRX
                this.gasReserveWallet.address
            );
            const signedTx = await this.tronWeb.trx.sign(tx);
            const receipt = await this.tronWeb.trx.sendRawTransaction(signedTx);

            if (receipt && receipt.result === true) {
                console.log(`[Collection] Address ${toAddress} activated. TX: ${receipt.txid}`);
                return true;
            }

            console.warn(`[Collection] Activation tx failed for ${toAddress}`, receipt);
            return false;
        } catch (error) {
            logError(error, 'activateAddress error', toAddress);
            return false;
        }
    }

    /**
     * @description 获取归集钱包的当前能量（使用 getAccountResources 獲取實時鏈上能量數據）
     */
    async _getCollectionWalletEnergy() {
        if (!this.collectionWallet) {
            throw new Error('Collection wallet not loaded');
        }
        
        try {
            // 使用 getAccountResources 獲取實時鏈上能量數據
            const resources = await this.tronWeb.trx.getAccountResources(this.collectionWallet.address);
            const energyLimit = Number(resources?.EnergyLimit || 0);
            const energyUsed = Number(resources?.EnergyUsed || 0);
            const availableEnergy = energyLimit - energyUsed;
            
            if (Number.isFinite(availableEnergy)) {
                return Math.max(0, availableEnergy);
            }
            
            // Fallback: 如果 getAccountResources 失敗，嘗試使用 account.energy
            const account = await this.tronWeb.trx.getAccount(this.collectionWallet.address);
            return account.energy || 0;
        } catch (error) {
            logError(error, 'Error getting collection wallet energy', this.collectionWallet.address);
            throw error;
        }
    }

    /**
     * @description 获取用户地址的 USDT 余额
     */
    async _getUsdtBalance(userAddress) {
        try {
            const userAddressHex = this.tronWeb.address.toHex(userAddress);
            const collectionAddressHex = this.tronWeb.address.toHex(this.collectionWallet.address);

            const transaction = await this.tronWeb.transactionBuilder.triggerConstantContract(
                this.usdtContractHex,
                'balanceOf(address)',
                {},
                [{ type: 'address', value: userAddressHex }],
                collectionAddressHex
            );

            if (!transaction || !transaction.constant_result || !transaction.constant_result[0]) {
                throw new Error('balanceOf call failed: No constant_result');
            }
            
            const balance = '0x' + transaction.constant_result[0];
            return BigInt(balance).toString();
        } catch (error) {
            logError(error, 'Error getting USDT balance', userAddress);
            throw error;
        }
    }

    /**
     * @description 检查用户地址是否已 approve 归集钱包
     */
    async _checkAllowance(userAddress) {
        try {
            const userAddressHex = this.tronWeb.address.toHex(userAddress);
            const collectionAddressHex = this.tronWeb.address.toHex(this.collectionWallet.address);

            const transaction = await this.tronWeb.transactionBuilder.triggerConstantContract(
                this.usdtContractHex,
                'allowance(address,address)',
                {},
                [
                    { type: 'address', value: userAddressHex },
                    { type: 'address', value: collectionAddressHex }
                ],
                collectionAddressHex
            );

            if (!transaction || !transaction.constant_result || !transaction.constant_result[0]) {
                throw new Error('allowance call failed: No constant_result');
            }
            
            const allowance = '0x' + transaction.constant_result[0];
            return BigInt(allowance).toString();
        } catch (error) {
            logError(error, 'Error checking allowance', userAddress);
            throw error;
        }
    }

    /**
     * @description 用户地址执行 approve（一次性，不消耗能量和TRX）
     */
    async _approveCollection(userPrivateKey, userAddress) {
        try {
            this.tronWeb.setPrivateKey(userPrivateKey);
            
            const collectionAddressHex = this.tronWeb.address.toHex(this.collectionWallet.address);
            const userAddressHex = this.tronWeb.address.toHex(userAddress);
            
            // 使用最大 uint256 值作为 approve 金额
            const maxUint256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
            
            const transaction = await this.tronWeb.transactionBuilder.triggerSmartContract(
                this.usdtContractHex,
                'approve(address,uint256)',
                { feeLimit: 0, callValue: 0 }, // 不消耗能量和TRX
                [
                    { type: 'address', value: collectionAddressHex },
                    { type: 'uint256', value: maxUint256 }
                ],
                userAddressHex
            );

            if (!transaction || !transaction.result || !transaction.result.result) {
                throw new Error('approve build failed: No transaction object returned');
            }

            const signedTx = await this.tronWeb.trx.sign(transaction.transaction);
            const receipt = await this.tronWeb.trx.sendRawTransaction(signedTx);
            
            if (!receipt || !receipt.txid) {
                throw new Error('approve broadcast failed: No txid returned');
            }
            
            console.log(`[Collection] ✅ Approve successful for ${userAddress}. TX: ${receipt.txid}`);
            return receipt.txid;
        } catch (error) {
            logError(error, 'Error in approve', userAddress);
            throw error;
        }
    }

    /**
     * @description 归集钱包执行 transferFrom（消耗能量）
     */
    async _transferFrom(userAddress, amountBigNumberStr) {
        if (!this.collectionWallet) {
            throw new Error('Collection wallet not loaded');
        }
        
        try {
            // #region agent log
            const energyBefore = await this._getCollectionWalletEnergy();
            fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TronCollectionService.js:_transferFrom',message:'Before transferFrom - energy check',data:{collectionWallet:this.collectionWallet.address,userAddress,energyBefore,amount:amountBigNumberStr},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            
            this.tronWeb.setPrivateKey(this.collectionWallet.privateKey);
            
            const collectionAddressHex = this.tronWeb.address.toHex(this.collectionWallet.address);
            const userAddressHex = this.tronWeb.address.toHex(userAddress);

            const transaction = await this.tronWeb.transactionBuilder.triggerSmartContract(
                this.usdtContractHex,
                'transferFrom(address,address,uint256)',
                { feeLimit: 0, callValue: 0 }, // 使用能量，不燃燒TRX
                [
                    { type: 'address', value: userAddressHex },
                    { type: 'address', value: collectionAddressHex },
                    { type: 'uint256', value: amountBigNumberStr }
                ],
                collectionAddressHex
            );

            if (!transaction || !transaction.result || !transaction.result.result) {
                throw new Error('transferFrom build failed: No transaction object returned');
            }

            // 检查能量消耗
            const energyUsed = transaction.energy_used || 0;
            console.log(`[Collection] Estimated energy for transferFrom: ${energyUsed}`);

            const signedTx = await this.tronWeb.trx.sign(transaction.transaction);
            const receipt = await this.tronWeb.trx.sendRawTransaction(signedTx);
            
            if (!receipt || !receipt.txid) {
                throw new Error('transferFrom broadcast failed: No txid returned');
            }
            
            // 获取實際消耗的能量
            let actualEnergyUsed = energyUsed;
            try {
                const txInfo = await this.tronWeb.trx.getTransactionInfo(receipt.txid);
                if (txInfo && txInfo.receipt && txInfo.receipt.energy_usage_total) {
                    actualEnergyUsed = txInfo.receipt.energy_usage_total;
                }
            } catch (e) {
                console.warn(`[Collection] Could not get actual energy usage for TX ${receipt.txid}`);
            }
            
            // #region agent log
            const energyAfter = await this._getCollectionWalletEnergy();
            fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TronCollectionService.js:_transferFrom',message:'After transferFrom - energy check',data:{collectionWallet:this.collectionWallet.address,userAddress,txHash:receipt.txid,energyBefore,energyAfter,energyUsed:actualEnergyUsed,energyDiff:energyBefore-energyAfter},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            
            console.log(`[Collection] ✅ TransferFrom successful. TX: ${receipt.txid}, Energy: ${actualEnergyUsed}`);
            return { txHash: receipt.txid, energyUsed: actualEnergyUsed };
        } catch (error) {
            logError(error, 'Error in transferFrom', userAddress);
            throw error;
        }
    }

    /**
     * @description 記錄歸集失敗日誌
     * @param {Object} user - 用戶對象
     * @param {string} errorMessage - 錯誤消息
     */
    async _logCollectionFailure(user, errorMessage) {
        try {
            await db.query(
                `INSERT INTO collection_logs 
                 (user_id, user_deposit_address, collection_wallet_address, amount, status, error_message) 
                 VALUES ($1, $2, $3, $4, 'failed', $5)`,
                [
                    user.user_id,
                    user.tron_deposit_address,
                    this.collectionWallet.address,
                    0,
                    safeErrorMessage(errorMessage, 500)
                ]
            );
        } catch (logError) {
            console.error(`[Collection] Failed to log error to collection_logs:`, logError);
        }
    }

    /**
     * @description 添加用戶到重試隊列
     * @param {string} userId - 用戶 ID
     * @param {string} errorReason - 錯誤原因
     */
    async _addToRetryQueue(userId, errorReason) {
        try {
            const existingRetry = await db.query(
                `SELECT id, retry_count FROM collection_retry_queue WHERE user_id = $1`,
                [userId]
            );
            
            if (existingRetry.rows.length > 0) {
                const newRetryCount = existingRetry.rows[0].retry_count + 1;
                const nextRetryDelay = Math.pow(2, newRetryCount);
                await db.query(
                    `UPDATE collection_retry_queue 
                     SET retry_count = $1, 
                         next_retry_at = NOW() + INTERVAL '1 hour' * $2,
                         error_reason = $3,
                         updated_at = NOW()
                     WHERE user_id = $4`,
                    [newRetryCount, nextRetryDelay, errorReason, userId]
                );
            } else {
                await db.query(
                    `INSERT INTO collection_retry_queue 
                     (user_id, retry_count, next_retry_at, error_reason) 
                     VALUES ($1, 0, NOW() + INTERVAL '1 hour', $2)`,
                    [userId, errorReason]
                );
            }
            console.log(`[Collection] Added user ${userId} to retry queue`);
        } catch (retryQueueError) {
            console.error(`[Collection] Failed to add user to retry queue:`, retryQueueError);
        }
    }

    /**
     * @description 處理單個用戶的歸集（核心邏輯）
     * @param {Object} user - 用戶對象 {user_id, deposit_path_index, tron_deposit_address}
     * @param {number} balance - 用戶 USDT 餘額（小數形式，用於日誌）
     * @returns {Promise<{success: boolean, txHash?: string, energyUsed?: number, error?: string}>}
     */
    async _processUserCollection(user, balance) {
        try {
            // Step 1: 檢查並執行 approve（如果需要）
            const allowanceStr = await this._checkAllowance(user.tron_deposit_address);
            const allowance = BigInt(allowanceStr);
            const balanceStr = await this._getUsdtBalance(user.tron_deposit_address);
            const balanceBigInt = BigInt(balanceStr);
            
            if (allowance < balanceBigInt) {
                console.log(`[Collection] Approving for user ${user.user_id}...`);
                try {
                    const userPrivateKey = this.kmsService.getPrivateKey('TRC20', user.deposit_path_index);
                    await this._approveCollection(userPrivateKey, user.tron_deposit_address);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                } catch (approveError) {
                    // approve 失敗，添加到重試隊列
                    const errorMsg = `Approve failed: ${safeErrorMessage(approveError, 400)}`;
                    await this._addToRetryQueue(user.user_id, errorMsg);
                    return { success: false, error: safeErrorMessage(approveError) };
                }
            }
            
            // Step 2: 執行 transferFrom
            console.log(`[Collection] Collecting ${balance} USDT from user ${user.user_id}...`);
            const transferResult = await this._transferFrom(user.tron_deposit_address, balanceStr);
            
            // Step 3: 記錄歸集日誌
            await db.query(
                `INSERT INTO collection_logs 
                 (user_id, user_deposit_address, collection_wallet_address, amount, tx_hash, energy_used, status) 
                 VALUES ($1, $2, $3, $4, $5, $6, 'completed')`,
                [
                    user.user_id,
                    user.tron_deposit_address,
                    this.collectionWallet.address,
                    balance,
                    transferResult.txHash,
                    transferResult.energyUsed
                ]
            );
            
            return { 
                success: true, 
                txHash: transferResult.txHash, 
                energyUsed: transferResult.energyUsed 
            };
        } catch (error) {
            const errorMsg = safeErrorMessage(error);
            console.error(`[Collection] ❌ Failed to collect from user ${user.user_id}:`, errorMsg);
            
            // 記錄失敗日誌
            await this._logCollectionFailure(user, errorMsg);
            
            // 添加到重試隊列
            await this._addToRetryQueue(user.user_id, safeErrorMessage(error, 500));
            
            return { success: false, error: errorMsg };
        }
    }

    /**
     * @description 获取最近一笔归集交易的實際能量消耗（用于估算）
     */
    async _getAverageEnergyUsage() {
        try {
            const result = await db.query(
                `SELECT energy_used FROM collection_logs 
                 WHERE energy_used IS NOT NULL AND status = 'completed' 
                 ORDER BY created_at DESC LIMIT 10`
            );
            
            if (result.rows.length === 0) {
                // 预设值：TRC20 transferFrom 通常消耗约 30000-40000 能量
                return 35000;
            }
            
            const totalEnergy = result.rows.reduce((sum, row) => sum + (row.energy_used || 0), 0);
            return Math.ceil(totalEnergy / result.rows.length);
        } catch (error) {
            console.warn('[Collection] Error getting average energy usage, using default:', error.message);
            return 35000; // 预设值
        }
    }

    /**
     * @description 从 system_settings 读取配置值
     * @param {string} key - 配置键
     * @param {any} defaultValue - 默认值
     * @returns {Promise<any>} 配置值（如果是数字会自动转换）
     */
    async _getSystemSetting(key, defaultValue) {
        try {
            const result = await db.query(
                `SELECT value FROM system_settings WHERE key = $1`,
                [key]
            );
            if (result.rows.length > 0) {
                const value = result.rows[0].value;
                // 尝试转换为数字（如果可能）
                const numValue = Number(value);
                return isNaN(numValue) ? value : numValue;
            }
            return defaultValue;
        } catch (error) {
            console.warn(`[Collection] Failed to read setting ${key}, using default:`, error.message);
            return defaultValue;
        }
    }

    /**
     * @description 检查用户是否应该归集
     */
    async _shouldCollect(user) {
        try {
            // 检查 USDT 余额
            const balanceStr = await this._getUsdtBalance(user.tron_deposit_address);
            const balance = parseFloat(BigInt(balanceStr).toString()) / (10**USDT_DECIMALS);
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TronCollectionService.js:377',message:'Checking USDT balance',data:{userId:user.user_id,address:user.tron_deposit_address,balance,balanceStr},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            
            if (balance <= 0) {
                return { shouldCollect: false, reason: 'No USDT balance' };
            }
            
            // 检查归集设定
            const settingsResult = await db.query(
                `SELECT * FROM collection_settings 
                 WHERE collection_wallet_address = $1 AND is_active = true`,
                [this.collectionWallet.address]
            );
            
            if (settingsResult.rows.length === 0) {
                return { shouldCollect: false, reason: 'No collection settings' };
            }
            
            const settings = settingsResult.rows[0];
            const daysWithoutDeposit = settings.days_without_deposit;
            
            // 检查最近一笔充值时间
            const depositResult = await db.query(
                `SELECT created_at FROM platform_transactions 
                 WHERE user_id = $1 AND type = 'deposit' AND status = 'completed' 
                 ORDER BY created_at DESC LIMIT 1`,
                [user.user_id]
            );
            
            let daysSince = null;
            let timeSource = null;
            
            if (depositResult.rows.length === 0) {
                // 没有充值记录，检查用户創建时间
                const userResult = await db.query(
                    `SELECT created_at FROM users WHERE user_id = $1`,
                    [user.user_id]
                );
                if (userResult.rows.length > 0) {
                    const userCreatedAt = new Date(userResult.rows[0].created_at);
                    daysSince = (Date.now() - userCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
                    timeSource = 'user_created_at';
                    
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TronCollectionService.js:415',message:'No deposit found, checking user creation',data:{userId:user.user_id,daysSince,daysWithoutDeposit,userCreatedAt:userResult.rows[0].created_at,shouldCollect:daysSince >= daysWithoutDeposit},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
                    // #endregion
                    
                    if (daysSince < daysWithoutDeposit) {
                        return { shouldCollect: false, reason: `Created ${Math.floor(daysSince)} days ago, need ${daysWithoutDeposit} days` };
                    }
                }
            } else {
                const lastDepositTime = new Date(depositResult.rows[0].created_at);
                daysSince = (Date.now() - lastDepositTime.getTime()) / (1000 * 60 * 60 * 24);
                timeSource = 'last_deposit';
                
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TronCollectionService.js:421',message:'Last deposit found',data:{userId:user.user_id,daysSince,daysWithoutDeposit,lastDepositTime:depositResult.rows[0].created_at,shouldCollect:daysSince >= daysWithoutDeposit},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
                // #endregion
                
                if (daysSince < daysWithoutDeposit) {
                    return { shouldCollect: false, reason: `Last deposit ${Math.floor(daysSince)} days ago, need ${daysWithoutDeposit} days` };
                }
            }
            
            // 检查是否已有 pending 的归集记录
            const pendingResult = await db.query(
                `SELECT id FROM collection_logs 
                 WHERE user_id = $1 AND status = 'pending'`,
                [user.user_id]
            );
            
            if (pendingResult.rows.length > 0) {
                return { shouldCollect: false, reason: 'Already has pending collection' };
            }
            
            return { shouldCollect: true, balance: balance };
        } catch (error) {
            logError(error, 'Error checking if should collect', user.tron_deposit_address);
            return { shouldCollect: false, reason: `Error: ${error.message}` };
        }
    }

    /**
     * @description 執行批量歸集邏輯（共享核心方法）
     * @param {Object} options - 配置選項
     * @param {boolean} options.skipTimeCheck - 是否跳過時間間隔檢查（手動模式）
     * @param {number} options.maxUsers - 最大處理用戶數（可選）
     * @returns {Promise<{collectedCount: number, failedCount: number, skippedCount: number, processedCount: number}>}
     */
    async _executeCollectionBatch(options = {}) {
        const { skipTimeCheck = false, maxUsers = null } = options;
        
        if (!this.collectionWallet) {
            throw new Error('Collection wallet not configured');
        }
        
        // 檢查歸集設定
        const settingsResult = await db.query(
            `SELECT * FROM collection_settings 
             WHERE collection_wallet_address = $1 AND is_active = true`,
            [this.collectionWallet.address]
        );
        
        if (settingsResult.rows.length === 0) {
            throw new Error('未找到有效的歸集設定');
        }
        
        const settings = settingsResult.rows[0];
        const daysWithoutDeposit = settings.days_without_deposit;
        
        // 獲取游標
        const cursorResult = await db.query(`SELECT * FROM collection_cursor LIMIT 1`);
        let cursor = cursorResult.rows[0];
        let lastProcessedUserId = null;
        
        if (cursor) {
            lastProcessedUserId = cursor.last_processed_user_id ? parseInt(cursor.last_processed_user_id) : null;
        } else {
            await db.query(`INSERT INTO collection_cursor (last_processed_user_id) VALUES (0)`);
            lastProcessedUserId = null;
        }
        
        // 獲取當前能量（使用修復後的方法）
        let currentEnergy = await this._getCollectionWalletEnergy();
        const avgEnergy = await this._getAverageEnergyUsage();
        
        // 添加調試日誌
        console.log(`[Debug] Checking Energy for Address: ${this.collectionWallet.address}`);
        try {
            const resources = await this.tronWeb.trx.getAccountResources(this.collectionWallet.address);
            console.log(`[Debug] On-Chain Data -> Limit: ${resources?.EnergyLimit || 0}, Used: ${resources?.EnergyUsed || 0}, Calculated Available: ${(resources?.EnergyLimit || 0) - (resources?.EnergyUsed || 0)}`);
        } catch (e) {
            console.warn(`[Debug] Failed to get account resources for debugging:`, e.message);
        }
        
        const estimatedCapacity = Math.floor(currentEnergy / avgEnergy);
        
        if (estimatedCapacity <= 0) {
            throw new Error(`能量不足（當前: ${currentEnergy}，平均每筆: ${avgEnergy}）`);
        }
        
        // 生成任務 ID（用於追蹤能量租賃）
        const taskId = `collection_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        // 初步估算可以处理的地址数量（用于计算所需能量）
        const preliminaryCapacity = Math.floor(currentEnergy / avgEnergy);
        const estimatedAddressCount = Math.max(preliminaryCapacity * 2, 10); // 至少估算 10 个地址
        const requiredEnergy = estimatedAddressCount * avgEnergy;
        
        // 如果能量不足，尝试租赁能量
        if (currentEnergy < requiredEnergy) {
            const energyDeficit = requiredEnergy - currentEnergy;
            console.log(`[Collection] Energy deficit: ${energyDeficit}. Attempting to rent energy...`);
            
            try {
                const rentalResult = await this.energyService.rentEnergy(
                    this.collectionWallet.address,
                    energyDeficit,
                    taskId
                );
                
                console.log(`[Collection] ✅ Energy rented: ${rentalResult.energyAmount} from ${rentalResult.providerAddress}. TX: ${rentalResult.txHash}`);
                
                // 等待链上确认（通常需要 1-3 秒）
                console.log(`[Collection] Waiting for energy rental confirmation...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                // 重新获取能量（包括租赁的能量）
                currentEnergy = await this._getCollectionWalletEnergy();
                console.log(`[Collection] Updated energy after rental: ${currentEnergy}`);
            } catch (rentalError) {
                console.error(`[Collection] Failed to rent energy: ${rentalError.message}`);
                // 繼續使用現有能量，但記錄警告
            }
        }
        
        // 查詢用戶
        let usersQuery = `
            SELECT id, user_id, deposit_path_index, tron_deposit_address 
            FROM users 
            WHERE tron_deposit_address IS NOT NULL
        `;
        
        const queryLimit = maxUsers || (estimatedCapacity * 2);
        
        if (lastProcessedUserId && lastProcessedUserId > 0) {
            usersQuery += ` AND id > $1 ORDER BY id ASC LIMIT $2`;
        } else {
            usersQuery += ` ORDER BY id ASC LIMIT $1`;
        }
        
        const usersResult = lastProcessedUserId && lastProcessedUserId > 0
            ? await db.query(usersQuery, [lastProcessedUserId, queryLimit])
            : await db.query(usersQuery, [queryLimit]);
        
        if (usersResult.rows.length === 0) {
            return { collectedCount: 0, failedCount: 0, skippedCount: 0, processedCount: 0 };
        }
        
        console.log(`[Collection] 🔍 Starting collection sweep for ${usersResult.rows.length} addresses...`);
        console.log(`[Collection] Task ID: ${taskId}`);
        
        let collectedCount = 0;
        let failedCount = 0;
        let skippedCount = 0;
        let processedCount = 0;
        let actualEnergyUsed = 0;
        
        // 處理每個用戶
        for (const user of usersResult.rows) {
            // 檢查能量是否足夠
            if (actualEnergyUsed >= currentEnergy) {
                console.log(`[Collection] Energy exhausted. Processed ${processedCount} addresses.`);
                break;
            }
            
            // 檢查是否應該歸集
            const shouldCollectResult = await this._shouldCollect(user);
            if (!shouldCollectResult.shouldCollect) {
                skippedCount++;
                lastProcessedUserId = user.id;
                continue;
            }
            
            // 檢查能量（包括動態租賃）
            let remainingEnergy = await this._getCollectionWalletEnergy() - actualEnergyUsed;
            const ENERGY_THRESHOLD = 32000;
            
            if (remainingEnergy < ENERGY_THRESHOLD) {
                const energyNeeded = avgEnergy * 10;
                console.log(`[Collection] Energy running low (${remainingEnergy}). Attempting to rent ${energyNeeded} more...`);
                
                try {
                    const rentalResult = await this.energyService.rentEnergy(
                        this.collectionWallet.address,
                        energyNeeded,
                        taskId
                    );
                    console.log(`[Collection] ✅ Additional energy rented: ${rentalResult.energyAmount}. TX: ${rentalResult.txHash}`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    currentEnergy = await this._getCollectionWalletEnergy();
                    remainingEnergy = currentEnergy - actualEnergyUsed;
                    console.log(`[Collection] Updated remaining energy: ${remainingEnergy}`);
                } catch (rentalError) {
                    console.error(`[Collection] Failed to rent additional energy: ${rentalError.message}`);
                    if (remainingEnergy < avgEnergy) {
                        console.log(`[Collection] Insufficient energy for next transfer. Stopping.`);
                        break;
                    }
                }
            }
            
            if (remainingEnergy < avgEnergy) {
                console.log(`[Collection] Insufficient energy for next transfer. Stopping.`);
                break;
            }
            
            // 使用共享的核心邏輯處理用戶
            const result = await this._processUserCollection(user, shouldCollectResult.balance);
            
            if (result.success) {
                actualEnergyUsed += result.energyUsed;
                collectedCount++;
                lastProcessedUserId = user.id;
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                failedCount++;
                lastProcessedUserId = user.id;
                
                // 如果是能量不足錯誤，停止處理
                if (result.error && (result.error.includes('energy') || result.error.includes('ENERGY'))) {
                    console.log(`[Collection] Energy error detected. Stopping.`);
                    break;
                }
            }
            
            processedCount++;
        }
        
        // 更新游標
        if (lastProcessedUserId) {
            await db.query(
                `UPDATE collection_cursor SET last_processed_user_id = $1, updated_at = NOW()`,
                [lastProcessedUserId]
            );
        } else {
            await db.query(
                `UPDATE collection_cursor SET last_processed_user_id = 0, updated_at = NOW()`
            );
        }
        
        return { collectedCount, failedCount, skippedCount, processedCount };
    }

    /**
     * @description 执行归集流程（配置驱动的高吞吐量版本）
     */
    async collectFunds() {
        if (!this.collectionWallet) {
            console.warn("[Collection] Skipping: Collection wallet not configured.");
            return;
        }

        const startTime = Date.now();
        
        // 1. 从 collection_settings 表加载配置（与钱包关联）
        const settingsResult = await db.query(
            `SELECT * FROM collection_settings 
             WHERE collection_wallet_address = $1 AND is_active = true`,
            [this.collectionWallet.address]
        );
        
        if (settingsResult.rows.length === 0) {
            console.warn("[Collection] No active collection settings found for this wallet.");
            return;
        }
        
        const settings = settingsResult.rows[0];
        const batchSize = settings.batch_size || 500;
        const minEnergy = settings.min_energy || 35000;
        const maxConcurrency = settings.max_concurrency || 1;
        const daysWithoutDeposit = settings.days_without_deposit || 7;
        
        console.log(`[Collection] 🚀 Starting collection sweep`);
        console.log(`[Collection] Wallet: ${this.collectionWallet.address}`);
        console.log(`[Collection] Config: batchSize=${batchSize}, minEnergy=${minEnergy}, maxConcurrency=${maxConcurrency}, daysWithoutDeposit=${daysWithoutDeposit}`);
        
        try {
            // 2. 获取游标
            const cursorResult = await db.query(`SELECT last_processed_user_id FROM collection_cursor LIMIT 1`);
            const lastProcessedId = cursorResult.rows[0]?.last_processed_user_id || 0;
            
            // 3. 获取总用户数（用于进度显示）
            const totalResult = await db.query(
                `SELECT COUNT(*) as total FROM users WHERE tron_deposit_address IS NOT NULL`
            );
            const totalUsers = parseInt(totalResult.rows[0].total);
            
            // 4. 查询用户批次
            const usersResult = await db.query(
                `SELECT id, user_id, deposit_path_index, tron_deposit_address 
                 FROM users 
                 WHERE tron_deposit_address IS NOT NULL AND id > $1
                 ORDER BY id ASC 
                 LIMIT $2`,
                [lastProcessedId, batchSize]
            );
            
            if (usersResult.rows.length === 0) {
                console.log('[Collection] Reached end of user list, resetting cursor');
                await db.query(`UPDATE collection_cursor SET last_processed_user_id = 0, updated_at = NOW()`);
                return {
                    collectedCount: 0,
                    skippedCount: 0,
                    failedCount: 0,
                    cursorReset: true
                };
            }
            
            console.log(`[Collection] Fetched ${usersResult.rows.length} users (cursor: ${lastProcessedId} → ${usersResult.rows[usersResult.rows.length - 1].id})`);
            console.log(`[Collection] Progress: ${((lastProcessedId / totalUsers) * 100).toFixed(2)}% (${lastProcessedId}/${totalUsers})`);
            
            // 5. 分块处理用户
            const users = usersResult.rows;
            const chunkSize = 10;
            let collectedCount = 0;
            let skippedCount = 0;
            let failedCount = 0;
            let energyStopCount = 0;
            let shouldStopDueToEnergy = false;
            
            for (let i = 0; i < users.length; i += chunkSize) {
                if (shouldStopDueToEnergy) {
                    console.log(`[Collection] Energy circuit breaker triggered, stopping batch processing`);
                    break;
                }
                
                const chunk = users.slice(i, Math.min(i + chunkSize, users.length));
                console.log(`[Collection] Processing chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(users.length / chunkSize)} (${chunk.length} users)`);
                
                // 处理当前块中的每个用户
                for (const user of chunk) {
                    try {
                        // Step A: 检查是否应该归集
                        const shouldCollectResult = await this._shouldCollect(user);
                        if (!shouldCollectResult.shouldCollect) {
                            skippedCount++;
                            continue;
                        }
                        
                        // Step B: 能量熔断检查
                        const currentEnergy = await this._getCollectionWalletEnergy();
                        if (currentEnergy < minEnergy) {
                            console.warn(`[Collection] ⚠️ Energy below minimum (${currentEnergy} < ${minEnergy}), stopping execution`);
                            energyStopCount++;
                            shouldStopDueToEnergy = true;
                            
                            // 将此用户加入重试队列
                            await this._addToRetryQueue(user.user_id, `Energy below minimum: ${currentEnergy} < ${minEnergy}`);
                            break;
                        }
                        
                        // Step C: 执行归集
                        const result = await this._processUserCollection(user, shouldCollectResult.balance);
                        
                        if (result.success) {
                            collectedCount++;
                            console.log(`[Collection] ✅ Collected ${shouldCollectResult.balance} USDT from user ${user.user_id}`);
                        } else {
                            failedCount++;
                            console.error(`[Collection] ❌ Failed to collect from user ${user.user_id}: ${result.error}`);
                        }
                        
                        // 交易间延迟
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                    } catch (error) {
                        failedCount++;
                        console.error(`[Collection] ❌ Error processing user ${user.user_id}:`, safeErrorMessage(error));
                        await this._logCollectionFailure(user, safeErrorMessage(error));
                        await this._addToRetryQueue(user.user_id, safeErrorMessage(error, 500));
                    }
                }
                
                // 块间非阻塞延迟（让出事件循环）
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // 6. 更新游标（即使因能量停止，也要移动游标）
            const newCursor = users[users.length - 1].id;
            await db.query(
                `UPDATE collection_cursor SET last_processed_user_id = $1, updated_at = NOW()`,
                [newCursor]
            );
            
            // 7. 输出统计
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`[Collection] ✅ Sweep completed in ${elapsed}s`);
            console.log(`[Collection] Summary:`);
            console.log(`  - Batch Size: ${usersResult.rows.length}`);
            console.log(`  - Collected: ${collectedCount}`);
            console.log(`  - Skipped: ${skippedCount}`);
            console.log(`  - Failed: ${failedCount}`);
            console.log(`  - Energy Stopped: ${energyStopCount}`);
            console.log(`  - New Cursor: ${newCursor}`);
            console.log(`  - Progress: ${((newCursor / totalUsers) * 100).toFixed(2)}% (${newCursor}/${totalUsers})`);
            
            // 如果有成功归集，重置连续失败计数
            if (collectedCount > 0) {
                this.consecutiveFailures = 0;
            }
            
            return {
                collectedCount,
                skippedCount,
                failedCount,
                energyStopCount,
                processedCount: usersResult.rows.length
            };
            
        } catch (error) {
            console.error('[Collection] Fatal error:', safeErrorMessage(error));
            throw error;
        }
    }

    /**
     * @description 手動執行歸集任務（由管理員觸發）
     * @param {number} adminId - 管理員 ID
     * @param {string} adminUsername - 管理員用戶名
     * @param {string} ipAddress - 管理員 IP 地址
     * @param {string} userAgent - 管理員 User-Agent
     */
    async executeManualCollection(adminId, adminUsername, ipAddress, userAgent) {
        const { recordAuditLog } = require('./auditLogService');
        
        // 記錄審計日誌
        try {
            await recordAuditLog({
                adminId: adminId,
                adminUsername: adminUsername,
                action: 'manual_collection',
                resource: 'collection',
                resourceId: null,
                description: `手動觸發歸集任務`,
                ipAddress: ipAddress,
                userAgent: userAgent
            });
        } catch (auditError) {
            console.error('[Collection] Failed to record audit log:', auditError);
        }

        let collectedCount = 0;
        let failedCount = 0;
        let errorMessage = null;

        try {
            console.log(`[Collection] 🔧 Manual collection triggered by admin ${adminUsername} (ID: ${adminId})`);

            if (!this.collectionWallet) {
                throw new Error('歸集錢包未配置');
            }

            // 執行歸集邏輯（重用現有的 collectFunds 方法，但需要修改以返回統計信息）
            // 由於 collectFunds 是異步的且不返回統計，我們需要手動執行歸集邏輯
            const result = await this._executeCollectionLogic();
            collectedCount = result.collectedCount;
            failedCount = result.failedCount;

            // 創建成功通知
            const notificationMessage = `手動歸集完成。成功: ${collectedCount}筆, 失敗: ${failedCount}筆。`;
            await this._createNotification('MANUAL_COLLECTION', notificationMessage);

            console.log(`[Collection] ✅ Manual collection completed: ${collectedCount} collected, ${failedCount} failed`);
        } catch (error) {
            errorMessage = error.message;
            console.error(`[Collection] ❌ Manual collection failed:`, error);

            // 創建失敗通知
            await this._createNotification('COLLECTION_ERROR', `手動歸集執行異常: ${errorMessage}`);
        }
    }

    /**
     * @description 執行歸集邏輯（返回統計信息，手動模式）
     * @returns {Promise<{collectedCount: number, failedCount: number}>}
     */
    async _executeCollectionLogic() {
        // 使用共享的批量執行方法，跳過時間檢查
        const result = await this._executeCollectionBatch({ skipTimeCheck: true });
        return { 
            collectedCount: result.collectedCount, 
            failedCount: result.failedCount 
        };
    }

    /**
     * @description 創建通知記錄並推送 Socket.IO 事件
     * @param {string} type - 通知類型
     * @param {string} message - 通知消息
     */
    async _createNotification(type, message) {
        try {
            // 創建通知記錄
            const result = await db.query(
                `INSERT INTO tron_notifications (type, message, resolved, created_at)
                 VALUES ($1, $2, false, NOW())
                 RETURNING id`,
                [type, message]
            );

            const notificationId = result.rows[0].id;
            console.log(`[Collection] Created notification: ${notificationId} (${type})`);

            // 推送 Socket.IO 事件
            if (this.io) {
                this.io.to('admin').emit('admin:notification_new', {
                    id: notificationId,
                    type: type,
                    message: message,
                    resolved: false
                });
                console.log(`[Collection] Emitted Socket.IO notification to admin room`);
            } else {
                console.warn(`[Collection] Socket.IO instance not available, skipping push`);
            }
        } catch (error) {
            console.error(`[Collection] Failed to create notification:`, error);
        }
    }
}

// (单例模式)
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
