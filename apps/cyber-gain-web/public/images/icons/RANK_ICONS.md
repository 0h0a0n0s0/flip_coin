# 排行榜圖標說明

## 📍 實際使用位置

排行榜圖標目前使用 **`public/images/home/`** 目錄下的：

- `Rank1_Icon.png` - 第 1 名
- `Rank2_Icon.png` - 第 2 名
- `Rank3_Icon.png` - 第 3 名

**關聯組件**：`Leaderboard.vue`

## 📐 規格

- 尺寸：約 40×40px
- 格式：PNG（透明背景）
- 樣式：獎牌徽章，中央顯示排名數字

## 📂 備用/擴展

若要改為使用 `icons/` 目錄，可建立：

- `rank-1.png`、`rank-2.png`、`rank-3.png`

並修改 `Leaderboard.vue` 的圖片路徑。組件已有載入失敗時顯示純數字的降級處理。
