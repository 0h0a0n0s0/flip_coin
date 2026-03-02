# 首頁圖片資源 (home/)

本目錄存放首頁相關圖片：橫幅輪播、社群連結、加密貨幣標識、排行榜圖標等。

## 📋 檔案一覽與用途

### 橫幅 (Banner)

| 檔案 | 用途 | 關聯組件 | Git |
|------|------|----------|-----|
| banner01.png | 首頁輪播圖 1 | `Banner.vue` | ❌ 忽略 |
| banner02.png | 首頁輪播圖 2 | `Banner.vue` | ❌ 忽略 |

- **規格**：建議 375×220 比例，單檔約 500KB+
- **說明**：此類大檔已加入 `.gitignore`，需手動新增或由行銷提供。若無檔案，可將 `Banner.vue` 改為使用 `public/banner-placeholder.svg` 作為佔位。

---

### 社群圖標

| 檔案 | 平台 | 關聯組件 |
|------|------|----------|
| telegram_home.png | Telegram | `Footer.vue` |
| facebook_home.png | Facebook | `Footer.vue` |
| youtube_home.png | YouTube | `Footer.vue` |
| x_home.png | X (Twitter) | `Footer.vue` |
| instagram_home.png | Instagram | `Footer.vue` |
| discord_home.png | Discord | `Footer.vue` |
| tiktok_home.png | TikTok | `Footer.vue` |

- **規格**：小圖標，約 4–8KB
- **Git**：✅ 保留

---

### 加密貨幣圖標

| 檔案 | 幣種 | 關聯組件 |
|------|------|----------|
| tether_home.png | USDT | `Footer.vue` |
| tron_home.png | TRX | `Footer.vue` |
| ethereum_home.png | ETH | `Footer.vue` |
| bitcoin_home.png | BTC | `Footer.vue` |
| litecoin_home.png | LTC | `Footer.vue` |
| binance_home.png | BNB | `Footer.vue` |
| solana_home.png | SOL | `Footer.vue` |

- **規格**：小圖標，約 4KB
- **Git**：✅ 保留

---

### 排行榜圖標

| 檔案 | 用途 | 關聯組件 |
|------|------|----------|
| Rank1_Icon.png | 第 1 名獎牌 | `Leaderboard.vue` |
| Rank2_Icon.png | 第 2 名獎牌 | `Leaderboard.vue` |
| Rank3_Icon.png | 第 3 名獎牌 | `Leaderboard.vue` |
| Bet_Icon.png | 下注圖標 | `Leaderboard.vue` |

- **規格**：約 40×40px，PNG 透明背景
- **Git**：✅ 保留

---

### 其他

| 檔案 | 用途 | Git |
|------|------|-----|
| register.svg | 註冊入口圖標 | ✅ |
| register_coin.png | 註冊相關圖示 | ✅ |
| gcb_home.png | GCB 憑證標識 | ✅ `Footer.vue` |

---

## 🔗 關聯組件

- **Banner.vue**：橫幅輪播
- **Footer.vue**：社群、幣種、平台 Logo、GCB
- **Leaderboard.vue**：排行榜區塊（排名與下注圖標）
