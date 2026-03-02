# Phase 2 實作完成報告

## 執行時間
2026-02-12

## 完成項目

### ✅ Phase 2.1：創建 PII 欄位加密的資料庫遷移腳本
**檔案位置：** `packages/database/migrations/add_encrypted_pii_fields.sql`

**內容：**
- 新增 `users` 表的加密欄位：
  - `encrypted_email` + `email_hash`（可搜索）
  - `encrypted_registration_ip`
  - `encrypted_first_login_ip`
  - `encrypted_last_login_ip`
  - `hashed_device_id`（單向雜湊）
  - `encrypted_user_agent`
- 新增 `admin_audit_logs` 表的加密欄位：
  - `encrypted_ip_address`
- 新增 `user_login_logs` 表的加密欄位：
  - `encrypted_login_ip`
  - `hashed_device_id`
- 建立索引以提升查詢效率

**執行方式：**
```bash
psql -U flipcoin_user -d flipcoin_db -f packages/database/migrations/add_encrypted_pii_fields.sql
```

---

### ✅ Phase 2.2：修改 UserService 支援 PII 加密/解密
**檔案位置：** `apps/backend-legacy/services/UserService.js`

**新增功能：**
1. **加密寫入：**
   - `updateFirstLoginInfo()` - 加密首次登入資訊
   - `updateLastLoginInfo()` - 加密最後登入資訊
   - `insertUserLoginLog()` - 加密登入日誌
   - `updateUserEmail()` - 加密 Email

2. **解密讀取：**
   - `decryptUserPII()` - 解密用戶 PII 資料
   - `getUserByEmail()` - 根據 Email 查詢（使用 HMAC 索引）

**降級方案：**
- 如果 `ENCRYPTION_KEY_PII` 未配置，會記錄警告並使用明文欄位（向後兼容）

---

### ✅ Phase 2.4：實作 GDPR 資料匯出 API
**檔案位置：** 
- Service: `apps/backend-legacy/services/GdprService.js`
- Routes: `apps/backend-legacy/routes/v1/gdpr.js`

**API 端點：**
```
GET /api/v1/gdpr/export-data
```

**功能：**
- 匯出用戶的所有個人資料（已解密）
- 包含：基本資料、投注記錄、充值/提款記錄、登入日誌、餘額變動
- 以 JSON 格式下載
- 符合 GDPR Article 20: Right to Data Portability

**安全措施：**
- 需要 JWT Token 驗證
- 記錄匯出操作（審計日誌）

---

### ✅ Phase 2.5：實作 GDPR 帳號刪除 API
**檔案位置：** `apps/backend-legacy/services/GdprService.js`

**API 端點：**
```
POST /api/v1/gdpr/check-deletion-eligibility  # 預檢查
POST /api/v1/gdpr/delete-account              # 執行刪除
```

**功能：**
1. **預檢查：**
   - 檢查餘額是否為 0
   - 檢查是否有待處理提款

2. **執行刪除：**
   - **立即刪除：** PII 資料（IP、Device ID、Email、User Agent）
   - **匿名化保留：** 交易記錄（User ID 改為 `DELETED_<timestamp>`）
   - **禁止刪除：** 有未結清餘額或待處理提款的帳號

**安全措施：**
- 需要 JWT Token 驗證
- 需要重新輸入密碼（Re-authentication）
- 記錄刪除操作（審計日誌）
- 符合 GDPR Article 17: Right to Erasure

---

### ✅ Phase 2.6：補齊審計日誌缺失點
**修改檔案：**
1. `apps/backend-legacy/services/auditLogService.js`
   - 支援加密 IP 地址（使用 `encrypted_ip_address` 欄位）

2. `apps/backend-legacy/routes/admin/auth.js`
   - 新增管理員登入審計日誌

**已記錄的操作：**
- ✅ 管理員登入
- ✅ 用戶資料修改（`/api/admin/users/:id`）
- ✅ 用戶狀態更新（`/api/admin/users/:id/status`）
- ✅ GDPR 帳號刪除

---

