// apps/backend-legacy/utils/balanceChangeLogger.js
// 账变记录工具函数

const db = require('@flipcoin/database');

/**
 * 记录账变
 * @param {Object} options - 账变参数
 * @param {string} options.user_id - 用户ID
 * @param {string} options.change_type - 账变类型：deposit, withdrawal, bet, payout, manual_adjust, activity_bonus
 * @param {number} options.amount - 账变金额（正数增加，负数减少）
 * @param {number} options.balance_after - 账变后余额
 * @param {string} [options.remark] - 备注信息
 * @param {Object} [options.client] - 数据库客户端（用于事务）
 * @returns {Promise<Object>} 返回创建的账变记录
 */
async function logBalanceChange({ user_id, change_type, amount, balance_after, remark = null, client = null }) {
    try {
        const query = `
            INSERT INTO balance_changes (user_id, change_type, amount, balance_after, remark, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING *
        `;
        
        const params = [user_id, change_type, amount, balance_after, remark];
        
        // 如果提供了client，使用事务客户端；否则使用普通查询
        const result = client 
            ? await client.query(query, params)
            : await db.query(query, params);
        
        return result.rows[0];
    } catch (error) {
        console.error('[BalanceChangeLogger] Error logging balance change:', error);
        // 不抛出错误，避免影响主业务逻辑
        // 但记录错误日志以便排查
        throw error;
    }
}

/**
 * 账变类型常量
 */
const CHANGE_TYPES = {
    DEPOSIT: 'deposit',           // 充值
    WITHDRAWAL: 'withdrawal',     // 提款
    BET: 'bet',                   // 下注
    PAYOUT: 'payout',             // 派奖
    MANUAL_ADJUST: 'manual_adjust', // 人工调整
    ACTIVITY_BONUS: 'activity_bonus', // 活动奖金
};

module.exports = {
    logBalanceChange,
    CHANGE_TYPES
};

