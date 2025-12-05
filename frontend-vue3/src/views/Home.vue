<template>
  <div class="home-page-content">
    <!-- Hero Strip -->
    <div class="hero-strip">
      <h1>Win Big with Crypto Fairness</h1>
      <p>Transparent blockchain gaming • Instant crypto payouts</p>
    </div>

    <div class="content-container">
      <!-- Trending Games -->
      <TrendingGamesGrid />

      <!-- Latest Wins Ticker -->
      <SmallWinnerTicker />
    </div>
  </div>
</template>

<script setup>
import TrendingGamesGrid from '@/components/common/TrendingGamesGrid.vue'
import SmallWinnerTicker from '@/components/common/SmallWinnerTicker.vue'
</script>

<style scoped>
.home-page-content {
  width: 100%;
  min-height: 100%;
}

.hero-strip {
  background: linear-gradient(to right, rgba(243, 195, 64, 0.2), rgba(138, 108, 244, 0.2));
  border-bottom: 1px solid var(--border);
  padding: var(--space-6);
  margin-bottom: var(--space-4);
  border-radius: var(--radius-md);
}

.hero-strip h1 {
  font-size: 24px;
  margin-bottom: var(--space-2);
  background: linear-gradient(to right, var(--primary), var(--accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-strip p {
  color: var(--text-muted);
  font-size: 13px;
}

.content-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

@media (min-width: 768px) {
  .hero-strip h1 {
    font-size: 32px;
  }
}
</style>