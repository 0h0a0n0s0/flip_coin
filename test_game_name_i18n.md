# 遊戲名稱多語系測試指南

## 測試步驟

### 1. 確認資料庫結構
```bash
# 執行資料庫遷移（如果尚未執行）
docker exec -i flipcoin-db psql -U game_user -d flipcoin_db < backend/migrations/add_game_code_column.sql
```

### 2. 確認後台遊戲設定
- 進入後台：`遊戲管理 > 自營遊戲管理`
- 確認 Flip Coin 遊戲存在，且有以下欄位：
  - `game_code`: `flip-coin`
  - `name_zh`: `Flip Coin`（或你設定的中文名稱）
  - `name_en`: `FlipCoin`（或你設定的英文名稱）

### 3. 測試前台遊戲名稱顯示

#### 測試點 1：遊戲清單（TrendingGamesGrid）
- 位置：首頁的 "Trending Now" 區塊
- 測試步驟：
  1. 切換到中文（zh-CN）
  2. 確認遊戲卡片顯示 `name_zh`（遊戲名字）
  3. 切換到英文（en-US）
  4. 確認遊戲卡片顯示 `name_en`（英文名字）

#### 測試點 2：遊戲頁面標題（FlipCoinGame）
- 位置：遊戲頁面頂部的 `<h2>` 標題（紅框處）
- 測試步驟：
  1. 進入 Flip Coin 遊戲頁面
  2. 切換到中文（zh-CN）
  3. 確認標題顯示 `name_zh`（遊戲名字）
  4. 切換到英文（en-US）
  5. 確認標題顯示 `name_en`（英文名字）

### 4. 預期行為
- **中文環境（zh-CN）**：顯示 `name_zh`（遊戲名字）
- **英文環境（en-US）**：顯示 `name_en`（英文名字）
- **語言切換時**：遊戲名稱應該立即更新，無需刷新頁面

### 5. 除錯資訊
如果名稱沒有正確顯示，請檢查：
1. 瀏覽器控制台是否有錯誤訊息
2. 網路請求 `/api/v1/games` 是否返回正確的數據
3. `localStorage.getItem('app_language')` 的值是否正確
4. 後台遊戲管理中的 `name_zh` 和 `name_en` 是否有值

