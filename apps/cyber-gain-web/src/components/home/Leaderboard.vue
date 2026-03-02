<template>
  <!-- 排行榜区块容器（與街機間距為 12px，即 mt-3） -->
  <section class="w-full px-4 mt-3">
    <!-- 排行榜卡片（整體結構：標題欄 + 內容區）-->
    <div class="rounded-lg overflow-hidden">
      <!-- 标题栏（高度 40px，圓角上半部 8px）-->
      <div class="flex items-center justify-between h-10 px-2.5 rounded-t-lg" style="
        background: linear-gradient(
          to right,
          rgba(253, 199, 0, 0.1) 0%,
          rgba(27, 27, 34, 0) 100%
        );
      ">
        <!-- 左侧：排行榜标题 -->
        <div class="flex items-center gap-3">
          <!-- 金色装饰条 (2px × 18px，圓角 1px)-->
          <div class="w-0.5 h-[18px] rounded-[1px]" style="
            background: #FDC700;
            box-shadow: 
              0 0 4.375px rgba(253, 199, 0, 0.6),
              0 0 0.875px #FDC700;
          "></div>
          <!-- 標題文字 (16px, font-weight: 500)-->
          <h2 class="text-white text-base font-medium" style="
            font-size: 16px;
            line-height: 28px;
            letter-spacing: -0.439px;
            font-family: 'Helvetica Neue', sans-serif;
          ">排行榜</h2>
        </div>
        
        <!-- 右侧：下拉选择器 (寬度 94px，高度 26px)-->
        <select 
          v-model="selectedFilter"
          class="leaderboard-dropdown bg-transparent text-white cursor-pointer"
        >
          <option value="all" class="bg-[#0F182F]">全部下注</option>
          <option value="today" class="bg-[#0F182F]">今日下注</option>
          <option value="week" class="bg-[#0F182F]">本周下注</option>
          <option value="month" class="bg-[#0F182F]">本月下注</option>
        </select>
      </div>


      <!-- 內容區塊外層容器（用於實現帶圓角的漸層邊框）-->
      <div class="leaderboard-content-wrapper relative rounded-b-lg" style="
        padding: 1px;
        background: radial-gradient(
          circle at 51.71% 0%,
          #FFC900 0%,
          #504311 12.64%,
          #1A2535 35.47%,
          #504311 67.20%,
          #FFC900 92.27%
        );
      ">
        <!-- 內容區塊內層（真實內容區，padding: 10px）-->
        <div class="p-2.5 rounded-b-lg relative" style="
          background: #0F182F;
        ">
          <!-- 上邊界線（漸層效果：兩端透明，中間最亮）-->
          <div class="absolute top-0 left-0 right-0 h-px" style="
            background: linear-gradient(
              90deg,
              rgba(250, 197, 1, 0.1) 0%,
              rgba(250, 197, 1, 0.4) 50%,
              rgba(250, 197, 1, 0.1) 100%
            );
          "></div>

        <!-- 表头 (背景色 #fdc7000d, 圓角 8px, padding 4px 0)-->
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
            <div class="text-white text-sm font-normal text-center" style="
              font-size: 14px;
              font-family: 'PingFang SC', sans-serif;
            ">玩家</div>
            <div class="text-white text-sm font-normal text-center" style="
              font-size: 14px;
              font-family: 'PingFang SC', sans-serif;
            ">投注</div>
          </div>
        </div>

        <!-- 排行榜列表容器 (高度 200px, 可滾動)-->
        <div class="leaderboard-scroll overflow-y-auto" style="max-height: 200px;">
          <div 
            v-for="(player, index) in visibleLeaderboard" 
            :key="player.id"
            class="grid items-center"
            :style="{
              gridTemplateColumns: '70px 1fr 1fr',
              height: '34px',
              borderBottom: index < visibleLeaderboard.length - 1 ? '1px solid transparent' : 'none',
              borderImage: index < visibleLeaderboard.length - 1 ? 'linear-gradient(90deg, rgba(250, 197, 1, 0.1) 0%, rgba(250, 197, 1, 0.4) 49.04%, rgba(250, 197, 1, 0.1) 100%) 1' : 'none'
            }"
          >
            <!-- 排名区域（70px，居中對齊）-->
            <div class="flex items-center justify-center">
              <!-- 前3名显示图标 (40×40px)-->
              <div 
                v-if="index < 3"
                class="w-10 h-10 flex items-center justify-center"
              >
                <img 
                  :src="`/images/home/Rank${index + 1}_Icon.png`" 
                  :alt="`第${index + 1}名`"
                  class="w-full h-full object-contain"
                  @error="handleImageError(index)"
                />
              </div>
              <!-- 4-6名显示灰色數字 (24px 字體，Helvetica Neue，normal)-->
              <div 
                v-else-if="index >= 3 && index < 6"
                class="w-10 h-10 flex items-center justify-center"
              >
                <span class="text-[#8A8CA6] leading-none" style="
                  font-family: 'Helvetica Neue', sans-serif;
                  font-size: 24px;
                  font-weight: 400;
                ">{{ index + 1 }}</span>
              </div>
              <!-- 7-10名显示淡黃色數字 (24px 字體，Arial，bold)-->
              <div 
                v-else
                class="w-10 h-10 flex items-center justify-center"
              >
                <span class="text-[#FFFDA0] leading-none" style="
                  font-family: Arial, sans-serif;
                  font-size: 24px;
                  font-weight: 700;
                ">{{ index + 1 }}</span>
              </div>
            </div>

            <!-- 玩家ID（居中對齊，padding 0 10px）-->
            <div class="text-white text-sm font-normal text-center px-2.5" style="
              font-size: 14px;
              font-family: 'PingFang SC', sans-serif;
            ">
              {{ player.username }}
            </div>

            <!-- 投注金额區域（所有行統一：靠右對齊 + 投注图标 14×14px）-->
            <div class="flex items-center justify-end gap-1 pr-4">
              <span class="text-white text-sm font-normal" style="
                font-size: 14px;
                font-family: 'PingFang SC', sans-serif;
                text-align: right;
              ">{{ player.amount }}</span>
              <img 
                src="/images/home/Bet_Icon.png" 
                alt="投注"
                class="w-3.5 h-3.5 flex-shrink-0"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>

    
    <!-- 说明文字区块 -->
    <div class="mt-6 space-y-2.5 px-1">
      <!-- 主标题 -->
      <h3 class="text-white text-base font-medium leading-tight">
        最佳加密货币赌场 - 欢迎来到 CYBER GAIN
      </h3>

      <!-- 说明段落 1 -->
      <p class="text-[#8A8CA6] text-xs leading-relaxed">
        探索加密游戏的终极目的地，这里每一笔交易都透明公开，每一个游戏都可验证公平性。CYBER GAIN 赌场结合了尖端技术和多样的游戏选项，为所有玩家提供了一个安全且引人入胜的环境。
      </p>

      <!-- Web3交易标题 -->
      <h4 class="text-white text-xs font-medium leading-relaxed">
        Web3交易哈希遊戲
      </h4>

      <!-- 说明段落 2 -->
      <p class="text-[#8A8CA6] text-xs leading-relaxed">
        体验交易哈希游戏的刺激，每个结果都保证公平和透明。无需帐号，只需将交易发送到投注地址，您的奖金将返还到您的钱包。每一笔投注的结果都可以直接在区块链上验证。
      </p>

      <!-- 查看更多按钮 -->
      <div class="flex justify-center pt-2">
        <button 
          @click="handleViewMore"
          class="bg-[#1B2A52] hover:bg-[#243447] text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors"
        >
          查看更多
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue'

