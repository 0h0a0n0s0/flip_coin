# 排行榜區塊像素級還原報告

## 📊 更新日期
2026-03-02

## 🎯 更新目標
根據 `cg footer.pen` 設計稿，對排行榜區塊進行像素級還原，確保與設計稿完全一致。

---

## ✅ 已修正的問題

### 1. 排行榜與街機的間距調整
**問題描述：** 原先排行榜區塊有獨立的 `py-3` padding，導致與街機區塊的間距不符合設計稿。

**設計稿數據：**
- 街機區塊 (BavAe) 結束位置：`y: 1312`
- 排行榜區塊 (5T2Ip) 開始位置：`y: 1324`
- **間距：** `12px` (即 `mt-3`)

**修正方案：**
```vue
<!-- 從 -->
<section class="w-full px-4 py-3">

<!-- 改為 -->
<section class="w-full px-4 mt-3">
```

---

### 2. 標題樣式統一
**問題描述：** 排行榜標題樣式與街機標題不一致。

**設計稿規格：**
- **金色裝飾條：** 寬 `2px`，高 `18px`，圓角 `1px`，顏色 `#FDC700`
- **陰影效果：** 
  - `0 0 4.375px rgba(253, 199, 0, 0.6)` (外發光)
  - `0 0 0.875px #FDC700` (內發光)
- **標題文字：**
  - 字體：`Helvetica Neue`
  - 大小：`16px`
  - 行高：`28px` (line-height: 1.75)
  - 字距：`-0.439px`
  - 粗細：`500` (font-medium)

**修正方案：**
```vue
<div class="flex items-center gap-3">
  <!-- 金色装饰条 -->
  <div class="w-0.5 h-[18px] rounded-[1px]" style="
    background: #FDC700;
    box-shadow: 
      0 0 4.375px rgba(253, 199, 0, 0.6),
      0 0 0.875px #FDC700;
  "></div>
  <!-- 標題文字 -->
  <h2 class="text-white text-base font-medium" style="
    font-size: 16px;
    line-height: 28px;
    letter-spacing: -0.439px;
    font-family: 'Helvetica Neue', sans-serif;
  ">排行榜</h2>
</div>
```

---

### 3. 下拉選單邊框樣式
**問題描述：** 下拉選單邊框透明度不正確。

**設計稿規格：**
- **邊框顏色：** `#FDC700` 40% 透明度 (即 `#fdc70066`)
- **高度：** `26px`
- **Padding：** `10px 4px 10px 8px`
- **圓角：** `6px` (rounded-md)
- **字體大小：** `12px`
- **行高：** `1.333`

**修正方案：**
```vue
<select 
  v-model="selectedFilter"
  class="bg-transparent text-white text-xs h-[26px] rounded-md cursor-pointer"
  style="
    padding: 10px 4px 10px 8px;
    border: 1px solid rgba(253, 199, 0, 0.4);
    font-size: 12px;
    line-height: 1.333;
  "
>
```

---

### 4. 表頭樣式
**問題描述：** 表頭背景色和 padding 不符合設計稿。

**設計稿規格：**
- **背景色：** `#FDC700` 5% 透明度 (即 `#fdc7000d`)
- **圓角：** `8px`
- **Padding：** `4px 0` (上下 4px，左右 0)
- **字體：** `PingFang SC`，大小 `14px`
- **列寬：** `70px (排名) | 1fr (玩家) | 1fr (投注)`

**修正方案：**
```vue
<div class="rounded-lg" style="
  background: rgba(253, 199, 0, 0.05);
  padding: 4px 0;
">
  <div class="grid items-center" style="
    grid-template-columns: 70px 1fr 1fr;
  ">
    <div class="text-white text-sm font-normal text-center" style="
      font-size: 14px;
      font-family: 'PingFang SC', sans-serif;
    ">排名</div>
    <div class="text-white text-sm font-normal text-center">玩家</div>
    <div class="text-white text-sm font-normal text-center">投注</div>
  </div>
</div>
```

---

### 5. 內容行距與行高
**問題描述：** 前6行和後4行的高度不同，分隔線樣式不正確。

**設計稿規格：**
- **前6行 (1-6)：**
  - 高度：`34px`
  - 分隔線：漸層邊框（`linear-gradient` 從 10% → 40% → 10%）
  - 背景：透明
- **後4行 (7-10)：**
  - 高度：`40px`
  - 背景色：`#202D40`
  - 圓角：`6px`
  - 無分隔線

