// 游戏相关工具函数

const db = require('@flipcoin/database');
const { getSettingsCache } = require('../services/settingsCache.js');

/**
 * 获取游戏的派奖倍数
 * @param {string} gameCode - 游戏代码，如 'flip-coin'，如果未提供则使用 'FlipCoin' 作为后备
 * @param {string} gameMode - 游戏模式 ('normal' 或 'streak')，默认为 'normal'
 * @param {number} currentStreak - 当前连胜数（仅在 streak 模式下使用），默认为 0
 * @returns {Promise<number>} 派奖倍数
 */
async function getGamePayoutMultiplier(gameCode = null, gameMode = 'normal', currentStreak = 0) {
    try {
        // 优先从 games 表获取，使用 game_code 查询（最精确）
        let result;
        
        if (gameCode) {
            // 优先使用 game_code 查询，同时获取 streak_multipliers
            result = await db.query(
                `SELECT payout_multiplier, streak_multipliers FROM games 
                 WHERE game_code = $1 
                 AND status = 'enabled' 
                 LIMIT 1`,
                [gameCode]
            );
        }
        
        // 如果 game_code 查询没有结果，尝试使用名称查询（向后兼容）
        if (!result || result.rows.length === 0) {
            const gameType = gameCode || 'FlipCoin';
            result = await db.query(
                `SELECT payout_multiplier, streak_multipliers FROM games 
                 WHERE (name_en = $1 OR name_zh = $2 OR game_code = $3) 
                 AND status = 'enabled' 
                 LIMIT 1`,
                [gameType, 'Flip Coin', 'flip-coin']
            );
        }
        
        if (result.rows.length > 0) {
            const gameData = result.rows[0];
            const baseMultiplier = parseFloat(gameData.payout_multiplier);
            
            // 如果是原始模式，直接返回基础赔率
            if (gameMode === 'normal') {
                if (!isNaN(baseMultiplier) && baseMultiplier > 0) {
                    return baseMultiplier;
                }
            } else if (gameMode === 'streak') {
                // 连胜模式：从 streak_multipliers 中查找对应连胜数的赔率
                let streakMultipliers = null;
                if (gameData.streak_multipliers) {
                    try {
                        streakMultipliers = typeof gameData.streak_multipliers === 'string'
                            ? JSON.parse(gameData.streak_multipliers)
                            : gameData.streak_multipliers;
                    } catch (error) {
                        console.error('[GameUtils] Failed to parse streak_multipliers:', error);
                    }
                }
                
                if (streakMultipliers && typeof streakMultipliers === 'object') {
                    // 查找对应连胜数的赔率，如果没有则使用最接近的较小值
                    let multiplier = null;
                    for (let i = currentStreak; i >= 0; i--) {
                        if (streakMultipliers[i.toString()]) {
                            multiplier = parseFloat(streakMultipliers[i.toString()]);
                            break;
                        }
                    }
                    
                    // 如果找到了，返回该赔率
                    if (multiplier !== null && !isNaN(multiplier) && multiplier > 0) {
                        return multiplier;
                    }
                }
                
                // 如果没有找到连胜赔率，回退到基础赔率
                if (!isNaN(baseMultiplier) && baseMultiplier > 0) {
                    return baseMultiplier;
                }
            }
        }
        
        // 如果 games 表中没有，回退到 system_settings（向后兼容）
        const settingsCache = getSettingsCache();
        const multiplier = parseFloat(settingsCache['PAYOUT_MULTIPLIER']?.value);
        if (!isNaN(multiplier) && multiplier > 0) {
            return multiplier;
        }
        
        // 最后的后备：抛出错误，不允许使用写死的默认值
        throw new Error(`无法获取游戏赔率：game_code=${gameCode || '未指定'}, mode=${gameMode}`);
    } catch (error) {
        console.error('[GameUtils] Error getting payout multiplier:', error);
        // 出错时抛出错误，不允许使用写死的默认值
        throw new Error(`获取游戏赔率失败：${error.message}`);
    }
}

/**
 * 检查游戏是否可用（开启状态）
 * @param {string} gameType - 游戏类型，如 'FlipCoin'
 * @returns {Promise<boolean>} 游戏是否可用
 */
async function isGameEnabled(gameType = 'FlipCoin') {
    try {
        const result = await db.query(
            `SELECT status FROM games 
             WHERE (name_en = $1 OR name_zh = $2 OR name_en = $3) 
             LIMIT 1`,
            [gameType, 'Flip Coin', 'FlipCoin']
        );
        
        if (result.rows.length > 0) {
            return result.rows[0].status === 'enabled';
        }
        
        // 如果 games 表中没有记录，默认允许（向后兼容）
        return true;
    } catch (error) {
        console.error('[GameUtils] Error checking game status:', error);
        // 出错时默认允许（向后兼容）
        return true;
    }
}

module.exports = {
    getGamePayoutMultiplier,
    isGameEnabled
};

