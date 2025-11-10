// 檔案: backend/services/TronListener.js (★★★ v8.11 延遲監聽修正版 ★★★)

const TronWeb = require('tronweb');
const db = require('../db');

const USDT_CONTRACT_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; 
const USDT_DECIMALS = 6; 
const MAX_RETRIES = 5; // (★★★ v8.11 修正：增加到 5 次 ★★★)
const RETRY_DELAY = 15000; // (★★★ v8.11 修正：延長到 15 秒 ★★★)

class TronListener {
    constructor(io, connectedUsers) {
        this.io = io;
        this.connectedUsers = connectedUsers;
        
        // (★★★ v8.12 修正：加回 API Key ★★★)
        this.tronWeb = new TronWeb({
            fullHost: 'https://nile.trongrid.io',
            headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' }
        });

        console.log("✅ [v7] TronListener.js (NILE TESTNET) initialized (API Key Used).");
        if (!process.env.TRONGRID_API_KEY) {
            console.warn("   [!] TRONGRID_API_KEY not set in .env, using public node. Event monitoring might be unstable.");
        }
    }

    /**
     * (★★★ v8.11 修正：使用新的延遲參數 ★★★)
     * 啟動監聽器
     */
    async start(retryCount = 0) {
        console.log(`[v7 TronListener] Starting to monitor TRC20 USDT transfers to contract: ${USDT_CONTRACT_ADDRESS} (Nile)`);
        try {
            console.log(`[v7 TronListener] Attempting to load contract at: ${USDT_CONTRACT_ADDRESS}`);
            const contract = await this.tronWeb.contract().at(USDT_CONTRACT_ADDRESS);
            console.log(`[v7 TronListener] Contract loaded. Setting up 'Transfer' event watcher...`);

            contract.Transfer().watch((err, event) => {
                if (err) {
                    return console.error('[v7 TronListener] ERROR during watch:', err);
                }
                
                console.log('[v7 TronListener] Received raw event:', JSON.stringify(event, null, 2));

                if (event && event.result && event.transaction_id) {
                    this._processDeposit(event);
                }
            });
            
            console.log('[v7 TronListener] Watcher started successfully.');

        } catch (error) {
            console.error(`[v7 TronListener] CRITICAL: Failed to initialize contract watcher (Attempt ${retryCount + 1}/${MAX_RETRIES}):`, error.message || error);
            
            if (retryCount < MAX_RETRIES - 1) {
                console.log(`[v7 TronListener] Retrying in ${RETRY_DELAY / 1000} seconds...`);
                setTimeout(() => this.start(retryCount + 1), RETRY_DELAY);
            } else {
                console.error(`[v7 TronListener] CRITICAL: All retry attempts failed. TronListener will NOT run.`);
            }
        }
    }

    /**
     * 處理入帳邏輯
     * (★★★ 保持 v8.4 的邏輯不變 ★★★)
     */
    async _processDeposit(event) {
        const txID = event.transaction_id;
        const fromAddress = this.tronWeb.address.fromHex(event.result.from);
        const toAddress = this.tronWeb.address.fromHex(event.result.to);
        
        const amountValue = event.result.value; // (這是 10 進制字符串, e.g., "10000000")
        console.log(`[v7 TronListener] Processing Event: TXID: ${txID}, To: ${toAddress}, From: ${fromAddress}, Raw Value: ${amountValue}`);

        // 1. 檢查 TX 是否已處理
        try {
            const existingTx = await db.query('SELECT 1 FROM platform_transactions WHERE tx_hash = $1', [txID]);
            if (existingTx.rows.length > 0) {
                 console.log(`[v7 TronListener] Skipping duplicate tx: ${txID}`);
                return;
            }
        } catch (checkError) {
            console.error(`[v7 TronListener] DB Error checking tx ${txID}:`, checkError);
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
                 console.log(`[v7 TronListener] Ignore: Address ${toAddress} is not a tracked user deposit address.`);
                return; 
            }
            user = userResult.rows[0];
            console.log(`[v7 TronListener] Match: Address ${toAddress} belongs to User ${user.user_id}`);
        } catch (findError) {
             console.error(`[v7 TronListener] DB Error finding user for address ${toAddress}:`, findError);
            return;
        }

        // 3. 轉換金額 (v8.4 修正版)
        const amountBigInt = BigInt(amountValue); 
        const amount = Number(amountBigInt) / (10**USDT_DECIMALS);
        
        console.log(`[v7 TronListener] Parsed Value: BigInt=${amountBigInt.toString()}, FinalAmount=${amount} USDT`); 

        if (amount <= 0) {
            console.warn(`[v7 TronListener] Ignoring zero or invalid amount tx: ${txID}`);
            return;
        }

        console.log(`[v7 TronListener] Processing Deposit: User ${user.user_id} | Amount: ${amount} USDT | TX: ${txID}`);

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
            
            console.log(`[v7 TronListener] SUCCESS: User ${user.user_id} credited with ${amount} USDT. New balance: ${newBalance}`);

            // 5. Socket.IO 通知
            const userSocketId = this.connectedUsers[user.user_id];
            if (userSocketId) {
                this.io.to(userSocketId).emit('user_info_updated', updatedUser);
                console.log(`[v7 TronListener] Sent real-time balance update to ${user.user_id}`);
            }

        } catch (txError) {
            await client.query('ROLLBACK');
            console.error(`[v7 TronListener] CRITICAL: Transaction failed for tx ${txID} (User: ${user.user_id}). ROLLBACK executed.`, txError);
        } finally {
            client.release();
        }
    }
}

module.exports = TronListener;