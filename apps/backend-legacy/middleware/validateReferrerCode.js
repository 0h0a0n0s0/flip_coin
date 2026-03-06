// middleware/validateReferrerCode.js
// 註冊時驗證推薦碼（若有填寫）

const db = require('@flipcoin/database');
const { sendError } = require('../utils/safeResponse');

const REFERRAL_CODE_REGEX = /^[A-Z0-9]{8}$/;

/**
 * 若 req.body.referrer_code 有值，則驗證格式與是否存在
 * 空值跳過（推薦碼可選）
 */
async function validateReferrerCodeIfPresent(req, res, next) {
    const code = (req.body?.referrer_code || '').trim().toUpperCase();
    if (!code) {
        return next();
    }
    if (!REFERRAL_CODE_REGEX.test(code)) {
        return sendError(res, 400, '推荐代码格式错误', { errorCode: 'referral_format_error' });
    }
    try {
        const result = await db.query('SELECT 1 FROM users WHERE invite_code = $1', [code]);
        if (result.rows.length === 0) {
            return sendError(res, 400, '无此推荐代码', { errorCode: 'referral_not_found' });
        }
        req.body.referrer_code = code; // 正規化為大寫
        next();
    } catch (err) {
        console.error('[validateReferrerCode] DB error:', err);
        return sendError(res, 500, '服务器内部错误。');
    }
}

module.exports = { validateReferrerCodeIfPresent };
