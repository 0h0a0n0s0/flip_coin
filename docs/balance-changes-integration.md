# 账变记录集成说明

## 概述

账变记录系统用于记录所有影响用户余额的操作。需要在所有余额变动的地方调用 `logBalanceChange` 函数来记录账变。

## 使用方式

### 1. 导入工具函数

```javascript
const { logBalanceChange, CHANGE_TYPES } = require('../utils/balanceChangeLogger');
```

### 2. 在余额变动后调用

在更新用户余额后，立即调用 `logBalanceChange` 函数：

```javascript
// 示例：充值
const newBalance = parseFloat(user.balance) + amount;
await db.query(
    'UPDATE users SET balance = $1 WHERE id = $2 RETURNING *',
    [newBalance, user.id]
);

// 记录账变
await logBalanceChange({
    user_id: user.user_id,
    change_type: CHANGE_TYPES.DEPOSIT,
    amount: amount,  // 正数
    balance_after: newBalance,
    remark: `充值 ${amount} USDT, TX Hash: ${txHash}`,
    client: client  // 如果使用事务，传入client
});
```

### 3. 账变类型常量

- `CHANGE_TYPES.DEPOSIT` - 充值
- `CHANGE_TYPES.WITHDRAWAL` - 提款
- `CHANGE_TYPES.BET` - 下注
- `CHANGE_TYPES.PAYOUT` - 派奖
- `CHANGE_TYPES.MANUAL_ADJUST` - 人工调整
- `CHANGE_TYPES.ACTIVITY_BONUS` - 活动奖金

## 需要添加账变记录的位置

### 1. 充值 (TronListener.js)
- 位置：`backend/services/TronListener.js`
- 类型：`CHANGE_TYPES.DEPOSIT`
- 金额：正数（增加）
- 说明：当检测到充值并更新用户余额时

### 2. 提款相关
- **拒绝提款退款** (`backend/routes/admin.js`)
  - 位置：`router.post('/withdrawals/:id/reject')`
  - 类型：`CHANGE_TYPES.WITHDRAWAL`
  - 金额：正数（退款给用户）
  
- **提款完成** (如果有自动提款功能)
  - 类型：`CHANGE_TYPES.WITHDRAWAL`
  - 金额：负数（减少）

### 3. 下注 (BetQueueService.js)
- 位置：`backend/services/BetQueueService.js`
- 类型：`CHANGE_TYPES.BET`
- 金额：负数（减少）
- 说明：当用户下注扣除余额时

### 4. 派奖
- **游戏派奖** (`backend/services/BetQueueService.js` 或 `PayoutService.js`)
  - 类型：`CHANGE_TYPES.PAYOUT`
  - 金额：正数（增加）
  
- **下注中奖** (`backend/services/BetQueueService.js`)
  - 类型：`CHANGE_TYPES.PAYOUT`
  - 金额：正数（奖金）

### 5. 人工调整 (admin.js)
- 位置：`backend/routes/admin.js` - `router.put('/users/:user_id')`
- 类型：`CHANGE_TYPES.MANUAL_ADJUST`
- 金额：正数或负数（根据调整方向）
- 说明：当管理员手动调整用户余额时

### 6. 活动奖金 (如果有)
- 类型：`CHANGE_TYPES.ACTIVITY_BONUS`
- 金额：正数（增加）

## 注意事项

1. **事务处理**：如果余额更新在事务中，需要传入 `client` 参数，确保账变记录也在同一事务中
2. **错误处理**：账变记录失败不应该影响主业务逻辑，但应该记录错误日志
3. **余额一致性**：`balance_after` 必须与更新后的用户余额一致
4. **备注信息**：建议在 `remark` 中包含相关的交易ID、Hash等信息，便于追踪

## 示例代码

### 在事务中使用

```javascript
const client = await db.pool.connect();
try {
    await client.query('BEGIN');
    
    // 更新余额
    const result = await client.query(
        'UPDATE users SET balance = balance + $1 WHERE user_id = $2 RETURNING *',
        [amount, user_id]
    );
    const updatedUser = result.rows[0];
    
    // 记录账变（传入client以在同一事务中）
    await logBalanceChange({
        user_id: user_id,
        change_type: CHANGE_TYPES.DEPOSIT,
        amount: amount,
        balance_after: parseFloat(updatedUser.balance),
        remark: `充值 ${amount} USDT`,
        client: client  // 重要：传入client
    });
    
    await client.query('COMMIT');
} catch (error) {
    await client.query('ROLLBACK');
    throw error;
} finally {
    client.release();
}
```

### 非事务中使用

```javascript
// 更新余额
const result = await db.query(
    'UPDATE users SET balance = balance - $1 WHERE user_id = $2 RETURNING *',
    [betAmount, user_id]
);
const updatedUser = result.rows[0];

// 记录账变
try {
    await logBalanceChange({
        user_id: user_id,
        change_type: CHANGE_TYPES.BET,
        amount: -betAmount,  // 负数表示减少
        balance_after: parseFloat(updatedUser.balance),
        remark: `下注 ${betAmount} USDT, 注单ID: ${betId}`
    });
} catch (error) {
    // 记录错误但不影响主流程
    console.error('Failed to log balance change:', error);
}
```

