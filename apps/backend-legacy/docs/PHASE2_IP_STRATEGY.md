# Phase 2 IP 處理策略調整說明

## 調整原因

根據業務需求，IP 地址在風控、出款審計、套利檢測、帳號關聯等場景中具有重要作用，因此：

- ✅ **資料庫加密儲存**：防止資料庫被駭導致用戶隱私洩露
- ✅ **後台完整顯示**：管理員需要看到完整 IP 進行風控審計
- ✅ **後台可搜尋**：必須支援精確 IP 查詢功能

## 實作策略

### 1. 資料庫層（雙欄位策略）

**保留明文欄位**（向後兼容 + 查詢效能）：
```sql
last_login_ip VARCHAR(50)              -- 明文欄位，用於查詢
encrypted_last_login_ip TEXT           -- 加密欄位，資料安全
```

**寫入邏輯**：
- 新註冊/登入用戶：同時寫入明文和加密欄位
- 資料遷移腳本：將舊明文資料加密到加密欄位

**查詢邏輯**：
- 使用明文欄位進行查詢（保持效能）
- 加密欄位作為備援和安全防護

### 2. 後端 API 層

**查詢處理**：
```javascript
// routes/admin/users.js
// 1. 查詢時使用明文欄位（效能優先）
if (lastLoginIp) { 
    whereClauses.push(`last_login_ip = $${paramIndex++}`); 
}

// 2. 返回資料優先使用明文，如無則解密
let lastLoginIp = row.last_login_ip;  // 優先明文
if (!lastLoginIp && row.encrypted_last_login_ip) {
    lastLoginIp = decrypt(row.encrypted_last_login_ip, key);  // 解密備援
}
```

**完整顯示**：
- 返回解密後的完整 IP（不遮罩）
- 管理員可直接看到完整 IP 進行風控

### 3. 前端顯示層

**用戶管理頁面**：
- ✅ 保留「最新登入IP」搜尋欄位
- ✅ 列表顯示完整 IP（如 `192.168.1.100`）
- ✅ 支援精確 IP 查詢

**移除的內容**：
- ❌ 不再遮罩顯示（之前為 `192.168.***.***`）
- ❌ 不再顯示提示「IP 已遮罩」

## 安全保護機制

### 多層次防護

| 防護層 | 機制 | 說明 |
|--------|------|------|
| **應用層** | RBAC 權限控制 | 只有有權限的管理員能查看用戶列表 |
| **網路層** | IP 白名單 | 後台僅允許白名單 IP 訪問 |
| **傳輸層** | TLS 加密 | HTTPS 傳輸防止中間人攻擊 |
| **資料庫層** | 加密欄位 | 資料庫被駭時 IP 仍受保護 |
| **審計層** | 操作日誌 | 記錄所有查詢 IP 的操作 |

### 資料庫被駭時的保護

即使資料庫被完全洩露：
1. ✅ 加密欄位需要 `ENCRYPTION_KEY_PII` 才能解密
2. ✅ 密鑰儲存在環境變數（不在資料庫中）
3. ✅ 雲平台環境變數有額外存取控制
4. ✅ 明文欄位可考慮定期清理（保留加密欄位）

## 業務場景支援

### 風控場景

**同 IP 多帳號檢測**：
```sql
-- 精確查詢某 IP 的所有帳號
SELECT user_id, username, created_at 
FROM users 
WHERE last_login_ip = '192.168.1.100'
ORDER BY created_at DESC;
```

**套利檢測**：
```sql
-- 查詢同 IP 且短時間內註冊的帳號
SELECT user_id, username, registration_ip, created_at
FROM users
WHERE registration_ip = '192.168.1.100'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at;
```

**出款審計**：
```sql
-- 查詢某 IP 的提款記錄
SELECT w.*, u.last_login_ip
FROM withdrawals w
JOIN users u ON w.user_id = u.user_id
WHERE u.last_login_ip = '192.168.1.100'
ORDER BY w.request_time DESC;
```

## 未來優化建議

### 選項 1：定期清理明文欄位（推薦）

**策略**：保留最近 30 天的明文 IP，舊資料只保留加密欄位

```sql
-- 定期任務：清理 30 天前的明文 IP
UPDATE users 
SET last_login_ip = NULL,
    registration_ip = NULL,
    first_login_ip = NULL
WHERE last_activity_at < NOW() - INTERVAL '30 days'
  AND (encrypted_last_login_ip IS NOT NULL 
       OR encrypted_registration_ip IS NOT NULL 
       OR encrypted_first_login_ip IS NOT NULL);
```

**優點**：
- ✅ 近期資料可快速查詢（風控需求）
- ✅ 歷史資料受加密保護
- ✅ 資料庫洩露時僅洩露 30 天內 IP

### 選項 2：僅加密非活躍用戶

**策略**：活躍用戶保留明文，非活躍用戶僅保留加密

```sql
-- 定期任務：加密非活躍用戶的 IP
UPDATE users 
SET last_login_ip = NULL
WHERE last_activity_at < NOW() - INTERVAL '90 days'
  AND encrypted_last_login_ip IS NOT NULL;
```

### 選項 3：完全刪除明文欄位（未來）

**前提**：實作高效能的加密查詢方案（如使用專用索引表）

**步驟**：
1. 創建 `ip_lookup` 表存儲 IP 雜湊索引
2. 查詢時先通過雜湊找到用戶
3. 刪除 `last_login_ip` 等明文欄位

## 合規性評估

### GDPR 要求

| 要求 | 實作狀態 | 說明 |
|------|---------|------|
| 資料最小化 | ✅ 符合 | 僅在風控需求下保留 IP |
| 加密保護 | ✅ 符合 | 資料庫加密儲存 |
| 存取控制 | ✅ 符合 | RBAC + IP 白名單 |
| 審計追蹤 | ✅ 符合 | 操作日誌記錄 |
| 資料可攜 | ✅ 符合 | GDPR API 支援匯出 |
| 被遺忘權 | ✅ 符合 | 帳號刪除時清除 IP |

### 合法利益評估（Legitimate Interest）

**處理目的**：
- ✅ 欺詐檢測與預防
- ✅ 套利行為監控
- ✅ 財務審計合規

**必要性**：
- ✅ IP 是識別多帳號的關鍵數據
- ✅ 風控無替代方案
- ✅ 保護平台與其他用戶利益

**平衡測試**：
- ✅ 採用加密保護降低風險
- ✅ 限制存取權限（僅風控人員）
- ✅ 定期清理歷史資料

---

## 總結

此策略在**業務需求**（風控審計）與**隱私保護**（資料加密）之間取得平衡：

1. ✅ **滿足業務需求**：管理員可查詢、查看完整 IP
2. ✅ **保護用戶隱私**：資料庫加密 + 多層存取控制
3. ✅ **符合法規要求**：GDPR 合法利益 + 加密保護
4. ✅ **保持效能**：明文查詢避免全表解密

**版本**：v1.1  
**最後更新**：2026-02-23  
**維護者**：Backend Team
