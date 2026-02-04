// 档案: backend/services/CollectionRetryJob.js
// 功能: 處理歸集重試隊列

const db = require('@flipcoin/database');
const { getTronCollectionInstance } = require('./TronCollectionService');
const { getAlertInstance } = require('./AlertService');

// 最大重試次數
const MAX_RETRY_COUNT = 5;

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

class CollectionRetryJob {
    constructor() {
        this.collectionService = getTronCollectionInstance();
        this.alertService = getAlertInstance();
        this.isProcessing = false;
        this.intervalId = null;
        this.RETRY_INTERVAL_MS = 30 * 60 * 1000; // 每 30 分鐘執行一次
    }

    /**
     * @description 啟動重試任務
     */
    start() {
        console.log(`[CollectionRetry] Starting retry job (Interval: ${this.RETRY_INTERVAL_MS / 1000 / 60} minutes)`);
        
        // 立即執行第一次
        this.processRetryQueue().catch(err => {
            console.error('[CollectionRetry] Initial run failed:', err);
        });
        
        // 設定定時器
        this.intervalId = setInterval(() => {
            this.processRetryQueue().catch(err => {
                console.error('[CollectionRetry] Scheduled run failed:', err);
            });
        }, this.RETRY_INTERVAL_MS);
    }

    /**
     * @description 停止重試任務
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[CollectionRetry] Retry job stopped');
        }
    }

    /**
     * @description 處理重試隊列
     */
    async processRetryQueue() {
        if (this.isProcessing) {
            console.log('[CollectionRetry] Previous run still in progress, skipping...');
            return;
        }

        this.isProcessing = true;

        try {
            // 獲取需要重試的任務（next_retry_at <= NOW 且 retry_count < MAX）
            const pendingItems = await db.query(
                `SELECT * FROM collection_retry_queue 
                 WHERE next_retry_at <= NOW() 
                   AND retry_count < $1
                 ORDER BY next_retry_at ASC
                 LIMIT 20`,
                [MAX_RETRY_COUNT]
            );

            if (pendingItems.rows.length === 0) {
                console.log('[CollectionRetry] No pending items to retry');
                this.isProcessing = false;
                return;
            }

            console.log(`[CollectionRetry] Processing ${pendingItems.rows.length} pending items...`);

            let successCount = 0;
            let failureCount = 0;
            let deadCount = 0;

            for (const item of pendingItems.rows) {
                try {
                    // 獲取用戶信息
                    const userResult = await db.query(
                        `SELECT id, user_id, deposit_path_index, tron_deposit_address 
                         FROM users 
                         WHERE user_id = $1 AND tron_deposit_address IS NOT NULL`,
                        [item.user_id]
                    );

                    if (userResult.rows.length === 0) {
                        // 用戶不存在，標記為完成（刪除）
                        await db.query(
                            `DELETE FROM collection_retry_queue WHERE id = $1`,
                            [item.id]
                        );
                        console.log(`[CollectionRetry] User ${item.user_id} not found, removed from queue`);
                        continue;
                    }

                    const user = userResult.rows[0];

                    // 檢查是否應該歸集
                    const shouldCollectResult = await this.collectionService._shouldCollect(user);
                    if (!shouldCollectResult.shouldCollect) {
                        // 不符合歸集條件，移除隊列
                        await db.query(
                            `DELETE FROM collection_retry_queue WHERE id = $1`,
                            [item.id]
                        );
                        console.log(`[CollectionRetry] User ${item.user_id} no longer needs collection, removed: ${shouldCollectResult.reason}`);
                        continue;
                    }

                    // 執行歸集邏輯（重用 CollectionService 的邏輯）
                    const balanceStr = await this.collectionService._getUsdtBalance(user.tron_deposit_address);
                    const balance = BigInt(balanceStr);
                    
                    if (balance <= 0) {
                        // 沒有餘額，移除隊列
                        await db.query(
                            `DELETE FROM collection_retry_queue WHERE id = $1`,
                            [item.id]
                        );
                        console.log(`[CollectionRetry] User ${item.user_id} has no balance, removed from queue`);
                        continue;
                    }

                    // 檢查並執行 approve（如果需要）
                    const allowanceStr = await this.collectionService._checkAllowance(user.tron_deposit_address);
                    const allowance = BigInt(allowanceStr);
                    
                    if (allowance < balance) {
                        try {
                            const kmsService = this.collectionService.kmsService;
                            const userPrivateKey = kmsService.getPrivateKey('TRC20', user.deposit_path_index);
                            await this.collectionService._approveCollection(userPrivateKey, user.tron_deposit_address);
                            await new Promise(resolve => setTimeout(resolve, 5000)); // 等待確認
                        } catch (approveError) {
                            throw new Error(`Approve failed: ${approveError.message}`);
                        }
                    }

                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CollectionRetryJob.js:processRetryQueue',message:'Before retry transferFrom',data:{userId:user.user_id,userAddress:user.tron_deposit_address,collectionWallet:this.collectionService.collectionWallet.address,balance:balanceStr},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'E'})}).catch(()=>{});
                    // #endregion
                    
                    // 執行 transferFrom
                    const transferResult = await this.collectionService._transferFrom(user.tron_deposit_address, balanceStr);
                    
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CollectionRetryJob.js:processRetryQueue',message:'After retry transferFrom',data:{userId:user.user_id,txHash:transferResult.txHash,energyUsed:transferResult.energyUsed},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'E'})}).catch(()=>{});
                    // #endregion
                    
                    // 記錄成功日誌
                    const balanceUSDT = Number(balance) / (10**6);
                    await db.query(
                        `INSERT INTO collection_logs 
                         (user_id, user_deposit_address, collection_wallet_address, amount, tx_hash, energy_used, status) 
                         VALUES ($1, $2, $3, $4, $5, $6, 'completed')`,
                        [
                            user.user_id,
                            user.tron_deposit_address,
                            this.collectionService.collectionWallet.address,
                            balanceUSDT,
                            transferResult.txHash,
                            transferResult.energyUsed
                        ]
                    );

                    // 從隊列中移除
                    await db.query(
                        `DELETE FROM collection_retry_queue WHERE id = $1`,
                        [item.id]
                    );

                    console.log(`[CollectionRetry] ✅ Successfully collected from user ${item.user_id}. TX: ${transferResult.txHash}`);
                    successCount++;

                } catch (error) {
                    const errorMsg = safeErrorMessage(error);
                    console.error(`[CollectionRetry] ❌ Failed to retry collection for user ${item.user_id}:`, errorMsg);

                    const newRetryCount = item.retry_count + 1;
                    
                    if (newRetryCount >= MAX_RETRY_COUNT) {
                        // 超過最大重試次數，標記為死亡
                        await db.query(
                            `UPDATE collection_retry_queue 
                             SET retry_count = $1, 
                                 error_reason = $2,
                                 updated_at = NOW()
                             WHERE id = $3`,
                            [newRetryCount, `Max retries exceeded: ${safeErrorMessage(error, 400)}`, item.id]
                        );
                        
                        // 發送關鍵警報
                        await this.alertService.sendCritical(
                            `歸集重試失敗（已達最大次數）！\n\n` +
                            `用戶 ID: ${item.user_id}\n` +
                            `重試次數: ${newRetryCount}/${MAX_RETRY_COUNT}\n` +
                            `錯誤: ${errorMsg}\n\n` +
                            `請手動處理此用戶的歸集！`
                        );
                        
                        deadCount++;
                    } else {
                        // 更新重試次數和下次重試時間（指數退避）
                        const nextRetryDelay = Math.pow(2, newRetryCount); // 1h, 2h, 4h, 8h...
                        await db.query(
                            `UPDATE collection_retry_queue 
                             SET retry_count = $1, 
                                 next_retry_at = NOW() + INTERVAL '1 hour' * $2,
                                 error_reason = $3,
                                 updated_at = NOW()
                             WHERE id = $4`,
                            [newRetryCount, nextRetryDelay, safeErrorMessage(error, 500), item.id]
                        );
                        failureCount++;
                    }
                }

                // 避免過於頻繁
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            console.log(`[CollectionRetry] ✅ Retry job completed: ${successCount} success, ${failureCount} failed, ${deadCount} dead`);

        } catch (error) {
            console.error('[CollectionRetry] Error processing retry queue:', error);
        } finally {
            this.isProcessing = false;
        }
    }
}

// (單例模式)
let instance = null;
function getCollectionRetryJobInstance() {
    if (!instance) {
        instance = new CollectionRetryJob();
    }
    return instance;
}

module.exports = {
    getCollectionRetryJobInstance
};

