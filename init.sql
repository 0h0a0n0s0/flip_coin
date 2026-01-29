-- ============================================
-- FlipCoin 統一初始化腳本
-- 版本：v2.0 (整合所有遷移)
-- 最後更新：2026-01-29
-- 說明：此檔案代表生產環境的完整資料庫架構
-- ============================================

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
DROP TABLE IF EXISTS withdrawal_address_blacklist CASCADE;
DROP TABLE IF EXISTS balance_changes CASCADE;
DROP TABLE IF EXISTS collection_logs CASCADE;
DROP TABLE IF EXISTS collection_settings CASCADE;
DROP TABLE IF EXISTS collection_cursor CASCADE;
DROP TABLE IF EXISTS collection_retry_queue CASCADE;
DROP TABLE IF EXISTS energy_rentals CASCADE;
DROP TABLE IF EXISTS admin_audit_logs CASCADE;
DROP TABLE IF EXISTS risk_logs CASCADE;
DROP TABLE IF EXISTS user_login_logs CASCADE;
DROP TABLE IF EXISTS tron_notifications CASCADE;
DROP TABLE IF EXISTS blockchain_sync_status CASCADE;
DROP TABLE IF EXISTS games CASCADE;

-- ============================================
-- 管理員權限系統 (RBAC)
-- ============================================

-- 角色表
CREATE TABLE admin_roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 權限表
CREATE TABLE admin_permissions (
    id SERIAL PRIMARY KEY,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'General',
    UNIQUE(resource, action)
);

