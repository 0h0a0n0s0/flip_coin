<template>
  <div class="bet-history-page">
    <div class="page-header">
      <h1>投注记录</h1>
    </div>
    
    <History :limit-display="false" />
  </div>
</template>

<script setup>
import History from '@/components/common/History.vue'
</script>

<style scoped>
.bet-history-page {
  padding: var(--space-4);
  max-width: 1280px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: var(--space-6);
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--foreground);
}

@media (min-width: 768px) {
  .page-header h1 {
    font-size: 28px;
  }
}
</style>

