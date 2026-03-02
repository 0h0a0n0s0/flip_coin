const db = require('@flipcoin/database');
const { encrypt } = require('../utils/encryptionUtils');

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
        const encryptionKey = process.env.ENCRYPTION_KEY_PII;
        
        // 如果配置了加密密鑰，則加密 IP 地址
        let encryptedIp = null;
        if (encryptionKey && ipAddress) {
            try {
                encryptedIp = encrypt(ipAddress, encryptionKey);
            } catch (encryptError) {
                console.error('[AuditLog] Failed to encrypt IP address:', encryptError);
                // 降級：如果加密失敗，不記錄 IP（安全優先）
                encryptedIp = null;
            }
        }
        
        await db.query(
            `INSERT INTO admin_audit_logs
             (admin_id, admin_username, action, resource, resource_id, description, encrypted_ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                adminId || null,
                adminUsername || null,
                action || 'unknown',
                resource || null,
                resourceId || null,
                description || null,
                encryptedIp,
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

