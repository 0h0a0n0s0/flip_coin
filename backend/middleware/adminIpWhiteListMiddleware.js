// 档案: backend/middleware/adminIpWhitelistMiddleware.js (新档案)

const db = require('../db'); //
const path = require('path');
const forbiddenPagePath = path.join(__dirname, '../v1_frontend/403.html'); //

/**
 * 检查请求 IP 是否在 admin_ip_whitelist 表中。
 */
const adminIpWhitelistMiddleware = async (req, res, next) => {
    
    // (★★★ 关键修改：简化 IP 获取逻辑 ★★★)
    // 在 Nginx 中，我们设置了: proxy_set_header X-Real-IP $remote_addr;
    // $remote_addr 是 Nginx *直接* 看到的 IP。
    // 当你访问 localhost 时，這個 IP *不是* 你的公网 IP，
    // 而是 Docker 网路的网关 IP (例如 172.17.0.1) 或 127.0.0.1。
    // 我们只信任這個 Nginx 直接看到的 IP。
    const clientIp = req.headers['x-real-ip'] || req.ip;

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