// routes/v1/wallet.js
// 錢包相關路由（提款、充值、密碼）

const db = require('@flipcoin/database');
const bcrypt = require('bcryptjs');
const { sendError, sendSuccess } = require('../../utils/safeResponse');
const { maskAddress, maskTxHash } = require('../../utils/maskUtils');
const withdrawalService = require('../../services/WithdrawalService');
const { withdrawRateLimiter } = require('../../middleware/rateLimiter');
const { validateWithdrawalInput } = require('../../validators/authValidators');
const { logBalanceChange, CHANGE_TYPES } = require('../../utils/balanceChangeLogger');
const crypto = require('crypto'); // Added for password fingerprint

/**
 * 執行自動出款函數（內部使用）
 * @param {Object} withdrawalRequest - 提款請求對象
 * @param {Object} payoutService - PayoutService 實例
 */
async function executeAutoPayout(withdrawalRequest, payoutService) {
    const { id, user_id, amount, chain_type, address } = withdrawalRequest;
    
    try {
        if (chain_type !== 'TRC20') {
             throw new Error(`Chain ${chain_type} not supported for auto-payout.`);
        }
        
        if (!payoutService) {
            throw new Error('PayoutService is not initialized');
        }
        
        if (!payoutService.isReady()) {
            await payoutService.ensureWalletsLoaded();
            if (!payoutService.isReady()) {
                throw new Error('PayoutService is not ready after attempting to load wallets');
            }
        }
        
        const txHash = await payoutService.sendTrc20Payout(withdrawalRequest);
        
        // 出款成功
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(
                `UPDATE withdrawals SET status = 'completed', tx_hash = $1, review_time = NOW(), 
                 rejection_reason = 'Auto-Approved', gas_fee = 0 WHERE id = $2`,
                [txHash, id]
            );
            await client.query(
                `UPDATE platform_transactions SET status = 'completed', tx_hash = $1, updated_at = NOW()
                 WHERE user_id = $2 AND type = 'withdraw_request' AND amount = $3 AND status = 'processing'`,
                [txHash, user_id, -Math.abs(amount)]
            );
            await client.query('COMMIT');
        } catch (dbError) {
            await client.query('ROLLBACK');
            console.error(`[v8 Payout] CRITICAL! Payout ${id} SUCCEEDED on-chain but FAILED to update DB:`, dbError.message);
        } finally {
            client.release();
        }

    } catch (payoutError) {
        // 出款失败
        console.error(`[v8 Payout] ========== AUTO-PAYOUT FAILED ==========`);
        console.error(`[v8 Payout] FAILED (WID: ${id}). Reason: ${payoutError.message}. Reverting to manual review...`);
        console.error(`[v8 Payout] Error stack:`, payoutError.stack);
        try {
            const failureReason = `Auto-Payout Failed: ${payoutError.message.substring(0, 200)}`;
            await db.query(
                `UPDATE withdrawals SET status = 'pending', rejection_reason = $1, review_time = NOW() WHERE id = $2`,
                [failureReason, id]
            );
            await db.query(
                `UPDATE platform_transactions SET status = 'pending', updated_at = NOW()
                 WHERE user_id = $1 AND type = 'withdraw_request' AND amount = $2 AND status = 'processing'`,
                [user_id, -Math.abs(amount)]
            );
        } catch (dbError) {
            console.error(`[v8 Payout] CRITICAL! Payout ${id} FAILED and FAILED to revert status in DB:`, dbError.message);
        }
    }
}

/**
 * 錢包相關路由
 * @param {Router} router - Express router 實例
 * @param {Object} passport - Passport 實例
 * @param {Object} options - 額外選項
 * @param {Object} options.payoutService - PayoutService 實例
 * @param {Object} options.settingsCacheModule - Settings cache 模組
 * @param {Object} options.connectedUsers - 連接用戶映射
 * @param {Object} options.io - Socket.IO 實例
 */
