-- 檔案: init.sql (★★★ v7.1 HD 錢包架構 ★★★)

-- ----------------------------
-- v7: 建立用戶表 (HD 錢包)
-- ----------------------------
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL, 
    password_hash VARCHAR(100) NOT NULL, 
    balance NUMERIC NOT NULL DEFAULT 0, -- 平台餘額 (USDT)
    
    -- (★★★ v7 HD 錢包索引 ★★★)
    -- (我們使用同一個索引派生所有鏈的地址，例如 /.../index)
    deposit_path_index INT UNIQUE, 
    
    -- (★★★ v7 充值地址 ★★★)
    -- (我們儲存地址是為了 "高效監聽" 方案，加快反向查詢)
    evm_deposit_address VARCHAR(42) UNIQUE, -- (BSC, ETH, Polygon)
    tron_deposit_address VARCHAR(255) UNIQUE, -- (TRC20)
    -- (未來可新增 sol_deposit_address)

    user_id VARCHAR(8) UNIQUE NOT NULL, 
    current_streak INT NOT NULL DEFAULT 0,
    max_streak INT NOT NULL DEFAULT 0,
    nickname VARCHAR(50) NULL,
    level INT NOT NULL DEFAULT 1,
    invite_code VARCHAR(8) UNIQUE NULL,
    referrer_code VARCHAR(8) NULL,
    last_login_ip VARCHAR(50) NULL,
    last_activity_at TIMESTAMP WITH TIME ZONE NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active', 
    last_level_up_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
-- (為高效監聽器建立索引)
CREATE INDEX idx_users_evm_deposit_address ON users(evm_deposit_address);
CREATE INDEX idx_users_tron_deposit_address ON users(tron_deposit_address);


-- ----------------------------
-- v6: 建立投注記錄表 (不變)
-- (開獎 tx_hash 來自平台輪巡地址)
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
    payout_multiplier INT NOT NULL DEFAULT 2,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ----------------------------
-- v6: 建立資金流水表 (不變)
-- ----------------------------
CREATE TABLE platform_transactions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(8) NOT NULL, 
    type VARCHAR(50) NOT NULL, -- ( 'deposit', 'withdraw', 'level_up_reward', 'commission' )
    chain VARCHAR(20) NULL, -- ( 'TRC20', 'BSC' )
    amount NUMERIC NOT NULL DEFAULT 0, 
    gas_fee NUMERIC NOT NULL DEFAULT 0, 
    tx_hash VARCHAR(255) UNIQUE, 
    status VARCHAR(20) NOT NULL DEFAULT 'completed', -- ( 'pending', 'completed', 'failed' )
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);
CREATE INDEX idx_platform_transactions_type ON platform_transactions(type);
CREATE INDEX idx_platform_transactions_user_id ON platform_transactions(user_id);


-- ----------------------------
-- v2: 建立後台管理員表 (不變)
-- ----------------------------
CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO admin_users (username, password_hash, role)
VALUES ('admin', '$2a$10$E.M9.xQJ3.K/T.Xgs83V9uM.KkNwG.fW1y.H.xP.j/b1L.rYqKz7m', 'super_admin');

-- ----------------------------
-- v7: 建立平台功能錢包表
-- (取代 v6 的 monitored_wallets)
-- (注意：私鑰儲存在 .env 中，這裡只儲存地址和功能)
-- ----------------------------
CREATE TABLE platform_wallets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL, 
    chain_type VARCHAR(20) NOT NULL, -- ( 'BSC', 'TRC20', 'ETH', 'POLYGON', 'SOL' )
    address VARCHAR(255) UNIQUE NOT NULL,
    
    -- (功能標籤)
    is_gas_reserve BOOLEAN NOT NULL DEFAULT false, -- (是否為 Gas 儲備錢包 (TRX, BNB...))
    is_collection BOOLEAN NOT NULL DEFAULT false, -- (是否為資金歸集地址 (USDT))
    
    is_opener_a BOOLEAN NOT NULL DEFAULT false, -- (是否為開獎地址 A)
    is_opener_b BOOLEAN NOT NULL DEFAULT false, -- (是否為開獎地址 B)
    
    is_active BOOLEAN NOT NULL DEFAULT true, -- (是否啟用)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
-- (範例：你可以手動將 .env 中的錢包地址加入這裡)
-- INSERT INTO platform_wallets (name, chain_type, address, is_gas_reserve) 
-- VALUES ('TRON Gas Wallet', 'TRC20', 'T...', true);
-- INSERT INTO platform_wallets (name, chain_type, address, is_collection) 
-- VALUES ('TRON Collection Wallet', 'TRC20', 'T...', true);


-- ----------------------------
-- v2: 系統設定表 (不變)
-- ----------------------------
CREATE TABLE system_settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO system_settings (key, value, description) 
VALUES ('PAYOUT_MULTIPLIER', '2', '派獎倍數 (整數)'); 
INSERT INTO system_settings (key, value, description) 
VALUES ('ALLOW_BSC', 'true', '是否開放 BSC 充值 (true/false)');
INSERT INTO system_settings (key, value, description) 
VALUES ('ALLOW_TRC20', 'true', '是否開放 TRC20 充值 (true/false)');

-- ----------------------------
-- v2: 阻擋地區表 (不變)
-- ----------------------------
CREATE TABLE blocked_regions (
    id SERIAL PRIMARY KEY,
    ip_range CIDR UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------
-- v2: 用戶等級設定表 (不變)
-- ----------------------------
CREATE TABLE user_levels (
    level INT PRIMARY KEY CHECK (level > 0),
    name VARCHAR(50) NOT NULL DEFAULT '',
    max_bet_amount NUMERIC NOT NULL DEFAULT 100,
    required_bets_for_upgrade INT NOT NULL DEFAULT 0,
    min_bet_amount_for_upgrade NUMERIC NOT NULL DEFAULT 0,
    upgrade_reward_amount NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO user_levels (level, name, max_bet_amount, required_bets_for_upgrade, min_bet_amount_for_upgrade, upgrade_reward_amount) 
VALUES (1, 'Level 1', 100, 10, 0.01, 0.005); 

-- ----------------------------
-- v2: 後台 IP 白名單表 (不變)
-- ----------------------------
CREATE TABLE admin_ip_whitelist (
    id SERIAL PRIMARY KEY,
    ip_range CIDR UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO admin_ip_whitelist (ip_range, description) VALUES ('127.0.0.1/32', 'Localhost Access');
INSERT INTO admin_ip_whitelist (ip_range, description) VALUES ('::1/128', 'Localhost IPv6 Access');
INSERT INTO admin_ip_whitelist (ip_range, description) VALUES ('192.168.65.1/32', 'Docker Host IP (Local Dev)');
INSERT INTO admin_ip_whitelist (ip_range, description) VALUES ('125.229.37.48/32', 'My Public IP');