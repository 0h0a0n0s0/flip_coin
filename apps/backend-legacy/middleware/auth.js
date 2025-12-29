// 档案: backend/middleware/auth.js (新档案)

const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    // 1. 从 Request Header 获取 'Authorization'
    // 格式预期为: "Bearer TOKEN_STRING"
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

        // 3. 验证 Token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 4. 将解码後的用户资讯附加到 req 物件上
        req.user = decoded;
        
        // 5. 允许请求继续
        next();

    } catch (ex) {
        console.error('[Auth Middleware] Invalid token.', ex.message);
        // (★★★ 关键修改：从 400 改为 401 ★★★)
        res.status(401).json({ error: 'Invalid token.' });
    }
};