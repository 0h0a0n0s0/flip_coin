// 档案: backend/services/TronListener.js (★★★ v8.49 最终修正版 ★★★)

const TronWeb = require('tronweb');
const db = require('@flipcoin/database');
const util = require('util');
const axios = require('axios'); // (★★★ v8.48 新增 ★★★)
const { logBalanceChange, CHANGE_TYPES } = require('../utils/balanceChangeLogger');

// (★★★ v8.49 修正：从 .env 读取 Listener 节点 ★★★)
const NILE_LISTENER_HOST = process.env.NILE_LISTENER_HOST;
if (!NILE_LISTENER_HOST) {
    throw new Error("CRITICAL: NILE_LISTENER_HOST is not set in .env file! (e.g., https://go.getblock.io/YOUR_API_KEY/)");
}
// (★★★ v8.49 修正：从 .env 读取主节点 (僅用于地址转换) ★★★)
const NILE_NODE_HOST = process.env.NILE_NODE_HOST;
if (!NILE_NODE_HOST) {
    throw new Error("CRITICAL: NILE_NODE_HOST is not set in .env file!");
}

// (★★★ v8.49 核心修正：使用 Nile 測試网的 USDT 合约地址 ★★★)
const DEFAULT_USDT_CONTRACT = 'TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs';
const USDT_CONTRACT_ADDRESS = process.env.USDT_CONTRACT_ADDRESS || DEFAULT_USDT_CONTRACT; 
const USDT_DECIMALS = 6; 
const TRX_DECIMALS = 6;
const POLLING_INTERVAL_MS = 10000; 
const TRONGRID_API_KEY = process.env.TRONGRID_API_KEY || process.env.TRON_PRO_API_KEY || null;

