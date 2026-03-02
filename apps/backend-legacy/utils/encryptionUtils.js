// encryptionUtils.js
// AES-256-GCM 加密工具（用於敏感資料加密）

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM 推薦 12 bytes
const AUTH_TAG_LENGTH = 16; // GCM 固定 16 bytes

/**
 * 加密文本
 * @param {string} plaintext - 明文
 * @param {string} keyHex - 64 位十六進位密鑰（256 bits）
 * @returns {string} 格式：iv:authTag:ciphertext（均為十六進位）
 */
function encrypt(plaintext, keyHex) {
    if (!plaintext || !keyHex) {
        throw new Error('encrypt() requires plaintext and keyHex');
    }
    
    const key = Buffer.from(keyHex, 'hex');
    if (key.length !== 32) {
        throw new Error('Key must be 32 bytes (256 bits)');
    }
    
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    
    // 格式：iv:authTag:ciphertext（便於解析和完整性驗證）
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * 解密文本
 * @param {string} ciphertext - 密文（格式：iv:authTag:ciphertext）
 * @param {string} keyHex - 64 位十六進位密鑰（256 bits）
 * @returns {string} 明文
 */
function decrypt(ciphertext, keyHex) {
    if (!ciphertext || !keyHex) {
        throw new Error('decrypt() requires ciphertext and keyHex');
    }
    
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid ciphertext format (expected iv:authTag:ciphertext)');
    }
    
    const [ivHex, authTagHex, encrypted] = parts;
    const key = Buffer.from(keyHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    if (key.length !== 32) {
        throw new Error('Key must be 32 bytes (256 bits)');
    }
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}

/**
 * 生成 HMAC-SHA256 雜湊索引（用於可搜索加密欄位）
 * @param {string} value - 原始值
 * @param {string} keyHex - 64 位十六進位密鑰
 * @returns {string} 十六進位雜湊值（64 字元）
 */
function hashForIndex(value, keyHex) {
    if (!value || !keyHex) {
        throw new Error('hashForIndex() requires value and keyHex');
    }
    
    const key = Buffer.from(keyHex, 'hex');
    const hmac = crypto.createHmac('sha256', key);
    return hmac.update(value).digest('hex');
}

/**
 * 生成隨機加密密鑰（256 bits）
 * @returns {string} 64 位十六進位密鑰
 */
function generateKey() {
    return crypto.randomBytes(32).toString('hex');
}

module.exports = {
    encrypt,
    decrypt,
    hashForIndex,
    generateKey
};
