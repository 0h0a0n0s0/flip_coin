// 檔案: backend/middleware/auth.js (新檔案)

const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    // 1. 從 Request Header 獲取 'Authorization'
    // 格式預期為: "Bearer TOKEN_STRING"
    const authHeader = req.header('Authorization');

    if (!authHeader) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        // 2. 分割 "Bearer " 和 Token
        const token = authHeader.split(' ')[1];
        if (!token) {
             return res.status(401).json({ error: 'Access denied. Token format invalid.' });
        }

        // 3. 驗證 Token
        // (使用我們在 .env 中設定的 JWT_SECRET)
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 4. 將解碼後的用戶資訊 (例如 id, username) 附加到 req 物件上
        // 這樣後續的路由就可以訪問 req.user
        req.user = decoded;
        
        // 5. 允許請求繼續
        next();

    } catch (ex) {
        console.error('[Auth Middleware] Invalid token.', ex.message);
        res.status(400).json({ error: 'Invalid token.' });
    }
};