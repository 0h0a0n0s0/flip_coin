# 日志分析与优化建议

## 📋 问题概览

根据提供的日志，发现三个关键问题：

### 1. ⚠️ **数据库 Schema 不匹配** (CRITICAL)
**错误信息：**
```
error: column "last_processed_user_id" of relation "collection_cursor" does not exist
```

**根本原因：**
- `init.sql` 中的 `collection_cursor` 表使用**旧结构**：
  - `last_user_id VARCHAR(8)`
  - `last_processed_date DATE`
  - `collection_wallet_address VARCHAR(255)`
- 代码期望**新结构**（来自 `add_tron_system_upgrade.sql`）：
  - `last_processed_user_id BIGINT`
  - `updated_at TIMESTAMP`

**影响：**
- 归集服务无法启动
- 无法追踪归集进度
- 可能导致重复处理或遗漏

---

### 2. ⏱️ **API 超时问题** (HIGH)
**错误信息：**
```
AxiosError: timeout of 60000ms exceeded
at TronListener._getLatestBlockNumber
```

**根本原因：**
- 当前超时设置为 60 秒
- 网络延迟或 API 节点响应慢
- 缺少重试机制
- 错误处理不够健壮

**影响：**
- 区块扫描中断
- 可能错过充值交易
- 服务稳定性下降

---

### 3. ⚡ **能量租赁失败** (HIGH)
**错误信息：**
```
No available energy provider found for 350000 energy
```

**根本原因：**
- 能量提供者配置缺失或无效
- 能量提供者能量不足
- 私钥未正确配置（`TRON_PK_{address}`）
- 能量提供者未激活（`is_active = false`）

**影响：**
- 归集任务无法执行
- 资金无法归集到冷钱包
- 业务中断

---

## 🔧 优化方案

### 方案 1: 修复数据库 Schema 不匹配

#### 1.1 创建迁移脚本
需要创建一个迁移脚本，将旧的 `collection_cursor` 表结构升级为新结构。

**建议操作：**
```sql
-- 迁移 collection_cursor 表结构
-- 1. 备份旧数据（如果有）
CREATE TABLE IF NOT EXISTS collection_cursor_backup AS 
SELECT * FROM collection_cursor;

-- 2. 删除旧表
DROP TABLE IF EXISTS collection_cursor CASCADE;

-- 3. 创建新表结构（与 add_tron_system_upgrade.sql 一致）
CREATE TABLE collection_cursor (
    id SERIAL PRIMARY KEY,
    last_processed_user_id BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. 初始化游标
INSERT INTO collection_cursor (last_processed_user_id) VALUES (0);
```

#### 1.2 更新 init.sql
确保 `init.sql` 中的表结构与代码期望一致，或添加版本检查机制。

---

### 方案 2: 优化 TronListener 超时和重试机制

#### 2.1 增加重试逻辑
```javascript
async _getLatestBlockNumber(retryCount = 0, maxRetries = 3) {
    const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 10000); // 指数退避，最大 10 秒
    
    try {
        const response = await this.axiosInstance.post('wallet/getnowblock', {}, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 60000
        });
        // ... 处理响应
    } catch (error) {
        if (retryCount < maxRetries && (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')) {
            console.warn(`[TronListener] Timeout on attempt ${retryCount + 1}/${maxRetries}, retrying in ${backoffDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            return this._getLatestBlockNumber(retryCount + 1, maxRetries);
        }
        // 使用 TronWeb 作为备用方案
        return this._fallbackToTronWeb();
    }
}
```

#### 2.2 增加超时配置选项
```javascript
// 从环境变量读取超时配置
const API_TIMEOUT = parseInt(process.env.TRON_API_TIMEOUT || '60000');
const MAX_RETRIES = parseInt(process.env.TRON_API_MAX_RETRIES || '3');

