/**
 * 通用遮罩函數
 * @param {string} value - 要遮罩的值
 * @param {number} front - 前面保留的字元數
 * @param {number} back - 後面保留的字元數
 * @returns {string} 遮罩後的字串
 */
function maskValue(value = '', front = 4, back = 4) {
    if (!value || typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (trimmed.length <= front + back) {
        return trimmed.replace(/./g, '*');
    }
    return `${trimmed.slice(0, front)}***${trimmed.slice(-back)}`;
}

/**
 * 遮罩錢包地址
 * @param {string} address - 錢包地址
 * @returns {string} 遮罩後的地址（顯示前 6 + 後 4）
 * @example maskAddress("TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf") => "TXYZop***AeBf"
 */
function maskAddress(address) {
    return maskValue(address, 6, 4);
}

/**
 * 遮罩交易 Hash
 * @param {string} txHash - 交易雜湊
 * @returns {string} 遮罩後的 Hash（顯示前 6 + 後 6）
 * @example maskTxHash("0xabc...def") => "0xabc***def"
 */
function maskTxHash(txHash) {
    return maskValue(txHash, 6, 6);
}

/**
 * 遮罩用戶 ID
 * @param {string} userId - 用戶 ID
 * @returns {string} 遮罩後的 ID（顯示前 3 + 後 2）
 * @example maskUserId("U1234567") => "U12***67"
 */
function maskUserId(userId) {
    return maskValue(userId, 3, 2);
}

/**
 * 遮罩 Email 地址
 * @param {string} email - Email 地址
 * @returns {string} 遮罩後的 Email（顯示首字元 + 域名）
 * @example maskEmail("admin@example.com") => "a***@example.com"
 */
function maskEmail(email) {
    if (!email || typeof email !== 'string') return '';
    const parts = email.split('@');
    if (parts.length !== 2) return '***@***';
    
    const localPart = parts[0];
    const domain = parts[1];
    
    if (localPart.length === 0) return `***@${domain}`;
    if (localPart.length === 1) return `${localPart}***@${domain}`;
    
    return `${localPart[0]}***@${domain}`;
}

/**
 * 遮罩 IP 地址
 * @param {string} ip - IP 地址（IPv4）
 * @returns {string} 遮罩後的 IP（顯示前 2 段）
 * @example maskIP("192.168.1.100") => "192.168.***.***"
 */
function maskIP(ip) {
    if (!ip || typeof ip !== 'string') return '';
    
    // IPv4
    if (ip.includes('.')) {
        const parts = ip.split('.');
        if (parts.length !== 4) return '***.***.***. ***';
        return `${parts[0]}.${parts[1]}.***.***`;
    }
    
    // IPv6（簡化處理：顯示前 2 組）
    if (ip.includes(':')) {
        const parts = ip.split(':');
        if (parts.length < 2) return '***:***';
        return `${parts[0]}:${parts[1]}:***:***`;
    }
    
    return '***';
}

/**
 * 遮罩裝置 ID
 * @param {string} deviceId - 裝置 ID
 * @returns {string} 遮罩後的裝置 ID（顯示前 8 字元）
 * @example maskDeviceId("abc123def456ghi789") => "abc123de***"
 */
function maskDeviceId(deviceId) {
    if (!deviceId || typeof deviceId !== 'string') return '';
    const trimmed = deviceId.trim();
    if (trimmed.length <= 8) {
        return trimmed.replace(/.{1,3}$/, '***');
    }
    return `${trimmed.slice(0, 8)}***`;
}

/**
 * 遮罩手機號碼
 * @param {string} phone - 手機號碼
 * @returns {string} 遮罩後的手機號碼（顯示前 3 + 後 4）
 * @example maskPhone("+886912345678") => "+886***5678"
 */
function maskPhone(phone) {
    if (!phone || typeof phone !== 'string') return '';
    const trimmed = phone.trim();
    if (trimmed.length <= 7) {
        return trimmed.replace(/.{3,}/, '***');
    }
    return maskValue(trimmed, 3, 4);
}

/**
 * 完全遮罩敏感資料（用於密碼、密鑰等）
 * @param {string} value - 敏感資料
 * @returns {string} 完全遮罩的字串
 * @example maskSensitive("password123") => "[REDACTED]"
 */
function maskSensitive(value) {
    return value ? '[REDACTED]' : '';
}

module.exports = {
    maskValue,
    maskAddress,
    maskTxHash,
    maskUserId,
    maskEmail,
    maskIP,
    maskDeviceId,
    maskPhone,
    maskSensitive
};

