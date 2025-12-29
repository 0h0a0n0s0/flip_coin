-- 更新管理员 IP 白名单：仅允许本机和同一 WiFi 内网访问
-- 执行时间：当前

-- 删除旧的公网 IP 配置（如果存在）
DELETE FROM admin_ip_whitelist WHERE ip_range = '125.229.37.48/32';

-- 确保本地访问配置存在
INSERT INTO admin_ip_whitelist (ip_range, description) 
VALUES ('127.0.0.1/32', 'Localhost Access')
ON CONFLICT DO NOTHING;

INSERT INTO admin_ip_whitelist (ip_range, description) 
VALUES ('::1/128', 'Localhost IPv6 Access')
ON CONFLICT DO NOTHING;

-- 添加同一 WiFi 内网网段（192.168.50.0/24）
INSERT INTO admin_ip_whitelist (ip_range, description) 
VALUES ('192.168.50.0/24', 'Same WiFi Network (192.168.50.x)')
ON CONFLICT DO NOTHING;

-- 确保 Docker Host IP 配置存在（开发环境）
INSERT INTO admin_ip_whitelist (ip_range, description) 
VALUES ('192.168.65.1/32', 'Docker Host IP (Local Dev)')
ON CONFLICT DO NOTHING;

-- 显示当前白名单配置
SELECT ip_range, description FROM admin_ip_whitelist ORDER BY ip_range;

