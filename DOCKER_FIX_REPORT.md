# Docker 构建修复报告

## 问题
Docker 构建失败：`npm error Unsupported URL Type "workspace:": workspace:*`

## 原因
项目已迁移到 pnpm workspace，但 Dockerfile 仍使用 npm，npm 不支持 `workspace:*` 协议。

## 修复内容

### 1. 所有 Dockerfile 改用 pnpm

#### apps/backend-legacy/Dockerfile
- ✅ 安装 pnpm
- ✅ 从根目录构建（支持 workspace）
- ✅ 复制 `pnpm-workspace.yaml` 和根 `package.json`
- ✅ 复制 `packages/database`（依赖）
- ✅ 复制 `apps/backend-legacy`
- ✅ 使用 `pnpm install` 安装依赖

#### apps/web/Dockerfile
- ✅ 安装 pnpm
- ✅ 从根目录构建
- ✅ 复制 workspace 配置
- ✅ 使用 `pnpm install` 和 `pnpm run build`
- ✅ 修复构建产物路径：`/usr/src/app/apps/web/dist`

#### apps/admin/Dockerfile
- ✅ 安装 pnpm
- ✅ 从根目录构建
- ✅ 复制 workspace 配置
- ✅ 使用 `pnpm install` 和 `pnpm run build`
- ✅ 修复构建产物路径：`/usr/src/app/apps/admin/dist`

### 2. docker-compose.yml 更新

- ✅ 所有服务的 `build.context` 改为根目录 `.`
- ✅ 使用 `dockerfile` 参数指定 Dockerfile 路径
- ✅ Volume 挂载路径已更新为新的目录结构

### 3. 路径修复

- ✅ v1_frontend 路径：`/usr/src/app/apps/backend-legacy/v1_frontend`
- ✅ locales 路径：`/usr/src/app/apps/backend-legacy/frontend-vue3/src/locales`

## 验证

```bash
# 验证 docker-compose 配置
docker-compose config

# 构建并启动
docker-compose up --build -d
```

## 注意事项

1. **首次构建**：需要安装 pnpm 和所有 workspace 依赖，可能需要几分钟
2. **开发模式**：Volume 挂载已正确配置，代码修改会实时反映
3. **生产构建**：所有依赖都会在构建时安装，确保一致性

