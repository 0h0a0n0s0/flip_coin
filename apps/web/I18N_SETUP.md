# 多语系系统使用指南

## 📋 概述

本项目已集成完整的多语系（i18n）动态设定系统，支持：

- ✅ 前台自动侦测新增文字
- ✅ 后台多语系管理界面
- ✅ 导出/上传语言文件
- ✅ 实时编辑翻译

## 🚀 快速开始

### 1. 安装依赖

```bash
cd frontend-vue3
npm install
```

### 2. 运行自动扫描脚本

扫描前台代码中的硬编码文字：

```bash
npm run i18n:scan
```

脚本会：
- 扫描 `src/` 目录下的所有 `.vue`, `.js`, `.ts` 文件
- 检测中文和英文硬编码文字
- 自动生成 i18n key（根据文件路径推断 namespace）
- 自动写入对应语言档

### 3. 使用 i18n 翻译

在 Vue 组件中使用：

```vue
<template>
  <div>
    <h1>{{ t('home.title') }}</h1>
    <p>{{ t('home.welcome_bonus') }}</p>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>
```

或在 Composition API 中使用：

```javascript
import { useLanguage } from '@/composables/useLanguage'

const { t } = useLanguage()
const message = t('common.success')
```

## 📁 文件结构

```
apps/web/
├── src/
│   ├── locales/
│   │   ├── en.json          # 英文翻译
│   │   ├── zh-CN.json       # 简体中文翻译
│   │   ├── zh-TW.json       # 繁体中文翻译
│   │   └── index.js         # i18n 配置
│   └── scripts/
│       └── i18n-scanner.js  # 自动扫描脚本
```

## 🎯 命名规范

i18n key 的命名规则：

- 根据文件路径自动生成 namespace
- `src/views/Home.vue` → `home.*`
- `src/components/game/FlipCoinGame.vue` → `game.flipcoingame.*`
- `src/components/common/Banner.vue` → `common.banner.*`

## 🔧 后台管理

### 访问多语系管理界面

1. 登录后台管理系统
2. 进入「系统设定」→「系统参数」
3. 切换到「多语系」tab
4. 点击「进入多语系管理界面」

### 功能说明

#### 1. 语言选择器
- 选择要编辑的语言（zh-CN / en / zh-TW）
- 显示总键数和缺字数量

#### 2. 实时编辑
- 在表格中直接编辑 key 的 value
- 支持搜索 key 或 value
- 标记缺字状态

#### 3. 导出语言文件
- 点击「导出语言 JSON」下载当前语言的完整翻译文件

#### 4. 上传语言文件
- 点击「上传语言 JSON」
- 选择合并或覆盖模式
- 自动比对并更新

#### 5. 添加新键值对
- 在「添加新键值对」区域输入 key 和 value
- 点击「添加」后记得保存

## 📝 开发工作流

### 添加新文字时

1. **直接写硬编码文字**（开发时）
   ```vue
   <p>新功能上线了！</p>
   ```

2. **运行扫描脚本**
   ```bash
   npm run i18n:scan
   ```

3. **脚本自动处理**
   - 检测到硬编码文字
   - 生成 i18n key（如 `home.new_feature`）
   - 写入语言文件

4. **手动替换代码**（可选，脚本未来可支持自动替换）
   ```vue
   <p>{{ t('home.new_feature') }}</p>
   ```

5. **在后台完善翻译**
   - 进入多语系管理界面
   - 编辑各语言的翻译
   - 保存更改

## 🔍 自动扫描脚本详解

### 功能

- ✅ 扫描所有 `.vue`, `.js`, `.ts` 文件
- ✅ 检测中文文字（Unicode 范围）
- ✅ 检测英文标题文字
- ✅ 自动生成 key（基于文件路径）
- ✅ 自动写入语言文件
- ✅ 自动排序 key

### 使用示例

```bash
# 扫描并更新语言文件
npm run i18n:scan

# 输出示例：
# 🔍 Scanning for hardcoded texts...
# 📊 Statistics:
#   - Processed files: 45
#   - Detected texts: 23
# 📝 Writing to locale files...
# ✓ Updated en.json
# ✓ Updated zh-CN.json
# ✓ Updated zh-TW.json
# ✅ Scan completed!
```

## 🌐 支持的语言

当前支持：
- `zh-CN` - 简体中文
- `en` - English
- `zh-TW` - 繁體中文

可在 `src/locales/index.js` 中添加更多语言。

## ⚠️ 注意事项

1. **开发模式警告**：在开发模式下，如果使用未定义的 key，控制台会显示警告
2. **语言文件格式**：必须保持有效的 JSON 格式
3. **key 命名**：建议使用小写字母和下划线，避免特殊字符
4. **嵌套结构**：支持嵌套对象，如 `{ "home": { "title": "..." } }`

## 🐛 故障排除

### 问题：扫描脚本找不到文件

**解决**：确保在 `frontend-vue3` 目录下运行脚本

### 问题：翻译不显示

**解决**：
1. 检查 key 是否正确
2. 检查语言文件格式是否正确
3. 检查浏览器控制台是否有错误

### 问题：后台无法加载语言文件

**解决**：
1. 检查后端 API 是否正常运行
2. 检查文件路径是否正确
3. 检查文件权限

## 📚 相关文档

- [vue-i18n 官方文档](https://vue-i18n.intlify.dev/)
- [后台多语系管理 API 文档](./backend/migrations/README_i18n_settings.md)

