-- Migration: Fix collection_cursor Schema Mismatch
-- Date: 2025-01-XX
-- Description: 修复 collection_cursor 表结构不匹配问题，从旧结构迁移到新结构

-- 1. 检查表是否存在以及当前结构
DO $$
DECLARE
    table_exists BOOLEAN;
    has_old_columns BOOLEAN;
    has_new_columns BOOLEAN;
BEGIN
    -- 检查表是否存在
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'collection_cursor'
    ) INTO table_exists;
    
    IF table_exists THEN
        -- 检查是否有旧列
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'collection_cursor' 
            AND column_name = 'last_user_id'
        ) INTO has_old_columns;
        
        -- 检查是否有新列
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'collection_cursor' 
            AND column_name = 'last_processed_user_id'
        ) INTO has_new_columns;
        
        -- 如果存在旧列但没有新列，需要迁移
        IF has_old_columns AND NOT has_new_columns THEN
            RAISE NOTICE 'Migrating collection_cursor from old schema to new schema...';
            
            -- 备份旧表（如果还没有备份）
            IF NOT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'collection_cursor_backup'
            ) THEN
                CREATE TABLE collection_cursor_backup AS 
                SELECT * FROM collection_cursor;
                RAISE NOTICE 'Created backup table: collection_cursor_backup';
            END IF;
            
            -- 删除旧表
            DROP TABLE collection_cursor CASCADE;
            RAISE NOTICE 'Dropped old collection_cursor table';
        END IF;
    END IF;
END $$;

-- 2. 创建新表结构（如果不存在）
CREATE TABLE IF NOT EXISTS collection_cursor (
    id SERIAL PRIMARY KEY,
    last_processed_user_id BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 添加注释
COMMENT ON TABLE collection_cursor IS '歸集游標表，追蹤歸集進度以支持恢復能力';
COMMENT ON COLUMN collection_cursor.last_processed_user_id IS '最後處理的用戶 ID';
COMMENT ON COLUMN collection_cursor.updated_at IS '最後更新時間';

-- 3. 初始化游标（如果不存在记录）
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM collection_cursor) THEN
        INSERT INTO collection_cursor (last_processed_user_id) VALUES (0);
        RAISE NOTICE 'Initialized collection_cursor with default value';
    END IF;
END $$;

-- 4. 验证迁移结果
DO $$
DECLARE
    column_count INT;
BEGIN
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collection_cursor'
    AND column_name IN ('id', 'last_processed_user_id', 'updated_at');
    
    IF column_count = 3 THEN
        RAISE NOTICE '✅ collection_cursor schema migration completed successfully';
    ELSE
        RAISE WARNING '⚠️ collection_cursor schema may be incomplete. Expected 3 columns, found %', column_count;
    END IF;
END $$;
