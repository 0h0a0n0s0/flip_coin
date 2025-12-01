// 档案: backend/middleware/adminIpWhitelistMiddleware.js (新档案)

const db = require('../db'); //
const path = require('path');
const forbiddenPagePath = path.join(__dirname, '../v1_frontend/403.html'); //

/**
 * 检查请求 IP 是否在 admin_ip_whitelist 表中。
 */
const adminIpWhitelistMiddleware = async (req, res, next) => {
    
    // (★★★ 关键修改：使用统一的 IP 获取函数 ★★★)
    // 优先使用 X-Forwarded-For 的第一个 IP（真实客户端 IP）
    // 然后使用 X-Real-IP，最后使用 req.ip
    const { getClientIp } = require('../utils/ipUtils');
    const clientIp = getClientIp(req);

    // (★★★ 关键修改：修改日志 ★★★)
    console.log(`[Admin Whitelist] Checking IP: ${clientIp} (Headers: X-Forwarded-For: ${req.headers['x-forwarded-for']}, X-Real-IP: ${req.headers['x-real-ip']}, req.ip: ${req.ip})`);


    if (!clientIp) {
        console.warn('[Admin Whitelist] Cannot determine client IP. Denying request.');
        return res.status(403).sendFile(forbiddenPagePath);
    }

    try {
        // 1. 检查白名单是否为空
        const countResult = await db.query('SELECT COUNT(*) FROM admin_ip_whitelist');
        const count = parseInt(countResult.rows[0].count, 10);

        // (★★★ 安全机制：如果白名单是空的，則允许所有 IP 访问 ★★★)
        // (這可以防止管理员误刪所有 IP 後被锁定)
        if (count === 0) {
            console.warn('[Admin Whitelist] Whitelist is EMPTY. Allowing all IPs (Safety Mode).');
            return next();
        }

        // 2. 白名单不为空，检查 IP 是否匹配
        const query = "SELECT EXISTS(SELECT 1 FROM admin_ip_whitelist WHERE ip_range >>= $1)";
        const result = await db.query(query, [clientIp]);

        if (result.rows[0].exists) {
            // 匹配成功，放行
            return next();
        }

        // 3. 不在白名单中，阻挡
        console.warn(`[Admin Whitelist] Denied (403) request from non-whitelisted IP: ${clientIp}`);
        
        // (★★★ 关键：区分 API 请求和页面请求 ★★★)
        // 如果是 API 请求 (例如 /api/admin/login)，返回 JSON
        if (req.path.startsWith('/api/')) {
            return res.status(403).json({ error: 'Access Denied: IP not whitelisted.' });
        }
        // 如果是页面请求 (例如 /admin/)，返回 403 页面
        return res.status(403).sendFile(forbiddenPagePath);

    } catch (error) {
        console.error(`[Admin Whitelist] Error checking IP ${clientIp}:`, error.message);
        // (查询失败时，安全起见应阻挡)
        return res.status(500).json({ error: 'IP whitelist check failed.' });
    }
};

module.exports = adminIpWhitelistMiddleware;