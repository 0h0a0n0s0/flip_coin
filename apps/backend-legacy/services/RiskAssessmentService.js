// services/RiskAssessmentService.js
// Guardian 提現風險評估服務
// 提供：黑名單檢查、勝率計算、關聯用戶分析、財務摘要

const db = require('@flipcoin/database');
const settingsCacheModule = require('./settingsCache');

/**
 * 檢查提現地址是否在黑名單中
 * @param {string} address - 提現地址
 * @param {string} chain - 鏈類型（可選）
 * @returns {Promise<boolean>} - true 表示在黑名單中
 */
async function isAddressBlacklisted(address, chain = null) {
    try {
        let query = 'SELECT COUNT(*) FROM withdrawal_address_blacklist WHERE address = $1';
        const params = [address];
        
        if (chain) {
            query += ' AND (chain IS NULL OR chain = $2)';
            params.push(chain);
        }
        
        const result = await db.query(query, params);
        return parseInt(result.rows[0].count, 10) > 0;
    } catch (error) {
        console.error('[RiskAssessment] Error checking blacklist:', error);
        return false; // 發生錯誤時，不阻止提現，只記錄錯誤
    }
}

/**
 * 計算用戶的風險指標（勝率、投注數等）
 * @param {number} userId - 用戶ID
 * @returns {Promise<Object>} - 風險指標對象
 */
async function calculateUserRiskProfile(userId) {
    try {
        // 1. 計算勝率和投注數
        const betsResult = await db.query(
            `SELECT 
                COUNT(*) as total_bet_count,
                COUNT(CASE WHEN status = 'won' THEN 1 END) as won_count,
                COUNT(CASE WHEN status = 'lost' THEN 1 END) as lost_count,
                COALESCE(SUM(CASE WHEN status = 'won' THEN amount * (payout_multiplier - 1) ELSE -amount END), 0) as net_profit_from_bets
             FROM bets 
             WHERE user_id = $1 AND status IN ('won', 'lost')`,
            [userId]
        );
        
        const betStats = betsResult.rows[0];
        const totalBetCount = parseInt(betStats.total_bet_count, 10);
        const wonCount = parseInt(betStats.won_count, 10);
        const winRate = totalBetCount > 0 ? (wonCount / totalBetCount) * 100 : 0;
        
        // 2. 計算財務摘要（充值、提現、淨利潤）
        const financialResult = await db.query(
            `SELECT 
                COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0) as total_deposit,
                COALESCE(SUM(CASE WHEN type = 'withdraw_request' THEN ABS(amount) ELSE 0 END), 0) as total_withdrawal
             FROM platform_transactions 
             WHERE user_id = $1 AND status IN ('completed', 'pending', 'processing')`,
            [userId]
        );
        
        const financial = financialResult.rows[0];
        const totalDeposit = parseFloat(financial.total_deposit) || 0;
        const totalWithdrawal = parseFloat(financial.total_withdrawal) || 0;
        const netProfitFromBets = parseFloat(betStats.net_profit_from_bets) || 0;
        
        // 淨利潤 = 投注盈虧 + 充值 - 提現
        const netProfit = netProfitFromBets + totalDeposit - totalWithdrawal;
        
        // 3. 計算關聯IP數量（最近登錄IP）
        const ipResult = await db.query(
            `SELECT COUNT(DISTINCT u.user_id) as related_ip_count
             FROM users u
             WHERE u.last_login_ip IN (SELECT DISTINCT last_login_ip FROM users WHERE user_id = $1 AND last_login_ip IS NOT NULL)
             AND u.user_id != $1`,
            [userId]
        );
        const relatedIpCount = parseInt(ipResult.rows[0].related_ip_count, 10) || 0;
        
        // 4. 計算關聯設備ID數量
        const deviceResult = await db.query(
            `SELECT COUNT(DISTINCT u.user_id) as related_device_count
             FROM users u
             WHERE u.device_id IN (SELECT device_id FROM users WHERE user_id = $1 AND device_id IS NOT NULL)
             AND u.user_id != $1`,
            [userId]
        );
        const relatedDeviceCount = parseInt(deviceResult.rows[0].related_device_count, 10) || 0;
        
        return {
            win_rate: parseFloat(winRate.toFixed(2)),
            total_bet_count: totalBetCount,
            won_count: wonCount,
            lost_count: parseInt(betStats.lost_count, 10),
            related_ip_count: relatedIpCount,
            related_device_count: relatedDeviceCount,
            financial_summary: {
                total_deposit: totalDeposit,
                total_withdrawal: totalWithdrawal,
                net_profit: netProfit,
                net_profit_from_bets: netProfitFromBets
            }
        };
    } catch (error) {
        console.error('[RiskAssessment] Error calculating risk profile:', error);
        // 返回空數據，不阻止流程
        return {
            win_rate: 0,
            total_bet_count: 0,
            won_count: 0,
            lost_count: 0,
            related_ip_count: 0,
            related_device_count: 0,
            financial_summary: {
                total_deposit: 0,
                total_withdrawal: 0,
                net_profit: 0,
                net_profit_from_bets: 0
            }
        };
    }
}

