// routes/v1/game.js
// 遊戲相關路由

const { sendError, sendSuccess } = require('../../utils/safeResponse');
const gameService = require('../../services/GameService');

/**
 * 遊戲相關路由
 * @param {Router} router - Express router 實例
 */
function gameRoutes(router) {
    // GET /api/v1/games - 獲取遊戲列表
    router.get('/api/v1/games', async (req, res) => {
        try {
            const { status = 'enabled' } = req.query;
            const games = await gameService.getEnabledGames(status);
            return sendSuccess(res, games);
        } catch (error) {
            console.error('[API v1] Error fetching games:', error);
            return sendError(res, 500, '获取游戏列表失败。');
        }
    });

    // GET /api/v1/platform-name - 獲取平台名稱
    router.get('/api/v1/platform-name', async (req, res) => {
        try {
            const platformName = await gameService.getPlatformName();
            return sendSuccess(res, {
                platform_name: platformName
            });
        } catch (error) {
            console.error('[API v1] Error fetching platform name:', error);
            return sendSuccess(res, {
                platform_name: 'FlipCoin' // 默认值
            });
        }
    });
}

module.exports = gameRoutes;

