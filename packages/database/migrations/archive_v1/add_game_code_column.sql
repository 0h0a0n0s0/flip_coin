-- 为 games 表添加 game_code 字段
-- 用于路由匹配，如 'flip-coin'

-- 添加 game_code 字段（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' AND column_name = 'game_code'
    ) THEN
        ALTER TABLE games ADD COLUMN game_code VARCHAR(50);
    END IF;
END $$;

-- 更新 Flip Coin 游戏的 game_code
UPDATE games 
SET game_code = 'flip-coin' 
WHERE (name_zh = 'Flip Coin' OR name_en = 'FlipCoin') 
  AND (game_code IS NULL OR game_code = '');