### ✅ Phase 2.7：創建資料遷移腳本（加密現有資料）
**檔案位置：** `apps/backend-legacy/scripts/migrate-pii-encryption.js`

**功能：**
- 批次加密 `users` 表的 PII 資料（每批 100 筆）
- 批次加密 `user_login_logs` 表的 PII 資料
- 批次加密 `admin_audit_logs` 表的 IP 地址
- 支援乾跑模式（`--dry-run`）測試

**執行方式：**
```bash
# 乾跑模式（不寫入資料庫）
node apps/backend-legacy/scripts/migrate-pii-encryption.js --dry-run

# 正式執行
node apps/backend-legacy/scripts/migrate-pii-encryption.js
```

**注意事項：**
- 確保已配置 `ENCRYPTION_KEY_PII` 環境變數
- 建議先在測試環境執行
- 執行前建議備份資料庫

---

## ⏳ Phase 2.3：更新相關 Routes 使用加密欄位

### 需要更新的檔案清單：

#### 1. 管理員後台 - 用戶管理
**檔案：** `apps/backend-legacy/routes/admin/users.js`

**需要修改的地方：**
- `GET /api/admin/users` - 列表查詢
  - 目前返回明文 `last_login_ip`
  - 建議：使用 `maskIP()` 遮罩顯示（不需完整解密）
  
- 查詢條件：`lastLoginIp`
  - 目前查詢 `last_login_ip` 明文欄位
  - 問題：加密後無法直接查詢
  - 解決方案：
    1. 移除此查詢條件（建議）
    2. 或使用模糊匹配（需解密所有記錄，性能差）

#### 2. 前端 API - 用戶登入/註冊
**檔案：** `apps/backend-legacy/routes/v1/auth.js`

**已完成：**
- ✅ 註冊時已使用 `updateFirstLoginInfo()`（自動加密）
- ✅ 登入時已使用 `updateLastLoginInfo()`（自動加密）

**無需修改。**

#### 3. 管理員後台 - 審計日誌查詢
**檔案：** `apps/backend-legacy/routes/admin/audit.js`（如果存在）

**需要修改的地方：**
- 查詢審計日誌時，解密 `encrypted_ip_address` 顯示
- 建議使用 `maskIP()` 遮罩顯示

---

## 環境變數配置

### 必須添加的環境變數：

```env
# PII 資料加密密鑰（256 bits）
ENCRYPTION_KEY_PII=<64位十六進位字串>

# 生成方式：
# openssl rand -hex 32
```

### 測試環境生成範例：
```bash
openssl rand -hex 32
# 輸出範例：3f8a9b2c7d1e4f5a6b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0
```

---

## 部署步驟

### 1. 執行資料庫遷移
```bash
psql -U flipcoin_user -d flipcoin_db -f packages/database/migrations/add_encrypted_pii_fields.sql
```

### 2. 配置環境變數
```bash
# 生成加密密鑰
ENCRYPTION_KEY_PII=$(openssl rand -hex 32)

# 添加到 .env 檔案（開發環境）
echo "ENCRYPTION_KEY_PII=$ENCRYPTION_KEY_PII" >> .env

# 生產環境：使用雲平台環境變數服務
# - AWS ECS/EKS: Task Definition 環境變數
# - GCP Cloud Run: 環境變數設定
# - Azure: 應用程式設定
```

### 3. 重啟後端服務
```bash
# Docker Compose
docker-compose restart backend-legacy

# 或 PM2
pm2 restart backend-legacy
```

### 4. 執行資料遷移腳本（加密現有資料）
```bash
# 先乾跑測試
node apps/backend-legacy/scripts/migrate-pii-encryption.js --dry-run

# 確認無誤後正式執行
node apps/backend-legacy/scripts/migrate-pii-encryption.js
```

### 5. 驗證功能
- 測試用戶註冊/登入（檢查 PII 是否正確加密）
- 測試 GDPR 資料匯出 API（檢查是否正確解密）
- 測試 GDPR 帳號刪除 API
- 檢查審計日誌是否正常記錄

---

## 測試案例

