// routes/v1/index.js
// v1 API 路由統一入口

const authRoutes = require('./auth');
const userRoutes = require('./user');
const betRoutes = require('./bet');
const walletRoutes = require('./wallet');
const gameRoutes = require('./game');

/**
 * 註冊所有 v1 API 路由
 * @param {Router} router - Express router 實例
 * @param {Object} passport - Passport 實例
 * @param {Object} options - 額外選項
 */
function v1ApiRouter(router, passport, options = {}) {
    // 註冊各路由模組
    authRoutes(router, passport);
    userRoutes(router, passport);
    betRoutes(router, passport, options);
    walletRoutes(router, passport, options);
    gameRoutes(router);
}

module.exports = v1ApiRouter;

