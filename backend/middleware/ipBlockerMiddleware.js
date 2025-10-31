// 檔案: backend/middleware/ipBlockerMiddleware.js (新檔案)

const db = require('../db'); //
const path = require('path');

// (指向 v1_frontend 中的 403.html 路徑)
const forbiddenPagePath = path.join(__dirname, '../v1_frontend/403.html');

const ipBlockerMiddleware = async (req, res, next) => {
    const clientIp = req.ip;

    if (!clientIp) {
        console.warn('[IP Blocker] Cannot determine client IP. Allowing request.');
        return next();
    }

    try {
        const query = "SELECT EXISTS(SELECT 1 FROM blocked_regions WHERE ip_range >>= $1)";
        const result = await db.query(query, [clientIp]);

        if (result.rows[0].exists) {
            // 找到了匹配，該 IP 被阻擋
            console.warn(`[IP Blocker] Denied (403) request from blocked IP: ${clientIp} for path: ${req.path}`);

            // (★★★ 關鍵修改：區分 API 和頁面請求 ★★★)
            if (req.path.startsWith('/api/')) {
                // 如果是 API 請求，返回 JSON
                return res.status(403).json({ error: 'Access Denied from your region.' });
            } else {
                // 如果是頁面請求 (/, /app.js, /style.css 等)，返回 403 頁面
                return res.status(403).sendFile(forbiddenPagePath);
            }
        }

        // 未找到匹配，放行
        return next();

    } catch (error) {
        console.error(`[IP Blocker] Error checking IP ${clientIp}:`, error.message);
        return next(); // 查詢失敗時放行
    }
};

module.exports = ipBlockerMiddleware;