-- 添加管理员 IP 白名单：125.229.37.48
-- 执行时间：2025-12-29

-- 添加用户指定的公网 IP
INSERT INTO admin_ip_whitelist (ip_range, description) 
VALUES ('125.229.37.48/32', 'Admin Access IP (125.229.37.48)')
ON CONFLICT (ip_range) DO UPDATE SET description = EXCLUDED.description;

-- 显示当前白名单配置
SELECT ip_range, description FROM admin_ip_whitelist ORDER BY ip_range;



