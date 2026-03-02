# 底部導航欄圖標 (nav/)

此目錄存放底部導航欄圖標，供 `BottomNav.vue` 使用。

## 📋 圖標一覽

| 檔案 | 用途 | 預設態 | 選中態 |
|------|------|--------|--------|
| menu.svg / menuSelect.svg | 選單 | 灰色 | 黃色 |
| activity.svg / activitySelect.svg | 活動 | 灰色 | 黃色 |
| recommend.svg / recommendSelect.svg | 推薦 | 灰色 | 黃色 |
| vip.svg / vipSelect.svg | VIP | 灰色 | 黃色 |
| chat.svg / chatSelect.svg | 聊天 | 灰色 | 黃色 |

## 🔗 關聯組件

- **BottomNav.vue**：依 `activeTab` 動態切換 `:src`，選中時顯示 `*Select.svg`

## 📐 規格

- **格式**：SVG
- **尺寸**：約 18×18px
- **顏色**：預設 #8a8ca6、選中 #ffdd00
- **Git**：✅ 保留（體積小，約 4K/檔）

## 📂 上層說明

詳見 [images/README.md](../README.md)。
