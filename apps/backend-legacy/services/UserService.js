// User Service
// 處理用戶相關的資料庫操作

const db = require('@flipcoin/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { logBalanceChange, CHANGE_TYPES } = require('../utils/balanceChangeLogger');

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

/**
 * 檢查並升級用戶等級
 * @param {string} userId - 用戶ID (user_id)
 * @param {Object} [client] - 數據庫事務客戶端（可選）
 * @returns {Promise<Object|null>} 返回升級後的等級信息，如果未升級則返回null
 */
async function checkAndUpgradeUserLevel(userId, client = null) {
    const query = client ? client.query.bind(client) : db.query.bind(db);
    
    try {
        // 1. 獲取用戶當前等級
        const userResult = await query(
            'SELECT level FROM users WHERE user_id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            console.warn(`[UserService] User ${userId} not found for level upgrade check`);
            return null;
        }
        
        const currentLevel = userResult.rows[0].level;
        
        // 2. 獲取下一級配置（若不存在，表示已是最高级）
        const nextLevel = currentLevel + 1;
        const nextLevelResult = await query(
            'SELECT * FROM user_levels WHERE level = $1',
            [nextLevel]
        );
        
        if (nextLevelResult.rows.length === 0) {
            // 没有下一级配置，表示当前是最高级
            return null;
        }
        
        const nextLevelConfig = nextLevelResult.rows[0];
        const nextRequiredTotalAmount = parseFloat(nextLevelConfig.required_total_bet_amount) || 0;
        
        // 3. 獲取用戶當前累計值（使用累加字段，而非 COUNT(*) 查詢）
        const userStatsResult = await query(
            'SELECT total_valid_bet_amount FROM users WHERE user_id = $1',
            [userId]
        );
        
        if (userStatsResult.rows.length === 0) {
            console.warn(`[UserService] User stats not found for user ${userId}`);
            return null;
        }
        
        const totalValidBetAmount = parseFloat(userStatsResult.rows[0].total_valid_bet_amount) || 0;
        
        // 4. 檢查是否滿足升級條件（仅基于累计有效投注金额）
        if (totalValidBetAmount >= nextRequiredTotalAmount) {
            // 處理升級
            return await processLevelUpgrade(userId, currentLevel, nextLevelConfig, client);
        }
        
        return null;
    } catch (error) {
        console.error(`[UserService] Error checking level upgrade for user ${userId}:`, error);
        throw error;
    }
}

/**
 * 處理用戶等級升級並發放獎勵
 * @param {string} userId - 用戶ID (user_id)
 * @param {number} currentLevel - 當前等級
 * @param {Object} nextLevelConfig - 下一級配置
 * @param {Object} [client] - 數據庫事務客戶端（可選）
 * @returns {Promise<Object>} 返回升級後的用戶信息
 */
async function processLevelUpgrade(userId, currentLevel, nextLevelConfig, client = null) {
    const query = client ? client.query.bind(client) : db.query.bind(db);
    const nextLevel = nextLevelConfig.level;
    const rewardAmount = parseFloat(nextLevelConfig.upgrade_reward_amount) || 0;
    
    try {
        // 使用行鎖確保並發安全
        await query(
            'SELECT balance FROM users WHERE user_id = $1 FOR UPDATE NOWAIT',
            [userId]
        );
        
        // 更新用戶等級和餘額（如果有獎勵）
        let updateQuery;
        let updateParams;
        
        if (rewardAmount > 0) {
            updateQuery = `
                UPDATE users 
                SET level = $1, balance = balance + $2, last_level_up_time = NOW()
                WHERE user_id = $3
                RETURNING *
            `;
            updateParams = [nextLevel, rewardAmount, userId];
        } else {
            updateQuery = `
                UPDATE users 
                SET level = $1, last_level_up_time = NOW()
                WHERE user_id = $2
                RETURNING *
            `;
            updateParams = [nextLevel, userId];
        }
        
        const userResult = await query(updateQuery, updateParams);
        
        if (userResult.rows.length === 0) {
            throw new Error(`User ${userId} not found for level upgrade`);
        }
        
        const updatedUser = userResult.rows[0];
        const newBalance = parseFloat(updatedUser.balance);
        
        // 如果有獎勵，記錄賬變
        if (rewardAmount > 0) {
            try {
                await logBalanceChange({
                    user_id: userId,
                    change_type: CHANGE_TYPES.LEVEL_UP_REWARD,
                    amount: rewardAmount,
                    balance_after: newBalance,
                    remark: `Level ${nextLevel} Upgrade Reward`,
                    client: client
                });
            } catch (error) {
                console.error(`[UserService] Failed to log balance change for level upgrade:`, error);
                // 不阻止主流程，只記錄錯誤
            }
        }
        
        console.log(`[UserService] User ${userId} upgraded from level ${currentLevel} to level ${nextLevel}${rewardAmount > 0 ? ` with reward ${rewardAmount} USDT` : ''}`);
        
        return updatedUser;
    } catch (error) {
        // 如果是 NOWAIT 鎖定失敗，記錄但不拋出錯誤
        if (error.code === '55P03') { // lock_not_available
            console.warn(`[UserService] Could not acquire lock for user ${userId} level upgrade, will retry later`);
            return null;
        }
        console.error(`[UserService] Error processing level upgrade for user ${userId}:`, error);
        throw error;
    }
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
    insertUserLoginLog,
    checkAndUpgradeUserLevel,
    processLevelUpgrade
};

