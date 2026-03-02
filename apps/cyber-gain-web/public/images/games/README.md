# 遊戲卡片縮圖 (games/)

本目錄存放遊戲卡片封面圖，用於首頁遊戲區塊展示。

## 📋 檔案一覽

| 檔案 | 用途 | 關聯組件 |
|------|------|----------|
| card_1.png | 遊戲 1 封面 | `Home.vue` → `GameSection` → `GameCard.vue` |
| card_2.png | 遊戲 2 封面 | 同上 |
| ... | ... | ... |
| card_12.png | 遊戲 12 封面 | 同上 |

- **規格**：PNG，單檔約 188–276KB
- **說明**：`Home.vue` 的 `games` 陣列依序引用 `card_1.png` ~ `card_12.png`

---

## 📦 Git 管理

| 類型 | 策略 |
|------|------|
| card_*.png | ❌ 已加入 `.gitignore` |

此類大檔（共約 2.5MB）已排除於版控，建議：

1. **開發**：使用佔位圖或 CDN 測試連結
2. **正式環境**：由 CDN / 後端 API 提供縮圖 URL
3. **本地**：需手動放入此目錄，或修改 `Home.vue` 的 `image` 欄位指向實際來源

---

## 🔗 關聯組件

- **Home.vue**：`games` 資料定義 `image: '/images/games/card_N.png'`
- **GameSection.vue**：遊戲列表容器
- **GameCard.vue**：單一遊戲卡片顯示
