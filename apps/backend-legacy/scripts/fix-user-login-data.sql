-- 腳本：修復用戶登入查詢資料（SQL版本）
-- 用途：為舊帳號補齊首次登入地區等資料
-- 執行方式：psql -d flipcoin_db -U game_user -f fix-user-login-data.sql

-- 為缺少首次登入資料的用戶，從登入日誌中補齊資料
UPDATE users u
SET 
    first_login_ip = sub.first_login_ip,
    first_login_country = sub.first_login_country,
    first_login_at = sub.first_login_at
FROM (
    SELECT 
        ull.user_id,
        ull.login_ip as first_login_ip,
        ull.login_country as first_login_country,
        ull.login_at as first_login_at,
        ROW_NUMBER() OVER (PARTITION BY ull.user_id ORDER BY ull.login_at ASC) as rn
    FROM user_login_logs ull
    WHERE ull.user_id IN (
        SELECT user_id FROM users WHERE username IN ('hans01', 'hans02')
    )
) sub
WHERE u.user_id = sub.user_id 
  AND sub.rn = 1
  AND (u.first_login_ip IS NULL OR u.first_login_country IS NULL);

-- 如果沒有登入日誌，使用註冊IP作為首次登入IP（但無法獲取國家）
UPDATE users
SET 
    first_login_ip = registration_ip,
    first_login_at = created_at
WHERE username IN ('hans01', 'hans02')
  AND first_login_ip IS NULL
  AND registration_ip IS NOT NULL;

-- 顯示修復結果
SELECT 
    username,
    user_id,
    registration_ip,
    first_login_ip,
    first_login_country,
    first_login_at,
    (SELECT COUNT(*) FROM user_login_logs WHERE user_id = u.user_id) as login_log_count
FROM users u
WHERE username IN ('hans01', 'hans02');

