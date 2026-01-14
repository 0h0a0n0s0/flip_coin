# Flip Coin 项目

一个基于区块链的投注游戏平台，支持多链（TRC20、BSC、ETH、Polygon、Solana）USDT 充值和提款。

## 📋 项目结构

```
flip_coin/
├── apps/
│   ├── web/                      # Vue 3 前端 (@flipcoin/web)
│   │   ├── src/
│   │   │   ├── api/             # API 请求模块（统一处理所有 HTTP 请求）
│   │   │   ├── components/       # Vue 组件
│   │   │   │   ├── auth/        # 认证组件（登录、注册）
│   │   │   │   ├── common/      # 通用组件（横幅、历史、排行榜等）
│   │   │   │   ├── game/        # 游戏组件（Flip Coin 游戏）
│   │   │   │   ├── layout/      # 布局组件（Header、Footer、Sidebar 等）
│   │   │   │   ├── wallet/      # 钱包组件（充值、提现、个人中心）
│   │   │   │   └── ui/          # UI 组件（游戏卡片等）
│   │   │   ├── composables/     # Composition API hooks
│   │   │   │   ├── useAuth.js   # 认证相关（登录、注册、登出）
│   │   │   │   ├── useGame.js   # 游戏相关（下注逻辑）
│   │   │   │   ├── useWallet.js # 钱包相关（充值、提现）
│   │   │   │   ├── useSocket.js # Socket.IO 连接管理
│   │   │   │   └── useLanguage.js # 多语系切换
│   │   │   ├── views/           # 页面视图
│   │   │   │   ├── Home.vue     # 首页
│   │   │   │   ├── FlipCoinGamePage.vue # Flip Coin 游戏页面
│   │   │   │   ├── GameListPage.vue # 游戏列表页面
│   │   │   │   ├── BetHistoryPage.vue # 投注历史页面
│   │   │   │   └── HashGame.vue # Hash 游戏页面
│   │   │   ├── router/          # 路由配置
│   │   │   ├── store/           # 状态管理（JWT Token、用户信息、游戏状态等）
│   │   │   ├── locales/         # 多语系文件（中文、英文）
│   │   │   ├── styles/          # 样式文件（Design System tokens）
│   │   │   └── utils/           # 工具函数（通知、IP 获取等）
│   │   ├── Dockerfile
│   │   └── nginx.conf
│   │
│   ├── admin/                    # 后台管理前端 (@flipcoin/admin)
│   │   ├── src/
│   │   │   ├── views/           # 管理页面
│   │   │   │   ├── admin/       # 管理员管理（账号、权限、IP 白名单、审计日志）
│   │   │   │   ├── finance/     # 财务管理（充值、提现、账变记录）
│   │   │   │   ├── games/       # 游戏管理
│   │   │   │   ├── risk/        # 风控管理（同 IP 监控）
│   │   │   │   └── settings/    # 系统设置（游戏参数、用户等级、多语系、地区屏蔽）
│   │   │   ├── components/      # 组件（Google 认证、个人资料、Tron 通知）
│   │   │   ├── api/             # API 模块（统一处理所有 HTTP 请求）
│   │   │   ├── router/          # 路由配置
│   │   │   ├── store.js         # Vuex 状态管理（权限管理）
│   │   │   └── utils/           # 工具函数（请求拦截器）
│   │   └── Dockerfile
│   │
│   └── backend-legacy/          # 后端服务 (@flipcoin/backend-legacy)
│       ├── routes/              # API 路由
│       │   ├── v1/              # v1 API 路由（前台用户 API）
│       │   │   ├── index.js     # v1 路由统一入口
│       │   │   ├── auth.js      # 认证路由（注册、登录）
│       │   │   ├── user.js      # 用户路由（获取用户信息、更新昵称、绑定推荐人）
│       │   │   ├── bet.js       # 投注路由（下注、历史、排行榜）
│       │   │   ├── wallet.js    # 钱包路由（设置/修改提款密码、提款、充值/提款历史）
│       │   │   └── game.js      # 游戏路由（游戏列表、平台名称）
│       │   ├── admin/           # 管理 API 路由（后台管理 API）
│       │   │   ├── index.js     # 管理路由统一入口
│       │   │   ├── auth.js      # 管理员认证（登录、获取权限、个人资料、Google 认证）
│       │   │   ├── dashboard.js # 仪表板（统计数据）
│       │   │   ├── users.js     # 用户管理（用户列表、更新用户信息、用户状态、充值地址）
│       │   │   ├── bets.js      # 投注管理（投注列表、盈亏报表）
│       │   │   ├── wallets.js   # 钱包管理（平台钱包 CRUD、钱包监控）
│       │   │   ├── settings.js  # 系统设置（通用设置、多语系、地区屏蔽、用户等级）
│       │   │   ├── accounts.js  # 账号管理（管理员账号 CRUD、IP 白名单）
│       │   │   ├── permissions.js # 权限管理（角色 CRUD、权限列表）
│       │   │   └── transactions.js # 交易管理（充值、提现、账变记录、同 IP 风控）
│       │   └── admin.js         # 管理路由主文件（已重构为模块化）
│       │
│       ├── middleware/          # 中间件
│       │   ├── adminIpWhitelistMiddleware.js # 管理员 IP 白名单检查
│       │   ├── auth.js          # 身份验证中间件
│       │   ├── checkPermissionMiddleware.js # 权限检查中间件
│       │   ├── ipBlockerMiddleware.js # IP 封禁检查
│       │   └── rateLimiter.js   # 速率限制（注册、登录、提款）
│       │
│       ├── services/            # 业务逻辑服务层
│       │   ├── KmsService.js    # 密钥管理服务（HD 钱包派生、地址生成）
│       │   ├── TronListener.js  # TRON 链监听服务（轮询用户充值地址）
│       │   ├── TronCollectionService.js # TRON 归集服务（Approve + TransferFrom）
│       │   ├── CollectionRetryJob.js # 归集重试队列服务
│       │   ├── GameOpenerService.js # 开奖服务（链上开奖）
│       │   ├── BetQueueService.js # 投注队列服务（处理投注请求）
│       │   ├── PayoutService.js  # 自动出款服务（TRC20-USDT 出款）
│       │   ├── PendingBetProcessor.js # 待处理投注处理器
│       │   ├── WalletBalanceMonitor.js # 钱包余额监控服务
│       │   ├── TronEnergyService.js # TRON 能量租赁服务
│       │   ├── riskControlService.js # 风控服务（同 IP 检测）
│       │   ├── auditLogService.js # 审计日志服务
│       │   ├── settingsCache.js # 系统设置缓存服务
│       │   ├── UserService.js   # 用户服务（用户相关数据库操作）
│       │   ├── AdminService.js  # 管理员服务（管理员相关数据库操作）
│       │   ├── GameService.js   # 游戏服务（游戏相关数据库操作）
│       │   └── WithdrawalService.js # 提款服务（提款相关数据库操作）
│       │
│       ├── utils/               # 工具函数
│       │   ├── safeResponse.js  # API 响应标准化（sendSuccess、sendError）
│       │   ├── maskUtils.js     # 敏感数据脱敏（地址、交易哈希）
│       │   ├── balanceChangeLogger.js # 账变记录工具
│       │   ├── gameUtils.js     # 游戏工具函数
│       │   └── ipUtils.js       # IP 工具函数（获取真实 IP、设备 ID、国家）
│       │
│       ├── validators/          # 输入验证
│       │   └── authValidators.js # 认证输入验证（注册、登录、提款）
│       │
│       ├── scripts/             # 维护脚本
│       │   ├── run-migration.js # 数据库迁移脚本
│       │   ├── prepare-test-data.js # 测试数据准备脚本
│       │   └── update-password-fingerprints.js # 密码指纹更新脚本
│       │
│       ├── tests/               # 自动化测试
│       │   ├── test-runner.js   # 测试运行器（API 测试、错误处理测试、回归测试）
│       │   ├── run-all-tests.sh # 测试执行脚本
│       │   └── README.md        # 测试文档
│       │
│       ├── v1_frontend/         # 旧版前端（已弃用，保留用于兼容）
│       └── server.js            # 服务器入口（Express、Socket.IO、Passport.js）
│
├── packages/
│   ├── database/                # 数据库连接和迁移 (@flipcoin/database)
│   │   ├── index.js             # 数据库连接（PostgreSQL）
│   │   └── migrations/          # 数据库迁移脚本
│   └── ui/                      # 共享 UI 组件 (@flipcoin/ui)
│
├── services/
│   └── wallet/                  # 钱包服务 (@flipcoin/service-wallet)
│
├── nginx/                       # Nginx 配置
│   ├── default.conf             # Nginx 默认配置
│   ├── nginx.conf               # Nginx 主配置
│   ├── docker-entrypoint.sh     # Docker 入口脚本
│   └── Dockerfile               # Nginx Dockerfile
│
├── modules/                     # 旧版前端模块（已弃用，保留用于兼容）
│   ├── api.js                   # 旧版 API 模块
│   ├── auth.js                  # 旧版认证模块
│   ├── game.js                  # 旧版游戏模块
│   └── ...
│
├── migrations/                  # 根目录迁移文件
│
├── docker-compose.yml           # Docker Compose 配置
├── init.sql                     # 数据库初始化脚本
├── pnpm-workspace.yaml          # pnpm workspace 配置
├── PROJECT_CONSTITUTION.md      # 项目开发宪法（开发规范）
└── CHANGELOG.md                 # 变更日志
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
- **Node.js 18** + **Express** - Web 框架
- **PostgreSQL 14** - 数据库
- **Socket.IO** - 实时通信
- **Passport.js** - 身份验证（JWT、Local Strategy）
- **TronWeb** - TRON 区块链交互
- **ethers.js** - EVM 区块链交互
- **pnpm** - 包管理器（workspace 模式）

### 前端 (Vue 3)
- **Vue 3** - 前端框架（Composition API）
- **Vue Router** - 路由
- **Reactive State** - 状态管理（Vue 3 reactive）
- **Tailwind CSS** - 样式框架
- **Socket.IO Client** - 实时通信
- **vue-i18n** - 多语系支持
- **Element Plus** - UI 组件库（部分组件）

### 后台管理
- **Vue.js** + **Element Plus** - UI 框架
- **Vuex** - 状态管理（权限管理）
- **Axios** - HTTP 客户端

## 📁 核心功能

### 游戏功能
- ✅ Flip Coin 投注游戏
- ✅ 实时开奖（链上开奖）
- ✅ 连胜记录
- ✅ 排行榜
- ✅ 投注历史

### 钱包功能
- ✅ 多链支持（TRC20、BSC、ETH、Polygon、Solana）
- ✅ HD 钱包地址分配（用户注册时自动分配）
- ✅ 自动充值监听（TRON 链轮询）
- ✅ 自动归集（Approve + TransferFrom）
- ✅ 自动出款（TRC20-USDT）
- ✅ 充值/提款历史
- ✅ 提款密码保护

### 后台管理
- ✅ 用户管理（用户列表、信息更新、状态管理、充值地址查询）
- ✅ 投注管理（投注列表、盈亏报表）
- ✅ 财务管理（充值记录、提现审核、账变记录）
- ✅ 钱包管理（平台钱包 CRUD、钱包监控）
- ✅ 游戏管理（游戏列表、游戏参数设置）
- ✅ 风控管理（同 IP 监控、IP 封禁）
- ✅ 系统设置（游戏参数、用户等级、多语系、地区屏蔽）
- ✅ 管理员管理（账号管理、权限管理、IP 白名单、审计日志）
- ✅ 实时仪表板（统计数据、在线用户）

## 💰 用户金流流程

### 1. 钱包地址分配机制

#### 1.1 分配方式
- **技术实现**: 使用 HD (Hierarchical Deterministic) 钱包派生
- **主密钥**: 从 `MASTER_MNEMONIC` (环境变量) 派生所有子钱包
- **派生路径**:
  - EVM 链 (BSC/ETH/Polygon): `m/44'/60'/0'/0/{index}`
  - TRON 链: `m/44'/195'/0'/0/{index}`

