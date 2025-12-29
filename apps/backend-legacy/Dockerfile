# backend/Dockerfile

# 1. 選擇一個官方的 Node.js 執行環境作為基礎映像
FROM node:18-alpine

# 2. 在容器中設定一個工作目錄
WORKDIR /usr/src/app

# 3. 複製 package.json 和 package-lock.json 到工作目錄
#    這樣做可以利用 Docker 的快取機制，只有在依賴變更時才重新安裝
COPY package*.json ./

# 4. 安裝專案依賴
RUN npm install --registry=https://registry.npmmirror.com

# 5. 複製專案的所有檔案到工作目錄
COPY . .

# 6. 向 Docker 聲明容器在執行時會監聽的網路 port
EXPOSE 3000

# 7. 定義容器啟動時要執行的命令
CMD [ "node", "server.js" ]