// (日志辅助函数)
function logPollError(error, context) {
    console.error(`[v7-Poll] ${context}. Details:`);
    try {
        if (error && error.message) {
            // (★★★ v8.48 修正：如果是 axios 错误，显示 config ★★★)
            if (error.config) {
                 console.error(`[Axios Error] URL: ${error.config.url}`);
                 console.error(`[Axios Error] Params: ${JSON.stringify(error.config.params)}`);
            }
            // (★★★ v8.48 修正：显示 response data (如果节点有返回错误讯息) ★★★)
            if (error.response && error.response.data) {
                console.error(`[Axios Error] Response: ${JSON.stringify(error.response.data)}`);
            }
            console.error(JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        } else {
             console.error(JSON.stringify(error, null, 2));
        }
    } catch (e) {
        console.error(util.inspect(error, { depth: null, showHidden: true }));
    }
}


class TronListener {
    constructor(io, connectedUsers) {
        this.io = io;
        this.connectedUsers = connectedUsers;
        
        // (★★★ v8.49 修正：僅用于地址转换 ★★★)
        // (我们仍然需要 tronWeb 實例来進行 HEX 地址转换)
        this.tronWeb = new TronWeb({
            fullHost: NILE_NODE_HOST, // (使用主节点)
            solidityHost: NILE_NODE_HOST,
            privateKey: '01'
        });

        this.isPolling = false; 
        this.lastTrc20PollTimestamp = Date.now() - (10 * 60 * 1000); // (预设查询过去 10 分钟)
        this.lastTrxPollTimestamp = Date.now() - (10 * 60 * 1000);
        
        // (★★★ v8.49 修正：建立 axios 實例，指向 Listener 节点 ★★★)
        this.axiosInstance = axios.create({
            baseURL: NILE_LISTENER_HOST,
            timeout: 60000, // (增加 timeout 从 10 秒到 60 秒)
            headers: TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': TRONGRID_API_KEY } : {},
            // (GetBlock 节点不需要 API Key 在 Header 中，因为它在 URL 里)
            // (增加重試和错误处理)
            validateStatus: function (status) {
                return status < 500; // 只对 5xx 错误拋出異常
            }
        });

        if (NILE_LISTENER_HOST.includes('getblock.io')) {
            console.warn(`[v7-Poll] WARNING: Detected GetBlock endpoint for NILE_LISTENER_HOST. TronGrid v1 routes (/v1/...) may return 404 on GetBlock. Prefer https://nile.trongrid.io or another TronGrid-compatible host for listener polling.`);
        }

        // (★★★ v8.49 修改日志 ★★★)
        console.log(`✅ [v7-Poll] TronListener.js (NILE TESTNET) initialized (v8.49 Manual Axios Logic / GetBlock Node).`);
    }

    async start() {
        console.log(`[v7-Poll] Starting Account Polling Service (Interval: ${POLLING_INTERVAL_MS}ms)`);
        
        // (立即执行第一次)
        this._pollAllUsers();
        
        // (设定定时器)
        setInterval(() => this._pollAllUsers(), POLLING_INTERVAL_MS);
    }

    /**
     * (★★★ v8.49 核心：使用 Axios 手动轮询 v1 API ★★★)
     */
    async _pollAllUsers() {
        if (this.isPolling) {
            return;
        }
        this.isPolling = true;
        
        let usersToPoll = [];
        try {
            const usersResult = await db.query(
                'SELECT id, user_id, tron_deposit_address FROM users WHERE tron_deposit_address IS NOT NULL'
            );
            usersToPoll = usersResult.rows;
        } catch (dbError) {
             console.error("[v7-Poll] CRITICAL: Failed to fetch users from DB.", dbError);
             this.isPolling = false;
             return;
        }

        if (usersToPoll.length === 0) {
            this.isPolling = false;
            return;
        }

        let newTrc20Timestamp = this.lastTrc20PollTimestamp;
        let newTrxTimestamp = this.lastTrxPollTimestamp;

        for (const user of usersToPoll) {
            const latestUsdtTs = await this._pollUsdtTransactionsForUser(user);
            if (latestUsdtTs !== null && latestUsdtTs !== undefined) {
                // (無论是否处理，都更新时间戳以避免重复查询)
                if (latestUsdtTs > newTrc20Timestamp) {
                    newTrc20Timestamp = latestUsdtTs;
                }
            }

            const latestTrxTs = await this._pollTrxTransactionsForUser(user);
            if (latestTrxTs !== null && latestTrxTs !== undefined) {
                // (無论是否处理，都更新时间戳以避免重复查询)
                if (latestTrxTs > newTrxTimestamp) {
                    newTrxTimestamp = latestTrxTs;
                }
            }
        }
        
        // (更新时间戳，加 1ms 避免下次轮询重复获取最後一笔)
        const oldTrc20Ts = this.lastTrc20PollTimestamp;
        const oldTrxTs = this.lastTrxPollTimestamp;
        
        this.lastTrc20PollTimestamp = newTrc20Timestamp + 1;
        this.lastTrxPollTimestamp = newTrxTimestamp + 1;
        
        // (只在时间戳有变化时输出日志，避免日志噪音)
        if (this.lastTrc20PollTimestamp !== oldTrc20Ts + 1 || this.lastTrxPollTimestamp !== oldTrxTs + 1) {
            console.log(`[v7-Poll] 📅 Timestamp updated: TRC20=${this.lastTrc20PollTimestamp}, TRX=${this.lastTrxPollTimestamp}`);
        }
        
        this.isPolling = false;
    }

    async _pollUsdtTransactionsForUser(user, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await this.axiosInstance.get(
                    `v1/accounts/${user.tron_deposit_address}/transactions/trc20`,
                    {
                        params: {
                            only_to: true,
                            only_confirmed: true,
                            min_block_timestamp: this.lastTrc20PollTimestamp,
                            contract_address: USDT_CONTRACT_ADDRESS,
                            limit: 50,
                            order_by: 'block_timestamp,asc'
                        }
                    }
                );

                // (检查响应狀态)
                if (response.status >= 400) {
                    console.warn(`[v7-Poll] USDT API returned status ${response.status} for ${user.user_id}. Response:`, response.data);
                    if (attempt < retries) {
                        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                        continue;
                    }
                    return null;
                }

                const transactions = response.data && response.data.data ? response.data.data : [];
                if (transactions.length === 0) {
                    return null;
                }

                let latestTimestamp = null;
                let processedCount = 0;
                let skippedCount = 0;

                for (const tx of transactions) {
                    // (無论是否处理，都先更新 latestTimestamp 以避免重复查询)
                    if (!latestTimestamp || tx.block_timestamp > latestTimestamp) {
                        latestTimestamp = tx.block_timestamp;
                    }

                    const eventData = {
                        transaction_id: tx.transaction_id,
                        result: {
                            from: tx.from,
                            to: tx.to,
                            value: tx.value
                        },
                        block_timestamp: tx.block_timestamp
                    };

                    // (处理交易，检查是否成功处理)
                    const wasProcessed = await this._processDeposit(eventData);
                    if (wasProcessed) {
                        processedCount++;
                    } else {
                        skippedCount++;
                    }
                }

                // (只在有新交易时输出日志)
                if (transactions.length > 0) {
                    if (processedCount > 0 || skippedCount > 0) {
                        console.log(`[v7-Poll] 💰 USDT poll for ${user.user_id}: ${processedCount} processed, ${skippedCount} skipped`);
                    }
                }

                // (确保返回 latestTimestamp，即使所有交易都被跳过)
                return latestTimestamp;
            } catch (error) {
                // (如果是 DNS 错误或超时，尝試重試)
                const isRetryable = error.code === 'EAI_AGAIN' || 
                                    error.code === 'ECONNABORTED' || 
                                    error.code === 'ETIMEDOUT' ||
                                    error.message.includes('timeout');
                
                if (isRetryable && attempt < retries) {
                    console.warn(`[v7-Poll] USDT poll failed (attempt ${attempt}/${retries}) for ${user.user_id}, retrying... Error:`, error.message);
                    await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
                    continue;
                }
                
                // (最後一次尝試失败或非重試错误)
                logPollError(error, `Failed to poll USDT txs for ${user.user_id} (attempt ${attempt}/${retries})`);
                return null;
            }
        }
        return null;
    }

    async _pollTrxTransactionsForUser(user, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await this.axiosInstance.get(
                    `v1/accounts/${user.tron_deposit_address}/transactions`,
                    {
                        params: {
                            only_to: true,
                            only_confirmed: true,
                            min_block_timestamp: this.lastTrxPollTimestamp,
                            limit: 50,
                            order_by: 'block_timestamp,asc'
                        }
                    }
                );

                // (检查响应狀态)
                if (response.status >= 400) {
                    console.warn(`[v7-Poll] TRX API returned status ${response.status} for ${user.user_id}. Response:`, response.data);
                    if (attempt < retries) {
                        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                        continue;
                    }
                    return null;
                }

                const transactions = response.data && response.data.data ? response.data.data : [];
                if (transactions.length === 0) {
                    return null;
                }

                let latestTimestamp = null;
                let processedCount = 0;
                let skippedCount = 0;
                let filteredCount = 0;
                const depositHex = this.tronWeb.address.toHex(user.tron_deposit_address);

                for (const tx of transactions) {
                    // (無论是否处理，都先更新 latestTimestamp 以避免重复查询)
                    if (!latestTimestamp || tx.block_timestamp > latestTimestamp) {
                        latestTimestamp = tx.block_timestamp;
                    }

                    if (!tx.ret || !tx.ret[0] || tx.ret[0].contractRet !== 'SUCCESS') {
                        filteredCount++;
                        continue;
                    }

                    const contract = tx.raw_data && tx.raw_data.contract ? tx.raw_data.contract[0] : null;
                    if (!contract || contract.type !== 'TransferContract') {
                        filteredCount++;
                        continue;
                    }

                    const paramValue = contract.parameter && contract.parameter.value ? contract.parameter.value : null;
                    if (!paramValue || !paramValue.amount || !paramValue.to_address) {
                        filteredCount++;
                        continue;
                    }

                    const toHex = this._safeHexToHex(paramValue.to_address);
                    if (toHex !== depositHex) {
                        filteredCount++;
                        continue;
                    }

                    // (处理交易，检查是否成功处理)
                    const wasProcessed = await this._processTrxDeposit({
                        txID: tx.txID || tx.transaction_id,
                        from: this._safeHexToBase58(paramValue.owner_address),
                        to: this._safeHexToBase58(paramValue.to_address),
                        amountSun: paramValue.amount,
                        block_timestamp: tx.block_timestamp
                    }, user);

                    if (wasProcessed) {
                        processedCount++;
                    } else {
                        skippedCount++;
                    }
                }

                // (只在有新交易时输出日志)
                if (transactions.length > 0) {
                    if (processedCount > 0 || skippedCount > 0) {
                        console.log(`[v7-Poll] 🔷 TRX poll for ${user.user_id}: ${processedCount} processed, ${skippedCount} skipped, ${filteredCount} filtered`);
                    }
                }

                // (确保返回 latestTimestamp，即使所有交易都被跳过或过滤)
                return latestTimestamp;
            } catch (error) {
                // (如果是 DNS 错误或超时，尝試重試)
                const isRetryable = error.code === 'EAI_AGAIN' || 
                                    error.code === 'ECONNABORTED' || 
                                    error.code === 'ETIMEDOUT' ||
                                    error.message.includes('timeout');
                
                if (isRetryable && attempt < retries) {
                    console.warn(`[v7-Poll] TRX poll failed (attempt ${attempt}/${retries}) for ${user.user_id}, retrying... Error:`, error.message);
                    await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
                    continue;
                }
                
                // (最後一次尝試失败或非重試错误)
                logPollError(error, `Failed to poll TRX txs for ${user.user_id} (attempt ${attempt}/${retries})`);
                return null;
            }
        }
        return null;
    }


    /**
     * 处理入帐逻辑 (★★★ v8.49 修正：使用 this.tronWeb 進行地址比较 ★★★)
     * @returns {boolean} 返回 true 表示成功处理，false 表示跳过（重复或無效）
     */
    async _processDeposit(event) {
        const txID = event.transaction_id;
        const fromAddress = event.result.from; 
        const toAddress = event.result.to;
        
        const amountValue = event.result.value; 

        // 1. 检查 TX 是否已处理
        try {
            const existingTx = await db.query('SELECT 1 FROM platform_transactions WHERE tx_hash = $1', [txID]);
            if (existingTx.rows.length > 0) {
                // (重复交易，静默跳过)
                return false;
            }
        } catch (checkError) {
            console.error(`[v7-Poll] DB Error checking tx ${txID}:`, checkError);
            return false;
        }

        // 2. 查找用户地址
        let user;
        try {
            // (★★★ v8.49 修正：使用 tronWeb 實例将地址转为 HEX 進行比较，防止大小寫问题 ★★★)
            const toAddressHex = this.tronWeb.address.toHex(toAddress);
            const userResult = await db.query(
                'SELECT id, user_id, balance, tron_deposit_address FROM users WHERE tron_deposit_address IS NOT NULL'
            );
            
            user = userResult.rows.find(row => 
                this.tronWeb.address.toHex(row.tron_deposit_address) === toAddressHex
            );

            if (!user) {
                // (非用户地址，静默跳过)
                return false;
            }
        } catch (findError) {
            console.error(`[v7-Poll] DB Error finding user for address ${toAddress}:`, findError);
            return false;
        }

        // 3. 转换金额
        const amountBigInt = BigInt(amountValue); 
        const amount = Number(amountBigInt) / (10**USDT_DECIMALS);

        if (amount <= 0) {
            // (零金额，静默跳过)
            return false;
        }

        console.log(`[v7-Poll] 💰 Processing USDT deposit: User ${user.user_id} | ${amount} USDT | TX: ${txID}`);

        // 4. 资料库事务
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            
            // 4a. 更新余额
            const newBalance = parseFloat(user.balance) + amount;
            const updateUserResult = await client.query(
                'UPDATE users SET balance = $1 WHERE id = $2 RETURNING *', 
                [newBalance, user.id]
            );
            const updatedUser = updateUserResult.rows[0];
            delete updatedUser.password_hash; 

            // 4b. 寫入流水
            await client.query(
                `INSERT INTO platform_transactions (user_id, type, chain, amount, tx_hash, status, created_at, updated_at) 
                 VALUES ($1, 'deposit', 'TRC20', $2, $3, 'completed', NOW(), NOW())`,
                [user.user_id, amount, txID]
            );

            // 4c. 记录账变
            try {
                await logBalanceChange({
                    user_id: user.user_id,
                    change_type: CHANGE_TYPES.DEPOSIT,
                    amount: amount,
                    balance_after: newBalance,
                    remark: `充值 ${amount} USDT, TX Hash: ${txID}`,
                    client: client
                });
            } catch (error) {
                console.error('[TronListener] Failed to log balance change:', error);
                // 不阻止主流程，只记录错误
            }

            await client.query('COMMIT');
            
            console.log(`[v7-Poll] ✅ User ${user.user_id} credited: +${amount} USDT | Balance: ${newBalance} USDT`);

            // 5. Socket.IO 通知
            const userSocketId = this.connectedUsers[user.user_id];
            if (userSocketId) {
                this.io.to(userSocketId).emit('user_info_updated', updatedUser);
            }

            return true; // (返回 true 表示成功处理)
        } catch (txError) {
            await client.query('ROLLBACK');
            console.error(`[v7-Poll] ❌ Transaction failed for tx ${txID} (User: ${user.user_id}):`, txError.message);
            return false;
        } finally {
            client.release();
        }
    }

    async _processTrxDeposit(event, user) {
        const txID = event.txID;
        if (!txID) {
            return false; // (返回 false 表示未处理)
        }

        try {
            const existingTx = await db.query('SELECT 1 FROM platform_transactions WHERE tx_hash = $1', [txID]);
            if (existingTx.rows.length > 0) {
                // (重复交易，静默跳过，不输出日志以減少噪音)
                return false; // (返回 false 表示已存在，但已处理)
            }
        } catch (checkError) {
            console.error(`[v7-Poll] DB Error checking TRX tx ${txID}:`, checkError);
            return false;
        }

        const amountSun = BigInt(event.amountSun);
        const amount = Number(amountSun) / (10 ** TRX_DECIMALS);
        if (amount <= 0) {
            // (零金额交易，静默跳过)
            return false;
        }

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(
                `INSERT INTO platform_transactions (user_id, type, chain, amount, tx_hash, status, created_at, updated_at) 
                 VALUES ($1, 'deposit_trx', 'TRX', $2, $3, 'completed', NOW(), NOW())`,
                [user.user_id, amount, txID]
            );
            await client.query('COMMIT');
            console.log(`[v7-Poll] ✅ Recorded TRX activation: User ${user.user_id} | ${amount} TRX | TX: ${txID}`);
            return true; // (返回 true 表示成功处理)
        } catch (txError) {
            await client.query('ROLLBACK');
            console.error(`[v7-Poll] ❌ Failed to record TRX tx ${txID} (User: ${user.user_id}):`, txError.message);
            return false;
        } finally {
            client.release();
        }
    }

    _safeHexToBase58(address) {
        if (!address) {
            return null;
        }
        try {
            return this.tronWeb.address.fromHex(address);
        } catch (error) {
            return address;
        }
    }

    _safeHexToHex(address) {
        if (!address) {
            return null;
        }
        try {
            if (address.startsWith('41') && address.length === 42) {
                return address;
            }
            const base58 = this._safeHexToBase58(address);
            return base58 ? this.tronWeb.address.toHex(base58) : null;
        } catch (error) {
            return null;
        }
    }
}

module.exports = TronListener;