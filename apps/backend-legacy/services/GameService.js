// Game Service
// 處理遊戲相關的資料庫操作

const db = require('@flipcoin/database');

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
 * 根據遊戲代碼獲取遊戲
 */
async function getGameByCode(gameCode) {
    const result = await db.query(
        'SELECT * FROM games WHERE game_code = $1 AND status = $2',
        [gameCode, 'enabled']
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

module.exports = {
    getEnabledGames,
    getGameByCode,
    getPlatformName
};

