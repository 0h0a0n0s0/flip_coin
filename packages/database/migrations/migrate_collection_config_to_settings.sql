-- ============================================
-- 迁移归集配置到 collection_settings 表
-- 创建时间: 2026-01-29
-- 用途: 将高吞吐量归集配置从 system_settings 迁移到 collection_settings 表
-- ============================================

-- 1. 添加新字段到 collection_settings 表
ALTER TABLE collection_settings 
ADD COLUMN IF NOT EXISTS batch_size INT NOT NULL DEFAULT 500;

ALTER TABLE collection_settings 
ADD COLUMN IF NOT EXISTS min_energy INT NOT NULL DEFAULT 35000;

ALTER TABLE collection_settings 
ADD COLUMN IF NOT EXISTS max_concurrency INT NOT NULL DEFAULT 1;

-- 添加注释
COMMENT ON COLUMN collection_settings.batch_size IS '每次归集扫描的用户数量（配置驱动批次大小）';
COMMENT ON COLUMN collection_settings.min_energy IS '停止归集的最低能量阈值（能量熔断点）';
COMMENT ON COLUMN collection_settings.max_concurrency IS '最大并发归集交易数（预留参数，当前版本固定为1，串行处理）';

-- 2. 如果 collection_settings 表中已有记录，更新默认值
UPDATE collection_settings 
SET batch_size = 500, 
    min_energy = 35000, 
    max_concurrency = 1,
    updated_at = NOW()
WHERE batch_size IS NULL OR min_energy IS NULL OR max_concurrency IS NULL;

-- 3. 验证结果
SELECT 
    id,
    collection_wallet_address,
    scan_interval_days,
    days_without_deposit,
    batch_size,
    min_energy,
    max_concurrency,
    is_active
FROM collection_settings;

-- 4. 显示表结构
\d collection_settings

-- 5. 提示信息
\echo ''
\echo '✅ 归集配置已成功迁移到 collection_settings 表'
\echo '📝 新增字段：'
\echo '   - batch_size: 每次扫描用户数量（默认 500）'
\echo '   - min_energy: 最低能量阈值（默认 35000）'
\echo '   - max_concurrency: 最大并发数（默认 1，当前串行处理）'
\echo ''
