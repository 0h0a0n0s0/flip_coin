# 檔案: nginx/Dockerfile (支援環境變數版本)

# 使用官方 Nginx 映像
FROM nginx:alpine

# 複製配置檔案
COPY default.conf /etc/nginx/conf.d/

# 複製啟動腳本（用於動態替換 server_name）
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# 設置入口點
ENTRYPOINT ["/docker-entrypoint.sh"]