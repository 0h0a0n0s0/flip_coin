// routes/v1/auth.js
// 認證相關路由（註冊、登入）

const jwt = require('jsonwebtoken');
const { sendError, sendSuccess } = require('../../utils/safeResponse');
const { registerRateLimiter, loginRateLimiter } = require('../../middleware/rateLimiter');
const { validateRegisterInput, validateLoginInput } = require('../../validators/authValidators');
const { enforceSameIpRiskControl } = require('../../services/riskControlService');
const UserService = require('../../services/UserService');

/**
 * 認證相關路由
 * @param {Router} router - Express router 實例
 * @param {Object} passport - Passport 實例
 */
function authRoutes(router, passport) {
    // POST /api/v1/register - 用戶註冊
    router.post('/api/v1/register', registerRateLimiter, validateRegisterInput, (req, res, next) => {
        passport.authenticate('local-signup', { session: false }, async (err, user, info) => {
            if (err) return next(err);
            if (!user) return sendError(res, 400, info.message || '注册失败。');
            
            // 註冊後自動登入時記錄首次登錄信息
            try {
                const { getClientIp, extractDeviceId, getCountryFromIp } = require('../../utils/ipUtils');
                const clientIp = getClientIp(req);
                const userAgent = req.headers['user-agent'] || null;
                const deviceId = extractDeviceId(req);
                const country = await getCountryFromIp(clientIp);
                
                // 註冊後自動登入，記錄首次登錄信息
                await UserService.updateFirstLoginInfo(user.id, clientIp, country, userAgent, deviceId);
                
                // 記錄登錄日誌
                await UserService.insertUserLoginLog(user.user_id, clientIp, country, deviceId, userAgent);
                
            } catch (error) {
                console.error('[Register] Failed to record auto-login info:', error);
                // 不阻擋註冊流程，僅記錄錯誤
            }
            
            const payload = { id: user.id, username: user.username };
            const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
            delete user.password_hash;
            return sendSuccess(res, { user, token }, 201);
        })(req, res, next);
    });

    // POST /api/v1/login - 用戶登入
    router.post('/api/v1/login', loginRateLimiter, validateLoginInput, (req, res, next) => {
        passport.authenticate('local-login', { session: false }, async (err, user, info) => {
            if (err) return next(err);
            if (!user) return sendError(res, 401, info.message || '登录失败。');
            
            // 記錄登錄信息，包括首次登錄和登錄日誌
            try {
                const { getClientIp, extractDeviceId, getCountryFromIp } = require('../../utils/ipUtils');
                const clientIp = getClientIp(req);
                const userAgent = req.headers['user-agent'] || null;
                const deviceId = extractDeviceId(req);
                const country = await getCountryFromIp(clientIp);
                
                // 检查是否是首次登录
                const isFirstLogin = await UserService.checkIsFirstLogin(user.id);
                
                if (isFirstLogin) {
                    // 首次登录，记录首次登录信息
                    await UserService.updateFirstLoginInfo(user.id, clientIp, country, userAgent, deviceId);
                } else {
                    // 非首次登录，只更新最后登录信息
                    await UserService.updateLastLoginInfo(user.id, clientIp, userAgent, deviceId);
                }
                
                // 记录登录日志
                await UserService.insertUserLoginLog(user.user_id, clientIp, country, deviceId, userAgent);

                const riskResult = await enforceSameIpRiskControl(clientIp);
                if (riskResult.triggered && riskResult.affectedUsers.includes(user.user_id)) {
                    console.warn(`[RiskControl] Login blocked due to same IP rule. IP: ${clientIp}, Users: ${riskResult.affectedUsers.join(',')}`);
                    return sendError(res, 403, '该 IP 触发风控，账户已暂时封锁。');
                }
            } catch (error) {
                console.error('[Login] Failed to update user login info:', error);
            }
            
            const payload = { id: user.id, username: user.username };
            const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
            delete user.password_hash;
            return sendSuccess(res, { user, token });
        })(req, res, next);
    });
}

module.exports = authRoutes;

