-- 將 payout_multiplier 從 INT 改為 DECIMAL，以支援小數點設定
-- 使用 DECIMAL(10, 2) 格式：總共10位數，小數點後2位

-- 檢查欄位是否存在且為 INT 類型
DO $$
BEGIN
    -- 如果欄位存在且為 INT 類型，則修改為 DECIMAL
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'games' 
        AND column_name = 'payout_multiplier'
        AND data_type = 'integer'
    ) THEN
        -- 修改欄位類型為 DECIMAL(10, 2)
        ALTER TABLE games 
        ALTER COLUMN payout_multiplier TYPE DECIMAL(10, 2) USING payout_multiplier::DECIMAL(10, 2);
        
        RAISE NOTICE 'payout_multiplier 欄位已成功從 INT 改為 DECIMAL(10, 2)';
    ELSE
        -- 如果欄位不存在或已經是 DECIMAL，則跳過
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'games' 
            AND column_name = 'payout_multiplier'
        ) THEN
            RAISE NOTICE 'payout_multiplier 欄位不存在，跳過修改';
        ELSE
            RAISE NOTICE 'payout_multiplier 欄位已經是 DECIMAL 類型，跳過修改';
        END IF;
    END IF;
END $$;

