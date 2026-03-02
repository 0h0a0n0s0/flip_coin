// routes/v1/gdpr.js
// GDPR 用戶權利相關路由（資料匯出、帳號刪除）

const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth');
const { exportUserData, deleteUserAccount, checkAccountDeletionEligibility } = require('../../services/GdprService');
const { verifyUserPassword } = require('../../services/UserService');
const { sendError, sendSuccess } = require('../../utils/safeResponse');
const { getClientIp } = require('../../utils/ipUtils');

/**
 * @route GET /api/v1/gdpr/export-data
 * @description 匯出用戶的所有個人資料（GDPR Article 20: Right to Data Portability）
 * @access Private (需要 JWT Token)
 */
router.get('/export-data', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.user_id;
        
        console.log(`[GDPR] User ${userId} requested data export from IP ${getClientIp(req)}`);
        
        const exportData = await exportUserData(userId);
        
        // 設定下載標頭
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="user_data_${userId}_${Date.now()}.json"`);
        
        res.status(200).json(exportData);
    } catch (error) {
        console.error('[GDPR] Error exporting user data:', error);
        sendError(res, 500, 'Failed to export user data');
    }
});

/**
 * @route POST /api/v1/gdpr/check-deletion-eligibility
 * @description 檢查用戶是否有權刪除帳號（預檢查）
 * @access Private (需要 JWT Token)
 */
router.post('/check-deletion-eligibility', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.user_id;
        
        const eligibility = await checkAccountDeletionEligibility(userId);
        
        sendSuccess(res, eligibility);
    } catch (error) {
        console.error('[GDPR] Error checking deletion eligibility:', error);
        sendError(res, 500, 'Failed to check deletion eligibility');
    }
});

/**
 * @route POST /api/v1/gdpr/delete-account
 * @description 刪除用戶帳號（GDPR Article 17: Right to Erasure）
 * @access Private (需要 JWT Token + 密碼驗證)
 * @body { password: string, reason?: string }
 */
router.post('/delete-account', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { password, reason } = req.body;
        
        // 1. 驗證必填參數
        if (!password) {
            return sendError(res, 400, 'Password is required for account deletion');
        }
        
        // 2. 驗證密碼（Re-authentication）
        const isPasswordValid = await verifyUserPassword(req.user, password);
        
        if (!isPasswordValid) {
            console.warn(`[GDPR] Failed account deletion attempt for user ${userId}: Invalid password`);
            return sendError(res, 401, 'Invalid password');
        }
        
        // 3. 預檢查
        const eligibility = await checkAccountDeletionEligibility(userId);
        
        if (!eligibility.eligible) {
            return sendError(res, 400, eligibility.reason);
        }
        
        // 4. 執行刪除
        console.log(`[GDPR] User ${userId} initiated account deletion from IP ${getClientIp(req)}`);
        
        const result = await deleteUserAccount(userId, reason || 'User request (GDPR)');
        
        // 5. 清除客戶端 Session（登出）
        res.clearCookie('token');
        
        sendSuccess(res, result);
    } catch (error) {
        console.error('[GDPR] Error deleting user account:', error);
        
        if (error.message.includes('Cannot delete account')) {
            return sendError(res, 400, error.message);
        }
        
        sendError(res, 500, 'Failed to delete user account');
    }
});

module.exports = router;
