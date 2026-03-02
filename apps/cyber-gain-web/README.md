# Cyber Gain Web - H5 獨立站

## 📱 專案簡介

這是一個 **Mobile-First H5 獨立站**，使用 Vue 3 + Tailwind CSS 構建。

### 核心特性

- **H5 置中佈局**：PC 端最大寬度 500px，左右兩側深灰留白
- **Mobile-First 設計**：優先針對手機端優化
- **組件化架構**：嚴格遵循 Vue 3 Composition API
- **Tailwind CSS 樣式**：使用原子化 CSS 實現精確設計還原

## 🚀 快速開始

### 前置需求

**Docker 方式（推薦）：**
- Docker Desktop

**本地開發方式：**
- Node.js 18+
- pnpm

### 方案 A：Docker 啟動（推薦，無需安裝依賴）

```bash
# 方法 1：使用啟動腳本（互動式選擇）
./start-cyber-gain.sh
# 選擇 [1] Docker 方式

# 方法 2：直接 Docker 命令
cd /Users/tuofan/Desktop/Hans/flip_coin
docker compose build cyber-gain-web
docker compose up cyber-gain-web

# 後台運行
docker compose up -d cyber-gain-web
```

開發服務器將在 **http://localhost:3001** 啟動。

### 方案 B：本地開發啟動

```bash
# 1. 安裝 pnpm（選擇其一）
npm install -g pnpm
# 或
sudo corepack enable

# 2. 安裝依賴（從根目錄）
cd /Users/tuofan/Desktop/Hans/flip_coin
pnpm install

# 3. 啟動開發服務器
cd apps/cyber-gain-web
pnpm dev
```

> ⚠️ **注意**：3000 端口已被 Docker 的 FlipCoin API 佔用，因此改用 3001 端口。

## 📂 項目結構

```
apps/cyber-gain-web/
├── src/
│   ├── App.vue                    # H5 置中佈局骨架
│   ├── main.js                    # 應用入口
│   ├── components/
│   │   └── layout/
│   │       └── Header.vue         # 頂部導航欄（Logo + 登入/註冊）
│   ├── views/
│   │   └── Home.vue               # 首頁（組合 Header）
│   ├── router/
│   │   └── index.js               # 路由配置
│   ├── styles/
│   │   ├── main.css               # 主樣式（Tailwind）
│   │   └── tokens.css             # 設計 Token
│   └── ...
├── index.html                     # HTML 入口
├── vite.config.js                 # Vite 配置
├── tailwind.config.js             # Tailwind 配置
└── package.json
```

## 🎨 設計規範

### 佈局限制

- **最外層容器**：`bg-[#121212]`（深灰底，突顯 APP）
- **APP 主容器**：`max-w-[500px]`（PC 端限制），`bg-[#0B132B]`（設計圖底色）

### Header 組件

- **Logo 區**：黃色六角形 + "CYBER GAIN" 文字
- **按鈕區**：
  - 登入按鈕：深灰底 `bg-[#1E293B]`
  - 註冊按鈕：黃色漸變 `from-[#FDE047] to-[#EAB308]`
  - 徽章（+150%）：紅色 `bg-[#E11D48]`，絕對定位在註冊按鈕右上角

### RWD 原則

- ✅ **無漢堡選單**：任何螢幕尺寸都維持 Logo + 按鈕佈局
- ✅ **無隱藏元素**：禁止使用 `hidden`, `sm:hidden`
- ✅ **響應式間距**：使用 `gap-2 sm:gap-3`
- ✅ **防換行**：所有按鈕使用 `whitespace-nowrap`

## 🔧 配置說明

### Vite 配置（vite.config.js）

```javascript
server: {
  port: 3001,  // 避免與 Docker API 衝突
  proxy: {
    '/api': {
      target: 'http://localhost:5000',
      changeOrigin: true
    }
  }
}
```

### Tailwind 配置（tailwind.config.js）

- 內容掃描：`./src/**/*.{vue,js,ts,jsx,tsx}`
- 設計 Token：間距、圓角、顏色變數
- 主題擴展：RGB 顏色變數支持

## 📝 已完成的組件

### 1. App.vue（全局骨架）

- ✅ H5 置中佈局（500px 限制）
- ✅ 深灰外層 + 設計圖底色內層
- ✅ 路由出口 `<router-view />`

### 2. Header.vue（頂部導航）

