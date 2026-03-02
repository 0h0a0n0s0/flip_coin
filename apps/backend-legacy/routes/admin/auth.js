// routes/admin/auth.js
// 管理員認證相關路由（登入、個人資料、Google Authenticator）

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../../middleware/auth');
const { recordAuditLog } = require('../../services/auditLogService');
const { maskAddress, maskTxHash, maskIP, maskUserId } = require('../../utils/maskUtils');
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
        const clientIp = getClientIp(req);
        
        if (!username || !password) {
            return sendError(res, 400, '用户名和密码不能为空');
        }
        try {
            // 1. 查找用戶 (包含 role 和 status)
            const user = await AdminService.getAdminByUsername(username);

            if (!user) {
                // 記錄：用戶不存在（可能是掃描攻擊）
                console.warn(`[Admin Login] ⚠️ Failed login attempt - User not found: ${username} from IP: ${maskIP(clientIp)}`);
                try {
                    await recordAuditLog({
                        adminId: null,
                        action: 'login_failed',
                        resource: 'admin_auth',
                        resourceId: username,
                        details: { reason: 'user_not_found', username },
                        ipAddress: clientIp
                    });
                } catch (logError) {
                    console.error('[Admin Login] Failed to record audit log:', logError.message);
                }
                return sendError(res, 401, '用户名或密码错误');
            }

            // 2. 驗證密碼
            const isMatch = await AdminService.verifyAdminPassword(user, password);
            if (!isMatch) {
                // 記錄：密碼錯誤
                console.warn(`[Admin Login] ⚠️ Failed login attempt - Invalid password for user: ${user.username} (ID: ${maskUserId(user.id.toString())}) from IP: ${maskIP(clientIp)}`);
                try {
                    await recordAuditLog({
                        adminId: user.id,
                        action: 'login_failed',
                        resource: 'admin_auth',
                        resourceId: user.id.toString(),
                        details: { reason: 'invalid_password', username: user.username },
                        ipAddress: clientIp
                    });
                } catch (logError) {
                    console.error('[Admin Login] Failed to record audit log:', logError.message);
                }
                return sendError(res, 401, '用户名或密码错误');
            }

            // 檢查帳號狀態
            if (user.status !== 'active') {
                return sendError(res, 403, '账号已被禁用');
            }

            // 驗證谷歌驗證碼（檢查是否有加密的密鑰）
            if (user.encrypted_google_auth_secret) {
                // 如果帳號已綁定谷歌驗證，必須提供驗證碼
                if (!googleAuthCode) {
                    return sendError(res, 400, '请输入谷歌验证码', { requiresGoogleAuth: true });
                }
                
                // 解密密鑰並驗證
                try {
                    const decryptedSecret = await AdminService.getAdminGoogleAuthSecret(user.id);
                    if (!decryptedSecret) {
                        console.error(`[Admin Login] Failed to decrypt 2FA secret for user ${user.username}`);
                        return sendError(res, 500, '认证系统错误');
                    }
                    
                    // 驗證谷歌驗證碼（window: 1 = 前後各30秒，總共90秒有效期）
                    const verified = speakeasy.totp.verify({
                        secret: decryptedSecret,
                        encoding: 'base32',
                        token: googleAuthCode,
                        window: 1 // 允許前後1個時間窗口（30秒），總共90秒有效
                    });
                    
                    if (!verified) {
                        // 記錄：2FA 驗證碼錯誤
                        console.warn(`[Admin Login] ⚠️ Failed login attempt - Invalid 2FA code for user: ${user.username} (ID: ${maskUserId(user.id.toString())}) from IP: ${maskIP(clientIp)}`);
                        try {
                            await recordAuditLog({
                                adminId: user.id,
                                action: 'login_failed',
                                resource: 'admin_auth',
                                resourceId: user.id.toString(),
                                details: { reason: 'invalid_2fa_code', username: user.username },
                                ipAddress: clientIp
                            });
                        } catch (logError) {
                            console.error('[Admin Login] Failed to record audit log:', logError.message);
                        }
                        return sendError(res, 401, '谷歌验证码错误或已过期', { requiresGoogleAuth: true });
                    }
                } catch (decryptError) {
                    console.error(`[Admin Login] 2FA decryption error for user ${user.username}:`, decryptError.message);
                    return sendError(res, 500, '认证系统错误');
                }
            }
            // 如果帳號未綁定谷歌驗證，googleAuthCode可以留空，不做驗證

            // 記錄成功登入
            try {
                if (clientIp) {
                    await AdminService.updateAdminLastLoginIp(user.id, clientIp);
                    console.log(`[Admin Login] ✅ User ${user.username} (ID: ${user.id}) logged in successfully from IP: ${maskIP(clientIp)}`);
                    
                    // 記錄審計日誌
                    await recordAuditLog({
                        adminId: user.id,
                        action: 'login_success',
                        resource: 'admin_auth',
                        resourceId: user.id.toString(),
                        details: { username: user.username },
                        ipAddress: clientIp
                    });
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
            return sendSuccess(res, { message: '登录成功', token: token });
        } catch (error) {
            console.error('[Admin Login] Error:', error);
            sendError(res, 500, '服务器内部错误');
        }
    });

    /**
     * @description 獲取當前登入用戶的所有權限 (用於前端 UI 顯示/隱藏)
     * @route GET /api/admin/my-permissions
     */
    router.get('/my-permissions', authMiddleware, async (req, res) => {
        if (!req.user || !req.user.role_id) {
            console.warn(`[RBAC] Denied /my-permissions: User object or role_id not found in request.`);
            return sendError(res, 403, '禁止访问：未找到用户角色（令牌过期？）');
        }
        const { role_id } = req.user;
        try {
            const permissionsMap = await AdminService.getAdminPermissions(role_id);
            return sendSuccess(res, permissionsMap);
        } catch (error) {
            console.error(`[RBAC] Error fetching permissions for RoleID ${role_id}:`, error);
            sendError(res, 500, '服务器内部错误');
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
                return sendError(res, 404, '用户不存在');
            }
            
            sendSuccess(res, {id: user.id,
                username: user.username,
                nickname: user.nickname || '',
                hasGoogleAuth: !!user.encrypted_google_auth_secret});
        } catch (error) {
            console.error('[Profile] Error fetching profile:', error);
            sendError(res, 500, '服务器内部错误');
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
                return sendError(res, 400, '没有需要更新的字段');
            }
            
            // 添加WHERE條件的參數
            params.push(userId);
            
            const result = await AdminService.updateAdminProfile(userId, updates, params);
            
            if (!result) {
                return sendError(res, 404, '用户不存在');
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
                message: '个人资料更新成功',
                user: {
                    id: result.id,
                    username: result.username,
                    nickname: result.nickname || ''
                }
            });
        } catch (error) {
            console.error('[Profile] Error updating profile:', error);
            sendError(res, 500, '服务器内部错误');
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
                return sendError(res, 404, '用户不存在');
            }
            
            // 檢查是否已經綁定
            const isAlreadyBound = await AdminService.checkAdminGoogleAuthBound(userId);
            if (isAlreadyBound) {
                return sendError(res, 400, '谷歌验证器已绑定');
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
            sendError(res, 500, '服务器内部错误');
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
                return sendError(res, 400, '密钥和验证码不能为空');
            }
            
            // 驗證驗證碼
            const verified = speakeasy.totp.verify({
                secret: secret,
                encoding: 'base32',
                token: code,
                window: 2 // 允許前後2個時間窗口的誤差
            });
            
            if (!verified) {
                return sendError(res, 400, '验证码错误');
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
            
            sendSuccess(res, { message: '谷歌验证器绑定成功' });
        } catch (error) {
            console.error('[Google Auth] Error binding:', error);
            sendError(res, 500, '服务器内部错误');
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
                return sendError(res, 400, '请输入验证码');
            }
            
            // 先檢查用戶是否存在
            const user = await AdminService.getAdminProfile(userId);
            if (!user) {
                return sendError(res, 404, '用户不存在');
            }
            
            // 獲取用戶的密鑰
            const secret = await AdminService.getAdminGoogleAuthSecret(userId);
            
            if (!secret) {
                return sendError(res, 400, '谷歌验证器未绑定');
            }
            
            // 驗證驗證碼
            const verified = speakeasy.totp.verify({
                secret: secret,
                encoding: 'base32',
                token: code,
                window: 2
            });
            
            if (!verified) {
                return sendError(res, 400, '验证码错误');
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
            
            sendSuccess(res, { message: '谷歌验证器解绑成功' });
        } catch (error) {
            console.error('[Google Auth] Error unbinding:', error);
            sendError(res, 500, '服务器内部错误');
        }
    });
}

module.exports = authRoutes;

