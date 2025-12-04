-- Migration: Add last_login_ip to admin_users table
-- Date: 2025-12-02
-- Description: Add last_login_ip field to track admin user login IP addresses

-- Add last_login_ip column to admin_users table
ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(50) NULL,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_admin_users_last_login_ip ON admin_users(last_login_ip);

-- Add comment
COMMENT ON COLUMN admin_users.last_login_ip IS 'Last login IP address of the admin user';
COMMENT ON COLUMN admin_users.last_login_at IS 'Timestamp of the last login';

