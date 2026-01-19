// 档案: backend/services/TronEnergyService.js
// 功能: 管理波场 Stake 2.0 的能量代理（Energy Rental）

const TronWeb = require('tronweb');
const db = require('@flipcoin/database');
const { getKmsInstance } = require('./KmsService');
const util = require('util');

// (从 .env 读取节点)
const NILE_NODE_HOST = process.env.NILE_NODE_HOST;
if (!NILE_NODE_HOST) {
    throw new Error("CRITICAL: NILE_NODE_HOST is not set in .env file!");
}

// (日志辅助函数)
function logError(error, context, address) {
    console.error(`[EnergyRental] ${context} for address ${address}. Details:`);
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

class TronEnergyService {
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

        this.kmsService = getKmsInstance();
        
        console.log(`✅ [EnergyRental] TronEnergyService initialized.`);
    }

    /**
     * @description 查找可用的能量提供者钱包
     * @param {number} requiredEnergy - 所需能量数量
     * @returns {Promise<Object|null>} 返回可用的提供者钱包信息，或 null
     */
    async findAvailableProvider(requiredEnergy) {
        try {
            const providers = await db.query(
                `SELECT * FROM platform_wallets 
                 WHERE chain_type = 'TRC20' 
                   AND is_energy_provider = true 
                   AND is_active = true
                 ORDER BY current_staked_trx DESC`
            );

            if (providers.rows.length === 0) {
                console.error(`[EnergyRental] ❌ No energy providers found in database.`);
                console.error(`[EnergyRental] Please check platform_wallets table for records with:`);
                console.error(`[EnergyRental]   - chain_type = 'TRC20'`);
                console.error(`[EnergyRental]   - is_energy_provider = true`);
                console.error(`[EnergyRental]   - is_active = true`);
                throw new Error('No available energy provider found for ' + requiredEnergy + ' energy');
            }

            console.log(`[EnergyRental] Found ${providers.rows.length} energy provider(s), checking availability...`);
            
            const providerStatus = [];

            // 检查每个提供者的可用能量
            for (const provider of providers.rows) {
                try {
                    const account = await this.tronWeb.trx.getAccount(provider.address);
                    const availableEnergy = account.energy || 0;
                    const frozenBalance = account.frozenV2 || [];
                    
                    // 计算总质押的 TRX（用于估算可用能量）
                    let totalFrozen = 0;
                    if (frozenBalance && frozenBalance.length > 0) {
                        totalFrozen = frozenBalance.reduce((sum, f) => {
                            return sum + (parseInt(f.amount || 0) / 1000000); // 转换为 TRX
                        }, 0);
                    }

                    // 估算可用能量：1 TRX 质押 ≈ 10,000 能量（实际值可能因网络而异）
                    const estimatedEnergy = Math.floor(totalFrozen * 10000);
                    
                    // 获取私钥
                    const pkEnvVar = `TRON_PK_${provider.address}`;
                    const privateKey = process.env[pkEnvVar];
                    
                    const status = {
                        address: provider.address,
                        availableEnergy,
                        estimatedEnergy,
                        stakedTrx: totalFrozen,
                        hasPrivateKey: !!privateKey,
                        envVar: pkEnvVar
                    };
                    providerStatus.push(status);
                    
                    // 检查是否有足够的能量
                    if (estimatedEnergy >= requiredEnergy || availableEnergy >= requiredEnergy) {
                        if (!privateKey) {
                            console.warn(`[EnergyRental] ⚠️ Provider ${provider.address} has enough energy but missing private key (${pkEnvVar})`);
                            continue;
                        }

                        console.log(`[EnergyRental] ✅ Found available provider: ${provider.address}`);
                        console.log(`[EnergyRental]   Available: ${availableEnergy}, Estimated: ${estimatedEnergy}, Staked: ${totalFrozen} TRX`);
                        
                        return {
                            address: provider.address,
                            privateKey: privateKey,
                            availableEnergy: availableEnergy,
                            estimatedEnergy: estimatedEnergy,
                            stakedTrx: totalFrozen
                        };
                    } else {
                        console.warn(`[EnergyRental] ⚠️ Provider ${provider.address} insufficient energy:`);
                        console.warn(`[EnergyRental]   Required: ${requiredEnergy}, Available: ${availableEnergy}, Estimated: ${estimatedEnergy}`);
                    }
                } catch (error) {
                    logError(error, 'Error checking provider energy', provider.address);
                    providerStatus.push({
                        address: provider.address,
                        error: error.message
                    });
                    continue;
                }
            }

            // 汇总所有提供者的状态
            console.error(`[EnergyRental] ❌ No provider has enough energy (required: ${requiredEnergy})`);
            console.error(`[EnergyRental] Provider summary:`);
            providerStatus.forEach(status => {
                if (status.error) {
                    console.error(`[EnergyRental]   - ${status.address}: ERROR - ${status.error}`);
                } else {
                    console.error(`[EnergyRental]   - ${status.address}: Available=${status.availableEnergy}, Estimated=${status.estimatedEnergy}, Staked=${status.stakedTrx} TRX, HasKey=${status.hasPrivateKey}`);
                    if (!status.hasPrivateKey) {
                        console.error(`[EnergyRental]     ⚠️ Missing private key in .env (${status.envVar})`);
                    }
                }
            });
            
            throw new Error('No available energy provider found for ' + requiredEnergy + ' energy');
        } catch (error) {
            logError(error, 'Error finding available provider', 'N/A');
            throw error;
        }
    }

    /**
     * @description 租赁能量给接收者钱包
     * @param {string} receiverAddress - 接收能量的钱包地址（通常是归集钱包）
     * @param {number} energyAmount - 要租赁的能量数量
     * @param {string} taskId - 关联的任务 ID（可选，用于追踪）
     * @returns {Promise<Object>} 返回租赁信息 { rentalId, txHash, providerAddress }
     */
    async rentEnergy(receiverAddress, energyAmount, taskId = null) {
        if (!receiverAddress || !energyAmount || energyAmount <= 0) {
            throw new Error('Invalid parameters: receiverAddress and energyAmount are required');
        }

        // 查找可用的提供者
        const provider = await this.findAvailableProvider(energyAmount);
        if (!provider) {
            throw new Error(`No available energy provider found for ${energyAmount} energy`);
        }

        console.log(`[EnergyRental] Renting ${energyAmount} energy from ${provider.address} to ${receiverAddress}`);

        try {
            // #region agent log
            const providerAccount = await this.tronWeb.trx.getAccount(provider.address);
            const energyBefore = providerAccount.energy || 0;
            fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TronEnergyService.js:rentEnergy',message:'Before delegateResource - energy check',data:{providerAddress:provider.address,receiverAddress,energyAmount,energyBefore},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            
            this.tronWeb.setPrivateKey(provider.privateKey);

            // 使用 delegateResourceV2 代理能量
            // 注意：TronWeb 的 API 可能因版本而异，这里使用 delegateResource
            // 如果支持 delegateResourceV2，请使用该 API
            const transaction = await this.tronWeb.transactionBuilder.delegateResource(
                energyAmount, // 能量数量
                receiverAddress, // 接收者地址
                'ENERGY', // 资源类型：ENERGY 或 BANDWIDTH
                provider.address, // 提供者地址
                false // lock: false 表示不锁定，true 表示锁定
            );

            if (!transaction) {
                throw new Error('Failed to build delegateResource transaction');
            }

            // 签名交易
            const signedTx = await this.tronWeb.trx.sign(transaction);
            
            // 广播交易
            const receipt = await this.tronWeb.trx.sendRawTransaction(signedTx);

            if (!receipt || !receipt.txid) {
                throw new Error('Failed to broadcast delegateResource transaction');
            }

            const txHash = receipt.txid;
            console.log(`[EnergyRental] ✅ Energy rental transaction sent. TX: ${txHash}`);

            // #region agent log
            const providerAccountAfter = await this.tronWeb.trx.getAccount(provider.address);
            const energyAfter = providerAccountAfter.energy || 0;
            fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TronEnergyService.js:rentEnergy',message:'After delegateResource - energy check',data:{providerAddress:provider.address,receiverAddress,txHash,energyBefore,energyAfter,energyDiff:energyBefore-energyAfter,rentedAmount:energyAmount},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
            // #endregion

            // 记录到数据库
            const rentalResult = await db.query(
                `INSERT INTO energy_rentals 
                 (provider_address, receiver_address, energy_amount, status, tx_id, related_task_id) 
                 VALUES ($1, $2, $3, 'ACTIVE', $4, $5) 
                 RETURNING id`,
                [provider.address, receiverAddress, energyAmount, txHash, taskId]
            );

            const rentalId = rentalResult.rows[0].id;
            console.log(`[EnergyRental] Rental record created: ID=${rentalId}`);

            return {
                rentalId: rentalId,
                txHash: txHash,
                providerAddress: provider.address,
                energyAmount: energyAmount
            };
        } catch (error) {
            logError(error, 'Error renting energy', receiverAddress);
            
            // 记录失败到数据库
            try {
                await db.query(
                    `INSERT INTO energy_rentals 
                     (provider_address, receiver_address, energy_amount, status, error_message, related_task_id) 
                     VALUES ($1, $2, $3, 'FAILED', $4, $5)`,
                    [provider.address, receiverAddress, energyAmount, error.message.substring(0, 500), taskId]
                );
            } catch (dbError) {
                console.error('[EnergyRental] Failed to record failed rental:', dbError);
            }
            
            throw error;
        }
    }

    /**
     * @description 回收能量（取消代理）
     * @param {string} taskId - 关联的任务 ID，用于查找需要回收的租赁记录
     * @returns {Promise<Object>} 返回回收信息 { reclaimedCount, txHashes }
     */
    async reclaimEnergy(taskId) {
        if (!taskId) {
            throw new Error('taskId is required for reclaiming energy');
        }

        try {
            // 查找该任务的所有 ACTIVE 租赁记录
            const activeRentals = await db.query(
                `SELECT * FROM energy_rentals 
                 WHERE related_task_id = $1 AND status = 'ACTIVE'`,
                [taskId]
            );

            if (activeRentals.rows.length === 0) {
                console.log(`[EnergyRental] No active rentals found for task ${taskId}`);
                return { reclaimedCount: 0, txHashes: [] };
            }

            const txHashes = [];
            let reclaimedCount = 0;

            for (const rental of activeRentals.rows) {
                try {
                    // 获取提供者私钥
                    const pkEnvVar = `TRON_PK_${rental.provider_address}`;
                    const privateKey = process.env[pkEnvVar];

                    if (!privateKey) {
                        console.warn(`[EnergyRental] Private key not found for provider ${rental.provider_address}`);
                        continue;
                    }

                    this.tronWeb.setPrivateKey(privateKey);

                    // 使用 undelegateResource 回收能量
                    const transaction = await this.tronWeb.transactionBuilder.undelegateResource(
                        rental.energy_amount,
                        rental.receiver_address,
                        'ENERGY',
                        rental.provider_address,
                        false
                    );

                    if (!transaction) {
                        throw new Error('Failed to build undelegateResource transaction');
                    }

                    const signedTx = await this.tronWeb.trx.sign(transaction);
                    const receipt = await this.tronWeb.trx.sendRawTransaction(signedTx);

                    if (!receipt || !receipt.txid) {
                        throw new Error('Failed to broadcast undelegateResource transaction');
                    }

                    const txHash = receipt.txid;
                    txHashes.push(txHash);

                    // 更新数据库状态
                    await db.query(
                        `UPDATE energy_rentals 
                         SET status = 'RECLAIMED', reclaimed_at = NOW() 
                         WHERE id = $1`,
                        [rental.id]
                    );

                    reclaimedCount++;
                    console.log(`[EnergyRental] ✅ Energy reclaimed. Rental ID: ${rental.id}, TX: ${txHash}`);
                } catch (error) {
                    logError(error, `Error reclaiming energy for rental ${rental.id}`, rental.provider_address);
                    // 继续处理其他租赁记录
                }
            }

            console.log(`[EnergyRental] Reclaimed ${reclaimedCount} out of ${activeRentals.rows.length} rentals`);
            return { reclaimedCount, txHashes };
        } catch (error) {
            logError(error, 'Error in reclaimEnergy', 'N/A');
            throw error;
        }
    }

    /**
     * @description 获取接收者钱包的当前能量（包括租赁的能量）
     * @param {string} receiverAddress - 接收者钱包地址
     * @returns {Promise<number>} 返回当前可用能量
     */
    async getReceiverEnergy(receiverAddress) {
        try {
            const account = await this.tronWeb.trx.getAccount(receiverAddress);
            return account.energy || 0;
        } catch (error) {
            logError(error, 'Error getting receiver energy', receiverAddress);
            throw error;
        }
    }
}

// (单例模式)
let instance = null;
function getTronEnergyInstance() {
    if (!instance) {
        instance = new TronEnergyService();
    }
    return instance;
}

module.exports = {
    getTronEnergyInstance
};

