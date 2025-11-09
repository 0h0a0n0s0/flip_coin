// 檔案: backend/services/TronListener.js (★★★ v7-M2 新檔案 ★★★)

const TronWeb = require('tronweb');
const db = require('../db');

// (TRC20 USDT (Mainnet) 合約地址)
const USDT_CONTRACT_ADDRESS = 'TXLAQ63Xg1NAzckPwXvjWdZfL8kNGZZzV8';
// (USDT 的精度為 6)
const USDT_DECIMALS = 6; 

class TronListener {
    /**
     * @param {object} io - Socket.IO 實例
     * @param {object} connectedUsers - (user_id -> socket.id) 的 Map
     */
    constructor(io, connectedUsers) {
        this.io = io;
        this.connectedUsers = connectedUsers;
        
        // 1. 初始化 TronWeb (使用 .env 中的 API Key)
        // (我們應在 .env 中加入 TRONGRID_API_KEY)
        this.tronWeb = new TronWeb({
            fullHost: 'https://nile.trongrid.io',
            headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || 'YOUR_FALLBACK_API_KEY' }
        });

        console.log("✅ [v7] TronListener.js (NILE TESTNET) initialized.");
        if (!process.env.TRONGRID_API_KEY) {
            console.warn("   [!] TRONGRID_API_KEY not set in .env, using public node. Event monitoring might be unstable.");
        }
    }

    /**
     * 啟動監聽器
     */
    async start() {
        console.log(`[v7 TronListener] Starting to monitor TRC20 USDT transfers to contract: ${USDT_CONTRACT_ADDRESS}`);
        try {
            const contract = await this.tronWeb.contract().at(USDT_CONTRACT_ADDRESS);

            // 監聽 Transfer 事件
            contract.Transfer().watch((err, event) => {
                if (err) {
                    return console.error('[v7 TronListener] Error watching Transfer event:', err);
                }
                
                // console.log('[v7 TronListener] Received event:', JSON.stringify(event, null, 2));

                // 檢查事件是否是我們需要的格式
                if (event && event.result && event.transaction_id) {
                    this._processDeposit(event);
                }
            });

        } catch (error) {
            console.error('[v7 TronListener] CRITICAL: Failed to initialize contract watcher:', error);
            // (可以在這裡加入 10 秒後重試機制)
        }
    }

    /**
     * 處理入帳邏輯
     * @param {object} event - 來自 TronWeb 的事件對象
     */
    async _processDeposit(event) {
        const txID = event.transaction_id;
        const fromAddress = this.tronWeb.address.fromHex(event.result.from);
        const toAddress = this.tronWeb.address.fromHex(event.result.to);
        const amountHex = event.result.value;

        // 1. 檢查 TX 是否已處理 (Idempotency)
        try {
            const existingTx = await db.query('SELECT 1 FROM platform_transactions WHERE tx_hash = $1', [txID]);
            if (existingTx.rows.length > 0) {
                // console.log(`[v7 TronListener] Skipping duplicate tx: ${txID}`);
                return;
            }
        } catch (checkError) {
            console.error(`[v7 TronListener] DB Error checking tx ${txID}:`, checkError);
            return;
        }

        // 2. 查找該地址是否為我們的用戶充值地址
        let user;
        try {
            const userResult = await db.query(
                'SELECT id, user_id, balance FROM users WHERE tron_deposit_address = $1',
                [toAddress]
            );
            if (userResult.rows.length === 0) {
                // console.log(`[v7 TronListener] Received tx ${txID} to non-tracked address: ${toAddress}`);
                return; // 不是我們的用戶地址，忽略
            }
            user = userResult.rows[0];
        } catch (findError) {
             console.error(`[v7 TronListener] DB Error finding user for address ${toAddress}:`, findError);
            return;
        }

        // 3. 轉換金額
        const amount = parseFloat(this.tronWeb.fromSun(amountHex)) / (10**(18 - USDT_DECIMALS)); // fromSun 假定 18 位，我們轉回 6 位
        // (更穩定的方式是直接用 BigInt)
        // const amountBigInt = BigInt(amountHex);
        // const amount = Number(amountBigInt) / (10**USDT_DECIMALS);
        
        if (amount <= 0) {
            console.warn(`[v7 TronListener] Ignoring zero or invalid amount tx: ${txID}`);
            return;
        }

        console.log(`[v7 TronListener] Processing Deposit: User ${user.user_id} | Amount: ${amount} USDT | TX: ${txID}`);

        // 4. 使用資料庫事務 (Transaction) 進行上分
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            
            // 4a. 更新用戶餘額
            const newBalance = parseFloat(user.balance) + amount;
            const updateUserResult = await client.query(
                'UPDATE users SET balance = $1 WHERE id = $2 RETURNING *', 
                [newBalance, user.id]
            );
            const updatedUser = updateUserResult.rows[0];
            delete updatedUser.password_hash; // (安全起見)

            // 4b. 寫入資金流水
            await client.query(
                `INSERT INTO platform_transactions (user_id, type, chain, amount, tx_hash, status, created_at, updated_at) 
                 VALUES ($1, 'deposit', 'TRC20', $2, $3, 'completed', NOW(), NOW())`,
                [user.user_id, amount, txID]
            );

            await client.query('COMMIT');
            
            console.log(`[v7 TronListener] SUCCESS: User ${user.user_id} credited with ${amount} USDT. New balance: ${newBalance}`);

            // 5. (Socket.IO) 通知前台餘額已更新
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