# Footer 组件说明

## 📋 组件内容

根据附图和 `cg footer.pen` 文件，Footer 组件包含以下区块：

### 1️⃣ 支持/法律区块
包含 6 个链接：
- 常见问题
- 负责任博彩
- 公平公正
- 服务条款
- 隐私权政策
- 关于我们

### 2️⃣ 社群入口区块
包含 7 个社交媒体平台：
- Telegram (蓝色)
- Facebook (蓝色)
- YouTube (红色)
- X/Twitter (黑色)
- Instagram (渐变色)
- Discord (紫色)
- TikTok (黑色)

### 3️⃣ 支持的币种区块
包含 7 个加密货币图标：
- USDT (绿色)
- TRON (红色)
- Ethereum (蓝色)
- Bitcoin (橙色)
- Litecoin (蓝色)
- Binance Coin (黄色)
- 更多选项 (灰色)

### 4️⃣ 赞助和博彩责任区块
- GCB 认证标志 (绿色背景)
- 18+ 年龄限制标志 (圆形边框)

### 5️⃣ CYBER GAIN Logo 和公司信息
- 品牌 Logo (金色渐变)
- 公司注册信息
- 许可证信息
- 服务承诺
- 信托服务提供商链接

## 🎨 设计规范

### 颜色
- 背景色：`#0B1223` (深蓝黑色)
- 主文本：`#FFFFFF` (白色)
- 副文本：`#8A8CA6` (灰蓝色)
- 分隔线：`#1B2A52` (深蓝色)

### 间距
- 外边距：`px-4 py-5` (16px 20px)
- 区块间距：`mb-5` (20px)
- 标题间距：`mb-3` (12px)

### 字体大小
- 标题：`text-base` (16px)
- 链接：`text-xs` (12px)
- 正文：`text-xs` (12px)

## 📱 响应式设计

组件采用 Mobile-First 设计：
- 最大宽度：500px (PC 端居中显示)
- 图标均为 40x40px
- 使用 flex 布局确保自适应

## 🔗 使用方法

```vue
<template>
  <div>
    <!-- 页面内容 -->
    <Footer />
  </div>
</template>

<script setup>
import Footer from '@/components/layout/Footer.vue'
</script>
```

## ✅ 已完成

- ✅ 创建 Footer 组件 (`apps/cyber-gain-web/src/components/layout/Footer.vue`)
- ✅ 应用到 Home.vue 页面
- ✅ 包含所有 5 个区块
- ✅ 使用内嵌 SVG 图标
- ✅ 遵循项目设计规范
- ✅ 支持 hover 效果
- ✅ 链接可点击（需后续配置路由）

## 📝 注意事项

1. 社交媒体链接和法律页面链接目前使用 `#` 占位，需要后续配置实际路由
2. 社交媒体图标使用内嵌 SVG，确保快速加载
3. 加密货币图标部分使用符号和 SVG 混合
4. GCB 标志使用纯 CSS 实现，无需额外图片
5. 所有颜色和间距严格遵循设计稿

## 🚀 测试

启动开发服务器：
```bash
docker compose up cyber-gain-web
# 或
cd apps/cyber-gain-web && pnpm dev
```

访问 http://localhost:3001 查看效果！