**修正方案：**
```vue
<div 
  v-for="(player, index) in visibleLeaderboard" 
  :key="player.id"
  class="grid items-center"
  :style="{
    gridTemplateColumns: '70px 1fr 1fr',
    height: index < 6 ? '34px' : '40px',
    borderBottom: index < 6 ? '1px solid transparent' : 'none',
    borderImage: index < 6 ? 'linear-gradient(90deg, rgba(250, 197, 1, 0.1) 0%, rgba(250, 197, 1, 0.4) 49.04%, rgba(250, 197, 1, 0.1) 100%) 1' : 'none',
    background: index >= 6 ? '#202D40' : 'transparent',
    borderRadius: index >= 6 ? '6px' : '0'
  }"
>
```

---

### 6. 內容對齊方式修正
**問題描述：** 原先玩家欄位靠左對齊，投注欄位靠右對齊，與設計稿不符。

**設計稿規格：**
- **排名欄：** 70px 寬，居中對齊
- **玩家欄：** `fill_container` (flex-1)，**居中對齊**
- **投注欄：** `fill_container` (flex-1)
  - 前6行：**靠右對齊**，帶綠色圓點圖標 (14×14px)
  - 後4行：**居中對齊**，無圖標

**修正方案：**
```vue
<!-- 玩家ID（居中對齊）-->
<div class="text-white text-sm font-normal text-center px-2.5">
  {{ player.username }}
</div>

<!-- 投注金额（前6行靠右，後4行居中）-->
<div v-if="index < 6" class="flex items-center justify-end gap-1 pr-4">
  <span class="text-white text-sm font-normal">{{ player.amount }}</span>
  <span class="w-3.5 h-3.5 rounded-full bg-[#10B981] flex-shrink-0"></span>
</div>
<div v-else class="text-white text-sm font-normal text-center px-2.5">
  {{ player.amount }}
</div>
```

---

### 7. 排名圖標與數字規格
**問題描述：** 排名圖標佔位不正確，數字字體和大小不符合設計稿。

**設計稿規格：**
- **前3名：** 預留 `40×40px` 圖標位置（圖片路徑：`/images/icons/rank_{1-3}.png`）
  - 暫時用金色數字替代：`#FDC700`，`32px` 字體
- **4-10名：** 黃色數字
  - 顏色：`#FFFDA0`
  - 字體：`Arial`
  - 大小：`24px`
  - 粗細：`700` (font-bold)
  - 容器：`40×40px`

**修正方案：**
```vue
<!-- 4-10名显示黃色數字 -->
<div v-else class="w-10 h-10 flex items-center justify-center">
  <span class="text-[#FFFDA0] text-2xl font-bold leading-none" style="
    font-family: Arial, sans-serif;
    font-size: 24px;
    font-weight: 700;
  ">{{ index + 1 }}</span>
</div>
```

---

### 8. 內容區域滾動限制
**問題描述：** 設計稿中內容區域有高度限制，超出部分應可滾動。

**設計稿規格：**
- **容器高度：** `200px` (max-height)
- **滾動方向：** 垂直滾動 (overflow-y: auto)
- **顯示數據：** 10條記錄

**修正方案：**
```vue
<div class="overflow-y-auto" style="max-height: 200px;">
  <!-- 列表內容 -->
</div>
```

---

### 9. 外層邊框漸層效果
**問題描述：** 整個排行榜卡片的邊框應該有徑向漸層效果。

**設計稿規格：**
- **邊框類型：** Radial Gradient (徑向漸層)
- **中心點：** `51.71% 0%`
- **漸層色停：**
  - `#FFC900` @ 0%
  - `#504311` @ 12.64%
  - `#1A2535` @ 35.47%
  - `#504311` @ 67.20%
  - `#FFC900` @ 92.27%
- **應用範圍：** 僅下半部分（內容區），標題欄不包含

**修正方案：**
```vue
<div class="p-2.5 rounded-b-lg" style="
  border: 1px solid transparent;
  border-image: radial-gradient(
    circle at 51.71% 0%,
    #FFC900 0%,
    #504311 12.64%,
    #1A2535 35.47%,
    #504311 67.20%,
    #FFC900 92.27%
  ) 1;
  border-top: none;
">
```

---

## 📐 關鍵尺寸對照表

