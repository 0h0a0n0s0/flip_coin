# Flip Coin 项目

一个基于区块链的投注游戏平台，支持多链（TRC20、BSC、ETH、Polygon、Solana）USDT 充值和提款。

## 📋 项目概述

Flip Coin 是一个基于区块链的投注游戏平台，采用 **Monorepo** 架构，使用 **pnpm workspace** 管理多个应用和包。项目包含前端用户界面、后台管理系统、后端 API 服务以及共享的数据库和 UI 组件包。

### 核心特性

- 🎮 **Flip Coin 投注游戏** - 实时链上开奖
- 💰 **多链钱包支持** - TRC20、BSC、ETH、Polygon、Solana
- 🔐 **HD 钱包管理** - 自动分配用户充值地址
- ⚡ **自动充值监听** - TRON 链轮询监听用户充值
- 🔄 **自动归集** - Approve + TransferFrom 双签名归集
- 💸 **自动出款** - TRC20-USDT 自动出款
- 🛡️ **Guardian 风控系统** - Casino-Grade 提现风控（勝率检测、黑名单、关联账户分析）
- 🔒 **安全防护** - IP 白名单、速率限制、多重风控系统
- 📊 **后台管理** - 完整的用户、财务、游戏、风控管理

## 📁 项目结构

```
flip_coin/
├── apps/                              # 应用目录
│   ├── web/                           # Vue 3 前端应用 (@flipcoin/web)
│   │   ├── src/
│   │   │   ├── api/                   # API 请求模块（统一处理所有 HTTP 请求）
│   │   │   │   └── index.js           # 统一 API 客户端，禁止直接使用 fetch()
│   │   │   ├── components/            # Vue 组件
│   │   │   │   ├── auth/              # 认证组件
│   │   │   │   │   ├── LoginModal.vue      # 登录模态框
│   │   │   │   │   └── RegisterModal.vue   # 注册模态框
│   │   │   │   ├── common/            # 通用组件
│   │   │   │   │   ├── Banner.vue           # 横幅组件
│   │   │   │   │   ├── History.vue          # 历史记录
│   │   │   │   │   ├── Leaderboard.vue      # 排行榜
│   │   │   │   │   ├── LanguageSwitcher.vue # 语言切换
│   │   │   │   │   ├── SmallWinnerTicker.vue # 实时中奖滚动
│   │   │   │   │   └── TrendingGamesGrid.vue # 热门游戏网格
│   │   │   │   ├── game/              # 游戏组件
│   │   │   │   │   └── FlipCoinGame.vue     # Flip Coin 游戏主组件
│   │   │   │   ├── layout/            # 布局组件
│   │   │   │   │   ├── MainLayout.vue        # 主布局（SPA 架构）
│   │   │   │   │   ├── Header.vue            # 顶部导航栏
│   │   │   │   │   ├── Footer.vue            # 页脚
│   │   │   │   │   ├── LeftSidebar.vue       # 左侧边栏
│   │   │   │   │   ├── TopCategoryNav.vue    # 顶部分类导航
│   │   │   │   │   ├── MobileBottomNav.vue   # 移动端底部导航
│   │   │   │   │   └── CompactHeroStrip.vue  # 紧凑型首页横幅
│   │   │   │   ├── wallet/            # 钱包组件
│   │   │   │   │   ├── WalletModal.vue       # 钱包模态框（充值/提现）
│   │   │   │   │   ├── PersonalCenter.vue    # 个人中心
│   │   │   │   │   ├── SetPasswordModal.vue  # 设置提款密码
│   │   │   │   │   └── ChangePasswordModal.vue # 修改提款密码
│   │   │   │   └── ui/                # UI 组件
│   │   │   │       └── GameCard.vue          # 游戏卡片组件
│   │   │   ├── composables/           # Composition API hooks
│   │   │   │   ├── useAuth.js         # 认证相关（登录、注册、登出）
│   │   │   │   ├── useGame.js         # 游戏相关（下注逻辑）
│   │   │   │   ├── useWallet.js       # 钱包相关（充值、提现）
│   │   │   │   ├── useSocket.js       # Socket.IO 连接管理
│   │   │   │   └── useLanguage.js     # 多语系切换
│   │   │   ├── views/                 # 页面视图
│   │   │   │   ├── Home.vue           # 首页（Hero Strip、Trending Games、Latest Wins）
│   │   │   │   ├── FlipCoinGamePage.vue # Flip Coin 游戏页面
│   │   │   │   ├── GameListPage.vue   # 游戏列表页面
│   │   │   │   ├── BetHistoryPage.vue # 投注历史页面
│   │   │   │   └── HashGame.vue       # Hash 游戏分类页面
│   │   │   ├── router/                # 路由配置
│   │   │   │   └── index.js           # Vue Router 配置（嵌套路由）
│   │   │   ├── store/                 # 状态管理
│   │   │   │   └── index.js           # Pinia store（JWT Token、用户信息、游戏状态）
│   │   │   ├── locales/               # 多语系文件
│   │   │   │   ├── index.js           # i18n 配置
│   │   │   │   ├── zh-TW.json         # 繁体中文
│   │   │   │   ├── zh-CN.json         # 简体中文
│   │   │   │   └── en.json            # 英文
│   │   │   ├── styles/                # 样式文件
│   │   │   │   ├── main.css           # 主样式文件
│   │   │   │   └── tokens.css          # Design System tokens（颜色、间距、圆角）
│   │   │   ├── utils/                 # 工具函数
│   │   │   │   └── notify.js          # 统一通知系统（Notyf）
│   │   │   └── scripts/               # 脚本
│   │   │       └── i18n-scanner.js    # i18n 字符串扫描脚本
│   │   ├── Dockerfile                 # Docker 构建文件
│   │   ├── nginx.conf                 # Nginx 配置
│   │   ├── vite.config.js             # Vite 配置
│   │   ├── tailwind.config.js         # Tailwind CSS 配置
│   │   └── package.json               # 依赖配置
│   │
│   ├── admin/                         # 后台管理前端 (@flipcoin/admin)
│   │   ├── src/
│   │   │   ├── views/                 # 管理页面
│   │   │   │   ├── Layout.vue         # 管理后台布局
│   │   │   │   ├── Login.vue          # 管理员登录页
│   │   │   │   ├── Dashboard.vue      # 仪表板（统计数据）
│   │   │   │   ├── UserManagement.vue # 用户管理
│   │   │   │   ├── UserDepositAddresses.vue # 用户充值地址查询
│   │   │   │   ├── BetManagement.vue  # 投注管理
│   │   │   │   ├── ReportManagement.vue # 报表管理
│   │   │   │   ├── CollectionLogs.vue # 归集日志
│   │   │   │   ├── WalletMonitoring.vue # 钱包监控
│   │   │   │   ├── admin/             # 管理员管理
│   │   │   │   │   ├── AccountManagement.vue # 账号管理
│   │   │   │   │   ├── Permissions.vue      # 权限管理
│   │   │   │   │   ├── IpWhitelist.vue     # IP 白名单
│   │   │   │   │   └── AuditLogs.vue       # 审计日志
│   │   │   │   ├── finance/           # 财务管理
│   │   │   │   │   ├── DepositHistory.vue  # 充值记录
│   │   │   │   │   ├── WithdrawalReview.vue # 提现审核（Guardian 风控增强）
│   │   │   │   │   ├── BalanceChanges.vue  # 账变记录
│   │   │   │   │   └── AddressBlacklist.vue # 地址黑名单管理（Guardian）
│   │   │   │   ├── games/             # 游戏管理
│   │   │   │   │   └── GameManagement.vue  # 游戏列表和参数设置
│   │   │   │   ├── risk/              # 风控管理
│   │   │   │   │   └── SameIpMonitor.vue   # 同 IP 监控
│   │   │   │   └── settings/          # 系统设置
│   │   │   │       ├── GameParameters.vue  # 游戏参数
│   │   │   │       ├── UserLevels.vue      # 用户等级
│   │   │   │       ├── I18nManagement.vue  # 多语系管理
│   │   │   │       └── BlockedRegions.vue  # 地区屏蔽
│   │   │   ├── components/            # 组件
│   │   │   │   ├── GoogleAuthDialog.vue    # Google 二次验证对话框
│   │   │   │   ├── ProfileDialog.vue        # 个人资料对话框
│   │   │   │   └── TronNotificationDialog.vue # TRON 通知对话框
│   │   │   ├── api/                   # API 模块
│   │   │   │   └── index.js           # 统一 API 客户端（Axios）
│   │   │   ├── router/                # 路由配置
│   │   │   │   └── index.js           # Vue Router 配置
│   │   │   ├── store.js               # Vuex 状态管理（权限管理）
│   │   │   └── utils/                 # 工具函数
│   │   │       └── request.js         # Axios 请求拦截器
│   │   ├── Dockerfile                 # Docker 构建文件
│   │   ├── nginx.conf                 # Nginx 配置
│   │   └── package.json               # 依赖配置
│   │
│   └── backend-legacy/                # 后端服务 (@flipcoin/backend-legacy)
│       ├── routes/                    # API 路由
│       │   ├── v1/                    # v1 API 路由（前台用户 API）
│       │   │   ├── index.js           # v1 路由统一入口
│       │   │   ├── auth.js            # 认证路由（注册、登录）
│       │   │   ├── user.js            # 用户路由（获取用户信息、更新昵称、绑定推荐人）
│       │   │   ├── bet.js             # 投注路由（下注、历史、排行榜）
│       │   │   ├── wallet.js          # 钱包路由（设置/修改提款密码、提款、充值/提款历史）
│       │   │   └── game.js            # 游戏路由（游戏列表、平台名称）
│       │   ├── admin/                 # 管理 API 路由（后台管理 API）
│       │   │   ├── index.js           # 管理路由统一入口
│       │   │   ├── auth.js            # 管理员认证（登录、获取权限、个人资料、Google 认证）
│       │   │   ├── dashboard.js       # 仪表板（统计数据）
│       │   │   ├── users.js           # 用户管理（用户列表、更新用户信息、用户状态、充值地址）
│       │   │   ├── bets.js            # 投注管理（投注列表、盈亏报表）
│       │   │   ├── wallets.js         # 钱包管理（平台钱包 CRUD、钱包监控）
│       │   │   ├── settings.js        # 系统设置（通用设置、多语系、地区屏蔽、用户等级）
│       │   │   ├── accounts.js        # 账号管理（管理员账号 CRUD、IP 白名单）
│       │   │   ├── permissions.js     # 权限管理（角色 CRUD、权限列表）
│       │   │   └── transactions.js    # 交易管理（充值、提现、账变记录、同 IP 风控）
│       │   └── admin.js               # 管理路由主文件（已重构为模块化）
│       │
│       ├── middleware/                # 中间件
│       │   ├── adminIpWhitelistMiddleware.js # 管理员 IP 白名单检查
│       │   ├── auth.js                # 身份验证中间件（JWT、Passport.js）
│       │   ├── checkPermissionMiddleware.js # 权限检查中间件
│       │   ├── ipBlockerMiddleware.js # IP 封禁检查
│       │   └── rateLimiter.js         # 速率限制（注册、登录、提款）
│       │
│       ├── services/                  # 业务逻辑服务层
│       │   ├── KmsService.js          # 密钥管理服务（HD 钱包派生、地址生成）
│       │   ├── TronListener.js        # TRON 链监听服务（轮询用户充值地址，每 10 秒）
│       │   ├── TronCollectionService.js # TRON 归集服务（Approve + TransferFrom）
│       │   ├── CollectionRetryJob.js  # 归集重试队列服务
│       │   ├── GameOpenerService.js   # 开奖服务（链上开奖）
│       │   ├── BetQueueService.js     # 投注队列服务（处理投注请求）
│       │   ├── PayoutService.js       # 自动出款服务（TRC20-USDT 出款）
│       │   ├── PendingBetProcessor.js # 待处理投注处理器
│       │   ├── WalletBalanceMonitor.js # 钱包余额监控服务
│       │   ├── TronEnergyService.js   # TRON 能量租赁服务
│       │   ├── riskControlService.js  # 风控服务（同 IP 检测）
│       │   ├── RiskAssessmentService.js # Guardian 风控评估服务（勝率、黑名单、关联分析）
│       │   ├── auditLogService.js     # 审计日志服务
│       │   ├── settingsCache.js       # 系统设置缓存服务
│       │   ├── UserService.js         # 用户服务（用户相关数据库操作）
│       │   ├── AdminService.js        # 管理员服务（管理员相关数据库操作）
│       │   ├── GameService.js         # 游戏服务（游戏相关数据库操作）
│       │   └── WithdrawalService.js   # 提款服务（提款相关数据库操作）
│       │
│       ├── utils/                     # 工具函数
│       │   ├── safeResponse.js        # API 响应标准化（sendSuccess、sendError）
│       │   ├── maskUtils.js           # 敏感数据脱敏（地址、交易哈希）
│       │   ├── balanceChangeLogger.js # 账变记录工具
│       │   ├── gameUtils.js           # 游戏工具函数
│       │   └── ipUtils.js             # IP 工具函数（获取真实 IP、设备 ID、国家）
│       │
│       ├── validators/                # 输入验证
│       │   └── authValidators.js      # 认证输入验证（注册、登录、提款）
│       │
│       ├── scripts/                   # 维护脚本
│       │   ├── run-migration.js       # 数据库迁移脚本
│       │   ├── prepare-test-data.js   # 测试数据准备脚本
│       │   ├── update-password-fingerprints.js # 密码指纹更新脚本
│       │   └── README.md              # 脚本使用说明
│       │
│       ├── tests/                     # 自动化测试
│       │   ├── test-runner.js         # 测试运行器（API 测试、错误处理测试、回归测试）
│       │   ├── run-all-tests.sh       # 测试执行脚本
│       │   └── README.md              # 测试文档
│       │
│       ├── v1_frontend/               # 旧版前端（已弃用，保留用于兼容）
│       │   ├── index.html
│       │   ├── app.js
│       │   └── style.css
│       │
│       ├── server.js                  # 服务器入口（Express、Socket.IO、Passport.js）
│       └── package.json               # 依赖配置
│
├── packages/                          # 共享包目录
│   ├── database/                      # 数据库连接和迁移包 (@flipcoin/database)
│   │   ├── index.js                   # 数据库连接（PostgreSQL）
│   │   ├── migrations/                # 数据库迁移脚本目录
│   │   │   └── archive_v1/            # 历史迁移归档（v2.0 整合前，共 23 个文件）
│   │   │       ├── add_admin_ip_125_229_37_48.sql
│   │   │       ├── add_admin_last_login_ip.sql
│   │   │       ├── add_admin_profile_fields.sql
│   │   │       ├── add_energy_rental_support.sql
│   │   │       ├── add_game_code_column.sql
│   │   │       ├── add_platform_name_setting.sql
│   │   │       ├── add_streak_multipliers.sql      # 连胜倍数系统
│   │   │       ├── add_tron_system_upgrade.sql
│   │   │       ├── add_user_level_accumulators.sql
│   │   │       ├── add_withdrawal_risk_control.sql # Guardian 风控系统
│   │   │       ├── create_balance_changes_table.sql
│   │   │       ├── create_games_table_manual.sql
│   │   │       ├── create_tron_notifications_table.sql
│   │   │       ├── create_tron_notifications_table_manual.sql
│   │   │       ├── fix_collection_cursor_schema.sql
│   │   │       ├── fix_payout_multiplier_type.sql
│   │   │       ├── init_i18n_settings.sql
│   │   │       ├── migrate_flipcoin_to_games.sql
│   │   │       ├── remove_bet_count_and_max_bet_limit.sql
│   │   │       ├── update_admin_ip_whitelist_local_only.sql
│   │   │       ├── update_bets_payout_multiplier_to_decimal.sql
│   │   │       ├── update_payout_multiplier_to_decimal_simple.sql
│   │   │       └── update_payout_multiplier_to_decimal.sql
│   │   └── package.json
│   │
│   └── ui/                            # 共享 UI 组件包 (@flipcoin/ui)
│       └── package.json               # （预留，未来可共享 UI 组件）
│
├── services/                          # 服务目录
│   └── wallet/                        # 钱包服务 (@flipcoin/service-wallet)
│       └── package.json               # 🛡️ 高安全区域（预留，未来可独立部署）
│
├── nginx/                             # Nginx 配置
│   ├── default.conf                   # Nginx 默认配置（路由规则）
│   ├── nginx.conf                     # Nginx 主配置
│   ├── docker-entrypoint.sh          # Docker 入口脚本
│   └── Dockerfile                     # Nginx Dockerfile
│
├── modules/                           # 旧版前端模块（已弃用，保留用于兼容）
│   ├── api.js                         # 旧版 API 模块
│   ├── auth.js                        # 旧版认证模块
│   ├── game.js                        # 旧版游戏模块
│   ├── history.js                     # 旧版历史模块
│   ├── leaderboard.js                 # 旧版排行榜模块
│   ├── notify.js                      # 旧版通知模块
│   ├── socket.js                      # 旧版 Socket.IO 模块
│   ├── state.js                       # 旧版状态管理模块
│   ├── ui.js                          # 旧版 UI 模块
│   └── wallet.js                      # 旧版钱包模块
│
├── docker-compose.yml                 # Docker Compose 配置
│
├── init.sql                           # 🗄️ 数据库初始化脚本（v2.0 统一架构）
│                                      #   - 包含所有表结构定义（26 张表）
│                                      #   - 整合了所有历史迁移的最终状态
│                                      #   - 支持小数派彩倍数（DECIMAL）
│                                      #   - 支持连胜倍数系统（streak_multipliers）
│                                      #   - 包含 RBAC 权限系统、Guardian 风控
│
├── prisma.schema                      # 📄 数据库架构文档（Prisma Schema）
│                                      #   - 仅用于文档目的，帮助 AI 理解数据库结构
│                                      #   - 与 init.sql 保持 100% 同步
│
├── check-wallet-config.sql            # 🔧 运维工具：钱包配置诊断脚本
├── fix-wallet-config.sql              # 🔧 运维工具：钱包配置修复脚本
├── dry-run-validation.sql             # ✅ 测试工具：架构验证脚本
│
├── pnpm-workspace.yaml                # pnpm workspace 配置
├── turbo.json                         # Turbo 构建配置
├── package.json                       # 根 package.json（Monorepo 配置）
├── PROJECT_CONSTITUTION.md            # 项目开发宪法（开发规范）
├── DATABASE_MIGRATION_SUMMARY.md      # 📊 数据库迁移整合详细报告
├── MIGRATION_QUICK_GUIDE.md           # 📋 数据库迁移快速指南
├── COMPLETED_CHECKLIST.md             # ✅ 整合完成清单
└── CHANGELOG.md                       # 变更日志
```

