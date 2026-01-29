#!/bin/bash
# ============================================
# Dry Run 測試腳本
# 用途：在臨時 Docker 容器中測試 init.sql
# ============================================

set -e  # 遇到錯誤立即退出

echo "=========================================="
echo "🧪 開始 Dry Run 測試 (init.sql v2.0)"
echo "=========================================="
echo ""

# 檢查 Docker 是否運行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker 未運行，請先啟動 Docker"
    exit 1
fi

echo "✅ Docker 運行中"
echo ""

# 定義測試容器名稱
TEST_CONTAINER="flipcoin-dryrun-test"
TEST_DB="flipcoin_test_db"
TEST_USER="test_user"
TEST_PASSWORD="test_password"

# 清理舊的測試容器（如果存在）
echo "🧹 清理舊的測試環境..."
docker rm -f "$TEST_CONTAINER" 2>/dev/null || true
echo ""

# 啟動臨時 PostgreSQL 容器
echo "🚀 啟動臨時 PostgreSQL 容器..."
docker run -d \
  --name "$TEST_CONTAINER" \
  -e POSTGRES_USER="$TEST_USER" \
  -e POSTGRES_PASSWORD="$TEST_PASSWORD" \
  -e POSTGRES_DB="$TEST_DB" \
  -v "$(pwd)/init.sql:/docker-entrypoint-initdb.d/init.sql" \
  -p 5433:5432 \
  postgres:14-alpine

echo "⏳ 等待 PostgreSQL 啟動..."
sleep 10

# 檢查容器是否正常運行
if ! docker ps | grep -q "$TEST_CONTAINER"; then
    echo "❌ 容器啟動失敗"
    docker logs "$TEST_CONTAINER"
    docker rm -f "$TEST_CONTAINER"
    exit 1
fi

echo "✅ PostgreSQL 容器已啟動"
echo ""

# 執行驗證 SQL
echo "=========================================="
echo "🔍 執行驗證檢查..."
echo "=========================================="
echo ""

docker exec "$TEST_CONTAINER" psql -U "$TEST_USER" -d "$TEST_DB" -f /docker-entrypoint-initdb.d/../dry-run-validation.sql 2>/dev/null || \
docker exec "$TEST_CONTAINER" psql -U "$TEST_USER" -d "$TEST_DB" <<EOF

-- ============================================
-- 內嵌驗證腳本
-- ============================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '📊 關鍵欄位類型驗證'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
    '1. users.balance' as check_item,
    data_type || '(' || numeric_precision || ',' || numeric_scale || ')' as actual_type,
    CASE 
        WHEN data_type = 'numeric' AND numeric_precision = 20 AND numeric_scale = 6 
        THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'balance';

SELECT 
    '2. bets.amount' as check_item,
    data_type || '(' || numeric_precision || ',' || numeric_scale || ')' as actual_type,
    CASE 
        WHEN data_type = 'numeric' AND numeric_precision = 20 AND numeric_scale = 6 
        THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result
FROM information_schema.columns
WHERE table_name = 'bets' AND column_name = 'amount';

SELECT 
    '3. bets.payout_multiplier' as check_item,
    data_type || '(' || numeric_precision || ',' || numeric_scale || ')' as actual_type,
    CASE 
        WHEN data_type = 'numeric' AND numeric_precision = 10 AND numeric_scale = 2 
        THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result
FROM information_schema.columns
WHERE table_name = 'bets' AND column_name = 'payout_multiplier';

SELECT 
    '4. games.payout_multiplier' as check_item,
    data_type || '(' || numeric_precision || ',' || numeric_scale || ')' as actual_type,
    CASE 
        WHEN data_type = 'numeric' AND numeric_precision = 10 AND numeric_scale = 2 
        THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result
FROM information_schema.columns
WHERE table_name = 'games' AND column_name = 'payout_multiplier';

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '📋 新增表驗證'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
    '5. balance_changes' as check_item,
    'TABLE' as type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'balance_changes')
        THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result;

