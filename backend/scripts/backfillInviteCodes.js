// 檔案: backend/scripts/backfillInviteCodes.js (新檔案)

// 1. 載入環境變數
// (我們需要指定 .env 檔案的路徑，因為腳本是在 /scripts/ 目錄下執行的)
require('dotenv').config({ path: __dirname + '/../.env' });

const db = require('../db');
const { customAlphabet } = require('nanoid');

// 2. 確保使用與 server.js *完全相同* 的生成器
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);

/**
 * 從 server.js 複製過來的輔助函數
 * 用於生成一個在 'users' 表中保證唯一的邀請碼
 */
async function generateUniqueInviteCode() {
    let inviteCode;
    let isUnique = false;
    do {
        inviteCode = nanoid(); // 生成 8 碼
        const existing = await db.query('SELECT 1 FROM users WHERE invite_code = $1', [inviteCode]);
        if (existing.rows.length === 0) {
            isUnique = true;
        } else {
            console.log(`(碰撞: ${inviteCode} 已存在，重新生成...)`);
        }
    } while (!isUnique);
    return inviteCode;
}

/**
 * 主執行函數
 */
async function backfill() {
    console.log('--- 開始回填缺失的邀請碼 ---');
    
    try {
        // 1. 查找所有邀請碼為 NULL 的用戶
        const result = await db.query('SELECT id, user_id, wallet_address FROM users WHERE invite_code IS NULL');
        const usersToUpdate = result.rows;

        if (usersToUpdate.length === 0) {
            console.log('所有用戶都已有邀請碼，無需操作。');
            return;
        }

        console.log(`找到 ${usersToUpdate.length} 位用戶需要邀請碼...`);

        // 2. 迴圈為每位用戶生成並更新邀請碼
        for (const user of usersToUpdate) {
            try {
                const newCode = await generateUniqueInviteCode();
                await db.query('UPDATE users SET invite_code = $1 WHERE id = $2', [newCode, user.id]);
                console.log(`[成功] 用戶 ${user.user_id} (${user.wallet_address.slice(0, 6)}...) 已更新邀請碼: ${newCode}`);
            } catch (updateError) {
                console.error(`[失敗] 更新用戶 ${user.user_id} (ID: ${user.id}) 時出錯:`, updateError.message);
            }
        }

        console.log('--- 回填操作完成 ---');

    } catch (error) {
        console.error('執行回填時發生嚴重錯誤:', error);
    } finally {
        // (重要) 結束腳本，否則 Docker exec 不會退出
        process.exit(0);
    }
}

// 執行
backfill();