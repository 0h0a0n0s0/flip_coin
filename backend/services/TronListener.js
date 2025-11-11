// 檔案: backend/services/TronListener.js (★★★ v8.13 輪詢修正版 ★★★)

const TronWeb = require('tronweb');
const db = require('../db');

const USDT_CONTRACT_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; 
const USDT_DECIMALS = 6; 
const POLLING_INTERVAL_MS = 5000; // 5 秒輪詢一次

class TronListener {
    constructor(io, connectedUsers) {
        this.io = io;
        this.connectedUsers = connectedUsers;
        
        this.tronWeb = new TronWeb({
            fullHost: 'https://nile.trongrid.io',
            headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' },
            timeout: 60000 // (設定 60 秒超時)
        });

        // (★★★ 核心修改：狀態變數 ★★★)
        // 我們只關心伺服器啟動後的新交易
        this.lastPollTimestamp = Date.now(); 
        this.isPolling = false; // (防止重疊執行)

        console.log("✅ [v7-Poll] TronListener.js (NILE TESTNET) initialized (Mode: HTTP Polling).");
        if (!process.env.TRONGRID_API_KEY) {
            console.warn("   [!] TRONGRID_API_KEY not set. Polling might fail.");
        }
    }

    /**
     * (★★★ 核心修改：從 watch() 改為 startPolling() ★★★)
     */
    async start() {
        console.log(`[v7-Poll] Starting to poll TRC20 USDT transfers to contract: ${USDT_CONTRACT_ADDRESS} (Nile)`);
        
        // 立即執行第一次
        this._pollEvents();
        
        // 設定定時器
        setInterval(() => this._pollEvents(), POLLING_INTERVAL_MS);
    }

    /**
     * (★★★ 核心修改：輪詢 API 的函數 ★★★)
     */
    async _pollEvents() {
        if (this.isPolling) {
            // console.log("[v7-Poll] Poll skipped: Previous poll still running.");
            return;
        }
        this.isPolling = true;

        try {
            // (我們使用 tronWeb 的內建 http 請求，這對應你啟用的 API 權限)
            // (注意：我們添加了 min_block_timestamp 參數來只獲取最新的交易)
            const response = await this.tronWeb.fullNode.request(
                `v1/contracts/${USDT_CONTRACT_ADDRESS}/events`, 
                {
                    'event_name': 'Transfer',
                    'only_confirmed': true,
                    'min_block_timestamp': this.lastPollTimestamp
                }, 
                'get'
            );

            if (response && response.data && response.data.length > 0) {
                console.log(`[v7-Poll] Found ${response.data.length} new 'Transfer' event(s).`);
                
                let maxTimestamp = this.lastPollTimestamp;

                for (const event of response.data) {
                    // (event 結構與 .watch() 返回的幾乎一致)
                    // event = { block_number, block_timestamp, transaction_id, result: { from, to, value }, ... }
                    
                    if (event && event.result && event.transaction_id) {
                        // (★★★ 重用你的 v8.4 存款邏輯 ★★★)
                        await this._processDeposit(event);
                    }
                    
                    if (event.block_timestamp > maxTimestamp) {
                        maxTimestamp = event.block_timestamp;
                    }
                }
                
                // (更新時間戳，加 1ms 避免下次輪詢重複獲取最後一筆)
                this.lastPollTimestamp = maxTimestamp + 1;
            }
            
        } catch (error) {
            // (這裡仍然可能報錯，例如 API Key 失效)
            console.error(`[v7-Poll] CRITICAL: Failed to poll events:`, error);
        } finally {
            this.isPolling = false;
        }
    }


    /**
     * 處理入帳邏輯 (此函數來自 v8.4，保持不變)
     */
    async _processDeposit(event) {
        const txID = event.transaction_id;
        const fromAddress = this.tronWeb.address.fromHex(event.result.from);
        const toAddress = this.tronWeb.address.fromHex(event.result.to);
        
        const amountValue = event.result.value; // (這是 10 進制字符串, e.g., "10000000")
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

        // 3. 轉換金額 (v8.4 修正版)
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