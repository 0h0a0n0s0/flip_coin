// routes/admin/index.js
// 管理員 API 路由統一入口

const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const dashboardRoutes = require('./dashboard');
const usersRoutes = require('./users');
const betsRoutes = require('./bets');
const walletsRoutes = require('./wallets');
const settingsRoutes = require('./settings');
const accountsRoutes = require('./accounts');
const permissionsRoutes = require('./permissions');
const transactionsRoutes = require('./transactions');

// 用於存儲 io 和 connectedUsers
let io = null;
let connectedUsers = null;

/**
 * 設置 io 和 connectedUsers（從 server.js 調用）
 * @param {Object} socketIO - Socket.IO 實例
 * @param {Object} users - 連接用戶映射
 */
router.setIoAndConnectedUsers = (socketIO, users) => {
    io = socketIO;
    connectedUsers = users;
    
    // 將 io 和 connectedUsers 傳遞給需要它們的模組
    if (dashboardRoutes.setIoAndConnectedUsers) {
        dashboardRoutes.setIoAndConnectedUsers(socketIO, users);
    }
};

/**
 * 註冊所有管理員 API 路由
 */
function registerAdminRoutes() {
    // 註冊各路由模組
    authRoutes(router);
    dashboardRoutes(router);
    usersRoutes(router);
    betsRoutes(router);
    walletsRoutes(router);
    settingsRoutes(router);
    accountsRoutes(router);
    permissionsRoutes(router);
    transactionsRoutes(router);
}

// 立即註冊路由
registerAdminRoutes();

module.exports = router;

