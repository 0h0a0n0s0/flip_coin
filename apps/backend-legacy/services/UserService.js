// User Service
// 處理用戶相關的資料庫操作

const db = require('@flipcoin/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * 根據用戶名獲取用戶
 */
async function getUserByUsername(username) {
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0] || null;
}

/**
 * 根據 ID 獲取用戶
 */
async function getUserById(id) {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
}

/**
 * 根據 user_id 獲取用戶
 */
async function getUserByUserId(userId) {
    const result = await db.query('SELECT * FROM users WHERE user_id = $1', [userId]);
    return result.rows[0] || null;
}

/**
 * 更新用戶暱稱
 */
async function updateUserNickname(userId, nickname) {
    const result = await db.query(
        'UPDATE users SET nickname = $1 WHERE id = $2 RETURNING *',
        [nickname.trim(), userId]
    );
    return result.rows[0];
}

/**
 * 獲取用戶投注歷史
 */
async function getUserBetHistory(userId, limit = 100) {
    const result = await db.query(
        'SELECT * FROM bets WHERE user_id = $1 ORDER BY bet_time DESC LIMIT $2',
        [userId, limit]
    );
    return result.rows;
}

/**
 * 獲取排行榜
 */
async function getLeaderboard(limit = 10) {
    const result = await db.query(
        `SELECT 
            user_id, 
            COALESCE(nickname, username) AS display_name,
            max_streak 
         FROM users 
         WHERE max_streak > 0 
         ORDER BY max_streak DESC 
         LIMIT $1`,
        [limit]
    );
    return result.rows;
}

/**
 * 獲取啟用的遊戲列表
 */
async function getEnabledGames(status = 'enabled') {
    const result = await db.query(
        `SELECT id, provider, name_zh, name_en, game_code, game_status, status, sort_order, 
                payout_multiplier, streak_multipliers
         FROM games 
         WHERE status = $1 
         ORDER BY sort_order ASC, id ASC`,
        [status]
    );
    return result.rows;
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
 * 獲取用戶提款歷史
 */
async function getUserWithdrawals(userId, limit = 20) {
    const result = await db.query(
        `SELECT chain_type, address, amount, status, rejection_reason, request_time, review_time, tx_hash 
         FROM withdrawals 
         WHERE user_id = $1 
         ORDER BY request_time DESC 
         LIMIT $2`,
        [userId, limit]
    );
    return result.rows;
}

/**
 * 獲取用戶充值歷史
 */
async function getUserDeposits(userId, limit = 20) {
    const result = await db.query(
        `SELECT id, chain, amount, status, tx_hash, created_at 
         FROM platform_transactions 
         WHERE user_id = $1 AND type = 'deposit' 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [userId, limit]
    );
    return result.rows;
}

/**
 * 驗證用戶密碼
 */
async function verifyUserPassword(user, password) {
    return await bcrypt.compare(password, user.password_hash);
}

/**
 * 生成密碼雜湊
 */
async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
}

/**
 * 生成密碼指紋
 */
function generatePasswordFingerprint(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * 檢查用戶是否首次登錄
 */
async function checkIsFirstLogin(userId) {
    const result = await db.query(
        'SELECT first_login_ip, first_login_at FROM users WHERE id = $1',
        [userId]
    );
    return !result.rows[0]?.first_login_ip;
}

/**
 * 更新用戶首次登錄信息
 */
async function updateFirstLoginInfo(userId, clientIp, country, userAgent, deviceId) {
    await db.query(
        `UPDATE users 
         SET first_login_ip = $1, first_login_country = $2, first_login_at = NOW(),
             last_login_ip = $1, last_activity_at = NOW(), user_agent = $3,
             device_id = COALESCE(device_id, $4)
         WHERE id = $5`,
        [clientIp, country, userAgent, deviceId, userId]
    );
}

/**
 * 更新用戶最後登錄信息
 */
async function updateLastLoginInfo(userId, clientIp, userAgent, deviceId) {
    await db.query(
        `UPDATE users 
         SET last_login_ip = $1, last_activity_at = NOW(), user_agent = $2,
             device_id = COALESCE(device_id, $3)
         WHERE id = $4`,
        [clientIp, userAgent, deviceId, userId]
    );
}

/**
 * 插入用戶登錄日誌
 */
async function insertUserLoginLog(userId, loginIp, loginCountry, deviceId, userAgent) {
    await db.query(
        `INSERT INTO user_login_logs (user_id, login_ip, login_country, device_id, user_agent) 
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, loginIp, loginCountry, deviceId, userAgent]
    );
}

module.exports = {
    getUserByUsername,
    getUserById,
    getUserByUserId,
    updateUserNickname,
    getUserBetHistory,
    getLeaderboard,
    getEnabledGames,
    getPlatformName,
    getUserWithdrawals,
    getUserDeposits,
    verifyUserPassword,
    hashPassword,
    generatePasswordFingerprint,
    checkIsFirstLogin,
    updateFirstLoginInfo,
    updateLastLoginInfo,
    insertUserLoginLog
};

