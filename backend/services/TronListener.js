// 檔案: backend/services/TronListener.js (★★★ v8.49 最終修正版 ★★★)

const TronWeb = require('tronweb');
const db = require('../db');
const util = require('util');
const axios = require('axios'); // (★★★ v8.48 新增 ★★★)

// (★★★ v8.49 修正：從 .env 讀取 Listener 節點 ★★★)
const NILE_LISTENER_HOST = process.env.NILE_LISTENER_HOST;
if (!NILE_LISTENER_HOST) {
    throw new Error("CRITICAL: NILE_LISTENER_HOST is not set in .env file! (e.g., https://go.getblock.io/YOUR_API_KEY/)");
}
// (★★★ v8.49 修正：從 .env 讀取主節點 (僅用於地址轉換) ★★★)
const NILE_NODE_HOST = process.env.NILE_NODE_HOST;
if (!NILE_NODE_HOST) {
    throw new Error("CRITICAL: NILE_NODE_HOST is not set in .env file!");
}

// (★★★ v8.49 核心修正：使用 Nile 測試網的 USDT 合約地址 ★★★)
const DEFAULT_USDT_CONTRACT = 'TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs';
const USDT_CONTRACT_ADDRESS = process.env.USDT_CONTRACT_ADDRESS || DEFAULT_USDT_CONTRACT; 
const USDT_DECIMALS = 6; 
const TRX_DECIMALS = 6;
const POLLING_INTERVAL_MS = 10000; 
const TRONGRID_API_KEY = process.env.TRONGRID_API_KEY || process.env.TRON_PRO_API_KEY || null;

