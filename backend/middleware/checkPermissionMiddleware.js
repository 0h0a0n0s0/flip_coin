// 档案: backend/middleware/checkPermissionMiddleware.js (★★★ v7.3 动态 RBAC 版 ★★★)

const db = require('../db');

/**
 * 动态权限检查中间件 (RBAC)
 * @param {string} resource - (例如 'users', 'bets', 'settings_game')
 * @param {string} action - (例如 'read', 'update', 'cud')
 */
const checkPermission = (resource, action) => {
    return async (req, res, next) => {
        // 1. 检查 req.user.role_id 是否存在 (由 authMiddleware 附加)
        if (!req.user || !req.user.role_id) {
            console.warn(`[RBAC] Denied: User object or role_id not found in request.`);
            return res.status(403).json({ error: 'Forbidden: User role not found.' });
        }

        const { role_id, username } = req.user;
        const requiredPermission = `${resource}:${action}`;

        try {
            // 2. 查询此 role_id 是否拥有指定的 permission
            const query = `
                SELECT 1
                FROM admin_role_permissions arp
                JOIN admin_permissions ap ON arp.permission_id = ap.id
                WHERE arp.role_id = $1
                  AND ap.resource = $2
                  AND ap.action = $3
                LIMIT 1;
            `;
            
            const result = await db.query(query, [role_id, resource, action]);

            // 3. 检查结果
            if (result.rows.length > 0) {
                // 权限足够，放行
                next();
            } else {
                // 权限不足，阻挡
                console.warn(`[RBAC] Denied: User ${username} (RoleID: ${role_id}) tried to access ${requiredPermission}.`);
                return res.status(403).json({ error: 'Forbidden: You do not have permission for this resource.' });
            }
        } catch (error) {
            console.error(`[RBAC] Error checking permission ${requiredPermission} for RoleID ${role_id}:`, error);
            return res.status(500).json({ error: 'Internal server error during permission check.' });
        }
    };
};

module.exports = checkPermission;