#### 1.2 索引分配规则
- **平台保留索引**: 0-1000 (索引 0-1000 保留给平台内部使用)
- **用户起始索引**: **1001** (新用户从索引 1001 开始分配)
- **分配逻辑**: 
  - 注册时调用 `KmsService.getNewDepositWallets()`
  - 使用 `SELECT ... FOR UPDATE NOWAIT` 确保并发安全
  - 查询数据库中 `deposit_path_index` 的最大值
  - 新索引 = `MAX(最大索引 + 1, 1001)`
  - 同时生成 EVM 和 TRON 两个地址
  - 支持重试机制（最多 3 次，指数退避）

#### 1.3 地址存储
- 用户注册时，`deposit_path_index`、`evm_deposit_address`、`tron_deposit_address` 写入 `users` 表
- 私钥不存储，需要时通过 `KmsService.getPrivateKey(chainType, index)` 动态派生

### 2. 用户充值监听机制

#### 2.1 监听方式
- **服务**: `TronListener.js`
- **监听频率**: **每 10 秒轮询一次** (`POLLING_INTERVAL_MS = 10000`)
- **监听范围**: 所有已注册用户的 TRON 充值地址
- **API 端点**: `/wallet/getnowblock` (TronGrid API)
- **区块同步**: 使用 `blockchain_sync_status` 表保存最后扫描的区块高度

