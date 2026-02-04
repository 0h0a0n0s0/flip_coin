-- ============================================
-- 更新 collection_cursor 表结构
-- 创建时间: 2026-01-29
-- 用途: 将 collection_cursor 表适配为新的高吞吐量归集服务
-- ============================================

-- 检查当前表结构
\d collection_cursor

-- 添加 last_processed_user_id 列（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'collection_cursor' 
        AND column_name = 'last_processed_user_id'
    ) THEN
        -- 添加新列
        ALTER TABLE collection_cursor 
        ADD COLUMN last_processed_user_id BIGINT NOT NULL DEFAULT 0;
        
        RAISE NOTICE 'Added column last_processed_user_id';
    ELSE
        RAISE NOTICE 'Column last_processed_user_id already exists';
    END IF;
END $$;

-- 如果表中有多行记录（按 collection_wallet_address 分组），
-- 我们需要简化为单一游标记录
-- 保留第一条记录，删除其他记录
DELETE FROM collection_cursor 
WHERE id NOT IN (
    SELECT MIN(id) FROM collection_cursor
);

-- 确保只有一条记录
DO $$
DECLARE
    record_count INT;
BEGIN
    SELECT COUNT(*) INTO record_count FROM collection_cursor;
    
    IF record_count = 0 THEN
        -- 如果没有记录，插入初始记录
        INSERT INTO collection_cursor (last_processed_user_id) VALUES (0);
        RAISE NOTICE 'Inserted initial cursor record';
    ELSIF record_count > 1 THEN
        RAISE EXCEPTION 'Multiple cursor records found after cleanup. Please check manually.';
    ELSE
        RAISE NOTICE 'Cursor table has exactly 1 record (correct)';
    END IF;
END $$;

-- 验证最终结果
SELECT 
    id,
    last_processed_user_id,
    updated_at,
    CASE 
        WHEN last_user_id IS NOT NULL THEN 'Has old last_user_id column'
        ELSE 'No old column'
    END as migration_status
FROM collection_cursor;

-- 显示表结构（验证）
\d collection_cursor
