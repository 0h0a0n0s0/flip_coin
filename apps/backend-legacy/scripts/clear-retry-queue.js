// 清理歸集重試隊列腳本
// 用法: cd apps/backend-legacy && node scripts/clear-retry-queue.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const db = require('@flipcoin/database');

async function clearRetryQueue() {
    console.log('==========================================');
    console.log('清理歸集重試隊列');
    console.log('==========================================\n');

    try {
        // 查詢當前重試隊列
        const queueResult = await db.query(
            `SELECT cq.*, u.username 
             FROM collection_retry_queue cq
             LEFT JOIN users u ON cq.user_id = u.user_id
             ORDER BY cq.retry_count DESC, cq.created_at ASC`
        );

        if (queueResult.rows.length === 0) {
            console.log('✅ 重試隊列為空，無需清理。\n');
            return;
        }

        console.log(`📋 當前重試隊列中有 ${queueResult.rows.length} 筆記錄：\n`);
        
        queueResult.rows.forEach((row, index) => {
            console.log(`${index + 1}. 用戶: ${row.username || row.user_id}`);
            console.log(`   重試次數: ${row.retry_count}`);
            console.log(`   錯誤原因: ${row.error_reason ? row.error_reason.substring(0, 100) : '無'}`);
            console.log(`   下次重試: ${row.next_retry_at}`);
            console.log('');
        });

        // 清理重試次數 >= 5 的記錄（這些已經失敗太多次了）
        console.log('🧹 清理重試次數 >= 5 的記錄...');
        const deleteResult = await db.query(
            `DELETE FROM collection_retry_queue 
             WHERE retry_count >= 5
             RETURNING user_id`
        );

        if (deleteResult.rows.length > 0) {
            console.log(`✅ 已清理 ${deleteResult.rows.length} 筆記錄：`);
            deleteResult.rows.forEach(row => {
                console.log(`   - 用戶 ID: ${row.user_id}`);
            });
        } else {
            console.log('✅ 沒有需要清理的記錄。');
        }

        console.log('\n建議操作：');
        console.log('1. 重啟服務以應用修復後的代碼');
        console.log('2. 或在後台管理界面手動觸發歸集任務');
        console.log('3. 觀察日誌，確認歸集是否成功\n');

    } catch (error) {
        console.error('清理過程中發生錯誤:', error);
    } finally {
        await db.pool.end();
    }
}

clearRetryQueue();
