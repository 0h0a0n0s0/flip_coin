# Flip Coin 项目

一个基于区块链的投注游戏平台，支持多链（TRC20、BSC、ETH、Polygon、Solana）USDT 充值和提款。

## 📋 项目结构

```
flip_coin/
├── backend/                    # 后端服务 (Node.js + Express)
│   ├── routes/                # API 路由
│   │   └── admin.js           # 后台管理 API
│   ├── middleware/            # 中间件
│   │   ├── auth.js            # 身份验证
│   │   ├── adminIpWhitelistMiddleware.js
│   │   ├── checkPermissionMiddleware.js
│   │   ├── ipBlockerMiddleware.js
│   │   └── rateLimiter.js
│   ├── services/              # 业务逻辑服务层
│   │   ├── KmsService.js      # 密钥管理服务
│   │   ├── TronListener.js    # TRON 链监听
│   │   ├── TronCollectionService.js  # 归集服务
│   │   ├── GameOpenerService.js      # 开奖服务
│   │   ├── BetQueueService.js        # 投注队列
│   │   ├── PayoutService.js          # 自动出款服务
│   │   ├── PendingBetProcessor.js   # 待处理投注
│   │   ├── WalletBalanceMonitor.js  # 钱包余额监控
│   │   ├── riskControlService.js     # 风控服务
│   │   ├── auditLogService.js        # 审计日志
│   │   └── settingsCache.js          # 设置缓存
│   ├── utils/                 # 工具函数
│   │   ├── balanceChangeLogger.js
│   │   ├── gameUtils.js
│   │   ├── ipUtils.js
│   │   ├── maskUtils.js
│   │   └── safeResponse.js
│   ├── validators/            # 输入验证
│   │   └── authValidators.js
│   ├── migrations/            # 数据库迁移脚本
│   ├── scripts/               # 维护脚本
│   ├── v1_frontend/          # 旧版前端（已弃用，保留用于兼容）
│   ├── server.js              # 服务器入口
│   └── db.js                  # 数据库连接
│
├── frontend-vue3/             # Vue 3 前端（新）
│   ├── src/
│   │   ├── api/               # API 请求模块
│   │   ├── components/         # Vue 组件
│   │   │   ├── layout/        # 布局组件
│   │   │   ├── game/          # 游戏组件
│   │   │   ├── wallet/        # 钱包组件
│   │   │   ├── auth/          # 认证组件
│   │   │   ├── common/        # 通用组件
│   │   │   └── ui/            # UI 组件
│   │   ├── composables/       # Composition API hooks
│   │   ├── views/             # 页面视图
│   │   ├── router/            # 路由配置
│   │   ├── store/             # 状态管理
│   │   ├── locales/           # 多语系文件
│   │   ├── styles/            # 样式文件
│   │   └── utils/             # 工具函数
│   ├── Dockerfile
│   └── nginx.conf
│
├── admin-ui/                  # 后台管理前端 (Vue.js + Element Plus)
│   ├── src/
│   │   ├── views/             # 管理页面
│   │   │   ├── admin/         # 管理员管理
│   │   │   ├── finance/       # 财务管理
│   │   │   ├── games/         # 游戏管理
│   │   │   ├── risk/          # 风控管理
│   │   │   └── settings/      # 系统设置
│   │   ├── components/         # 组件
│   │   ├── api/               # API 模块
│   │   └── router/            # 路由
│   └── Dockerfile
│
├── nginx/                     # Nginx 配置
│   ├── default.conf
│   ├── nginx.conf
│   └── Dockerfile
│
├── modules/                    # 旧版前端模块（已弃用，保留用于兼容）
│   ├── api.js
│   ├── auth.js
│   ├── game.js
│   └── ...
│
├── migrations/                 # 根目录迁移文件
│
├── docker-compose.yml         # Docker Compose 配置
├── init.sql                   # 数据库初始化脚本
├── PROJECT_CONSTITUTION.md    # 项目开发宪法
└── CHANGELOG.md              # 变更日志
```

## 🚀 快速开始

### 前置要求

- Docker & Docker Compose
- Node.js 18+ (开发模式)
- PostgreSQL 14+ (或使用 Docker)

### 启动项目

```bash
# 1. 克隆项目
git clone <repository-url>
cd flip_coin

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入必要的配置

# 3. 启动所有服务
docker-compose up -d

# 4. 查看日志
docker-compose logs -f
```

### 访问地址

- **前端**: http://localhost:8080
- **后台管理**: http://localhost:8080/admin
- **API**: http://localhost:8080/api/v1
- **数据库**: localhost:5432

## 🏗️ 技术栈

### 后端
- **Node.js** + **Express** - Web 框架
- **PostgreSQL** - 数据库
- **Socket.IO** - 实时通信
- **Passport.js** - 身份验证
- **ethers.js** - 区块链交互

### 前端 (Vue 3)
- **Vue 3** - 前端框架
- **Vue Router** - 路由
- **Pinia** - 状态管理
- **Tailwind CSS** - 样式框架
- **Socket.IO Client** - 实时通信
- **vue-i18n** - 多语系支持

### 后台管理
- **Vue.js** + **Element Plus** - UI 框架

## 📁 核心功能

### 游戏功能
- ✅ Flip Coin 投注游戏
- ✅ 实时开奖
- ✅ 连胜记录
- ✅ 排行榜

### 钱包功能
- ✅ 多链支持（TRC20、BSC、ETH、Polygon、Solana）
- ✅ 自动归集
- ✅ 自动出款
- ✅ 充值/提款历史

### 后台管理
- ✅ 用户管理
- ✅ 投注管理
- ✅ 财务管理
- ✅ 游戏管理
- ✅ 风控管理
- ✅ 系统设置
- ✅ 多语系管理

## 🔒 安全特性

- ✅ IP 白名单（后台管理）
- ✅ 速率限制
- ✅ 密码加密（bcrypt）
- ✅ JWT 身份验证
- ✅ 谷歌二次验证（2FA）
- ✅ 风控系统
- ✅ 审计日志

## 📝 开发规范

本项目严格遵循 **PROJECT_CONSTITUTION.md** 的开发规范：

- ✅ 架构分离（前端/后端）
- ✅ API 统一格式
- ✅ 组件不超过 300 行
- ✅ 使用 Design System tokens
- ✅ 视觉密度系统
- ✅ RWD 响应式规范

详细规范请参考 [PROJECT_CONSTITUTION.md](./PROJECT_CONSTITUTION.md)

## 🔧 开发模式

### 前端开发

```bash
cd frontend-vue3
npm install
npm run dev
```

### 后端开发

```bash
cd backend
npm install
npm start
```

### 数据库迁移

```bash
# 使用 Node.js 脚本
cd backend
node scripts/run-migration.js <migration-file.sql>

# 或直接使用 Docker
docker exec -i flipcoin-db psql -U game_user -d flipcoin_db < backend/migrations/<migration-file.sql>
```

## 📚 文档

- [项目宪法](./PROJECT_CONSTITUTION.md) - 开发规范
- [变更日志](./CHANGELOG.md) - 版本变更记录
- [前端部署指南](./frontend-vue3/DEPLOYMENT.md) - 前端部署说明
- [多语系设置](./frontend-vue3/I18N_SETUP.md) - 多语系配置指南

## ⚠️ 注意事项

1. **环境变量**: 确保正确配置 `.env` 文件
2. **数据库**: 首次启动会自动执行 `init.sql` 初始化数据库
3. **端口**: 默认使用 8080 端口，可在 `.env` 中修改
4. **生产环境**: 部署前请修改默认密码和密钥

## 📄 许可证

[待补充]
