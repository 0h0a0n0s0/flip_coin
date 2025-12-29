// 档案: backend/middleware/adminIpWhitelistMiddleware.js (新档案)

const db = require('@flipcoin/database');
const path = require('path');
const fs = require('fs');
const forbiddenPagePath = path.join(__dirname, '../v1_frontend/403.html');
const { getClientIp } = require('../utils/ipUtils'); // 引用現有的工具

/**
 * 檢查請求 IP 是否在 admin_ip_whitelist 表中。
 */
const adminIpWhitelistMiddleware = async (req, res, next) => {
    
    // 1. 獲取網絡層面的 IP
    const networkIp = getClientIp(req);
    
    // 2. 獲取前端匯報的真實 IP
    const frontendReportedIp = req.headers['x-client-real-ip'];
    
    // 3. 獲取 X-Forwarded-For 中的所有 IP（用於內網訪問）
    const forwardedFor = req.headers['x-forwarded-for'];
    const forwardedIps = forwardedFor ? forwardedFor.split(',').map(ip => ip.trim()) : [];
    
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

        // 2. 核心邏輯：檢查所有可能的 IP（Network IP、Frontend IP、X-Forwarded-For 中的 IP）
        const query = "SELECT EXISTS(SELECT 1 FROM admin_ip_whitelist WHERE ip_range >>= $1)";
        
        // 收集所有需要檢查的 IP
        const ipsToCheck = [networkIp];
        if (frontendReportedIp) {
            const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
            if (ipRegex.test(frontendReportedIp) && !ipsToCheck.includes(frontendReportedIp)) {
                ipsToCheck.push(frontendReportedIp);
            }
        }
        // 添加 X-Forwarded-For 中的 IP（用於內網訪問）
        forwardedIps.forEach(ip => {
            if (ip && !ipsToCheck.includes(ip)) {
                ipsToCheck.push(ip);
            }
        });
        
        // 檢查所有 IP，只要有一個在白名單中就放行
        for (const ip of ipsToCheck) {
            const result = await db.query(query, [ip]);
            if (result.rows[0].exists) {
                console.log(`[Admin Whitelist] Allowed IP: ${ip}`);
                return next(); // IP 在白名單中，放行
            }
        }

        // 3. 都不在白名單中
        const detectedIp = frontendReportedIp || networkIp;
        
        // (★★★ 關鍵修改：如果是HTML頁面請求且沒有前端IP，允許加載一次讓前端獲取IP ★★★)
        // (★★★ 關鍵修改：允許靜態資源和HTML頁面首次加載，讓前端有機會獲取並發送IP ★★★)
        const isNotApiRequest = !req.path.startsWith('/api/');
        const isGetRequest = req.method === 'GET';
        const acceptHeader = req.headers.accept || '';
        
        // 判斷是否為靜態資源請求（CSS、JS、圖片、字體等）
        // 檢查路徑（req.path可能不包含/admin前綴）和完整URL
        const staticResourcePattern = /\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map)$/i;
        const isStaticResource = staticResourcePattern.test(req.path) || staticResourcePattern.test(req.originalUrl);
        
        // 判斷是否為HTML頁面請求
        // 注意：req.path 可能不包含 /admin 前綴（因為路由掛載），所以要檢查 originalUrl
        const hasHtmlAccept = acceptHeader.includes('text/html');
        const isAdminPath = req.originalUrl.startsWith('/admin/') || req.path.startsWith('/admin/');
        const isAdminRoute = req.originalUrl.match(/^\/admin\/(login|dashboard|users|bets|reports|finance|settings|risk|admin)/) ||
                           req.path.match(/^\/(login|dashboard|users|bets|reports|finance|settings|risk|admin)/);
        const pathMatches = req.path === '/' || 
                           req.path === '/login' ||
                           isAdminPath ||
                           req.path.endsWith('.html') ||
                           isAdminRoute;
        const isHtmlRequest = hasHtmlAccept && pathMatches;
        
        // 靜態資源請求始終允許（因為它們不會帶 X-Client-Real-IP header）
        if (isNotApiRequest && isGetRequest && isStaticResource) {
            return next();
        }
        
        // HTML頁面請求（包括刷新頁面），如果沒有前端IP，允許加載
        // 這允許Vue應用加載並通過axios攔截器發送IP
        if (isNotApiRequest && isGetRequest && !frontendReportedIp && isHtmlRequest) {
            return next();
        }
        
        // 如果是admin路徑的GET請求且沒有前端IP，也允許（更寬鬆的策略，適用於所有admin頁面）
        if (isNotApiRequest && isGetRequest && !frontendReportedIp && isAdminPath) {
            return next();
        }
        
        // 4. API請求或已有前端IP但不在白名單，阻擋
        console.warn(`[Admin Whitelist] Denied (403). Network IP: ${networkIp}, Reported IP: ${frontendReportedIp || 'N/A'}`);
        
        if (req.path.startsWith('/api/')) {
            return res.status(403).json({ error: `Access Denied. Your IP (${detectedIp}) is not whitelisted.` });
        }
        
        // 動態注入 IP 信息到 403.html
        try {
            let htmlContent = fs.readFileSync(forbiddenPagePath, 'utf8');
            // 替換佔位符為實際檢測到的IP
            htmlContent = htmlContent.replace('{{CLIENT_IP}}', detectedIp || 'Unknown');
            res.status(403).send(htmlContent);
        } catch (error) {
            console.error('[Admin Whitelist] Failed to read 403.html:', error);
            // 如果讀取失敗，返回簡單的錯誤頁面
            res.status(403).send(`
                <html>
                    <body style="background-color: #121212; color: #f5f5f7; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
                        <div style="text-align: center;">
                            <h1 style="font-size: 48px; color: #f56c6c;">403</h1>
                            <p>您所在的地区無法访问此服务。</p>
                            <p style="margin-top: 20px; font-size: 14px; color: #999;">IP : ${detectedIp || 'Unknown'}</p>
                        </div>
                    </body>
                </html>
            `);
        }
        return;

    } catch (error) {
        console.error(`[Admin Whitelist] Error checking IP:`, error.message);
        return res.status(500).json({ error: 'IP whitelist check failed.' });
    }
};

module.exports = adminIpWhitelistMiddleware;
