// 檔案: backend/routes/admin.js (新檔案)
const { ethers } = require('ethers'); //
const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');

// ★★★ (v2 新增) 臨時用 - 強制重設管理員密碼 ★★★
router.post('/register-temp', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required.' });
    }

    try {
        // 1. (關鍵) 使用當前環境的 bcryptjs 立即生成一個新雜湊值
        const saltRounds = 10;
        console.log(`[Admin Temp] 1. 收到請求，為 '${username}' 生成新密碼...`);
        const newHash = bcrypt.hashSync(password, saltRounds);
        console.log(`[Admin Temp] 2. 新雜湊值已生成: ${newHash}`);

        // 2. 將這個新雜湊值更新到資料庫
        const result = await db.query(
            'UPDATE admin_users SET password_hash = $1 WHERE username = $2 RETURNING id',
            [newHash, username]
        );

        if (result.rows.length === 0) {
            console.log(`[Admin Temp] 3. 失敗: 用戶 '${username}' 不存在。`);
            return res.status(404).json({ error: 'User not found.' });
        }

        console.log(`[Admin Temp] 3. 成功: 用戶 ID ${result.rows[0].id} 的密碼已更新。`);
        res.status(200).json({ 
            message: `User '${username}' password updated successfully with new hash.` 
        });

    } catch (error) {
        console.error('[Admin Temp] CRITICAL ERROR:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 後台管理員登入 (★★★ 帶有詳細除錯日誌 ★★★)
 * @route POST /api/admin/login
 */
router.post('/login', async (req, res) => {
    // (移除之前的 DEBUG 日誌)
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }
    try {
        // 1. 查找用戶 (包含 role 和 status)
        const result = await db.query('SELECT * FROM admin_users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // 2. 驗證密碼
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // (★★★ v2 新增：檢查帳號狀態 ★★★)
        if (user.status !== 'active') {
            return res.status(403).json({ error: 'Account is disabled.' });
        }

        // 3. 簽發 JWT (★★★ v2 新增：加入 role ★★★)
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username,
                role: user.role // (將角色 寫入 Token)
            },
            process.env.JWT_SECRET,
            { expiresIn: '8h' } 
        );
        res.status(200).json({ message: 'Login successful', token: token });
    } catch (error) {
        console.error('[Admin Login] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// -------------------------------------------------------------------
// ★★★ (v2 新增) 儀表板 - 獲取統計數據 (受保護) ★★★
// -------------------------------------------------------------------
/**
 * @description 獲取核心統計數據 (範例)
 * @route GET /api/admin/stats
 * @access Private (需要 Token)
 */
router.get('/stats', authMiddleware, async (req, res) => {
    // (因為通過了 authMiddleware, 我們可以訪問 req.user)
    console.log(`[Admin Stats] User ${req.user.username} is requesting stats...`);
    
    try {
        // 範例查詢：總用戶數
        const userCountResult = await db.query('SELECT COUNT(*) FROM users');
        const totalUsers = userCountResult.rows[0].count;

        // 範例查詢：總投注數
        const betCountResult = await db.query('SELECT COUNT(*) FROM bets');
        const totalBets = betCountResult.rows[0].count;

        // 範例查詢：待處理派獎數
        const pendingPayoutsResult = await db.query("SELECT COUNT(*) FROM bets WHERE status = 'prize_pending'");
        const pendingPayouts = pendingPayoutsResult.rows[0].count;

        res.status(200).json({
            totalUsers: parseInt(totalUsers),
            totalBets: parseInt(totalBets),
            pendingPayouts: parseInt(pendingPayouts)
        });

    } catch (error) {
        console.error('[Admin Stats] Error fetching stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ★★★ (v2 新增) 用戶管理 - 獲取用戶列表 (分頁/搜尋) ★★★
/**
 * @description 獲取用戶列表 (分頁/搜尋)
 * @route GET /api/admin/users
 * @access Private (需要 Token)
 * @params query {
 * page?: number,
 * limit?: number,
 * userId?: string, (对应 v1 的 user_id)
 * walletAddress?: string,
 * dateRange?: [string, string] (注册时间)
 * }
 */
router.get('/users', authMiddleware, async (req, res) => {
    // 1. 解構查詢參數 (v2)
    const { 
        page = 1, 
        limit = 10,
        userId,
        walletAddress,
        dateRange,
        nickname, // (v2 新增)
        inviteCode, // (v2 新增 - 自身邀请码)
        referrerCode, // (v2 新增 - 推荐人邀请码)
        status // (v2 新增 - 禁用投注)
    } = req.query;

    try {
        // 2. 準備 SQL 查詢條件
        const params = [];
        let whereClauses = [];
        let paramIndex = 1;

        // (v1 欄位... 保持不變)
        if (userId) {
            params.push(`%${userId}%`);
            whereClauses.push(`user_id ILIKE $${paramIndex++}`); 
        }
        if (walletAddress) {
            params.push(walletAddress.toLowerCase());
            whereClauses.push(`wallet_address = $${paramIndex++}`);
        }
        if (dateRange) {
            try {
                const [startDate, endDate] = JSON.parse(dateRange);
                if (startDate && endDate) {
                    params.push(startDate);
                    whereClauses.push(`created_at >= $${paramIndex++}`);
                    params.push(endDate);
                    whereClauses.push(`created_at <= $${paramIndex++}`);
                }
            } catch (e) { console.warn('Failed to parse dateRange'); }
        }

        // (★★★ v2 新增搜尋條件 ★★★)
        // 搜尋: 用户昵称 (精确)
        if (nickname) {
            params.push(nickname);
            whereClauses.push(`nickname = $${paramIndex++}`);
        }
        // 搜尋: 自身邀请码 (精确)
        if (inviteCode) {
            params.push(inviteCode);
            whereClauses.push(`invite_code = $${paramIndex++}`);
        }
        // 搜尋: 推荐人邀请码 (精确)
        if (referrerCode) {
            params.push(referrerCode);
            whereClauses.push(`referrer_code = $${paramIndex++}`);
        }
        // 搜尋: 状态 (精确)
        if (status) {
            params.push(status);
            whereClauses.push(`status = $${paramIndex++}`);
        }
        
        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // 3. 執行查詢 (獲取總數)
        const countSql = `SELECT COUNT(*) FROM users ${whereSql}`;
        const countResult = await db.query(countSql, params);
        const total = parseInt(countResult.rows[0].count, 10);

        if (total === 0) {
            return res.status(200).json({ total: 0, list: [] });
        }

        // 4. 執行查詢 (獲取分頁資料)
        // (★★★ v2 擴充 SELECT 欄位 ★★★)
        const dataSql = `
            SELECT 
                id, user_id, wallet_address, 
                current_streak, max_streak, created_at,
                nickname, level, invite_code, referrer_code, status 
            FROM users 
            ${whereSql}
            ORDER BY created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;
        
        const offset = (page - 1) * limit;
        params.push(limit);
        params.push(offset);
        
        const dataResult = await db.query(dataSql, params);

        // 5. 返回結果
        res.status(200).json({
            total: total,
            list: dataResult.rows
        });

    } catch (error) {
        console.error('[Admin Users] Error fetching users (v2):', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ★★★ (v2 新增) 用戶管理 - 更新用戶狀態 (禁用投注) ★★★
/**
 * @description 更新用戶狀態 (例如 'active' 或 'banned')
 * @route PATCH /api/admin/users/:id/status
 * @access Private (需要 Token)
 * @body { status: string }
 */
router.patch('/users/:id/status', authMiddleware, async (req, res) => {
    const { id } = req.params; // 要更新的用戶 DB ID
    const { status } = req.body; // 新的狀態 ('active' or 'banned')

    if (!status) {
        return res.status(400).json({ error: 'Status is required.' });
    }
    
    // (我們也可以在這裡檢查 v1 的 API，如果狀態是 'banned'，則拒絕 /api/bets 請求，但這一步我們先完成後台)

    try {
        const result = await db.query(
            'UPDATE users SET status = $1 WHERE id = $2 RETURNING id, status',
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        console.log(`[Admin Users] User ID ${result.rows[0].id} status updated to ${result.rows[0].status} by ${req.user.username}`);
        res.status(200).json(result.rows[0]);

    } catch (error) {
        console.error('[Admin Users] Error updating user status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ★★★ (v2 新增) 用戶管理 - 即時查詢錢包餘額 ★★★
/**
 * @description 查詢指定錢包地址的 Sepolia ETH 餘額
 * @route GET /api/admin/users/balance/:address
 * @access Private (需要 Token)
 */
router.get('/users/balance/:address', authMiddleware, async (req, res) => {
    const { address } = req.params;
    
    // (我們需要從 server.js 獲取 provider，但 Node.js 模組快取機制允許我們這樣做)
    // 獲取在 server.js 中實例化的 provider
    const provider = require('../server.js').provider; 
    
    if (!provider) {
         return res.status(500).json({ error: 'Blockchain provider is not initialized.' });
    }

    try {
        const balanceWei = await provider.getBalance(address);
        const balanceEth = ethers.formatEther(balanceWei); //
        
        console.log(`[Admin Balance] User ${req.user.username} checked balance for ${address}: ${balanceEth} ETH`);
        res.status(200).json({
            walletAddress: address,
            balanceEth: balanceEth,
            balanceWei: balanceWei.toString()
        });

    } catch (error) {
        console.error(`[Admin Balance] Error fetching balance for ${address}:`, error.message);
        // 可能是地址無效
        if (error.code === 'INVALID_ARGUMENT') {
            return res.status(400).json({ error: 'Invalid wallet address.' });
        }
        res.status(500).json({ error: 'Internal server error while fetching balance.' });
    }
});

// ★★★ (v2 修正版) 注单管理 - 獲取投注列表 (分頁/搜尋) ★★★
/**
 * @description 獲取注单管理列表 (依據您提供的 10 欄位需求)
 * @route GET /api/admin/bets
 * @access Private (需要 Token)
 * @params query {
 * page?: number,
 * limit?: number,
 * betId?: string (注单编号, 模糊),
 * userId?: string (用户ID, 模糊),
 * walletAddress?: string (钱包地址, 精确),
 * status?: string (注单状态, 精确),
 * dateRange?: [string, string] (下注交易完成时间)
 * }
 */
router.get('/bets', authMiddleware, async (req, res) => {
    // 1. 解構查詢參數
    const {
        page = 1,
        limit = 10,
        betId,
        userId,
        walletAddress,
        status,
        dateRange // 預期格式: '["2023-01-01...", "2023-01-31..."]'
    } = req.query;

    try {
        // 2. 準備 SQL 查詢條件
        const params = [];
        let whereClauses = [];
        let paramIndex = 1;

        // 搜尋: 注单编号 (模糊)
        if (betId) {
            params.push(`%${betId}%`);
            whereClauses.push(`b.id::text ILIKE $${paramIndex++}`);
        }

        // 搜尋: 用户ID (模糊)
        if (userId) {
            params.push(`%${userId}%`);
            whereClauses.push(`b.user_id ILIKE $${paramIndex++}`);
        }
        
        // 搜尋: 钱包地址 (精确) (需要 JOIN users 表)
        if (walletAddress) {
            params.push(walletAddress.toLowerCase());
            whereClauses.push(`u.wallet_address = $${paramIndex++}`);
        }

        // 搜尋: 注单状态 (精确)
        if (status) {
            params.push(status);
            whereClauses.push(`b.status = $${paramIndex++}`);
        }

        // 搜尋: 下注交易完成时间 (bet_time)
        if (dateRange) {
            try {
                const [startDate, endDate] = JSON.parse(dateRange);
                if (startDate && endDate) {
                    params.push(startDate);
                    whereClauses.push(`b.bet_time >= $${paramIndex++}`);
                    params.push(endDate);
                    whereClauses.push(`b.bet_time <= $${paramIndex++}`);
                }
            } catch (e) { console.warn('Failed to parse dateRange for bets'); }
        }
        
        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const joinSql = 'FROM bets b JOIN users u ON b.user_id = u.user_id';

        // 3. 執行查詢 (獲取總數)
        const countSql = `SELECT COUNT(b.id) ${joinSql} ${whereSql}`;
        const countResult = await db.query(countSql, params);
        const total = parseInt(countResult.rows[0].count, 10);

        if (total === 0) {
            return res.status(200).json({ total: 0, list: [] });
        }

        // 4. 執行查詢 (獲取分頁資料)
        // (欄位: id, user_id, game_type, choice, amount, status, bet_time, settle_time, tx_hash, prize_tx_hash)
        const dataSql = `
            SELECT 
                b.id, b.user_id, u.wallet_address, 
                b.game_type, b.choice, b.amount, b.status, 
                b.bet_time, b.settle_time, 
                b.tx_hash, b.prize_tx_hash
            ${joinSql}
            ${whereSql}
            ORDER BY b.bet_time DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;
        
        const offset = (page - 1) * limit;
        params.push(limit);
        params.push(offset);
        
        const dataResult = await db.query(dataSql, params);

        // 5. 返回結果
        res.status(200).json({
            total: total,
            list: dataResult.rows
        });

    } catch (error) {
        console.error('[Admin Bets] Error fetching bets (v2-corrected):', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ★★★ (v2 新增) 營運管理 - 盈虧報表 ★★★
/**
 * @description 獲取盈虧報表
 * @route GET /api/admin/reports/profit-loss
 * @access Private (需要 Token)
 * @params query {
 * userQuery?: string (用户ID 或 钱包地址 或 'system')
 * dateRange: [string, string] (投注时间)
 * }
 */
router.get('/reports/profit-loss', authMiddleware, async (req, res) => {
    const { userQuery, dateRange } = req.query; //
    if (!dateRange) { return res.status(400).json({ error: 'Date range is required.' }); }

    // (★★★ 關鍵修正：呼叫函數來獲取最新的快取 ★★★)
    const getSettingsCache = require('../server.js').getSettingsCache; //
    const currentSettingsCache = getSettingsCache(); // 執行函數獲取當前快取
    const PAYOUT_MULTIPLIER = parseInt(currentSettingsCache?.PAYOUT_MULTIPLIER || '2', 10); //
    console.log(`[Admin Report] Using PAYOUT_MULTIPLIER from getSettingsCache(): ${PAYOUT_MULTIPLIER}`); // (更新日誌)
    try {
        // 2. 準備 SQL 查詢條件 (不變)
        const params = [];
        let whereClauses = [];
        let paramIndex = 1;
        
        try {
            const [startDate, endDate] = JSON.parse(dateRange);
            params.push(startDate);
            whereClauses.push(`b.bet_time >= $${paramIndex++}`);
            params.push(endDate);
            whereClauses.push(`b.bet_time <= $${paramIndex++}`);
        } catch (e) { /* ... */ }

        if (userQuery && userQuery.toLowerCase() !== 'system') {
            params.push(`%${userQuery}%`);
            const userFilterIndex = paramIndex++;
            whereClauses.push(`(u.user_id ILIKE $${userFilterIndex} OR u.wallet_address ILIKE $${userFilterIndex})`);
        }

        const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
        const joinSql = 'FROM bets b JOIN users u ON b.user_id = u.user_id';
        console.log(`[Admin Report DEBUG] 2. Prepared WHERE: ${whereSql}`);

        // 3. 準備彙總查詢 (★★★ 加入 PAYOUT_MULTIPLIER 參數到 params ★★★)
        const querySql = `
            SELECT
                COALESCE(SUM(
                    CASE 
                        WHEN b.status IN ('won', 'lost', 'prize_pending') THEN b.amount
                        ELSE 0 
                    END
                ), 0) AS total_bet,
                COALESCE(SUM(
                    CASE 
                        WHEN b.status = 'won' THEN b.amount * $${paramIndex} 
                        ELSE 0 
                    END
                ), 0) AS total_payout
            ${joinSql}
            ${whereSql}
        `;
        // (★★★ 重要修正：將倍數加入 params 陣列 ★★★)
        params.push(PAYOUT_MULTIPLIER); 

        // (★★★ 關鍵除錯點 ★★★)
        console.log(`[Admin Report DEBUG] 3. Final SQL:\n${querySql}`);
        console.log(`[Admin Report DEBUG] 4. Final Params:`, JSON.stringify(params));

        // 4. 執行查詢
        const result = await db.query(querySql, params);
        const data = result.rows[0];
        console.log(`[Admin Report DEBUG] 5. Query Result:`, data); // (看看 data 是不是 { total_bet: '0', total_payout: '0' })
        
        // 5. 計算衍生數據 (不變)
        const totalBet = parseFloat(data.total_bet);
        const totalPayout = parseFloat(data.total_payout);
        const platformProfit = totalBet - totalPayout;
        console.log(`[Admin Report DEBUG] 6. Calculated Values: Bet=${totalBet}, Payout=${totalPayout}, Profit=${platformProfit}`);

        // 6. 返回結果 (不變)
        res.status(200).json({
            total_bet: totalBet,
            total_payout: totalPayout,
            platform_profit: platformProfit,
            bonus_event: 0,
            bonus_level: 0,
            bonus_commission: 0
        });

    } catch (error) {
        console.error('[Admin Report] CRITICAL ERROR:', error); // (改用 CRITICAL)
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ★★★ (v2 新增) 錢包監控 - CRUD API ★★★
/**
 * @description 獲取監控錢包列表 (含餘額)
 * @route GET /api/admin/wallets
 * @access Private
 * @params query { page, limit, name, type, address }
 */
router.get('/wallets', authMiddleware, async (req, res) => {
    const { 
        page = 1, 
        limit = 10,
        name, // 模糊
        type, // 精确
        address // 精确
    } = req.query;

    try {
        const params = [];
        let whereClauses = [];
        let paramIndex = 1;

        if (name) {
            params.push(`%${name}%`);
            whereClauses.push(`name ILIKE $${paramIndex++}`);
        }
        if (type) {
            params.push(type);
            whereClauses.push(`type = $${paramIndex++}`);
        }
        if (address) {
            // ETH 地址不分大小寫，但我們存儲時可以統一小寫
            params.push(address.toLowerCase());
            whereClauses.push(`LOWER(address) = LOWER($${paramIndex++})`);
        }
        
        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Count total
        const countSql = `SELECT COUNT(*) FROM monitored_wallets ${whereSql}`;
        const countResult = await db.query(countSql, params);
        const total = parseInt(countResult.rows[0].count, 10);

        if (total === 0) {
            return res.status(200).json({ total: 0, list: [] });
        }

        // Fetch paginated data
        const dataSql = `SELECT id, name, type, address, created_at FROM monitored_wallets ${whereSql} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        const offset = (page - 1) * limit;
        params.push(limit);
        params.push(offset);
        const dataResult = await db.query(dataSql, params);
        
        // (★★★ 關鍵：即時查詢餘額 ★★★)
        const provider = require('../server.js').provider; //
        if (!provider) throw new Error('Blockchain provider not initialized');

        const walletsWithBalance = await Promise.all(dataResult.rows.map(async (wallet) => {
            try {
                const balanceWei = await provider.getBalance(wallet.address);
                const balanceEth = ethers.formatEther(balanceWei); //
                return { ...wallet, balanceEth }; // 將餘額 加入物件
            } catch (balanceError) {
                console.error(`Failed to get balance for ${wallet.address}:`, balanceError.message);
                return { ...wallet, balanceEth: '查询失败' }; // 或 null
            }
        }));

        res.status(200).json({ total, list: walletsWithBalance });

    } catch (error) {
        console.error('[Admin Wallets] Error fetching wallets:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 新增監控錢包
 * @route POST /api/admin/wallets
 * @access Private
 * @body { name, type, address }
 */
router.post('/wallets', authMiddleware, async (req, res) => {
    const { name, type, address } = req.body;
    if (!name || !type || !address) {
        return res.status(400).json({ error: 'Name, type, and address are required.' });
    }
    // (簡單驗證地址格式)
    if (!ethers.isAddress(address)) {
        return res.status(400).json({ error: 'Invalid wallet address format.' });
    }

    try {
        const result = await db.query(
            'INSERT INTO monitored_wallets (name, type, address) VALUES ($1, $2, $3) RETURNING *',
            [name, type, address.toLowerCase()] // 儲存小寫地址
        );
        console.log(`[Admin Wallets] Wallet ${result.rows[0].id} created by ${req.user.username}`);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // unique_violation (地址已存在)
             return res.status(409).json({ error: 'Wallet address already exists.' });
        }
        console.error('[Admin Wallets] Error creating wallet:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 更新監控錢包
 * @route PUT /api/admin/wallets/:id
 * @access Private
 * @body { name, type, address }
 */
router.put('/wallets/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { name, type, address } = req.body;
    if (!name || !type || !address) { /* ... */ }
    if (!ethers.isAddress(address)) { /* ... */ }

    try {
        const result = await db.query(
            'UPDATE monitored_wallets SET name = $1, type = $2, address = $3 WHERE id = $4 RETURNING *',
            [name, type, address.toLowerCase(), id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Wallet not found.' });
        }
        console.log(`[Admin Wallets] Wallet ${id} updated by ${req.user.username}`);
        res.status(200).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { /* ... */ }
        console.error(`[Admin Wallets] Error updating wallet ${id}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 刪除監控錢包
 * @route DELETE /api/admin/wallets/:id
 * @access Private
 */
router.delete('/wallets/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('DELETE FROM monitored_wallets WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Wallet not found.' });
        }
        console.log(`[Admin Wallets] Wallet ${id} deleted by ${req.user.username}`);
        res.status(204).send(); // No Content
    } catch (error) {
        console.error(`[Admin Wallets] Error deleting wallet ${id}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ★★★ (v2 新增) 系統設定 - 遊戲參數 API ★★★
/**
 * @description 獲取所有系統設定
 * @route GET /api/admin/settings
 * @access Private
 */
router.get('/settings', authMiddleware, async (req, res) => {
    try {
        const result = await db.query('SELECT key, value, description FROM system_settings');
        // 將陣列轉換為 key-value 物件方便前端使用
        const settings = result.rows.reduce((acc, row) => {
            acc[row.key] = { value: row.value, description: row.description };
            return acc;
        }, {});
        res.status(200).json(settings);
    } catch (error) {
        console.error('[Admin Settings] Error fetching settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 更新單個系統設定
 * @route PUT /api/admin/settings/:key
 * @access Private
 * @body { value: string }
 */
router.put('/settings/:key', authMiddleware, async (req, res) => {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined || value === null) {
        return res.status(400).json({ error: 'Value is required.' });
    }

    // (未來可擴充：根據 key 做不同的驗證，例如 PAYOUT_MULTIPLIER 必須是數字)
    if (key === 'PAYOUT_MULTIPLIER') {
        const numValue = parseInt(value, 10);
        if (isNaN(numValue) || numValue <= 0) {
            return res.status(400).json({ error: 'PAYOUT_MULTIPLIER must be a positive integer.' });
        }
        // (驗證通過，繼續使用字串 value 儲存)
    }

    try {
        const result = await db.query(
            'UPDATE system_settings SET value = $1, updated_at = NOW() WHERE key = $2 RETURNING key, value',
            [value.toString(), key] // 確保儲存的是字串
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: `Setting key '${key}' not found.` });
        }
        
        console.log(`[Admin Settings] Setting '${key}' updated to '${value}' by ${req.user.username}`);
        res.status(200).json(result.rows[0]);

    } catch (error) {
        console.error(`[Admin Settings] Error updating setting '${key}':`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ★★★ (v2 新增) 系統設定 - 阻擋地區 API ★★★
/**
 * @description 獲取阻擋地區列表 (不分頁，一次全取)
 * @route GET /api/admin/blocked-regions
 * @access Private
 */
router.get('/blocked-regions', authMiddleware, async (req, res) => {
    try {
        // (通常阻擋列表不會非常大，先不加分頁)
        const result = await db.query('SELECT id, ip_range::text, description, created_at FROM blocked_regions ORDER BY created_at DESC');
        // (將 CIDR 轉為 text 方便前端顯示)
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('[Admin BlockedRegions] Error fetching regions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 新增阻擋地區
 * @route POST /api/admin/blocked-regions
 * @access Private
 * @body { ip_range: string, description?: string }
 */
router.post('/blocked-regions', authMiddleware, async (req, res) => {
    const { ip_range, description } = req.body;
    if (!ip_range) {
        return res.status(400).json({ error: 'IP range (CIDR format) is required.' });
    }
    // (未來可加強驗證 ip_range 格式)

    try {
        const result = await db.query(
            'INSERT INTO blocked_regions (ip_range, description) VALUES ($1, $2) RETURNING id, ip_range::text, description, created_at',
            [ip_range, description || null] // description 可為空
        );
        console.log(`[Admin BlockedRegions] Region ${result.rows[0].ip_range} added by ${req.user.username}`);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // unique_violation
             return res.status(409).json({ error: 'IP range already exists.' });
        }
         // (處理可能的 CIDR 格式錯誤)
        if (error.code === '22P02') { // invalid_text_representation (通常是 CIDR 格式錯誤)
             return res.status(400).json({ error: 'Invalid IP range format. Please use CIDR notation (e.g., 1.2.3.4/32 or 1.2.3.0/24).' });
        }
        console.error('[Admin BlockedRegions] Error adding region:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 刪除阻擋地區
 * @route DELETE /api/admin/blocked-regions/:id
 * @access Private
 */
router.delete('/blocked-regions/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('DELETE FROM blocked_regions WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Blocked region not found.' });
        }
        console.log(`[Admin BlockedRegions] Region ID ${id} deleted by ${req.user.username}`);
        res.status(204).send(); // No Content
    } catch (error) {
        console.error(`[Admin BlockedRegions] Error deleting region ${id}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ★★★ (v2 新增) 系統設定 - 用戶等級 CRUD API ★★★
/**
 * @description 獲取所有用戶等級設定
 * @route GET /api/admin/user-levels
 * @access Private
 */
router.get('/user-levels', authMiddleware, async (req, res) => {
    try {
        // 按等級排序
        const result = await db.query('SELECT * FROM user_levels ORDER BY level ASC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('[Admin UserLevels] Error fetching levels:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 新增用戶等級設定
 * @route POST /api/admin/user-levels
 * @access Private
 * @body { level, name, max_bet_amount, required_bets_for_upgrade, min_bet_amount_for_upgrade, upgrade_reward_amount }
 */
router.post('/user-levels', authMiddleware, async (req, res) => {
    const { level, name, max_bet_amount, required_bets_for_upgrade, min_bet_amount_for_upgrade, upgrade_reward_amount } = req.body;
    // (簡單驗證)
    if (!level || level <= 0 || !max_bet_amount || max_bet_amount < 0 || required_bets_for_upgrade < 0 || min_bet_amount_for_upgrade < 0 || upgrade_reward_amount < 0) {
        return res.status(400).json({ error: 'Invalid input data.' });
    }

    try {
        const result = await db.query(
            `INSERT INTO user_levels (level, name, max_bet_amount, required_bets_for_upgrade, min_bet_amount_for_upgrade, upgrade_reward_amount, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
             RETURNING *`,
            [level, name || `Level ${level}`, max_bet_amount, required_bets_for_upgrade, min_bet_amount_for_upgrade, upgrade_reward_amount]
        );
        console.log(`[Admin UserLevels] Level ${level} created by ${req.user.username}`);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // unique_violation (level 已存在)
             return res.status(409).json({ error: `Level ${level} already exists.` });
        }
        console.error('[Admin UserLevels] Error creating level:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 更新用戶等級設定
 * @route PUT /api/admin/user-levels/:level
 * @access Private
 * @body { name, max_bet_amount, required_bets_for_upgrade, min_bet_amount_for_upgrade, upgrade_reward_amount }
 */
router.put('/user-levels/:level', authMiddleware, async (req, res) => {
    const level = parseInt(req.params.level, 10);
    const { name, max_bet_amount, required_bets_for_upgrade, min_bet_amount_for_upgrade, upgrade_reward_amount } = req.body;
    if (isNaN(level) || level <= 0 || !max_bet_amount || max_bet_amount < 0 || required_bets_for_upgrade < 0 || min_bet_amount_for_upgrade < 0 || upgrade_reward_amount < 0) {
         return res.status(400).json({ error: 'Invalid input data.' });
    }

    try {
        const result = await db.query(
            `UPDATE user_levels 
             SET name = $1, max_bet_amount = $2, required_bets_for_upgrade = $3, min_bet_amount_for_upgrade = $4, upgrade_reward_amount = $5, updated_at = NOW() 
             WHERE level = $6 
             RETURNING *`,
            [name || `Level ${level}`, max_bet_amount, required_bets_for_upgrade, min_bet_amount_for_upgrade, upgrade_reward_amount, level]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: `Level ${level} not found.` });
        }
        console.log(`[Admin UserLevels] Level ${level} updated by ${req.user.username}`);
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(`[Admin UserLevels] Error updating level ${level}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 刪除用戶等級設定
 * @route DELETE /api/admin/user-levels/:level
 * @access Private
 */
router.delete('/user-levels/:level', authMiddleware, async (req, res) => {
    const level = parseInt(req.params.level, 10);
     if (isNaN(level) || level <= 0) {
        return res.status(400).json({ error: 'Invalid level.' });
    }
    // (安全機制：通常不允許刪除 Level 1)
    if (level === 1) {
        return res.status(400).json({ error: 'Cannot delete Level 1.' });
    }
    // (未來可擴充：檢查是否有用戶正在此等級，若有則阻止刪除)

    try {
        const result = await db.query('DELETE FROM user_levels WHERE level = $1 RETURNING level', [level]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: `Level ${level} not found.` });
        }
        console.log(`[Admin UserLevels] Level ${level} deleted by ${req.user.username}`);
        res.status(204).send(); // No Content
    } catch (error) {
        console.error(`[Admin UserLevels] Error deleting level ${level}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ★★★ (v2 新增) 後台管理 - 帳號管理 CRUD API ★★★
/**
 * @description 獲取後台帳號列表
 * @route GET /api/admin/accounts
 * @access Private (未來應限制為 super_admin)
 */
router.get('/accounts', authMiddleware, async (req, res) => {
    try {
        // (不發送 password_hash)
        const result = await db.query('SELECT id, username, role, status, created_at FROM admin_users ORDER BY id ASC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('[Admin Accounts] Error fetching accounts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 新增後台帳號
 * @route POST /api/admin/accounts
 * @access Private
 */
router.post('/accounts', authMiddleware, async (req, res) => {
    const { username, password, role, status } = req.body;
    if (!username || !password || !role || !status) {
        return res.status(400).json({ error: 'Username, password, role, and status are required.' });
    }
    try {
        // (密碼加密)
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const result = await db.query(
            'INSERT INTO admin_users (username, password_hash, role, status) VALUES ($1, $2, $3, $4) RETURNING id, username, role, status, created_at',
            [username, password_hash, role, status]
        );
        console.log(`[Admin Accounts] Account ${username} created by ${req.user.username}`);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { return res.status(409).json({ error: 'Username already exists.' }); }
        console.error('[Admin Accounts] Error creating account:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 更新後台帳號
 * @route PUT /api/admin/accounts/:id
 * @access Private
 */
router.put('/accounts/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { username, password, role, status } = req.body; // (password 是可選的)
    if (!username || !role || !status) {
        return res.status(400).json({ error: 'Username, role, and status are required.' });
    }

    try {
        let result;
        if (password) {
            // (如果提供了密碼，則更新密碼)
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(password, salt);
            result = await db.query(
                'UPDATE admin_users SET username = $1, role = $2, status = $3, password_hash = $4 WHERE id = $5 RETURNING id, username, role, status',
                [username, role, status, password_hash, id]
            );
        } else {
            // (如果沒提供密碼，則不更新密碼)
            result = await db.query(
                'UPDATE admin_users SET username = $1, role = $2, status = $3 WHERE id = $4 RETURNING id, username, role, status',
                [username, role, status, id]
            );
        }
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Account not found.' });
        }
        console.log(`[Admin Accounts] Account ID ${id} updated by ${req.user.username}`);
        res.status(200).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { return res.status(409).json({ error: 'Username already exists.' }); }
        console.error(`[Admin Accounts] Error updating account ${id}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @description 刪除後台帳號
 * @route DELETE /api/admin/accounts/:id
 * @access Private
 */
router.delete('/accounts/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const currentUserId = req.user.id; // (從 JWT 獲取)

    // (安全機制：不允許刪除自己)
    if (parseInt(id, 10) === currentUserId) {
        return res.status(403).json({ error: 'Cannot delete your own account.' });
    }
    // (安全機制：不允許刪除 ID=1 的 super_admin 帳號)
    if (parseInt(id, 10) === 1) {
         return res.status(403).json({ error: 'Cannot delete the primary super admin account.' });
    }

    try {
        const result = await db.query('DELETE FROM admin_users WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Account not found.' });
        }
        console.log(`[Admin Accounts] Account ID ${id} deleted by ${req.user.username}`);
        res.status(204).send(); // No Content
    } catch (error) {
        console.error(`[Admin Accounts] Error deleting account ${id}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;