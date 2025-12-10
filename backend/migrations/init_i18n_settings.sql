-- 初始化多语系设置
-- 如果设置已存在则跳过，否则插入默认值

-- 插入默认语言设置
INSERT INTO system_settings (key, value, description, category, created_at, updated_at)
VALUES (
    'DEFAULT_LANGUAGE',
    'zh-CN',
    '系统默认语言，可选值：zh-CN（简体中文）或 en-US（英文）',
    'I18n',
    NOW(),
    NOW()
)
ON CONFLICT (key) DO NOTHING;

-- 插入支持的语言列表设置
INSERT INTO system_settings (key, value, description, category, created_at, updated_at)
VALUES (
    'SUPPORTED_LANGUAGES',
    '["zh-CN","en-US"]',
    '系统支持的语言列表，JSON 数组格式，可选值：zh-CN（简体中文）、en-US（英文）',
    'I18n',
    NOW(),
    NOW()
)
ON CONFLICT (key) DO NOTHING;