// 筛选条件
const selectedFilter = ref('all')

// 完整排行榜数据（擴充至10條數據）
const leaderboard = ref([
  {
    id: 1,
    username: '40****43',
    amount: '888888.88'
  },
  {
    id: 2,
    username: '34****20',
    amount: '858888.88'
  },
  {
    id: 3,
    username: '12****26',
    amount: '658888.88'
  },
  {
    id: 4,
    username: '34****12',
    amount: '558888.88'
  },
  {
    id: 5,
    username: '22****43',
    amount: '458888.88'
  },
  {
    id: 6,
    username: '45****29',
    amount: '458888.88'
  },
  {
    id: 7,
    username: '***234',
    amount: '388888.88'
  },
  {
    id: 8,
    username: '***324',
    amount: '288888.88'
  },
  {
    id: 9,
    username: '***209',
    amount: '188888.88'
  },
  {
    id: 10,
    username: '***321',
    amount: '88888.88'
  }
])

// 顯示前10條數據
const visibleLeaderboard = computed(() => {
  return leaderboard.value.slice(0, 10)
})

// 圖片錯誤處理（如果圖片不存在則顯示數字）
const handleImageError = (index) => {
  console.warn(`[Leaderboard] 排名圖標 ${index + 1} 載入失敗，使用備用樣式`)
}

// 查看更多处理
const handleViewMore = () => {
  console.log('[Leaderboard] 查看更多')
}
</script>

<style scoped>
/* 下拉选择器样式 */
.leaderboard-dropdown {
  width: 94px;
  height: 26px;
  padding: 5px 28px 5px 8px;
  border: 1px solid rgba(253, 199, 0, 0.4);
  border-radius: 6px;
  font-size: 12px;
  line-height: 16px;
  font-family: 'Helvetica Neue', sans-serif;
  box-sizing: border-box;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23FDC700' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 6px center;
  background-repeat: no-repeat;
  background-size: 14px 14px;
}

.leaderboard-dropdown:focus {
  outline: none;
  border-color: rgba(253, 199, 0, 0.6);
}

/* H5 风格滚动条样式（适用于 Web 和移动端）*/
.leaderboard-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(253, 199, 0, 0.3) transparent;
}

/* Webkit 浏览器（Chrome, Safari, Edge）*/
.leaderboard-scroll::-webkit-scrollbar {
  width: 4px;
}

.leaderboard-scroll::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 2px;
}

.leaderboard-scroll::-webkit-scrollbar-thumb {
  background: rgba(253, 199, 0, 0.3);
  border-radius: 2px;
  transition: background 0.3s ease;
}

.leaderboard-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(253, 199, 0, 0.5);
}

/* 移动端触摸滚动优化 */
.leaderboard-scroll {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
</style>
