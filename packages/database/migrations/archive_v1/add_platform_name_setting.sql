-- Migration: Add PLATFORM_NAME system setting
-- Date: 2024

-- Add platform name setting to system_settings
INSERT INTO system_settings (key, value, description, category) 
VALUES ('PLATFORM_NAME', 'FlipCoin', '平台名称，用于显示在前台页签、header、后台标题、谷歌验证器签发方等位置', 'General')
ON CONFLICT (key) DO NOTHING;

