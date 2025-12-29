<template>
  <!-- 模块 3: PageContent - 页面内容区 -->
  <div class="page-content" :class="{ 'sidebar-collapsed': isSidebarCollapsed.value }">
    <!-- 统一的内容包装器 - 与首页相同的响应式行为 -->
    <div class="content-wrapper">
      <!-- 内容容器 -->
      <div class="content-section">
        <div class="page-header">
          <h1>{{ t('history.bet_history') }}</h1>
        </div>
        
        <History :limit-display="false" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'
import History from '@/components/common/History.vue'

const { t } = useI18n()
const isSidebarCollapsed = inject('isSidebarCollapsed', { value: false })
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
  margin-bottom: var(--space-6);
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--foreground);
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
  
  .page-header h1 {
    font-size: 28px;
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

