// GDPR Service
// 處理 GDPR 用戶權利相關功能（資料匯出、帳號刪除、資料更正）

const db = require('@flipcoin/database');
const { decryptUserPII } = require('./UserService');
const { decrypt } = require('../utils/encryptionUtils');

/**
 * 匯出用戶的所有個人資料（GDPR Article 20: Right to Data Portability）
 * @param {string} userId - 用戶 ID (user_id)
 * @returns {Promise<Object>} JSON 格式的完整用戶資料
 */
async function exportUserData(userId) {
    const encryptionKey = process.env.ENCRYPTION_KEY_PII;
    
    try {
        // 1. 基本資料
        const userResult = await db.query(
            `SELECT id, user_id, username, nickname, level, invite_code, referrer_code, 
                    balance, status, created_at, last_activity_at, first_login_at,
                    first_login_country, current_streak, max_streak,
                    total_valid_bet_amount, total_valid_bet_count,
                    encrypted_email, encrypted_registration_ip, 
                    encrypted_first_login_ip, encrypted_last_login_ip,
                    encrypted_user_agent, hashed_device_id,
                    tron_deposit_address, evm_deposit_address
             FROM users WHERE user_id = $1`,
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            throw new Error('User not found');
        }
        
        const user = decryptUserPII(userResult.rows[0]);
        
        // 2. 投注記錄（最近 1000 筆）
        const betsResult = await db.query(
            `SELECT id, game_type, choice, amount, status, bet_time, settle_time, 
                    payout_multiplier, tx_hash
             FROM bets WHERE user_id = $1 
             ORDER BY bet_time DESC LIMIT 1000`,
            [userId]
        );
        
        // 3. 充值記錄
        const depositsResult = await db.query(
            `SELECT id, chain, amount, status, tx_hash, created_at
             FROM platform_transactions 
             WHERE user_id = $1 AND type = 'deposit'
             ORDER BY created_at DESC`,
            [userId]
        );
        
        // 4. 提款記錄
        const withdrawalsResult = await db.query(
            `SELECT id, chain_type, address, amount, status, 
                    rejection_reason, request_time, review_time, tx_hash
             FROM withdrawals WHERE user_id = $1 
             ORDER BY request_time DESC`,
            [userId]
        );
        
        // 5. 登入日誌（最近 100 筆）
        const loginLogsResult = await db.query(
            `SELECT id, encrypted_login_ip, login_country, login_time, 
                    hashed_device_id, user_agent
             FROM user_login_logs WHERE user_id = $1 
             ORDER BY login_time DESC LIMIT 100`,
            [userId]
        );
        
        // 解密登入日誌中的 IP（如果有加密）
        const loginLogs = loginLogsResult.rows.map(log => {
            if (encryptionKey && log.encrypted_login_ip) {
                try {
                    log.login_ip = decrypt(log.encrypted_login_ip, encryptionKey);
                } catch (error) {
                    console.error('[GdprService] Failed to decrypt login IP:', error);
                    log.login_ip = '[ENCRYPTED]';
                }
            }
            delete log.encrypted_login_ip;
            log.device_id = '[HASHED]'; // Device ID 為單向雜湊，無法還原
            delete log.hashed_device_id;
            return log;
        });
        
        // 6. 餘額變動記錄（最近 500 筆）
        const balanceChangesResult = await db.query(
            `SELECT id, change_type, amount, balance_after, remark, created_at
             FROM balance_changes WHERE user_id = $1 
             ORDER BY created_at DESC LIMIT 500`,
            [userId]
        );
        
        // 組裝完整資料
        const exportData = {
            export_time: new Date().toISOString(),
            export_format_version: '1.0',
            user_info: {
                user_id: user.user_id,
                username: user.username,
                nickname: user.nickname,
                email: user.email || null,
                level: user.level,
                invite_code: user.invite_code,
                referrer_code: user.referrer_code,
                status: user.status,
                registration_date: user.created_at,
                registration_ip: user.registration_ip || null,
                first_login_at: user.first_login_at,
                first_login_ip: user.first_login_ip || null,
                first_login_country: user.first_login_country,
                last_login_ip: user.last_login_ip || null,
                last_activity_at: user.last_activity_at,
                device_id: user.device_id, // [HASHED]
                user_agent: user.user_agent || null
            },
            financial_info: {
                current_balance: user.balance,
                total_valid_bet_amount: user.total_valid_bet_amount,
                total_valid_bet_count: user.total_valid_bet_count,
                tron_deposit_address: user.tron_deposit_address,
                evm_deposit_address: user.evm_deposit_address
            },
            game_stats: {
                current_streak: user.current_streak,
                max_streak: user.max_streak
            },
            bets: betsResult.rows,
            deposits: depositsResult.rows,
            withdrawals: withdrawalsResult.rows,
            login_logs: loginLogs,
            balance_changes: balanceChangesResult.rows
        };
        
        return exportData;
    } catch (error) {
        console.error('[GdprService] Error exporting user data:', error);
        throw error;
    }
}

