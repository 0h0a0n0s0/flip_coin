-- Migration: Add Energy Rental Support for Tron Collection
-- Date: 2025-12-29
-- Description: 添加能量租赁功能支持，允许能量提供者将能量代理给归集钱包

-- 1. 修改 platform_wallets 表，添加能量提供者相关字段
ALTER TABLE platform_wallets 
ADD COLUMN IF NOT EXISTS is_energy_provider BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS max_energy_limit BIGINT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS current_staked_trx NUMERIC(20, 6) DEFAULT 0;

-- 添加注释
COMMENT ON COLUMN platform_wallets.is_energy_provider IS '是否为能量提供者钱包';
COMMENT ON COLUMN platform_wallets.max_energy_limit IS '最大可提供能量限制（基于质押的 TRX 计算）';
COMMENT ON COLUMN platform_wallets.current_staked_trx IS '当前质押的 TRX 数量';

-- 2. 创建 energy_rentals 表，用于记录能量租赁状态
CREATE TABLE IF NOT EXISTS energy_rentals (
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

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_energy_rentals_provider ON energy_rentals(provider_address);
CREATE INDEX IF NOT EXISTS idx_energy_rentals_receiver ON energy_rentals(receiver_address);
CREATE INDEX IF NOT EXISTS idx_energy_rentals_status ON energy_rentals(status);
CREATE INDEX IF NOT EXISTS idx_energy_rentals_task_id ON energy_rentals(related_task_id);
CREATE INDEX IF NOT EXISTS idx_energy_rentals_created_at ON energy_rentals(created_at DESC);

-- 添加注释
COMMENT ON TABLE energy_rentals IS '能量租赁记录表，记录能量提供者向归集钱包租赁能量的历史';
COMMENT ON COLUMN energy_rentals.provider_address IS '能量提供者钱包地址';
COMMENT ON COLUMN energy_rentals.receiver_address IS '接收能量的钱包地址（通常是归集钱包）';
COMMENT ON COLUMN energy_rentals.energy_amount IS '租赁的能量数量';
COMMENT ON COLUMN energy_rentals.status IS '租赁状态：ACTIVE(活跃), RECLAIMED(已回收), FAILED(失败)';
COMMENT ON COLUMN energy_rentals.tx_id IS '链上交易 ID';
COMMENT ON COLUMN energy_rentals.related_task_id IS '关联的任务 ID（如归集批次 ID）';
COMMENT ON COLUMN energy_rentals.created_at IS '创建时间';
COMMENT ON COLUMN energy_rentals.reclaimed_at IS '回收时间';

