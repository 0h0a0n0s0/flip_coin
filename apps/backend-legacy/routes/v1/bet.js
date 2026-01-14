// routes/v1/bet.js
// 投注相關路由

const { sendError, sendSuccess } = require('../../utils/safeResponse');
const userService = require('../../services/UserService');

/**
 * 投注相關路由
 * @param {Router} router - Express router 實例
 * @param {Object} passport - Passport 實例
 * @param {Object} options - 額外選項
 * @param {Object} options.betQueueService - BetQueueService 實例
 */
function betRoutes(router, passport, options = {}) {
    const { betQueueService } = options;

    // GET /api/v1/history - 獲取投注歷史
    router.get('/api/v1/history', passport.authenticate('jwt', { session: false }), async (req, res) => {
        try {
            const history = await userService.getUserBetHistory(req.user.user_id);
            return sendSuccess(res, history);
        } catch (error) {
            console.error('Error fetching history:', error);
            return sendError(res, 500, '服务器内部错误。');
        }
    });

    // POST /api/v1/bets - 提交投注
    router.post('/api/v1/bets', passport.authenticate('jwt', { session: false }), async (req, res) => {
        const { choice, amount, gameMode = 'normal' } = req.body;
        const user = req.user; 
        if (choice !== 'head' && choice !== 'tail') {
            return sendError(res, 400, '投注选项无效。');
        }
        const betAmount = parseFloat(amount);
        if (isNaN(betAmount) || betAmount <= 0) {
             return sendError(res, 400, '投注金额无效。');
        }
        
        // 验证 gameMode
        if (gameMode !== 'normal' && gameMode !== 'streak') {
            return sendError(res, 400, '游戏模式无效。');
        }
        
        // 检查游戏是否开启
        const { isGameEnabled } = require('../../utils/gameUtils.js');
        const gameEnabled = await isGameEnabled('FlipCoin');
        if (!gameEnabled) {
            return sendError(res, 403, '游戏尚未开放，敬请期待！');
        }
        
        if (!betQueueService) {
             return sendError(res, 503, '投注服务暂未就绪，请稍后重试。');
        }
        try {
            // 获取投注IP并传递
            const { getClientIp } = require('../../utils/ipUtils');
            const betIp = getClientIp(req);
            const settledBet = await betQueueService.addBetToQueue(user, choice, betAmount, betIp, gameMode);
            return sendSuccess(res, settledBet);
        } catch (error) {
            console.error(`[v7 API] Bet failed for user ${user.user_id}:`, error.message);
            return sendError(res, 400, error.message || '下注失败。');
        }
    });

    // GET /api/v1/leaderboard - 獲取排行榜
    router.get('/api/v1/leaderboard', async (req, res) => {
        try {
            const leaderboard = await userService.getLeaderboard(10);
            return sendSuccess(res, leaderboard);
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            return sendError(res, 500, '服务器内部错误，无法获取排行榜数据。');
        }
    });
}

module.exports = betRoutes;