## 🏗️ 技术栈

### 后端
- **Node.js 18+** - 运行环境
- **Express 5** - Web 框架
- **PostgreSQL 14+** - 关系型数据库
- **Socket.IO 4** - 实时通信（WebSocket）
- **Passport.js** - 身份验证中间件（JWT、Local Strategy）
- **TronWeb** - TRON 区块链交互
- **ethers.js 6** - EVM 区块链交互（BSC、ETH、Polygon）
- **bcryptjs** - 密码加密
- **jsonwebtoken** - JWT Token 生成和验证
- **speakeasy** - Google 二次验证（2FA）

### 前端 (Vue 3)
- **Vue 3** - 前端框架（Composition API）
- **Vue Router 4** - 路由管理
- **Pinia** - 状态管理（替代 Vuex）
- **Vite** - 构建工具
- **Tailwind CSS 3** - 样式框架
- **Socket.IO Client** - 实时通信客户端
- **vue-i18n** - 多语系支持
- **Element Plus** - UI 组件库（部分组件）
- **Notyf** - 通知系统
- **Axios** - HTTP 客户端

### 后台管理
- **Vue 3** - 前端框架
- **Vue Router 4** - 路由管理
- **Vuex** - 状态管理（权限管理）
- **Element Plus** - UI 组件库
- **ECharts** - 数据可视化
- **Axios** - HTTP 客户端