// (日誌輔助函數)
function logPollError(error, context) {
    console.error(`[v7-Poll] ${context}. Details:`);
    try {
        if (error && error.message) {
            // (★★★ v8.48 修正：如果是 axios 錯誤，顯示 config ★★★)
            if (error.config) {
                 console.error(`[Axios Error] URL: ${error.config.url}`);
                 console.error(`[Axios Error] Params: ${JSON.stringify(error.config.params)}`);
            }
            // (★★★ v8.48 修正：顯示 response data (如果節點有返回錯誤訊息) ★★★)
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
        
        // (★★★ v8.49 修正：僅用於地址轉換 ★★★)
        // (我們仍然需要 tronWeb 實例來進行 HEX 地址轉換)
        this.tronWeb = new TronWeb({
            fullHost: NILE_NODE_HOST, // (使用主節點)
            solidityHost: NILE_NODE_HOST,
            privateKey: '01'
        });

        this.isPolling = false; 
        this.lastTrc20PollTimestamp = Date.now() - (10 * 60 * 1000); // (預設查詢過去 10 分鐘)
        this.lastTrxPollTimestamp = Date.now() - (10 * 60 * 1000);
        
        // (★★★ v8.49 修正：建立 axios 實例，指向 Listener 節點 ★★★)
        this.axiosInstance = axios.create({
            baseURL: NILE_LISTENER_HOST,
            timeout: 10000,
            headers: TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': TRONGRID_API_KEY } : {}
            // (GetBlock 節點不需要 API Key 在 Header 中，因為它在 URL 裡)
        });

        if (NILE_LISTENER_HOST.includes('getblock.io')) {
            console.warn(`[v7-Poll] WARNING: Detected GetBlock endpoint for NILE_LISTENER_HOST. TronGrid v1 routes (/v1/...) may return 404 on GetBlock. Prefer https://nile.trongrid.io or another TronGrid-compatible host for listener polling.`);
        }

        // (★★★ v8.49 修改日誌 ★★★)
        console.log(`✅ [v7-Poll] TronListener.js (NILE TESTNET) initialized (v8.49 Manual Axios Logic / GetBlock Node).`);
    }

    async start() {
        console.log(`[v7-Poll] Starting Account Polling Service (Interval: ${POLLING_INTERVAL_MS}ms)`);
        
        // (立即執行第一次)
        this._pollAllUsers();
        
        // (設定定時器)
        setInterval(() => this._pollAllUsers(), POLLING_INTERVAL_MS);
    }

    /**
     * (★★★ v8.49 核心：使用 Axios 手動輪詢 v1 API ★★★)
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
            if (latestUsdtTs && latestUsdtTs > newTrc20Timestamp) {
                newTrc20Timestamp = latestUsdtTs;
            }

            const latestTrxTs = await this._pollTrxTransactionsForUser(user);
            if (latestTrxTs && latestTrxTs > newTrxTimestamp) {
                newTrxTimestamp = latestTrxTs;
            }
        }
        
        // (更新時間戳，加 1ms 避免下次輪詢重複獲取最後一筆)
        this.lastTrc20PollTimestamp = newTrc20Timestamp + 1;
        this.lastTrxPollTimestamp = newTrxTimestamp + 1;
        this.isPolling = false;
    }

    async _pollUsdtTransactionsForUser(user) {
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

            const transactions = response.data && response.data.data ? response.data.data : [];
            if (transactions.length === 0) {
                return null;
            }

            let latestTimestamp = null;
            console.log(`[v7-Poll] Found ${transactions.length} USDT tx(s) for ${user.user_id} (${user.tron_deposit_address})`);

            for (const tx of transactions) {
                const eventData = {
                    transaction_id: tx.transaction_id,
                    result: {
                        from: tx.from,
                        to: tx.to,
                        value: tx.value
                    },
                    block_timestamp: tx.block_timestamp
                };

                await this._processDeposit(eventData);

                if (!latestTimestamp || tx.block_timestamp > latestTimestamp) {
                    latestTimestamp = tx.block_timestamp;
                }
            }

            return latestTimestamp;
        } catch (error) {
            logPollError(error, `Failed to poll USDT txs for ${user.user_id}`);
            return null;
        }
    }

    async _pollTrxTransactionsForUser(user) {
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

            const transactions = response.data && response.data.data ? response.data.data : [];
            if (transactions.length === 0) {
                return null;
            }

            let latestTimestamp = null;
            const depositHex = this.tronWeb.address.toHex(user.tron_deposit_address);

            for (const tx of transactions) {
                if (!tx.ret || !tx.ret[0] || tx.ret[0].contractRet !== 'SUCCESS') {
                    continue;
                }

                const contract = tx.raw_data && tx.raw_data.contract ? tx.raw_data.contract[0] : null;
                if (!contract || contract.type !== 'TransferContract') {
                    continue;
                }

                const paramValue = contract.parameter && contract.parameter.value ? contract.parameter.value : null;
                if (!paramValue || !paramValue.amount || !paramValue.to_address) {
                    continue;
                }

                const toHex = this._safeHexToHex(paramValue.to_address);
                if (toHex !== depositHex) {
                    continue;
                }

                await this._processTrxDeposit({
                    txID: tx.txID || tx.transaction_id,
                    from: this._safeHexToBase58(paramValue.owner_address),
                    to: this._safeHexToBase58(paramValue.to_address),
                    amountSun: paramValue.amount,
                    block_timestamp: tx.block_timestamp
                }, user);

                if (!latestTimestamp || tx.block_timestamp > latestTimestamp) {
                    latestTimestamp = tx.block_timestamp;
                }
            }

            return latestTimestamp;
        } catch (error) {
            logPollError(error, `Failed to poll TRX txs for ${user.user_id}`);
            return null;
        }
    }


    /**
     * 處理入帳邏輯 (★★★ v8.49 修正：使用 this.tronWeb 進行地址比較 ★★★)
     */
    async _processDeposit(event) {
        const txID = event.transaction_id;
        const fromAddress = event.result.from; 
        const toAddress = event.result.to;
        
        const amountValue = event.result.value; 
        console.log(`[v7-Poll] Processing Event: TXID: ${txID}, To: ${toAddress}, From: ${fromAddress}, Raw Value: ${amountValue}`);

        // 1. 檢查 TX 是否已處理
        try {
            const existingTx = await db.query('SELECT 1 FROM platform_transactions WHERE tx_hash = $1', [txID]);
            if (existingTx.rows.length > 0) {
                 console.log(`[v7-Poll] Skipping duplicate tx: ${txID}`);
                return;
            }
        } catch (checkError) {
            console.error(`[v7-Poll] DB Error checking tx ${txID}:`, checkError);
            return;
        }

        // 2. 查找用戶地址
        let user;
        try {
            // (★★★ v8.49 修正：使用 tronWeb 實例將地址轉為 HEX 進行比較，防止大小寫問題 ★★★)
            const toAddressHex = this.tronWeb.address.toHex(toAddress);
            const userResult = await db.query(
                'SELECT id, user_id, balance, tron_deposit_address FROM users WHERE tron_deposit_address IS NOT NULL'
            );
            
            user = userResult.rows.find(row => 
                this.tronWeb.address.toHex(row.tron_deposit_address) === toAddressHex
            );

            if (!user) {
                 console.log(`[v7-Poll] Ignore: Address ${toAddress} (${toAddressHex}) is not a tracked user deposit address.`);
                return; 
            }
            console.log(`[v7-Poll] Match: Address ${toAddress} belongs to User ${user.user_id}`);
        } catch (findError) {
             console.error(`[v7-Poll] DB Error finding user for address ${toAddress}:`, findError);
            return;
        }

        // 3. 轉換金額
        const amountBigInt = BigInt(amountValue); 
        const amount = Number(amountBigInt) / (10**USDT_DECIMALS);
        
        console.log(`[v7-Poll] Parsed Value: BigInt=${amountBigInt.toString()}, FinalAmount=${amount} USDT`); 

        if (amount <= 0) {
            console.warn(`[v7-Poll] Ignoring zero or invalid amount tx: ${txID}`);
            return;
        }

        console.log(`[v7-Poll] Processing Deposit: User ${user.user_id} | Amount: ${amount} USDT | TX: ${txID}`);

        // 4. 資料庫事務
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            
            // 4a. 更新餘額
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

            await client.query('COMMIT');
            
            console.log(`[v7-Poll] SUCCESS: User ${user.user_id} credited with ${amount} USDT. New balance: ${newBalance}`);

            // 5. Socket.IO 通知
            const userSocketId = this.connectedUsers[user.user_id];
            if (userSocketId) {
                this.io.to(userSocketId).emit('user_info_updated', updatedUser);
                console.log(`[v7-Poll] Sent real-time balance update to ${user.user_id}`);
            }

        } catch (txError) {
            await client.query('ROLLBACK');
            console.error(`[v7-Poll] CRITICAL: Transaction failed for tx ${txID} (User: ${user.user_id}). ROLLBACK executed.`, txError);
        } finally {
            client.release();
        }
    }

    async _processTrxDeposit(event, user) {
        const txID = event.txID;
        if (!txID) {
            return;
        }

        try {
            const existingTx = await db.query('SELECT 1 FROM platform_transactions WHERE tx_hash = $1', [txID]);
            if (existingTx.rows.length > 0) {
                console.log(`[v7-Poll] Skipping duplicate TRX tx: ${txID}`);
                return;
            }
        } catch (checkError) {
            console.error(`[v7-Poll] DB Error checking TRX tx ${txID}:`, checkError);
            return;
        }

        const amountSun = BigInt(event.amountSun);
        const amount = Number(amountSun) / (10 ** TRX_DECIMALS);
        if (amount <= 0) {
            console.warn(`[v7-Poll] Ignoring zero TRX tx: ${txID}`);
            return;
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
            console.log(`[v7-Poll] Recorded TRX activation deposit: User ${user.user_id} | Amount: ${amount} TRX | TX: ${txID}`);
        } catch (txError) {
            await client.query('ROLLBACK');
            console.error(`[v7-Poll] CRITICAL: Failed to record TRX activation tx ${txID} (User: ${user.user_id}).`, txError);
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