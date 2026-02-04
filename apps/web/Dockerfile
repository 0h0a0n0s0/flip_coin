# apps/web/Dockerfile

# ===== 構建階段 =====
FROM node:18-alpine AS builder

# 安裝 pnpm
RUN npm install -g pnpm --registry=https://registry.npmmirror.com

# 從根目錄開始（workspace 需要）
WORKDIR /usr/src/app

# ===== 第一層：複製 workspace 配置和 lockfile =====
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml* ./

# ===== 第二層：複製 package.json（不複製源碼）=====
COPY apps/web/package.json ./apps/web/package.json

# ===== 第三層：安裝依賴（最耗時的操作）=====
# 設置 CI 環境變數，避免 pnpm 在 Docker 中的 TTY 問題
ENV CI=true

RUN pnpm fetch --registry=https://registry.npmmirror.com || true
RUN pnpm install --frozen-lockfile --prefer-offline --registry=https://registry.npmmirror.com

# ===== 第四層：複製源碼並構建 =====
COPY apps/web ./apps/web

# 切換到 web 目錄
WORKDIR /usr/src/app/apps/web

# 構建生產版本
RUN pnpm run build

# ===== 生產階段 =====
FROM nginx:alpine

# 複製構建產物到 nginx
COPY --from=builder /usr/src/app/apps/web/dist /usr/share/nginx/html

# 複製 nginx 配置
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 啟動 nginx
CMD ["nginx", "-g", "daemon off;"]