### 开发工具
- **pnpm** - 包管理器（workspace 模式）
- **Turbo** - Monorepo 构建工具
- **Docker & Docker Compose** - 容器化部署
- **Nginx** - 反向代理和静态文件服务

## 📁 核心功能模块

### 游戏功能
- ✅ **Flip Coin 投注游戏** - 用户可选择正面或反面进行投注
- ✅ **实时开奖** - 链上开奖，确保公平透明
- ✅ **连胜记录** - 记录用户连胜次数和最高连胜
- ✅ **排行榜** - 实时显示投注金额排行榜
- ✅ **投注历史** - 用户可查看所有投注记录

### 钱包功能
- ✅ **多链支持** - TRC20、BSC、ETH、Polygon、Solana（预留）
- ✅ **HD 钱包地址分配** - 用户注册时自动分配唯一充值地址
- ✅ **自动充值监听** - TRON 链每 10 秒轮询监听用户充值
- ✅ **自动归集** - Approve + TransferFrom 双签名归集模式
- ✅ **自动出款** - TRC20-USDT 自动出款（可配置阈值）
- ✅ **充值/提款历史** - 完整的交易记录查询
- ✅ **提款密码保护** - 提款需验证密码

### 后台管理
- ✅ **用户管理** - 用户列表、信息更新、状态管理、充值地址查询
- ✅ **投注管理** - 投注列表、盈亏报表
- ✅ **财务管理** - 充值记录、提现审核（Guardian风控增强）、账变记录、地址黑名单管理
- ✅ **钱包管理** - 平台钱包 CRUD、钱包监控
- ✅ **游戏管理** - 游戏列表、游戏参数设置
- ✅ **风控管理** - 同 IP 监控、IP 封禁、Guardian 提现风控（勝率检测、投注数检测、关联账户分析）
- ✅ **系统设置** - 游戏参数、用户等级、多语系、地区屏蔽、风控参数
- ✅ **管理员管理** - 账号管理、权限管理、IP 白名单、审计日志
- ✅ **实时仪表板** - 统计数据、在线用户

