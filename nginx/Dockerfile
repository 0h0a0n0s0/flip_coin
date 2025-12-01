# 檔案: nginx/Dockerfile (支援環境變數版本 + realip 模組)

# 使用官方 Nginx 映像
FROM nginx:alpine

# 複製自訂主配置（包含 realip 模組設定）
COPY nginx.conf /etc/nginx/nginx.conf

# 複製 server 配置檔案
COPY default.conf /etc/nginx/conf.d/

# 複製啟動腳本（用於動態替換 server_name）
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# 設置入口點
ENTRYPOINT ["/docker-entrypoint.sh"]