const DEFAULT_ERROR_MESSAGE = '操作失敗，請稍後再試。';

function sanitizeMessage(message) {
    if (!message || typeof message !== 'string') {
        return DEFAULT_ERROR_MESSAGE;
    }
    const trimmed = message.trim();
    if (trimmed.length === 0) {
        return DEFAULT_ERROR_MESSAGE;
    }
    // 移除可能的危險字元，避免在前端顯示 HTML/模板內容
    const sanitized = trimmed.replace(/[<>`$]/g, '');
    if (sanitized.length > 140) {
        return DEFAULT_ERROR_MESSAGE;
    }
    return sanitized;
}

function sendError(res, status = 500, message = DEFAULT_ERROR_MESSAGE) {
    return res.status(status).json({
        error: sanitizeMessage(message)
    });
}

module.exports = {
    sendError,
    sanitizeMessage,
    DEFAULT_ERROR_MESSAGE
};

