<template>
  <!-- 模块 3: PageContent - 页面内容区 -->
  <div class="page-content" :class="{ 'sidebar-collapsed': isSidebarCollapsed.value }">
    <!-- 统一的内容包装器 - 与首页相同的响应式行为 -->
    <div class="content-wrapper">
      <!-- 内容容器 -->
      <div class="content-section">
        <div class="game-layout">
          <!-- 左侧：游戏主区域 -->
          <div class="game-main">
            <FlipCoinGame @bet-success="handleBetSuccess" />
          </div>

          <!-- 右侧：信息面板 -->
          <div class="info-panel">
            <!-- 连胜排行榜 -->
            <Leaderboard ref="leaderboardRef" />

            <!-- 最近投注 -->
            <History ref="historyRef" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, inject } from 'vue'
import FlipCoinGame from '@/components/game/FlipCoinGame.vue'
import History from '@/components/common/History.vue'
import Leaderboard from '@/components/common/Leaderboard.vue'
import { useSocket } from '@/composables/useSocket.js'
import { getToken } from '@/store/index.js'

const { initializeSocket } = useSocket()
const historyRef = ref(null)
const leaderboardRef = ref(null)
const isSidebarCollapsed = inject('isSidebarCollapsed', { value: false })

function handleBetSuccess(result) {
  console.log('Bet success:', result)
  // 刷新最近投注列表
  if (historyRef.value) {
    historyRef.value.refresh()
  }
  // 刷新排行榜
  if (leaderboardRef.value) {
    leaderboardRef.value.refresh()
  }
}

onMounted(() => {
  const token = getToken()
  if (token) {
    initializeSocket(token)
  }
})
</script>

<style scoped>
.page-content {
  width: 100%;
  min-height: 100%;
  padding: var(--space-4) 0;
}

/* 内容包装器 - 响应式容器，实现 BetFury 风格的固定最大宽度与居中 */
.content-wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 var(--space-4);
}

/* 内容区域 - 使用 spacing tokens */
.content-section {
  width: 100%;
  padding: 0 var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.game-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
  width: 100%;
}

/* Desktop 模式：左右布局 */
@media (min-width: 1024px) {
  .game-layout {
    grid-template-columns: 2fr 1fr;
    gap: var(--space-6);
  }
}

.game-main {
  min-width: 0;
}

.info-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

/* 确保信息面板在移动端也能正常显示 */
@media (max-width: 1023px) {
  .info-panel {
    order: -1; /* 在移动端，信息面板显示在游戏上方 */
  }
}

/* Tablet 模式 (768px - 1279px) - 中间区间，维持最小可读布局 */
@media (min-width: 768px) and (max-width: 1279px) {
  .content-wrapper {
    padding: 0 var(--space-6);
  }
  
  .content-section {
    /* 最小宽度：960px，确保 UI 密度与布局不崩坏 */
    min-width: 960px;
    /* 使用 clamp 实现自适应缩放 */
    width: clamp(960px, 100%, 100%);
    /* 左右边界：24px */
    padding: 0 var(--space-6);
    /* 最小高度：1176px，维持内容可读性 */
    min-height: 1176px;
  }
}

/* Desktop 模式 (≥ 1280px) - Web 模式，固定最大宽高并居中 */
@media (min-width: 1280px) {
  .content-wrapper {
    padding: 0 var(--space-6);
  }
  
  .content-section {
    /* 最大宽度：1088px，浏览器拉宽时保持此宽度并居中 */
    max-width: 1088px;
    /* 最小宽度：960px，确保不会缩小到低于可读布局 */
    min-width: 960px;
    /* 使用 clamp 实现自适应缩放，在 960px 到 1088px 之间 */
    width: clamp(960px, 100%, 1088px);
    /* 居中显示 */
    margin-left: auto;
    margin-right: auto;
    /* 左右边界：24px */
    padding: 0 var(--space-6);
    transition: max-width 0.3s, min-width 0.3s; /* 平滑过渡 */
    /* 最大高度：1458px */
    max-height: 1458px;
    /* 最小高度：1176px，维持最小可读布局 */
    min-height: 1176px;
    /* 内容溢出时显示滚动条 */
    overflow-y: auto;
  }
}

/* Mobile 模式 (≤ 767px) - H5 Layout，100% 宽度 */
@media (max-width: 767px) {
  .content-wrapper {
    padding: 0;
    width: 100%;
  }
  
  .content-section {
    /* H5 模式：100% 宽度，不使用固定宽度约束 */
    width: 100%;
    min-width: unset;
    max-width: unset;
    margin-left: 0;
    margin-right: 0;
    /* 左右边界：16px */
    padding: 0 var(--space-4);
    min-height: unset;
    max-height: unset;
  }
}
</style>
