# 🎮 Cyber Gain Web - 首頁遊戲區塊實現報告

## ✅ 已完成的任務

### 任務 1：HomeTabs.vue（主選單 Tab）✓

**位置**：`apps/cyber-gain-web/src/components/home/HomeTabs.vue`

**核心特性**：
- ✅ 深色背景：`bg-[#0f182f]`（與設計稿一致）
- ✅ 圓角設計：`rounded-t-2xl`（頂部圓角）
- ✅ 負 margin：`-mt-4`（往上覆蓋 Banner 底部漸層）
- ✅ 橫向滾動：`overflow-x-auto scrollbar-hide`
- ✅ 隱藏滾動條：自定義 CSS
- ✅ 右側漸層遮罩：提示更多內容

**Tab 狀態樣式**：
| 狀態 | Icon 顏色 | 文字顏色 | 字重 | 特效 |
|------|----------|---------|------|------|
| Active | `#fdc700` | `#fdc700` | `font-bold` | 黃色發光 |
| Inactive | `#8a8ca6` | `#8a8ca6` | `font-normal` | 無 |

**Tab 列表**：
1. 首页（Home）
2. 哈希游戏（Gamepad2）
3. 体育（Trophy）
4. 真人娱乐（Video）
5. 扑克（Spade）
6. 老虎机（Slot）
7. 街机（Joystick）

---

### 任務 2：GameCard.vue（遊戲卡片）✓

**位置**：`apps/cyber-gain-web/src/components/ui/GameCard.vue`

**尺寸規格**（根據設計稿）：
- 寬度：`110px`（固定）
- 比例：`aspect-[110/140]`（約 1:1.27）
- 圓角：`rounded-xl`

**Props 定義**：
```javascript
{
  image: String,      // 圖片 URL
  title: String,      // 遊戲名稱
  provider: String,   // 供應商（默認：CYBER GAIN GAMING）
  rating: [String, Number], // 評分（默認：4.9）
  amount: String,     // 金額（默認：$124K）
  badge: String       // 角標文字（如：熱門）
}
```

**視覺層次**（從下到上）：
1. **背景圖層**：`absolute inset-0 object-cover`
2. **暗色漸層遮罩**：`bg-gradient-to-t from-[#0B132B]/90 via-[#0B132B]/40 to-transparent`
   - 底部深色（90% 不透明）
   - 中間過渡（40% 不透明）
   - 頂部透明
3. **右上角標籤**：`absolute top-0 right-0 bg-red-600` (如果有 badge)
4. **內容區**：`absolute bottom-0 p-2`
   - 標題：白色粗體 `text-sm font-bold`
   - 供應商：灰色小字 `text-[10px] text-[#8a8ca6]`
   - 評分：黃色星星 + 數字 `text-[#fdc700]`
   - 金額：白色粗體 `text-xs font-bold`

**互動效果**：
- Hover：`hover:scale-105`（放大 5%）
- 過渡：`transition-transform duration-200`

---

### 任務 3：GameSection.vue（分類區塊）✓

**位置**：`apps/cyber-gain-web/src/components/home/GameSection.vue`

**Props 定義**：
```javascript
{
  title: String,      // 分類標題（如：熱門遊戲）
  subtitle: String,   // 副標題（如：24小时交易量领先）
  games: Array        // 遊戲陣列
}
```

**標題區佈局**：
```
[黃線] [標題]                    [查看全部 >]
       [副標題]
```

- **左側裝飾線**：`w-1 h-4 bg-[#fdc700] rounded-full`
- **主標題**：`text-white text-base font-medium`
- **副標題**：`text-[#8a8ca6] text-xs`（可選）
- **查看全部**：`text-[#fdc700] text-sm` + 右箭頭 Icon

**卡片佈局**：
- **Grid 3 欄**：`grid grid-cols-3 gap-2`
- 確保每行剛好顯示 3 張卡片
- 間距：8px（`gap-2`）

**Emits**：
- `view-all`：點擊「查看全部」時觸發

---

### 任務 4：Home.vue 整合 ✓

**位置**：`apps/cyber-gain-web/src/views/Home.vue`

**頁面結構**：
```
[Header (絕對定位懸浮)]
[Banner 輪播]
[HomeTabs (負 margin 覆蓋)]
─────────────────────────
[遊戲分類區塊容器] (space-y-6 pt-4 px-4 pb-20)
  ├─ 熱門遊戲 (6 張卡片)
  ├─ 體育 (3 張卡片)
  ├─ 真人娛樂 (3 張卡片)
  ├─ 撲克 (3 張卡片)
  ├─ 老虎機 (3 張卡片)
  └─ 街機 (3 張卡片)
```

**Mock Data 準備**：
- ✅ 6 個分類，共 24 張遊戲卡片
- ✅ 每張卡片包含完整數據（圖片、標題、評分、金額、角標）
- ✅ 使用 Placehold.co 作為佔位圖

**間距設定**：
- 頂部：`pt-4`（16px）
- 左右：`px-4`（16px）
- 底部：`pb-20`（80px，避免被底部導航遮擋）
- 區塊間距：`space-y-6`（24px）

---

## 📊 設計稿精確還原

### 顏色系統
| 元素 | 顏色值 | 用途 |
|------|--------|------|
| 主背景 | `#0B132B` | 頁面底色 |
| Tab 背景 | `#0f182f` | Tab 容器深色 |
| Active 文字/Icon | `#fdc700` | 黃色（主題色） |
| Inactive 文字 | `#8a8ca6` | 灰色 |
| 白色文字 | `#ffffff` | 標題、金額 |
| 次要文字 | `#8a8ca6` | 副標題、供應商 |
| 角標 | `#dc2626` (red-600) | 熱門標籤 |