## 💰 用户金流流程

### 1. 钱包地址分配机制

#### 1.1 分配方式
- **技术实现**: 使用 HD (Hierarchical Deterministic) 钱包派生
- **主密钥**: 从 `MASTER_MNEMONIC` (环境变量) 派生所有子钱包
- **派生路径**:
  - EVM 链 (BSC/ETH/Polygon): `m/44'/60'/0'/0/{index}`
  - TRON 链: `m/44'/195'/0'/0/{index}`

#### 1.2 索引分配规则
- **平台保留索引**: 0-999999 (索引 0-999999 保留给平台内部使用)
- **用户起始索引**: 从环境变量 `WALLET_START_INDEX` 读取（默认 1000000）
- **分配逻辑**: 
  - 注册时调用 `KmsService.getNewDepositWallets()`
  - 使用 `SELECT ... FOR UPDATE NOWAIT` 确保并发安全
  - 查询数据库中 `deposit_path_index` 的最大值
  - 新索引 = `MAX(最大索引 + 1, WALLET_START_INDEX)`
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
1. **Guardian 风控检查**: 未被风控系统拦截（勝率正常、投注数充足、不在黑名单）
2. **系统设置**: `AUTO_WITHDRAW_THRESHOLD > 0` (在 `system_settings` 表中配置)
3. **金额限制**: 提款金额 <= `AUTO_WITHDRAW_THRESHOLD`
4. **链类型**: `chain_type = 'TRC20'` (目前仅支持 TRC20)
5. **服务就绪**: `PayoutService` 已初始化且钱包已加载

#### 4.3 出款流程
1. **用户提交提款请求**:
   - 验证提款密码
   - 检查余额是否充足
   - **Guardian 风控评估** (自动执行):
     - 检查地址黑名单
     - 计算用户勝率和投注数
     - 检查关联账户（IP、设备ID）
     - 生成风险指标
   - 扣除用户余额
   - 创建 `withdrawals` 记录

2. **判断是否自动出款**:
   - 风控拦截 → `status = 'pending'`，记录风控原因，等待人工审核
   - 金额超过阈值 → `status = 'pending'`，等待人工审核
   - 符合所有条件 → `status = 'processing'`，异步执行链上出款

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

## 🎖️ 用户等级机制

### 1. 等级系统概述

用户等级系统通过实时累加模式追踪用户的有效投注，当用户达到升级条件时自动升级并发放奖励。系统采用**累加器模式**而非按需计算，确保高性能和实时性。

### 2. 数据库结构

