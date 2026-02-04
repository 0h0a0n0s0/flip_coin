-- ============================================
-- 归集服务配置参数迁移
-- 创建时间: 2026-01-29
-- 用途: 添加高吞吐量归集服务的配置参数到 system_settings 表
-- ============================================

-- 归集服务配置参数
-- 1. 每次归集扫描的用户数量（批次大小）
INSERT INTO system_settings (key, value, description, category) VALUES
('collection_batch_size', '500', '每次归集扫描的用户数量', 'Collection')
ON CONFLICT (key) DO UPDATE SET 
    description = EXCLUDED.description,
    category = EXCLUDED.category;

-- 2. 停止归集的最低能量阈值
INSERT INTO system_settings (key, value, description, category) VALUES
('collection_min_energy', '35000', '停止归集的最低能量阈值', 'Collection')
ON CONFLICT (key) DO UPDATE SET 
    description = EXCLUDED.description,
    category = EXCLUDED.category;

-- 3. 最大并发归集交易数（预留参数）
INSERT INTO system_settings (key, value, description, category) VALUES
('collection_max_concurrency', '5', '最大并发归集交易数', 'Collection')
ON CONFLICT (key) DO UPDATE SET 
    description = EXCLUDED.description,
    category = EXCLUDED.category;

-- 验证插入结果
SELECT key, value, description, category 
FROM system_settings 
WHERE category = 'Collection' 
ORDER BY key;
