# apps/admin/Dockerfile

# ===== 階段 1: 編譯 (Build Stage) =====
FROM node:18-alpine AS build-stage

# 安裝 pnpm
RUN npm install -g pnpm --registry=https://registry.npmmirror.com

# 從根目錄開始（workspace 需要）
WORKDIR /usr/src/app

# ===== 第一層：複製 workspace 配置和 lockfile =====
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml* ./

# ===== 第二層：複製 package.json（不複製源碼）=====
COPY apps/admin/package.json ./apps/admin/package.json

# ===== 第三層：安裝依賴（最耗時的操作）=====
# 設置 CI 環境變數，避免 pnpm 在 Docker 中的 TTY 問題
ENV CI=true

RUN pnpm fetch --registry=https://registry.npmmirror.com || true
RUN pnpm install --frozen-lockfile --prefer-offline --registry=https://registry.npmmirror.com

# ===== 第四層：複製源碼並構建 =====
COPY apps/admin ./apps/admin

# 切換到 admin 目錄
WORKDIR /usr/src/app/apps/admin

# 執行編譯
RUN pnpm run build

# ===== 階段 2: 運行 (Serve Stage) =====
FROM nginx:alpine

# 複製編譯好的靜態檔案到 Nginx 的預設網站目錄
COPY --from=build-stage /usr/src/app/apps/admin/dist /usr/share/nginx/html

# 複製自定義的 Nginx 配置
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf

# Nginx 預設會監聽 80 port
EXPOSE 80

# 啟動 Nginx
CMD ["nginx", "-g", "daemon off;"]