#### 2.1 用户表字段 (`users`)
- `level` (INT, DEFAULT 1): 用户当前等级
- `total_valid_bet_amount` (NUMERIC(20,6), DEFAULT 0): **累计有效投注金额**（用于升级计算）
- `last_level_up_time` (TIMESTAMP): 最后升级时间

#### 2.2 等级配置表 (`user_levels`)
- `level` (INT, PRIMARY KEY): 等级编号（从 1 开始）
- `name` (VARCHAR(50)): 等级名称（如 "VIP 1"、"新手"）
- `required_total_bet_amount` (NUMERIC(20,6)): **达到此等级所需的最小总投注金额（累计，USDT）**
- `min_bet_amount_for_upgrade` (NUMERIC(20,6)): **单个投注的有效性阈值**（用于过滤垃圾投注，与升级目标分离）
- `upgrade_reward_amount` (NUMERIC(20,6)): 达到此等级时的奖励金额（USDT）

**重要说明**：
- `min_bet_amount_for_upgrade`: 用于**过滤单个投注**（只有金额 >= 此值的投注才计入累加器）
- `required_total_bet_amount`: 用于**判断累计值**（用户累计总投注金额是否达到升级目标）
- 升级条件**仅基于累计投注金额**，简化了原有的"同时满足投注数量和金额"的复杂逻辑

### 3. 投注结算与累加流程

#### 3.1 累加触发时机
- **服务**: `BetQueueService.js` 和 `PendingBetProcessor.js`
- **触发条件**: 投注结算时（`status` 更新为 `'won'` 或 `'lost'`）
- **执行位置**: 在更新余额后、检查升级前，同一事务中执行

#### 3.2 有效性判断
1. 获取用户当前等级的 `min_bet_amount_for_upgrade` 值
2. 判断投注金额是否 >= 阈值
3. 如果满足条件，累加 `total_valid_bet_amount`

**代码示例**：
```javascript
// 获取用户当前等级配置
const levelResult = await client.query(
    'SELECT min_bet_amount_for_upgrade FROM user_levels WHERE level = (SELECT level FROM users WHERE user_id = $1)',
    [userId]
);
const minValidBetAmount = parseFloat(levelResult.rows[0].min_bet_amount_for_upgrade) || 0;

// 只有金额 >= 阈值的投注才计入累加器
if (betAmount >= minValidBetAmount) {
    await client.query(
        `UPDATE users 
         SET total_valid_bet_amount = total_valid_bet_amount + $1
         WHERE user_id = $2`,
        [betAmount, userId]
    );
}
```

### 4. 等级升级检查流程

#### 4.1 检查时机
- **服务**: `UserService.checkAndUpgradeUserLevel()`
- **触发时机**: 每次投注结算后（在累加统计之后）
- **执行位置**: 在同一事务中，确保数据一致性

#### 4.2 升级条件判断
1. **获取用户当前等级**和等级配置
2. **检查是否为最高级**:
   - 如果 `required_total_bet_amount = 0`，表示最高级，直接返回
3. **获取下一级配置**:
   - 下一级 = 当前等级 + 1
   - 如果下一级配置不存在，表示当前是最高级
4. **获取用户累计值**:
   - 从 `users` 表读取 `total_valid_bet_amount`
   - **不再使用 COUNT(*) 查询**，直接使用累加字段
5. **判断是否满足升级条件**:
   - **仅检查累计投注金额**：`total_valid_bet_amount >= next_level.required_total_bet_amount`

#### 4.3 升级执行流程
1. **获取行锁**: 使用 `SELECT ... FOR UPDATE NOWAIT` 确保并发安全
2. **更新用户等级**:
   - 更新 `users.level = next_level`
   - 更新 `users.last_level_up_time = NOW()`
3. **发放奖励**（如果有）:
   - 如果 `upgrade_reward_amount > 0`:
     - 更新 `users.balance = balance + reward_amount`
     - 记录账变到 `balance_changes` 表（类型: `level_up_reward`）
4. **记录日志**: 记录升级日志到控制台

**代码示例**：
```javascript
// 检查升级条件
if (totalValidBetAmount >= nextRequiredTotalAmount && 
    totalValidBetCount >= nextRequiredBets) {
    // 执行升级
    await processLevelUpgrade(userId, currentLevel, nextLevelConfig, client);
}
```

### 5. 等级配置管理

#### 5.1 管理界面
- **位置**: 后台管理 → 系统设置 → 用户等级 (`apps/admin/src/views/settings/UserLevels.vue`)
- **功能**:
  - 查看所有等级配置
  - 新增等级（必须从 1 开始连续设定）
  - 编辑等级配置
  - 删除等级（Level 1 不可删除）

#### 5.2 配置字段说明
- **条件：最小总投注金额（累计，USDT）**: `required_total_bet_amount`
  - 达到此等级所需的最小总投注金额（累计，USDT）
  - Level 1 必须为 0
- **投注有效性阈值（单次，USDT）**: `min_bet_amount_for_upgrade`
  - 单个投注的有效性阈值（用于过滤垃圾投注）
  - 只有金额 >= 此值的投注才会计入累加器
  - 设为 0 表示不限制
- **奖励：升级奖励（USDT）**: `upgrade_reward_amount`
  - 用户达到此等级时获得的奖励（USDT）

#### 5.3 验证规则
- Level 1 的 `required_total_bet_amount` 必须为 0（默认等级）
- 等级必须从 1 开始连续设定（不能跳过等级）
- 所有金额字段必须 >= 0

### 6. 数据迁移与回填

#### 6.1 架构整合状态
> **注意**: 所有历史迁移已整合到 `init.sql` v2.0 中。以下变更已包含在最新架构中：

- ✅ **等级系统累加器**（已整合）
  - `users.total_valid_bet_amount` - 累计有效投注金额
  - `user_levels.required_total_bet_amount` - 升级所需累计投注额
  - 历史文件：`packages/database/migrations/archive_v1/add_user_level_accumulators.sql`

- ✅ **等级系统重构**（已整合）
  - 已移除 `user_levels.max_bet_amount`（投注限额）
  - 已移除 `user_levels.required_bets_for_upgrade`（最小投注数量）
  - 已移除 `users.total_valid_bet_count`（累加器字段）
  - 历史文件：`packages/database/migrations/archive_v1/remove_bet_count_and_max_bet_limit.sql`

