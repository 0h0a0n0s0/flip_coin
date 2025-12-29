// 腳本：修復用戶登入查詢資料
// 用途：為舊帳號補齊首次登入地區、登入同IP等資料
// 執行方式：cd backend && node scripts/fix-user-login-data.js

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

// 簡化版的 getCountryFromIp，避免依賴問題
async function getCountryFromIp(ip) {
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
        return null;
    }
    // 這裡可以選擇是否調用 API，為了避免依賴問題，先返回 null
    // 如果需要，可以手動執行 SQL 腳本或使用其他方式獲取
    return null;
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function fixUserLoginData() {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 查詢需要修復的用戶（hans01, hans02 或所有缺少首次登入資料的用戶）
        const usernames = ['hans01', 'hans02'];
        
        for (const username of usernames) {
            console.log(`\n處理用戶: ${username}`);
            
            // 查詢用戶資料
            const userResult = await client.query(
                'SELECT user_id, username, registration_ip, first_login_ip, first_login_country, first_login_at FROM users WHERE username = $1',
                [username]
            );
            
            if (userResult.rows.length === 0) {
                console.log(`  ❌ 用戶 ${username} 不存在`);
                continue;
            }
            
            const user = userResult.rows[0];
            console.log(`  ✓ 找到用戶: ${user.user_id}`);
            
            // 如果已經有首次登入資料，跳過
            if (user.first_login_ip && user.first_login_country) {
                console.log(`  ⚠ 用戶 ${username} 已有首次登入資料，跳過`);
                continue;
            }
            
            // 查詢該用戶的登入日誌，按時間排序
            const loginLogsResult = await client.query(
                'SELECT login_ip, login_country, login_at FROM user_login_logs WHERE user_id = $1 ORDER BY login_at ASC LIMIT 1',
                [user.user_id]
            );
            
            let firstLoginIp = null;
            let firstLoginCountry = null;
            let firstLoginAt = null;
            
            if (loginLogsResult.rows.length > 0) {
                // 從登入日誌中獲取首次登入資訊
                const firstLogin = loginLogsResult.rows[0];
                firstLoginIp = firstLogin.login_ip;
                firstLoginCountry = firstLogin.login_country;
                firstLoginAt = firstLogin.login_at;
                console.log(`  ✓ 從登入日誌中找到首次登入: IP=${firstLoginIp}, Country=${firstLoginCountry}`);
            } else {
                // 如果沒有登入日誌，使用註冊IP作為首次登入IP
                if (user.registration_ip) {
                    firstLoginIp = user.registration_ip;
                    firstLoginAt = user.created_at || new Date();
                    
                    // 嘗試獲取國家資訊
                    try {
                        firstLoginCountry = await getCountryFromIp(firstLoginIp);
                        console.log(`  ✓ 使用註冊IP作為首次登入IP: ${firstLoginIp}, Country=${firstLoginCountry || '無法獲取'}`);
                    } catch (error) {
                        console.log(`  ⚠ 無法獲取IP國家資訊: ${error.message}`);
                    }
                } else {
                    console.log(`  ⚠ 用戶 ${username} 沒有登入日誌也沒有註冊IP，無法補齊資料`);
                    continue;
                }
            }
            
            // 更新用戶資料
            if (firstLoginIp) {
                await client.query(
                    `UPDATE users 
                     SET first_login_ip = $1, 
                         first_login_country = COALESCE($2, first_login_country),
                         first_login_at = COALESCE($3, first_login_at)
                     WHERE user_id = $4`,
                    [firstLoginIp, firstLoginCountry, firstLoginAt, user.user_id]
                );
                console.log(`  ✅ 已更新用戶 ${username} 的首次登入資料`);
            }
        }
        
        await client.query('COMMIT');
        console.log('\n✅ 修復完成！');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ 修復失敗:', error);
        throw error;
    } finally {
        client.release();
    }
}

// 執行修復
fixUserLoginData()
    .then(() => {
        console.log('腳本執行完成');
        process.exit(0);
    })
    .catch((error) => {
        console.error('腳本執行失敗:', error);
        process.exit(1);
    });

