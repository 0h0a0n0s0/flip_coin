// Admin Service
// 處理管理員相關的資料庫操作

const db = require('@flipcoin/database');
const bcrypt = require('bcryptjs');
const { encrypt, decrypt } = require('../utils/encryptionUtils');

/**
 * 根據用戶名獲取管理員
 */
async function getAdminByUsername(username) {
    const result = await db.query('SELECT * FROM admin_users WHERE username = $1', [username]);
    return result.rows[0] || null;
}

/**
 * 根據 ID 獲取管理員
 */
async function getAdminById(id) {
    const result = await db.query('SELECT * FROM admin_users WHERE id = $1', [id]);
    return result.rows[0] || null;
}

/**
 * 驗證管理員密碼
 */
async function verifyAdminPassword(admin, password) {
    return await bcrypt.compare(password, admin.password_hash);
}

/**
 * 獲取管理員權限
 */
async function getAdminPermissions(roleId) {
    const query = `
        SELECT DISTINCT ap.resource, ap.action
        FROM admin_role_permissions arp
        JOIN admin_permissions ap ON arp.permission_id = ap.id
        WHERE arp.role_id = $1;
    `;
    const result = await db.query(query, [roleId]);
    return result.rows.reduce((acc, perm) => {
        acc[`${perm.resource}:${perm.action}`] = true;
        return acc;
    }, {});
}

/**
 * 更新管理員最後登入 IP
 */
async function updateAdminLastLoginIp(adminId, ip) {
    await db.query(
        'UPDATE admin_users SET last_login_ip = $1, last_login_at = NOW() WHERE id = $2',
        [ip, adminId]
    );
}

/**
 * 生成管理員密碼雜湊
 */
async function hashAdminPassword(password) {
    return await bcrypt.hash(password, 10);
}

/**
 * 獲取管理員個人資料
 */
async function getAdminProfile(adminId) {
    const result = await db.query(
        'SELECT id, username, nickname, encrypted_google_auth_secret FROM admin_users WHERE id = $1',
        [adminId]
    );
    const admin = result.rows[0];
    if (admin && admin.encrypted_google_auth_secret) {
        // 前端只需要知道是否已綁定，不需要實際密鑰
        admin.google_auth_secret = '[ENCRYPTED]';
    }
    return admin || null;
}

/**
 * 更新管理員個人資料
 */
async function updateAdminProfile(adminId, updates, params) {
    // params 已經包含了 userId 作為最後一個元素
    const paramIndex = params.length;
    const query = `
        UPDATE admin_users 
        SET ${updates.join(', ')} 
        WHERE id = $${paramIndex}
        RETURNING id, username, nickname
    `;
    const result = await db.query(query, params);
    return result.rows[0] || null;
}

/**
 * 檢查管理員是否已綁定 Google Auth
 * @returns {boolean} 是否已綁定（返回 true/false，不返回實際密鑰）
 */
async function checkAdminGoogleAuthBound(adminId) {
    const result = await db.query(
        'SELECT encrypted_google_auth_secret FROM admin_users WHERE id = $1',
        [adminId]
    );
    return !!(result.rows[0]?.encrypted_google_auth_secret);
}

/**
 * 獲取管理員用戶信息（用於 Google Auth 設置）
 */
async function getAdminUserInfo(adminId) {
    const result = await db.query(
        'SELECT nickname, username FROM admin_users WHERE id = $1',
        [adminId]
    );
    return result.rows[0] || null;
}

/**
 * 獲取平台名稱
 */
async function getPlatformName() {
    const result = await db.query(
        "SELECT value FROM system_settings WHERE key = 'PLATFORM_NAME' LIMIT 1"
    );
    return result.rows[0]?.value || 'FlipCoin';
}

/**
 * 更新管理員 Google Auth 密鑰（加密存儲）
 * @param {number} adminId - 管理員 ID
 * @param {string} secret - Base32 格式的 2FA 密鑰
 */
async function updateAdminGoogleAuthSecret(adminId, secret) {
    const encryptionKey = process.env.ENCRYPTION_KEY_2FA;
    if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY_2FA not found in environment variables');
    }
    
    const encryptedSecret = encrypt(secret, encryptionKey);
    await db.query(
        'UPDATE admin_users SET encrypted_google_auth_secret = $1 WHERE id = $2',
        [encryptedSecret, adminId]
    );
}

/**
 * 獲取管理員 Google Auth 密鑰（解密）
 * @param {number} adminId - 管理員 ID
 * @returns {string|null} Base32 格式的明文密鑰
 */
async function getAdminGoogleAuthSecret(adminId) {
    const result = await db.query(
        'SELECT encrypted_google_auth_secret FROM admin_users WHERE id = $1',
        [adminId]
    );
    
    const encryptedSecret = result.rows[0]?.encrypted_google_auth_secret;
    if (!encryptedSecret) {
        return null;
    }
    
    const encryptionKey = process.env.ENCRYPTION_KEY_2FA;
    if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY_2FA not found in environment variables');
    }
    
    try {
        return decrypt(encryptedSecret, encryptionKey);
    } catch (error) {
        console.error(`[AdminService] Failed to decrypt 2FA secret for admin ${adminId}:`, error.message);
        throw new Error('Failed to decrypt 2FA secret');
    }
}

/**
 * 清除管理員 Google Auth 密鑰
 */
async function clearAdminGoogleAuthSecret(adminId) {
    await db.query(
        'UPDATE admin_users SET encrypted_google_auth_secret = NULL WHERE id = $1',
        [adminId]
    );
}

module.exports = {
    getAdminByUsername,
    getAdminById,
    verifyAdminPassword,
    getAdminPermissions,
    updateAdminLastLoginIp,
    hashAdminPassword,
    getAdminProfile,
    updateAdminProfile,
    checkAdminGoogleAuthBound,
    getAdminUserInfo,
    getPlatformName,
    updateAdminGoogleAuthSecret,
    getAdminGoogleAuthSecret,
    clearAdminGoogleAuthSecret
};

