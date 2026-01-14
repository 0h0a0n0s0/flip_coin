// routes/admin/accounts.js
// 管理員帳號管理相關路由

const db = require('@flipcoin/database');
const bcrypt = require('bcryptjs');
const authMiddleware = require('../../middleware/auth');
const checkPermission = require('../../middleware/checkPermissionMiddleware');
const { recordAuditLog } = require('../../services/auditLogService');
const speakeasy = require('speakeasy');
const { getClientIp } = require('../../utils/ipUtils');
const { sendError, sendSuccess } = require('../../utils/safeResponse');

/**
 * 管理員帳號管理相關路由
 * @param {Router} router - Express router 實例
 */
function accountsRoutes(router) {
    /**
     * @description 獲取後台帳號列表
     * @route GET /api/admin/accounts
     * @access Private (未來應限制為 super_admin)
     */
    router.get('/accounts', authMiddleware, checkPermission('admin_accounts', 'read'), async (req, res) => {
        try {
            // (★★★ Y-6: JOIN admin_roles 获取角色名称，添加谷歌验证状态 ★★★)
            const result = await db.query(`
                SELECT u.id, u.username, u.status, u.created_at, u.role_id, r.name as role_name,
                       CASE WHEN u.google_auth_secret IS NOT NULL THEN true ELSE false END as has_google_auth
                FROM admin_users u
                LEFT JOIN admin_roles r ON u.role_id = r.id
                ORDER BY u.id ASC
            `);
            sendSuccess(res, result.rows);
        } catch (error) { console.error('[Admin Accounts] Error fetching accounts:', error); sendError(res, 500, 'Internal server error'); }
    });
    router.post('/accounts', authMiddleware, checkPermission('admin_accounts', 'cud'), async (req, res) => {
        // (★★★ Y-7: 栏位改为 role_id ★★★)
        const { username, password, role_id, status } = req.body;
        if (!username || !password || !role_id || !status) {
            return sendError(res, 400, 'Username, password, role_id, and status are required.');
        }
        try {
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(password, salt);
            const result = await db.query(
                'INSERT INTO admin_users (username, password_hash, role_id, status) VALUES ($1, $2, $3, $4) RETURNING id, username, role_id, status, created_at',
                [username, password_hash, role_id, status]
            );
            console.log(`[Admin Accounts] Account ${username} created by ${req.user.username}`);
            await recordAuditLog({
                adminId: req.user.id,
                adminUsername: req.user.username,
                action: 'create_admin_account',
                resource: 'admin_users',
                resourceId: result.rows[0].id.toString(),
                description: `新增後台帳號：${username} (角色ID: ${role_id}, 狀態: ${status})`,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent']
            });
            sendSuccess(res, result.rows[0], 201);
        } catch (error) { if (error.code === '23505') { return sendError(res, 409, 'Username already exists.'); } console.error('[Admin Accounts] Error creating account:', error); return sendError(res, 500, 'Internal server error'); }
    });
    router.put('/accounts/:id', authMiddleware, checkPermission('admin_accounts', 'cud'), async (req, res) => {
        const { id } = req.params;
        // (★★★ Y-7: 栏位改为 role_id ★★★)
        const { username, password, role_id, status } = req.body;
        if (!username || !role_id || !status) {
            return sendError(res, 400, 'Username, role_id, and status are required.');
        }
        try {
            let result;
            if (password) {
                const salt = await bcrypt.genSalt(10);
                const password_hash = await bcrypt.hash(password, salt);
                result = await db.query(
                    'UPDATE admin_users SET username = $1, role_id = $2, status = $3, password_hash = $4 WHERE id = $5 RETURNING id, username, role_id, status',
                    [username, role_id, status, password_hash, id]
                );
            } else {
                result = await db.query(
                    'UPDATE admin_users SET username = $1, role_id = $2, status = $3 WHERE id = $4 RETURNING id, username, role_id, status',
                    [username, role_id, status, id]
                );
            }
            if (result.rows.length === 0) { return sendError(res, 404, 'Account not found.'); }
            console.log(`[Admin Accounts] Account ID ${id} updated by ${req.user.username}`);
            await recordAuditLog({
                adminId: req.user.id,
                adminUsername: req.user.username,
                action: 'update_admin_account',
                resource: 'admin_users',
                resourceId: id.toString(),
                description: `更新後台帳號：${username} (角色ID: ${role_id}, 狀態: ${status}${password ? ', 已更新密碼' : ''})`,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent']
            });
            sendSuccess(res, result.rows[0]);
        } catch (error) { if (error.code === '23505') { return sendError(res, 409, 'Username already exists.'); } console.error(`[Admin Accounts] Error updating account ${id}:`, error); return sendError(res, 500, 'Internal server error'); }
    });

    /**
     * @description 刪除後台帐号
     * @route DELETE /api/admin/accounts/:id
     * @access Private
     */
    router.delete('/accounts/:id', authMiddleware, checkPermission('admin_accounts', 'cud'), async (req, res) => {
        const { id } = req.params;
        const currentUserId = req.user.id; // (从 JWT 获取)

        // (安全机制：不允许刪除自己)
        if (parseInt(id, 10) === currentUserId) {
            return sendError(res, 403, 'Cannot delete your own account.');
        }
        // (安全机制：不允许刪除 ID=1 的 super_admin 帐号)
        if (parseInt(id, 10) === 1) {
             return sendError(res, 403, 'Cannot delete the primary super admin account.');
        }

        try {
            const result = await db.query('DELETE FROM admin_users WHERE id = $1 RETURNING id, username', [id]);
            if (result.rows.length === 0) {
                return sendError(res, 404, 'Account not found.');
            }
            console.log(`[Admin Accounts] Account ID ${id} deleted by ${req.user.username}`);
            await recordAuditLog({
                adminId: req.user.id,
                adminUsername: req.user.username,
                action: 'delete_admin_account',
                resource: 'admin_users',
                resourceId: id.toString(),
                description: `刪除後台帳號：${result.rows[0].username || id}`,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent']
            });
            res.status(204).send(); // No Content
        } catch (error) {
            console.error(`[Admin Accounts] Error deleting account ${id}:`, error);
            sendError(res, 500, 'Internal server error');
        }
    });

    router.get('/ip-whitelist', authMiddleware, checkPermission('admin_ip_whitelist', 'read'), async (req, res) => {
        try {
            const result = await db.query('SELECT id, ip_range::text, description, created_at FROM admin_ip_whitelist ORDER BY created_at DESC');
            sendSuccess(res, result.rows);
        } catch (error) { 
            console.error('[Admin IP Whitelist] Error fetching list:', error);
            sendError(res, 500, 'Internal server error'); 
        }
    });

    router.post('/ip-whitelist', authMiddleware, checkPermission('admin_ip_whitelist', 'cud'), async (req, res) => {
        const { ip_range, description } = req.body;
        if (!ip_range) {
            return sendError(res, 400, 'IP range (CIDR format) is required.');
        }
        try {
            const result = await db.query(
                'INSERT INTO admin_ip_whitelist (ip_range, description) VALUES ($1, $2) RETURNING id, ip_range::text, description, created_at', 
                [ip_range, description || null]
            );
            await recordAuditLog({
                adminId: req.user.id,
                adminUsername: req.user.username,
                action: 'add_ip_whitelist',
                resource: 'admin_ip_whitelist',
                resourceId: result.rows[0].id.toString(),
                description: `新增IP白名單：${ip_range}${description ? ` (${description})` : ''}`,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent']
            });
            sendSuccess(res, result.rows[0], 201);
        } catch (error) { 
            if (error.code === '23505') { return sendError(res, 409, 'IP range already exists.'); }
            if (error.code === '22P02') { return sendError(res, 400, 'Invalid IP range format (use CIDR).'); }
            console.error('[Admin IP Whitelist] Error adding IP:', error);
            sendError(res, 500, 'Internal server error'); 
        }
    });

    router.delete('/ip-whitelist/:id', authMiddleware, checkPermission('admin_ip_whitelist', 'cud'), async (req, res) => {
        const { id } = req.params;
        try {
            const result = await db.query('DELETE FROM admin_ip_whitelist WHERE id = $1 RETURNING id', [id]);
            if (result.rows.length === 0) {
                return sendError(res, 404, 'IP rule not found.');
            }
            await recordAuditLog({
                adminId: req.user.id,
                adminUsername: req.user.username,
                action: 'delete_ip_whitelist',
                resource: 'admin_ip_whitelist',
                resourceId: id.toString(),
                description: `刪除IP白名單：${id}`,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent']
            });
            res.status(204).send();
        } catch (error) { 
            console.error(`[Admin IP Whitelist] Error deleting IP ${id}:`, error);
            sendError(res, 500, 'Internal server error'); 
        }
    });

    /**
     * @description 管理員解綁其他帳號的谷歌驗證（需要操作者的谷歌驗證碼）
     * @route POST /api/admin/accounts/:id/unbind-google-auth
     * @access Private (需要 Token 和權限)
     */
    router.post('/accounts/:id/unbind-google-auth', authMiddleware, checkPermission('admin_accounts', 'cud'), async (req, res) => {
        try {
            const targetUserId = parseInt(req.params.id);
            const { googleAuthCode } = req.body;
            const operatorId = req.user.id; // 操作者ID
            
            if (!googleAuthCode) {
                return sendError(res, 400, 'Google Authenticator code is required.');
            }
            
            // 1. 獲取操作者的谷歌驗證密鑰（驗證操作者的身份）
            const operatorResult = await db.query(
                'SELECT google_auth_secret FROM admin_users WHERE id = $1',
                [operatorId]
            );
            
            if (operatorResult.rows.length === 0) {
                return sendError(res, 404, 'Operator not found');
            }
            
            const operatorSecret = operatorResult.rows[0].google_auth_secret;
            
            // 必須驗證操作者的谷歌驗證碼
            if (!operatorSecret) {
                return sendError(res, 400, 'You must have Google Authenticator bound to perform this operation.');
            }
            
            const verified = speakeasy.totp.verify({
                secret: operatorSecret,
                encoding: 'base32',
                token: googleAuthCode,
                window: 2
            });
            
            if (!verified) {
                return sendError(res, 401, 'Invalid Google Authenticator code.');
            }
            
            // 2. 檢查目標帳號是否存在且已綁定谷歌驗證
            const targetResult = await db.query(
                'SELECT id, username, google_auth_secret FROM admin_users WHERE id = $1',
                [targetUserId]
            );
            
            if (targetResult.rows.length === 0) {
                return sendError(res, 404, 'Target account not found');
            }
            
            const targetUser = targetResult.rows[0];
            
            if (!targetUser.google_auth_secret) {
                return sendError(res, 400, 'Target account does not have Google Authenticator bound');
            }
            
            // 3. 解綁目標帳號的谷歌驗證
            await db.query(
                'UPDATE admin_users SET google_auth_secret = NULL WHERE id = $1',
                [targetUserId]
            );
            
            // 4. 記錄審計日誌
            try {
                await recordAuditLog({
                    adminId: operatorId,
                    adminUsername: req.user.username,
                    action: 'unbind_google_auth',
                    resource: 'admin_google_auth',
                    resourceId: targetUserId.toString(),
                    description: `解綁 Google Authenticator：${targetUser.username}`,
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent']
                });
            } catch (auditError) {
                console.error('[Admin Accounts] Error recording audit log:', auditError);
                // 不阻擋操作，僅記錄錯誤
            }
            
            sendSuccess(res, { message: 'Google Authenticator unbound successfully.' });
        } catch (error) {
            console.error('[Admin Accounts] Error unbinding Google Authenticator:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

}

module.exports = accountsRoutes;
