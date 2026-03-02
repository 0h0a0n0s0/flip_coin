-- Migration: 加密 Google 2FA Secret
-- Date: 2026-02-12
-- Description: 新增加密欄位用於儲存 Google Authenticator 密鑰，提升安全性

BEGIN;

-- 1. 新增加密欄位（TEXT 類型，因為密文會比原始 base32 長）
ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS encrypted_google_auth_secret TEXT;

-- 2. 新增註解說明
COMMENT ON COLUMN admin_users.encrypted_google_auth_secret IS 'AES-256-GCM 加密的 Google Authenticator 密鑰（格式：iv:authTag:ciphertext）';
COMMENT ON COLUMN admin_users.google_auth_secret IS '（已棄用）明文 Google Authenticator 密鑰，將於加密遷移完成後刪除';

COMMIT;

-- ⚠️ 注意事項：
-- 1. 遷移腳本會將現有 google_auth_secret 加密後存入 encrypted_google_auth_secret
-- 2. 驗證無誤後，再執行 DROP COLUMN google_auth_secret
-- 3. 需要在 .env 中新增 ENCRYPTION_KEY_2FA 環境變數（64 位十六進位）
-- 4. 生成方式：openssl rand -hex 32