#### 2.2 监听内容
1. **TRC20-USDT 充值**:
   - API: `v1/accounts/{address}/transactions/trc20`
   - 过滤条件: `only_to=true`, `only_confirmed=true`, `contract_address=USDT_CONTRACT`
   - USDT 合约地址 (Nile 测试网): `TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs`

2. **TRX 交易记录**:
   - API: `v1/accounts/{address}/transactions`
   - 过滤条件: `only_to=true`, `only_confirmed=true`, `TransferContract` 类型
   - 用途: 仅记录用户收到 TRX 的交易（类型为 `deposit_trx`）
   - **注意**: 
     - 仅记录到 `platform_transactions` 表，**不会更新用户余额**
     - **不会自动激活地址**，用户需要自行激活或通过其他方式激活
     - 主要用于交易历史记录和审计

#### 2.3 处理流程
1. 轮询所有用户的 `tron_deposit_address`
2. 查询每个地址的最近交易（基于区块高度增量查询）
3. 检查交易是否已处理（查询 `platform_transactions` 表）
4. 处理新交易:
   - **TRC20-USDT 充值**:
     - 更新用户余额 (`users.balance`)
     - 记录交易流水 (`platform_transactions`, 类型: `deposit`)
     - 记录账变 (`balance_changes`)
     - 通过 Socket.IO 实时通知用户
   - **TRX 交易**:
     - 仅记录交易流水 (`platform_transactions`, 类型: `deposit_trx`)
     - **不更新用户余额**（TRX 不是平台支持的充值币种）
     - **不激活地址**（系统不再自动激活）