- ✅ 左側 Logo 區（六角形 + 文字）
- ✅ 右側按鈕區（登入 + 註冊）
- ✅ 註冊徽章（+150%，絕對定位）
- ✅ 無 RWD 隱藏，固定佈局

### 3. Home.vue（首頁）

- ✅ 引入 Header 組件
- ✅ 測試區塊（1000px 高度，驗證滾動）

## 🐛 疑難排解

### 問題：瀏覽器顯示舊的 FlipCoin 界面

**原因**：3000 端口被 Docker 容器 `flipcoin-api` 佔用。

**解決方案**：
1. **使用新的 3001 端口訪問**：http://localhost:3001 ✅
2. 或者停止舊的 API 容器：
   ```bash
   docker compose stop api
   ```

### 問題：使用 Docker 啟動後無法訪問

**檢查容器狀態**：
```bash
docker compose ps
# 應該看到 flipcoin-cyber-gain-web 狀態為 Up

docker compose logs cyber-gain-web
# 查看啟動日誌
```

**重新構建鏡像**：
```bash
docker compose build --no-cache cyber-gain-web
docker compose up cyber-gain-web
```

### 問題：Docker 構建失敗（pnpm 依賴問題）

**清理並重建**：
```bash
# 停止所有容器
docker compose down

# 刪除舊鏡像
docker rmi flipcoin-cyber-gain-web

# 清理 Docker 緩存
docker builder prune -a

# 重新構建
docker compose build cyber-gain-web
docker compose up cyber-gain-web
```

### 問題：pnpm 命令找不到（本地開發）

**解決方案**：
```bash
# 方法 1：使用 npm 安裝（最簡單）
npm install -g pnpm

# 方法 2：使用 corepack（需要 sudo）
sudo corepack enable
corepack prepare pnpm@latest --activate

# 方法 3：改用 Docker（推薦）
# 無需安裝 pnpm，直接使用 Docker
./start-cyber-gain.sh  # 選擇 [1]
```

### 問題：依賴安裝失敗（workspace: 協議）

**原因**：npm 不支持 pnpm workspace 協議。

**解決方案**：必須從**項目根目錄**使用 pnpm 安裝：
```bash
cd /Users/tuofan/Desktop/Hans/flip_coin  # 根目錄
pnpm install  # 不要在 apps/cyber-gain-web 單獨安裝
```

或者使用 **Docker 方案**（自動處理依賴）。

### 問題：Docker 容器一直重啟

**查看錯誤日誌**：
```bash
docker compose logs cyber-gain-web --tail=50
```

**常見原因**：
1. **端口衝突**：3001 被佔用
   ```bash
   lsof -i :3001
   # 殺死佔用進程或更換端口
   ```

2. **依賴安裝失敗**：檢查網絡連接和 npm registry

3. **Vite 配置錯誤**：確認 `vite.config.js` 中 `host: '0.0.0.0'`

## 📖 開發指南

### 代碼規範

- **語言**：代碼為英文，註解為繁體中文
- **組件**：使用 `<script setup>` Composition API
- **樣式**：優先使用 Tailwind，避免自定義 CSS
- **命名**：組件 PascalCase，變數 camelCase

### 新增頁面

1. 在 `views/` 創建新組件
2. 在 `router/index.js` 添加路由
3. 遵循 H5 佈局規範（500px 限制）

### 新增組件

1. 在 `components/` 創建組件
2. 使用 Tailwind 實現樣式
3. 確保 RWD 響應式設計

## 🌐 訪問地址

- **開發環境**：http://localhost:3001
- **Docker 舊版**：http://localhost:3000（FlipCoin）
- **Nginx 代理**：http://localhost:8080

## 📚 參考資料

- [Vue 3 文檔](https://vuejs.org/)
- [Tailwind CSS 文檔](https://tailwindcss.com/)
- [Vite 文檔](https://vitejs.dev/)
- [Pinia 狀態管理](https://pinia.vuejs.org/)

---

## ✅ 當前狀態

- [x] App.vue 全局骨架（H5 置中佈局）
- [x] Header.vue 頂部導航欄
- [x] Home.vue 首頁組合
- [x] Tailwind 配置
- [x] Vite 配置（3001 端口）
- [ ] 依賴安裝（需手動執行）
- [ ] 開發服務器啟動（需手動執行）

**下一步**：執行 `./start-cyber-gain.sh` 啟動開發服務器。
