#!/usr/bin/env node
// scripts/migrate-pii-encryption.js
// 資料遷移腳本：加密現有的明文 PII 資料
// 
// 功能：
// 1. 加密 users 表中的 Email、IP、Device ID、User Agent
// 2. 加密 user_login_logs 表中的 IP 和 Device ID
// 3. 加密 admin_audit_logs 表中的 IP
// 
// 執行前提：
// 1. 已執行 add_encrypted_pii_fields.sql（新增加密欄位）
// 2. 已在 .env 配置 ENCRYPTION_KEY_PII
// 
// 執行方式：
// node apps/backend-legacy/scripts/migrate-pii-encryption.js

require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const db = require('@flipcoin/database');
const crypto = require('crypto');
const { encrypt, hashForIndex } = require('../utils/encryptionUtils');

// 配置
const BATCH_SIZE = 100; // 每批處理的記錄數
const DRY_RUN = process.argv.includes('--dry-run'); // 是否為乾跑模式（不實際寫入）

console.log('========================================');
console.log('PII 資料加密遷移腳本');
console.log('========================================');
console.log(`執行模式：${DRY_RUN ? '乾跑模式（不寫入）' : '正式執行'}`);
console.log(`批次大小：${BATCH_SIZE}`);
console.log('========================================\n');

/**
 * 遷移 users 表的 PII 資料
 */
async function migrateUsersPII() {
    const encryptionKey = process.env.ENCRYPTION_KEY_PII;
    
    if (!encryptionKey) {
        throw new Error('❌ ENCRYPTION_KEY_PII 未配置，請在 .env 中添加此環境變數');
    }
    
    console.log('[1/3] 開始遷移 users 表的 PII 資料...\n');
    
    // 查詢需要遷移的記錄數
    const countResult = await db.query(
        `SELECT COUNT(*) FROM users 
         WHERE (registration_ip IS NOT NULL AND encrypted_registration_ip IS NULL)
            OR (first_login_ip IS NOT NULL AND encrypted_first_login_ip IS NULL)
            OR (last_login_ip IS NOT NULL AND encrypted_last_login_ip IS NULL)
            OR (device_id IS NOT NULL AND hashed_device_id IS NULL)
            OR (user_agent IS NOT NULL AND encrypted_user_agent IS NULL)`
    );
    
    const totalCount = parseInt(countResult.rows[0].count, 10);
    console.log(`📊 待遷移記錄數：${totalCount}\n`);
    
    if (totalCount === 0) {
        console.log('✅ users 表無需遷移\n');
        return;
    }
    
    let processedCount = 0;
    let errorCount = 0;
    
    // 分批處理
    while (processedCount < totalCount) {
        const batchResult = await db.query(
            `SELECT id, user_id, registration_ip, first_login_ip, last_login_ip, 
                    device_id, user_agent,
                    encrypted_registration_ip, encrypted_first_login_ip, encrypted_last_login_ip,
                    hashed_device_id, encrypted_user_agent
             FROM users
             WHERE (registration_ip IS NOT NULL AND encrypted_registration_ip IS NULL)
                OR (first_login_ip IS NOT NULL AND encrypted_first_login_ip IS NULL)
                OR (last_login_ip IS NOT NULL AND encrypted_last_login_ip IS NULL)
                OR (device_id IS NOT NULL AND hashed_device_id IS NULL)
                OR (user_agent IS NOT NULL AND encrypted_user_agent IS NULL)
             ORDER BY id ASC
             LIMIT $1`,
            [BATCH_SIZE]
        );
        
        const batch = batchResult.rows;
        
        if (batch.length === 0) {
            break; // 沒有更多記錄
        }
        
        for (const user of batch) {
            try {
                const updates = [];
                const params = [];
                let paramIndex = 1;
                
                // 加密 registration_ip
                if (user.registration_ip && !user.encrypted_registration_ip) {
                    updates.push(`encrypted_registration_ip = $${paramIndex++}`);
                    params.push(encrypt(user.registration_ip, encryptionKey));
                }
                
                // 加密 first_login_ip
                if (user.first_login_ip && !user.encrypted_first_login_ip) {
                    updates.push(`encrypted_first_login_ip = $${paramIndex++}`);
                    params.push(encrypt(user.first_login_ip, encryptionKey));
                }
                
                // 加密 last_login_ip
                if (user.last_login_ip && !user.encrypted_last_login_ip) {
                    updates.push(`encrypted_last_login_ip = $${paramIndex++}`);
                    params.push(encrypt(user.last_login_ip, encryptionKey));
                }
                
                // 雜湊 Device ID（單向）
                if (user.device_id && !user.hashed_device_id) {
                    updates.push(`hashed_device_id = $${paramIndex++}`);
                    params.push(crypto.createHash('sha256').update(user.device_id).digest('hex'));
                }
                
                // 加密 User Agent
                if (user.user_agent && !user.encrypted_user_agent) {
                    updates.push(`encrypted_user_agent = $${paramIndex++}`);
                    params.push(encrypt(user.user_agent, encryptionKey));
                }
                
                if (updates.length > 0) {
                    params.push(user.id);
                    const updateSql = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
                    
                    if (!DRY_RUN) {
                        await db.query(updateSql, params);
                    }
                    
                    processedCount++;
                    
                    if (processedCount % 10 === 0) {
                        console.log(`  進度：${processedCount}/${totalCount} (${Math.round(processedCount / totalCount * 100)}%)`);
                    }
                }
            } catch (error) {
                errorCount++;
                console.error(`  ❌ 處理用戶 ${user.user_id} (ID: ${user.id}) 失敗：`, error.message);
            }
        }
    }
    
    console.log(`\n✅ users 表遷移完成：${processedCount} 筆成功，${errorCount} 筆失敗\n`);
}

