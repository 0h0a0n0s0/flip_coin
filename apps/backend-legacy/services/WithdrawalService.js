// Withdrawal Service
// 處理提款和充值相關的資料庫操作

const db = require('@flipcoin/database');
const { maskAddress, maskTxHash } = require('../utils/maskUtils');

// 用於存儲 io 實例（從外部設置）
let io = null;

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

/**
 * 獲取待審核提款數量
 * @returns {Promise<number>} 待審核提款數量
 */
async function getPendingWithdrawalCount() {
    try {
        const result = await db.query(
            "SELECT COUNT(*) FROM withdrawals WHERE status = 'pending'"
        );
        return parseInt(result.rows[0].count, 10) || 0;
    } catch (error) {
        console.error('[WithdrawalService] Error getting pending withdrawal count:', error);
        return 0;
    }
}

/**
 * 通知管理員待審核提款數量更新
 * 通過 Socket.IO 發送到 admin room
 */
async function notifyAdminPendingWithdrawalCount() {
    if (!io) {
        console.warn('[WithdrawalService] Socket.IO instance not available, skipping notification');
        return;
    }

    try {
        const count = await getPendingWithdrawalCount();
        // 發送到 admin room
        io.to('admin').emit('admin:stats_update', {
            type: 'withdrawal_pending_count',
            count: count
        });
        console.log(`[WithdrawalService] Notified admin room: pending withdrawal count = ${count}`);
    } catch (error) {
        console.error('[WithdrawalService] Error notifying admin pending withdrawal count:', error);
    }
}

/**
 * 設置 Socket.IO 實例
 * @param {Object} socketIO - Socket.IO 實例
 */
function setIo(socketIO) {
    io = socketIO;
}

module.exports = {
    getUserWithdrawals,
    getUserDeposits,
    getPendingWithdrawalCount,
    notifyAdminPendingWithdrawalCount,
    setIo
};