-- 角色權限關聯表
CREATE TABLE admin_role_permissions (
    role_id INT NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
    permission_id INT NOT NULL REFERENCES admin_permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- ============================================
-- 用戶表
-- ============================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL, 
    password_hash VARCHAR(100) NOT NULL, 
    balance DECIMAL(20, 6) NOT NULL DEFAULT 0,  -- ★ 高精度金額欄位
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
    original_password_hash VARCHAR(100) NULL,
    original_withdrawal_password_hash VARCHAR(100) NULL,
    password_fingerprint VARCHAR(64) NULL,
    withdrawal_password_fingerprint VARCHAR(64) NULL,
    last_level_up_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_valid_bet_amount DECIMAL(20, 6) NOT NULL DEFAULT 0,  -- ★ 等級累加器
    total_valid_bet_count INT NOT NULL DEFAULT 0,  -- ★ 等級累加器
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 用戶表索引
CREATE INDEX idx_users_evm_deposit_address ON users(evm_deposit_address);
CREATE INDEX idx_users_tron_deposit_address ON users(tron_deposit_address);
CREATE INDEX idx_users_registration_ip ON users(registration_ip);
CREATE INDEX idx_users_first_login_ip ON users(first_login_ip);
CREATE INDEX idx_users_device_id ON users(device_id);
CREATE INDEX idx_users_original_password_hash ON users(original_password_hash);
CREATE INDEX idx_users_original_withdrawal_password_hash ON users(original_withdrawal_password_hash);
CREATE INDEX idx_users_password_fingerprint ON users(password_fingerprint);
CREATE INDEX idx_users_withdrawal_password_fingerprint ON users(withdrawal_password_fingerprint);
CREATE INDEX idx_users_total_valid_bet_amount ON users(total_valid_bet_amount);

-- ============================================
-- 投注表
-- ============================================
CREATE TABLE bets (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(8) NOT NULL, 
    game_type VARCHAR(50) NOT NULL DEFAULT 'FlipCoin',
    choice VARCHAR(4) NOT NULL,
    amount DECIMAL(20, 6) NOT NULL,  -- ★ 高精度金額欄位
    status VARCHAR(15) NOT NULL DEFAULT 'pending',
    bet_ip VARCHAR(50) NULL,
    bet_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    settle_time TIMESTAMP WITH TIME ZONE,
    tx_hash VARCHAR(66) UNIQUE, 
    payout_multiplier DECIMAL(10, 2) NOT NULL DEFAULT 2,  -- ★ 支援小數派彩倍數
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_bets_bet_ip ON bets(bet_ip);

-- ============================================
-- 平台交易記錄表
-- ============================================
CREATE TABLE platform_transactions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(8) NOT NULL, 
    type VARCHAR(50) NOT NULL, 
    chain VARCHAR(20) NULL,
    amount DECIMAL(20, 6) NOT NULL DEFAULT 0,  -- ★ 高精度金額欄位
    gas_fee DECIMAL(20, 6) NOT NULL DEFAULT 0,  -- ★ 高精度金額欄位
    tx_hash VARCHAR(255) NULL, 
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_platform_transactions_type ON platform_transactions(type);
CREATE INDEX idx_platform_transactions_user_id ON platform_transactions(user_id);

-- ============================================
-- 賬變記錄表
-- ============================================
CREATE TABLE balance_changes (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(8) NOT NULL,
    change_type VARCHAR(50) NOT NULL,
    amount DECIMAL(20, 6) NOT NULL,  -- ★ 高精度金額欄位
    balance_after DECIMAL(20, 6) NOT NULL,  -- ★ 高精度金額欄位
    remark TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 賬變記錄索引
CREATE INDEX idx_balance_changes_user_id ON balance_changes(user_id);
CREATE INDEX idx_balance_changes_change_type ON balance_changes(change_type);
CREATE INDEX idx_balance_changes_created_at ON balance_changes(created_at);
CREATE INDEX idx_balance_changes_user_created ON balance_changes(user_id, created_at DESC);

COMMENT ON TABLE balance_changes IS '賬變記錄表，記錄所有用戶餘額變動';
COMMENT ON COLUMN balance_changes.change_type IS '賬變類型：deposit(充值), withdrawal(提款), bet(下注), payout(派獎), manual_adjust(人工調整), activity_bonus(活動獎金)';
COMMENT ON COLUMN balance_changes.amount IS '賬變金額，正數為增加，負數為減少';
COMMENT ON COLUMN balance_changes.balance_after IS '賬變後餘額';

-- ============================================
-- 管理員用戶表
-- ============================================
CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    role_id INT REFERENCES admin_roles(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    last_login_ip VARCHAR(50) NULL,  -- ★ 最後登錄IP
    last_login_at TIMESTAMP WITH TIME ZONE NULL,  -- ★ 最後登錄時間
    google_secret VARCHAR(100) NULL,  -- ★ Google 2FA 密鑰
    is_2fa_enabled BOOLEAN NOT NULL DEFAULT false,  -- ★ 是否啟用2FA
    profile_name VARCHAR(100) NULL,  -- ★ 個人資料姓名
    profile_email VARCHAR(255) NULL,  -- ★ 個人資料郵箱
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_users_last_login_ip ON admin_users(last_login_ip);

-- ============================================
-- 平台錢包表
-- ============================================
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
    is_energy_provider BOOLEAN NOT NULL DEFAULT false,  -- ★ 能量提供者標記
    max_energy_limit BIGINT DEFAULT NULL,  -- ★ 最大能量限制
    current_staked_trx DECIMAL(20, 6) DEFAULT 0,  -- ★ 當前質押TRX數量
    current_index INT NOT NULL DEFAULT 0,  -- ★ HD錢包當前索引
    encrypted_mnemonic TEXT,  -- ★ 加密的助記詞
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 系統設定表
-- ============================================
CREATE TABLE system_settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'General',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 地區封鎖表
-- ============================================
CREATE TABLE blocked_regions (
    id SERIAL PRIMARY KEY,
    ip_range CIDR UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 用戶等級表
-- ============================================
CREATE TABLE user_levels (
    level INT PRIMARY KEY CHECK (level > 0),
    name VARCHAR(50) NOT NULL DEFAULT '',
    required_total_bet_amount DECIMAL(20, 6) NOT NULL DEFAULT 0,  -- ★ 累計投注金額要求
    min_bet_amount_for_upgrade DECIMAL(20, 6) NOT NULL DEFAULT 0,  -- ★ 單筆有效投注門檻
    upgrade_reward_amount DECIMAL(20, 6) NOT NULL DEFAULT 0,  -- ★ 升級獎勵金額
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 管理員IP白名單表
-- ============================================
CREATE TABLE admin_ip_whitelist (
    id SERIAL PRIMARY KEY,
    ip_range CIDR UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 提款申請表
-- ============================================
CREATE TABLE withdrawals (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(8) NOT NULL REFERENCES users(user_id) ON DELETE SET NULL,
    chain_type VARCHAR(20) NOT NULL,
    address VARCHAR(255) NOT NULL,
    amount DECIMAL(20, 6) NOT NULL,  -- ★ 高精度金額欄位
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    gas_fee DECIMAL(20, 6) NOT NULL DEFAULT 0,  -- ★ 高精度金額欄位
    tx_hash VARCHAR(255) NULL,
    rejection_reason TEXT NULL,
    request_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    review_time TIMESTAMP WITH TIME ZONE NULL,
    reviewer_id INT NULL REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE INDEX idx_withdrawals_status ON withdrawals(status);
CREATE INDEX idx_withdrawals_user_id ON withdrawals(user_id);

-- ============================================
-- 提款地址黑名單表
-- ============================================
CREATE TABLE withdrawal_address_blacklist (
    id SERIAL PRIMARY KEY,
    address VARCHAR(255) NOT NULL,
    chain VARCHAR(50),
    memo TEXT,
    admin_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_admin_blacklist FOREIGN KEY (admin_id) 
        REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE INDEX idx_blacklist_address ON withdrawal_address_blacklist(address);
CREATE INDEX idx_blacklist_chain ON withdrawal_address_blacklist(chain);

-- ============================================
-- 歸集記錄表
-- ============================================
CREATE TABLE collection_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(8) NOT NULL REFERENCES users(user_id) ON DELETE SET NULL,
    user_deposit_address VARCHAR(255) NOT NULL,
    collection_wallet_address VARCHAR(255) NOT NULL,
    amount DECIMAL(20, 6) NOT NULL,  -- ★ 高精度金額欄位
    tx_hash VARCHAR(255) NULL,
    energy_used INT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_collection_logs_user_id ON collection_logs(user_id);
CREATE INDEX idx_collection_logs_created_at ON collection_logs(created_at);
CREATE INDEX idx_collection_logs_status ON collection_logs(status);

-- ============================================
-- 歸集設定表
-- ============================================
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

-- ============================================
-- 歸集游標表 (新架構)
-- ============================================
CREATE TABLE collection_cursor (
    id SERIAL PRIMARY KEY,
    last_processed_user_id BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE collection_cursor IS '歸集游標表，追蹤歸集進度以支持恢復能力';
COMMENT ON COLUMN collection_cursor.last_processed_user_id IS '最後處理的用戶 ID';

-- 初始化單一游標記錄
INSERT INTO collection_cursor (last_processed_user_id) VALUES (0);

-- ============================================
-- 歸集重試隊列表
-- ============================================
CREATE TABLE collection_retry_queue (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(8) NOT NULL,
    retry_count INT NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    error_reason TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_collection_retry_queue_user_id ON collection_retry_queue(user_id);
CREATE INDEX idx_collection_retry_queue_next_retry_at ON collection_retry_queue(next_retry_at);
CREATE INDEX idx_collection_retry_queue_retry_count ON collection_retry_queue(retry_count);

-- ============================================
-- 能量租賃記錄表
-- ============================================
CREATE TABLE energy_rentals (
    id SERIAL PRIMARY KEY,
    provider_address VARCHAR(255) NOT NULL,
    receiver_address VARCHAR(255) NOT NULL,
    energy_amount BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RECLAIMED', 'FAILED')),
    tx_id VARCHAR(255),
    related_task_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reclaimed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    FOREIGN KEY (provider_address) REFERENCES platform_wallets(address) ON DELETE CASCADE,
    FOREIGN KEY (receiver_address) REFERENCES platform_wallets(address) ON DELETE CASCADE
);

CREATE INDEX idx_energy_rentals_provider ON energy_rentals(provider_address);
CREATE INDEX idx_energy_rentals_receiver ON energy_rentals(receiver_address);
CREATE INDEX idx_energy_rentals_status ON energy_rentals(status);
CREATE INDEX idx_energy_rentals_task_id ON energy_rentals(related_task_id);
CREATE INDEX idx_energy_rentals_created_at ON energy_rentals(created_at DESC);

-- ============================================
-- 管理員稽核日誌表
-- ============================================
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

-- ============================================
-- 風控日誌表
-- ============================================
CREATE TABLE risk_logs (
    id SERIAL PRIMARY KEY,
    ip_address VARCHAR(100) NOT NULL,
    affected_user_ids JSONB NOT NULL,
    action_taken VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_risk_logs_ip_address ON risk_logs(ip_address);
CREATE INDEX idx_risk_logs_created_at ON risk_logs(created_at);

-- ============================================
-- 用戶登錄日誌表
-- ============================================
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

-- ============================================
-- 波場異常通知表
-- ============================================
CREATE TABLE tron_notifications (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    address VARCHAR(50),
    message TEXT NOT NULL,
    resolved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_tron_notifications_resolved ON tron_notifications(resolved);
CREATE INDEX idx_tron_notifications_type ON tron_notifications(type);
CREATE INDEX idx_tron_notifications_created_at ON tron_notifications(created_at DESC);

-- ============================================
-- 區塊鏈同步狀態表
-- ============================================
CREATE TABLE blockchain_sync_status (
    chain VARCHAR(50) PRIMARY KEY,
    last_scanned_block BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_blockchain_sync_status_chain ON blockchain_sync_status(chain);

COMMENT ON TABLE blockchain_sync_status IS '區塊鏈同步狀態表，持久化區塊掃描高度以防止重啟時數據丟失';

-- ============================================
-- 遊戲管理表
-- ============================================
CREATE TABLE games (
    id SERIAL PRIMARY KEY,
    provider VARCHAR(50) NOT NULL DEFAULT '自营',
    provider_params TEXT,
    name_zh VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    game_code VARCHAR(50),
    game_status VARCHAR(20),
    status VARCHAR(10) NOT NULL DEFAULT 'enabled',
    sort_order INT NOT NULL DEFAULT 0,
    payout_multiplier DECIMAL(10, 2) NOT NULL DEFAULT 2,  -- ★ 支援小數派彩倍數
    streak_multipliers JSONB DEFAULT NULL,  -- ★ 連勝模式多賠率設定，JSON格式：{"0": 2.0, "1": 2.5, "2": 3.0, ...}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_games_provider ON games(provider);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_sort_order ON games(sort_order);

-- ============================================
-- 插入 RBAC 基礎數據
-- ============================================

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
('admin_accounts', 'read', 'System', '讀取後台帳號列表'),
('admin_accounts', 'cud', 'System', '新增/修改/刪除 後台帳號'),
('admin_permissions', 'read', 'System', '讀取權限組列表'),
('admin_permissions', 'update', 'System', '更新權限組權限'),
('admin_ip_whitelist', 'read', 'System', '讀取後台 IP 白名單'),
('admin_ip_whitelist', 'cud', 'System', '新增/刪除 後台 IP 白名單'),
('settings_game', 'read', 'System', '讀取遊戲參數'),
('settings_game', 'update', 'System', '更新遊戲參數'),
('settings_regions', 'read', 'System', '讀取阻擋地區'),
('settings_regions', 'cud', 'System', '新增/刪除 阻擋地區'),
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

-- ============================================
-- 插入初始數據
-- ============================================

-- 1. 插入 'admin' 帳號並指定為 'Super Admin' (Role ID 1)
-- 密碼: admin123 (請在生產環境修改)
INSERT INTO admin_users (username, password_hash, role_id, status)
VALUES ('admin', '$2b$10$AcqgPjrFH7EoZv6Fv0LJ4OMmPbiTom7QrSSTjE6oK92.2JgFs63Wq', 1, 'active'); 

-- 2. 插入 Level 1
INSERT INTO user_levels (level, name, required_total_bet_amount, min_bet_amount_for_upgrade, upgrade_reward_amount) 
VALUES (1, 'Level 1', 0, 0.01, 0.005); 

-- 3. 插入系統設定
INSERT INTO system_settings (key, value, description, category) VALUES
('PAYOUT_MULTIPLIER', '2', '派獎倍數 (整數)', 'Game'),
('ALLOW_TRC20', 'true', '是否開放 TRC20 充值 (true/false)', 'Finance'),
('ALLOW_BSC', 'true', '是否開放 BSC 充值 (true/false)', 'Finance'),
('AUTO_WITHDRAW_THRESHOLD', '10', '自動出款門檻 (小於等於此金額將嘗試自動出款)', 'Finance'),
('MAX_SAME_IP_USERS', '5', '同IP允許的最大用戶數，超過則觸發風控封鎖', 'RiskControl'),
('DEFAULT_LANGUAGE', 'zh-CN', '默認語言 (zh-CN: 簡體中文, en-US: English)', 'I18n'),
('SUPPORTED_LANGUAGES', '["zh-CN","en-US"]', '支持的語言列表 (JSON 數組)', 'I18n'),
('PLATFORM_NAME', 'FlipCoin', '平台名稱', 'General'),
('risk_max_win_rate_percent', '0', '風控：當用戶勝率大於此百分比時，提現需人工審核。設為 0 表示停用此規則。例如：60 表示 >60% 勝率觸發人工審核', 'RiskControl'),
('risk_min_bet_count', '0', '風控：當用戶投注數小於此數值時，提現需人工審核。設為 0 表示停用此規則。例如：50 表示 <50 筆投注觸發人工審核', 'RiskControl');

-- 4. 插入管理員 IP 白名單
INSERT INTO admin_ip_whitelist (ip_range, description) VALUES 
('127.0.0.1/32', 'Localhost Access'),
('::1/128', 'Localhost IPv6 Access'),
('192.168.50.0/24', 'Same WiFi Network (192.168.50.x)'),
('192.168.65.1/32', 'Docker Host IP (Local Dev)'),
('125.229.37.48/32', 'Admin IP (125.229.37.48)');

-- 5. 插入初始平台錢包數據
INSERT INTO platform_wallets (name, chain_type, address, is_gas_reserve, is_collection, is_opener_a, is_opener_b, is_payout, is_active) VALUES
('自動出款錢包', 'TRC20', 'TWVJfRMJApn1gpoVAs3NBacgN6sHYaV2mE', false, false, false, false, true, true),
('歸集', 'TRC20', 'TQxXoL3uCx3BKTBffQLA1rExjv6a3fzaDh', false, true, false, false, false, true),
('GAS', 'TRC20', 'TCWSGfSkwNVEuVKThV8HT6LnBQPwZKS5ef', true, false, false, false, false, true),
('開獎錢包B', 'TRC20', 'TMy7h9jUeXnHTBzhabvXen8ea1fPUenDfV', false, false, false, true, false, true),
('開獎錢包A', 'TRC20', 'TCDRJuvuvnjiRLbKRQShqAKdhqymhWCEAV', false, false, true, false, false, true);

-- 6. 插入歸集錢包的初始設定
INSERT INTO collection_settings (collection_wallet_address, scan_interval_days, days_without_deposit, is_active) VALUES
('TQxXoL3uCx3BKTBffQLA1rExjv6a3fzaDh', 1, 7, true);

-- 7. 插入初始遊戲數據：Flip Coin
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
        (SELECT CAST(value AS DECIMAL(10,2)) FROM system_settings WHERE key = 'PAYOUT_MULTIPLIER' LIMIT 1),
        2
    ) as payout_multiplier,
    NOW() as created_at,
    NOW() as updated_at;

-- ============================================
-- 初始化完成
-- ============================================
-- 此架構包含所有歷史遷移的最終狀態
-- 所有金額欄位使用 DECIMAL(20, 6) 高精度
-- payout_multiplier 使用 DECIMAL(10, 2) 支援小數派彩
-- 符合項目憲章的所有安全與財務規範
-- ============================================
