-- 將 bets 表的 payout_multiplier 從 INT 改為 DECIMAL，以支援小數點設定
-- 使用 DECIMAL(10, 2) 格式：總共10位數，小數點後2位

-- 修改欄位類型為 DECIMAL(10, 2)
ALTER TABLE bets 
ALTER COLUMN payout_multiplier TYPE DECIMAL(10, 2) USING payout_multiplier::DECIMAL(10, 2);

