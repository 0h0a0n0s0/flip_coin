-- ============================================
-- 清理 system_settings 中的归集配置
-- 创建时间: 2026-01-29
-- 用途: 移除已迁移到 collection_settings 的配置项
-- ============================================

-- 查看要删除的配置
SELECT key, value, description, category 
FROM system_settings 
WHERE category = 'Collection';

-- 删除归集配置（这些配置已迁移到 collection_settings 表）
DELETE FROM system_settings 
WHERE key IN ('collection_batch_size', 'collection_min_energy', 'collection_max_concurrency');

-- 验证删除结果
SELECT key, value, description, category 
FROM system_settings 
WHERE category = 'Collection';

\echo ''
\echo '✅ 已清理 system_settings 中的归集配置'
\echo '📝 这些配置已迁移到 collection_settings 表，与钱包关联'
\echo ''
