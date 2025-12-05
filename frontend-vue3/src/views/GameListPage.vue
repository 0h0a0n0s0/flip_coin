<!-- 游戏列表页面 - 用于显示不同分类的游戏 -->
<template>
  <div class="game-list-page">
    <div class="page-header">
      <h1 class="page-title">{{ title }}</h1>
      <p class="page-subtitle">目前没有游戏</p>
    </div>
    
    <div class="game-list-container">
      <!-- 游戏列表将在这里显示 -->
      <div class="empty-state">
        <p>暂无游戏</p>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  category: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  }
})
</script>

<style scoped>
.game-list-page {
  width: 100%;
  min-height: 100%;
  padding: var(--space-4) 0;
}

.page-header {
  padding: 0 var(--space-4);
  margin-bottom: var(--space-6);
}

@media (min-width: 1024px) {
  .page-header {
    padding: 0 calc(var(--space-3) + var(--space-4));
    margin-bottom: var(--space-6);
  }
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: rgb(var(--foreground));
  margin: 0 0 var(--space-2) 0;
}

@media (min-width: 768px) {
  .page-title {
    font-size: 28px;
  }
}

.page-subtitle {
  font-size: 14px;
  color: rgb(var(--text-muted));
  margin: 0;
}

.game-list-container {
  padding: 0 var(--space-4);
}

@media (min-width: 1024px) {
  .game-list-container {
    padding: 0 calc(var(--space-3) + var(--space-4));
  }
}

.empty-state {
  text-align: center;
  padding: var(--space-8) var(--space-4);
  color: rgb(var(--text-muted));
}
</style>

