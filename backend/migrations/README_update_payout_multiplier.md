# 更新 payout_multiplier 欄位類型

## 問題說明

數據庫的 `payout_multiplier` 欄位目前是 `INT` 類型，但代碼已經改為支援小數點（如 1.95）。需要將以下兩個表的欄位類型改為 `DECIMAL(10, 2)` 以支援小數點設定：

1. `games` 表的 `payout_multiplier` 欄位
2. `bets` 表的 `payout_multiplier` 欄位

## 解決方案

### 方法 1：使用 Docker 執行（推薦）

如果使用 Docker Compose，可以通過以下方式執行：

```bash
# 方法 1a：直接執行 SQL（更新兩個表）
docker exec -i flipcoin-db psql -U game_user -d flipcoin_db << EOF
ALTER TABLE games 
ALTER COLUMN payout_multiplier TYPE DECIMAL(10, 2) USING payout_multiplier::DECIMAL(10, 2);

ALTER TABLE bets 
ALTER COLUMN payout_multiplier TYPE DECIMAL(10, 2) USING payout_multiplier::DECIMAL(10, 2);
EOF

# 方法 1b：使用 migration 腳本
docker exec -i flipcoin-db psql -U game_user -d flipcoin_db < backend/migrations/update_payout_multiplier_to_decimal_simple.sql
docker exec -i flipcoin-db psql -U game_user -d flipcoin_db < backend/migrations/update_bets_payout_multiplier_to_decimal.sql
```

### 方法 2：使用 Node.js migration 腳本

```bash
cd backend
node scripts/run-migration.js update_payout_multiplier_to_decimal_simple.sql
node scripts/run-migration.js update_bets_payout_multiplier_to_decimal.sql
```

### 方法 3：直接連接到數據庫執行

```sql
-- 更新 games 表
ALTER TABLE games 
ALTER COLUMN payout_multiplier TYPE DECIMAL(10, 2) USING payout_multiplier::DECIMAL(10, 2);

-- 更新 bets 表
ALTER TABLE bets 
ALTER COLUMN payout_multiplier TYPE DECIMAL(10, 2) USING payout_multiplier::DECIMAL(10, 2);
```

## 驗證

執行後，可以驗證欄位類型是否已更新：

```sql
-- 驗證 games 表
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_name = 'games' 
AND column_name = 'payout_multiplier';

-- 驗證 bets 表
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_name = 'bets' 
AND column_name = 'payout_multiplier';
```

應該看到：
- `data_type`: `numeric` 或 `decimal`
- `numeric_precision`: `10`
- `numeric_scale`: `2`

## 注意事項

- 執行前請先備份數據庫
- 此操作不會丟失現有數據，只是改變數據類型
- 現有的整數值（如 2）會自動轉換為小數（如 2.00）