this.axiosInstance = axios.create({
    baseURL: NILE_LISTENER_HOST,
    timeout: API_TIMEOUT,
    // ... 其他配置
});
```

#### 2.3 改进错误日志
```javascript
catch (error) {
    if (error.code === 'ECONNABORTED') {
        console.error(`[TronListener] Request timeout after ${API_TIMEOUT}ms`);
        console.error(`[TronListener] Endpoint: ${error.config?.url || 'unknown'}`);
        console.error(`[TronListener] Base URL: ${NILE_LISTENER_HOST}`);
    }
    // ... 其他错误处理
}
```

---

### 方案 3: 改进能量租赁错误处理

#### 3.1 增强错误诊断
```javascript
async findAvailableProvider(requiredEnergy) {
    try {
        const providers = await db.query(/* ... */);
        
        if (providers.rows.length === 0) {
            console.error(`[EnergyRental] ❌ No energy providers found in database.`);
            console.error(`[EnergyRental] Please check platform_wallets table for records with:`);
            console.error(`[EnergyRental]   - chain_type = 'TRC20'`);
            console.error(`[EnergyRental]   - is_energy_provider = true`);
            console.error(`[EnergyRental]   - is_active = true`);
            return null;
        }
        
        console.log(`[EnergyRental] Found ${providers.rows.length} energy provider(s)`);
        
        for (const provider of providers.rows) {
            // 检查私钥配置
            const pkEnvVar = `TRON_PK_${provider.address}`;
            const privateKey = process.env[pkEnvVar];
            
            if (!privateKey) {
                console.warn(`[EnergyRental] ⚠️ Provider ${provider.address} missing private key (${pkEnvVar})`);
                continue;
            }
            
            // ... 检查能量
            if (estimatedEnergy < requiredEnergy && availableEnergy < requiredEnergy) {
                console.warn(`[EnergyRental] Provider ${provider.address} insufficient energy:`);
                console.warn(`[EnergyRental]   Required: ${requiredEnergy}`);
                console.warn(`[EnergyRental]   Available: ${availableEnergy}`);
                console.warn(`[EnergyRental]   Estimated: ${estimatedEnergy}`);
                continue;
            }
            
            return { /* ... */ };
        }
        
        // 汇总所有提供者的状态
        console.error(`[EnergyRental] ❌ No provider has enough energy (required: ${requiredEnergy})`);
        console.error(`[EnergyRental] Provider summary:`);
        for (const provider of providers.rows) {
            console.error(`[EnergyRental]   - ${provider.address}: ${provider.current_staked_trx || 0} TRX staked`);
        }
        
        return null;
    } catch (error) {
        logError(error, 'Error finding available provider', 'N/A');
        throw error;
    }
}
```

#### 3.2 添加配置验证
```javascript
// 在服务启动时验证能量提供者配置
async validateEnergyProviders() {
    const providers = await db.query(/* ... */);
    
    if (providers.rows.length === 0) {
        throw new Error('CRITICAL: No energy providers configured! Please add at least one provider to platform_wallets.');
    }
    
    for (const provider of providers.rows) {
        const pkEnvVar = `TRON_PK_${provider.address}`;
        if (!process.env[pkEnvVar]) {
            throw new Error(`CRITICAL: Energy provider ${provider.address} missing private key in .env (${pkEnvVar})`);
        }
    }
    
    console.log(`✅ [EnergyRental] Validated ${providers.rows.length} energy provider(s)`);
}
```

#### 3.3 改进错误消息
```javascript
catch (rentalError) {
    const errorMessage = rentalError.message || 'Unknown error';
    
    // 更详细的错误信息
    let detailedMessage = `能量租賃失敗！\n\n`;
    detailedMessage += `歸集錢包: ${this.collectionWallet.address}\n`;
    detailedMessage += `當前能量: ${currentEnergy}\n`;
    detailedMessage += `所需能量: ${requiredEnergy}\n`;
    detailedMessage += `能量缺口: ${requiredEnergy - currentEnergy}\n`;
    detailedMessage += `錯誤: ${errorMessage}\n\n`;
    
    // 添加诊断信息
    if (errorMessage.includes('No available energy provider')) {
        detailedMessage += `診斷建議：\n`;
        detailedMessage += `1. 檢查 platform_wallets 表中是否有 is_energy_provider=true 的記錄\n`;
        detailedMessage += `2. 確認能量提供者的私鑰已配置在 .env 中（格式：TRON_PK_{address}）\n`;
        detailedMessage += `3. 確認能量提供者已激活（is_active=true）\n`;
        detailedMessage += `4. 檢查能量提供者的能量是否足夠（至少 ${requiredEnergy}）\n`;
    }
    
    await this.alertService.sendCritical(detailedMessage);
}
```

---

## 📊 优先级建议

### 🔴 **立即修复（Critical）**
1. **数据库 Schema 不匹配** - 阻止归集服务运行
2. **能量提供者配置验证** - 确保服务启动前配置正确

### 🟡 **尽快优化（High）**
3. **API 超时重试机制** - 提高服务稳定性
4. **能量租赁错误诊断** - 便于问题排查

### 🟢 **持续改进（Medium）**
5. **监控和告警增强** - 提前发现问题
6. **日志结构化** - 便于日志分析

---

## 🔍 检查清单

在应用优化前，请确认：

- [ ] 数据库迁移脚本已执行（`add_tron_system_upgrade.sql`）
- [ ] `collection_cursor` 表结构正确（包含 `last_processed_user_id`）
- [ ] `platform_wallets` 表中有能量提供者记录
- [ ] 能量提供者的私钥已配置在 `.env` 中
- [ ] 能量提供者已激活（`is_active = true`）
- [ ] `NILE_LISTENER_HOST` 和 `NILE_NODE_HOST` 配置正确
- [ ] 网络连接正常，可以访问 TRON 节点

---

## 📝 后续建议

1. **添加健康检查端点**：定期检查能量提供者状态
2. **实现自动故障转移**：多个能量提供者时自动切换
3. **监控仪表板**：实时显示能量使用情况
4. **告警规则优化**：避免重复告警，但确保关键问题及时通知
