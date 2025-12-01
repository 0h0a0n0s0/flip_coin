// 腳本：為現有用戶更新密碼指紋
// 用途：為已存在的用戶生成密碼指紋（需要知道原始密碼）
// 執行方式：node backend/scripts/update-password-fingerprints.js

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// 用戶密碼對應表（需要手動填寫）
const userPasswords = {
    '89906213': { // hans02
        password: 'aa123456',
        withdrawalPassword: 'aaa123456'
    },
    '15470016': { // hans01
        password: 'aa123456',
        withdrawalPassword: 'aaa123456'
    }
};

async function updateFingerprints() {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        for (const [userId, passwords] of Object.entries(userPasswords)) {
            console.log(`\n處理用戶: ${userId}`);
            
            // 生成註冊密碼指紋
            if (passwords.password) {
                const passwordFingerprint = crypto.createHash('sha256').update(passwords.password).digest('hex');
                await client.query(
                    'UPDATE users SET password_fingerprint = $1 WHERE user_id = $2',
                    [passwordFingerprint, userId]
                );
                console.log(`  ✓ 已更新註冊密碼指紋: ${passwordFingerprint.substring(0, 8)}...`);
            }
            
            // 生成資金密碼指紋
            if (passwords.withdrawalPassword) {
                const withdrawalPasswordFingerprint = crypto.createHash('sha256').update(passwords.withdrawalPassword).digest('hex');
                await client.query(
                    'UPDATE users SET withdrawal_password_fingerprint = $1 WHERE user_id = $2',
                    [withdrawalPasswordFingerprint, userId]
                );
                console.log(`  ✓ 已更新資金密碼指紋: ${withdrawalPasswordFingerprint.substring(0, 8)}...`);
            }
        }
        
        await client.query('COMMIT');
        console.log('\n✅ 更新完成！');
        
        // 驗證結果
        const result = await client.query(
            `SELECT user_id, 
                    password_fingerprint IS NOT NULL as has_pwd_fp,
                    withdrawal_password_fingerprint IS NOT NULL as has_wd_fp
             FROM users WHERE user_id = ANY($1)`,
            [Object.keys(userPasswords)]
        );
        
        console.log('\n驗證結果:');
        result.rows.forEach(row => {
            console.log(`  用戶 ${row.user_id}: 註冊密碼指紋=${row.has_pwd_fp}, 資金密碼指紋=${row.has_wd_fp}`);
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ 更新失敗:', error);
        throw error;
    } finally {
        client.release();
    }
}

// 執行更新
updateFingerprints()
    .then(() => {
        console.log('腳本執行完成');
        process.exit(0);
    })
    .catch((error) => {
        console.error('腳本執行失敗:', error);
        process.exit(1);
    });

