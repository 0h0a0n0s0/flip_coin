// 档案: backend/middleware/adminIpWhitelistMiddleware.js (新档案)

const db = require('../db');
const path = require('path');
const forbiddenPagePath = path.join(__dirname, '../v1_frontend/403.html');
const { getClientIp } = require('../utils/ipUtils'); // 引用現有的工具

/**
 * 檢查請求 IP 是否在 admin_ip_whitelist 表中。
 */
const adminIpWhitelistMiddleware = async (req, res, next) => {
    
    // 1. 獲取網絡層面的 IP (在您的情況下是 155.102.184.147)
    const networkIp = getClientIp(req);
    
    // 2. (新增) 獲取前端匯報的真實 IP (在您的情況下是 125.229.37.48)
    const frontendReportedIp = req.headers['x-client-real-ip'];

    console.log(`[Admin Whitelist] Checking Access. Network IP: ${networkIp}, Client-Reported IP: ${frontendReportedIp || 'N/A'}`);

    // 如果連 Network IP 都抓不到，直接阻擋
    if (!networkIp) {
        console.warn('[Admin Whitelist] Cannot determine client IP. Denying request.');
        return res.status(403).sendFile(forbiddenPagePath);
    }

    try {
        // 1. 檢查白名單是否為空 (安全模式)
        const countResult = await db.query('SELECT COUNT(*) FROM admin_ip_whitelist');
        const count = parseInt(countResult.rows[0].count, 10);

        if (count === 0) {
            console.warn('[Admin Whitelist] Whitelist is EMPTY. Allowing all IPs (Safety Mode).');
            return next();
        }

        // 2. 核心邏輯：先檢查 Network IP，如果失敗，再檢查 Frontend IP
        const query = "SELECT EXISTS(SELECT 1 FROM admin_ip_whitelist WHERE ip_range >>= $1)";
        
        // 檢查 Network IP
        let result = await db.query(query, [networkIp]);
        if (result.rows[0].exists) {
            return next(); // Network IP 在白名單中，放行
        }

        // 檢查 Frontend Reported IP (如果存在)
        if (frontendReportedIp) {
            // 簡單的 IP 格式驗證，防止 SQL 注入或錯誤格式
            const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
            
            if (ipRegex.test(frontendReportedIp)) {
                const frontendResult = await db.query(query, [frontendReportedIp]);
                if (frontendResult.rows[0].exists) {
                    console.log(`[Admin Whitelist] Allowed via Client-Reported IP: ${frontendReportedIp}`);
                    return next(); // Frontend IP 在白名單中，放行
                }
            }
        }

        // 3. 都不在白名單中，阻擋
        console.warn(`[Admin Whitelist] Denied (403). Network IP: ${networkIp}, Reported IP: ${frontendReportedIp || 'N/A'}`);
        
        if (req.path.startsWith('/api/')) {
            return res.status(403).json({ error: `Access Denied. Your IP (${frontendReportedIp || networkIp}) is not whitelisted.` });
        }
        return res.status(403).sendFile(forbiddenPagePath);

    } catch (error) {
        console.error(`[Admin Whitelist] Error checking IP:`, error.message);
        return res.status(500).json({ error: 'IP whitelist check failed.' });
    }
};

module.exports = adminIpWhitelistMiddleware;