#### 6.2 简化后的逻辑
- **升级触发**: 仅基于 `total_valid_bet_amount`，无需再检查投注数量
- **性能优化**: 减少了累加器字段和检查条件，降低了数据库负载
- **业务逻辑**: 更符合实际业务需求（VIP 升级通常只看流水，不看次数）

### 7. 性能优化

#### 7.1 累加器模式
- **优势**: 从按需计算（每次 COUNT(*) 查询）改为实时累加，大幅提升性能
- **实现**: 在投注结算时实时累加 `total_valid_bet_amount`，升级检查时直接读取

#### 7.2 简化后的优势
- **减少字段**: 移除 `total_valid_bet_count` 累加器，减少每次结算的写入操作
- **减少检查**: 升级条件从"双重判断"简化为"单一判断"，降低 CPU 开销
- **索引优化**: 在 `users.total_valid_bet_amount` 上创建索引，优化升级检查查询

#### 7.3 事务安全
- 所有累加和升级操作在同一事务中执行，确保数据一致性
- 使用数据库行锁（`FOR UPDATE NOWAIT`）防止并发问题

### 8. 账变记录

#### 8.1 升级奖励记录
- **表**: `balance_changes`
- **类型**: `level_up_reward`
- **记录内容**:
  - `user_id`: 用户ID
  - `change_type`: `'level_up_reward'`
  - `amount`: 奖励金额（正数）
  - `balance_after`: 奖励后余额
  - `remark`: `"Level {level} Upgrade Reward"`

### 9. 注意事项

1. **Level 1 配置**: Level 1 是默认等级，所有新用户初始等级为 1，Level 1 的 `required_total_bet_amount` 必须为 0
2. **字段保留**: `min_bet_amount_for_upgrade` 字段必须保留，用于过滤垃圾投注（单次投注的有效性阈值）
3. **升级逻辑**: 升级条件已简化为仅检查累计投注金额，不再检查投注数量
2. **字段分离**: `min_bet_amount_for_upgrade`（单个投注阈值）和 `required_total_bet_amount`（累计升级目标）完全独立，不要混淆
3. **并发安全**: 升级检查使用行锁确保并发安全，如果获取锁失败会记录警告但不阻止主流程
4. **数据一致性**: 所有累加和升级操作在同一事务中执行，确保数据一致性
5. **回填性能**: 对于大数据集，回填脚本使用 CTE + UPDATE FROM 优化，避免相关子查询的性能问题

## 🔒 安全特性

- ✅ **IP 白名单** - 后台管理需通过 IP 白名单验证
- ✅ **速率限制** - 注册、登录、提款接口限流
- ✅ **密码加密** - 使用 bcrypt 加密存储密码
- ✅ **JWT 身份验证** - 无状态 Token 认证
- ✅ **谷歌二次验证（2FA）** - 管理员可启用 Google Authenticator
- ✅ **Guardian 提现风控系统** - Casino-Grade 风控体系
  - 自动勝率检测（可配置閾值）
  - 投注数检测（过滤刷水用户）
  - 地址黑名单管理（软拦截）
  - 关联账户分析（IP、设备ID）
  - 完整风险分析报告
  - 拒绝并冻结功能
- ✅ **同 IP 风控** - 同 IP 用户检测、自动/手动封禁
- ✅ **审计日志** - 所有关键操作记录审计日志
- ✅ **敏感数据脱敏** - 地址、交易哈希在日志中脱敏
- ✅ **API 响应标准化** - 统一错误处理，不暴露内部错误
- ✅ **输入验证** - 注册、登录、提款等接口输入验证
- ✅ **并发控制** - 用户注册时的索引分配使用数据库行锁

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

---

## 🗄️ 数据库架构统一整合（v2.0）

**整合日期**: 2026-01-29  
**状态**: ✅ 已完成并通过验证

### 📋 整合概述

为了简化数据库初始化和维护，我们将所有历史数据库迁移整合到单一的 `init.sql` 文件中。

### 🎯 整合成果

| 项目 | 说明 |
|-----|------|
| **统一初始化** | `init.sql` 现在是唯一的数据库架构定义 |
| **历史归档** | 23 个历史迁移文件已归档到 `packages/database/migrations/archive_v1/` |
| **文档同步** | `prisma.schema` 与 init.sql 保持 100% 同步 |
| **测试验证** | 通过 Docker Dry Run 测试，100% 通过所有验证 |

### 📂 文件说明

#### 核心文件

```
📁 根目录
├── init.sql                          ✅ 统一初始化脚本（v2.0）
│                                        - 26 张表的完整定义
│                                        - 支持小数派彩倍数
│                                        - 支持连胜倍数系统
│                                        - Guardian 风控系统
│
├── prisma.schema                     📄 架构文档（与 init.sql 同步）
│
├── check-wallet-config.sql           🔧 钱包配置诊断工具
├── fix-wallet-config.sql             🔧 钱包配置修复工具
└── dry-run-validation.sql            ✅ 架构验证测试脚本
```

#### 历史归档

```
📁 packages/database/migrations/
└── archive_v1/                       📦 历史迁移归档（23 个文件）
    ├── add_streak_multipliers.sql       # 连胜倍数系统
    ├── add_withdrawal_risk_control.sql  # Guardian 风控
    ├── fix_payout_multiplier_type.sql   # 小数派彩倍数
    └── ... （其他 20 个文件）
```

### ✨ 关键特性

#### 1. 小数派彩倍数支持
```sql
-- bets 和 games 表现在支持小数倍数
payout_multiplier DECIMAL(10, 2)  -- 例如：1.95, 2.5, 3.0
```

#### 2. 连胜倍数系统
```sql
-- games 表支持连胜模式多赔率设定
streak_multipliers JSONB  -- 格式：{"0": 2.0, "1": 2.5, "2": 3.0, ...}
```

#### 3. Guardian 风控系统
- 提款地址黑名单（`withdrawal_address_blacklist`）
- 勝率检测阈值（`risk_max_win_rate_percent`）
- 最小投注数检测（`risk_min_bet_count`）

#### 4. 账变记录系统
```sql
-- 完整记录所有余额变动
balance_changes 表（记录充值、提款、下注、派奖等）
```

### 🚀 使用指南

#### 全新部署
```bash
# Docker Compose 会自动执行 init.sql
docker-compose up -d
```

