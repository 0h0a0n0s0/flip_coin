-- Migration: Add nickname and google_auth_secret to admin_users table
-- Date: 2024

-- Add nickname column to admin_users table
ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS nickname VARCHAR(100) DEFAULT '';

-- Add google_auth_secret column to admin_users table
ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS google_auth_secret VARCHAR(255) DEFAULT NULL;

-- Add index for nickname (optional, for search)
CREATE INDEX IF NOT EXISTS idx_admin_users_nickname ON admin_users(nickname);

-- Add comments
COMMENT ON COLUMN admin_users.nickname IS 'Admin user nickname';
COMMENT ON COLUMN admin_users.google_auth_secret IS 'Google Authenticator secret key (encrypted)';

