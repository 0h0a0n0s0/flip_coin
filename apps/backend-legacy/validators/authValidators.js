const { sendError } = require('../utils/safeResponse');

// 註冊：帳號 6-32 字，英文大小寫、數字、. _ - @
const REGISTER_USERNAME_REGEX = /^[a-zA-Z0-9._\-@]{6,32}$/;
// 註冊：密碼 8-64 字，允許所有字符
const REGISTER_PASSWORD_REGEX = /^.{8,64}$/;
// 登入：相容舊帳號格式（3-32 字）
const LOGIN_USERNAME_REGEX = /^[a-zA-Z0-9._\-@]{3,32}$/;
const LOGIN_PASSWORD_REGEX = /^[\S]{6,64}$/;
const TRON_ADDRESS_REGEX = /^T[1-9A-HJ-NP-Za-km-z]{25,34}$/;

function validateRegisterUsername(username) {
    return REGISTER_USERNAME_REGEX.test(username || '');
}

function validateRegisterPassword(password) {
    return REGISTER_PASSWORD_REGEX.test(password || '');
}

function validateRegisterInput(req, res, next) {
    const { username, password } = req.body || {};

    if (!validateRegisterUsername(username)) {
        return sendError(res, 400, '帳號需為 6-32 字，僅限英文、數字及 . _ - @', { errorCode: 'username_format' });
    }
    if (!validateRegisterPassword(password)) {
        return sendError(res, 400, '密碼需為 8-64 字', { errorCode: 'password_format' });
    }

    next();
}

function validateLoginInput(req, res, next) {
    const { username, password } = req.body || {};

    if (!LOGIN_USERNAME_REGEX.test(username || '')) {
        return sendError(res, 400, '請輸入有效的帳號。');
    }
    if (!LOGIN_PASSWORD_REGEX.test(password || '')) {
        return sendError(res, 400, '請輸入有效的密碼。');
    }

    next();
}

function validateWithdrawalInput(req, res, next) {
    const { chain_type, address, amount, withdrawal_password } = req.body || {};
    const allowedChains = ['TRC20'];

    if (!allowedChains.includes(chain_type)) {
        return sendError(res, 400, '僅支援 TRC20 提款。');
    }

    if (typeof address !== 'string' || !TRON_ADDRESS_REGEX.test(address.trim())) {
        return sendError(res, 400, '請輸入有效的 TRC20 地址。');
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 1000000) {
        return sendError(res, 400, '提款金額必須為有效的正數，且不得超過 1,000,000。');
    }

    const amountDecimals = (numericAmount.toString().split('.')[1] || '').length;
    if (amountDecimals > 2) {
        return sendError(res, 400, '提款金額最多允許 2 位小數。');
    }

    if (!LOGIN_PASSWORD_REGEX.test(withdrawal_password || '')) {
        return sendError(res, 400, '提款密碼格式無效。');
    }

    // 正規化輸入
    req.body.address = address.trim();
    req.body.amount = numericAmount;

    next();
}

module.exports = {
    validateRegisterInput,
    validateLoginInput,
    validateWithdrawalInput
};