/**
 * 刪除用戶帳號（GDPR Article 17: Right to Erasure）
 * @param {string} userId - 用戶 ID (user_id)
 * @param {string} reason - 刪除原因（可選）
 * @returns {Promise<Object>} 刪除結果
 */
async function deleteUserAccount(userId, reason = 'User request (GDPR)') {
    const client = await db.getClient();
    
    try {
        await client.query('BEGIN');
        
        // 1. 檢查用戶是否存在
        const userResult = await client.query(
            'SELECT id, user_id, username, balance, status FROM users WHERE user_id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            throw new Error('User not found');
        }
        
        const user = userResult.rows[0];
        
        // 2. 檢查是否有未結清餘額
        const balance = parseFloat(user.balance || 0);
        if (balance > 0.01) {
            throw new Error(`Cannot delete account with remaining balance: ${balance} USDT. Please withdraw first.`);
        }
        
        // 3. 檢查是否有待處理的提款
        const pendingWithdrawalsResult = await client.query(
            `SELECT COUNT(*) FROM withdrawals 
             WHERE user_id = $1 AND status IN ('pending', 'processing')`,
            [userId]
        );
        
        if (parseInt(pendingWithdrawalsResult.rows[0].count, 10) > 0) {
            throw new Error('Cannot delete account with pending withdrawals');
        }
        
        // 4. 匿名化保留：交易記錄（法律要求保留 7 年）
        const deletedUserId = `DELETED_${Date.now()}`;
        
        await client.query(
            'UPDATE bets SET user_id = $1 WHERE user_id = $2',
            [deletedUserId, userId]
        );
        
        await client.query(
            'UPDATE platform_transactions SET user_id = $1 WHERE user_id = $2',
            [deletedUserId, userId]
        );
        
        await client.query(
            'UPDATE withdrawals SET user_id = $1 WHERE user_id = $2',
            [deletedUserId, userId]
        );
        
        await client.query(
            'UPDATE balance_changes SET user_id = $1 WHERE user_id = $2',
            [deletedUserId, userId]
        );
        
        // 5. 立即刪除：PII 資料
        await client.query('DELETE FROM user_login_logs WHERE user_id = $1', [userId]);
        
        // 6. 刪除用戶主記錄
        await client.query('DELETE FROM users WHERE user_id = $1', [userId]);
        
        // 7. 記錄刪除操作（不含 PII）
        await client.query(
            `INSERT INTO admin_audit_logs 
             (admin_id, admin_username, action, resource, resource_id, description, ip_address) 
             VALUES (0, 'SYSTEM', 'delete_user_account', 'users', $1, $2, '127.0.0.1')`,
            [user.id.toString(), `GDPR 帳號刪除：${reason}`]
        );
        
        await client.query('COMMIT');
        
        console.log(`[GdprService] User account deleted: ${userId} (anonymized to ${deletedUserId})`);
        
        return {
            success: true,
            deleted_user_id: userId,
            anonymized_transaction_id: deletedUserId,
            deletion_time: new Date().toISOString(),
            reason: reason
        };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[GdprService] Error deleting user account:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * 檢查用戶是否有權刪除帳號（預檢查）
 * @param {string} userId - 用戶 ID (user_id)
 * @returns {Promise<Object>} 檢查結果
 */
async function checkAccountDeletionEligibility(userId) {
    try {
        const userResult = await db.query(
            'SELECT id, user_id, balance, status FROM users WHERE user_id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return { eligible: false, reason: 'User not found' };
        }
        
        const user = userResult.rows[0];
        const balance = parseFloat(user.balance || 0);
        
        // 檢查餘額
        if (balance > 0.01) {
            return { 
                eligible: false, 
                reason: `Account has remaining balance: ${balance} USDT. Please withdraw first.` 
            };
        }
        
        // 檢查待處理提款
        const pendingWithdrawalsResult = await db.query(
            `SELECT COUNT(*) FROM withdrawals 
             WHERE user_id = $1 AND status IN ('pending', 'processing')`,
            [userId]
        );
        
        if (parseInt(pendingWithdrawalsResult.rows[0].count, 10) > 0) {
            return { 
                eligible: false, 
                reason: 'Account has pending withdrawal requests' 
            };
        }
        
        return { eligible: true };
    } catch (error) {
        console.error('[GdprService] Error checking deletion eligibility:', error);
        throw error;
    }
}

module.exports = {
    exportUserData,
    deleteUserAccount,
    checkAccountDeletionEligibility
};