### 字級系統
| 元素 | 字級 | 字重 | 行高 |
|------|------|------|------|
| Tab 文字 | 14px | 500/700 | - |
| 區塊標題 | 16px | 500 | 1.75 |
| 副標題 | 12px | 500 | 1.42 |
| 卡片標題 | 14px | 700 | tight |
| 卡片供應商 | 10px | 400 | tight |
| 卡片評分/金額 | 12px | 700 | - |

### 間距系統
| 元素 | 間距 | 說明 |
|------|------|------|
| Tab 間距 | 24px | `gap-6` |
| Tab padding | 12px/16px | `py-3 px-4` |
| 卡片間距 | 8px | `gap-2` |
| 區塊間距 | 24px | `space-y-6` |
| 標題 margin | 12px | `mb-3` |

---

## 🎯 關鍵實現技巧

### 1. 暗色漸層遮罩（完美文字可讀性）
```css
bg-gradient-to-t from-[#0B132B]/90 via-[#0B132B]/40 to-transparent
```
- 底部 90% 不透明：確保文字清晰
- 中間 40% 過渡：自然漸變
- 頂部透明：保留圖片亮部

### 2. Tab 覆蓋效果
```css
-mt-4 rounded-t-2xl
```
- 負 margin 往上移動
- 頂部圓角與 Banner 底部漸層融合

### 3. 橫向滾動隱藏滾動條
```css
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
```

### 4. Grid 佈局精確控制
```css
grid grid-cols-3 gap-2
```
- 固定 3 欄
- 自動計算每欄寬度
- 響應式適配

---

## 📦 依賴更新

已添加圖標庫：
```json
"lucide-vue-next": "^0.263.1"
```

**重新安裝依賴（Docker 會自動處理）**：
```bash
# 如果使用本地開發
cd /Users/tuofan/Desktop/Hans/flip_coin
pnpm install
```

---

## 🚀 啟動與測試

### Docker 方式（推薦）
```bash
cd /Users/tuofan/Desktop/Hans/flip_coin

# 重新構建（包含新依賴）
docker compose build cyber-gain-web

# 啟動
docker compose up cyber-gain-web
```

### 訪問地址
**http://localhost:3001**

---

## 🎨 預期效果

訪問首頁後，你將看到：

1. **Header**：懸浮在頂部，黑色半透明漸層
2. **Banner**：自動輪播，底部黃色分頁指示器
3. **Tab 導航**：
   - 深色圓角容器
   - 「首頁」為黃色高亮（帶發光效果）
   - 其他為灰色
   - 可橫向滑動（隱藏滾動條）
4. **遊戲區塊**：
   - 6 個分類區塊
   - 每個區塊有標題 + 副標題 + 查看全部
   - 3 欄 Grid 佈局
   - 卡片有暗色漸層遮罩
   - 部分卡片有紅色「熱門」角標
5. **互動效果**：
   - 卡片 Hover 放大
   - Tab 點擊切換狀態

---

## 📁 新增/修改的文件

```
apps/cyber-gain-web/
├── src/
│   ├── components/
│   │   ├── home/
│   │   │   ├── HomeTabs.vue ✨ 新建（主選單 Tab）
│   │   │   └── GameSection.vue ✨ 新建（分類區塊）
│   │   └── ui/
│   │       └── GameCard.vue ✨ 新建（遊戲卡片）
│   └── views/
│       └── Home.vue ⚙️ 修改（整合所有組件）
└── package.json ⚙️ 修改（添加 lucide-vue-next）
```

---

## 🔄 後續優化建議

### 1. 替換真實圖片
將 Mock Data 中的 Placehold.co 替換為實際遊戲圖片：
```javascript
{
  image: '/assets/games/roulette.jpg',
  // ...
}
```

### 2. API 數據對接
```javascript
// 從 API 獲取遊戲列表
const { data } = await api.get('/games/hot')
hotGames.value = data
```

### 3. 路由跳轉
```javascript
// 查看全部
const router = useRouter()
const handleViewAll = (category) => {
  router.push(`/games/${category}`)
}

// 卡片點擊
const handleCardClick = (gameId) => {
  router.push(`/game/${gameId}`)
}
```

### 4. 骨架屏 Loading
添加 Loading 狀態，提升用戶體驗：
```vue
<div v-if="loading" class="grid grid-cols-3 gap-2">
  <SkeletonCard v-for="i in 6" :key="i" />
</div>
```

### 5. 無限滾動
使用 Intersection Observer 實現分頁加載。

---

## ✅ 完成清單

- [x] HomeTabs.vue（主選單 Tab）
- [x] GameCard.vue（遊戲卡片）
- [x] GameSection.vue（分類區塊）
- [x] Home.vue 整合
- [x] Mock Data 準備
- [x] 設計稿精確還原
- [x] 依賴安裝（lucide-vue-next）
- [x] 視覺特效（漸層遮罩、發光效果）
- [x] 響應式佈局
- [x] 互動效果（Hover、點擊）

所有代碼遵循：
- ✅ Vue 3 Composition API
- ✅ Tailwind CSS 樣式
- ✅ 繁體中文註解
- ✅ 專案憲法規範

---

**🎉 實現完成！重新構建 Docker 容器即可看到完整的首頁遊戲區塊！**
