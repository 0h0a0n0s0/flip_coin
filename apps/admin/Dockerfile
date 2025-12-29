# 檔案: admin-ui/Dockerfile (新檔案)

# --- 階段 1: 編譯 (Build Stage) ---
# 使用 Node.js 18 環境來編譯 Vue 專案
FROM node:18-alpine AS build-stage

# 設定工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json (如果有的話)
COPY package.json ./

# 安裝依賴
# (我們使用 cnpm 鏡像來加速)
RUN npm install --registry=https://registry.npmmirror.com

# 複製所有原始碼
COPY . .

# 執行編譯
RUN npm run build

# --- 階段 2: 運行 (Serve Stage) ---
# 使用輕量級的 Nginx 
FROM nginx:alpine

# 複製編譯好的靜態檔案 (從 build-stage 的 /app/dist) 到 Nginx 的預設網站目錄
COPY --from=build-stage /app/dist /usr/share/nginx/html

# (可選) 複製自定義的 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Nginx 預設會監聽 80 port
EXPOSE 80

# 啟動 Nginx
CMD ["nginx", "-g", "daemon off;"]