#!/bin/sh
# Nginx 啟動腳本：動態替換 server_name

set -e

# 如果 NGINX_SERVER_NAME 環境變數存在，替換 default.conf 中的 server_name
if [ -n "$NGINX_SERVER_NAME" ]; then
    sed -i "s/server_name localhost;/server_name $NGINX_SERVER_NAME;/g" /etc/nginx/conf.d/default.conf
    echo "✅ Nginx server_name 已設定為: $NGINX_SERVER_NAME"
else
    echo "⚠️  NGINX_SERVER_NAME 未設定，使用預設值: localhost"
fi

# 執行原始的 nginx 命令
exec nginx -g 'daemon off;'