### 1. PII 加密測試
```bash
# 註冊新用戶
POST /api/v1/auth/register
{
  "username": "testuser",
  "password": "Test123456"
}

# 檢查資料庫（應該只有加密欄位有值）
SELECT 
  id, user_id, username,
  registration_ip,              -- 應為 NULL（明文）
  encrypted_registration_ip,    -- 應有值（密文）
  device_id,                    -- 應為 NULL（明文）
  hashed_device_id             -- 應有值（雜湊）
FROM users WHERE username = 'testuser';
```

### 2. GDPR 資料匯出測試
```bash
# 獲取用戶 Token
POST /api/v1/auth/login
{
  "username": "testuser",
  "password": "Test123456"
}

# 匯出資料
GET /api/v1/gdpr/export-data
Authorization: Bearer <token>

# 檢查返回的 JSON：
# - user_info.email 應為明文（已解密）
# - user_info.registration_ip 應為明文（已解密）
# - user_info.device_id 應為 "[HASHED]"（無法還原）
```

### 3. GDPR 帳號刪除測試
```bash
# 預檢查
POST /api/v1/gdpr/check-deletion-eligibility
Authorization: Bearer <token>

# 執行刪除
POST /api/v1/gdpr/delete-account
Authorization: Bearer <token>
{
  "password": "Test123456",
  "reason": "測試刪除"
}

# 檢查資料庫：
# - users 表應無此用戶
# - bets 表的 user_id 應改為 "DELETED_<timestamp>"
# - user_login_logs 表應無此用戶的記錄
```

---

## 後續建議

### 短期（1-2 週內）
1. ✅ 完成 Phase 2.3：更新管理員後台的查詢邏輯
2. 在測試環境驗證所有功能
3. 撰寫操作手冊（管理員如何使用 GDPR 功能）

### 中期（1 個月內）
1. 監控加密/解密效能（是否需要優化）
2. 收集用戶反饋（GDPR 功能是否符合需求）
3. 定期輪換 `ENCRYPTION_KEY_PII`（建議每 90 天）

### 長期（可選）
1. 實作 PostgreSQL 全磁碟加密（LUKS）
2. 整合雲平台 KMS 服務（AWS Secrets Manager、GCP Secret Manager）
3. 實作自動化密鑰輪換機制

---

## 風險與注意事項

### ⚠️ 密鑰遺失風險
- **問題：** 如果 `ENCRYPTION_KEY_PII` 遺失，所有加密資料將無法還原
- **建議：**
  1. 將密鑰備份到安全的離線位置（加密 USB、紙本保險箱）
  2. 配置多人管理（需 2 人以上才能存取）
  3. 定期測試密鑰備份是否有效

### ⚠️ 效能影響
- **加密/解密操作：** 每次約 0.1-0.5ms（AES-256-GCM）
- **批量查詢：** 如需解密大量記錄，建議分批處理
- **建議：** 管理後台查詢時使用遮罩顯示，避免不必要的解密

### ⚠️ 相容性
- **舊欄位保留：** 目前保留明文欄位（如 `registration_ip`）以確保向後兼容
- **建議：** 遷移完成並穩定運行 3 個月後，再考慮刪除明文欄位

---

## 總結

Phase 2 已完成以下核心功能：
1. ✅ PII 欄位加密基礎設施（資料庫 Schema + Service 層）
2. ✅ GDPR 用戶權利 API（資料匯出、帳號刪除）
3. ✅ 審計日誌強化（加密 IP 地址）
4. ✅ 資料遷移腳本（加密現有明文資料）

剩餘工作：
- ⏳ Phase 2.3：更新管理員後台查詢邏輯（使用加密欄位）

符合 GDPR/CCPA 規範：
- ✅ Article 17: Right to Erasure（帳號刪除）
- ✅ Article 20: Right to Data Portability（資料匯出）
- ✅ 資料分類與加密（L2 級 PII 資料）
- ✅ 審計日誌（管理員操作記錄）

---

**文檔版本：** v1.0  
**最後更新：** 2026-02-12  
**維護者：** Backend Team
