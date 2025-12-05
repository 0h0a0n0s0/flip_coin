<template>
  <section class="trending-games-section">
    <div class="section-header">
      <div>
        <h2 class="section-title">Trending Now</h2>
        <p class="section-subtitle">24h Volume Leaders</p>
      </div>
      <button class="view-all-button">
        View All →
      </button>
    </div>

    <div class="games-grid">
      <GameCard
        v-for="game in games"
        :key="game.id"
        :game="game"
        @play="handlePlay"
        @click="handleGameClick"
      />
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import GameCard from '@/components/ui/GameCard.vue'

const router = useRouter()

const games = ref([
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

function handlePlay(game) {
  if (game.id === 'flip-coin') {
    router.push({ path: '/hash/flip-coin' })
  }
}

function handleGameClick(game) {
  handlePlay(game)
}
</script>

<style scoped>
.trending-games-section {
  padding: var(--space-2) 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: calc(var(--space-2) + var(--space-1));
}

.section-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--foreground);
  margin: 0;
  line-height: 1.2;
}

@media (min-width: 768px) {
  .section-title {
    font-size: 18px;
  }
}

.section-subtitle {
  font-size: 10px;
  color: var(--text-muted);
  margin: var(--space-1) 0 0 0;
  line-height: 1.2;
}

@media (min-width: 768px) {
  .section-subtitle {
    font-size: 11px;
  }
}

.view-all-button {
  font-size: 11px;
  font-weight: 500;
  color: var(--primary);
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.2s;
  padding: 0;
}

.view-all-button:hover {
  color: #E5B530;
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);
}

@media (min-width: 768px) {
  .games-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-2);
  }
}

@media (min-width: 1024px) {
  .games-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-2);
  }
}

@media (min-width: 1280px) {
  .games-grid {
    grid-template-columns: repeat(5, 1fr);
    gap: var(--space-2);
  }
}
</style>