#### 测试验证
```bash
# 在临时容器中测试 init.sql
./test-init-sql.sh

# 验证现有数据库架构
psql -U game_user -d flipcoin_db -f dry-run-validation.sql
```

#### 未来新迁移
当需要新增数据库变更时：
1. 修改 `init.sql`（添加最终状态）
2. 创建新的迁移文件到 `packages/database/migrations/`
3. 更新 `prisma.schema`
4. 测试验证

### 📚 详细文档

- 📊 [完整报告](./DATABASE_MIGRATION_SUMMARY.md) - 详细的整合报告
- 📋 [快速指南](./MIGRATION_QUICK_GUIDE.md) - 快速参考指南
- ✅ [完成清单](./COMPLETED_CHECKLIST.md) - 验证清单

---

## 🚀 快速开始

### 前置要求

- **Docker & Docker Compose** - 容器化部署
- **Node.js 18+** - 开发模式需要
- **pnpm 8+** - 包管理器
- **PostgreSQL 14+** - 数据库（或使用 Docker）

### 启动项目

```bash
# 1. 克隆项目
git clone <repository-url>
cd flip_coin

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入必要的配置：
# - MASTER_MNEMONIC: HD 钱包主密钥（必须保密）
# - JWT_SECRET: JWT 密钥
# - DATABASE_URL: 数据库连接字符串
# - NILE_LISTENER_HOST: TRON 节点地址
# - WALLET_START_INDEX: 用户钱包起始索引（默认 1000000）

# 4. 启动所有服务
docker-compose up -d

# 5. 查看日志
docker-compose logs -f
```

### 访问地址

- **前端**: http://localhost:8080
- **后台管理**: http://localhost:8080/admin
- **API**: http://localhost:8080/api/v1
- **数据库**: localhost:5432

## 🔧 开发模式

### 前端开发

```bash
cd apps/web
pnpm install
pnpm dev
```

前端将在 `http://localhost:5173` 启动（Vite 默认端口）

### 后台管理开发

```bash
cd apps/admin
pnpm install
pnpm serve
```

后台管理将在 `http://localhost:8081` 启动（Vue CLI 默认端口）

### 后端开发

```bash
cd apps/backend-legacy
pnpm install
pnpm start
```

后端将在 `http://localhost:3000` 启动

### 数据库迁移

> **注意**: 数据库架构已统一整合到 `init.sql` v2.0（2026-01-29）。历史迁移已归档。

#### 全新部署
```bash
# Docker Compose 会自动执行 init.sql 初始化
docker-compose up -d

# 验证架构
./test-init-sql.sh
```

#### 未来新迁移（如需要）
```bash
# 1. 创建新的迁移文件
vim packages/database/migrations/new_feature.sql

# 2. 在开发环境测试
docker exec -i flipcoin-db psql -U game_user -d flipcoin_db < packages/database/migrations/new_feature.sql

# 3. 更新 init.sql（添加最终状态）
# 4. 更新 prisma.schema
# 5. 运行验证测试
./test-init-sql.sh
```

