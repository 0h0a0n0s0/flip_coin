// Withdrawal Service
// 處理提款和充值相關的資料庫操作

const db = require('@flipcoin/database');
const { maskAddress, maskTxHash } = require('../utils/maskUtils');

/**
 * 獲取用戶提款歷史（帶遮罩）
 */
async function getUserWithdrawals(userId, limit = 20) {
    const result = await db.query(
        `SELECT chain_type, address, amount, status, rejection_reason, request_time, review_time, tx_hash 
         FROM withdrawals 
         WHERE user_id = $1 
         ORDER BY request_time DESC 
         LIMIT $2`,
        [userId, limit]
    );
    return result.rows.map(item => ({
        ...item,
        address_masked: maskAddress(item.address || ''),
        tx_hash_masked: item.tx_hash ? maskTxHash(item.tx_hash) : null
    }));
}

/**
 * 獲取用戶充值歷史（帶遮罩）
 */
async function getUserDeposits(userId, limit = 20) {
    const result = await db.query(
        `SELECT id, chain, amount, status, tx_hash, created_at 
         FROM platform_transactions 
         WHERE user_id = $1 AND type = 'deposit' 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [userId, limit]
    );
    return result.rows.map(item => ({
        ...item,
        tx_hash_masked: item.tx_hash ? maskTxHash(item.tx_hash) : null
    }));
}

module.exports = {
    getUserWithdrawals,
    getUserDeposits
};

