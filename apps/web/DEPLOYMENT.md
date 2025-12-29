# Vue 3 前端部署指南

## 🚀 快速部署

### 1. 构建和启动

```bash
# 在项目根目录执行
docker-compose up -d --build frontend-vue3 nginx
```

### 2. 查看日志

```bash
# 查看前端构建日志
docker-compose logs frontend-vue3

# 查看 nginx 日志
docker-compose logs nginx
```

### 3. 访问

打开浏览器访问：`http://localhost:8080`（或你配置的端口）

## 📋 部署架构

```
用户请求
    ↓
Nginx (主代理)
    ├─ /api/v1/ → 后端 API (api:3000)
    ├─ /socket.io/ → 后端 Socket.IO (api:3000)
    ├─ /admin/ → 后台管理 (api:3000)
    └─ / → Vue 3 前端 (frontend-vue3:80)
```

## 🔧 配置说明

### Nginx 路由规则（nginx/default.conf）

1. **`/api/admin/`** → 后台 API
2. **`/admin/`** → 后台管理页面
3. **`/api/v1/`** → 前端 API
4. **`/socket.io/`** → Socket.IO 连接
5. **`/`** → Vue 3 前端（新）

### 前端容器（frontend-vue3）

- 只提供静态文件
- 支持 Vue Router SPA 路由
- API 请求由主 nginx 代理

## ⚠️ 注意事项

1. **首次构建**：需要安装依赖和构建，可能需要几分钟
2. **端口冲突**：确保 8080 端口未被占用
3. **缓存问题**：如果看到旧页面，清除浏览器缓存或使用无痕模式
4. **API 连接**：确保后端服务正常运行

## 🐛 故障排查

### 问题：还是看到旧页面

1. 检查容器是否启动：
   ```bash
   docker-compose ps
   ```

2. 检查前端容器日志：
   ```bash
   docker-compose logs frontend-vue3
   ```

3. 检查 nginx 配置：
   ```bash
   docker-compose exec nginx nginx -t
   ```

4. 重启服务：
   ```bash
   docker-compose restart nginx frontend-vue3
   ```

### 问题：API 请求失败

1. 检查后端服务：
   ```bash
   docker-compose logs api
   ```

2. 检查 nginx 代理配置是否正确

### 问题：Socket.IO 连接失败

1. 检查后端 Socket.IO 服务是否正常
2. 检查 nginx 的 `/socket.io/` 配置

## 📝 开发模式

如果要在开发模式下运行（热重载）：

```bash
cd frontend-vue3
npm install
npm run dev
```

开发服务器将在 `http://localhost:3000` 启动。

## 🔄 更新前端

修改前端代码后：

```bash
# 重新构建
docker-compose build frontend-vue3

# 重启服务
docker-compose up -d frontend-vue3 nginx
```

