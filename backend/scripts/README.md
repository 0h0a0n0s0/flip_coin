# 資料庫腳本說明

## ⚠️ 重要提示

**這些腳本已經整合到 `init.sql` 中，新部署時不需要單獨執行這些腳本。**

這些腳本僅用於：
1. **歷史記錄**：記錄資料庫結構的演進過程
2. **數據修復**：用於修復已存在資料庫中的舊數據（僅在需要時執行）

## 腳本分類

### ✅ 已整合到 init.sql 的腳本（不需要單獨執行）

以下腳本的功能已經整合到 `init.sql` 中，新部署時會自動創建這些欄位和表：

- `add-login-query-fields.sql` - 登入查詢相關欄位（已整合）
- `add-original-password-fields.sql` - 原始密碼欄位（已整合）
- `add-password-fingerprint-fields.sql` - 密碼指紋欄位（已整合）

### 🔧 數據修復腳本（僅在需要時執行）

以下腳本用於修復已存在資料庫中的舊數據，**僅在需要修復舊數據時執行**：

- `fix-user-login-data.js` - 修復用戶登入資料（需要 Node.js 環境）
- `fix-user-login-data.sql` - 修復用戶登入資料（SQL 版本）
- `update-password-fingerprints.js` - 更新密碼指紋（需要知道原始密碼）

### 📖 說明文檔

- `README-fix-login-query.md` - 登入查詢修復說明（歷史記錄）

## 新部署流程

對於新部署的資料庫，**只需要執行 `init.sql`**：

```bash
# 新部署時，init.sql 會自動創建所有必要的欄位和表
docker exec -i flipcoin-db psql -U game_user -d flipcoin_db < init.sql
```

## 舊資料庫升級

如果您有舊的資料庫需要升級，可以參考以下腳本：

1. 檢查資料庫是否已有這些欄位：
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('original_password_hash', 'password_fingerprint');
```

2. 如果缺少欄位，可以執行對應的 SQL 腳本（但建議直接使用 init.sql 重建）

## 注意事項

- **新部署**：直接使用 `init.sql`，不需要執行這些腳本
- **舊資料庫**：如果需要修復舊數據，可以參考這些腳本
- **生產環境**：執行任何腳本前請先備份資料庫

