-- ============================================
-- Dry Run 驗證腳本
-- 用途：驗證 init.sql 初始化後的表結構是否符合業務需求
-- 執行方式：可在臨時 Docker 容器中執行此腳本進行驗證
-- ============================================

-- 檢查 1：users.balance 欄位類型（必須是 DECIMAL(20,6)）
SELECT 
    'users.balance' as check_item,
    column_name,
    data_type,
    numeric_precision,
    numeric_scale,
    CASE 
        WHEN data_type = 'numeric' AND numeric_precision = 20 AND numeric_scale = 6 
        THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'balance';

-- 檢查 2：bets.amount 欄位類型（必須是 DECIMAL(20,6)）
SELECT 
    'bets.amount' as check_item,
    column_name,
    data_type,
    numeric_precision,
    numeric_scale,
    CASE 
        WHEN data_type = 'numeric' AND numeric_precision = 20 AND numeric_scale = 6 
        THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result
FROM information_schema.columns
WHERE table_name = 'bets' AND column_name = 'amount';

-- 檢查 3：bets.payout_multiplier 欄位類型（必須是 DECIMAL(10,2)）
SELECT 
    'bets.payout_multiplier' as check_item,
    column_name,
    data_type,
    numeric_precision,
    numeric_scale,
    CASE 
        WHEN data_type = 'numeric' AND numeric_precision = 10 AND numeric_scale = 2 
        THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result
FROM information_schema.columns
WHERE table_name = 'bets' AND column_name = 'payout_multiplier';

-- 檢查 4：games.payout_multiplier 欄位類型（必須是 DECIMAL(10,2)）
SELECT 
    'games.payout_multiplier' as check_item,
    column_name,
    data_type,
    numeric_precision,
    numeric_scale,
    CASE 
        WHEN data_type = 'numeric' AND numeric_precision = 10 AND numeric_scale = 2 
        THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result
FROM information_schema.columns
WHERE table_name = 'games' AND column_name = 'payout_multiplier';

-- 檢查 5：balance_changes 表是否存在
SELECT 
    'balance_changes table exists' as check_item,
    table_name,
    CASE 
        WHEN table_name IS NOT NULL THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'balance_changes';

-- 檢查 6：withdrawal_address_blacklist 表是否存在
SELECT 
    'withdrawal_address_blacklist table exists' as check_item,
    table_name,
    CASE 
        WHEN table_name IS NOT NULL THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'withdrawal_address_blacklist';

-- 檢查 7：users 表的等級累加器欄位是否存在
SELECT 
    'users.total_valid_bet_amount' as check_item,
    column_name,
    data_type,
    numeric_precision,
    numeric_scale,
    CASE 
        WHEN column_name IS NOT NULL AND data_type = 'numeric' AND numeric_precision = 20 AND numeric_scale = 6
        THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'total_valid_bet_amount';

SELECT 
    'users.total_valid_bet_count' as check_item,
    column_name,
    data_type,
    CASE 
        WHEN column_name IS NOT NULL AND data_type = 'integer'
        THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'total_valid_bet_count';

-- 檢查 8：user_levels.required_total_bet_amount 欄位是否存在
SELECT 
    'user_levels.required_total_bet_amount' as check_item,
    column_name,
    data_type,
    numeric_precision,
    numeric_scale,
    CASE 
        WHEN column_name IS NOT NULL AND data_type = 'numeric' AND numeric_precision = 20 AND numeric_scale = 6
        THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result
FROM information_schema.columns
WHERE table_name = 'user_levels' AND column_name = 'required_total_bet_amount';

-- 檢查 9：collection_cursor 表結構（新架構）
SELECT 
    'collection_cursor.last_processed_user_id' as check_item,
    column_name,
    data_type,
    CASE 
        WHEN column_name IS NOT NULL AND data_type = 'bigint'
        THEN '✅ PASS (新架構)' 
        ELSE '❌ FAIL' 
    END as result
FROM information_schema.columns
WHERE table_name = 'collection_cursor' AND column_name = 'last_processed_user_id';

-- 檢查 10：admin_users 新增欄位
SELECT 
    'admin_users.last_login_ip' as check_item,
    column_name,
    CASE 
        WHEN column_name IS NOT NULL THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result
FROM information_schema.columns
WHERE table_name = 'admin_users' AND column_name = 'last_login_ip';

SELECT 
    'admin_users.google_secret' as check_item,
    column_name,
    CASE 
        WHEN column_name IS NOT NULL THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result
FROM information_schema.columns
WHERE table_name = 'admin_users' AND column_name = 'google_secret';

SELECT 
    'admin_users.is_2fa_enabled' as check_item,
    column_name,
    data_type,
    CASE 
        WHEN column_name IS NOT NULL AND data_type = 'boolean' THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result
FROM information_schema.columns
WHERE table_name = 'admin_users' AND column_name = 'is_2fa_enabled';

-- 檢查 11：所有高精度金額欄位驗證
SELECT 
    table_name,
    column_name,
    data_type,
    numeric_precision,
    numeric_scale,
    CASE 
        WHEN numeric_precision = 20 AND numeric_scale = 6 THEN '✅ PASS' 
        ELSE '⚠️ CHECK' 
    END as result
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('balance', 'amount', 'gas_fee', 'balance_after', 
                      'total_valid_bet_amount', 'required_total_bet_amount',
                      'min_bet_amount_for_upgrade', 'upgrade_reward_amount',
                      'current_staked_trx')
  AND data_type = 'numeric'
ORDER BY table_name, column_name;

-- 檢查 12：風控系統設定是否存在
SELECT 
    'risk_max_win_rate_percent setting' as check_item,
    key,
    value,
    category,
    CASE 
        WHEN key IS NOT NULL THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result
FROM system_settings
WHERE key = 'risk_max_win_rate_percent';

SELECT 
    'risk_min_bet_count setting' as check_item,
    key,
    value,
    category,
    CASE 
        WHEN key IS NOT NULL THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result
FROM system_settings
WHERE key = 'risk_min_bet_count';

-- ============================================
-- 總結報告
-- ============================================
SELECT 
    '==================' as separator,
    'VALIDATION SUMMARY' as title,
    '==================' as separator2;

SELECT 
    COUNT(*) as total_tables
FROM information_schema.tables
WHERE table_schema = 'public';

SELECT 
    'Critical Fields Check' as category,
    CASE 
        WHEN (
            SELECT COUNT(*) 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
              AND column_name = 'balance' 
              AND data_type = 'numeric' 
              AND numeric_precision = 20 
              AND numeric_scale = 6
        ) = 1 
        AND (
            SELECT COUNT(*) 
            FROM information_schema.columns 
            WHERE table_name = 'bets' 
              AND column_name = 'payout_multiplier' 
              AND data_type = 'numeric' 
              AND numeric_precision = 10 
              AND numeric_scale = 2
        ) = 1
        THEN '✅ ALL CRITICAL CHECKS PASSED'
        ELSE '❌ CRITICAL CHECKS FAILED'
    END as status;