SELECT 
    '6. withdrawal_address_blacklist' as check_item,
    'TABLE' as type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'withdrawal_address_blacklist')
        THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '🔧 等級系統累加器驗證'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
    '7. users.total_valid_bet_amount' as check_item,
    data_type || '(' || numeric_precision || ',' || numeric_scale || ')' as actual_type,
    CASE 
        WHEN data_type = 'numeric' AND numeric_precision = 20 AND numeric_scale = 6
        THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'total_valid_bet_amount';

SELECT 
    '8. users.total_valid_bet_count' as check_item,
    data_type as actual_type,
    CASE 
        WHEN data_type = 'integer'
        THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'total_valid_bet_count';

SELECT 
    '9. user_levels.required_total_bet_amount' as check_item,
    data_type || '(' || numeric_precision || ',' || numeric_scale || ')' as actual_type,
    CASE 
        WHEN data_type = 'numeric' AND numeric_precision = 20 AND numeric_scale = 6
        THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result
FROM information_schema.columns
WHERE table_name = 'user_levels' AND column_name = 'required_total_bet_amount';

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '🔄 歸集系統驗證 (新架構)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
    '10. collection_cursor.last_processed_user_id' as check_item,
    data_type as actual_type,
    CASE 
        WHEN data_type = 'bigint'
        THEN '✅ PASS (新架構)' 
        ELSE '❌ FAIL' 
    END as result
FROM information_schema.columns
WHERE table_name = 'collection_cursor' AND column_name = 'last_processed_user_id';

-- 檢查舊欄位是否已移除
SELECT 
    '11. collection_cursor (舊欄位已移除)' as check_item,
    'VALIDATION' as type,
    CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'collection_cursor' 
            AND column_name IN ('collection_wallet_address', 'last_user_id', 'last_processed_date')
        )
        THEN '✅ PASS (舊欄位已清理)' 
        ELSE '⚠️ WARNING (舊欄位仍存在)' 
    END as result;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '👤 管理員系統驗證'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
    '12. admin_users.last_login_ip' as check_item,
    data_type as actual_type,
    CASE 
        WHEN column_name IS NOT NULL THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result
FROM information_schema.columns
WHERE table_name = 'admin_users' AND column_name = 'last_login_ip';

SELECT 
    '13. admin_users.google_secret' as check_item,
    data_type as actual_type,
    CASE 
        WHEN column_name IS NOT NULL THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result
FROM information_schema.columns
WHERE table_name = 'admin_users' AND column_name = 'google_secret';

SELECT 
    '14. admin_users.is_2fa_enabled' as check_item,
    data_type as actual_type,
    CASE 
        WHEN data_type = 'boolean' THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result
FROM information_schema.columns
WHERE table_name = 'admin_users' AND column_name = 'is_2fa_enabled';

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '🛡️ 風控系統驗證'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
    '15. risk_max_win_rate_percent' as check_item,
    value as current_value,
    category,
    CASE 
        WHEN key IS NOT NULL THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result
FROM system_settings
WHERE key = 'risk_max_win_rate_percent';

SELECT 
    '16. risk_min_bet_count' as check_item,
    value as current_value,
    category,
    CASE 
        WHEN key IS NOT NULL THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as result
FROM system_settings
WHERE key = 'risk_min_bet_count';

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '📈 總結報告'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
    COUNT(*) as total_tables,
    '張表已創建' as description
FROM information_schema.tables
WHERE table_schema = 'public';

SELECT 
    'FINAL RESULT' as status,
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
        AND (
            SELECT COUNT(*) 
            FROM information_schema.tables 
            WHERE table_name IN ('balance_changes', 'withdrawal_address_blacklist')
        ) = 2
        THEN '✅✅✅ ALL CRITICAL CHECKS PASSED ✅✅✅'
        ELSE '❌❌❌ SOME CHECKS FAILED ❌❌❌'
    END as result;

EOF

echo ""
echo "=========================================="
echo "🧹 清理測試環境..."
echo "=========================================="

# 停止並刪除測試容器
docker stop "$TEST_CONTAINER" > /dev/null
docker rm "$TEST_CONTAINER" > /dev/null

echo "✅ 測試環境已清理"
echo ""
echo "=========================================="
echo "✅ Dry Run 測試完成！"
echo "=========================================="
