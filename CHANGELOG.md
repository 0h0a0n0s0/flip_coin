# 更新日志

本文档记录项目的重要版本更新和功能变更。

## 重构版本 (当前)

### 前端重构
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

