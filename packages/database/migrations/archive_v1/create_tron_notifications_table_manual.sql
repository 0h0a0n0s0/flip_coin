-- 手动创建波场异常通知表（用于已存在的数据库）
-- 如果表已存在，此脚本会失败，需要先检查

-- 创建表
CREATE TABLE tron_notifications (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL, -- 通知类型，如 'low_balance'
    address VARCHAR(50), -- 相关地址（可选）
    message TEXT NOT NULL, -- 通知消息（中文明文）
    resolved BOOLEAN NOT NULL DEFAULT false, -- 是否已解决
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- 创建索引
CREATE INDEX idx_tron_notifications_resolved ON tron_notifications(resolved);
CREATE INDEX idx_tron_notifications_type ON tron_notifications(type);
CREATE INDEX idx_tron_notifications_created_at ON tron_notifications(created_at DESC);

