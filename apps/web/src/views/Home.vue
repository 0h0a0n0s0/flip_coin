<template>
  <!-- 模块 3: PageContent - 页面内容区 -->
  <div class="home-page-content" :class="{ 'sidebar-collapsed': isSidebarCollapsed.value }">
    <!-- 统一的内容包装器 - 包含 Banner 和内容区，实现 BetFury 风格的响应式行为 -->
    <div class="content-wrapper">
      <!-- Banner 区域 - 外层占满整行，内层 .banner-inner 负责对齐 -->
    <div class="banner-section">
      <Banner
        :title="t('home.banner_title')"
        :subtitle="t('home.banner_subtitle')"
        :is-sidebar-collapsed="isSidebarCollapsed.value"
      />
    </div>

    <!-- 内容容器 - 游戏列表、最近赢得等 -->
    <div class="content-section">
      <!-- Trending Games -->
      <TrendingGamesGrid />

      <!-- Latest Wins Ticker -->
      <SmallWinnerTicker />
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'
import Banner from '@/components/common/Banner.vue'
import TrendingGamesGrid from '@/components/common/TrendingGamesGrid.vue'
import SmallWinnerTicker from '@/components/common/SmallWinnerTicker.vue'

const { t } = useI18n()
const isSidebarCollapsed = inject('isSidebarCollapsed', { value: false })
</script>

<style scoped>
.home-page-content {
  width: 100%;
  min-height: 100%;
  padding: var(--space-4) 0;
}

/* 内容包装器 - 响应式容器，实现 BetFury 风格的固定最大宽度与居中 */
/* 包含 Banner 和内容区，统一应用响应式规则 */
.content-wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 var(--space-4);
}

/* Banner 区域 - 作为内容区的一部分，遵循相同的响应式规则 */
.banner-section {
  width: 100%;
  padding: 0 var(--space-4);
  margin-bottom: var(--space-4);
}

/* 内容区域 - 使用 spacing tokens */
.content-section {
  width: 100%;
  padding: 0 var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* Tablet 模式 (768px - 1279px) - 中间区间，维持最小可读布局 */
@media (min-width: 768px) and (max-width: 1279px) {
  .content-wrapper {
    padding: 0 var(--space-6);
  }
  
  /* Banner 和内容区都遵循相同的宽度约束 */
  .banner-section,
  .content-section {
    /* 最小宽度：960px，确保 UI 密度与布局不崩坏 */
    min-width: 960px;
    /* 使用 clamp 实现自适应缩放 */
    width: clamp(960px, 100%, 100%);
    /* 左右边界：24px，与 content-section 保持一致 */
    padding: 0 var(--space-6);
  }
  
  .content-section {
    /* 最小高度：1176px，维持内容可读性 */
    min-height: 1176px;
  }
}

/* Desktop 模式 (≥ 1280px) - Web 模式，固定最大宽高并居中 */
@media (min-width: 1280px) {
  .content-wrapper {
    padding: 0 var(--space-6);
    /* 父容器 .main-content 已经处理了 sidebar 宽度，这里只需要居中 */
  }
  
  /* Banner 和内容区都遵循相同的最大宽度约束并居中 */
  .banner-section,
  .content-section {
    /* 最大宽度：1088px，浏览器拉宽时保持此宽度并居中 */
    max-width: 1088px;
    /* 最小宽度：960px，确保不会缩小到低于可读布局 */
    min-width: 960px;
    /* 使用 clamp 实现自适应缩放，在 960px 到 1088px 之间 */
    /* 注意：100% 是相对于 .content-wrapper 的内容区域（已减去 padding） */
    width: clamp(960px, 100%, 1088px);
    /* 居中显示 */
    margin-left: auto;
    margin-right: auto;
    /* 左右边界：24px，与 content-section 保持一致 */
    padding: 0 var(--space-6);
    transition: max-width 0.3s, min-width 0.3s; /* 平滑过渡 */
  }
  
  .content-section {
    /* 最大高度：1458px，Content 区根据比例可微调，但不可超过此视觉高度 */
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
  
  /* Banner 和内容区在 Mobile 模式下都使用 100% 宽度 */
  .banner-section,
  .content-section {
    /* H5 模式：100% 宽度，不使用固定宽度约束 */
    width: 100%;
    min-width: unset;
    max-width: unset;
    margin-left: 0;
    margin-right: 0;
    /* 左右边界：16px，与 content-section 保持一致 */
    padding: 0 var(--space-4);
  }
  
  .content-section {
    min-height: unset;
    max-height: unset;
  }
}
</style>
