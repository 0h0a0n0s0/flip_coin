<template>
  <div class="hash-game-page">
    <div class="page-header">
      <div class="header-content">
        <div class="header-icon-wrapper">
          <Lock class="header-icon" />
        </div>
        <div>
          <h1 class="page-title">Provably Fair Hash Games</h1>
          <p class="page-subtitle">Transparent blockchain gaming with verifiable fairness</p>
        </div>
      </div>
      <button
        class="verify-button"
        @click="showFairnessModal = true"
      >
        <Lock class="verify-icon" />
        <span>Verify Fairness</span>
      </button>
    </div>

    <div class="games-grid">
      <GameCard
        v-for="game in hashGames"
        :key="game.id"
        :game="game"
        @play="handlePlayGame"
        @click="handleGameClick"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Lock } from '@element-plus/icons-vue'
import GameCard from '@/components/ui/GameCard.vue'

const router = useRouter()
const showFairnessModal = ref(false)

const hashGames = ref([
  {
    id: 'flip-coin',
    name: 'Flip Coin',
    provider: 'FairHash',
    thumbnail: null,
    icon: null,
    hot: true,
    new: false,
    rating: 4.8,
    volume: '$124K'
  }
])

function handlePlayGame(game) {
  if (game.id === 'flip-coin') {
    router.push({ path: '/hash/flip-coin' })
  }
}

function handleGameClick(game) {
  handlePlayGame(game)
}
</script>

<style scoped>
.hash-game-page {
  padding: var(--space-4);
  max-width: 1280px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
  gap: var(--space-4);
  flex-wrap: wrap;
}

.header-content {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.header-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background-color: rgba(243, 195, 64, 0.2);
}

.header-icon {
  width: 18px;
  height: 18px;
  color: var(--primary);
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--foreground);
  margin: 0;
  line-height: 1.2;
}

.page-subtitle {
  font-size: 13px;
  color: var(--text-muted);
  margin: var(--space-1) 0 0 0;
}

.verify-button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background-color: transparent;
  border: 1px solid rgba(243, 195, 64, 0.3);
  border-radius: var(--radius-md);
  color: var(--primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.verify-button:hover {
  background-color: rgba(243, 195, 64, 0.1);
  border-color: rgba(243, 195, 64, 0.5);
}

.verify-icon {
  width: 16px;
  height: 16px;
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

@media (min-width: 768px) {
  .games-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1024px) {
  .games-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (min-width: 1280px) {
  .games-grid {
    grid-template-columns: repeat(5, 1fr);
  }
}
</style>
