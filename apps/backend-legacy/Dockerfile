# apps/backend-legacy/Dockerfile

# 1. 選擇一個官方的 Node.js 執行環境作為基礎映像
FROM node:18-alpine

# 2. 安裝 pnpm
RUN npm install -g pnpm --registry=https://registry.npmmirror.com

# 3. 在容器中設定工作目錄（從根目錄開始，因為需要 workspace）
WORKDIR /usr/src/app

# 4. 複製 workspace 配置文件
COPY pnpm-workspace.yaml ./
COPY package.json ./

# 5. 複製 packages/database（backend-legacy 的依賴）
COPY packages/database/package.json ./packages/database/package.json
COPY packages/database/index.js ./packages/database/index.js
COPY packages/database/migrations ./packages/database/migrations

# 6. 複製 apps/backend-legacy
COPY apps/backend-legacy/package.json ./apps/backend-legacy/package.json
COPY apps/backend-legacy ./apps/backend-legacy

# 7. 安裝依賴（pnpm 會處理 workspace 依賴）
# 使用 --shamefully-hoist 確保所有依賴都在根 node_modules 中，方便 Node.js 解析
RUN pnpm install --shamefully-hoist --registry=https://registry.npmmirror.com

# 7.1 為 packages/database 創建 node_modules 符號鏈接，指向根目錄的 node_modules
# 這樣 Node.js 在 packages/database 中 require 時能找到模組
RUN ln -s /usr/src/app/node_modules /usr/src/app/packages/database/node_modules || true

# 8. 設定工作目錄到 backend-legacy
WORKDIR /usr/src/app/apps/backend-legacy

# 9. 設定 NODE_PATH 環境變數，讓 Node.js 能夠找到根目錄的 node_modules
ENV NODE_PATH=/usr/src/app/node_modules

# 10. 向 Docker 聲明容器在執行時會監聽的網路 port
EXPOSE 3000

# 11. 定義容器啟動時要執行的命令
CMD [ "node", "server.js" ]
