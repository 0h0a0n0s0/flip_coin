// 檔案: backend/middleware/adminIpWhitelistMiddleware.js (新檔案)

const db = require('../db'); //
const path = require('path');
// (指向 v1 的 403 頁面，我們共用它)
const forbiddenPagePath = path.join(__dirname, '../v1_frontend/403.html'); //

/**
 * 檢查請求 IP 是否在 admin_ip_whitelist 表中。
 */
const adminIpWhitelistMiddleware = async (req, res, next) => {
    const clientIp = req.ip;

    if (!clientIp) {
        console.warn('[Admin Whitelist] Cannot determine client IP. Denying request.');
        return res.status(403).sendFile(forbiddenPagePath);
    }

    try {
        // 1. 檢查白名單是否為空
        const countResult = await db.query('SELECT COUNT(*) FROM admin_ip_whitelist');
        const count = parseInt(countResult.rows[0].count, 10);

        // (★★★ 安全機制：如果白名單是空的，則允許所有 IP 訪問 ★★★)
        // (這可以防止管理員誤刪所有 IP 後被鎖定)
        if (count === 0) {
            console.warn('[Admin Whitelist] Whitelist is EMPTY. Allowing all IPs (Safety Mode).');
            return next();
        }

        // 2. 白名單不為空，檢查 IP 是否匹配
        const query = "SELECT EXISTS(SELECT 1 FROM admin_ip_whitelist WHERE ip_range >>= $1)";
        const result = await db.query(query, [clientIp]);

        if (result.rows[0].exists) {
            // 匹配成功，放行
            return next();
        }

        // 3. 不在白名單中，阻擋
        console.warn(`[Admin Whitelist] Denied (403) request from non-whitelisted IP: ${clientIp}`);
        
        // (★★★ 關鍵：區分 API 請求和頁面請求 ★★★)
        // 如果是 API 請求 (例如 /api/admin/login)，返回 JSON
        if (req.path.startsWith('/api/')) {
            return res.status(403).json({ error: 'Access Denied: IP not whitelisted.' });
        }
        // 如果是頁面請求 (例如 /admin/)，返回 403 頁面
        return res.status(403).sendFile(forbiddenPagePath);

    } catch (error) {
        console.error(`[Admin Whitelist] Error checking IP ${clientIp}:`, error.message);
        // (查詢失敗時，安全起見應阻擋)
        return res.status(500).json({ error: 'IP whitelist check failed.' });
    }
};

module.exports = adminIpWhitelistMiddleware;