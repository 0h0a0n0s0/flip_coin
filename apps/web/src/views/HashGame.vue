<template>
  <!-- 模块 3: PageContent - 页面内容区 -->
  <div class="page-content" :class="{ 'sidebar-collapsed': isSidebarCollapsed.value }">
    <!-- 统一的内容包装器 - 与首页相同的响应式行为 -->
    <div class="content-wrapper">
      <!-- 内容容器 -->
      <div class="content-section">
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
    </div>
  </div>
</template>

<script setup>
import { ref, inject } from 'vue'
import { useRouter } from 'vue-router'
import { Lock } from '@element-plus/icons-vue'
import GameCard from '@/components/ui/GameCard.vue'

const router = useRouter()
const showFairnessModal = ref(false)
const isSidebarCollapsed = inject('isSidebarCollapsed', { value: false })

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

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
  gap: var(--space-4);
  flex-wrap: wrap;
  width: 100%;
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
  width: 100%;
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
