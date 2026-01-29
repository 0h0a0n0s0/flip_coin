-- Migration: Add user level accumulator fields and required_total_bet_amount
-- Date: 2024
-- Description: 添加用户等级累加字段和累计投注金额要求字段，优化等级升级性能

-- ============================================
-- 1. 添加用户累加字段到 users 表
-- ============================================
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS total_valid_bet_amount NUMERIC(20, 6) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_valid_bet_count INT NOT NULL DEFAULT 0;

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_users_total_valid_bet_amount ON users(total_valid_bet_amount);

-- 添加注释
COMMENT ON COLUMN users.total_valid_bet_amount IS '用户累计有效投注金额（用于等级升级计算）';
COMMENT ON COLUMN users.total_valid_bet_count IS '用户累计有效投注数量（用于等级升级计算）';

-- ============================================
-- 2. 添加累计投注金额要求字段到 user_levels 表
-- ============================================
ALTER TABLE user_levels 
ADD COLUMN IF NOT EXISTS required_total_bet_amount NUMERIC(20, 6) NOT NULL DEFAULT 0;

-- 添加注释
COMMENT ON COLUMN user_levels.required_total_bet_amount IS '达到此等级所需的累计总投注金额（升级目标）';
COMMENT ON COLUMN user_levels.min_bet_amount_for_upgrade IS '单个投注的有效性阈值（用于过滤垃圾投注，与升级目标分离）';

-- ============================================
-- 3. 回填现有用户数据（使用优化的 CTE + UPDATE FROM）
-- ============================================
-- 使用 Level 1 的 min_bet_amount_for_upgrade 作为历史数据的有效性阈值
WITH user_stats AS (
    SELECT 
        user_id,
        COALESCE(SUM(amount), 0) as total_amt,
        COALESCE(COUNT(*), 0) as total_cnt
    FROM bets
    WHERE status IN ('won', 'lost')
    -- 使用 Level 1 阈值作为历史数据的有效性基准
    AND amount >= (
        SELECT COALESCE(MIN(min_bet_amount_for_upgrade), 0) 
        FROM user_levels 
        WHERE level = 1
    )
    GROUP BY user_id
)
UPDATE users u
SET 
    total_valid_bet_amount = COALESCE(s.total_amt, 0),
    total_valid_bet_count = COALESCE(s.total_cnt, 0)
FROM user_stats s
WHERE u.user_id = s.user_id;

-- 对于没有投注记录的用户，确保字段为 0（已在 DEFAULT 中处理，但显式更新以确保一致性）
UPDATE users
SET 
    total_valid_bet_amount = 0,
    total_valid_bet_count = 0
WHERE total_valid_bet_amount IS NULL OR total_valid_bet_count IS NULL;