function walletRoutes(router, passport, options = {}) {
    const { payoutService, settingsCacheModule, connectedUsers, io } = options;

    // POST /api/v1/users/set-withdrawal-password - 設置提款密碼
    router.post('/api/v1/users/set-withdrawal-password', passport.authenticate('jwt', { session: false }), async (req, res) => {
        const { login_password, new_password } = req.body;
        const user = req.user;

        if (!login_password || !new_password || new_password.length < 6) {
            return sendError(res, 400, '登入密码为必填，且新提款密码长度至少 6 位。');
        }
        try {
            const fullUser = await db.query('SELECT password_hash, has_withdrawal_password FROM users WHERE id = $1', [user.id]);
            if (fullUser.rows[0].has_withdrawal_password) {
                 return sendError(res, 400, '提款密码已设置。');
            }
            const isMatch = await bcrypt.compare(login_password, fullUser.rows[0].password_hash);
            if (!isMatch) {
                return sendError(res, 401, '登入密码错误。');
            }
            const salt = await bcrypt.genSalt(10);
            const withdrawal_hash = await bcrypt.hash(new_password, salt);
            // 生成資金密碼指紋（SHA256）用於比較相同密碼
            const withdrawal_password_fingerprint = crypto.createHash('sha256').update(new_password).digest('hex');
            // 首次設置資金密碼時，同時保存到 original_withdrawal_password_hash 和指紋
            await db.query(
                `UPDATE users 
                 SET withdrawal_password_hash = $1, 
                     original_withdrawal_password_hash = COALESCE(original_withdrawal_password_hash, $1),
                     withdrawal_password_fingerprint = COALESCE(withdrawal_password_fingerprint, $2),
                     has_withdrawal_password = true 
                 WHERE id = $3`,
                [withdrawal_hash, withdrawal_password_fingerprint, user.id]
            );
            return sendSuccess(res, { message: '提款密码设置成功' });
        } catch (error) {
            console.error('[Set Withdrawal Password] Error:', error);
            return sendError(res, 500, '服务器内部错误。');
        }
    });

    // PATCH /api/v1/users/update-withdrawal-password - 更新提款密碼
    router.patch('/api/v1/users/update-withdrawal-password', passport.authenticate('jwt', { session: false }), async (req, res) => {
        const { old_password, new_password } = req.body;
        const user = req.user;

        if (!old_password || !new_password || new_password.length < 6) {
            return sendError(res, 400, '旧密码和新密码为必填，且新密码长度至少 6 位。');
        }
        try {
            const fullUser = await db.query('SELECT withdrawal_password_hash FROM users WHERE id = $1', [user.id]);
            if (!fullUser.rows[0].withdrawal_password_hash) {
                return sendError(res, 400, '尚未设置提款密码。');
            }
            const isMatch = await bcrypt.compare(old_password, fullUser.rows[0].withdrawal_password_hash);
            if (!isMatch) {
                return sendError(res, 401, '旧提款密码错误。');
            }
            const salt = await bcrypt.genSalt(10);
            const withdrawal_hash = await bcrypt.hash(new_password, salt);
            await db.query(
                'UPDATE users SET withdrawal_password_hash = $1 WHERE id = $2',
                [withdrawal_hash, user.id]
            );
            return sendSuccess(res, { message: '提款密码修改成功' });
        } catch (error) {
            console.error('[Update Withdrawal Password] Error:', error);
            return sendError(res, 500, '服务器内部错误。');
        }
    });

    // POST /api/v1/users/request-withdrawal - 請求提款
    router.post('/api/v1/users/request-withdrawal',
        withdrawRateLimiter,
        validateWithdrawalInput,
        passport.authenticate('jwt', { session: false }),
        async (req, res) => {
        const { chain_type, address, amount, withdrawal_password } = req.body;
        const user = req.user;
        const withdrawalAmount = parseFloat(amount);
        
        // 1. 基本验证
        if (!chain_type || !address || !withdrawalAmount || withdrawalAmount <= 0 || !withdrawal_password) {
             return sendError(res, 400, '所有栏位均为必填。');
        }
        const MIN_WITHDRAWAL = parseFloat(process.env.MIN_WITHDRAWAL_AMOUNT || '10');
        if (withdrawalAmount < MIN_WITHDRAWAL) {
             return sendError(res, 400, `最小提款金额为 ${MIN_WITHDRAWAL} USDT。`);
        }

        // 2. 检查自动出款资格
        const settingsCache = settingsCacheModule.getSettingsCache();
        const threshold = parseFloat(settingsCache['AUTO_WITHDRAW_THRESHOLD']?.value || '0');
        
        const isAutoPayoutEligible = payoutService && 
                                     payoutService.isReady() &&
                                     threshold > 0 && 
                                     withdrawalAmount <= threshold && 
                                     chain_type === 'TRC20';

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            
            // 3. 锁定用户并检查所有条件
            const userResult = await client.query(
                'SELECT balance, withdrawal_password_hash, has_withdrawal_password FROM users WHERE id = $1 FOR UPDATE',
                [user.id]
            );
            const userData = userResult.rows[0];

            if (!userData.has_withdrawal_password) {
                throw new Error('尚未设置提款密码');
            }
            if (parseFloat(userData.balance) < withdrawalAmount) {
                throw new Error('余额不足');
            }
            
            const isPwdMatch = await bcrypt.compare(withdrawal_password, userData.withdrawal_password_hash);
            if (!isPwdMatch) {
                throw new Error('提款密码错误');
            }

            // 4. 扣款
            const updatedUserResult = await client.query(
                'UPDATE users SET balance = balance - $1 WHERE id = $2 RETURNING *',
                [withdrawalAmount, user.id]
            );
            const updatedUser = updatedUserResult.rows[0];

            let withdrawalStatus, platformTxStatus, responseMessage, rejectionReason;

            if (isAutoPayoutEligible) {
                withdrawalStatus = 'processing';
                platformTxStatus = 'processing';
                responseMessage = '提款请求已批准，正在自动出款...';
                rejectionReason = 'Auto-Payout Queued';
            } else {
                withdrawalStatus = 'pending';
                platformTxStatus = 'pending';
                responseMessage = '提款请求已提交，待審核';
                rejectionReason = null;
            }

            // 5. 創建 withdrawals 提款单
            const wdResult = await client.query(
                `INSERT INTO withdrawals (user_id, chain_type, address, amount, status, rejection_reason)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [user.user_id, chain_type, address, withdrawalAmount, withdrawalStatus, rejectionReason]
            );
            const withdrawalRequest = wdResult.rows[0];
            
            // 6. 創建 platform_transactions 资金流水
            await client.query(
                `INSERT INTO platform_transactions (user_id, type, chain, amount, status)
                 VALUES ($1, 'withdraw_request', $2, $3, $4)`,
                 [user.user_id, chain_type, -Math.abs(withdrawalAmount), platformTxStatus]
            );

            // 6b. 记录账变（提款扣款）
            try {
                const newBalance = parseFloat(updatedUser.balance);
                await logBalanceChange({
                    user_id: user.user_id,
                    change_type: CHANGE_TYPES.WITHDRAWAL,
                    amount: -withdrawalAmount,
                    balance_after: newBalance,
                    remark: `提款申请 ${withdrawalAmount} USDT, 提款单ID: ${withdrawalRequest.id}, 地址: ${address}`,
                    client: client
                });
            } catch (error) {
                console.error('[Server] Failed to log balance change (withdrawal):', error);
            }

            // 7. 提交事务
            await client.query('COMMIT');
            
            // 8. 通知前台余额变动
            delete updatedUser.password_hash;
            delete updatedUser.withdrawal_password_hash;
            const socketId = connectedUsers[user.user_id];
            if (socketId) {
                io.to(socketId).emit('user_info_updated', updatedUser);
            }

            // 9. 如果提款狀態為 pending，通知管理員
            if (withdrawalStatus === 'pending') {
                withdrawalService.notifyAdminPendingWithdrawalCount().catch(err => {
                    console.error('[Wallet] Failed to notify admin pending withdrawal count:', err);
                });
            }

            // 9. 回應 HTTP 請求
            sendSuccess(res, { message: responseMessage }, 201);
            
            // 10. 異步執行鏈上出款（在回應後）
            if (isAutoPayoutEligible && payoutService) {
                // 使用 setImmediate 確保回應已發送
                setImmediate(() => {
                    executeAutoPayout(withdrawalRequest, payoutService).catch(err => {
                        console.error('[Payout] Unhandled error in executeAutoPayout:', err);
                    });
                });
            }

        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`[API] Withdrawal request failed for ${user.user_id}:`, error);
            return sendError(res, 400, error.message || '提款失败。');
        } finally {
            client.release();
        }
    });
    
    // GET /api/v1/users/withdrawals - 獲取提款歷史
    router.get('/api/v1/users/withdrawals', passport.authenticate('jwt', { session: false }), async (req, res) => {
        try {
            const history = await withdrawalService.getUserWithdrawals(req.user.user_id);
            return sendSuccess(res, history);
        } catch (error) {
            console.error(`[API v1] Error fetching withdrawal history for ${req.user.user_id}:`, error);
            return sendError(res, 500, '伺服器内部错误。');
        }
    });
    
    // GET /api/v1/users/deposits - 獲取充值歷史
    router.get('/api/v1/users/deposits', passport.authenticate('jwt', { session: false }), async (req, res) => {
        try {
            const history = await withdrawalService.getUserDeposits(req.user.user_id);
            return sendSuccess(res, history);
        } catch (error) {
            console.error(`[API v1] Error fetching deposit history for ${req.user.user_id}:`, error);
            return sendError(res, 500, '伺服器内部错误。');
        }
    });
}

module.exports = walletRoutes;