#### 2.4 区块高度管理
- 使用 `blockchain_sync_status` 表追踪最后扫描的区块高度
- 每次轮询后更新区块高度
- 服务重启后从数据库恢复扫描进度

### 3. 用户充值地址归集机制

#### 3.1 归集方式
- **服务**: `TronCollectionService.js`
- **归集模式**: **Approve + TransferFrom** (双签名模式)
  - 用户地址执行 `approve()`: 授权归集钱包可转出 USDT（不消耗能量和 TRX）
  - 归集钱包执行 `transferFrom()`: 实际转出 USDT（消耗能量）

#### 3.2 归集钱包配置
- **归集钱包**: 从 `platform_wallets` 表读取 `is_collection=true` 的钱包
- **注意**: 系统不再自动激活用户地址，用户需要自行激活或通过其他方式激活地址

#### 3.3 归集触发条件
1. **扫描间隔**: 由 `collection_settings.scan_interval_days` 控制（默认按天扫描）
2. **归集条件** (需同时满足):
   - 用户 USDT 余额 > 0
   - 距离上次充值时间 >= `days_without_deposit` 天
   - 或用户创建时间 >= `days_without_deposit` 天（无充值记录时）
   - 无 pending 状态的归集记录

#### 3.4 归集执行流程
1. **检查扫描间隔**: 查询 `collection_cursor` 表，判断是否到达扫描时间
2. **能量管理**:
   - 获取归集钱包当前能量
   - 计算平均能量消耗（从历史 `collection_logs` 统计，默认 35000）
   - 估算可处理地址数量 = `当前能量 / 平均能量消耗`
