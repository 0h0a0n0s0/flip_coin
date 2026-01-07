# apps/admin/Dockerfile

# --- 階段 1: 編譯 (Build Stage) ---
# 使用 Node.js 18 環境來編譯 Vue 專案
FROM node:18-alpine AS build-stage

# 安裝 pnpm
RUN npm install -g pnpm --registry=https://registry.npmmirror.com

# 從根目錄開始（workspace 需要）
WORKDIR /usr/src/app

# 複製 workspace 配置文件
COPY pnpm-workspace.yaml ./
COPY package.json ./

# 複製 apps/admin
COPY apps/admin ./apps/admin

# 安裝依賴
RUN pnpm install --registry=https://registry.npmmirror.com

# 切換到 admin 目錄
WORKDIR /usr/src/app/apps/admin

# 執行編譯
RUN pnpm run build

# --- 階段 2: 運行 (Serve Stage) ---
# 使用輕量級的 Nginx 
FROM nginx:alpine

# 複製編譯好的靜態檔案 (從 build-stage 的 /usr/src/app/apps/admin/dist) 到 Nginx 的預設網站目錄
COPY --from=build-stage /usr/src/app/apps/admin/dist /usr/share/nginx/html

# (可選) 複製自定義的 Nginx 配置
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf

# Nginx 預設會監聽 80 port
EXPOSE 80

# 啟動 Nginx
CMD ["nginx", "-g", "daemon off;"]