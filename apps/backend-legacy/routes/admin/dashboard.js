// routes/admin/dashboard.js
// 管理員儀表板相關路由

const db = require('@flipcoin/database');
const authMiddleware = require('../../middleware/auth');
const checkPermission = require('../../middleware/checkPermissionMiddleware');
const { sendError, sendSuccess } = require('../../utils/safeResponse');

// 用于存储 io 和 connectedUsers
let io = null;
let connectedUsers = null;

/**
 * 儀表板相關路由
 * @param {Router} router - Express router 實例
 */
function dashboardRoutes(router) {
    /**
     * @description 獲取核心統計數據 (範例)
     * @route GET /api/admin/stats
     * @access Private (需要 Token)
     */
    router.get('/stats', authMiddleware, checkPermission('dashboard', 'read'), async (req, res) => {
        try {
            const userCountResult = await db.query('SELECT COUNT(*) FROM users');
            const totalUsers = userCountResult.rows[0].count;

            const betCountResult = await db.query('SELECT COUNT(*) FROM bets');
            const totalBets = betCountResult.rows[0].count;

            // 不再有 prize_pending
            const pendingWithdrawalsResult = await db.query("SELECT COUNT(*) FROM platform_transactions WHERE type = 'withdraw' AND status = 'pending'");
            const pendingPayouts = pendingWithdrawalsResult.rows[0].count;

            // 即時線上人數
            const onlineUsers = connectedUsers ? Object.keys(connectedUsers).length : 0;

            // 當日/當週/當月/上月投注量和盈虧統計 + 時間序列數據
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const weekStart = new Date(todayStart);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // 本週一
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

            // 輔助函數：生成當日24小時的時間點數組
            const generateTodayHours = () => {
                const hours = [];
                for (let i = 0; i < 24; i++) {
                    hours.push(`${i.toString().padStart(2, '0')}:00`);
                }
                return hours;
            };

            // 輔助函數：生成當週每2小時的時間點數組（從週一開始到現在）
            const generateWeekHours = () => {
                const hours = [];
                const daysSinceMonday = now.getDay() === 0 ? 6 : now.getDay() - 1;
                const currentHour = now.getHours();
                for (let day = 0; day <= daysSinceMonday; day++) {
                    const maxHour = (day === daysSinceMonday) ? currentHour : 23;
                    for (let h = 0; h <= maxHour; h += 2) {
                        const dayName = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'][day];
                        hours.push(`${dayName} ${h.toString().padStart(2, '0')}:00`);
                    }
                }
                return hours;
            };

            // 輔助函數：生成當月每日的日期數組
            const generateMonthDays = (startDate, endDate) => {
                const days = [];
                const current = new Date(startDate);
                while (current <= endDate) {
                    const month = current.getMonth() + 1;
                    const day = current.getDate();
                    days.push(`${month}/${day}`);
                    current.setDate(current.getDate() + 1);
                }
                return days;
            };

            // 當日統計 + 時間序列（按小時）
            const todayHours = generateTodayHours();
            const todayTimeSeries = await db.query(`
                SELECT 
                    EXTRACT(HOUR FROM bet_time)::int as hour,
                    COUNT(*) as bet_count,
                    COALESCE(SUM(amount), 0) as total_bet_amount,
                    COALESCE(SUM(CASE WHEN status = 'won' THEN amount * payout_multiplier ELSE 0 END), 0) as total_payout,
                    COALESCE(SUM(amount), 0) - COALESCE(SUM(CASE WHEN status = 'won' THEN amount * payout_multiplier ELSE 0 END), 0) as profit_loss
                FROM bets 
                WHERE bet_time >= $1
                GROUP BY EXTRACT(HOUR FROM bet_time)
                ORDER BY hour
            `, [todayStart]);
            const todayStatsMap = {};
            todayTimeSeries.rows.forEach(row => {
                todayStatsMap[parseInt(row.hour)] = {
                    betCount: parseInt(row.bet_count),
                    totalBetAmount: parseFloat(row.total_bet_amount),
                    totalPayout: parseFloat(row.total_payout),
                    profitLoss: parseFloat(row.profit_loss)
                };
            });
            const todayStatsData = {
                betCount: todayTimeSeries.rows.reduce((sum, row) => sum + parseInt(row.bet_count || 0), 0),
                totalBetAmount: todayTimeSeries.rows.reduce((sum, row) => sum + parseFloat(row.total_bet_amount || 0), 0),
                totalPayout: todayTimeSeries.rows.reduce((sum, row) => sum + parseFloat(row.total_payout || 0), 0),
                profitLoss: 0,
                timeSeries: {
                    labels: todayHours,
                    betAmount: todayHours.map((_, idx) => todayStatsMap[idx]?.totalBetAmount || 0),
                    payout: todayHours.map((_, idx) => todayStatsMap[idx]?.totalPayout || 0),
                    profitLoss: todayHours.map((_, idx) => todayStatsMap[idx]?.profitLoss || 0)
                }
            };
            todayStatsData.profitLoss = todayStatsData.totalBetAmount - todayStatsData.totalPayout;

            // 當週統計 + 時間序列（每2小時）
            const weekHours = generateWeekHours();
            const weekTimeSeries = await db.query(`
                SELECT 
                    DATE_TRUNC('hour', bet_time) as time_slot,
                    COUNT(*) as bet_count,
                    COALESCE(SUM(amount), 0) as total_bet_amount,
                    COALESCE(SUM(CASE WHEN status = 'won' THEN amount * payout_multiplier ELSE 0 END), 0) as total_payout,
                    COALESCE(SUM(amount), 0) - COALESCE(SUM(CASE WHEN status = 'won' THEN amount * payout_multiplier ELSE 0 END), 0) as profit_loss
                FROM bets 
                WHERE bet_time >= $1
                GROUP BY DATE_TRUNC('hour', bet_time)
                ORDER BY time_slot
            `, [weekStart]);
            
            // 將每小時數據按每2小時分組
            const weekStatsMap = {};
            weekTimeSeries.rows.forEach(row => {
                const betTime = new Date(row.time_slot);
                const dayOfWeek = betTime.getDay() === 0 ? 6 : betTime.getDay() - 1;
                const hour = betTime.getHours();
                const hourSlot = Math.floor(hour / 2) * 2; // 向下取整到最近的2小時倍數
                const dayName = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'][dayOfWeek];
                const key = `${dayName} ${hourSlot.toString().padStart(2, '0')}:00`;
                
                if (!weekStatsMap[key]) {
                    weekStatsMap[key] = {
                        betCount: 0,
                        totalBetAmount: 0,
                        totalPayout: 0,
                        profitLoss: 0
                    };
                }
                weekStatsMap[key].betCount += parseInt(row.bet_count || 0);
                weekStatsMap[key].totalBetAmount += parseFloat(row.total_bet_amount || 0);
                weekStatsMap[key].totalPayout += parseFloat(row.total_payout || 0);
                weekStatsMap[key].profitLoss += parseFloat(row.profit_loss || 0);
            });
            
            const weekStatsData = {
                betCount: weekTimeSeries.rows.reduce((sum, row) => sum + parseInt(row.bet_count || 0), 0),
                totalBetAmount: weekTimeSeries.rows.reduce((sum, row) => sum + parseFloat(row.total_bet_amount || 0), 0),
                totalPayout: weekTimeSeries.rows.reduce((sum, row) => sum + parseFloat(row.total_payout || 0), 0),
                profitLoss: 0,
                timeSeries: {
                    labels: weekHours,
                    betAmount: weekHours.map(label => weekStatsMap[label]?.totalBetAmount || 0),
                    payout: weekHours.map(label => weekStatsMap[label]?.totalPayout || 0),
                    profitLoss: weekHours.map(label => weekStatsMap[label]?.profitLoss || 0)
                }
            };
            weekStatsData.profitLoss = weekStatsData.totalBetAmount - weekStatsData.totalPayout;

            // 當月統計 + 時間序列（按日）
            const monthDays = generateMonthDays(monthStart, now);
            const monthTimeSeries = await db.query(`
                SELECT 
                    DATE(bet_time) as date,
                    COUNT(*) as bet_count,
                    COALESCE(SUM(amount), 0) as total_bet_amount,
                    COALESCE(SUM(CASE WHEN status = 'won' THEN amount * payout_multiplier ELSE 0 END), 0) as total_payout,
                    COALESCE(SUM(amount), 0) - COALESCE(SUM(CASE WHEN status = 'won' THEN amount * payout_multiplier ELSE 0 END), 0) as profit_loss
                FROM bets 
                WHERE bet_time >= $1
                GROUP BY DATE(bet_time)
                ORDER BY date
            `, [monthStart]);
            const monthStatsMap = {};
            monthTimeSeries.rows.forEach(row => {
                const date = new Date(row.date);
                const key = `${date.getMonth() + 1}/${date.getDate()}`;
                monthStatsMap[key] = {
                    betCount: parseInt(row.bet_count),
                    totalBetAmount: parseFloat(row.total_bet_amount),
                    totalPayout: parseFloat(row.total_payout),
                    profitLoss: parseFloat(row.profit_loss)
                };
            });
            const monthStatsData = {
                betCount: monthTimeSeries.rows.reduce((sum, row) => sum + parseInt(row.bet_count || 0), 0),
                totalBetAmount: monthTimeSeries.rows.reduce((sum, row) => sum + parseFloat(row.total_bet_amount || 0), 0),
                totalPayout: monthTimeSeries.rows.reduce((sum, row) => sum + parseFloat(row.total_payout || 0), 0),
                profitLoss: 0,
                timeSeries: {
                    labels: monthDays,
                    betAmount: monthDays.map(day => monthStatsMap[day]?.totalBetAmount || 0),
                    payout: monthDays.map(day => monthStatsMap[day]?.totalPayout || 0),
                    profitLoss: monthDays.map(day => monthStatsMap[day]?.profitLoss || 0)
                }
            };
            monthStatsData.profitLoss = monthStatsData.totalBetAmount - monthStatsData.totalPayout;

            // 上月統計 + 時間序列（按日）
            const lastMonthDays = generateMonthDays(lastMonthStart, lastMonthEnd);
            const lastMonthTimeSeries = await db.query(`
                SELECT 
                    DATE(bet_time) as date,
                    COUNT(*) as bet_count,
                    COALESCE(SUM(amount), 0) as total_bet_amount,
                    COALESCE(SUM(CASE WHEN status = 'won' THEN amount * payout_multiplier ELSE 0 END), 0) as total_payout,
                    COALESCE(SUM(amount), 0) - COALESCE(SUM(CASE WHEN status = 'won' THEN amount * payout_multiplier ELSE 0 END), 0) as profit_loss
                FROM bets 
                WHERE bet_time >= $1 AND bet_time <= $2
                GROUP BY DATE(bet_time)
                ORDER BY date
            `, [lastMonthStart, lastMonthEnd]);
            const lastMonthStatsMap = {};
            lastMonthTimeSeries.rows.forEach(row => {
                const date = new Date(row.date);
                const key = `${date.getMonth() + 1}/${date.getDate()}`;
                lastMonthStatsMap[key] = {
                    betCount: parseInt(row.bet_count),
                    totalBetAmount: parseFloat(row.total_bet_amount),
                    totalPayout: parseFloat(row.total_payout),
                    profitLoss: parseFloat(row.profit_loss)
                };
            });
            const lastMonthStatsData = {
                betCount: lastMonthTimeSeries.rows.reduce((sum, row) => sum + parseInt(row.bet_count || 0), 0),
                totalBetAmount: lastMonthTimeSeries.rows.reduce((sum, row) => sum + parseFloat(row.total_bet_amount || 0), 0),
                totalPayout: lastMonthTimeSeries.rows.reduce((sum, row) => sum + parseFloat(row.total_payout || 0), 0),
                profitLoss: 0,
                timeSeries: {
                    labels: lastMonthDays,
                    betAmount: lastMonthDays.map(day => lastMonthStatsMap[day]?.totalBetAmount || 0),
                    payout: lastMonthDays.map(day => lastMonthStatsMap[day]?.totalPayout || 0),
                    profitLoss: lastMonthDays.map(day => lastMonthStatsMap[day]?.profitLoss || 0)
                }
            };
            lastMonthStatsData.profitLoss = lastMonthStatsData.totalBetAmount - lastMonthStatsData.totalPayout;

            sendSuccess(res, {totalUsers: parseInt(totalUsers),
                totalBets: parseInt(totalBets),
                pendingPayouts: parseInt(pendingPayouts),
                onlineUsers: onlineUsers,
                today: todayStatsData,
                week: weekStatsData,
                month: monthStatsData,
                lastMonth: lastMonthStatsData});
        } catch (error) {
            console.error('[Admin Stats] Error fetching stats:', error);
            sendError(res, 500, 'Internal server error');
        }
    });
}

/**
 * 設置 io 和 connectedUsers（從 index.js 調用）
 */
dashboardRoutes.setIoAndConnectedUsers = (socketIO, users) => {
    io = socketIO;
    connectedUsers = users;
};

module.exports = dashboardRoutes;