3. **批量处理**:
   - 按 `user_id` 顺序查询用户（支持断点续传）
   - 检查每个用户是否符合归集条件
   - 检查并执行 `approve()`（如果 allowance < balance）
   - 执行 `transferFrom()` 归集
   - 记录归集日志到 `collection_logs` 表
   - **注意**: 系统不再自动激活用户地址，未激活的地址将无法归集
4. **断点续传**: 使用 `collection_cursor` 记录最后处理的 `user_id`，下次从该位置继续
5. **失败重试**: 使用 `collection_retry_queue` 表管理失败的重试任务，支持指数退避

### 4. 自动出款机制

#### 4.1 出款钱包
- **出款钱包**: 从 `platform_wallets` 表读取 `is_payout=true` 的钱包
- **私钥配置**: 通过环境变量 `TRON_PK_{address}` 配置
- **出款方式**: 直接执行 TRC20-USDT `transfer()` 交易

#### 4.2 自动出款触发条件
需同时满足以下条件:
1. **系统设置**: `AUTO_WITHDRAW_THRESHOLD > 0` (在 `system_settings` 表中配置)
2. **金额限制**: 提款金额 <= `AUTO_WITHDRAW_THRESHOLD`
3. **链类型**: `chain_type = 'TRC20'` (目前仅支持 TRC20)
4. **服务就绪**: `PayoutService` 已初始化且钱包已加载

#### 4.3 出款流程
1. **用户提交提款请求**:
   - 验证提款密码
   - 检查余额是否充足
   - 扣除用户余额
   - 创建 `withdrawals` 记录

2. **判断是否自动出款**:
   - 符合条件 → `status = 'processing'`，异步执行链上出款
   - 不符合条件 → `status = 'pending'`，等待人工审核

3. **自动出款执行** (异步):
   - 调用 `PayoutService.sendTrc20Payout()`
   - 构建并签名 TRC20-USDT `transfer()` 交易
   - 广播交易到链上
   - 更新 `withdrawals.status = 'completed'` 并记录 `tx_hash`
   - 如果失败，回退状态为 `pending`，等待人工审核

#### 4.4 交易费用
- **Gas 费用**: 自动出款使用 TRX 作为 Gas（不消耗能量）
- **费用限额**: `feeLimit = 15000000` (15 TRX)
- **费用来源**: 出款钱包需持有足够的 TRX

### 5. 质押能量与交易费用

#### 5.1 能量使用场景
1. **归集交易** (`transferFrom`):
   - 归集钱包消耗自己的能量
   - 平均消耗: ~35000 能量/笔
   - 能量来源: 归集钱包质押 TRX 或购买能量

2. **用户地址激活**:
   - Gas 储备钱包转 1 TRX 给用户地址
   - 消耗 TRX（非能量）

#### 5.2 TRX 使用场景
1. **自动出款** (`transfer`):
   - 出款钱包消耗 TRX 作为 Gas
   - 费用限额: 15 TRX/笔

2. **地址激活**:
   - **注意**: 系统不再自动激活用户地址，用户需要自行激活或通过其他方式激活

#### 5.3 钱包角色分工
- **归集钱包** (`is_collection=true`): 执行归集，消耗能量
- **出款钱包** (`is_payout=true`): 执行自动出款，消耗 TRX
- **注意**: `Gas 储备钱包` 功能已移除，系统不再自动激活用户地址

## 🔒 安全特性

- ✅ IP 白名单（后台管理）
- ✅ 速率限制（注册、登录、提款）
- ✅ 密码加密（bcrypt）
- ✅ JWT 身份验证
- ✅ 谷歌二次验证（2FA）
- ✅ 风控系统（同 IP 检测、IP 封禁）
- ✅ 审计日志
- ✅ 敏感数据脱敏（地址、交易哈希）
- ✅ API 响应标准化（统一错误处理）
- ✅ 输入验证（注册、登录、提款）
- ✅ 并发控制（用户注册时的索引分配）

## 📝 开发规范

本项目严格遵循 **PROJECT_CONSTITUTION.md** 的开发规范：

