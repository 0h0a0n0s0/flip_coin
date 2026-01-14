// routes/admin/auth.js
// 管理員認證相關路由（登入、個人資料、Google Authenticator）

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../../middleware/auth');
const { recordAuditLog } = require('../../services/auditLogService');
const { maskAddress, maskTxHash } = require('../../utils/maskUtils');
const { getClientIp } = require('../../utils/ipUtils');
const { sendError, sendSuccess } = require('../../utils/safeResponse');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const AdminService = require('../../services/AdminService');

/**
 * 認證相關路由
 * @param {Router} router - Express router 實例
 */
function authRoutes(router) {
    /**
     * @description 後台管理員登入
     * @route POST /api/admin/login
     */
    router.post('/login', async (req, res) => {
        const { username, password, googleAuthCode } = req.body;
        if (!username || !password) {
            return sendError(res, 400, 'Username and password are required.');
        }
        try {
            // 1. 查找用戶 (包含 role 和 status)
            const user = await AdminService.getAdminByUsername(username);

            if (!user) {
                return sendError(res, 401, 'Invalid credentials.');
            }

            // 2. 驗證密碼
            const isMatch = await AdminService.verifyAdminPassword(user, password);
            if (!isMatch) {
                return sendError(res, 401, 'Invalid credentials.');
            }

            // 檢查帳號狀態
            if (user.status !== 'active') {
                return sendError(res, 403, 'Account is disabled.');
            }

            // 驗證谷歌驗證碼
            if (user.google_auth_secret) {
                // 如果帳號已綁定谷歌驗證，必須提供驗證碼
                if (!googleAuthCode) {
                    return sendError(res, 400, 'Google Authenticator code is required.', { requiresGoogleAuth: true });
                }
                
                // 驗證谷歌驗證碼
                const verified = speakeasy.totp.verify({
                    secret: user.google_auth_secret,
                    encoding: 'base32',
                    token: googleAuthCode,
                    window: 2 // 允許前後2個時間窗口的誤差
                });
                
                if (!verified) {
                    return sendError(res, 401, 'Invalid Google Authenticator code.', { requiresGoogleAuth: true });
                }
            }
            // 如果帳號未綁定谷歌驗證，googleAuthCode可以留空，不做驗證

            // 記錄登錄IP
            try {
                const clientIp = getClientIp(req);
                if (clientIp) {
                    await AdminService.updateAdminLastLoginIp(user.id, clientIp);
                    console.log(`[Admin Login] User ${user.username} (ID: ${user.id}) logged in from IP: ${clientIp}`);
                }
            } catch (ipError) {
                console.error('[Admin Login] Failed to record login IP:', ipError.message);
                // 不阻擋登錄，僅記錄錯誤
            }

            // 3. 簽發 JWT（包含 role）
            const token = jwt.sign(
                { 
                    id: user.id, 
                    username: user.username,
                    role_id: user.role_id // (將角色 寫入 Token)
                },
                process.env.JWT_SECRET,
                { expiresIn: '8h' } 
            );
            return sendSuccess(res, { message: 'Login successful', token: token });
        } catch (error) {
            console.error('[Admin Login] Error:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 獲取當前登入用戶的所有權限 (用於前端 UI 顯示/隱藏)
     * @route GET /api/admin/my-permissions
     */
    router.get('/my-permissions', authMiddleware, async (req, res) => {
        if (!req.user || !req.user.role_id) {
            console.warn(`[RBAC] Denied /my-permissions: User object or role_id not found in request.`);
            return sendError(res, 403, 'Forbidden: User role not found (old token?).');
        }
        const { role_id } = req.user;
        try {
            const permissionsMap = await AdminService.getAdminPermissions(role_id);
            return sendSuccess(res, permissionsMap);
        } catch (error) {
            console.error(`[RBAC] Error fetching permissions for RoleID ${role_id}:`, error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 獲取當前用戶個人資料
     * @route GET /api/admin/profile
     * @access Private (需要 Token)
     */
    router.get('/profile', authMiddleware, async (req, res) => {
        try {
            const userId = req.user.id;
            const user = await AdminService.getAdminProfile(userId);
            
            if (!user) {
                return sendError(res, 404, 'User not found');
            }
            
            sendSuccess(res, {id: user.id,
                username: user.username,
                nickname: user.nickname || '',
                hasGoogleAuth: !!user.google_auth_secret});
        } catch (error) {
            console.error('[Profile] Error fetching profile:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 更新當前用戶個人資料（暱稱和密碼）
     * @route PUT /api/admin/profile
     * @access Private (需要 Token)
     */
    router.put('/profile', authMiddleware, async (req, res) => {
        try {
            const userId = req.user.id;
            const { nickname, password } = req.body;
            
            // 構建更新字段
            const updates = [];
            const params = [];
            let paramIndex = 1;
            
            // 更新暱稱
            if (nickname !== undefined) {
                updates.push(`nickname = $${paramIndex++}`);
                params.push(nickname || '');
            }
            
            // 更新密碼（如果提供了新密碼）
            if (password && password.trim() !== '') {
                const passwordHash = await bcrypt.hash(password, 10);
                updates.push(`password_hash = $${paramIndex++}`);
                params.push(passwordHash);
            }
            
            if (updates.length === 0) {
                return sendError(res, 400, 'No fields to update');
            }
            
            // 添加WHERE條件的參數
            params.push(userId);
            
            const result = await AdminService.updateAdminProfile(userId, updates, params);
            
            if (!result) {
                return sendError(res, 404, 'User not found');
            }
            
            // 記錄審計日誌
            try {
                await recordAuditLog({
                    adminId: userId,
                    action: 'update',
                    resource: 'admin_profile',
                    resourceId: userId.toString(),
                    details: { fields: updates },
                    ipAddress: getClientIp(req)
                });
            } catch (auditError) {
                console.warn('[Profile] Failed to record audit log:', auditError);
            }
            
            sendSuccess(res, {
                message: 'Profile updated successfully',
                user: {
                    id: result.id,
                    username: result.username,
                    nickname: result.nickname || ''
                }
            });
        } catch (error) {
            console.error('[Profile] Error updating profile:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 獲取谷歌驗證設置（生成二維碼）
     * @route GET /api/admin/google-auth/setup
     * @access Private (需要 Token)
     */
    router.get('/google-auth/setup', authMiddleware, async (req, res) => {
        try {
            const userId = req.user.id;
            
            // 先檢查用戶是否存在
            const user = await AdminService.getAdminProfile(userId);
            if (!user) {
                return sendError(res, 404, 'User not found');
            }
            
            // 檢查是否已經綁定
            const googleAuthSecret = await AdminService.checkAdminGoogleAuthBound(userId);
            if (googleAuthSecret) {
                return sendError(res, 400, 'Google Authenticator is already bound');
            }
            
            // 獲取用戶暱稱，如果沒有暱稱則使用用戶名
            const userInfo = await AdminService.getAdminUserInfo(userId);
            const displayName = userInfo?.nickname || userInfo?.username || req.user.username;
            
            // 獲取平台名稱
            const platformName = await AdminService.getPlatformName();
            
            // 生成新的密鑰
            const secret = speakeasy.generateSecret({
                name: `${platformName} Admin (${displayName})`,
                issuer: platformName
            });
            
            // 生成二維碼
            const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
            
            // 臨時存儲密鑰（在綁定驗證前不保存到數據庫）
            // 這裡我們返回secret.base32，前端在綁定時會發送回來
            sendSuccess(res, {secret: secret.base32,
                qrCode: qrCodeUrl});
        } catch (error) {
            console.error('[Google Auth] Error generating setup:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 綁定谷歌驗證
     * @route POST /api/admin/google-auth/bind
     * @access Private (需要 Token)
     */
    router.post('/google-auth/bind', authMiddleware, async (req, res) => {
        try {
            const userId = req.user.id;
            const { secret, code } = req.body;
            
            if (!secret || !code) {
                return sendError(res, 400, 'Secret and code are required');
            }
            
            // 驗證驗證碼
            const verified = speakeasy.totp.verify({
                secret: secret,
                encoding: 'base32',
                token: code,
                window: 2 // 允許前後2個時間窗口的誤差
            });
            
            if (!verified) {
                return sendError(res, 400, 'Invalid verification code');
            }
            
            // 保存密鑰到數據庫
            await AdminService.updateAdminGoogleAuthSecret(userId, secret);
            
            // 記錄審計日誌
            try {
                await recordAuditLog({
                    adminId: userId,
                    action: 'create',
                    resource: 'admin_google_auth',
                    resourceId: userId.toString(),
                    details: { action: 'bind' },
                    ipAddress: getClientIp(req)
                });
            } catch (auditError) {
                console.warn('[Google Auth] Failed to record audit log:', auditError);
            }
            
            sendSuccess(res, { message: 'Google Authenticator bound successfully' });
        } catch (error) {
            console.error('[Google Auth] Error binding:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 解綁谷歌驗證（用戶自己解綁）
     * @route POST /api/admin/google-auth/unbind
     * @access Private (需要 Token)
     */
    router.post('/google-auth/unbind', authMiddleware, async (req, res) => {
        try {
            const userId = req.user.id;
            const { code } = req.body;
            
            if (!code) {
                return sendError(res, 400, 'Verification code is required');
            }
            
            // 先檢查用戶是否存在
            const user = await AdminService.getAdminProfile(userId);
            if (!user) {
                return sendError(res, 404, 'User not found');
            }
            
            // 獲取用戶的密鑰
            const secret = await AdminService.getAdminGoogleAuthSecret(userId);
            
            if (!secret) {
                return sendError(res, 400, 'Google Authenticator is not bound');
            }
            
            // 驗證驗證碼
            const verified = speakeasy.totp.verify({
                secret: secret,
                encoding: 'base32',
                token: code,
                window: 2
            });
            
            if (!verified) {
                return sendError(res, 400, 'Invalid verification code');
            }
            
            // 清除密鑰
            await AdminService.clearAdminGoogleAuthSecret(userId);
            
            // 記錄審計日誌
            try {
                await recordAuditLog({
                    adminId: userId,
                    action: 'delete',
                    resource: 'admin_google_auth',
                    resourceId: userId.toString(),
                    details: { action: 'unbind' },
                    ipAddress: getClientIp(req)
                });
            } catch (auditError) {
                console.warn('[Google Auth] Failed to record audit log:', auditError);
            }
            
            sendSuccess(res, { message: 'Google Authenticator unbound successfully' });
        } catch (error) {
            console.error('[Google Auth] Error unbinding:', error);
            sendError(res, 500, 'Internal server error');
        }
    });
}

module.exports = authRoutes;

