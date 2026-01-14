-- Migration: Add Tron System Upgrade Support
-- Date: 2025-01-XX
-- Description: 添加區塊鏈同步狀態、歸集游標、重試隊列表，並更新 platform_wallets 表以支持 HD 錢包追蹤

-- 1. 創建 blockchain_sync_status 表（持久化區塊掃描高度）
CREATE TABLE IF NOT EXISTS blockchain_sync_status (
    id SERIAL PRIMARY KEY,
    chain VARCHAR(20) NOT NULL UNIQUE,
    last_scanned_block BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_blockchain_sync_status_chain ON blockchain_sync_status(chain);
CREATE INDEX IF NOT EXISTS idx_blockchain_sync_status_updated_at ON blockchain_sync_status(updated_at DESC);

-- 添加註釋
COMMENT ON TABLE blockchain_sync_status IS '區塊鏈同步狀態表，持久化區塊掃描高度以防止重啟時數據丟失';
COMMENT ON COLUMN blockchain_sync_status.chain IS '區塊鏈類型（如 TRON）';
COMMENT ON COLUMN blockchain_sync_status.last_scanned_block IS '最後掃描的區塊高度';
COMMENT ON COLUMN blockchain_sync_status.updated_at IS '最後更新時間';

-- 2. 創建 collection_cursor 表（追蹤歸集進度）
CREATE TABLE IF NOT EXISTS collection_cursor (
    id SERIAL PRIMARY KEY,
    last_processed_user_id BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 添加註釋
COMMENT ON TABLE collection_cursor IS '歸集游標表，追蹤歸集進度以支持恢復能力';
COMMENT ON COLUMN collection_cursor.last_processed_user_id IS '最後處理的用戶 ID';
COMMENT ON COLUMN collection_cursor.updated_at IS '最後更新時間';

-- 初始化單一游標記錄（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM collection_cursor) THEN
        INSERT INTO collection_cursor (last_processed_user_id) VALUES (0);
    END IF;
END $$;

-- 3. 創建 collection_retry_queue 表（存儲失敗的歸集任務）
CREATE TABLE IF NOT EXISTS collection_retry_queue (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(8) NOT NULL,
    retry_count INT NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    error_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_collection_retry_queue_user_id ON collection_retry_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_retry_queue_next_retry_at ON collection_retry_queue(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_collection_retry_queue_retry_count ON collection_retry_queue(retry_count);

-- 添加註釋
COMMENT ON TABLE collection_retry_queue IS '歸集重試隊列表，存儲失敗的歸集任務';
COMMENT ON COLUMN collection_retry_queue.user_id IS '用戶 ID';
COMMENT ON COLUMN collection_retry_queue.retry_count IS '重試次數';
COMMENT ON COLUMN collection_retry_queue.next_retry_at IS '下次重試時間';
COMMENT ON COLUMN collection_retry_queue.error_reason IS '錯誤原因';

-- 4. 更新 platform_wallets 表，添加 HD 錢包追蹤相關欄位
ALTER TABLE platform_wallets 
ADD COLUMN IF NOT EXISTS current_index INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS encrypted_mnemonic TEXT;

-- 添加註釋
COMMENT ON COLUMN platform_wallets.current_index IS '當前索引（用於 HD 錢包派生追蹤）';
COMMENT ON COLUMN platform_wallets.encrypted_mnemonic IS '加密的助記詞（可選）';

-- 注意：is_energy_provider 欄位已在 add_energy_rental_support.sql 中添加，此處不再重複添加

-- 5. 初始化索引追蹤記錄（如果不存在）
-- 為用戶存款地址索引追蹤創建一個特殊的 platform_wallets 記錄
-- 這個記錄用於追蹤 HD 錢包派生的當前索引
-- 使用固定的 address 值，如果已存在則跳過（address 有 UNIQUE 約束）
-- 
-- ⚠️ 警告：此處的 1000 是佔位符初始值，實際運行時應由應用程式配置覆蓋
-- 應用程式會從環境變數 WALLET_START_INDEX 讀取用戶起始索引（預設 1001）
-- 平台保留索引 = WALLET_START_INDEX - 1（預設 1000）
-- 生產環境請確保 .env 中設置正確的 WALLET_START_INDEX 值
--
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM platform_wallets WHERE name = 'HD_WALLET_INDEX_TRACKER') THEN
        INSERT INTO platform_wallets (name, chain_type, address, current_index, is_active)
        VALUES ('HD_WALLET_INDEX_TRACKER', 'MULTI', 'HD_INDEX_TRACKER_PLACEHOLDER', 1000, false);
    END IF;
END $$;

-- 如果記錄已存在，確保 current_index 至少為 1000（平台保留索引）
-- ⚠️ 注意：此處的 1000 是佔位符，實際值應由應用程式配置決定
UPDATE platform_wallets 
SET current_index = GREATEST(current_index, 1000)
WHERE name = 'HD_WALLET_INDEX_TRACKER' AND current_index < 1000;

