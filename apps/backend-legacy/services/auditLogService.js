const db = require('@flipcoin/database');

async function recordAuditLog({
    adminId,
    adminUsername,
    action,
    resource,
    resourceId,
    description,
    ipAddress,
    userAgent
}) {
    try {
        await db.query(
            `INSERT INTO admin_audit_logs
             (admin_id, admin_username, action, resource, resource_id, description, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                adminId || null,
                adminUsername || null,
                action || 'unknown',
                resource || null,
                resourceId || null,
                description || null,
                ipAddress || null,
                userAgent || null
            ]
        );
    } catch (error) {
        console.error('[AuditLog] Failed to record audit log:', error.message);
    }
}

module.exports = {
    recordAuditLog
};

