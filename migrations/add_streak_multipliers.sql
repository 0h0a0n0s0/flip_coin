-- 迁移脚本：为 games 表添加 streak_multipliers 字段
-- 用于存储连胜模式的多赔率设定（0胜、1胜、2胜...）

-- 添加 streak_multipliers JSON 字段
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS streak_multipliers JSONB DEFAULT NULL;

-- 添加注释说明
COMMENT ON COLUMN games.streak_multipliers IS '连胜模式多赔率设定，JSON格式：{"0": 2.0, "1": 2.5, "2": 3.0, ...}，key为连胜数，value为赔率';

