// routes/admin/transactions.js
// 交易管理相關路由

const db = require('@flipcoin/database');
const authMiddleware = require('../../middleware/auth');
const checkPermission = require('../../middleware/checkPermissionMiddleware');
const { recordAuditLog } = require('../../services/auditLogService');
const { maskAddress, maskTxHash } = require('../../utils/maskUtils');
const { getClientIp } = require('../../utils/ipUtils');
const { sendError, sendSuccess } = require('../../utils/safeResponse');
const riskControlService = require('../../services/riskControlService');
const riskAssessmentService = require('../../services/RiskAssessmentService');
const { logBalanceChange, CHANGE_TYPES } = require('../../utils/balanceChangeLogger');

/**
 * 交易管理相關路由
 * @param {Router} router - Express router 實例
 */
function transactionsRoutes(router) {
    router.get('/deposits', authMiddleware, checkPermission('deposits', 'read'), async (req, res) => {
        const { page = 1, limit = 10, username, tx_hash, status, user_id, start_time, end_time, user_address, platform_address } = req.query;

        try {
            const params = [];
            let whereClauses = ["pt.type = 'deposit'"]; // (限定类型为 'deposit')
            let paramIndex = 1;

            let startTimeValue = null;
            let endTimeValue = null;

            if (start_time) {
                const parsed = new Date(start_time);
                if (Number.isNaN(parsed.getTime())) {
                    return sendError(res, 400, 'start_time 格式不正确');
                }
                startTimeValue = parsed.toISOString();
            }

            if (end_time) {
                const parsed = new Date(end_time);
                if (Number.isNaN(parsed.getTime())) {
                    return sendError(res, 400, 'end_time 格式不正确');
                }
                endTimeValue = parsed.toISOString();
            }

            if (startTimeValue && endTimeValue && new Date(startTimeValue) > new Date(endTimeValue)) {
                return sendError(res, 400, '开始时间不得晚于结束时间');
            }

            if (username) { params.push(`%${username}%`); whereClauses.push(`u.username ILIKE $${paramIndex++}`); }
            if (status) { params.push(status); whereClauses.push(`pt.status = $${paramIndex++}`); }
            if (tx_hash) { params.push(tx_hash); whereClauses.push(`pt.tx_hash = $${paramIndex++}`); }
            if (user_address) { 
                params.push(user_address); 
                whereClauses.push(`cl.user_deposit_address = $${paramIndex++}`); 
            }
            if (platform_address) { 
                params.push(platform_address); 
                whereClauses.push(`(
                    cl.collection_wallet_address = $${paramIndex} OR 
                    (pt.chain = 'TRC20' AND u.tron_deposit_address = $${paramIndex}) OR
                    (pt.chain != 'TRC20' AND u.evm_deposit_address = $${paramIndex})
                )`); 
                paramIndex++;
            }

            if (user_id) {
                const parsedUserId = parseInt(user_id, 10);
                if (Number.isNaN(parsedUserId)) {
                    return sendError(res, 400, 'user_id 必须为整数');
                }
                params.push(parsedUserId);
                whereClauses.push(`pt.user_id = $${paramIndex++}`);
            }

            if (startTimeValue) {
                params.push(startTimeValue);
                whereClauses.push(`pt.created_at >= $${paramIndex++}`);
            }

            if (endTimeValue) {
                params.push(endTimeValue);
                whereClauses.push(`pt.created_at <= $${paramIndex++}`);
            }

            const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
            const fromSql = `
                FROM platform_transactions pt
                JOIN users u ON pt.user_id = u.user_id
                LEFT JOIN collection_logs cl ON pt.tx_hash = cl.tx_hash AND pt.user_id = cl.user_id
            `;

            const countSql = `SELECT COUNT(pt.id) ${fromSql} ${whereSql}`;
            const countResult = await db.query(countSql, params);
            const total = parseInt(countResult.rows[0].count, 10);

            if (total === 0) {
                return sendSuccess(res, { total: 0, list: [] });
            }

            const dataSql = `
                SELECT 
                    pt.id, pt.chain, pt.amount, pt.status, pt.tx_hash, pt.created_at,
                    u.username,
                    u.user_id,
                    cl.user_deposit_address AS user_address,
                    COALESCE(
                        cl.collection_wallet_address,
                        CASE 
                            WHEN pt.chain = 'TRC20' THEN u.tron_deposit_address
                            ELSE u.evm_deposit_address
                        END
                    ) AS platform_address
                ${fromSql}
                ${whereSql}
                ORDER BY pt.created_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            const offset = (page - 1) * limit;
            params.push(limit);
            params.push(offset);
            const dataResult = await db.query(dataSql, params);

            sendSuccess(res, { total: total, list: dataResult.rows });

        } catch (error) {
            console.error('[Admin Deposits] Error fetching list:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description (新) 获取提款審核列表
     * @route GET /api/admin/withdrawals
     */
    router.get('/withdrawals', authMiddleware, checkPermission('withdrawals', 'read'), async (req, res) => {
        const { page = 1, limit = 10, username, status, address, tx_hash, user_id, start_time, end_time } = req.query;

        try {
            const params = [];
            let whereClauses = [];
            let paramIndex = 1;

            let startTimeValue = null;
            let endTimeValue = null;

            if (start_time) {
                const parsed = new Date(start_time);
                if (Number.isNaN(parsed.getTime())) {
                    return sendError(res, 400, 'start_time 格式不正确');
                }
                startTimeValue = parsed.toISOString();
            }

            if (end_time) {
                const parsed = new Date(end_time);
                if (Number.isNaN(parsed.getTime())) {
                    return sendError(res, 400, 'end_time 格式不正确');
                }
                endTimeValue = parsed.toISOString();
            }

            if (startTimeValue && endTimeValue && new Date(startTimeValue) > new Date(endTimeValue)) {
                return sendError(res, 400, '开始时间不得晚于结束时间');
            }

            if (username) { params.push(`%${username}%`); whereClauses.push(`u.username ILIKE $${paramIndex++}`); }
            if (status) { params.push(status); whereClauses.push(`w.status = $${paramIndex++}`); }
            if (address) { params.push(address); whereClauses.push(`w.address = $${paramIndex++}`); }
            if (tx_hash) { params.push(tx_hash); whereClauses.push(`w.tx_hash = $${paramIndex++}`); }
            if (user_id) {
                const parsedUserId = parseInt(user_id, 10);
                if (Number.isNaN(parsedUserId)) {
                    return sendError(res, 400, 'user_id 必须为整数');
                }
                params.push(parsedUserId);
                whereClauses.push(`w.user_id = $${paramIndex++}`);
            }

            if (startTimeValue) {
                params.push(startTimeValue);
                whereClauses.push(`w.request_time >= $${paramIndex++}`);
            }

            if (endTimeValue) {
                params.push(endTimeValue);
                whereClauses.push(`w.request_time <= $${paramIndex++}`);
            }

            const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : 'WHERE 1=1';

            // (★★★ 关键：计算累计盈虧的子查询 ★★★)
            // (這是一個简化版的 P&L，僅计算 投注盈虧+奖金。注意：這在资料量大时会很慢)
            const pnlSubQuery = `
                (
                    COALESCE((SELECT SUM(CASE WHEN b.status = 'won' THEN b.amount * (b.payout_multiplier - 1) ELSE -b.amount END) FROM bets b WHERE b.user_id = u.user_id), 0)
                    +
                    COALESCE((SELECT SUM(pt.amount) FROM platform_transactions pt WHERE pt.user_id = u.user_id AND pt.type LIKE 'bonus_%' OR pt.type LIKE 'reward%'), 0)
                )
            `;

            const fromSql = `
                FROM withdrawals w
                JOIN users u ON w.user_id = u.user_id
                LEFT JOIN admin_users a ON w.reviewer_id = a.id
            `;

            const countSql = `SELECT COUNT(w.id) ${fromSql} ${whereSql}`;
            const countResult = await db.query(countSql, params);
            const total = parseInt(countResult.rows[0].count, 10);

            if (total === 0) {
                return sendSuccess(res, { total: 0, list: [] });
            }

            const dataSql = `
                SELECT 
                    w.*, 
                    u.username,
                    a.username AS reviewer_name,
                    ${pnlSubQuery} AS total_profit_loss
                ${fromSql}
                ${whereSql}
                ORDER BY w.request_time DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            const offset = (page - 1) * limit;
            params.push(limit);
            params.push(offset);
            const dataResult = await db.query(dataSql, params);

            sendSuccess(res, { total: total, list: dataResult.rows });

        } catch (error) {
            console.error('[Admin Withdrawals] Error fetching list:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description (新) 拒绝提款 (退款)
     * @route POST /api/admin/withdrawals/:id/reject
     */
    router.post('/withdrawals/:id/reject', authMiddleware, checkPermission('withdrawals', 'update'), async (req, res) => {
        const { id } = req.params;
        const { reason } = req.body;
        const reviewerId = req.user.id;

        if (!reason) {
            return sendError(res, 400, '拒绝理由为必填');
        }

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // 1. 查找并锁定提款单
            const wdResult = await client.query("SELECT * FROM withdrawals WHERE id = $1 AND status = 'pending' FOR UPDATE", [id]);
            if (wdResult.rows.length === 0) {
                throw new Error('提款单不存在或狀态已变更');
            }
            const withdrawal = wdResult.rows[0];

            // 2. 更新提款单狀态
            await client.query(
                "UPDATE withdrawals SET status = 'rejected', rejection_reason = $1, reviewer_id = $2, review_time = NOW() WHERE id = $3",
                [reason, reviewerId, id]
            );

            // 3. 退款给用户
            // (★★★ 修復：添加行鎖以確保並發安全 ★★★)
            await client.query(
                'SELECT balance FROM users WHERE user_id = $1 FOR UPDATE',
                [withdrawal.user_id]
            );
            
            const userResult = await client.query(
                "UPDATE users SET balance = balance + $1 WHERE user_id = $2 RETURNING *",
                [withdrawal.amount, withdrawal.user_id]
            );
            const updatedUser = userResult.rows[0];

            // 4. 更新对应的 platform_transaction
            await client.query(
                "UPDATE platform_transactions SET status = 'cancelled' WHERE user_id = $1 AND type = 'withdraw_request' AND amount = $2 AND status = 'pending'",
                [withdrawal.user_id, -Math.abs(withdrawal.amount)]
            );

            // 4b. 记录账变（提款拒绝退款）
            try {
                const newBalance = parseFloat(updatedUser.balance);
                await logBalanceChange({
                    user_id: withdrawal.user_id,
                    change_type: CHANGE_TYPES.WITHDRAWAL,
                    amount: withdrawal.amount,  // 正数表示退款
                    balance_after: newBalance,
                    remark: `提款拒绝退款 ${withdrawal.amount} USDT, 提款单ID: ${id}, 理由: ${reason}, 管理员: ${req.user.username}`,
                    client: client
                });
            } catch (error) {
                console.error('[Admin Withdrawals] Failed to log balance change (reject refund):', error);
                // 不阻止主流程，只记录错误
            }

            await client.query('COMMIT');

            // 5. 记录稽核日志
            await recordAuditLog({
                adminId: req.user.id,
                adminUsername: req.user.username,
                action: 'reject_withdrawal',
                resource: 'withdrawals',
                resourceId: id.toString(),
                description: `拒絕提款 (提款單ID: ${id}, 用戶ID: ${withdrawal.user_id}, 金額: ${withdrawal.amount} USDT, 理由: ${reason})`,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent']
            });

            // 6. 通知用户 (如果在线)
            delete updatedUser.password_hash;
            if (connectedUsers && io) {
                const socketId = connectedUsers[updatedUser.user_id];
                if (socketId) {
                    io.to(socketId).emit('user_info_updated', updatedUser);
                    // (您也可以发送一個自定义的 'withdrawal_rejected' 事件)
                }
            }

            // 7. 通知管理員待審核提款數量更新
            const withdrawalService = require('../../services/WithdrawalService');
            withdrawalService.notifyAdminPendingWithdrawalCount().catch(err => {
                console.error('[Admin Withdrawals] Failed to notify admin pending withdrawal count:', err);
            });

            sendSuccess(res, { message: '提款已拒绝并退款' });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`[Admin Withdrawals] Error rejecting withdrawal ${id}:`, error);
            return sendError(res, 400, error.message || '操作失败');
        } finally {
            client.release();
        }
    });

    /**
     * @description (新) 批准提款 (标记为处理中，等待手动出款)
     * @route POST /api/admin/withdrawals/:id/approve
     */
    router.post('/withdrawals/:id/approve', authMiddleware, checkPermission('withdrawals', 'update'), async (req, res) => {
        const { id } = req.params;
        const reviewerId = req.user.id;

        try {
            const result = await db.query(
                "UPDATE withdrawals SET status = 'processing', reviewer_id = $1, review_time = NOW() WHERE id = $2 AND status = 'pending' RETURNING *",
                [reviewerId, id]
            );

            if (result.rows.length === 0) {
                return sendError(res, 404, '提款单不存在或狀态已变更');
            }

            // 更新 platform_transaction
            await db.query(
                 "UPDATE platform_transactions SET status = 'processing' WHERE user_id = $1 AND type = 'withdraw_request' AND amount = $2 AND status = 'pending'",
                [result.rows[0].user_id, -Math.abs(result.rows[0].amount)]
            );

            // 通知管理員待審核提款數量更新
            const withdrawalService = require('../../services/WithdrawalService');
            withdrawalService.notifyAdminPendingWithdrawalCount().catch(err => {
                console.error('[Admin Withdrawals] Failed to notify admin pending withdrawal count:', err);
            });

            await recordAuditLog({
                adminId: req.user.id,
                adminUsername: req.user.username,
                action: 'approve_withdrawal',
                resource: 'withdrawals',
                resourceId: id.toString(),
                description: `批准提款 (提款單ID: ${id}, 用戶ID: ${result.rows[0].user_id}, 金額: ${result.rows[0].amount} USDT)`,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent']
            });

            sendSuccess(res, { message: '提款已批准，狀态变更为 [处理中]，请手动出款' });

        } catch (error) {
            console.error(`[Admin Withdrawals] Error approving withdrawal ${id}:`, error);
            return sendError(res, 500, '操作失败');
        }
    });

    /**
     * @description 获取账变记录列表
     * @route GET /api/admin/balance-changes
     */
    router.get('/balance-changes', authMiddleware, checkPermission('balance_changes', 'read'), async (req, res) => {
        const { 
            page = 1, 
            limit = 10, 
            user_id, 
            username, 
            change_type, 
            start_time, 
            end_time 
        } = req.query;

        try {
            const params = [];
            let whereClauses = [];
            let paramIndex = 1;

            // 时间范围处理
            let startTimeValue = null;
            let endTimeValue = null;

            if (start_time) {
                const parsed = new Date(start_time);
                if (Number.isNaN(parsed.getTime())) {
                    return sendError(res, 400, 'start_time 格式不正确');
                }
                startTimeValue = parsed.toISOString();
            }

            if (end_time) {
                const parsed = new Date(end_time);
                if (Number.isNaN(parsed.getTime())) {
                    return sendError(res, 400, 'end_time 格式不正确');
                }
                endTimeValue = parsed.toISOString();
            }

            if (startTimeValue && endTimeValue && new Date(startTimeValue) > new Date(endTimeValue)) {
                return sendError(res, 400, '开始时间不得晚于结束时间');
            }

            // 查询条件
            if (user_id) {
                const parsedUserId = parseInt(user_id, 10);
                if (Number.isNaN(parsedUserId)) {
                    return sendError(res, 400, 'user_id 必须为整数');
                }
                params.push(user_id);
                whereClauses.push(`bc.user_id = $${paramIndex++}`);
            }

            if (username) {
                params.push(`%${username}%`);
                whereClauses.push(`u.username ILIKE $${paramIndex++}`);
            }

            if (change_type) {
                params.push(change_type);
                whereClauses.push(`bc.change_type = $${paramIndex++}`);
            }

            if (startTimeValue) {
                params.push(startTimeValue);
                whereClauses.push(`bc.created_at >= $${paramIndex++}`);
            }

            if (endTimeValue) {
                params.push(endTimeValue);
                whereClauses.push(`bc.created_at <= $${paramIndex++}`);
            }

            const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

            const fromSql = `
                FROM balance_changes bc
                LEFT JOIN users u ON bc.user_id = u.user_id
            `;

            // 获取总数
            const countSql = `SELECT COUNT(bc.id) ${fromSql} ${whereSql}`;
            const countResult = await db.query(countSql, params);
            const total = parseInt(countResult.rows[0].count, 10);

            if (total === 0) {
                return sendSuccess(res, { total: 0, list: [] });
            }

            // 获取列表
            const dataSql = `
                SELECT 
                    bc.id,
                    bc.user_id,
                    u.username,
                    bc.change_type,
                    bc.amount,
                    bc.balance_after,
                    bc.remark,
                    bc.created_at
                ${fromSql}
                ${whereSql}
                ORDER BY bc.created_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            const offset = (page - 1) * limit;
            params.push(limit);
            params.push(offset);
            const dataResult = await db.query(dataSql, params);

            sendSuccess(res, { total: total, list: dataResult.rows });

        } catch (error) {
            console.error('[Admin Balance Changes] Error fetching list:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description (新) 手动完成提款 (标记为完成，记录 TX Hash 和 Gas Fee)
     * @route POST /api/admin/withdrawals/:id/complete
     */
    router.post('/withdrawals/:id/complete', authMiddleware, checkPermission('withdrawals', 'update'), async (req, res) => {
        const { id } = req.params;
        const { tx_hash, gas_fee } = req.body;
        const reviewerId = req.user.id;

        if (!tx_hash || !tx_hash.trim()) {
            return sendError(res, 400, 'TX Hash 为必填');
        }

        const gasFeeValue = gas_fee !== undefined && gas_fee !== null ? parseFloat(gas_fee) : 0;
        if (isNaN(gasFeeValue) || gasFeeValue < 0) {
            return sendError(res, 400, 'Gas Fee 必须为有效的数字且大于等于 0');
        }

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // 1. 查找并锁定提款单 (狀态必须为 processing)
            const wdResult = await client.query(
                "SELECT * FROM withdrawals WHERE id = $1 AND status = 'processing' FOR UPDATE",
                [id]
            );

            if (wdResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return sendError(res, 404, '提款单不存在或狀态不是 [处理中]');
            }

            const withdrawal = wdResult.rows[0];

            // 2. 更新提款单狀态为 completed
            await client.query(
                `UPDATE withdrawals 
                 SET status = 'completed', 
                     tx_hash = $1, 
                     gas_fee = $2, 
                     review_time = NOW() 
                 WHERE id = $3`,
                [tx_hash.trim(), gasFeeValue, id]
            );

            // 3. 更新 platform_transactions 表的狀态为 completed
            await client.query(
                `UPDATE platform_transactions 
                 SET status = 'completed', 
                     updated_at = NOW() 
                 WHERE user_id = $1 
                   AND type = 'withdraw_request' 
                   AND amount = $2 
                   AND status = 'processing'`,
                [withdrawal.user_id, -Math.abs(withdrawal.amount)]
            );

            await client.query('COMMIT');

            await recordAuditLog({
                adminId: req.user.id,
                adminUsername: req.user.username,
                action: 'complete_withdrawal',
                resource: 'withdrawals',
                resourceId: id.toString(),
                description: `完成提款 (提款單ID: ${id}, 用戶ID: ${withdrawal.user_id}, 金額: ${withdrawal.amount} USDT, TX Hash: ${tx_hash.trim()}, Gas Fee: ${gasFeeValue} USDT)`,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent']
            });

            sendSuccess(res, { message: '提款已标记为完成' });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`[Admin Withdrawals] Error completing withdrawal ${id}:`, error);
            return sendError(res, 500, error.message || '操作失败');
        } finally {
            client.release();
        }
    });

    // ★★★ 归集管理 - 获取归集设定 ★★★
    /**
     * @description 获取归集设定
     * @route GET /api/admin/collection/settings
     */
    router.get('/collection/settings', authMiddleware, checkPermission('wallets', 'read'), async (req, res) => {
        try {
            const result = await db.query(
                `SELECT cs.*, pw.name as wallet_name 
                 FROM collection_settings cs
                 JOIN platform_wallets pw ON cs.collection_wallet_address = pw.address
                 WHERE pw.is_collection = true AND pw.is_active = true`
            );
            sendSuccess(res, result.rows);
        } catch (error) {
            console.error('[Admin Collection] Error fetching settings:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 更新或創建归集设定
     * @route POST /api/admin/collection/settings
     */
    router.post('/collection/settings', authMiddleware, checkPermission('wallets', 'cud'), async (req, res) => {
        const { collection_wallet_address, scan_interval_days, days_without_deposit, is_active } = req.body;

        if (!collection_wallet_address || !scan_interval_days || !days_without_deposit) {
            return sendError(res, 400, '所有栏位均为必填');
        }

        if (scan_interval_days < 1 || days_without_deposit < 1) {
            return sendError(res, 400, '天数必须大于 0');
        }

        try {
            const result = await db.query(
                `INSERT INTO collection_settings 
                 (collection_wallet_address, scan_interval_days, days_without_deposit, is_active, updated_at) 
                 VALUES ($1, $2, $3, $4, NOW())
                 ON CONFLICT (collection_wallet_address) 
                 DO UPDATE SET 
                     scan_interval_days = $2, 
                     days_without_deposit = $3, 
                     is_active = $4, 
                     updated_at = NOW()
                 RETURNING *`,
                [collection_wallet_address, scan_interval_days, days_without_deposit, !!is_active]
            );

            console.log(`[Admin Collection] Settings updated for wallet ${collection_wallet_address} by ${req.user.username}`);
            sendSuccess(res, result.rows[0]);
        } catch (error) {
            console.error('[Admin Collection] Error updating settings:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    // ★★★ 钱包监控 - 获取各类钱包余额 ★★★
    /**
     * @description 获取钱包监控数据（各类钱包余额）
     * @route GET /api/admin/wallet-monitoring
     */
    router.get('/wallet-monitoring', authMiddleware, checkPermission('wallets', 'read'), async (req, res) => {
        try {
            const TronWeb = require('tronweb');

            const NILE_NODE_HOST = process.env.NILE_NODE_HOST;
            const USDT_CONTRACT_ADDRESS = process.env.USDT_CONTRACT_ADDRESS || 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';
            const USDT_DECIMALS = 6;

            const tronWeb = new TronWeb({
                fullHost: NILE_NODE_HOST,
                solidityHost: NILE_NODE_HOST,
                privateKey: '01'
            });
            tronWeb.setFullNode(NILE_NODE_HOST);
            tronWeb.setSolidityNode(NILE_NODE_HOST);

            const usdtContractHex = tronWeb.address.toHex(USDT_CONTRACT_ADDRESS);

            // 获取所有 TRC20 平台钱包
            const walletsResult = await db.query(
                "SELECT * FROM platform_wallets WHERE chain_type = 'TRC20' AND is_active = true"
            );

            const walletMonitoring = {
                payout: [],      // 自动出款类型
                collection: [],  // 归集类型
                gasReserve: [],   // Gas储备类型
                energyProvider: [] // 能量提供者类型
            };

            // 获取余额的辅助函数
            const getTrxBalance = async (address) => {
                try {
                    const balance = await tronWeb.trx.getBalance(address);
                    return parseFloat(tronWeb.fromSun(balance));
                } catch (error) {
                    console.error(`[Wallet Monitoring] Error getting TRX balance for ${address}:`, error.message);
                    return 0;
                }
            };

            const getUsdtBalance = async (address) => {
                try {
                    const addressHex = tronWeb.address.toHex(address);
                    const transaction = await tronWeb.transactionBuilder.triggerConstantContract(
                        usdtContractHex,
                        'balanceOf(address)',
                        {},
                        [{ type: 'address', value: addressHex }],
                        addressHex
                    );

                    if (!transaction || !transaction.constant_result || !transaction.constant_result[0]) {
                        return 0;
                    }

                    const balance = '0x' + transaction.constant_result[0];
                    const balanceBigInt = BigInt(balance);
                    return parseFloat(balanceBigInt.toString()) / Math.pow(10, USDT_DECIMALS);
                } catch (error) {
                    console.error(`[Wallet Monitoring] Error getting USDT balance for ${address}:`, error.message);
                    return 0;
                }
            };

            const getEnergy = async (address) => {
                try {
                    // 更贴近 TronScan: Remaining = EnergyLimit - EnergyUsed
                    const resources = await tronWeb.trx.getAccountResources(address);
                    const energyLimit = Number(resources?.EnergyLimit || 0);
                    const energyUsed = Number(resources?.EnergyUsed || 0);
                    const remaining = energyLimit - energyUsed;
                    if (Number.isFinite(remaining)) {
                        return Math.max(0, remaining);
                    }
                    return 0;
                } catch (error) {
                    console.error(`[Wallet Monitoring] Error getting energy for ${address}:`, error.message);
                    return 0;
                }
            };

            const getStakedTrx = async (address) => {
                try {
                    const account = await tronWeb.trx.getAccount(address);
                    const toNumber = (v) => {
                        if (v === null || v === undefined) return 0;
                        const n = Number(v);
                        return Number.isFinite(n) ? n : 0;
                    };
                    let totalSun = 0;
                    const frozen = account && account.frozen ? account.frozen : [];
                    if (Array.isArray(frozen)) {
                        for (const f of frozen) totalSun += toNumber(f?.frozen_balance);
                    } else if (typeof frozen === 'object') {
                        totalSun += toNumber(frozen.frozen_balance);
                    }
                    const frozenV2 = account && account.frozenV2 ? account.frozenV2 : [];
                    if (Array.isArray(frozenV2)) {
                        for (const f of frozenV2) totalSun += toNumber(f?.amount);
                    }
                    return totalSun / 1_000_000;
                } catch (error) {
                    console.error(`[Wallet Monitoring] Error getting staked TRX for ${address}:`, error.message);
                    return 0;
                }
            };

            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'transactions.js:wallet-monitoring',message:'starting parallel processing',data:{walletCount:walletsResult.rows.length},timestamp:Date.now()})}).catch(()=>{});
            // #endregion

            // 并行处理所有钱包（避免串行导致超时）
            const walletPromises = walletsResult.rows.map(async (wallet) => {
                const walletInfo = {
                    id: wallet.id,
                    name: wallet.name,
                    address: wallet.address,
                    trxBalance: 0,
                    usdtBalance: 0,
                    energy: 0,
                    stakedTrx: 0
                };

                const walletStartTime = Date.now();
                try {
                    // 并行获取基础余额
                    const [trxBalance, usdtBalance] = await Promise.all([
                        getTrxBalance(wallet.address),
                        getUsdtBalance(wallet.address)
                    ]);
                    walletInfo.trxBalance = trxBalance;
                    walletInfo.usdtBalance = usdtBalance;

                    // 归集 / 能量提供者需要能量
                    if (wallet.is_collection || wallet.is_energy_provider) {
                        walletInfo.energy = await getEnergy(wallet.address);
                    }

                    // 能量提供者：显示质押 TRX（而非可用余额）
                    if (wallet.is_energy_provider) {
                        walletInfo.stakedTrx = await getStakedTrx(wallet.address);
                        // #region agent log
                        fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H4',location:'transactions.js:energy-provider',message:'stakedTrx fetched',data:{address:wallet.address,stakedTrx:walletInfo.stakedTrx,trxBalance:walletInfo.trxBalance},timestamp:Date.now()})}).catch(()=>{});
                        // #endregion
                    }
                } catch (error) {
                    console.error(`[Wallet Monitoring] Error processing wallet ${wallet.address}:`, error.message);
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H2',location:'transactions.js:wallet-processing',message:'wallet error',data:{address:wallet.address,error:error.message},timestamp:Date.now()})}).catch(()=>{});
                    // #endregion
                }

                const walletElapsed = Date.now() - walletStartTime;
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H3',location:'transactions.js:wallet-processing',message:'wallet completed',data:{address:wallet.address,elapsedMs:walletElapsed},timestamp:Date.now()})}).catch(()=>{});
                // #endregion

                // 分类钱包
                if (wallet.is_payout) {
                    walletMonitoring.payout.push(walletInfo);
                }
                if (wallet.is_collection) {
                    walletMonitoring.collection.push(walletInfo);
                }
                if (wallet.is_gas_reserve) {
                    walletMonitoring.gasReserve.push(walletInfo);
                }
                if (wallet.is_energy_provider) {
                    walletMonitoring.energyProvider.push(walletInfo);
                }

                return walletInfo;
            });

            const totalStartTime = Date.now();
            await Promise.all(walletPromises);
            const totalElapsed = Date.now() - totalStartTime;
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'transactions.js:wallet-monitoring',message:'all wallets processed',data:{totalElapsedMs:totalElapsed,walletCount:walletsResult.rows.length},timestamp:Date.now()})}).catch(()=>{});
            // #endregion

            return sendSuccess(res, walletMonitoring);
        } catch (error) {
            console.error('[Admin Wallet Monitoring] Error:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    // ★★★ 归集管理 - 获取归集记录 ★★★
    /**
     * @description 获取归集记录列表
     * @route GET /api/admin/collection/logs
     */
    router.get('/collection/logs', authMiddleware, checkPermission('reports', 'read'), async (req, res) => {
        const { 
            page = 1, limit = 10,
            userId, 
            user_deposit_address,
            collection_wallet_address,
            dateRange,
            status
        } = req.query;

        try {
            const params = [];
            let whereClauses = [];
            let paramIndex = 1;

            if (userId) { 
                params.push(`%${userId}%`); 
                whereClauses.push(`cl.user_id ILIKE $${paramIndex++}`); 
            }
            if (user_deposit_address) { 
                params.push(user_deposit_address); 
                whereClauses.push(`cl.user_deposit_address = $${paramIndex++}`); 
            }
            if (collection_wallet_address) { 
                params.push(collection_wallet_address); 
                whereClauses.push(`cl.collection_wallet_address = $${paramIndex++}`); 
            }
            if (status) { 
                params.push(status); 
                whereClauses.push(`cl.status = $${paramIndex++}`); 
            }
            if (dateRange) { 
                try {
                    const [startDate, endDate] = JSON.parse(dateRange);
                    params.push(startDate); 
                    whereClauses.push(`cl.created_at >= $${paramIndex++}`);
                    params.push(endDate); 
                    whereClauses.push(`cl.created_at <= $${paramIndex++}`);
                } catch (e) {}
            }

            const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

            // 获取总数
            const countSql = `SELECT COUNT(cl.id) FROM collection_logs cl ${whereSql}`;
            const countResult = await db.query(countSql, params);
            const total = parseInt(countResult.rows[0].count, 10);

            if (total === 0) {
                return sendSuccess(res, { total: 0, list: [], totalAmount: 0 });
            }

            // 获取总金额
            const totalAmountSql = `SELECT COALESCE(SUM(cl.amount), 0) as total_amount FROM collection_logs cl ${whereSql}`;
            const totalAmountResult = await db.query(totalAmountSql, params);
            const totalAmount = parseFloat(totalAmountResult.rows[0].total_amount || 0);

            // 获取列表
            const dataSql = `
                SELECT 
                    cl.id, cl.user_id, cl.user_deposit_address, 
                    cl.collection_wallet_address, cl.amount, cl.tx_hash, 
                    cl.energy_used, cl.status, cl.error_message, cl.created_at,
                    u.username
                FROM collection_logs cl
                LEFT JOIN users u ON cl.user_id = u.user_id
                ${whereSql}
                ORDER BY cl.created_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            const offset = (page - 1) * limit;
            params.push(limit);
            params.push(offset);
            const dataResult = await db.query(dataSql, params);
            const list = dataResult.rows.map(row => ({
                ...row,
                user_deposit_address_masked: maskAddress(row.user_deposit_address || ''),
                collection_wallet_address_masked: maskAddress(row.collection_wallet_address || ''),
                tx_hash_masked: maskTxHash(row.tx_hash || '')
            }));

            // 计算当前页的总金额
            const pageTotalAmount = dataResult.rows.reduce((sum, row) => sum + parseFloat(row.amount || 0), 0);

            sendSuccess(res, {total, 
                list,
                totalAmount: totalAmount,
                pageTotalAmount: pageTotalAmount});
        } catch (error) {
            console.error('[Admin Collection] Error fetching logs:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    // ★★★ 後台稽核日誌 ★★★
    router.get('/audit-logs', authMiddleware, checkPermission('admin_permissions', 'read'), async (req, res) => {
        const {
            page = 1,
            limit = 20,
            adminUsername,
            action,
            dateRange
        } = req.query;

        try {
            const params = [];
            let whereClauses = [];
            let paramIndex = 1;

            if (adminUsername) {
                params.push(`%${adminUsername}%`);
                whereClauses.push(`aal.admin_username ILIKE $${paramIndex++}`);
            }

            if (action) {
                params.push(`%${action}%`);
                whereClauses.push(`aal.action ILIKE $${paramIndex++}`);
            }

            if (dateRange) {
                try {
                    const [startDate, endDate] = JSON.parse(dateRange);
                    params.push(startDate);
                    whereClauses.push(`aal.created_at >= $${paramIndex++}`);
                    params.push(endDate);
                    whereClauses.push(`aal.created_at <= $${paramIndex++}`);
                } catch (e) {
                    console.error('[Admin Audit] Error parsing dateRange:', e);
                }
            }

            const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

            const countSql = `SELECT COUNT(*) as count FROM admin_audit_logs aal ${whereSql}`;
            const countResult = await db.query(countSql, params);
            const total = parseInt(countResult.rows[0].count, 10);

            if (total === 0) {
                return sendSuccess(res, { total: 0, list: [] });
            }

            const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
            params.push(parseInt(limit, 10));
            params.push(offset);

            const dataSql = `
                SELECT aal.*, au.username AS admin_account
                FROM admin_audit_logs aal
                LEFT JOIN admin_users au ON aal.admin_id = au.id
                ${whereSql}
                ORDER BY aal.created_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            const dataResult = await db.query(dataSql, params);

            sendSuccess(res, {total,
                list: dataResult.rows});
        } catch (error) {
            console.error('[Admin Audit] Error fetching logs:', error);
            console.error('[Admin Audit] Error stack:', error.stack);
            return sendError(res, 500, 'Internal server error');
        }
    });

    // ★★★ 同IP风控监控 ★★★
    router.get('/risk/same-ip', authMiddleware, checkPermission('users', 'update_status'), async (req, res) => {
        try {
            const summary = await riskControlService.getSameIpSummary();
            // (★★★ 修復：確保返回格式包含 threshold 和 list ★★★)
            return sendSuccess(res, {
                threshold: summary.threshold || 0,
                list: summary.list || []
            });
        } catch (error) {
            console.error('[RiskControl] Failed to fetch same-ip summary:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    router.get('/risk/same-ip/:ip/users', authMiddleware, checkPermission('users', 'update_status'), async (req, res) => {
        try {
            const ipAddress = decodeURIComponent(req.params.ip);
            const users = await riskControlService.getUsersByIp(ipAddress);
            // (★★★ 修復：確保返回格式包含 list ★★★)
            sendSuccess(res, {
                ip: ipAddress,
                list: users || []
            });
        } catch (error) {
            console.error('[RiskControl] Failed to fetch users by IP:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    router.post('/risk/same-ip/:ip/ban', authMiddleware, checkPermission('users', 'update_status'), async (req, res) => {
        try {
            const ipAddress = decodeURIComponent(req.params.ip);
            const result = await riskControlService.updateUsersStatusByIp(ipAddress, 'banned');
            return sendSuccess(res, { ip: ipAddress, affectedUserIds: result.affectedUserIds || [] });
        } catch (error) {
            console.error('[RiskControl] Failed to ban users by IP:', error);
            return sendError(res, 500, 'Internal server error');
        }
    });

    router.post('/risk/same-ip/:ip/unban', authMiddleware, checkPermission('users', 'update_status'), async (req, res) => {
        try {
            const ipAddress = decodeURIComponent(req.params.ip);
            const result = await riskControlService.updateUsersStatusByIp(ipAddress, 'active');
            return sendSuccess(res, { ip: ipAddress, affectedUserIds: result.affectedUserIds || [] });
        } catch (error) {
            console.error('[RiskControl] Failed to unban users by IP:', error);
            return sendError(res, 500, 'Internal server error');
        }
    });

    // ★★★ 登录查询 API (v9.2 新增) ★★★
    /**
     * @description 获取登录查询列表
     * @route GET /api/admin/login-query
     */
    router.get('/login-query', authMiddleware, checkPermission('users', 'read'), async (req, res) => {
        try {
            const { userId, loginIp, registrationIp, betIp, dateRange, page = 1, limit = 20 } = req.query;

            const whereClauses = [];
            const params = [];
            let paramIndex = 1;

            if (userId) {
                params.push(`%${userId}%`);
                whereClauses.push(`u.user_id::text ILIKE $${paramIndex++}`);
            }

            if (loginIp) {
                params.push(loginIp);
                whereClauses.push(`EXISTS (SELECT 1 FROM user_login_logs WHERE user_id = u.user_id AND login_ip = $${paramIndex++})`);
            }

            if (registrationIp) {
                params.push(registrationIp);
                whereClauses.push(`u.registration_ip = $${paramIndex++}`);
            }

            if (betIp) {
                params.push(betIp);
                whereClauses.push(`EXISTS (SELECT 1 FROM bets WHERE user_id = u.user_id AND bet_ip = $${paramIndex++})`);
            }

            if (dateRange) {
                try {
                    const [startDate, endDate] = JSON.parse(dateRange);
                    params.push(startDate);
                    whereClauses.push(`u.created_at >= $${paramIndex++}`);
                    params.push(endDate);
                    whereClauses.push(`u.created_at <= $${paramIndex++}`);
                } catch (e) {
                    console.error('[Login Query] Error parsing dateRange:', e);
                }
            }

            const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

            // 统计总数
            const countSql = `SELECT COUNT(*) as count FROM users u ${whereSql}`;
            const countResult = await db.query(countSql, params);
            const total = parseInt(countResult.rows[0].count, 10);

            if (total === 0) {
                return sendSuccess(res, { total: 0, list: [] });
            }

            const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
            params.push(parseInt(limit, 10));
            params.push(offset);

            // 查询用户列表，包含统计信息
            const dataSql = `
                SELECT 
                    u.user_id,
                    u.username,
                    u.first_login_country,
                    u.registration_ip,
                    u.first_login_ip,
                    u.device_id,
                    u.created_at,
                    -- 统计同登录IP数量
                    -- 優先從登入日誌中查詢，如果沒有登入日誌，則使用首次登入IP或註冊IP來查詢
                    (
                        SELECT COUNT(DISTINCT u2.user_id) 
                        FROM user_login_logs ull
                        JOIN users u2 ON ull.user_id = u2.user_id
                        WHERE ull.login_ip IN (SELECT DISTINCT login_ip FROM user_login_logs WHERE user_id = u.user_id)
                        AND u2.user_id != u.user_id
                    ) + 
                    -- 如果沒有登入日誌，使用首次登入IP或註冊IP來計算
                    CASE 
                        WHEN EXISTS (SELECT 1 FROM user_login_logs WHERE user_id = u.user_id) THEN 0
                        ELSE (
                            SELECT COUNT(DISTINCT u2.user_id)
                            FROM users u2
                            WHERE u2.user_id != u.user_id
                              AND (
                                  (u.first_login_ip IS NOT NULL AND (
                                      u2.first_login_ip = u.first_login_ip
                                      OR EXISTS (SELECT 1 FROM user_login_logs WHERE user_id = u2.user_id AND login_ip = u.first_login_ip)
                                  ))
                                  OR (u.first_login_ip IS NULL AND u.registration_ip IS NOT NULL AND (
                                      u2.registration_ip = u.registration_ip
                                      OR u2.first_login_ip = u.registration_ip
                                      OR EXISTS (SELECT 1 FROM user_login_logs WHERE user_id = u2.user_id AND login_ip = u.registration_ip)
                                  ))
                              )
                        )
                    END as same_login_ip_count,
                    -- 统计同注册IP数量
                    (SELECT COUNT(*) FROM users u2 WHERE u2.registration_ip = u.registration_ip AND u2.registration_ip IS NOT NULL AND u2.user_id != u.user_id) as same_registration_ip_count,
                    -- 统计同投注IP数量
                    (SELECT COUNT(DISTINCT u2.user_id)
                     FROM bets b
                     JOIN users u2 ON b.user_id = u2.user_id
                     WHERE b.bet_ip IN (SELECT DISTINCT bet_ip FROM bets WHERE user_id = u.user_id AND bet_ip IS NOT NULL)
                     AND u2.user_id != u.user_id) as same_bet_ip_count,
                    -- 统计同注册密码数量（使用密碼指紋來比較，因為 bcrypt hash 每次都不同）
                    (SELECT COUNT(*) 
                     FROM users u2 
                     WHERE u2.password_fingerprint = u.password_fingerprint
                     AND u2.user_id != u.user_id
                     AND u.password_fingerprint IS NOT NULL) as same_registration_password_count,
                    -- 统计同提现密码数量（使用資金密碼指紋來比較）
                    (SELECT COUNT(*) 
                     FROM users u2 
                     WHERE u2.withdrawal_password_fingerprint = u.withdrawal_password_fingerprint
                     AND u2.user_id != u.user_id
                     AND u.withdrawal_password_fingerprint IS NOT NULL) as same_withdrawal_password_count,
                    -- 统计同设备ID数量
                    (SELECT COUNT(*) FROM users u2 WHERE u2.device_id = u.device_id 
                     AND u.device_id IS NOT NULL AND u2.device_id IS NOT NULL AND u2.user_id != u.user_id) as same_device_id_count
                FROM users u
                ${whereSql}
                ORDER BY u.created_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            const dataResult = await db.query(dataSql, params);

            sendSuccess(res, {total,
                list: dataResult.rows});
        } catch (error) {
            console.error('[Login Query] Error fetching login query data:', error);
            console.error('[Login Query] Error stack:', error.stack);
            return sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 获取同登录IP的用户列表
     * @route GET /api/admin/login-query/same-login-ip/:userId
     */
    router.get('/login-query/same-login-ip/:userId', authMiddleware, checkPermission('users', 'read'), async (req, res) => {
        try {
            const { userId } = req.params;

            // 获取该用户的登录IP（優先從登入日誌，如果沒有則使用first_login_ip或last_login_ip）
            const userResult = await db.query(
                `SELECT first_login_ip, last_login_ip FROM users WHERE user_id = $1`,
                [userId]
            );

            if (userResult.rows.length === 0) {
                return sendError(res, 404, 'User not found');
            }

            const user = userResult.rows[0];

            // 获取该用户的所有登录IP（從登入日誌）
            const userIpsResult = await db.query(
                `SELECT DISTINCT login_ip FROM user_login_logs WHERE user_id = $1 AND login_ip IS NOT NULL`,
                [userId]
            );

            const ipsFromLogs = userIpsResult.rows.map(r => r.login_ip);

            // 如果沒有登入日誌，使用first_login_ip或last_login_ip
            const ipsToSearch = [];
            if (ipsFromLogs.length > 0) {
                ipsToSearch.push(...ipsFromLogs);
            } else {
                // 使用first_login_ip或last_login_ip
                if (user.first_login_ip) {
                    ipsToSearch.push(user.first_login_ip);
                }
                if (user.last_login_ip && !ipsToSearch.includes(user.last_login_ip)) {
                    ipsToSearch.push(user.last_login_ip);
                }
            }

            if (ipsToSearch.length === 0) {
                return sendSuccess(res, { list: [] });
            }

            // 查询使用相同IP的其他用户（從登入日誌）
            const resultFromLogs = await db.query(
                `SELECT DISTINCT 
                    u.user_id,
                    ull.login_ip,
                    u.created_at as registration_time,
                    MAX(ull.login_at) as last_login_time
                FROM user_login_logs ull
                JOIN users u ON ull.user_id = u.user_id
                WHERE ull.login_ip = ANY($1) AND u.user_id != $2
                GROUP BY u.user_id, ull.login_ip, u.created_at
                ORDER BY last_login_time DESC`,
                [ipsToSearch, userId]
            );

            // 如果沒有從登入日誌找到，也查詢first_login_ip或last_login_ip相同的用戶
            const resultFromUserTable = await db.query(
                `SELECT DISTINCT 
                    u.user_id,
                    COALESCE(u.last_login_ip, u.first_login_ip) as login_ip,
                    u.created_at as registration_time,
                    u.last_activity_at as last_login_time
                FROM users u
                WHERE (u.first_login_ip = ANY($1) OR u.last_login_ip = ANY($1))
                  AND u.user_id != $2
                  AND (u.first_login_ip IS NOT NULL OR u.last_login_ip IS NOT NULL)
                ORDER BY u.last_activity_at DESC NULLS LAST`,
                [ipsToSearch, userId]
            );

            // 合併結果，去重
            const allResults = [...resultFromLogs.rows];
            const existingUserIds = new Set(resultFromLogs.rows.map(r => r.user_id));

            resultFromUserTable.rows.forEach(row => {
                if (!existingUserIds.has(row.user_id)) {
                    allResults.push(row);
                    existingUserIds.add(row.user_id);
                }
            });

            sendSuccess(res, {list: allResults});
        } catch (error) {
            console.error('[Login Query] Error fetching same login IP:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 获取同注册IP的用户列表
     * @route GET /api/admin/login-query/same-registration-ip/:userId
     */
    router.get('/login-query/same-registration-ip/:userId', authMiddleware, checkPermission('users', 'read'), async (req, res) => {
        try {
            const { userId } = req.params;

            // 获取用户的注册IP
            const userResult = await db.query(
                `SELECT registration_ip FROM users WHERE user_id = $1`,
                [userId]
            );

            if (userResult.rows.length === 0 || !userResult.rows[0].registration_ip) {
                return sendSuccess(res, { list: [] });
            }

            const registrationIp = userResult.rows[0].registration_ip;

            // 查询使用相同注册IP的其他用户
            const result = await db.query(
                `SELECT 
                    u.user_id,
                    u.registration_ip,
                    u.created_at as registration_time,
                    (SELECT MAX(login_at) FROM user_login_logs WHERE user_id = u.user_id) as last_login_time
                FROM users u
                WHERE u.registration_ip = $1 AND u.user_id != $2
                ORDER BY registration_time DESC`,
                [registrationIp, userId]
            );

            sendSuccess(res, {list: result.rows});
        } catch (error) {
            console.error('[Login Query] Error fetching same registration IP:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 获取同投注IP的用户列表
     * @route GET /api/admin/login-query/same-bet-ip/:userId
     */
    router.get('/login-query/same-bet-ip/:userId', authMiddleware, checkPermission('users', 'read'), async (req, res) => {
        try {
            const { userId } = req.params;

            // 获取该用户的所有投注IP
            const userBetIps = await db.query(
                `SELECT DISTINCT bet_ip FROM bets WHERE user_id = $1 AND bet_ip IS NOT NULL`,
                [userId]
            );

            if (userBetIps.rows.length === 0) {
                return sendSuccess(res, { list: [] });
            }

            const ips = userBetIps.rows.map(r => r.bet_ip);

            // 查询使用相同投注IP的其他用户
            const result = await db.query(
                `SELECT DISTINCT 
                    u.user_id,
                    b.bet_ip,
                    u.created_at as registration_time,
                    (SELECT MAX(login_at) FROM user_login_logs WHERE user_id = u.user_id) as last_login_time
                FROM bets b
                JOIN users u ON b.user_id = u.user_id
                WHERE b.bet_ip = ANY($1) AND u.user_id != $2
                ORDER BY last_login_time DESC`,
                [ips, userId]
            );

            sendSuccess(res, {list: result.rows});
        } catch (error) {
            console.error('[Login Query] Error fetching same bet IP:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 获取同注册密码的用户列表
     * @route GET /api/admin/login-query/same-registration-password/:userId
     */
    router.get('/login-query/same-registration-password/:userId', authMiddleware, checkPermission('users', 'read'), async (req, res) => {
        try {
            const { userId } = req.params;

            // 获取用户的密碼指紋（用於比較相同密碼）
            const userResult = await db.query(
                `SELECT password_fingerprint FROM users WHERE user_id = $1`,
                [userId]
            );

            if (userResult.rows.length === 0 || !userResult.rows[0].password_fingerprint) {
                return sendSuccess(res, { list: [] });
            }

            const passwordFingerprint = userResult.rows[0].password_fingerprint;

            // 查询使用相同註冊密碼的其他用户（使用密碼指紋來比較）
            const result = await db.query(
                `SELECT 
                    u.user_id,
                    CASE 
                        WHEN LENGTH(u.password_fingerprint) >= 8 
                        THEN SUBSTRING(u.password_fingerprint, 1, 4) || '****' || SUBSTRING(u.password_fingerprint, LENGTH(u.password_fingerprint) - 3)
                        ELSE '****'
                    END as masked_password,
                    u.created_at as registration_time,
                    (SELECT MAX(login_at) FROM user_login_logs WHERE user_id = u.user_id) as last_login_time
                FROM users u
                WHERE u.password_fingerprint = $1 AND u.user_id != $2
                ORDER BY registration_time DESC`,
                [passwordFingerprint, userId]
            );

            sendSuccess(res, {list: result.rows});
        } catch (error) {
            console.error('[Login Query] Error fetching same registration password:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 获取同提现密码的用户列表
     * @route GET /api/admin/login-query/same-withdrawal-password/:userId
     */
    router.get('/login-query/same-withdrawal-password/:userId', authMiddleware, checkPermission('users', 'read'), async (req, res) => {
        try {
            const { userId } = req.params;

            // 获取用户的資金密碼指紋（用於比較相同密碼）
            const userResult = await db.query(
                `SELECT withdrawal_password_fingerprint FROM users WHERE user_id = $1`,
                [userId]
            );

            if (userResult.rows.length === 0 || !userResult.rows[0].withdrawal_password_fingerprint) {
                return sendSuccess(res, { list: [] });
            }

            const withdrawalPasswordFingerprint = userResult.rows[0].withdrawal_password_fingerprint;

            // 查询使用相同資金密碼的其他用户（使用密碼指紋來比較）
            const result = await db.query(
                `SELECT 
                    u.user_id,
                    CASE 
                        WHEN LENGTH(u.withdrawal_password_fingerprint) >= 8 
                        THEN SUBSTRING(u.withdrawal_password_fingerprint, 1, 4) || '****' || SUBSTRING(u.withdrawal_password_fingerprint, LENGTH(u.withdrawal_password_fingerprint) - 3)
                        ELSE '****'
                    END as masked_password,
                    u.created_at as registration_time,
                    (SELECT MAX(login_at) FROM user_login_logs WHERE user_id = u.user_id) as last_login_time
                FROM users u
                WHERE u.withdrawal_password_fingerprint = $1 AND u.user_id != $2
                ORDER BY registration_time DESC`,
                [withdrawalPasswordFingerprint, userId]
            );

            sendSuccess(res, {list: result.rows});
        } catch (error) {
            console.error('[Login Query] Error fetching same withdrawal password:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 获取同设备ID的用户列表
     * @route GET /api/admin/login-query/same-device-id/:userId
     */
    router.get('/login-query/same-device-id/:userId', authMiddleware, checkPermission('users', 'read'), async (req, res) => {
        try {
            const { userId } = req.params;

            // 获取用户的设备ID
            const userResult = await db.query(
                `SELECT device_id FROM users WHERE user_id = $1`,
                [userId]
            );

            if (userResult.rows.length === 0 || !userResult.rows[0].device_id) {
                return sendSuccess(res, { list: [] });
            }

            const deviceId = userResult.rows[0].device_id;

            // 查询使用相同设备ID的其他用户
            const result = await db.query(
                `SELECT 
                    u.user_id,
                    u.device_id,
                    u.created_at as registration_time,
                    (SELECT MAX(login_at) FROM user_login_logs WHERE user_id = u.user_id) as last_login_time
                FROM users u
                WHERE u.device_id = $1 AND u.user_id != $2
                ORDER BY registration_time DESC`,
                [deviceId, userId]
            );

            sendSuccess(res, {list: result.rows});
        } catch (error) {
            console.error('[Login Query] Error fetching same device ID:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 获取波场异常通知列表
     * @route GET /api/admin/tron-notifications
     */
    router.get('/tron-notifications', authMiddleware, checkPermission('wallets', 'read'), async (req, res) => {
        try {
            const { resolved, limit = 50 } = req.query;

            // 兼容：为旧英文通知做汉化（并补充 walletName）
            let query = `
                SELECT 
                    tn.*,
                    pw.name as wallet_name
                FROM tron_notifications tn
                LEFT JOIN platform_wallets pw
                  ON LOWER(pw.address) = LOWER(tn.address)
            `;
            const params = [];
            let paramIndex = 1;

            if (resolved !== undefined && resolved !== '') {
                query += ' WHERE tn.resolved = $' + paramIndex;
                params.push(resolved === 'true');
                paramIndex++;
            }

            query += ' ORDER BY tn.created_at DESC LIMIT $' + paramIndex;
            params.push(parseInt(limit, 10));

            const result = await db.query(query, params);
            const shortAddress = (addr) => {
                if (!addr || typeof addr !== 'string') return '';
                if (addr.length <= 12) return addr;
                return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
            };
            const localized = result.rows.map((row) => {
                const walletNameEnergy = row.wallet_name || '能量钱包';
                const walletName = row.wallet_name || '钱包';
                const addr = row.address || '';
                const addrShort = shortAddress(addr);

                // 如果已经是新格式/中文，直接返回
                const msg = row.message || '';
                const looksChinese = /[\u4e00-\u9fa5]/.test(msg);
                if (looksChinese) return row;

                // 旧英文消息兼容（尽量解析出数值）
                if (row.type === 'LOW_ENERGY') {
                    const m = msg.match(/Only\s+([0-9]+(?:\.[0-9]+)?)\s+remaining/i);
                    const remaining = m ? m[1] : '0';
                    return {
                        ...row,
                        message: `[${walletNameEnergy}] 能量告警: 剩余能量仅 ${remaining} (地址: ${addrShort})`
                    };
                }
                if (row.type === 'LOW_TRX') {
                    const m = msg.match(/Only\s+([0-9]+(?:\.[0-9]+)?)\s+TRX\s+remaining/i);
                    const balance = m ? m[1] : '0';
                    return {
                        ...row,
                        message: `[${walletName}] TRX余额不足: 仅剩 ${balance} TRX (地址: ${addrShort})`
                    };
                }
                return row;
            });

            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H2',location:'transactions.js:tron-notifications',message:'list localized',data:{count:localized.length,firstType:localized[0]?.type||null,firstMsg:(localized[0]?.message||'').slice(0,80)},timestamp:Date.now()})}).catch(()=>{});
            // #endregion

            sendSuccess(res, localized);
        } catch (error) {
            console.error('[Admin Tron Notifications] Error:', error);
            console.error('[Admin Tron Notifications] Error details:', error.stack);
            return sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 获取未解决的波场异常通知数量
     * @route GET /api/admin/tron-notifications/count
     */
    router.get('/tron-notifications/count', authMiddleware, checkPermission('wallets', 'read'), async (req, res) => {
        try {
            const result = await db.query(
                'SELECT COUNT(*) as count FROM tron_notifications WHERE resolved = false',
                []
            );

            const count = result.rows && result.rows[0] ? parseInt(result.rows[0].count, 10) : 0;

            sendSuccess(res, { count: count });
        } catch (error) {
            console.error('[Admin Tron Notifications Count] Error:', error);
            console.error('[Admin Tron Notifications Count] Error details:', error.stack);
            return sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 标记异常通知为已解决
     * @route POST /api/admin/tron-notifications/:id/resolve
     */
    router.post('/tron-notifications/:id/resolve', authMiddleware, checkPermission('wallets', 'cud'), async (req, res) => {
        try {
            const { id } = req.params;

            const result = await db.query(
                'UPDATE tron_notifications SET resolved = true, resolved_at = NOW() WHERE id = $1 RETURNING id',
                [id]
            );

            if (result.rows.length === 0) {
                return sendError(res, 404, '通知不存在');
            }

            sendSuccess(res, { message: '通知已标记为已解决' });
        } catch (error) {
            console.error('[Admin Tron Notifications Resolve] Error:', error);
            console.error('[Admin Tron Notifications Resolve] Error details:', error.stack);
            return sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 获取游戏列表
     * @route GET /api/admin/games
     */
    router.get('/games', authMiddleware, checkPermission('settings_game', 'read'), async (req, res) => {
        try {
            const { provider, status, page = 1, limit = 20 } = req.query;

            // 构建 WHERE 条件
            let whereClause = 'WHERE 1=1';
            const params = [];
            let paramIndex = 1;

            if (provider) {
                whereClause += ` AND provider = $${paramIndex}`;
                params.push(provider);
                paramIndex++;
            }

            if (status) {
                whereClause += ` AND status = $${paramIndex}`;
                params.push(status);
                paramIndex++;
            }

            // 获取总数（不包含 ORDER BY）
            const countQuery = `SELECT COUNT(*) as total FROM games ${whereClause}`;
            const countResult = await db.query(countQuery, params);
            const total = parseInt(countResult.rows[0].total, 10);

            // 获取数据（包含 ORDER BY 和分页）
            const dataQuery = `SELECT * FROM games ${whereClause} ORDER BY sort_order ASC, id ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            const dataParams = [...params, parseInt(limit, 10), (parseInt(page, 10) - 1) * parseInt(limit, 10)];
            const result = await db.query(dataQuery, dataParams);

            sendSuccess(res, {
                list: result.rows,
                total: total,
                page: parseInt(page, 10),
                limit: parseInt(limit, 10)
            });
        } catch (error) {
            console.error('[Admin Games] Error:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 获取单个游戏详情
     * @route GET /api/admin/games/:id
     */
    router.get('/games/:id', authMiddleware, checkPermission('settings_game', 'read'), async (req, res) => {
        try {
            const { id } = req.params;
            const result = await db.query('SELECT * FROM games WHERE id = $1', [id]);

            if (result.rows.length === 0) {
                return sendError(res, 404, '游戏不存在');
            }

            sendSuccess(res, result.rows[0]);
        } catch (error) {
            console.error('[Admin Games] Error:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 创建游戏
     * @route POST /api/admin/games
     */
    router.post('/games', authMiddleware, checkPermission('settings_game', 'update'), async (req, res) => {
        try {
            const { provider, provider_params, game_code, name_zh, name_en, game_status, status, sort_order, payout_multiplier } = req.body;

            if (!name_zh) {
                return sendError(res, 400, '游戏名字（中文）不能为空');
            }

            if (!payout_multiplier || isNaN(payout_multiplier) || payout_multiplier <= 0) {
                return sendError(res, 400, '派奖倍数必须大于0');
            }

            const result = await db.query(
                `INSERT INTO games (provider, provider_params, game_code, name_zh, name_en, game_status, status, sort_order, payout_multiplier, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
                 RETURNING *`,
                [
                    provider || '自营',
                    provider_params || null,
                    game_code || null,
                    name_zh,
                    name_en || null,
                    game_status || null,
                    status || 'enabled',
                    sort_order || 0,
                    parseFloat(payout_multiplier)
                ]
            );

            sendSuccess(res, result.rows[0], 201);
        } catch (error) {
            console.error('[Admin Games] Error:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 更新游戏
     * @route PUT /api/admin/games/:id
     */
    router.put('/games/:id', authMiddleware, checkPermission('settings_game', 'update'), async (req, res) => {
        try {
            const { id } = req.params;
            const { provider, provider_params, game_code, name_zh, name_en, game_status, status, sort_order, payout_multiplier } = req.body;

            // 检查游戏是否存在
            const existing = await db.query('SELECT * FROM games WHERE id = $1', [id]);
            if (existing.rows.length === 0) {
                return sendError(res, 404, '游戏不存在');
            }

            // 构建更新字段
            const updates = [];
            const params = [];
            let paramIndex = 1;

            if (provider !== undefined) {
                updates.push(`provider = $${paramIndex}`);
                params.push(provider);
                paramIndex++;
            }
            if (provider_params !== undefined) {
                updates.push(`provider_params = $${paramIndex}`);
                params.push(provider_params);
                paramIndex++;
            }
            if (name_zh !== undefined) {
                updates.push(`name_zh = $${paramIndex}`);
                params.push(name_zh);
                paramIndex++;
            }
            if (name_en !== undefined) {
                updates.push(`name_en = $${paramIndex}`);
                params.push(name_en);
                paramIndex++;
            }
            if (game_status !== undefined) {
                updates.push(`game_status = $${paramIndex}`);
                params.push(game_status);
                paramIndex++;
            }
            if (status !== undefined) {
                updates.push(`status = $${paramIndex}`);
                params.push(status);
                paramIndex++;
            }
            if (sort_order !== undefined) {
                updates.push(`sort_order = $${paramIndex}`);
                params.push(parseInt(sort_order, 10));
                paramIndex++;
            }
            if (payout_multiplier !== undefined) {
                // 确保是数字类型
                const multiplierValue = typeof payout_multiplier === 'string' 
                    ? parseFloat(payout_multiplier) 
                    : parseFloat(payout_multiplier);

                if (isNaN(multiplierValue) || multiplierValue <= 0) {
                    return sendError(res, 400, '派奖倍数必须大于0');
                }
                updates.push(`payout_multiplier = $${paramIndex}`);
                params.push(multiplierValue);
                paramIndex++;
            }
            if (req.body.streak_multipliers !== undefined) {
                // 验证 JSON 格式
                let streakMultipliers = null;
                if (req.body.streak_multipliers) {
                    try {
                        if (typeof req.body.streak_multipliers === 'string') {
                            streakMultipliers = JSON.parse(req.body.streak_multipliers);
                        } else {
                            streakMultipliers = req.body.streak_multipliers;
                        }
                        // 验证格式：应该是对象，key 为数字字符串，value 为数字
                        if (typeof streakMultipliers !== 'object' || Array.isArray(streakMultipliers)) {
                            return sendError(res, 400, 'streak_multipliers 必须是对象格式');
                        }
                        // 验证每个值都是正数
                        for (const [key, value] of Object.entries(streakMultipliers)) {
                            if (isNaN(parseInt(key, 10)) || isNaN(parseFloat(value)) || parseFloat(value) <= 0) {
                                return sendError(res, 400, `streak_multipliers 中的 ${key} 胜赔率必须大于0`);
                            }
                        }
                        streakMultipliers = JSON.stringify(streakMultipliers);
                    } catch (error) {
                        return sendError(res, 400, 'streak_multipliers JSON 格式错误');
                    }
                }
                updates.push(`streak_multipliers = $${paramIndex}`);
                params.push(streakMultipliers);
                paramIndex++;
            }

            if (updates.length === 0) {
                return sendError(res, 400, '没有要更新的字段');
            }

            updates.push(`updated_at = NOW()`);
            params.push(id);

            const result = await db.query(
                `UPDATE games SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
                params
            );

            sendSuccess(res, {
                success: true,
                data: result.rows[0]
            });
        } catch (error) {
            console.error('[Admin Games] Error:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 删除游戏
     * @route DELETE /api/admin/games/:id
     */
    router.delete('/games/:id', authMiddleware, checkPermission('settings_game', 'update'), async (req, res) => {
        try {
            const { id } = req.params;

            const result = await db.query('DELETE FROM games WHERE id = $1 RETURNING id', [id]);

            if (result.rows.length === 0) {
                return sendError(res, 404, '游戏不存在');
            }

            sendSuccess(res, { message: '游戏已删除' });
        } catch (error) {
            console.error('[Admin Games] Error:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 获取游戏派奖倍数（用于前端游戏逻辑）
     * @route GET /api/admin/games/:id/payout-multiplier
     */
    router.get('/games/:id/payout-multiplier', authMiddleware, checkPermission('settings_game', 'read'), async (req, res) => {
        try {
            const { id } = req.params;
            const result = await db.query('SELECT payout_multiplier FROM games WHERE id = $1', [id]);

            if (result.rows.length === 0) {
                return sendError(res, 404, '游戏不存在');
            }

            sendSuccess(res, { payout_multiplier: result.rows[0].payout_multiplier });
        } catch (error) {
            console.error('[Admin Games] Error:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    // ========================================
    // ★★★ Guardian 提現風控系統 API ★★★
    // ========================================

    /**
     * @description 獲取提現的風險分析報告
     * @route GET /api/admin/withdrawals/:id/risk-analysis
     */
    router.get('/withdrawals/:id/risk-analysis', authMiddleware, checkPermission('withdrawals', 'read'), async (req, res) => {
        try {
            const { id } = req.params;
            
            // 獲取提現單信息
            const wdResult = await db.query('SELECT * FROM withdrawals WHERE id = $1', [id]);
            if (wdResult.rows.length === 0) {
                return sendError(res, 404, '提款单不存在');
            }
            
            const withdrawal = wdResult.rows[0];
            
            // 獲取風險分析報告
            const riskReport = await riskAssessmentService.getWithdrawalRiskReport(
                withdrawal.user_id,
                withdrawal.address,
                withdrawal.chain_type
            );
            
            return sendSuccess(res, riskReport);
        } catch (error) {
            console.error('[Admin Withdrawals] Error fetching risk analysis:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 拒絕提款並凍結用戶
     * @route POST /api/admin/withdrawals/:id/reject-and-freeze
     */
    router.post('/withdrawals/:id/reject-and-freeze', authMiddleware, checkPermission('withdrawals', 'update'), async (req, res) => {
        const { id } = req.params;
        const { reason } = req.body;
        const reviewerId = req.user.id;

        if (!reason) {
            return sendError(res, 400, '拒绝理由为必填');
        }

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // 1. 查找并锁定提款单
            const wdResult = await client.query("SELECT * FROM withdrawals WHERE id = $1 AND status = 'pending' FOR UPDATE", [id]);
            if (wdResult.rows.length === 0) {
                throw new Error('提款单不存在或狀态已变更');
            }
            const withdrawal = wdResult.rows[0];

            // 2. 更新提款单狀态為拒絕
            await client.query(
                "UPDATE withdrawals SET status = 'rejected', rejection_reason = $1, reviewer_id = $2, review_time = NOW() WHERE id = $3",
                [reason, reviewerId, id]
            );

            // 3. 凍結用戶（不退款，資金被沒收）
            await client.query(
                "UPDATE users SET status = 'frozen' WHERE user_id = $1",
                [withdrawal.user_id]
            );

            // 4. 更新对应的 platform_transaction
            await client.query(
                "UPDATE platform_transactions SET status = 'cancelled' WHERE user_id = $1 AND type = 'withdraw_request' AND amount = $2 AND status = 'pending'",
                [withdrawal.user_id, -Math.abs(withdrawal.amount)]
            );

            // 5. 記錄賬變（資金被沒收，不退回餘額）
            try {
                await logBalanceChange({
                    user_id: withdrawal.user_id,
                    change_type: CHANGE_TYPES.ADMIN_ADJUSTMENT,
                    amount: -withdrawal.amount,  // 負數表示扣除
                    balance_after: 0,  // 凍結後餘額為0
                    remark: `提款拒絕並凍結用戶 (提款單ID: ${id}, 理由: ${reason}, 管理員: ${req.user.username})`,
                    client: client
                });
            } catch (error) {
                console.error('[Admin Withdrawals] Failed to log balance change (reject and freeze):', error);
                // 不阻止主流程
            }

            await client.query('COMMIT');

            // 6. 记录稽核日志
            await recordAuditLog({
                adminId: req.user.id,
                adminUsername: req.user.username,
                action: 'reject_withdrawal_and_freeze',
                resource: 'withdrawals',
                resourceId: id.toString(),
                description: `拒絕提款並凍結用戶 (提款單ID: ${id}, 用戶ID: ${withdrawal.user_id}, 金額: ${withdrawal.amount} USDT, 理由: ${reason})`,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent']
            });

            sendSuccess(res, { message: '提款已拒绝，用户已冻结' });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`[Admin Withdrawals] Error rejecting and freezing ${id}:`, error);
            return sendError(res, 400, error.message || '操作失败');
        } finally {
            client.release();
        }
    });

    // ========================================
    // ★★★ 提現地址黑名單管理 API ★★★
    // ========================================

    /**
     * @description 獲取黑名單列表
     * @route GET /api/admin/withdrawal-blacklist
     */
    router.get('/withdrawal-blacklist', authMiddleware, checkPermission('withdrawals', 'read'), async (req, res) => {
        try {
            const { page = 1, limit = 20, address, chain } = req.query;
            
            const params = [];
            let whereClauses = [];
            let paramIndex = 1;
            
            if (address) {
                params.push(`%${address}%`);
                whereClauses.push(`wab.address ILIKE $${paramIndex++}`);
            }
            
            if (chain) {
                params.push(chain);
                whereClauses.push(`wab.chain = $${paramIndex++}`);
            }
            
            const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
            
            // 獲取總數
            const countSql = `SELECT COUNT(*) FROM withdrawal_address_blacklist wab ${whereSql}`;
            const countResult = await db.query(countSql, params);
            const total = parseInt(countResult.rows[0].count, 10);
            
            if (total === 0) {
                return sendSuccess(res, { total: 0, list: [] });
            }
            
            // 獲取列表
            const dataSql = `
                SELECT 
                    wab.id,
                    wab.address,
                    wab.chain,
                    wab.memo,
                    wab.created_at,
                    au.username as admin_username
                FROM withdrawal_address_blacklist wab
                LEFT JOIN admin_users au ON wab.admin_id = au.id
                ${whereSql}
                ORDER BY wab.created_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;
            
            const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
            params.push(parseInt(limit, 10));
            params.push(offset);
            
            const dataResult = await db.query(dataSql, params);
            
            sendSuccess(res, {
                total: total,
                list: dataResult.rows
            });
            
        } catch (error) {
            console.error('[Admin Blacklist] Error fetching list:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 添加地址到黑名單
     * @route POST /api/admin/withdrawal-blacklist
     */
    router.post('/withdrawal-blacklist', authMiddleware, checkPermission('withdrawals', 'update'), async (req, res) => {
        try {
            const { address, chain, memo } = req.body;
            const adminId = req.user.id;
            
            if (!address || !address.trim()) {
                return sendError(res, 400, '地址不能为空');
            }
            
            // 檢查是否已存在
            const existingResult = await db.query(
                'SELECT id FROM withdrawal_address_blacklist WHERE address = $1 AND (chain IS NULL OR chain = $2)',
                [address.trim(), chain || null]
            );
            
            if (existingResult.rows.length > 0) {
                return sendError(res, 400, '该地址已在黑名单中');
            }
            
            // 添加到黑名單
            const result = await db.query(
                `INSERT INTO withdrawal_address_blacklist (address, chain, memo, admin_id, created_at)
                 VALUES ($1, $2, $3, $4, NOW())
                 RETURNING *`,
                [address.trim(), chain || null, memo || null, adminId]
            );
            
            // 記錄稽核日誌
            await recordAuditLog({
                adminId: req.user.id,
                adminUsername: req.user.username,
                action: 'add_withdrawal_blacklist',
                resource: 'withdrawal_blacklist',
                resourceId: result.rows[0].id.toString(),
                description: `添加黑名單地址 (地址: ${address}, 鏈: ${chain || '全部'}, 備註: ${memo || '無'})`,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent']
            });
            
            sendSuccess(res, result.rows[0], 201);
            
        } catch (error) {
            console.error('[Admin Blacklist] Error adding address:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 從黑名單中移除地址
     * @route DELETE /api/admin/withdrawal-blacklist/:id
     */
    router.delete('/withdrawal-blacklist/:id', authMiddleware, checkPermission('withdrawals', 'update'), async (req, res) => {
        try {
            const { id } = req.params;
            
            // 獲取地址信息（用於日誌）
            const addressResult = await db.query('SELECT * FROM withdrawal_address_blacklist WHERE id = $1', [id]);
            if (addressResult.rows.length === 0) {
                return sendError(res, 404, '黑名单记录不存在');
            }
            
            const blacklistEntry = addressResult.rows[0];
            
            // 刪除
            await db.query('DELETE FROM withdrawal_address_blacklist WHERE id = $1', [id]);
            
            // 記錄稽核日誌
            await recordAuditLog({
                adminId: req.user.id,
                adminUsername: req.user.username,
                action: 'remove_withdrawal_blacklist',
                resource: 'withdrawal_blacklist',
                resourceId: id.toString(),
                description: `移除黑名單地址 (地址: ${blacklistEntry.address}, 鏈: ${blacklistEntry.chain || '全部'})`,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent']
            });
            
            sendSuccess(res, { message: '已从黑名单移除' });
            
        } catch (error) {
            console.error('[Admin Blacklist] Error removing address:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    module.exports = router;

}

module.exports = transactionsRoutes;
