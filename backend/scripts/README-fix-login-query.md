# 修復登入查詢資料缺失問題

## 問題描述

某些舊帳號（如 hans01, hans02）在後台登入查詢中缺少以下資料：
- 首次登入地區 (first_login_country)
- 登入同IP (same_login_ip_count)
- 註冊同密碼 (same_registration_password_count) - **需要記錄註冊時的原始密碼**
- 資金同密碼 (same_withdrawal_password_count) - **需要記錄首次設置時的原始資金密碼**

## 原因分析

1. **首次登入地區缺失**：舊帳號在新增這些欄位之前就註冊了，或者沒有登入過，所以沒有記錄首次登入資訊。
2. **登入同IP為0**：如果用戶沒有登入日誌（user_login_logs 表中沒有記錄），原本的查詢邏輯無法計算「登入同IP」。
3. **註冊同密碼/資金同密碼為0**：
   - **問題**：原本的查詢邏輯使用當前的 `password_hash` 和 `withdrawal_password_hash` 來比較
   - **需求**：應該使用「註冊時的原始密碼」和「首次設置資金密碼時的原始密碼」來比較
   - **原因**：用戶後續可能修改過密碼，但我們需要追蹤的是註冊/首次設置時使用的密碼

## 解決方案

### 步驟一：新增原始密碼欄位（必須先執行）

1. 執行 SQL 腳本新增欄位：
```bash
docker exec -i flipcoin-db psql -U game_user -d flipcoin_db < backend/scripts/add-original-password-fields.sql
```

這個腳本會：
- 新增 `original_password_hash` 欄位（記錄註冊時的密碼）
- 新增 `original_withdrawal_password_hash` 欄位（記錄首次設置資金密碼時的密碼）
- 為現有用戶補齊資料（將當前密碼複製到原始密碼欄位）

### 步驟二：修復首次登入資料

1. 執行修復腳本：
```bash
docker exec -i flipcoin-db psql -U game_user -d flipcoin_db < backend/scripts/fix-user-login-data.sql
```

### 方法二：使用 Node.js 腳本

1. 進入 backend 目錄：
```bash
cd backend
```

2. 執行腳本：
```bash
node scripts/fix-user-login-data.js
```

注意：此腳本需要安裝依賴，如果遇到模組缺失問題，請先執行 `npm install`。

## 修復內容

### 1. 新增原始密碼欄位

- 新增 `original_password_hash`：記錄註冊時的密碼hash
- 新增 `original_withdrawal_password_hash`：記錄首次設置資金密碼時的密碼hash
- 為現有用戶補齊資料（假設當前密碼就是原始密碼）

### 2. 修改註冊和設置密碼邏輯

已更新 `backend/server.js`：
- **註冊時**：同時將 `password_hash` 保存到 `original_password_hash`
- **首次設置資金密碼時**：同時將 `withdrawal_password_hash` 保存到 `original_withdrawal_password_hash`
- **修改密碼時**：只更新當前密碼，不更新原始密碼

### 3. 改進查詢邏輯

已更新 `backend/routes/admin.js`：
- **登入同IP**：如果用戶有登入日誌，從登入日誌中查詢；如果沒有，使用 `first_login_ip` 或 `registration_ip` 來查詢
- **註冊同密碼**：使用 `original_password_hash`（如果沒有則使用 `password_hash`）來比較
- **資金同密碼**：使用 `original_withdrawal_password_hash`（如果沒有則使用 `withdrawal_password_hash`）來比較

## 驗證修復結果

修復完成後，可以在後台登入查詢頁面檢查：
1. 首次登入地區是否顯示
2. 登入同IP是否正確計算
3. 註冊同密碼和資金同密碼是否正確顯示

## 注意事項

1. 執行修復前請備份資料庫
2. 如果用戶真的沒有登入過，某些資料可能無法補齊
3. 國家資訊需要通過 IP API 獲取，如果 API 失敗，國家欄位可能為空

