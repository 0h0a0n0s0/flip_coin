// 檔案: backend/services/TronListener.js (★★★ v8.24 重寫版 - 放棄 Events API ★★★)

const TronWeb = require('tronweb');
const db = require('../db');
const util = require('util');

const USDT_CONTRACT_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; 
const USDT_DECIMALS = 6; 
const POLLING_INTERVAL_MS = 10000; // (★★★ 修正：延長到 10 秒，因為 API 負擔較重 ★★★)

// (日誌輔助函數)
function logPollError(error, context) {
    console.error(`[v7-Poll] ${context}. Details:`);
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


class TronListener {
    constructor(io, connectedUsers) {
        this.io = io;
        this.connectedUsers = connectedUsers;
        
        // (★★★ v8.35 修正：簡化 constructor ★★★)
        this.tronWeb = new TronWeb({
            fullHost: 'https://nile.trongrid.io',
            privateKey: '01', // (建議: 雖然輪詢用不到，但保持一致性)
            timeout: 60000 
        });

        // (★★★ v8.35 新增：手動強制設定所有節點 ★★★)
        this.tronWeb.setFullNode('https://nile.trongrid.io');
        this.tronWeb.setSolidityNode('https://nile.trongrid.io');
        this.tronWeb.setEventServer('https://nile.trongrid.io');

        this.isPolling = false; 
        // (★★★ v8.24 修正：我們需要一個時間戳來查詢新交易 ★★★)
        // (注意：如果服務重啟，這可能導致少量重複查詢，但 _processDeposit 中的 DB 檢查會處理)
        this.lastPollTimestamp = Date.now() - (10 * 60 * 1000); // (預設查詢過去 10 分鐘)

        // (★★★ v8.24 修改日誌 ★★★)
        console.log("✅ [v7-Poll] TronListener.js (NILE TESTNET) initialized (v8.35 Force Set Nodes).");
    }

    async start() {
        console.log(`[v7-Poll] Starting Account Polling Service (Interval: ${POLLING_INTERVAL_MS}ms)`);
        
        // (立即執行第一次)
        this._pollAllUsers();
        
        // (設定定時器)
        setInterval(() => this._pollAllUsers(), POLLING_INTERVAL_MS);
    }

    /**
     * (★★★ v8.24 核心重寫：輪詢所有用戶 ★★★)
     */
    async _pollAllUsers() {
        if (this.isPolling) {
            // console.log("[v7-Poll] Poll skipped: Previous poll still running.");
            return;
        }
        this.isPolling = true;
        
        let usersToPoll = [];
        try {
            // 1. 從 DB 獲取所有用戶地址
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
            // console.log("[v7-Poll] No users with TRON address to poll.");
            this.isPolling = false;
            return;
        }

        // console.log(`[v7-Poll] Polling ${usersToPoll.length} user addresses...`);
        let newTimestamp = this.lastPollTimestamp;

        for (const user of usersToPoll) {
            try {
                // 2. 查詢 TRC20 交易歷史
                // (這是公共 API，應該可用)
                const response = await this.tronWeb.fullNode.request(
                    `v1/accounts/${user.tron_deposit_address}/transactions/trc20`, 
                    {
                        'only_to': true, // (只看轉入)
                        'min_timestamp': this.lastPollTimestamp, // (只看新交易)
                        'contract_address': USDT_CONTRACT_ADDRESS, // (只看 USDT)
                        'limit': 50 // (假設 10 秒內不會有超過 50 筆)
                    }, 
                    'get'
                );

                if (response && response.data && response.data.length > 0) {
                    console.log(`[v7-Poll] Found ${response.data.length} new tx(s) for ${user.user_id} (${user.tron_deposit_address})`);
                    
                    for (const tx of response.data) {
                        // (將 TRC20 API 格式轉換為 _processDeposit 期望的格式)
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
                        
                        if (tx.block_timestamp > newTimestamp) {
                            newTimestamp = tx.block_timestamp;
                        }
                    }
                }
                
            } catch (error) {
                // (如果 `v1/accounts` API 也失敗，日誌會顯示在這裡)
                logPollError(error, `Failed to poll TRC20 txs for ${user.user_id}`);
            }
        }
        
        // (更新時間戳，加 1ms 避免下次輪詢重複獲取最後一筆)
        this.lastPollTimestamp = newTimestamp + 1;
        this.isPolling = false;
    }


    /**
     * 處理入帳邏輯 (此函數保持 v8.19 版不變)
     */
    async _processDeposit(event) {
        const txID = event.transaction_id;
        // (★★★ v8.24 修正：v1 API 返回的是 Base58，不需要 fromHex ★★★)
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
            const userResult = await db.query(
                'SELECT id, user_id, balance FROM users WHERE tron_deposit_address = $1',
                [toAddress]
            );
            if (userResult.rows.length === 0) {
                 console.log(`[v7-Poll] Ignore: Address ${toAddress} is not a tracked user deposit address.`);
                return; 
            }
            user = userResult.rows[0];
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
}

module.exports = TronListener;