-- 添加帶寬消耗欄位到 collection_logs 表
-- 日期: 2026-02-04
-- 描述: 記錄歸集交易的帶寬消耗，用於區分能量和帶寬的使用情況

-- 添加 bandwidth_used 欄位
ALTER TABLE collection_logs 
ADD COLUMN IF NOT EXISTS bandwidth_used INTEGER DEFAULT NULL;

-- 添加 energy_fee 欄位（能量費用，以 SUN 為單位）
ALTER TABLE collection_logs 
ADD COLUMN IF NOT EXISTS energy_fee BIGINT DEFAULT NULL;

-- 添加註釋
COMMENT ON COLUMN collection_logs.bandwidth_used IS '交易消耗的帶寬（Bandwidth）';
COMMENT ON COLUMN collection_logs.energy_fee IS '交易消耗的能量費用（SUN）';