/**
 * 遷移 user_login_logs 表的 PII 資料
 */
async function migrateUserLoginLogsPII() {
    const encryptionKey = process.env.ENCRYPTION_KEY_PII;
    
    console.log('[2/3] 開始遷移 user_login_logs 表的 PII 資料...\n');
    
    // 查詢需要遷移的記錄數
    const countResult = await db.query(
        `SELECT COUNT(*) FROM user_login_logs 
         WHERE (login_ip IS NOT NULL AND encrypted_login_ip IS NULL)
            OR (device_id IS NOT NULL AND hashed_device_id IS NULL)`
    );
    
    const totalCount = parseInt(countResult.rows[0].count, 10);
    console.log(`📊 待遷移記錄數：${totalCount}\n`);
    
    if (totalCount === 0) {
        console.log('✅ user_login_logs 表無需遷移\n');
        return;
    }
    
    let processedCount = 0;
    let errorCount = 0;
    
    // 分批處理
    while (processedCount < totalCount) {
        const batchResult = await db.query(
            `SELECT id, user_id, login_ip, device_id, encrypted_login_ip, hashed_device_id
             FROM user_login_logs
             WHERE (login_ip IS NOT NULL AND encrypted_login_ip IS NULL)
                OR (device_id IS NOT NULL AND hashed_device_id IS NULL)
             ORDER BY id ASC
             LIMIT $1`,
            [BATCH_SIZE]
        );
        
        const batch = batchResult.rows;
        
        if (batch.length === 0) {
            break;
        }
        
        for (const log of batch) {
            try {
                const updates = [];
                const params = [];
                let paramIndex = 1;
                
                // 加密 login_ip
                if (log.login_ip && !log.encrypted_login_ip) {
                    updates.push(`encrypted_login_ip = $${paramIndex++}`);
                    params.push(encrypt(log.login_ip, encryptionKey));
                }
                
                // 雜湊 Device ID
                if (log.device_id && !log.hashed_device_id) {
                    updates.push(`hashed_device_id = $${paramIndex++}`);
                    params.push(crypto.createHash('sha256').update(log.device_id).digest('hex'));
                }
                
                if (updates.length > 0) {
                    params.push(log.id);
                    const updateSql = `UPDATE user_login_logs SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
                    
                    if (!DRY_RUN) {
                        await db.query(updateSql, params);
                    }
                    
                    processedCount++;
                    
                    if (processedCount % 50 === 0) {
                        console.log(`  進度：${processedCount}/${totalCount} (${Math.round(processedCount / totalCount * 100)}%)`);
                    }
                }
            } catch (error) {
                errorCount++;
                console.error(`  ❌ 處理登入日誌 ${log.id} 失敗：`, error.message);
            }
        }
    }
    
    console.log(`\n✅ user_login_logs 表遷移完成：${processedCount} 筆成功，${errorCount} 筆失敗\n`);
}

/**
 * 遷移 admin_audit_logs 表的 PII 資料
 */
async function migrateAdminAuditLogsPII() {
    const encryptionKey = process.env.ENCRYPTION_KEY_PII;
    
    console.log('[3/3] 開始遷移 admin_audit_logs 表的 PII 資料...\n');
    
    // 查詢需要遷移的記錄數
    const countResult = await db.query(
        `SELECT COUNT(*) FROM admin_audit_logs 
         WHERE ip_address IS NOT NULL AND encrypted_ip_address IS NULL`
    );
    
    const totalCount = parseInt(countResult.rows[0].count, 10);
    console.log(`📊 待遷移記錄數：${totalCount}\n`);
    
    if (totalCount === 0) {
        console.log('✅ admin_audit_logs 表無需遷移\n');
        return;
    }
    
    let processedCount = 0;
    let errorCount = 0;
    
    // 分批處理
    while (processedCount < totalCount) {
        const batchResult = await db.query(
            `SELECT id, ip_address, encrypted_ip_address
             FROM admin_audit_logs
             WHERE ip_address IS NOT NULL AND encrypted_ip_address IS NULL
             ORDER BY id ASC
             LIMIT $1`,
            [BATCH_SIZE]
        );
        
        const batch = batchResult.rows;
        
        if (batch.length === 0) {
            break;
        }
        
        for (const log of batch) {
            try {
                if (log.ip_address && !log.encrypted_ip_address) {
                    const encryptedIp = encrypt(log.ip_address, encryptionKey);
                    
                    if (!DRY_RUN) {
                        await db.query(
                            'UPDATE admin_audit_logs SET encrypted_ip_address = $1 WHERE id = $2',
                            [encryptedIp, log.id]
                        );
                    }
                    
                    processedCount++;
                    
                    if (processedCount % 50 === 0) {
                        console.log(`  進度：${processedCount}/${totalCount} (${Math.round(processedCount / totalCount * 100)}%)`);
                    }
                }
            } catch (error) {
                errorCount++;
                console.error(`  ❌ 處理審計日誌 ${log.id} 失敗：`, error.message);
            }
        }
    }
    
    console.log(`\n✅ admin_audit_logs 表遷移完成：${processedCount} 筆成功，${errorCount} 筆失敗\n`);
}

/**
 * 主函數
 */
async function main() {
    try {
        const startTime = Date.now();
        
        // 檢查加密密鑰
        if (!process.env.ENCRYPTION_KEY_PII) {
            throw new Error('❌ ENCRYPTION_KEY_PII 未配置');
        }
        
        console.log('✅ 環境變數檢查通過\n');
        
        // 執行遷移
        await migrateUsersPII();
        await migrateUserLoginLogsPII();
        await migrateAdminAuditLogsPII();
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.log('========================================');
        console.log(`✅ 遷移完成！總耗時：${duration} 秒`);
        
        if (DRY_RUN) {
            console.log('\n⚠️  這是乾跑模式，未實際寫入資料庫');
            console.log('   移除 --dry-run 參數以執行正式遷移');
        } else {
            console.log('\n⚠️  遷移完成後，請手動驗證加密資料：');
            console.log('   1. 檢查加密欄位是否有值');
            console.log('   2. 測試解密功能是否正常');
            console.log('   3. 確認後可刪除明文欄位（但建議保留一段時間）');
        }
        
        console.log('========================================\n');
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ 遷移失敗：', error);
        process.exit(1);
    }
}

// 執行主函數
main().catch(error => {
    console.error('❌ 未預期的錯誤：', error);
    process.exit(1);
});
