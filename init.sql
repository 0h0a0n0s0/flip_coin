-- ----------------------------
-- v1: 建立用戶表 (已擴充 v2 欄位)
-- ----------------------------
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    user_id VARCHAR(8) UNIQUE NOT NULL,
    current_streak INT NOT NULL DEFAULT 0,
    max_streak INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    nickname VARCHAR(50) NULL,
    level INT NOT NULL DEFAULT 1,
    invite_code VARCHAR(8) UNIQUE NULL, -- (已加入 UNIQUE 約束)
    referrer_code VARCHAR(8) NULL,
    last_login_ip VARCHAR(50) NULL,
    last_activity_at TIMESTAMP WITH TIME ZONE NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- (例如: 'active', 'banned')
    last_level_up_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP -- 最後升級時間 (新用戶預設為註冊時間)
);

-- ----------------------------
-- v1: 建立投注記錄表
-- ----------------------------
CREATE TABLE bets (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(8) NOT NULL,
    game_type VARCHAR(50) NOT NULL DEFAULT 'FlipCoin',
    choice VARCHAR(4) NOT NULL,
    amount NUMERIC NOT NULL,
    status VARCHAR(15) NOT NULL DEFAULT 'pending',
    bet_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    settle_time TIMESTAMP WITH TIME ZONE,
    tx_hash VARCHAR(66) UNIQUE,
    prize_tx_hash VARCHAR(66) UNIQUE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ----------------------------
-- v1: 建立索引
-- ----------------------------
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_bets_user_id ON bets(user_id);
-- (v2 invite_code 的索引已在 CREATE TABLE 中透過 UNIQUE 隱含建立)

-- ----------------------------
-- v2: 建立後台管理員表
-- ----------------------------
CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 插入一個預設管理員
-- 帳號: admin
-- 密碼: admin123
-- (密碼已經使用 bcrypt 加密)
INSERT INTO admin_users (username, password_hash, role)
VALUES ('admin', '$2a$10$E.M9.xQJ3.K/T.Xgs83V9uM.KkNwG.fW1y.H.xP.j/b1L.rYqKz7m', 'super_admin');

-- ----------------------------
-- v2: 建立錢包監控表
-- ----------------------------
CREATE TABLE monitored_wallets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL, -- 錢包名稱
    type VARCHAR(50) NOT NULL DEFAULT 'unknown', -- 錢包類型 ('collection', 'payment', 'payout', 'unknown')
    address VARCHAR(42) UNIQUE NOT NULL, -- 錢包地址
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- (可選) 插入一些預設監控的錢包，例如 v1 的遊戲錢包 (地址需要從 .env 取得)
-- INSERT INTO monitored_wallets (name, type, address) VALUES ('v1 Game Wallet', 'payout', 'YOUR_GAME_WALLET_ADDRESS');

-- ----------------------------
-- v2: 建立系統設定表
-- ----------------------------
CREATE TABLE system_settings (
    key VARCHAR(50) PRIMARY KEY, -- 設定項目的鍵 (例如 'PAYOUT_MULTIPLIER')
    value TEXT NOT NULL,         -- 設定值 (以文字儲存，由程式解析)
    description TEXT,            -- 描述
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP -- 最後更新時間
);

-- 插入預設的遊戲參數
INSERT INTO system_settings (key, value, description) 
VALUES ('PAYOUT_MULTIPLIER', '2', '派獎倍數 (整數)'); 
-- (注意：這裡寫死為 '2'，因為 init.sql 無法讀取 .env)

-- ----------------------------
-- v2: 建立阻擋地區表
-- ----------------------------
CREATE TABLE blocked_regions (
    id SERIAL PRIMARY KEY,
    ip_range CIDR UNIQUE NOT NULL, -- IP 地址或 CIDR 範圍
    description TEXT,              -- 描述 (例如 '地區名稱')
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------
-- v2: 建立用戶等級設定表
-- ----------------------------
CREATE TABLE user_levels (
    level INT PRIMARY KEY CHECK (level > 0), -- 等級 (主鍵)
    name VARCHAR(50) NOT NULL DEFAULT '', -- 等級名稱
    max_bet_amount NUMERIC NOT NULL DEFAULT 100, -- 投注限額
    required_bets_for_upgrade INT NOT NULL DEFAULT 0, -- 升級所需注單數 (0=最高級)
    min_bet_amount_for_upgrade NUMERIC NOT NULL DEFAULT 0, -- 升級注單最小金額
    upgrade_reward_amount NUMERIC NOT NULL DEFAULT 0, -- 升級獎勵金額
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 插入一個預設的 Level 1
INSERT INTO user_levels (level, name, max_bet_amount, required_bets_for_upgrade, min_bet_amount_for_upgrade, upgrade_reward_amount) 
VALUES (1, 'Level 1', 100, 10, 0.01, 0.005); 
-- 範例：1級，投注上限100ETH，需10筆有效注單升級，有效注單需>=0.01ETH，升級獎勵0.005ETH

-- ----------------------------
-- v2: 建立後台 IP 白名單表
-- ----------------------------
CREATE TABLE admin_ip_whitelist (
    id SERIAL PRIMARY KEY,
    ip_range CIDR UNIQUE NOT NULL, -- IP 地址或 CIDR 範圍
    description TEXT,              -- 描述 (例如 '辦公室 IP')
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 插入本機 IP 作為安全後門
INSERT INTO admin_ip_whitelist (ip_range, description) VALUES ('127.0.0.1/32', 'Localhost Access');
INSERT INTO admin_ip_whitelist (ip_range, description) VALUES ('::1/128', 'Localhost IPv6 Access');