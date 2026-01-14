// routes/admin/bets.js
// 投注管理相關路由

const db = require('@flipcoin/database');
const authMiddleware = require('../../middleware/auth');
const checkPermission = require('../../middleware/checkPermissionMiddleware');
const { sendError, sendSuccess } = require('../../utils/safeResponse');

/**
 * 投注管理相關路由
 * @param {Router} router - Express router 實例
 */
function betsRoutes(router) {


    router.get('/bets', authMiddleware, checkPermission('bets', 'read'), async (req, res) => {
        const {
            page = 1, limit = 10,
            betId, userId, 
            status, dateRange
        } = req.query;

        try {
            const params = [];
            let whereClauses = [];
            let paramIndex = 1;

            if (betId) { params.push(`%${betId}%`); whereClauses.push(`b.id::text ILIKE $${paramIndex++}`); }
            if (userId) { params.push(`%${userId}%`); whereClauses.push(`b.user_id ILIKE $${paramIndex++}`); }
            if (status) { params.push(status); whereClauses.push(`b.status = $${paramIndex++}`); }
            if (dateRange) { 
                try {
                    const [startDate, endDate] = JSON.parse(dateRange);
                    params.push(startDate); whereClauses.push(`b.bet_time >= $${paramIndex++}`);
                    params.push(endDate); whereClauses.push(`b.bet_time <= $${paramIndex++}`);
                } catch (e) {}
            }

            const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
            const fromSql = 'FROM bets b';

            const countSql = `SELECT COUNT(b.id) ${fromSql} ${whereSql}`;
            const countResult = await db.query(countSql, params);
            const total = parseInt(countResult.rows[0].count, 10);
            if (total === 0) {
                return sendSuccess(res, { total: 0, list: [] });
            }

            const dataSql = `
                SELECT 
                    b.id, b.user_id,
                    b.game_type, b.choice, b.amount, b.status, 
                    b.bet_ip, b.bet_time, b.settle_time, 
                    b.tx_hash,
                    b.payout_multiplier
                ${fromSql}
                ${whereSql}
                ORDER BY b.bet_time DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            const offset = (page - 1) * limit;
            params.push(limit);
            params.push(offset);
            const dataResult = await db.query(dataSql, params);
            sendSuccess(res, { total: total, list: dataResult.rows });
        } catch (error) {
            console.error('[Admin Bets] Error fetching bets (v6):', error);
            sendError(res, 500, 'Internal server error');
        }
    });


    router.get('/reports/profit-loss', authMiddleware, checkPermission('reports', 'read'), async (req, res) => {
        const { userQuery, dateRange } = req.query; 
        if (!dateRange) { return sendError(res, 400, 'Date range is required.'); }

        try {
            // --- 1. 准备 bets 查询的参数 ---
            const betParams = [];
            let betWhereClauses = [];
            let betParamIndex = 1;
            let timeParamsAdded = false;

            try {
                const [startDate, endDate] = JSON.parse(dateRange);
                betParams.push(startDate);
                betWhereClauses.push(`b.bet_time >= $${betParamIndex++}`);
                betParams.push(endDate);
                betWhereClauses.push(`b.bet_time <= $${betParamIndex++}`);
                timeParamsAdded = true;
            } catch (e) { /* 必须有时间 */ }

            if (userQuery && userQuery.toLowerCase() !== 'system') {
                betParams.push(`%${userQuery}%`);
                const userFilterIndex = betParamIndex++;
                betWhereClauses.push(`(u.user_id ILIKE $${userFilterIndex} OR u.username ILIKE $${userFilterIndex})`);
            }

            const betWhereSql = `WHERE ${betWhereClauses.join(' AND ')}`;
            const betJoinSql = 'FROM bets b JOIN users u ON b.user_id = u.user_id';

            // --- 2. 查询 Bets 相关数据 (投注, 派奖) ---
            const betReportSql = `
                SELECT
                    COALESCE(SUM(b.amount), 0) AS total_bet,
                    COALESCE(SUM(
                        CASE 
                            WHEN b.status = 'won' THEN b.amount * b.payout_multiplier 
                            ELSE 0 
                        END
                    ), 0) AS total_payout
                ${betJoinSql}
                ${betWhereSql}
            `;
            const betReportResult = await db.query(betReportSql, betParams);
            const betData = betReportResult.rows[0];

            // --- 3. 准备 platform_transactions 查询的参数 ---
            const bonusParams = [];
            let bonusWhereClauses = [];
            let bonusParamIndex = 1;

            if (timeParamsAdded) {
                 const [startDate, endDate] = JSON.parse(dateRange);
                 bonusParams.push(startDate);
                 bonusWhereClauses.push(`pt.created_at >= $${bonusParamIndex++}`);
                 bonusParams.push(endDate);
                 bonusWhereClauses.push(`pt.created_at <= $${bonusParamIndex++}`);
            }

            if (userQuery && userQuery.toLowerCase() !== 'system') {
                bonusParams.push(`%${userQuery}%`);
                const userFilterIndex = bonusParamIndex++;
                bonusWhereClauses.push(`(u.user_id ILIKE $${userFilterIndex} OR u.username ILIKE $${userFilterIndex})`);
            }

            const bonusWhereSql = bonusWhereClauses.length > 0 ? `WHERE ${bonusWhereClauses.join(' AND ')}` : '';
            const bonusJoinSql = 'FROM platform_transactions pt JOIN users u ON pt.user_id = u.user_id';

            // --- 4. 查询其他支出 (奖金, 提現, Gas) ---
            const bonusReportSql = `
                SELECT
                    COALESCE(SUM(CASE WHEN pt.type = 'level_up_reward' THEN pt.amount ELSE 0 END), 0) AS bonus_level,
                    COALESCE(SUM(CASE WHEN pt.type = 'event_bonus' THEN pt.amount ELSE 0 END), 0) AS bonus_event,
                    COALESCE(SUM(CASE WHEN pt.type = 'commission' THEN pt.amount ELSE 0 END), 0) AS bonus_commission,
                    COALESCE(SUM(pt.gas_fee), 0) AS total_gas_fee
                ${userQuery && userQuery.toLowerCase() !== 'system' ? bonusJoinSql : 'FROM platform_transactions pt'}
                ${bonusWhereSql}
            `;
            const bonusReportResult = await db.query(bonusReportSql, bonusParams);
            const bonusData = bonusReportResult.rows[0];

            // --- 5. 汇总计算 ---
            const total_bet = parseFloat(betData.total_bet);
            const total_payout = parseFloat(betData.total_payout);
            const bonus_level = parseFloat(bonusData.bonus_level);
            const bonus_event = parseFloat(bonusData.bonus_event);
            const bonus_commission = parseFloat(bonusData.bonus_commission);
            const total_gas_fee = parseFloat(bonusData.total_gas_fee);

            const platform_profit = total_bet - total_payout; 
            const platform_net_profit = total_bet - total_payout - bonus_level - bonus_event - bonus_commission - total_gas_fee;

            // --- 6. 返回结果 ---
            sendSuccess(res, {total_bet, total_payout, platform_profit,
                bonus_event, bonus_level, bonus_commission,
                total_gas_fee, platform_net_profit});

        } catch (error) {
            console.error('[Admin Report] CRITICAL ERROR (v6):', error); 
            sendError(res, 500, 'Internal server error');
        }
    });

}

module.exports = betsRoutes;
