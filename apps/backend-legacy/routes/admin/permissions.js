// routes/admin/permissions.js
// 權限管理相關路由

const db = require('@flipcoin/database');
const authMiddleware = require('../../middleware/auth');
const checkPermission = require('../../middleware/checkPermissionMiddleware');
const { recordAuditLog } = require('../../services/auditLogService');
const { getClientIp } = require('../../utils/ipUtils');
const { sendError, sendSuccess } = require('../../utils/safeResponse');

/**
 * 權限管理相關路由
 * @param {Router} router - Express router 實例
 */
function permissionsRoutes(router) {
    router.get('/roles', authMiddleware, checkPermission('admin_permissions', 'read'), async (req, res) => {
        try {
            const result = await db.query('SELECT * FROM admin_roles ORDER BY id ASC');
            sendSuccess(res, result.rows);
        } catch (error) {
            console.error('[Admin RBAC] Error fetching roles:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 获取所有可用的权限 (Permissions) 列表 (用于前端渲染)
     * @route GET /api/admin/permissions
     */
    router.get('/permissions', authMiddleware, checkPermission('admin_permissions', 'read'), async (req, res) => {
        try {
            const result = await db.query('SELECT * FROM admin_permissions ORDER BY category, resource, action');
            // (按 category 分组，方便前端渲染)
            const permissionsByCategory = result.rows.reduce((acc, perm) => {
                if (!acc[perm.category]) {
                    acc[perm.category] = [];
                }
                acc[perm.category].push(perm);
                return acc;
            }, {});
            return sendSuccess(res, permissionsByCategory);
        } catch (error) {
            console.error('[Admin RBAC] Error fetching permissions:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 获取单一权限组及其拥有的权限 ID
     * @route GET /api/admin/roles/:id
     */
    router.get('/roles/:id', authMiddleware, checkPermission('admin_permissions', 'read'), async (req, res) => {
        const { id } = req.params;
        try {
            const roleResult = await db.query('SELECT * FROM admin_roles WHERE id = $1', [id]);
            if (roleResult.rows.length === 0) {
                return sendError(res, 404, 'Role not found.');
            }
            const role = roleResult.rows[0];

            const permsResult = await db.query('SELECT permission_id FROM admin_role_permissions WHERE role_id = $1', [id]);
            // (将权限 ID 拍平为一個陣列)
            role.permission_ids = permsResult.rows.map(r => r.permission_id);

            return sendSuccess(res, role);
        } catch (error) {
            console.error(`[Admin RBAC] Error fetching role ${id}:`, error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 新增权限组
     * @route POST /api/admin/roles
     */
    router.post('/roles', authMiddleware, checkPermission('admin_permissions', 'update'), async (req, res) => {
        const { name, description, permission_ids = [] } = req.body;
        if (!name) {
            return sendError(res, 400, 'Role name is required.');
        }

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            // 1. 建立 Role
            const roleResult = await client.query(
                'INSERT INTO admin_roles (name, description) VALUES ($1, $2) RETURNING *',
                [name, description || null]
            );
            const newRole = roleResult.rows[0];

            // 2. 绑定权限
            if (permission_ids.length > 0) {
                const values = permission_ids.map((permId, i) => `($1, $${i + 2})`).join(', ');
                await client.query(
                    `INSERT INTO admin_role_permissions (role_id, permission_id) VALUES ${values}`,
                    [newRole.id, ...permission_ids]
                );
            }

            await client.query('COMMIT');
            await recordAuditLog({
                adminId: req.user.id,
                adminUsername: req.user.username,
                action: 'create_role',
                resource: 'admin_roles',
                resourceId: newRole.id.toString(),
                description: `新增權限組：${name}${description ? ` (${description})` : ''}，包含 ${permission_ids.length} 個權限`,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent']
            });
            sendSuccess(res, newRole, 201);
        } catch (error) {
            await client.query('ROLLBACK');
            if (error.code === '23505') { return sendError(res, 409, 'Role name already exists.'); }
            console.error('[Admin RBAC] Error creating role:', error);
            return sendError(res, 500, 'Internal server error');
        } finally {
            client.release();
        }
    });

    /**
     * @description 更新权限组
     * @route PUT /api/admin/roles/:id
     */
    router.put('/roles/:id', authMiddleware, checkPermission('admin_permissions', 'update'), async (req, res) => {
        const { id } = req.params;
        const { name, description, permission_ids = [] } = req.body;
        if (!name) {
            return sendError(res, 400, 'Role name is required.');
        }
        // (安全机制：不允许修改 Super Admin (ID 1))
        if (parseInt(id, 10) === 1) {
            return sendError(res, 403, 'Cannot modify the Super Admin role.');
        }

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            // 1. 更新 Role 基本资料
            const roleResult = await client.query(
                'UPDATE admin_roles SET name = $1, description = $2 WHERE id = $3 RETURNING *',
                [name, description || null, id]
            );
            if (roleResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return sendError(res, 404, 'Role not found.');
            }

            // 2. 刪除所有旧权限
            await client.query('DELETE FROM admin_role_permissions WHERE role_id = $1', [id]);

            // 3. 绑定新权限
            if (permission_ids.length > 0) {
                const values = permission_ids.map((permId, i) => `($1, $${i + 2})`).join(', ');
                await client.query(
                    `INSERT INTO admin_role_permissions (role_id, permission_id) VALUES ${values}`,
                    [id, ...permission_ids]
                );
            }

            await client.query('COMMIT');
            await recordAuditLog({
                adminId: req.user.id,
                adminUsername: req.user.username,
                action: 'update_role',
                resource: 'admin_roles',
                resourceId: id.toString(),
                description: `更新權限組：${name}${description ? ` (${description})` : ''}，包含 ${permission_ids.length} 個權限`,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent']
            });
            return sendSuccess(res, roleResult.rows[0]);
        } catch (error) {
            await client.query('ROLLBACK');
            if (error.code === '23505') { return sendError(res, 409, 'Role name already exists.'); }
            console.error(`[Admin RBAC] Error updating role ${id}:`, error);
            return sendError(res, 500, 'Internal server error');
        } finally {
            client.release();
        }
    });

    /**
     * @description 刪除权限组
     * @route DELETE /api/admin/roles/:id
     */
    router.delete('/roles/:id', authMiddleware, checkPermission('admin_permissions', 'update'), async (req, res) => {
        const { id } = req.params;
        // (安全机制：不允许刪除 Super Admin / Admin / Operator (ID 1, 2, 3))
        if ([1, 2, 3].includes(parseInt(id, 10))) {
            return sendError(res, 403, 'Cannot delete default system roles.');
        }

        // (注：刪除 role 会透过 ON DELETE CASCADE 自动刪除 role_permissions, 
        // 并透过 ON DELETE SET NULL 将 admin_users.role_id 设为 null)
        try {
            const result = await db.query('DELETE FROM admin_roles WHERE id = $1 RETURNING id, name', [id]);
            if (result.rows.length === 0) {
                return sendError(res, 404, 'Role not found.');
            }
            await recordAuditLog({
                adminId: req.user.id,
                adminUsername: req.user.username,
                action: 'delete_role',
                resource: 'admin_roles',
                resourceId: id.toString(),
                description: `刪除權限組：${result.rows[0].name || id}`,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent']
            });
            res.status(204).send();
        } catch (error) {
            console.error(`[Admin RBAC] Error deleting role ${id}:`, error);
            sendError(res, 500, 'Internal server error');
        }
    });

    // (★★★ 获取充值记录列表 ★★★)
    /**
     * @description 获取充值记录列表
     * @route GET /api/admin/deposits
     */

}

module.exports = permissionsRoutes;
