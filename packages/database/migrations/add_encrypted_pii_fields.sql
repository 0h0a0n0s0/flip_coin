-- ============================================
-- 資料庫遷移腳本：新增 PII 加密欄位
-- 目的：符合 GDPR/CCPA 隱私保護規範
-- 影響表：users, admin_audit_logs, user_login_logs
-- 
-- 執行前提：
-- 1. 已在 .env 配置 ENCRYPTION_KEY_PII（64 位十六進位）
-- 2. 已部署 encryptionUtils.js
-- 
-- 執行方式：
-- psql -U flipcoin_user -d flipcoin_db -f add_encrypted_pii_fields.sql
-- ============================================

BEGIN;

-- ============================================
-- 第一部分：users 表新增加密欄位
-- ============================================

-- 1. Email 加密（對稱加密 + HMAC 索引）
ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_hash VARCHAR(64);

-- 2. IP 地址加密（對稱加密，可逆）
ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_registration_ip TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_first_login_ip TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_last_login_ip TEXT;

-- 3. Device ID 雜湊（單向雜湊，用於查詢）
ALTER TABLE users ADD COLUMN IF NOT EXISTS hashed_device_id VARCHAR(64);

-- 4. User Agent 加密（對稱加密）
ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_user_agent TEXT;

-- ============================================
-- 第二部分：admin_audit_logs 表新增加密欄位
-- ============================================

ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS encrypted_ip_address TEXT;

-- ============================================
-- 第三部分：user_login_logs 表新增加密欄位
-- ============================================

ALTER TABLE user_login_logs ADD COLUMN IF NOT EXISTS encrypted_login_ip TEXT;
ALTER TABLE user_login_logs ADD COLUMN IF NOT EXISTS hashed_device_id VARCHAR(64);

-- ============================================
-- 第四部分：建立索引（提升查詢效率）
-- ============================================

-- users 表索引
CREATE INDEX IF NOT EXISTS idx_users_email_hash ON users(email_hash);
CREATE INDEX IF NOT EXISTS idx_users_hashed_device_id ON users(hashed_device_id);

-- user_login_logs 表索引
CREATE INDEX IF NOT EXISTS idx_user_login_logs_hashed_device_id ON user_login_logs(hashed_device_id);

-- ============================================
-- 第五部分：新增註釋（便於維護）
-- ============================================

COMMENT ON COLUMN users.encrypted_email IS 'AES-256-GCM 加密的 Email（格式：iv:authTag:ciphertext）';
COMMENT ON COLUMN users.email_hash IS 'HMAC-SHA256 雜湊索引，用於 Email 查詢';
COMMENT ON COLUMN users.encrypted_registration_ip IS 'AES-256-GCM 加密的註冊 IP';
COMMENT ON COLUMN users.encrypted_first_login_ip IS 'AES-256-GCM 加密的首次登入 IP';
COMMENT ON COLUMN users.encrypted_last_login_ip IS 'AES-256-GCM 加密的最後登入 IP';
COMMENT ON COLUMN users.hashed_device_id IS 'SHA-256 雜湊的 Device ID（單向）';
COMMENT ON COLUMN users.encrypted_user_agent IS 'AES-256-GCM 加密的 User Agent';

COMMENT ON COLUMN admin_audit_logs.encrypted_ip_address IS 'AES-256-GCM 加密的管理員操作 IP';
COMMENT ON COLUMN user_login_logs.encrypted_login_ip IS 'AES-256-GCM 加密的登入 IP';
COMMENT ON COLUMN user_login_logs.hashed_device_id IS 'SHA-256 雜湊的 Device ID';

-- ============================================
-- 完成
-- ============================================

COMMIT;

-- ============================================
-- 驗證步驟（手動執行）
-- ============================================

-- 檢查欄位是否成功新增
-- SELECT column_name, data_type, character_maximum_length 
-- FROM information_schema.columns 
-- WHERE table_name = 'users' AND column_name LIKE '%encrypted%' OR column_name LIKE '%hashed%';

-- 檢查索引是否成功建立
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'users' AND indexname LIKE '%hash%';
