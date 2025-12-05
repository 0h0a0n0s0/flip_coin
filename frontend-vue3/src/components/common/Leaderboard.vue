<template>
  <section class="leaderboard">
    <h2>🏆 最高連胜排行榜</h2>
    <ol v-if="leaderboardData.length > 0" class="leaderboard-list">
      <li
        v-for="(player, index) in leaderboardData"
        :key="player.id || index"
        class="leaderboard-item"
      >
        <span class="rank">{{ index + 1 }}.</span>
        <span class="name">{{ player.display_name || player.username }}</span>
        <span class="streak">🔥 {{ player.max_streak }} 連胜</span>
      </li>
    </ol>
    <div v-else class="loading">Loading...</div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import * as api from '@/api/index.js'

const leaderboardData = ref([])

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

