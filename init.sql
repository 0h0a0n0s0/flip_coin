-- init.sql

-- (刪除舊表)
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS bets CASCADE;
DROP TABLE IF EXISTS platform_transactions CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;
DROP TABLE IF EXISTS platform_wallets CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS blocked_regions CASCADE;
DROP TABLE IF EXISTS user_levels CASCADE;
DROP TABLE IF EXISTS admin_ip_whitelist CASCADE;
DROP TABLE IF EXISTS admin_roles CASCADE;
DROP TABLE IF EXISTS admin_permissions CASCADE;
DROP TABLE IF EXISTS admin_role_permissions CASCADE;
DROP TABLE IF EXISTS withdrawals CASCADE;

-- (建立 RBAC 相關新表)
CREATE TABLE admin_roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE admin_permissions (
    id SERIAL PRIMARY KEY,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'General',
    UNIQUE(resource, action)
);
CREATE TABLE admin_role_permissions (
    role_id INT NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
    permission_id INT NOT NULL REFERENCES admin_permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT 1, id FROM admin_permissions WHERE resource = 'withdrawals'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT 2, id FROM admin_permissions WHERE resource = 'withdrawals'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ----------------------------
-- 建立 users
-- ----------------------------
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL, 
    password_hash VARCHAR(100) NOT NULL, 
    balance NUMERIC NOT NULL DEFAULT 0,
    deposit_path_index INT UNIQUE, 
    evm_deposit_address VARCHAR(42) UNIQUE,
    tron_deposit_address VARCHAR(255) UNIQUE,
    user_id VARCHAR(8) UNIQUE NOT NULL, 
    current_streak INT NOT NULL DEFAULT 0,
    max_streak INT NOT NULL DEFAULT 0,
    nickname VARCHAR(50) NULL,
    level INT NOT NULL DEFAULT 1,
    invite_code VARCHAR(8) UNIQUE NULL,
    referrer_code VARCHAR(8) NULL,
    registration_ip VARCHAR(50) NULL,
    first_login_ip VARCHAR(50) NULL,
    first_login_country VARCHAR(100) NULL,
    first_login_at TIMESTAMP WITH TIME ZONE NULL,
    device_id VARCHAR(255) NULL,
    last_login_ip VARCHAR(50) NULL,
    last_activity_at TIMESTAMP WITH TIME ZONE NULL,
    user_agent TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active', 
    withdrawal_password_hash VARCHAR(100) NULL,
    has_withdrawal_password BOOLEAN NOT NULL DEFAULT false,
    -- (★★★ 原始密碼欄位：記錄註冊時的密碼和首次設置資金密碼時的密碼 ★★★)
    original_password_hash VARCHAR(100) NULL,
    original_withdrawal_password_hash VARCHAR(100) NULL,
    -- (★★★ 密碼指紋欄位：用於比較相同密碼（SHA256）★★★)
    password_fingerprint VARCHAR(64) NULL,
    withdrawal_password_fingerprint VARCHAR(64) NULL,
    last_level_up_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_evm_deposit_address ON users(evm_deposit_address);
CREATE INDEX idx_users_tron_deposit_address ON users(tron_deposit_address);
CREATE INDEX idx_users_registration_ip ON users(registration_ip);
CREATE INDEX idx_users_first_login_ip ON users(first_login_ip);
CREATE INDEX idx_users_device_id ON users(device_id);
CREATE INDEX idx_users_original_password_hash ON users(original_password_hash);
CREATE INDEX idx_users_original_withdrawal_password_hash ON users(original_withdrawal_password_hash);
CREATE INDEX idx_users_password_fingerprint ON users(password_fingerprint);
CREATE INDEX idx_users_withdrawal_password_fingerprint ON users(withdrawal_password_fingerprint);

-- ----------------------------
-- 建立 bets
-- ----------------------------
CREATE TABLE bets (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(8) NOT NULL, 
    game_type VARCHAR(50) NOT NULL DEFAULT 'FlipCoin',
    choice VARCHAR(4) NOT NULL,
    amount NUMERIC NOT NULL, 
    status VARCHAR(15) NOT NULL DEFAULT 'pending',
    bet_ip VARCHAR(50) NULL,
    bet_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    settle_time TIMESTAMP WITH TIME ZONE,
    tx_hash VARCHAR(66) UNIQUE, 
    payout_multiplier INT NOT NULL DEFAULT 2,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
CREATE INDEX idx_bets_bet_ip ON bets(bet_ip);

-- ----------------------------
-- 建立 platform_transactions
-- ----------------------------
CREATE TABLE platform_transactions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(8) NOT NULL, 
    type VARCHAR(50) NOT NULL, 
    chain VARCHAR(20) NULL,
    amount NUMERIC NOT NULL DEFAULT 0, 
    gas_fee NUMERIC NOT NULL DEFAULT 0, 
    tx_hash VARCHAR(255) NULL, 
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);
CREATE INDEX idx_platform_transactions_type ON platform_transactions(type);
CREATE INDEX idx_platform_transactions_user_id ON platform_transactions(user_id);

-- ----------------------------
-- 建立 admin_users (已重構)
-- ----------------------------
CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    role_id INT REFERENCES admin_roles(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ----------------------------
-- 建立 platform_wallets
-- ----------------------------
CREATE TABLE platform_wallets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL, 
    chain_type VARCHAR(20) NOT NULL,
    address VARCHAR(255) UNIQUE NOT NULL,
    is_gas_reserve BOOLEAN NOT NULL DEFAULT false,
    is_collection BOOLEAN NOT NULL DEFAULT false,
    is_opener_a BOOLEAN NOT NULL DEFAULT false,
    is_opener_b BOOLEAN NOT NULL DEFAULT false,
    is_payout BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------
-- 建立 system_settings
-- ----------------------------
CREATE TABLE system_settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'General',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------
-- 建立 blocked_regions
-- ----------------------------
CREATE TABLE blocked_regions (
    id SERIAL PRIMARY KEY,
    ip_range CIDR UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------
-- 建立 user_levels
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

-- ----------------------------
-- 建立 admin_ip_whitelist
-- ----------------------------
CREATE TABLE admin_ip_whitelist (
    id SERIAL PRIMARY KEY,
    ip_range CIDR UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ----------------------------------------------------
-- (插入 RBAC 基礎數據)
-- ----------------------------------------------------

-- 1. 插入權限組
INSERT INTO admin_roles (id, name, description) VALUES
(1, 'Super Admin', '擁有所有權限的超級管理員'),
(2, 'Admin', '管理員 (管理用戶和注單)'),
(3, 'Operator', '營運人員 (僅可讀取報表)');

-- 2. 插入所有可用權限點
INSERT INTO admin_permissions (resource, action, category, description) VALUES
('dashboard', 'read', 'General', '讀取儀表板'),
('users', 'read', 'UserManagement', '讀取用戶列表'),
('users', 'update_status', 'UserManagement', '更新用戶狀態 (禁用/啟用)'),
('users', 'update_info', 'UserManagement', '編輯用戶資料 (暱稱, 等級, 推薦人)'),
('users', 'update_balance', 'UserManagement', '編輯用戶餘額 (高風險)'),
('users_addresses', 'read', 'UserManagement', '讀取用戶充值地址'),
('bets', 'read', 'BetManagement', '讀取注單列表'),
('reports', 'read', 'ReportManagement', '讀取盈虧報表'),
('wallets', 'read', 'ReportManagement', '讀取錢包監控列表'),
('wallets', 'cud', 'ReportManagement', '新增/修改/刪除 錢包 (高風險)'),
('deposits', 'read', 'Finance', '讀取充值記錄列表'),
('balance_changes', 'read', 'Finance', '讀取账变記錄列表'),
('balance_changes', 'read', 'Finance', '讀取账变記錄列表'),
('admin_accounts', 'read', 'System', '讀取後台帳號列表'),
('admin_accounts', 'cud', 'System', '新增/修改/刪除 後台帳號'),
('admin_permissions', 'read', 'System', '讀取權限組列表'),
('admin_permissions', 'update', 'System', '更新權限組權限'),
('admin_ip_whitelist', 'read', 'System', '讀取後台 IP 白名單'),
('admin_ip_whitelist', 'cud', 'System', '新增/刪除 後台 IP 白名單'),
('settings_game', 'read', 'System', '讀取遊戲參數'),
('settings_game', 'update', 'System', '更新遊戲參數'),
('settings_regions', 'read', 'System', '讀取阻擋地區'),
('settings_regions', 'cud', 'System', '新增/刪G 阻擋地區'),
('settings_levels', 'read', 'System', '讀取用戶等級'),
('settings_levels', 'cud', 'System', '新增/修改/刪除 用戶等級'),
('withdrawals', 'read', 'Finance', '讀取提款審核列表'),
('withdrawals', 'update', 'Finance', '審核 (批准/拒絕) 提款');


-- 3. 綁定 'Super Admin' (Role ID 1) 的權限 (全選)
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT 1, id FROM admin_permissions;

-- 4. 綁定 'Admin' (Role ID 2) 的權限 (管理用戶/注單/報表)
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT 2, id FROM admin_permissions WHERE resource IN 
('dashboard', 'users', 'users_addresses', 'bets', 'reports', 'wallets', 'deposits', 'withdrawals', 'balance_changes');

-- 5. 綁定 'Operator' (Role ID 3) 的權限 (僅可讀取)
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT 3, id FROM admin_permissions WHERE action = 'read' 
AND resource IN ('dashboard', 'users', 'users_addresses', 'bets', 'reports', 'wallets', 'deposits', 'withdrawals', 'balance_changes');

-- ----------------------------------------------------
-- (插入初始數據)
-- ----------------------------------------------------

-- 1. 插入 'admin' 帳號並指定為 'Super Admin' (Role ID 1)
INSERT INTO admin_users (username, password_hash, role_id, status)
VALUES ('admin', '$2b$10$AcqgPjrFH7EoZv6Fv0LJ4OMmPbiTom7QrSSTjE6oK92.2JgFs63Wq', 1, 'active'); 

-- 2. 插入 Level 1
INSERT INTO user_levels (level, name, max_bet_amount, required_bets_for_upgrade, min_bet_amount_for_upgrade, upgrade_reward_amount) 
VALUES (1, 'Level 1', 100, 10, 0.01, 0.005); 

-- 3. 插入系統設定 (★★★ v8.1 修改 ★★★)
INSERT INTO system_settings (key, value, description, category) 
VALUES ('PAYOUT_MULTIPLIER', '2', '派獎倍數 (整數)', 'Game'); 

INSERT INTO system_settings (key, value, description, category) 
VALUES ('ALLOW_TRC20', 'true', '是否開放 TRC20 充值 (true/false)', 'Finance');
INSERT INTO system_settings (key, value, description, category) 
VALUES ('ALLOW_BSC', 'true', '是否開放 BSC 充值 (true/false)', 'Finance');

INSERT INTO system_settings (key, value, description, category) 
VALUES ('AUTO_WITHDRAW_THRESHOLD', '10', '自動出款門檻 (小於等於此金額將嘗試自動出款)', 'Finance');

INSERT INTO system_settings (key, value, description, category) 
VALUES ('MAX_SAME_IP_USERS', '5', '同IP允許的最大用戶數，超過則觸發風控封鎖', 'RiskControl');

INSERT INTO system_settings (key, value, description, category) 
VALUES ('DEFAULT_LANGUAGE', 'zh-CN', '默认语言 (zh-CN: 简体中文, en-US: English)', 'I18n');

INSERT INTO system_settings (key, value, description, category) 
VALUES ('SUPPORTED_LANGUAGES', '["zh-CN","en-US"]', '支持的语言列表 (JSON 数组)', 'I18n');

-- 4. 插入本地 IP 到白名單（仅允许本机和同一 WiFi 内网访问）
INSERT INTO admin_ip_whitelist (ip_range, description) VALUES ('127.0.0.1/32', 'Localhost Access');
INSERT INTO admin_ip_whitelist (ip_range, description) VALUES ('::1/128', 'Localhost IPv6 Access');
INSERT INTO admin_ip_whitelist (ip_range, description) VALUES ('192.168.50.0/24', 'Same WiFi Network (192.168.50.x)');
INSERT INTO admin_ip_whitelist (ip_range, description) VALUES ('192.168.65.1/32', 'Docker Host IP (Local Dev)');

-- 建立 withdrawals (新表格)
CREATE TABLE withdrawals (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(8) NOT NULL REFERENCES users(user_id) ON DELETE SET NULL,
    chain_type VARCHAR(20) NOT NULL,
    address VARCHAR(255) NOT NULL,
    amount NUMERIC NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    gas_fee NUMERIC NOT NULL DEFAULT 0,
    tx_hash VARCHAR(255) NULL,
    rejection_reason TEXT NULL,
    request_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    review_time TIMESTAMP WITH TIME ZONE NULL,
    reviewer_id INT NULL REFERENCES admin_users(id) ON DELETE SET NULL
);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);
CREATE INDEX idx_withdrawals_user_id ON withdrawals(user_id);

-- ----------------------------
-- 建立 collection_logs (歸集記錄表)
-- ----------------------------
CREATE TABLE collection_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(8) NOT NULL REFERENCES users(user_id) ON DELETE SET NULL,
    user_deposit_address VARCHAR(255) NOT NULL,
    collection_wallet_address VARCHAR(255) NOT NULL,
    amount NUMERIC NOT NULL,
    tx_hash VARCHAR(255) NULL,
    energy_used INT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_collection_logs_user_id ON collection_logs(user_id);
CREATE INDEX idx_collection_logs_created_at ON collection_logs(created_at);
CREATE INDEX idx_collection_logs_status ON collection_logs(status);

-- ----------------------------
-- 建立 collection_settings (歸集設定表)
-- ----------------------------
CREATE TABLE collection_settings (
    id SERIAL PRIMARY KEY,
    collection_wallet_address VARCHAR(255) NOT NULL,
    scan_interval_days INT NOT NULL DEFAULT 1,
    days_without_deposit INT NOT NULL DEFAULT 7,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(collection_wallet_address)
);

-- ----------------------------
-- 建立 collection_cursor (歸集游標表，記錄當前處理位置)
-- ----------------------------
CREATE TABLE collection_cursor (
    id SERIAL PRIMARY KEY,
    collection_wallet_address VARCHAR(255) NOT NULL,
    last_user_id VARCHAR(8) NULL,
    last_processed_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(collection_wallet_address)
);

-- ----------------------------
-- 建立 admin_audit_logs (後台操作稽核)
-- ----------------------------
CREATE TABLE admin_audit_logs (
    id SERIAL PRIMARY KEY,
    admin_id INT REFERENCES admin_users(id) ON DELETE SET NULL,
    admin_username VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100),
    resource_id VARCHAR(100),
    description TEXT,
    ip_address VARCHAR(100),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_admin_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX idx_admin_audit_logs_created_at ON admin_audit_logs(created_at);

-- ----------------------------
-- 建立 risk_logs (同 IP 風控觸發紀錄)
-- ----------------------------
CREATE TABLE risk_logs (
    id SERIAL PRIMARY KEY,
    ip_address VARCHAR(100) NOT NULL,
    affected_user_ids JSONB NOT NULL,
    action_taken VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_risk_logs_ip_address ON risk_logs(ip_address);
CREATE INDEX idx_risk_logs_created_at ON risk_logs(created_at);

-- ----------------------------
-- 插入初始平台錢包數據
-- ----------------------------
INSERT INTO platform_wallets (name, chain_type, address, is_gas_reserve, is_collection, is_opener_a, is_opener_b, is_payout, is_active) VALUES
('自動出款錢包', 'TRC20', 'TWVJfRMJApn1gpoVAs3NBacgN6sHYaV2mE', false, false, false, false, true, true),
('歸集', 'TRC20', 'TQxXoL3uCx3BKTBffQLA1rExjv6a3fzaDh', false, true, false, false, false, true),
('GAS', 'TRC20', 'TCWSGfSkwNVEuVKThV8HT6LnBQPwZKS5ef', true, false, false, false, false, true),
('開獎錢包B', 'TRC20', 'TMy7h9jUeXnHTBzhabvXen8ea1fPUenDfV', false, false, false, true, false, true),
('開獎錢包A', 'TRC20', 'TCDRJuvuvnjiRLbKRQShqAKdhqymhWCEAV', false, false, true, false, false, true);

-- ----------------------------
-- 插入歸集錢包的初始設定（預設值：每天掃描一次，7天無充值則歸集）
-- ----------------------------
INSERT INTO collection_settings (collection_wallet_address, scan_interval_days, days_without_deposit, is_active) VALUES
('TQxXoL3uCx3BKTBffQLA1rExjv6a3fzaDh', 1, 7, true);

-- ----------------------------
-- 建立 user_login_logs (用戶登錄日誌表)
-- ----------------------------
CREATE TABLE user_login_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(8) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    login_ip VARCHAR(50) NOT NULL,
    login_country VARCHAR(100) NULL,
    device_id VARCHAR(255) NULL,
    user_agent TEXT NULL,
    login_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_user_login_logs_user_id ON user_login_logs(user_id);
CREATE INDEX idx_user_login_logs_login_ip ON user_login_logs(login_ip);
CREATE INDEX idx_user_login_logs_login_at ON user_login_logs(login_at);
CREATE INDEX idx_user_login_logs_device_id ON user_login_logs(device_id);

-- ----------------------------
-- 建立 tron_notifications (波场异常通知表)
-- ----------------------------
CREATE TABLE tron_notifications (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL, -- 通知类型，如 'low_balance'
    address VARCHAR(50), -- 相关地址（可选）
    message TEXT NOT NULL, -- 通知消息（中文明文）
    resolved BOOLEAN NOT NULL DEFAULT false, -- 是否已解决
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_tron_notifications_resolved ON tron_notifications(resolved);
CREATE INDEX idx_tron_notifications_type ON tron_notifications(type);
CREATE INDEX idx_tron_notifications_created_at ON tron_notifications(created_at DESC);

-- ----------------------------
-- 建立 games (游戏管理表)
-- ----------------------------
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
CREATE INDEX idx_games_provider ON games(provider);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_sort_order ON games(sort_order);

-- 插入初始游戏数据：Flip Coin
-- 使用 system_settings 中的 PAYOUT_MULTIPLIER 值，如果不存在则使用默认值 2
INSERT INTO games (provider, provider_params, name_zh, name_en, game_code, game_status, status, sort_order, payout_multiplier, created_at, updated_at)
SELECT 
    '自营' as provider,
    NULL as provider_params,
    'Flip Coin' as name_zh,
    'FlipCoin' as name_en,
    'flip-coin' as game_code,
    '热门' as game_status,
    'enabled' as status,
    1 as sort_order,
    COALESCE(
        (SELECT CAST(value AS INTEGER) FROM system_settings WHERE key = 'PAYOUT_MULTIPLIER' LIMIT 1),
        2
    ) as payout_multiplier,
    NOW() as created_at,
    NOW() as updated_at;