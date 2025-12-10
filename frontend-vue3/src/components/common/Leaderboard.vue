<template>
  <section class="leaderboard">
    <h2>{{ t('leaderboard.title') }}</h2>
    <ol v-if="displayedLeaderboard.length > 0" class="leaderboard-list">
      <li
        v-for="(player, index) in displayedLeaderboard"
        :key="player.id || index"
        class="leaderboard-item"
      >
        <span class="rank">{{ index + 1 }}.</span>
        <span class="name">{{ formatUserName(player) }}</span>
        <span class="streak">🔥 {{ player.max_streak }} {{ t('leaderboard.streak') }}</span>
      </li>
    </ol>
    <div v-else class="loading">{{ t('leaderboard.loading') }}</div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import * as api from '@/api/index.js'

const { t } = useI18n()

const leaderboardData = ref([])
const MAX_DISPLAY = 10 // 最多显示前10名

// 只显示前10名
const displayedLeaderboard = computed(() => {
  return leaderboardData.value.slice(0, MAX_DISPLAY)
})

// 格式化用户名：有昵称优先显示昵称，没有就显示ID，ID中间3码用***隐藏
function formatUserName(player) {
  // 优先显示昵称
  if (player.display_name || player.nickname) {
    return player.display_name || player.nickname
  }
  
  // 没有昵称，显示ID，中间3码用***隐藏
  const userId = player.user_id || player.id || player.username || ''
  if (userId.length > 6) {
    // ID长度大于6，隐藏中间3码
    const start = userId.substring(0, 3)
    const end = userId.substring(userId.length - 3)
    return `${start}***${end}`
  } else if (userId.length > 3) {
    // ID长度3-6，隐藏中间部分
    const start = userId.substring(0, 2)
    const end = userId.substring(userId.length - 2)
    return `${start}***${end}`
  }
  
  // ID太短，直接显示
  return userId
}

async function loadLeaderboard() {
  try {
    const data = await api.getLeaderboard()
    leaderboardData.value = data || []
  } catch (error) {
    console.error('Failed to load leaderboard:', error)
    leaderboardData.value = []
  }
}

function updateData(data) {
  leaderboardData.value = data || []
}

function refresh() {
  loadLeaderboard()
}

onMounted(() => {
  loadLeaderboard()
})

defineExpose({
  updateData,
  refresh
})
</script>

<style scoped>
.leaderboard {
  padding: var(--space-4);
  background-color: var(--card);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
}

.leaderboard h2 {
  margin: 0 0 var(--space-4) 0;
  font-size: 18px;
  color: var(--foreground);
}

.leaderboard-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.leaderboard-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2);
  background-color: var(--surface-light);
  border-radius: var(--radius-sm);
  font-size: 14px;
}

.rank {
  font-weight: 600;
  color: var(--primary);
  min-width: 30px;
}

.name {
  flex: 1;
  color: var(--foreground);
}

.streak {
  color: var(--text-muted);
  font-size: 12px;
}

.loading {
  text-align: center;
  color: var(--text-muted);
  padding: var(--space-4);
}
</style>

