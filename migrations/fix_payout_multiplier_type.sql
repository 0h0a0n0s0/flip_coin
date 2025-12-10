-- 迁移脚本：将 games 表的 payout_multiplier 字段从 INT 改为 NUMERIC，支持小数

-- 修改 payout_multiplier 字段类型为 NUMERIC(10,2)，支持小数点后2位
ALTER TABLE games 
ALTER COLUMN payout_multiplier TYPE NUMERIC(10,2) USING payout_multiplier::NUMERIC(10,2);

-- 修改 bets 表的 payout_multiplier 字段类型为 NUMERIC(10,2)，保持一致性
ALTER TABLE bets 
ALTER COLUMN payout_multiplier TYPE NUMERIC(10,2) USING payout_multiplier::NUMERIC(10,2);

