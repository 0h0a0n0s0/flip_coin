-- Migration: Remove max bet limit and bet count requirements from user level system
-- Description: 移除用户等级系统中的「投注限额」与「累计投注数量」相关字段，升级条件仅保留累计有效投注金额

-- 1) user_levels：移除等级投注限额与升级投注数量门槛
ALTER TABLE user_levels
DROP COLUMN IF EXISTS max_bet_amount,
DROP COLUMN IF EXISTS required_bets_for_upgrade;

-- 2) users：移除累计有效投注数量累加器（仅保留金额累加器）
ALTER TABLE users
DROP COLUMN IF EXISTS total_valid_bet_count;

-- 3) 清理可能存在的索引（历史遗留）
DROP INDEX IF EXISTS idx_users_total_valid_bet_count;

