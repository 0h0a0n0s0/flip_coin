-- 將 payout_multiplier 從 INT 改為 DECIMAL，以支援小數點設定
-- 簡化版本：直接執行 ALTER TABLE，不需要檢查

-- 修改欄位類型為 DECIMAL(10, 2)
ALTER TABLE games 
ALTER COLUMN payout_multiplier TYPE DECIMAL(10, 2) USING payout_multiplier::DECIMAL(10, 2);

