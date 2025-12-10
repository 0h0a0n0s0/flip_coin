# 多语系设置初始化说明

## 概述

多语系配置已添加到后台管理系统（`GameParameters.vue`）的「多语系」tab 中。

## 功能

1. **默认语言**：设置系统默认语言（zh-CN 或 en-US）
2. **支持的语言列表**：配置系统支持的语言（可选，默认为 zh-CN 和 en-US）

## 数据库设置

配置保存在 `system_settings` 表中，`category` 为 `'I18n'`：

- `DEFAULT_LANGUAGE`：默认语言代码
- `SUPPORTED_LANGUAGES`：支持的语言列表（JSON 数组格式）

## 初始化方法

### 方法 1：使用 SQL 脚本（推荐）

```bash
# 使用 Docker 执行
docker exec -i flipcoin-db psql -U game_user -d flipcoin_db < backend/migrations/init_i18n_settings.sql
```

### 方法 2：通过后台界面

1. 登录后台管理系统
2. 进入「系统设定」→「系统参数」
3. 切换到「多语系」tab
4. 配置默认语言和支持的语言列表
5. 点击「储存多语系参数」

**注意**：如果数据库中没有 I18n 设置，系统会在首次保存时自动创建。

## 默认值

- **默认语言**：`zh-CN`（简体中文）
- **支持的语言**：`["zh-CN", "en-US"]`

## API 验证

后端 API 已添加验证：

- `DEFAULT_LANGUAGE` 必须是 `zh-CN` 或 `en-US`
- `SUPPORTED_LANGUAGES` 必须是有效的 JSON 数组，且只能包含 `zh-CN` 或 `en-US`

## 使用示例

### 获取设置

```javascript
const settings = await this.$api.getSettings();
const defaultLang = settings.I18n?.DEFAULT_LANGUAGE?.value; // 'zh-CN'
const supportedLangs = JSON.parse(settings.I18n?.SUPPORTED_LANGUAGES?.value || '[]');
```

### 更新设置

```javascript
// 更新默认语言
await this.$api.updateSetting('DEFAULT_LANGUAGE', 'en-US');

// 更新支持的语言列表
await this.$api.updateSetting('SUPPORTED_LANGUAGES', JSON.stringify(['zh-CN', 'en-US']));
```

