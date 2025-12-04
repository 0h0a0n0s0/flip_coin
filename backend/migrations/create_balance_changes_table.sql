-- Migration: Create balance_changes table for 账变记录
-- Date: 2024

-- Create balance_changes table
CREATE TABLE IF NOT EXISTS balance_changes (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(8) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    change_type VARCHAR(50) NOT NULL,
    amount NUMERIC NOT NULL,
    balance_after NUMERIC NOT NULL,
    remark TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_balance_changes_user_id ON balance_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_balance_changes_change_type ON balance_changes(change_type);
CREATE INDEX IF NOT EXISTS idx_balance_changes_created_at ON balance_changes(created_at);
CREATE INDEX IF NOT EXISTS idx_balance_changes_user_created ON balance_changes(user_id, created_at DESC);

-- Add comments
COMMENT ON TABLE balance_changes IS '账变记录表，记录所有用户余额变动';
COMMENT ON COLUMN balance_changes.id IS '账变ID';
COMMENT ON COLUMN balance_changes.user_id IS '用户ID';
COMMENT ON COLUMN balance_changes.change_type IS '账变类型：deposit(充值), withdrawal(提款), bet(下注), payout(派奖), manual_adjust(人工调整), activity_bonus(活动奖金)';
COMMENT ON COLUMN balance_changes.amount IS '账变金额，正数为增加，负数为减少';
COMMENT ON COLUMN balance_changes.balance_after IS '账变后余额';
COMMENT ON COLUMN balance_changes.remark IS '备注信息';
COMMENT ON COLUMN balance_changes.created_at IS '账变完成写入的时间';

