-- 迁移 Flip Coin 游戏数据到 games 表
-- 从 system_settings 读取 PAYOUT_MULTIPLIER 并创建 Flip Coin 游戏记录

-- 先检查是否已存在，如果不存在则插入
DO $$
DECLARE
    v_multiplier INTEGER := 2;
BEGIN
    -- 获取派奖倍数
    SELECT COALESCE(CAST(value AS INTEGER), 2) INTO v_multiplier
    FROM system_settings
    WHERE key = 'PAYOUT_MULTIPLIER'
    LIMIT 1;
    
    -- 如果 Flip Coin 不存在，则插入
    IF NOT EXISTS (SELECT 1 FROM games WHERE name_zh = 'Flip Coin' OR name_en = 'FlipCoin' OR game_code = 'flip-coin') THEN
        INSERT INTO games (provider, provider_params, name_zh, name_en, game_code, game_status, status, sort_order, payout_multiplier, created_at, updated_at)
        VALUES ('自营', NULL, 'Flip Coin', 'FlipCoin', 'flip-coin', '热门', 'enabled', 1, v_multiplier, NOW(), NOW());
    END IF;
END $$;

