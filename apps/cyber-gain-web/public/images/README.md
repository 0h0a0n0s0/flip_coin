# 圖片資源目錄說明

本目錄存放 Cyber Gain Web 應用程式所需的靜態圖片資源。

## 📁 目錄結構

```
public/images/
├── nav/           # 底部導航欄圖標 (BottomNav)
├── home/          # 首頁相關 (橫幅、社群、加密貨幣、排行榜)
├── games/         # 遊戲卡片縮圖 (GameSection / Home)
├── common/        # 通用元素 (Logo、平台標識)
└── icons/         # 其他小圖標 (備用/擴展用)
```

---

## 📋 各目錄用途與關聯

### `nav/` - 底部導航欄圖標

| 檔案 | 用途 | 關聯組件 |
|------|------|----------|
| menu.svg / menuSelect.svg | 選單 | `BottomNav.vue` |
| activity.svg / activitySelect.svg | 活動 | `BottomNav.vue` |
| recommend.svg / recommendSelect.svg | 推薦 | `BottomNav.vue` |
| vip.svg / vipSelect.svg | VIP | `BottomNav.vue` |
| chat.svg / chatSelect.svg | 聊天 | `BottomNav.vue` |

- **規格**：SVG，約 18×18px 等效，灰/黃雙態
- **Git**：✅ 保留（體積小，約 4K/檔）
- **詳見**：[nav/README.md](nav/README.md)

---

### `home/` - 首頁相關圖片

| 類型 | 檔案 | 用途 | 關聯組件 |
|------|------|------|----------|
| 橫幅 | banner01.png, banner02.png | 首頁輪播 | `Banner.vue` |
| 社群 | telegram_home.png, facebook_home.png, youtube_home.png, x_home.png, instagram_home.png, discord_home.png, tiktok_home.png | Footer 社群連結 | `Footer.vue` |
| 加密貨幣 | tether_home.png, tron_home.png, ethereum_home.png, bitcoin_home.png, litecoin_home.png, binance_home.png, solana_home.png | Footer 幣種標識 | `Footer.vue` |
| 排行榜 | Rank1_Icon.png, Rank2_Icon.png, Rank3_Icon.png, Bet_Icon.png | 排行榜區塊 | `Leaderboard.vue` |
| 註冊 | register.svg, register_coin.png | 註冊入口 | 待使用 |
| 其他 | gcb_home.png | GCB 憑證 | `Footer.vue` |

- **Git**：
  - ✅ 保留：社群、加密貨幣、排行榜、註冊等小圖標（< 50KB）
  - ❌ 忽略：`banner*.png`（單檔 500KB+，由行銷替換）
- **詳見**：[home/README.md](home/README.md)

---

### `games/` - 遊戲卡片縮圖

| 檔案 | 用途 | 關聯組件 |
|------|------|----------|
| card_1.png ~ card_12.png | 遊戲卡片封面 | `Home.vue` → `GameSection` → `GameCard.vue` |

- **規格**：PNG，約 200–280KB/檔
- **Git**：❌ 忽略（體積大，建議 CDN 或建置時注入）
- **詳見**：[games/README.md](games/README.md)

---

### `common/` - 通用圖片

| 檔案 | 用途 | 關聯組件 |
|------|------|----------|
| platformLogo.svg | 平台 Logo | `Header.vue`, `Footer.vue` |

- **Git**：✅ 保留

---

### `icons/` - 其他圖標

- 備用或擴展用小圖標
- 排行榜圖標說明：[icons/RANK_ICONS.md](icons/RANK_ICONS.md)（目前實際使用 `home/Rank*_Icon.png`）

---

## 🔧 使用規範

### 在 Vue 組件中引用

```vue
<!-- 絕對路徑 -->
<img src="/images/nav/menu.svg" alt="選單" />

<!-- 動態綁定 -->
<img :src="`/images/home/Rank${index + 1}_Icon.png`" />

<!-- 組件 props -->
<Banner :items="[{ url: '/images/home/banner01.png' }]" />
```

### 命名規範

- 使用 **kebab-case**
- 語義化命名
- 範例：`icon-wallet-32x32.svg`、`hero-banner.png`

### 圖片優化建議

| 格式 | 適用場景 |
|------|----------|
| SVG | 圖標、Logo（可縮放） |
| PNG | 需透明背景的圖片 |
| JPG | 照片、大圖背景 |
| WebP | 現代瀏覽器，體積更小 |

---

## 📦 Git 管理策略

| 類型 | 策略 | 說明 |
|------|------|------|
| 導航 icon (nav/*.svg) | ✅ 進 Git | 體積小，必備 |
| 小圖標 (home 社群/幣種/排行榜) | ✅ 進 Git | < 50KB |
| platformLogo.svg | ✅ 進 Git | 品牌必要 |
| 橫幅 (banner*.png) | ❌ .gitignore | 大檔，行銷常換 |
| 遊戲卡片 (card_*.png) | ❌ .gitignore | 大檔，建議 CDN |

`.gitignore` 已排除 `banner*.png`、`card_*.png`，新增時請放對目錄並遵循上述規則。
