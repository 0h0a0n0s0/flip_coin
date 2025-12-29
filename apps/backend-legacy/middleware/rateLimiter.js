const { sendError } = require('../utils/safeResponse');

function createRateLimiter({
    windowMs = 60 * 1000,
    max = 10,
    keyGenerator = (req) => req.ip,
    message = '請求過於頻繁，請稍後再試。'
} = {}) {
    const buckets = new Map();

    return (req, res, next) => {
        const key = keyGenerator(req);
        const now = Date.now();
        const bucket = buckets.get(key) || { count: 0, expires: now + windowMs };

        if (now > bucket.expires) {
            bucket.count = 0;
            bucket.expires = now + windowMs;
        }

        bucket.count += 1;
        buckets.set(key, bucket);

        if (bucket.count > max) {
            return sendError(res, 429, message);
        }

        next();
    };
}

const loginRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 5,
    message: '登入請求過於頻繁，請稍後再試。'
});

const registerRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 3,
    message: '註冊請求過於頻繁，請稍後再試。'
});

const withdrawRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 5,
    message: '提款請求過於頻繁，請稍後再試。'
});

module.exports = {
    createRateLimiter,
    loginRateLimiter,
    registerRateLimiter,
    withdrawRateLimiter
};

