-- Migration: Add Guardian Withdrawal Risk Control System
-- Date: 2026-01-28
-- Description: 添加提現風控系統（地址黑名單 + 風險參數設定）

-- ========================================
-- 1. 創建提現地址黑名單表
-- ========================================
CREATE TABLE IF NOT EXISTS withdrawal_address_blacklist (
    id SERIAL PRIMARY KEY,
    address VARCHAR(255) NOT NULL,
    chain VARCHAR(50),  -- 可選：TRC20, BSC, ETH, POLYGON 等
    memo TEXT,  -- 備註說明（例如：詐騙地址、洗錢嫌疑等）
    admin_id INTEGER,  -- 添加該地址的管理員ID
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_admin_blacklist FOREIGN KEY (admin_id) 
        REFERENCES admin_users(id) ON DELETE SET NULL
);

-- 為地址創建索引（提高查詢效率）
CREATE INDEX IF NOT EXISTS idx_blacklist_address ON withdrawal_address_blacklist(address);

-- 為鏈類型創建索引（支持按鏈過濾）
CREATE INDEX IF NOT EXISTS idx_blacklist_chain ON withdrawal_address_blacklist(chain);

-- ========================================
-- 2. 添加風險控制系統設置
-- ========================================

-- 設置1：勝率閾值（百分比）
INSERT INTO system_settings (key, value, description, category) 
VALUES (
    'risk_max_win_rate_percent', 
    '0', 
    '風控：當用戶勝率大於此百分比時，提現需人工審核。設為 0 表示停用此規則。例如：60 表示 >60% 勝率觸發人工審核', 
    'RiskControl'
)
ON CONFLICT (key) DO NOTHING;

-- 設置2：最小投注數閾值
INSERT INTO system_settings (key, value, description, category) 
VALUES (
    'risk_min_bet_count', 
    '0', 
    '風控：當用戶投注數小於此數值時，提現需人工審核。設為 0 表示停用此規則。例如：50 表示 <50 筆投注觸發人工審核', 
    'RiskControl'
)
ON CONFLICT (key) DO NOTHING;

-- ========================================
-- 完成
-- ========================================
-- 此遷移添加了：
-- 1. withdrawal_address_blacklist 表（地址黑名單）
-- 2. risk_max_win_rate_percent 系統設置（勝率閾值）
-- 3. risk_min_bet_count 系統設置（最小投注數）