### 架构规则
- ✅ 严格的前后端分离
- ✅ 服务层抽象（数据库逻辑在 services 中）
- ✅ 路由层仅负责验证、调用服务、格式化响应
- ✅ 模块化设计（文件不超过 400 行）

### API 规范
- ✅ 统一响应格式：
  - 成功: `{ "success": true, "data": ... }`
  - 错误: `{ "success": false, "error": "message" }`
- ✅ 使用 `sendSuccess` 和 `sendError` 工具函数
- ✅ 错误消息脱敏（不暴露内部错误）

### 前端规范
- ✅ 统一 API 模块（禁止直接使用 `fetch()`）
- ✅ 组件大小限制（< 300 行）
- ✅ 使用 Design System tokens（spacing、radius、colors）
- ✅ 响应式设计（Web、Tablet、Mobile）
- ✅ 高密度 UI（赌场级视觉密度）

### 代码质量
- ✅ 命名规范（camelCase 变量/函数，PascalCase 类/组件）
- ✅ 文件命名与导入路径一致（大小写敏感）
- ✅ 禁止版本注释（使用 CHANGELOG.md）

详细规范请参考 [PROJECT_CONSTITUTION.md](./PROJECT_CONSTITUTION.md)

## 🔧 开发模式

### 前端开发

```bash
cd apps/web
npm install
npm run dev
```

### 后端开发

```bash
cd apps/backend-legacy
npm install
npm start
```

### 数据库迁移

```bash
# 使用 Node.js 脚本
cd apps/backend-legacy
node scripts/run-migration.js <migration-file.sql>

# 或直接使用 Docker
docker exec -i flipcoin-db psql -U game_user -d flipcoin_db < packages/database/migrations/<migration-file.sql>
```

### 运行测试

```bash
# 运行自动化测试
cd apps/backend-legacy/tests
./run-all-tests.sh

# 或直接运行测试脚本
node test-runner.js
```

## 📚 文档

- [项目宪法](./PROJECT_CONSTITUTION.md) - 开发规范
- [变更日志](./CHANGELOG.md) - 版本变更记录
- [测试文档](./apps/backend-legacy/tests/README.md) - 自动化测试说明

## ⚠️ 注意事项

1. **环境变量**: 确保正确配置 `.env` 文件
   - `MASTER_MNEMONIC`: HD 钱包主密钥（必须保密）
   - `JWT_SECRET`: JWT 密钥
   - `DATABASE_URL`: 数据库连接字符串
   - `NILE_LISTENER_HOST`: TRON 节点地址

2. **数据库**: 首次启动会自动执行 `init.sql` 初始化数据库

3. **端口**: 默认使用 8080 端口，可在 `.env` 中修改 `NGINX_PORT`

4. **生产环境**: 部署前请修改默认密码和密钥

5. **并发注册**: 系统已实现并发控制，但高并发场景下仍建议使用负载均衡

6. **能量管理**: 归集钱包需要足够的能量，建议监控能量余额并设置告警

7. **出款钱包**: 出款钱包需要足够的 TRX 作为 Gas，建议监控 TRX 余额

## 🔄 重构历史

### 主要重构内容

1. **API 响应标准化**: 所有 API 统一使用 `{ success: true, data: ... }` 格式
2. **路由模块化**: 
   - `server.js` 路由拆分` → `routes/v1/` (前台 API)
   - `admin.js` 路由拆分 → `routes/admin/` (后台 API)
3. **服务层抽象**: 创建 `UserService`、`AdminService`、`GameService`、`WithdrawalService`
4. **前台 API 适配**: 修复所有前台 API 响应处理，适配标准格式
5. **充值地址显示**: 修复字段名匹配问题（`tron_deposit_address`、`evm_deposit_address`）
6. **并发控制**: 实现用户注册时的索引分配并发控制（`SELECT ... FOR UPDATE NOWAIT`）
7. **区块同步**: 实现区块高度持久化（`blockchain_sync_status` 表）
8. **归集重试**: 实现归集失败重试机制（`collection_retry_queue` 表）

详细变更记录请参考 [CHANGELOG.md](./CHANGELOG.md)

## 📄 许可证

[待补充]
