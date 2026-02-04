# apps/backend-legacy/Dockerfile

# 1. 選擇一個官方的 Node.js 執行環境作為基礎映像
FROM node:18-alpine

# 2. 安裝 pnpm
RUN npm install -g pnpm --registry=https://registry.npmmirror.com

# 3. 在容器中設定工作目錄（從根目錄開始，因為需要 workspace）
WORKDIR /usr/src/app

# ===== 第一層：複製 workspace 配置和 lockfile (如果存在) =====
# 這一層只在 workspace 配置或依賴版本變化時才會失效
COPY pnpm-workspace.yaml ./
COPY package.json ./
# 如果有 pnpm-lock.yaml 則複製（使用通配符避免檔案不存在時構建失敗）
COPY pnpm-lock.yaml* ./

# ===== 第二層：複製所有 package.json（但不複製源碼）=====
# 這一層只在依賴聲明變化時才會失效
COPY packages/database/package.json ./packages/database/package.json
COPY apps/backend-legacy/package.json ./apps/backend-legacy/package.json

# ===== 第三層：安裝依賴（這是最耗時的操作）=====
# 設置 CI 環境變數，避免 pnpm 在 Docker 中的 TTY 問題
ENV CI=true

# 使用 pnpm fetch + install 組合以優化速度
# --frozen-lockfile: 確保使用 lockfile 中的精確版本（如果存在）
# --shamefully-hoist: 確保所有依賴都在根 node_modules 中
RUN pnpm fetch --registry=https://registry.npmmirror.com || true
RUN pnpm install --shamefully-hoist --frozen-lockfile --prefer-offline --registry=https://registry.npmmirror.com

# ===== 第四層：複製源碼（這一層會頻繁變動，但不會影響上面的緩存）=====
COPY packages/database ./packages/database
COPY apps/backend-legacy ./apps/backend-legacy

# 4. 為 packages/database 創建 node_modules 符號鏈接（如果需要）
RUN ln -s /usr/src/app/node_modules /usr/src/app/packages/database/node_modules || true

# 5. 設定工作目錄到 backend-legacy
WORKDIR /usr/src/app/apps/backend-legacy

# 6. 設定 NODE_PATH 環境變數，讓 Node.js 能夠找到根目錄的 node_modules
ENV NODE_PATH=/usr/src/app/node_modules

# 7. 向 Docker 聲明容器在執行時會監聽的網路 port
EXPOSE 3000

# 8. 定義容器啟動時要執行的命令
CMD [ "node", "server.js" ]
