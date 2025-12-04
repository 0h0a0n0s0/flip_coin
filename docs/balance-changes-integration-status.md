# 账变记录集成状态检查报告

## 检查时间
生成时间：2024

## 已集成账变记录的位置 ✅

### 1. 人工调整余额 ✅
- **文件**: `backend/routes/admin.js`
- **位置**: `router.put('/users/:id')` 
- **账变类型**: `manual_adjust`
- **状态**: ✅ 已集成
- **说明**: 管理员在后台手动调整用户余额时，会自动记录账变

## 未集成账变记录的位置 ❌

### 2. 充值到账 ❌
- **文件**: `backend/services/TronListener.js`
- **位置**: 约第426行，`UPDATE users SET balance = $1 WHERE id = $2`
- **账变类型**: `deposit`
- **状态**: ❌ 未集成
- **说明**: 当检测到充值交易并更新用户余额时，需要记录账变

### 3. 下注扣款 ❌
- **文件**: `backend/services/BetQueueService.js`
- **位置**: 约第99行，`UPDATE users SET balance = balance - $1 WHERE id = $2`
- **账变类型**: `bet`
- **状态**: ❌ 未集成
- **说明**: 用户下注时扣除余额，需要记录账变（负数）

### 4. 派奖 ❌
- **文件**: `backend/services/BetQueueService.js`
- **位置**: 约第166行，`UPDATE users SET balance = balance + $1 WHERE id = $2`（赢了时）
- **账变类型**: `payout`
- **状态**: ❌ 未集成
- **说明**: 用户下注中奖时增加余额，需要记录账变（正数）

### 5. 下注失败退款 ❌
- **文件**: `backend/services/BetQueueService.js`
- **位置**: 约第214行，`UPDATE users SET balance = balance + $1 WHERE user_id = $2`
- **账变类型**: `payout` 或 `bet`（退款）
- **状态**: ❌ 未集成
- **说明**: 下注处理失败时退款，需要记录账变

### 6. 提款扣款 ❌
- **文件**: `backend/server.js`
- **位置**: 约第741行，`UPDATE users SET balance = balance - $1 WHERE id = $2`
- **账变类型**: `withdrawal`
- **状态**: ❌ 未集成
- **说明**: 用户申请提款时扣除余额，需要记录账变（负数）

### 7. 提款拒绝退款 ❌
- **文件**: `backend/routes/admin.js`
- **位置**: 约第2348行，`UPDATE users SET balance = balance + $1 WHERE user_id = $2`
- **账变类型**: `withdrawal`
- **状态**: ❌ 未集成
- **说明**: 管理员拒绝提款时退款给用户，需要记录账变（正数）

## 集成优先级

### 高优先级（核心功能）
1. ✅ 人工调整余额 - 已完成
2. ⚠️ 充值到账 - 必须集成
3. ⚠️ 下注扣款 - 必须集成
4. ⚠️ 派奖 - 必须集成

### 中优先级（重要功能）
5. ⚠️ 提款扣款 - 建议集成
6. ⚠️ 提款拒绝退款 - 建议集成

### 低优先级（辅助功能）
7. ⚠️ 下注失败退款 - 可选集成

## 下一步行动

1. 按照优先级逐个集成账变记录功能
2. 确保每个余额变动操作都正确记录账变
3. 测试每个功能是否正常工作