| 元素 | 設計稿規格 | 實現方式 |
|------|-----------|---------|
| 與街機間距 | 12px | `mt-3` |
| 標題欄高度 | 40px | `h-10` |
| 金色裝飾條 | 2×18px, 圓角 1px | `w-0.5 h-[18px] rounded-[1px]` |
| 下拉選單高度 | 26px | `h-[26px]` |
| 下拉選單邊框 | #FDC700 40% | `rgba(253, 199, 0, 0.4)` |
| 內容區 padding | 10px | `p-2.5` |
| 表頭高度 | 28px (含 padding 4px×2) | `py-1` |
| 表頭背景色 | #FDC700 5% | `rgba(253, 199, 0, 0.05)` |
| 前6行高度 | 34px | `height: 34px` |
| 後4行高度 | 40px | `height: 40px` |
| 後4行背景色 | #202D40 | `background: #202D40` |
| 排名欄寬度 | 70px | `70px` |
| 玩家欄寬度 | flex-1 | `1fr` |
| 投注欄寬度 | flex-1 | `1fr` |
| 綠色圓點 | 14×14px | `w-3.5 h-3.5` |
| 內容容器高度 | 200px (max) | `max-height: 200px` |

---

## 🎨 顏色對照表

| 元素 | 顏色值 | 用途 |
|------|--------|------|
| 金色主色 | `#FDC700` | 裝飾條、邊框 |
| 金色漸層起點 | `#FFC900` | 邊框漸層 |
| 深棕色 | `#504311` | 邊框漸層中間色 |
| 深藍色 | `#1A2535` | 邊框漸層中心色 |
| 深灰藍色 | `#202D40` | 第7-10行背景色 |
| 淺黃色 | `#FFFDA0` | 第4-10名數字顏色 |
| 綠色圓點 | `#10B981` | 前6行投注金額圖標 |
| 白色文字 | `#FFFFFF` | 所有文字內容 |

---

## 📝 字體規格

| 元素 | 字體 | 大小 | 粗細 | 行高 | 字距 |
|------|------|------|------|------|------|
| 標題 | Helvetica Neue | 16px | 500 | 28px (1.75) | -0.439px |
| 下拉選單 | Helvetica Neue | 12px | 400 | 1.333 | - |
| 表頭文字 | PingFang SC | 14px | 400 | - | - |
| 內容文字 | PingFang SC | 14px | 400 | - | - |
| 4-10名數字 | Arial | 24px | 700 | - | - |

---

## 🔄 數據更新

**完整排行榜數據（10條記錄）：**

```javascript
const leaderboard = ref([
  { id: 1, username: '40****43', amount: '888888.88' },
  { id: 2, username: '34****20', amount: '858888.88' },
  { id: 3, username: '12****26', amount: '658888.88' },
  { id: 4, username: '34****12', amount: '558888.88' },
  { id: 5, username: '22****43', amount: '458888.88' },
  { id: 6, username: '45****29', amount: '458888.88' },
  { id: 7, username: '***234', amount: '388888.88' },
  { id: 8, username: '***324', amount: '288888.88' },
  { id: 9, username: '***209', amount: '188888.88' },
  { id: 10, username: '***321', amount: '88888.88' }
])
```

---

## ⚠️ 待補充資源

### 排名圖標
**路徑：** `/images/icons/rank_{1-3}.png`

**規格要求：**
- 尺寸：`40×40px`
- 格式：PNG（支援透明）
- 數量：3個（第1名、第2名、第3名）

**暫時替代方案：**
- 使用金色數字 `#FDC700`，字體大小 `32px`

---

## ✨ 實現亮點

1. **像素級還原**：所有尺寸、顏色、字體均嚴格按照設計稿規格實現
2. **動態行高**：前6行和後4行使用不同的高度和樣式
3. **條件渲染**：根據排名動態顯示圖標或數字
4. **漸層邊框**：使用徑向漸層實現複雜的邊框效果
5. **滾動優化**：內容區域限制高度，超出部分可滾動

---

## 🧪 測試建議

1. **視覺對比測試**：將實現結果與設計稿截圖對比
2. **響應式測試**：確認在不同屏幕尺寸下的表現
3. **數據測試**：測試數據量變化時的滾動行為
4. **圖標測試**：補充排名圖標後測試圖片加載和錯誤處理

---

## 📚 相關文件

- **設計稿：** `/Users/tuofan/Desktop/Hans/cg footer.pen`
- **組件文件：** `apps/cyber-gain-web/src/components/home/Leaderboard.vue`
- **頁面文件：** `apps/cyber-gain-web/src/views/Home.vue`
- **圖片說明：** `apps/cyber-gain-web/public/images/README.md`

---

**更新完成日期：** 2026-03-02  
**執行人員：** AI Assistant (Claude Sonnet 4.5)  
**審核狀態：** ⏳ 待測試驗證
