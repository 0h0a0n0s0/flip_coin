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

function sendError(res, status = 500, message = DEFAULT_ERROR_MESSAGE, extraFields = {}) {
    return res.status(status).json({
        success: false,
        error: sanitizeMessage(message),
        ...extraFields
    });
}

function sendSuccess(res, data, status = 200) {
    return res.status(status).json({
        success: true,
        data: data
    });
}

module.exports = {
    sendError,
    sendSuccess,
    sanitizeMessage,
    DEFAULT_ERROR_MESSAGE
};

