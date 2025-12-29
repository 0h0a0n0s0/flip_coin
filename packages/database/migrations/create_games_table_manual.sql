-- 手动创建游戏管理表（用于已存在的数据库）
-- 如果表已存在，此脚本会失败，需要先检查

-- 创建表
CREATE TABLE games (
    id SERIAL PRIMARY KEY,
    provider VARCHAR(50) NOT NULL DEFAULT '自营', -- 游戏厂商：自营、或三方厂商名
    provider_params TEXT, -- 游戏参数：自营留空，或三方厂商参数（JSON格式）
    name_zh VARCHAR(100) NOT NULL, -- 游戏名字（中文）
    name_en VARCHAR(100), -- 英文名字（用于多语系）
    game_code VARCHAR(50), -- 游戏代码（用于路由匹配，如 'flip-coin'）
    game_status VARCHAR(20), -- 游戏状态：热门、新游戏、推荐、无等标签
    status VARCHAR(10) NOT NULL DEFAULT 'enabled', -- 状态：enabled（开启）、disabled（关闭）
    sort_order INT NOT NULL DEFAULT 0, -- 排序
    payout_multiplier INT NOT NULL DEFAULT 2, -- 派奖倍数
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_games_provider ON games(provider);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_sort_order ON games(sort_order);