#### 使用 Node.js 脚本（传统方式，仅供参考）
```bash
cd apps/backend-legacy
node scripts/run-migration.js <migration-file.sql>
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

- [项目宪法](./PROJECT_CONSTITUTION.md) - 开发规范（最高等级开发规范）
- [变更日志](./CHANGELOG.md) - 版本变更记录
- [测试文档](./apps/backend-legacy/tests/README.md) - 自动化测试说明
- [Guardian 部署指南](./GUARDIAN_DEPLOYMENT_GUIDE.md) - Guardian 风控系统部署和使用指南
- [Guardian 代码变更](./GUARDIAN_CODE_CHANGES.md) - Guardian 风控系统代码变更详情
- [Guardian 实施总结](./GUARDIAN_IMPLEMENTATION_SUMMARY.md) - Guardian 风控系统实施完成报告

## ⚠️ 注意事项

1. **环境变量**: 确保正确配置 `.env` 文件
   - `MASTER_MNEMONIC`: HD 钱包主密钥（必须保密，丢失将无法恢复用户地址）
   - `JWT_SECRET`: JWT 密钥（生产环境必须使用强随机字符串）
   - `DATABASE_URL`: 数据库连接字符串
   - `NILE_LISTENER_HOST`: TRON 节点地址（测试网或主网）
   - `WALLET_START_INDEX`: 用户钱包起始索引（默认 1000000，不要硬编码）

2. **数据库**: 首次启动会自动执行 `init.sql` 初始化数据库

3. **端口**: 默认使用 8080 端口，可在 `.env` 中修改 `NGINX_PORT`

4. **生产环境**: 部署前请修改默认密码和密钥

5. **并发注册**: 系统已实现并发控制（数据库行锁），但高并发场景下仍建议使用负载均衡

6. **能量管理**: 归集钱包需要足够的能量，建议监控能量余额并设置告警

7. **出款钱包**: 出款钱包需要足够的 TRX 作为 Gas，建议监控 TRX 余额

8. **旧版文件**: 根目录下的 `index.html`、`app.js`、`style.css`、`modules/` 是旧版前端文件，已弃用但保留用于兼容，新开发请使用 `apps/web`

## 🔄 重构历史

### 主要重构内容

1. **API 响应标准化**: 所有 API 统一使用 `{ success: true, data: ... }` 格式
2. **路由模块化**: 
   - `server.js` 路由拆分 → `routes/v1/` (前台 API)
   - `admin.js` 路由拆分 → `routes/admin/` (后台 API)
3. **服务层抽象**: 创建 `UserService`、`AdminService`、`GameService`、`WithdrawalService`
4. **前台 API 适配**: 修复所有前台 API 响应处理，适配标准格式
5. **充值地址显示**: 修复字段名匹配问题（`tron_deposit_address`、`evm_deposit_address`）
6. **并发控制**: 实现用户注册时的索引分配并发控制（`SELECT ... FOR UPDATE NOWAIT`）
7. **区块同步**: 实现区块高度持久化（`blockchain_sync_status` 表）
8. **归集重试**: 实现归集失败重试机制（`collection_retry_queue` 表）
9. **前端重构**: 从旧版单文件架构重构为 Vue 3 SPA 架构
10. **Monorepo 架构**: 使用 pnpm workspace 管理多个应用和包

详细变更记录请参考 [CHANGELOG.md](./CHANGELOG.md)

## 📦 模块依赖概览

> **说明**: 此部分用于帮助 AI 理解项目各模块的依赖关系和技术栈，实际开发请参考各模块的 `package.json` 文件。

### 根目录 (Monorepo 配置)

**文件**: `package.json`

```json
{
  "name": "flip-coin-monorepo",
  "version": "1.0.0",
  "workspaces": ["apps/*", "packages/*", "services/*"],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "^2.0.0"
  },
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  }
}
```

**说明**: 
- 使用 pnpm workspace 管理 Monorepo
- 使用 Turbo 进行构建优化
- 要求 Node.js 18+ 和 pnpm 8+

---

### 后端服务 (`apps/backend-legacy`)

**包名**: `@flipcoin/backend-legacy`

**核心依赖**:
- `express: ^5.1.0` - Web 框架
- `pg: ^8.16.3` - PostgreSQL 客户端
- `socket.io: ^4.7.2` - WebSocket 实时通信
- `passport: ^0.7.0` + `passport-jwt: ^4.0.1` + `passport-local: ^1.0.0` - 身份验证
- `jsonwebtoken: ^9.0.2` - JWT Token 生成
- `bcryptjs: ^3.0.2` - 密码加密
- `tronweb: ^5.3.2` - TRON 区块链交互
- `ethers: ^6.7.0` - EVM 区块链交互 (BSC/ETH/Polygon)
- `bip39: ^3.1.0` + `hdkey: ^2.0.1` - HD 钱包派生
- `speakeasy: ^2.0.0` - Google 二次验证 (2FA)
- `qrcode: ^1.5.4` - 二维码生成
- `nanoid: ^3.3.4` - 唯一 ID 生成
- `cors: ^2.8.5` - CORS 中间件
- `dotenv: ^16.3.1` - 环境变量管理
- `http-proxy-middleware: ^3.0.5` - HTTP 代理中间件
- `@flipcoin/database: workspace:*` - 数据库连接包（内部依赖）

**说明**:
- 主服务器入口: `server.js`
- 支持多链区块链交互（TRON、EVM 链）
- 使用 HD 钱包管理用户充值地址
- 实现完整的 RBAC 权限系统

---

### 前端应用 (`apps/web`)

**包名**: `@flipcoin/web`

**核心依赖**:
- `vue: ^3.2.13` - Vue 3 框架（Composition API）
- `vue-router: ^4.0.3` - 路由管理
- `vue-i18n: ^9.9.1` - 多语系支持
- `axios: ^1.7.2` - HTTP 客户端
- `socket.io-client: ^4.7.2` - WebSocket 客户端
- `element-plus: ^2.7.7` - UI 组件库
- `@element-plus/icons-vue: ^2.3.2` - Element Plus 图标
- `notyf: ^3.10.0` - 通知系统

**开发依赖**:
- `vite: ^5.0.0` - 构建工具
- `@vitejs/plugin-vue: ^4.5.0` - Vite Vue 插件
- `tailwindcss: ^3.4.18` - CSS 框架
- `postcss: ^8.5.6` + `autoprefixer: ^10.4.22` - CSS 处理

**说明**:
- 使用 Vite 作为构建工具
- 使用 Tailwind CSS 进行样式管理
- 使用 Composition API 编写组件
- 支持多语系（繁体中文、简体中文、英文）

---

### 后台管理 (`apps/admin`)

**包名**: `@flipcoin/admin`

**核心依赖**:
- `vue: ^3.2.13` - Vue 3 框架
- `vue-router: ^4.0.3` - 路由管理
- `element-plus: ^2.7.7` - UI 组件库
- `@element-plus/icons-vue: ^2.3.2` - Element Plus 图标
- `axios: ^1.7.2` - HTTP 客户端
- `echarts: ^6.0.0` - 数据可视化图表
- `jwt-decode: ^4.0.0` - JWT Token 解码
- `core-js: ^3.8.3` - JavaScript 兼容性库

**开发依赖**:
- `@vue/cli-service: ~5.0.0` - Vue CLI 服务
- `@vue/cli-plugin-babel: ~5.0.0` - Babel 插件
- `@vue/cli-plugin-router: ~5.0.0` - 路由插件

**说明**:
- 使用 Vue CLI 作为构建工具
- 使用 Element Plus 作为 UI 组件库
- 使用 ECharts 进行数据可视化
- 需要 IP 白名单验证才能访问

---

### 数据库包 (`packages/database`)

**包名**: `@flipcoin/database`

**核心依赖**:
- `pg: ^8.16.3` - PostgreSQL 客户端

**说明**:
- 提供数据库连接和迁移工具
- **数据库架构已统一整合**：
  - 主初始化脚本：`/init.sql`（v2.0，位于根目录）
  - 历史迁移已归档：`migrations/archive_v1/`（23 个文件）
  - `migrations/` 文件夹已清空，保留用于未来新迁移
- **架构文档**：`/prisma.schema`（与 init.sql 100% 同步）
- **运维工具**：根目录的 `check-wallet-config.sql`、`fix-wallet-config.sql`
- 被 `@flipcoin/backend-legacy` 引用

**数据库架构亮点**（v2.0）:
- ✅ 26 张表，包含完整的业务逻辑
- ✅ 支持小数派彩倍数（DECIMAL(10,2)）
- ✅ 支持连胜倍数系统（streak_multipliers JSONB）
- ✅ Guardian 风控系统（地址黑名单、勝率检测）
- ✅ 高精度金额字段（DECIMAL(20,6)）
- ✅ 完整的 RBAC 权限系统
- ✅ 账变记录系统（balance_changes）

---

### UI 组件包 (`packages/ui`)

**包名**: `@flipcoin/ui`

**核心依赖**: 无（预留）

**说明**:
- 预留用于共享 UI 组件和设计系统
- 目前为空，未来可共享组件库

---

### 钱包服务 (`services/wallet`)

**包名**: `@flipcoin/service-wallet`

**核心依赖**: 无（预留）

**说明**:
- 🛡️ **高安全区域**，预留用于独立部署的钱包服务
- 未来可通过 HTTP/gRPC 访问
- 物理隔离敏感的钱包操作逻辑

---

## 📄 许可证

[待补充]
