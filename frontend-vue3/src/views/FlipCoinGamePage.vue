<template>
  <div class="flip-coin-page">
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
</template>

<script setup>
import { ref, onMounted } from 'vue'
import FlipCoinGame from '@/components/game/FlipCoinGame.vue'
import History from '@/components/common/History.vue'
import Leaderboard from '@/components/common/Leaderboard.vue'
import { useSocket } from '@/composables/useSocket.js'
import { getToken } from '@/store/index.js'

const { initializeSocket } = useSocket()
const historyRef = ref(null)
const leaderboardRef = ref(null)

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
.flip-coin-page {
  padding: var(--space-4);
  max-width: 1280px;
  margin: 0 auto;
}

.game-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
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
</style>
