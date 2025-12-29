const { sendError } = require('../utils/safeResponse');

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
const PASSWORD_REGEX = /^[\S]{6,64}$/;
const TRON_ADDRESS_REGEX = /^T[1-9A-HJ-NP-Za-km-z]{25,34}$/;

function validateUsername(username) {
    return USERNAME_REGEX.test(username || '');
}

function validatePassword(password) {
    return PASSWORD_REGEX.test(password || '');
}

function validateRegisterInput(req, res, next) {
    const { username, password } = req.body || {};

    if (!validateUsername(username)) {
        return sendError(res, 400, '帳號需為 3-20 位字母、數字或底線。');
    }
    if (!validatePassword(password)) {
        return sendError(res, 400, '密碼長度需介於 6-64 字元，且不可包含空白。');
    }

    next();
}

function validateLoginInput(req, res, next) {
    const { username, password } = req.body || {};

    if (!validateUsername(username)) {
        return sendError(res, 400, '請輸入有效的帳號。');
    }
    if (!validatePassword(password)) {
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

    if (!validatePassword(withdrawal_password)) {
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