/**
 * 評估提現請求是否需要人工審核
 * @param {number} userId - 用戶ID
 * @param {string} address - 提現地址
 * @param {string} chain - 鏈類型
 * @returns {Promise<Object>} - { requiresManualReview: boolean, reason: string }
 */
async function assessWithdrawalRisk(userId, address, chain) {
    try {
        // 1. 檢查黑名單
        const isBlacklisted = await isAddressBlacklisted(address, chain);
        if (isBlacklisted) {
            return {
                requiresManualReview: true,
                reason: '提現地址在黑名單中'
            };
        }
        
        // 2. 獲取系統風控設置
        const settingsCache = settingsCacheModule.getSettingsCache();
        const maxWinRatePercent = parseInt(settingsCache['risk_max_win_rate_percent']?.value || '0', 10);
        const minBetCount = parseInt(settingsCache['risk_min_bet_count']?.value || '0', 10);
        
        // 如果兩個設置都是0，表示風控停用
        if (maxWinRatePercent === 0 && minBetCount === 0) {
            return {
                requiresManualReview: false,
                reason: null
            };
        }
        
        // 3. 計算用戶風險指標
        const riskProfile = await calculateUserRiskProfile(userId);
        
        // 4. 判斷是否觸發風控規則
        const reasons = [];
        
        // 規則1：勝率過高
        if (maxWinRatePercent > 0 && riskProfile.win_rate > maxWinRatePercent) {
            reasons.push(`勝率過高 (${riskProfile.win_rate.toFixed(2)}% > ${maxWinRatePercent}%)`);
        }
        
        // 規則2：投注數過少
        if (minBetCount > 0 && riskProfile.total_bet_count < minBetCount) {
            reasons.push(`投注數過少 (${riskProfile.total_bet_count} < ${minBetCount})`);
        }
        
        if (reasons.length > 0) {
            return {
                requiresManualReview: true,
                reason: reasons.join('; ')
            };
        }
        
        // 通過所有檢查
        return {
            requiresManualReview: false,
            reason: null
        };
    } catch (error) {
        console.error('[RiskAssessment] Error assessing withdrawal risk:', error);
        // 發生錯誤時，為安全起見，轉人工審核
        return {
            requiresManualReview: true,
            reason: '風控系統異常，需人工審核'
        };
    }
}

/**
 * 獲取用戶的完整風險分析報告（供管理員查看）
 * @param {number} userId - 用戶ID
 * @param {string} address - 提現地址
 * @param {string} chain - 鏈類型
 * @returns {Promise<Object>} - 完整的風險分析報告
 */
async function getWithdrawalRiskReport(userId, address, chain) {
    try {
        const [isBlacklisted, riskProfile] = await Promise.all([
            isAddressBlacklisted(address, chain),
            calculateUserRiskProfile(userId)
        ]);
        
        return {
            is_blacklisted: isBlacklisted,
            ...riskProfile
        };
    } catch (error) {
        console.error('[RiskAssessment] Error generating risk report:', error);
        return {
            is_blacklisted: false,
            win_rate: 0,
            total_bet_count: 0,
            won_count: 0,
            lost_count: 0,
            related_ip_count: 0,
            related_device_count: 0,
            financial_summary: {
                total_deposit: 0,
                total_withdrawal: 0,
                net_profit: 0,
                net_profit_from_bets: 0
            }
        };
    }
}

module.exports = {
    isAddressBlacklisted,
    calculateUserRiskProfile,
    assessWithdrawalRisk,
    getWithdrawalRiskReport
};
