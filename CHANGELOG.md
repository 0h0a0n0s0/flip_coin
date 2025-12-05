# 更新日志

本文档记录项目的重要版本更新和功能变更。

## 重构版本 (当前)

### 前端重构 - 单页应用布局重构
- **单页应用架构**: 重构为单页应用（SPA）架构
  - 创建 MainLayout.vue 主布局组件，包含 Header、TopCategoryNav、LeftSidebar、Footer 等公共部分
  - 所有子界面（首页、游戏分类、游戏页面等）都在主内容区域（红框）内呈现
  - 移除了全页跳转，改为在内容区域切换视图
  - 使用嵌套路由结构，所有路由都在 MainLayout 下
- **页面组件简化**: 所有页面组件只包含内容部分
  - Home.vue：只包含首页内容（Hero Strip、Trending Games、Latest Wins）
  - HashGame.vue：只包含 Hash Game 分类内容
  - FlipCoinGamePage.vue：只包含 Flip Coin 游戏内容
  - 移除了所有页面中的布局元素（Header、Sidebar、Footer 等）
- **路由同步**: 实现了路由与侧边栏状态的自动同步
  - 路由变化时自动更新侧边栏 activeCategory
  - 侧边栏点击时自动跳转到对应路由

### 前端重构 - 游戏分类和首页重构
- **游戏分类系统**: 实现游戏分类浏览功能
  - 添加 Hash Game 分类，将 Flip Coin 游戏归类到该分类下
  - 创建 HashGame 分类页面（`/hash`）
  - 创建 FlipCoinGame 独立页面（`/hash/flip-coin`）
  - 在侧边栏菜单中添加 Hash Game 分类选项
- **首页重构**: 参考 v0_source 设计重构首页
  - 移除首页中的 FlipCoinGame 直接展示
  - 添加 TrendingGamesGrid 组件，展示热门游戏列表
  - 添加 SmallWinnerTicker 组件，展示实时中奖记录
  - 创建 CompactHeroStrip 组件，优化首页横幅设计
- **UI 组件创建**: 遵循 PROJECT_CONSTITUTION.md 规范创建新组件
  - GameCard 组件：符合 v0_source 风格的游戏卡片组件
  - SmallWinnerTicker 组件：实时显示玩家中奖信息
  - TrendingGamesGrid 组件：展示热门游戏网格
  - CompactHeroStrip 组件：紧凑型首页横幅
- **路由配置**: 添加新的页面路由
  - `/hash` - Hash Game 分类页面
  - `/hash/flip-coin` - Flip Coin 游戏页面
- **模块化拆分**: 将 `app.js` (1000+ 行) 拆分为多个模块
  - `modules/state.js`: 全局状态管理
  - `modules/auth.js`: 认证相关逻辑
  - `modules/game.js`: 游戏下注逻辑
  - `modules/ui.js`: UI 操作和 DOM 管理
  - `modules/wallet.js`: 钱包功能（充值、提款）
  - `modules/socket.js`: Socket.IO 连接管理
  - `modules/notify.js`: 统一通知系统
  - `modules/leaderboard.js`: 排行榜功能
- **统一通知系统**: 所有提示通过 `modules/notify.js`，禁止直接使用 `new Notyf()`
- **统一 API 请求**: 所有网络请求通过 `modules/api.js`，禁止使用裸 `fetch()`
- **修复命名不一致**: 统一 middleware 文件名大小写

### 后端重构（进行中）
- **修复命名问题**: `adminIpWhiteListMiddleware.js` → `adminIpWhitelistMiddleware.js`

### 代码清理
- 移除所有版本标记注释（v6/v7/v8/v9 等）
- 保留有意义的业务逻辑注释
- 创建 CHANGELOG.md 记录版本历史

## 历史版本

### v8.1 - 自动出款功能
- 实现自动出款功能
- 添加 PayoutService 服务
- 支持 TRC20 链自动出款

### v7.2 - 提款功能
- 添加提款请求功能
- 实现提款密码设置和修改
- 添加提款历史记录

### v7.0 - 充值功能
- 实现 TRC20 充值监听
- 添加充值历史记录
- 实现地址生成和管理

### v6.0 - 中心化认证
- 迁移到中心化认证系统
- 实现 JWT Token 认证
- 统一 API 路径为 `/api/v1/`

### v5.0 及更早版本
- 初始版本开发
- 基础游戏功能实现

---

**注意**: 详细的版本历史请查看 Git 提交记录。

