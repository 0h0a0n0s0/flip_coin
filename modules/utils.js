// utils.js

// 根据哈希生成 0 或 1
export function hashResult(hash) {
    // 取哈希最后一位字符
    const lastChar = hash.slice(-1);
    const dec = parseInt(lastChar, 16);
    return dec % 2; // 0 或 1
}
// utils.js

export function generateFakeTxHash() {
    // 模拟 64 位十六进制交易哈希
    const chars = 'abcdef0123456789';
    let hash = '';
    for (let i=0; i<64; i++) hash += chars[Math.floor(Math.random()*chars.length)];
    return hash;
}
