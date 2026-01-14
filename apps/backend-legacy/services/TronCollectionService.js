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
        
        // (★★★ v9.0 升級：使用新的 collection_cursor 表（基於 last_processed_user_id）★★★)
        const cursorResult = await db.query(
            `SELECT * FROM collection_cursor LIMIT 1`
        );
        
        let cursor = cursorResult.rows[0];
        let lastProcessedUserId = null;
        
        if (cursor) {
            lastProcessedUserId = cursor.last_processed_user_id ? parseInt(cursor.last_processed_user_id) : null;
        } else {
            // 創建新的 cursor（如果不存在）
            await db.query(
                `INSERT INTO collection_cursor (last_processed_user_id) VALUES (0)`
            );
            lastProcessedUserId = null;
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
        
        // 生成任务 ID（用于追踪能量租赁）
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
                // (★★★ v9.1 優化：更詳細的能量租賃失敗警報 ★★★)
                const now = Date.now();
                if (!this.lastEnergyExhaustedAlertTime || (now - this.lastEnergyExhaustedAlertTime) > 3600000) {
                    const energyDeficit = requiredEnergy - currentEnergy;
                    let detailedMessage = `能量租賃失敗！\n\n`;
                    detailedMessage += `歸集錢包: ${this.collectionWallet.address}\n`;
                    detailedMessage += `當前能量: ${currentEnergy}\n`;
                    detailedMessage += `所需能量: ${requiredEnergy}\n`;
                    detailedMessage += `能量缺口: ${energyDeficit}\n`;
                    detailedMessage += `錯誤: ${rentalError.message}\n\n`;
                    
                    // 添加诊断建议
                    if (rentalError.message.includes('No available energy provider')) {
                        detailedMessage += `診斷建議：\n`;
                        detailedMessage += `1. 檢查 platform_wallets 表中是否有 is_energy_provider=true 的記錄\n`;
                        detailedMessage += `2. 確認能量提供者的私鑰已配置在 .env 中（格式：TRON_PK_{address}）\n`;
                        detailedMessage += `3. 確認能量提供者已激活（is_active=true）\n`;
                        detailedMessage += `4. 檢查能量提供者的能量是否足夠（至少 ${requiredEnergy}）\n`;
                        detailedMessage += `5. 確認能量提供者已質押足夠的 TRX（建議至少 ${Math.ceil(requiredEnergy / 10000)} TRX）\n`;
                    } else {
                        detailedMessage += `請檢查能量提供者配置和網絡連接！`;
                    }
                    
                    await this.alertService.sendCritical(detailedMessage);
                    this.lastEnergyExhaustedAlertTime = now;
                }
                // 继续使用现有能量，但记录警告
            }
        }
        
        // 估算可以处理的地址数量
        const estimatedCapacity = Math.floor(currentEnergy / avgEnergy);
        console.log(`[Collection] Estimated capacity: ${estimatedCapacity} addresses`);
        
        if (estimatedCapacity <= 0) {
            console.log(`[Collection] Insufficient energy (${currentEnergy}). Stopping for today.`);
            // (★★★ v9.0 新增：能量耗盡警報 ★★★)
            const now = Date.now();
            if (!this.lastEnergyExhaustedAlertTime || (now - this.lastEnergyExhaustedAlertTime) > 3600000) {
                await this.alertService.sendCritical(
                    `歸集能量耗盡！\n\n` +
                    `歸集錢包: ${this.collectionWallet.address}\n` +
                    `當前能量: ${currentEnergy}\n` +
                    `平均每筆消耗: ${avgEnergy}\n` +
                    `無法處理任何歸集任務！\n\n` +
                    `請立即租賃能量或檢查能量提供者！`
                );
                this.lastEnergyExhaustedAlertTime = now;
            }
            // 更新 cursor，标记今天已处理（但没有处理任何地址）
            await db.query(
                `UPDATE collection_cursor SET last_processed_user_id = 0, updated_at = NOW()`
            );
            return;
        }
        
        // (★★★ v9.0 升級：使用新的游標邏輯（基於 last_processed_user_id）★★★)
        let usersQuery = `
            SELECT id, user_id, deposit_path_index, tron_deposit_address 
            FROM users 
            WHERE tron_deposit_address IS NOT NULL
        `;
        
        if (lastProcessedUserId && lastProcessedUserId > 0) {
            usersQuery += ` AND id > $1 ORDER BY id ASC LIMIT $2`;
        } else {
            usersQuery += ` ORDER BY id ASC LIMIT $1`;
        }
        
        const usersResult = lastProcessedUserId && lastProcessedUserId > 0
            ? await db.query(usersQuery, [lastProcessedUserId, estimatedCapacity * 2]) // 多查一些，因为有些可能不符合条件
            : await db.query(usersQuery, [estimatedCapacity * 2]);
        
        if (usersResult.rows.length === 0) {
            console.log('[Collection] No users to process. Resetting cursor.');
            // (★★★ v9.0 升級：重置 cursor，从头开始 ★★★)
            await db.query(
                `UPDATE collection_cursor SET last_processed_user_id = 0, updated_at = NOW()`
            );
            return;
        }
        
        console.log(`[Collection] 🔍 Starting collection sweep for ${usersResult.rows.length} addresses...`);
        console.log(`[Collection] Task ID: ${taskId}`);
        
        let processedCount = 0;
        let collectedCount = 0;
        let skippedCount = 0;
        // lastProcessedUserId 已在函數開頭聲明，此處移除重複聲明
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
                lastProcessedUserId = user.id; // (★★★ v9.0 升級：使用 user.id 而不是 user_id ★★★)
                continue;
            }
            
            // (注意：不再自动激活用户地址，用户需要自行激活或通过其他方式激活)
            
            // (★★★ v9.0 升級：在 transferFrom 之前檢查能量 ★★★)
            // 获取当前能量（包括已租赁的能量）
            let remainingEnergy = await this._getCollectionWalletEnergy() - actualEnergyUsed;
            
            // 能量閾值：32,000（根據需求）
            const ENERGY_THRESHOLD = 32000;
            
            // 如果能量不足，尝试租赁能量
            if (remainingEnergy < ENERGY_THRESHOLD) {
                const energyNeeded = avgEnergy * 10; // 租赁足够处理 10 笔交易的能量
                console.log(`[Collection] Energy running low (${remainingEnergy}). Attempting to rent ${energyNeeded} more...`);
                
                try {
                    const rentalResult = await this.energyService.rentEnergy(
                        this.collectionWallet.address,
                        energyNeeded,
                        taskId
                    );
                    
                    console.log(`[Collection] ✅ Additional energy rented: ${rentalResult.energyAmount}. TX: ${rentalResult.txHash}`);
                    
                    // (★★★ v9.0 升級：等待鏈上確認 ★★★)
                    console.log(`[Collection] Waiting for energy rental confirmation...`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    
                    // 重新获取能量
                    currentEnergy = await this._getCollectionWalletEnergy();
                    remainingEnergy = currentEnergy - actualEnergyUsed;
                    console.log(`[Collection] Updated remaining energy: ${remainingEnergy}`);
                } catch (rentalError) {
                    console.error(`[Collection] Failed to rent additional energy: ${rentalError.message}`);
                    // 如果租赁失败且能量确实不足，停止处理
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
                        // (★★★ v9.0 升級：將失敗任務插入 retry queue ★★★)
                        try {
                            const existingRetry = await db.query(
                                `SELECT id, retry_count FROM collection_retry_queue WHERE user_id = $1`,
                                [user.user_id]
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
                                    [newRetryCount, nextRetryDelay, `Approve failed: ${approveError.message.substring(0, 400)}`, user.user_id]
                                );
                            } else {
                                await db.query(
                                    `INSERT INTO collection_retry_queue 
                                     (user_id, retry_count, next_retry_at, error_reason) 
                                     VALUES ($1, 0, NOW() + INTERVAL '1 hour', $2)`,
                                    [user.user_id, `Approve failed: ${approveError.message.substring(0, 400)}`]
                                );
                            }
                        } catch (retryQueueError) {
                            console.error(`[Collection] Failed to add user to retry queue:`, retryQueueError);
                        }
                        skippedCount++;
                        lastProcessedUserId = user.id; // (★★★ v9.0 升級：使用 user.id ★★★)
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
                lastProcessedUserId = user.id; // (★★★ v9.0 升級：使用 user.id ★★★)
                
                // 等待一下，避免过于频繁
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                console.error(`[Collection] ❌ Failed to collect from user ${user.user_id}:`, error.message);
                
                // (★★★ v9.0 升級：記錄失敗日誌到 collection_logs ★★★)
                try {
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
                } catch (logError) {
                    console.error(`[Collection] Failed to log error to collection_logs:`, logError);
                }
                
                // (★★★ v9.0 升級：將失敗任務插入 collection_retry_queue ★★★)
                try {
                    // 檢查是否已存在
                    const existingRetry = await db.query(
                        `SELECT id, retry_count FROM collection_retry_queue WHERE user_id = $1`,
                        [user.user_id]
                    );
                    
                    if (existingRetry.rows.length > 0) {
                        // 更新現有記錄
                        const newRetryCount = existingRetry.rows[0].retry_count + 1;
                        const nextRetryDelay = Math.pow(2, newRetryCount); // 指數退避：1h, 2h, 4h, 8h...
                        await db.query(
                            `UPDATE collection_retry_queue 
                             SET retry_count = $1, 
                                 next_retry_at = NOW() + INTERVAL '1 hour' * $2,
                                 error_reason = $3,
                                 updated_at = NOW()
                             WHERE user_id = $4`,
                            [newRetryCount, nextRetryDelay, error.message.substring(0, 500), user.user_id]
                        );
                    } else {
                        // 插入新記錄
                        await db.query(
                            `INSERT INTO collection_retry_queue 
                             (user_id, retry_count, next_retry_at, error_reason) 
                             VALUES ($1, 0, NOW() + INTERVAL '1 hour', $2)`,
                            [user.user_id, error.message.substring(0, 500)]
                        );
                    }
                    console.log(`[Collection] Added user ${user.user_id} to retry queue`);
                } catch (retryQueueError) {
                    console.error(`[Collection] Failed to add user to retry queue:`, retryQueueError);
                }
                
                skippedCount++;
                lastProcessedUserId = user.id; // (★★★ v9.0 升級：使用 user.id ★★★)
                
                // 如果是能量不足错误，停止处理
                if (error.message && (error.message.includes('energy') || error.message.includes('ENERGY'))) {
                    console.log(`[Collection] Energy error detected. Stopping.`);
                    break;
                }
            }
            
            processedCount++;
        }
        
        // (★★★ v9.0 升級：更新新的 collection_cursor 表 ★★★)
        if (lastProcessedUserId) {
            await db.query(
                `UPDATE collection_cursor SET last_processed_user_id = $1, updated_at = NOW()`,
                [lastProcessedUserId]
            );
        } else {
            // 如果没有处理任何用户，重置 cursor
            await db.query(
                `UPDATE collection_cursor SET last_processed_user_id = 0, updated_at = NOW()`
            );
        }
        
        console.log(`[Collection] ✅ Collection sweep finished: ${collectedCount} collected, ${skippedCount} skipped, ${processedCount} processed`);
        
        // (★★★ v9.0 新增：檢查連續失敗並發送警報 ★★★)
        if (collectedCount === 0 && processedCount > 0) {
            // 所有處理都失敗
            this.consecutiveFailures++;
            if (this.consecutiveFailures >= 3) {
                await this.alertService.sendCritical(
                    `歸集服務連續失敗！\n\n` +
                    `連續失敗次數: ${this.consecutiveFailures}\n` +
                    `本次處理: ${processedCount} 個地址\n` +
                    `成功: ${collectedCount}\n` +
                    `跳過: ${skippedCount}\n\n` +
                    `請檢查歸集服務狀態和日誌！`
                );
            }
        } else if (collectedCount > 0) {
            // 有成功，重置計數
            this.consecutiveFailures = 0;
        }
        
        // (可选) 回收租赁的能量（如果所有处理完成）
        // 注意：可以根据业务需求决定是否立即回收，或者保留一段时间以便后续使用
        // 这里暂时注释掉，因为能量租赁通常有最小租赁时间限制
        /*
        try {
            const reclaimResult = await this.energyService.reclaimEnergy(taskId);
            console.log(`[Collection] Energy reclaimed: ${reclaimResult.reclaimedCount} rentals`);
        } catch (reclaimError) {
            console.error(`[Collection] Failed to reclaim energy: ${reclaimError.message}`);
        }
        */
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
