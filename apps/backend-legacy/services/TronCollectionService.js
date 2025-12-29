// 档案: backend/services/TronCollectionService.js (★★★ v9.0 新归集逻辑版 ★★★)

const TronWeb = require('tronweb');
const db = require('@flipcoin/database');
const { getKmsInstance } = require('./KmsService');
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
        this.collectionWallet = null; // 归集钱包（单一）
        this.gasReserveWallet = null; // 用于启用/补 TRX 的钱包
        
        this._loadPlatformWallets();
    }

    // (载入归集钱包)
    async _loadPlatformWallets() {
        try {
            const wallets = await db.query(
                "SELECT * FROM platform_wallets WHERE chain_type = 'TRC20' AND is_active = true"
            );

            const collectionRow = wallets.rows.find(w => w.is_collection);
            if (collectionRow) {
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
     * @description 检查地址是否已激活
     * @returns {Promise<boolean>} true表示已激活，false表示未激活
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
     * @description 启用用户地址（转 1 TRX）
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
     * @description 获取归集钱包的当前能量
     */
    async _getCollectionWalletEnergy() {
        if (!this.collectionWallet) {
            throw new Error('Collection wallet not loaded');
        }
        
        try {
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
            
            console.log(`[Collection] ✅ TransferFrom successful. TX: ${receipt.txid}, Energy: ${actualEnergyUsed}`);
            return { txHash: receipt.txid, energyUsed: actualEnergyUsed };
        } catch (error) {
            logError(error, 'Error in transferFrom', userAddress);
            throw error;
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
     * @description 检查用户是否应该归集
     */
    async _shouldCollect(user) {
        try {
            // 检查 USDT 余额
            const balanceStr = await this._getUsdtBalance(user.tron_deposit_address);
            const balance = parseFloat(BigInt(balanceStr).toString()) / (10**USDT_DECIMALS);
            
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
            
            if (depositResult.rows.length === 0) {
                // 没有充值记录，检查用户創建时间
                const userResult = await db.query(
                    `SELECT created_at FROM users WHERE user_id = $1`,
                    [user.user_id]
                );
                if (userResult.rows.length > 0) {
                    const userCreatedAt = new Date(userResult.rows[0].created_at);
                    const daysSinceCreation = (Date.now() - userCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
                    if (daysSinceCreation < daysWithoutDeposit) {
                        return { shouldCollect: false, reason: `Created ${Math.floor(daysSinceCreation)} days ago, need ${daysWithoutDeposit} days` };
                    }
                }
            } else {
                const lastDepositTime = new Date(depositResult.rows[0].created_at);
                const daysSinceDeposit = (Date.now() - lastDepositTime.getTime()) / (1000 * 60 * 60 * 24);
                if (daysSinceDeposit < daysWithoutDeposit) {
                    return { shouldCollect: false, reason: `Last deposit ${Math.floor(daysSinceDeposit)} days ago, need ${daysWithoutDeposit} days` };
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
     * @description 执行归集流程
     */
    async collectFunds() {
        if (!this.collectionWallet) {
            console.warn("[Collection] Skipping collection: Collection wallet not configured.");
            return;
        }
        
        // 检查是否应该执行扫描（根据 scan_interval_days）
        const settingsResult = await db.query(
            `SELECT * FROM collection_settings 
             WHERE collection_wallet_address = $1 AND is_active = true`,
            [this.collectionWallet.address]
        );
        
        if (settingsResult.rows.length === 0) {
            console.warn("[Collection] No active collection settings found.");
            return;
        }
        
        const settings = settingsResult.rows[0];
        const scanIntervalDays = settings.scan_interval_days;
        
        // 检查上次扫描时间
        const cursorResult = await db.query(
            `SELECT * FROM collection_cursor 
             WHERE collection_wallet_address = $1`,
            [this.collectionWallet.address]
        );
        
        let cursor = cursorResult.rows[0];
        const today = new Date().toISOString().split('T')[0];
        
        if (cursor) {
            const lastProcessedDate = new Date(cursor.last_processed_date);
            const daysSinceLastScan = (Date.now() - lastProcessedDate.getTime()) / (1000 * 60 * 60 * 24);
            
            if (daysSinceLastScan < scanIntervalDays) {
                console.log(`[Collection] Last scan was ${Math.floor(daysSinceLastScan)} days ago, need ${scanIntervalDays} days. Skipping.`);
                return;
            }
        } else {
            // 創建新的 cursor
            await db.query(
                `INSERT INTO collection_cursor (collection_wallet_address, last_processed_date) 
                 VALUES ($1, $2)`,
                [this.collectionWallet.address, today]
            );
        }
        
        // 获取当前能量
        let currentEnergy;
        try {
            currentEnergy = await this._getCollectionWalletEnergy();
            console.log(`[Collection] Current energy: ${currentEnergy}`);
        } catch (error) {
            console.error('[Collection] Failed to get collection wallet energy:', error.message);
            return;
        }
        
        // 获取平均能量消耗
        const avgEnergy = await this._getAverageEnergyUsage();
        console.log(`[Collection] Average energy per transfer: ${avgEnergy}`);
        
        // 估算可以处理的地址数量
        const estimatedCapacity = Math.floor(currentEnergy / avgEnergy);
        console.log(`[Collection] Estimated capacity: ${estimatedCapacity} addresses`);
        
        if (estimatedCapacity <= 0) {
            console.log(`[Collection] Insufficient energy (${currentEnergy}). Stopping for today.`);
            // 更新 cursor，标记今天已处理（但没有处理任何地址）
            await db.query(
                `UPDATE collection_cursor SET last_processed_date = $1, updated_at = NOW() 
                 WHERE collection_wallet_address = $2`,
                [today, this.collectionWallet.address]
            );
            return;
        }
        
        // 获取需要归集的用户列表（按 user_id 顺序）
        let startUserId = null;
        if (cursor && cursor.last_user_id) {
            startUserId = cursor.last_user_id;
        }
        
        let usersQuery = `
            SELECT id, user_id, deposit_path_index, tron_deposit_address 
            FROM users 
            WHERE tron_deposit_address IS NOT NULL
        `;
        
        if (startUserId) {
            usersQuery += ` AND user_id > $1 ORDER BY user_id ASC LIMIT $2`;
        } else {
            usersQuery += ` ORDER BY user_id ASC LIMIT $1`;
        }
        
        const usersResult = startUserId 
            ? await db.query(usersQuery, [startUserId, estimatedCapacity * 2]) // 多查一些，因为有些可能不符合条件
            : await db.query(usersQuery, [estimatedCapacity * 2]);
        
        if (usersResult.rows.length === 0) {
            console.log('[Collection] No users to process. Resetting cursor.');
            // 重置 cursor，从头开始
            await db.query(
                `UPDATE collection_cursor SET last_user_id = NULL, last_processed_date = $1, updated_at = NOW() 
                 WHERE collection_wallet_address = $2`,
                [today, this.collectionWallet.address]
            );
            return;
        }
        
        console.log(`[Collection] 🔍 Starting collection sweep for ${usersResult.rows.length} addresses...`);
        
        let processedCount = 0;
        let collectedCount = 0;
        let skippedCount = 0;
        let lastProcessedUserId = null;
        let actualEnergyUsed = 0;
        
        for (const user of usersResult.rows) {
            // 检查能量是否足够
            if (actualEnergyUsed >= currentEnergy) {
                console.log(`[Collection] Energy exhausted. Processed ${processedCount} addresses.`);
                break;
            }
            
            // 检查是否应该归集
            const shouldCollectResult = await this._shouldCollect(user);
            if (!shouldCollectResult.shouldCollect) {
                skippedCount++;
                lastProcessedUserId = user.user_id;
                continue;
            }
            
            // (★★★ v9.1 新增：检查地址是否已激活，未激活才激活 ★★★)
            const isActivated = await this._isAddressActivated(user.tron_deposit_address);
            if (!isActivated) {
                console.log(`[Collection] Address ${user.tron_deposit_address} is not activated. Activating...`);
                const activationResult = await this.activateAddress(user.tron_deposit_address);
                if (!activationResult) {
                    console.warn(`[Collection] Failed to activate address for user ${user.user_id}. Skipping.`);
                    skippedCount++;
                    lastProcessedUserId = user.user_id;
                    continue;
                }
                // 等待激活交易确认
                await new Promise(resolve => setTimeout(resolve, 5000));
            } else {
                console.log(`[Collection] Address ${user.tron_deposit_address} is already activated. Proceeding with collection.`);
            }
            
            // 检查能量是否足够（预估）
            const remainingEnergy = currentEnergy - actualEnergyUsed;
            if (remainingEnergy < avgEnergy) {
                console.log(`[Collection] Insufficient energy for next transfer. Stopping.`);
                break;
            }
            
            try {
                // Step 1: 检查并执行 approve（如果需要）
                const allowanceStr = await this._checkAllowance(user.tron_deposit_address);
                const allowance = BigInt(allowanceStr);
                const balanceStr = await this._getUsdtBalance(user.tron_deposit_address);
                const balance = BigInt(balanceStr);
                
                if (allowance < balance) {
                    console.log(`[Collection] Approving for user ${user.user_id}...`);
                    try {
                        const userPrivateKey = this.kmsService.getPrivateKey('TRC20', user.deposit_path_index);
                        await this._approveCollection(userPrivateKey, user.tron_deposit_address);
                        // 等待交易确认
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    } catch (approveError) {
                        // approve 失败（可能是用户地址没有能量），跳过该用户
                        console.warn(`[Collection] Approve failed for user ${user.user_id}: ${approveError.message}. Skipping.`);
                        skippedCount++;
                        lastProcessedUserId = user.user_id;
                        continue;
                    }
                }
                
                // Step 2: 执行 transferFrom
                console.log(`[Collection] Collecting ${shouldCollectResult.balance} USDT from user ${user.user_id}...`);
                const transferResult = await this._transferFrom(user.tron_deposit_address, balanceStr);
                
                // 记录归集日志
                await db.query(
                    `INSERT INTO collection_logs 
                     (user_id, user_deposit_address, collection_wallet_address, amount, tx_hash, energy_used, status) 
                     VALUES ($1, $2, $3, $4, $5, $6, 'completed')`,
                    [
                        user.user_id,
                        user.tron_deposit_address,
                        this.collectionWallet.address,
                        shouldCollectResult.balance,
                        transferResult.txHash,
                        transferResult.energyUsed
                    ]
                );
                
                actualEnergyUsed += transferResult.energyUsed;
                collectedCount++;
                lastProcessedUserId = user.user_id;
                
                // 等待一下，避免过于频繁
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                console.error(`[Collection] ❌ Failed to collect from user ${user.user_id}:`, error.message);
                
                // 记录失败日志
                await db.query(
                    `INSERT INTO collection_logs 
                     (user_id, user_deposit_address, collection_wallet_address, amount, status, error_message) 
                     VALUES ($1, $2, $3, $4, 'failed', $5)`,
                    [
                        user.user_id,
                        user.tron_deposit_address,
                        this.collectionWallet.address,
                        shouldCollectResult.balance || 0,
                        error.message.substring(0, 500)
                    ]
                );
                
                skippedCount++;
                lastProcessedUserId = user.user_id;
                
                // 如果是能量不足错误，停止处理
                if (error.message && (error.message.includes('energy') || error.message.includes('ENERGY'))) {
                    console.log(`[Collection] Energy error detected. Stopping.`);
                    break;
                }
            }
            
            processedCount++;
        }
        
        // 更新 cursor
        if (lastProcessedUserId) {
            await db.query(
                `UPDATE collection_cursor SET last_user_id = $1, last_processed_date = $2, updated_at = NOW() 
                 WHERE collection_wallet_address = $3`,
                [lastProcessedUserId, today, this.collectionWallet.address]
            );
        } else {
            // 如果没有处理任何用户，重置 cursor
            await db.query(
                `UPDATE collection_cursor SET last_user_id = NULL, last_processed_date = $1, updated_at = NOW() 
                 WHERE collection_wallet_address = $2`,
                [today, this.collectionWallet.address]
            );
        }
        
        console.log(`[Collection] ✅ Collection sweep finished: ${collectedCount} collected, ${skippedCount} skipped, ${processedCount} processed`);
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
