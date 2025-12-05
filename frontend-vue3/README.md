# Flip Coin Frontend (Vue 3)

Vue 3 + Element Plus 前端應用，從原有純 JS 前端遷移而來。

## 技術棧

- Vue 3.2.13
- Element Plus 2.7.7
- Vue Router 4.0.3
- Vite 5.0
- Socket.IO Client 4.7.2

## 開發

```bash
# 安裝依賴
npm install

# 啟動開發服務器
npm run dev

# 構建生產版本
npm run build

# 預覽生產構建
npm run preview
```

## 項目結構

```
src/
├── api/              # API 請求模組
├── composables/      # Composition API hooks
├── components/       # Vue 組件
│   ├── layout/      # 布局組件
│   ├── game/        # 遊戲組件
│   ├── wallet/      # 錢包組件
│   ├── auth/        # 認證組件
│   └── common/      # 通用組件
├── router/          # 路由配置
├── store/           # 狀態管理
├── styles/          # 樣式文件
├── utils/           # 工具函數
└── views/           # 頁面組件
```

## 遵循規範

本項目嚴格遵循 `PROJECT_CONSTITUTION.md` 的所有規範：

- ✅ 使用 spacing tokens (space-1 ~ space-6)
- ✅ 使用 radius tokens (radius-sm, radius-md, radius-lg)
- ✅ 所有 HTTP 請求通過 `api/index.js`
- ✅ 組件不超過 300 行
- ✅ 使用 Composition API
- ✅ 遵循視覺密度系統

## 與後端兼容

- Vue 版本與 admin-ui 一致 (3.2.13)
- Element Plus 版本與 admin-ui 一致 (2.7.7)
- API 端點保持不變 (`/api/v1/*`)
- Socket.IO 連接方式保持不變

