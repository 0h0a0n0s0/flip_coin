# apps/web/Dockerfile

# 构建阶段
FROM node:18-alpine AS builder

# 安装 pnpm
RUN npm install -g pnpm --registry=https://registry.npmmirror.com

# 从根目录开始（workspace 需要）
WORKDIR /usr/src/app

# 复制 workspace 配置文件
COPY pnpm-workspace.yaml ./
COPY package.json ./

# 复制 apps/web
COPY apps/web ./apps/web

# 安装依赖
RUN pnpm install --registry=https://registry.npmmirror.com

# 切换到 web 目录
WORKDIR /usr/src/app/apps/web

# 构建生产版本
RUN pnpm run build

# 生产阶段
FROM nginx:alpine

# 复制构建产物到 nginx
COPY --from=builder /usr/src/app/apps/web/dist /usr/share/nginx/html

# 复制 nginx 配置
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]

