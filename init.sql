-- 建立用戶表 (更新)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    user_id VARCHAR(8) UNIQUE NOT NULL,
    current_streak INT NOT NULL DEFAULT 0, -- ★★★ 新增：目前連勝(正)/連敗(負)
    max_streak INT NOT NULL DEFAULT 0,     -- ★★★ 新增：最高連勝
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 建立投注記錄表
CREATE TABLE bets (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(8) NOT NULL,
    choice VARCHAR(4) NOT NULL,
    amount NUMERIC NOT NULL,
    status VARCHAR(15) NOT NULL DEFAULT 'pending',
    bet_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    settle_time TIMESTAMP WITH TIME ZONE,
    tx_hash VARCHAR(66) UNIQUE,
    prize_tx_hash VARCHAR(66) UNIQUE, -- 確保這一行存在
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 建立索引
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_bets_user_id ON bets(user_id);