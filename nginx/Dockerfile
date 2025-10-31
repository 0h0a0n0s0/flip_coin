# 檔案: nginx/Dockerfile (新檔案)

# 使用官方 Nginx 映像
FROM nginx:alpine

# 移除 Nginx 預設的設定檔
RUN rm /etc/nginx/conf.d/default.conf

# 複製我們自訂的設定檔
COPY default.conf /etc/nginx/conf.d/