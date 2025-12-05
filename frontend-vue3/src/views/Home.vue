<template>
  <!-- 模块 3: PageContent - 页面内容区 -->
  <div class="home-page-content">
    <!-- Banner 区域 - 左边对齐 Trending Now，右边切齐头像右边 -->
    <div class="banner-section">
      <Banner
        title="Win Big with Crypto Fairness"
        subtitle="Transparent blockchain gaming • Instant crypto payouts"
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
</template>

<script setup>
import Banner from '@/components/common/Banner.vue'
import TrendingGamesGrid from '@/components/common/TrendingGamesGrid.vue'
import SmallWinnerTicker from '@/components/common/SmallWinnerTicker.vue'
</script>

<style scoped>
.home-page-content {
  width: 100%;
  min-height: 100%;
  padding: var(--space-4) 0;
}

/* Banner 区域 */
.banner-section {
  width: 100%;
  padding: 0 var(--space-4);
  margin-bottom: var(--space-4);
}

/* 桌面端：Banner 左边对齐 Trending Now，右边切齐头像右边 */
@media (min-width: 1024px) {
  .banner-section {
    /* 左边距：与 content-section 一致，对齐 Trending Now */
    padding-left: calc(var(--space-3) + var(--space-4));
    /* 右边切齐头像右边：与 Header 的 padding-right 相同 */
    padding-right: var(--space-3);
    margin-bottom: var(--space-4);
    
    /* 布局逻辑：
       Header: max-width 1400px, margin: 0 auto, padding: var(--space-2) var(--space-3)
       当页面宽度 <= 1400px: Header 宽度 = 100vw, 右边缘 = 100vw
       当页面宽度 > 1400px: Header 居中，右边缘 = (100vw - 1400px) / 2 + 1400px
       
       Banner 在 main-content 中（sidebar 右侧，sidebar = 230px）
       需要确保 Banner 右边缘始终对齐到 Header 右边缘
       
       方案：Banner 容器总宽度（包括 padding）= 1400px
       当宽度 <= 1400px: Banner 宽度 = 100vw - 230px - padding
       当宽度 > 1400px: Banner 宽度 = 1400px - padding, 通过 margin-right 调整位置使右边缘对齐
       
       计算：Header 右边缘 = (100vw - 1400px) / 2 + 1400px = (100vw + 1400px) / 2
       Banner 右边缘 = 230px + Banner容器宽度（包括padding）
       需要：230px + Banner容器宽度 = (100vw + 1400px) / 2
       所以：Banner容器宽度 = (100vw + 1400px) / 2 - 230px
       但 Banner 内容宽度 = 1400px - padding-left - padding-right
       所以 Banner 容器宽度 = 1400px
       因此需要：230px + 1400px = (100vw + 1400px) / 2
       即：1600px = (100vw + 1400px) / 2
       即：100vw = 1800px
       
       这不对！问题在于 Banner 容器宽度应该动态调整。
       
       正确方案：Banner 容器宽度（包括 padding）应该 = (100vw + 1400px) / 2 - 230px
       但内容宽度应该保持 = 1400px - padding
       所以需要调整 padding 或者使用不同的方法
       
       更简单的方案：使用 margin-right 来调整位置
       Banner 内容宽度固定 = 1400px - padding
       Banner 容器总宽度 = 1400px
       Banner 右边缘位置 = 230px + 1400px = 1630px
       Header 右边缘位置 = (100vw + 1400px) / 2
       需要 margin-right = (100vw + 1400px) / 2 - 1600px = (100vw + 1400px - 3200px) / 2 = (100vw - 1800px) / 2
    */
    width: calc(1400px - calc(var(--space-3) + var(--space-4)) - var(--space-3));
    margin-left: 0;
  }
  
  /* 当屏幕宽度小于等于 1400px 时 */
  @media (max-width: 1400px) {
    .banner-section {
      width: calc(100vw - 230px - calc(var(--space-3) + var(--space-4)) - var(--space-3));
      max-width: calc(100vw - 230px - calc(var(--space-3) + var(--space-4)) - var(--space-3));
      margin-right: 0;
    }
  }
  
  /* 当屏幕宽度大于 1400px 时 */
  @media (min-width: 1401px) {
    .banner-section {
      width: calc(1400px - calc(var(--space-3) + var(--space-4)) - var(--space-3));
      /* 右边缘对齐到 Header 右边缘
         Header 右边缘 = (100vw + 1400px) / 2
         Banner 容器右边缘 = 230px + 1400px = 1630px
         需要 margin-right = (100vw + 1400px) / 2 - 1630px = (100vw - 1860px) / 2
      */
      margin-right: calc((100vw - 1860px) / 2);
    }
  }
}

/* 内容区域 - 往右移动一点 */
.content-section {
  width: 100%;
  padding: 0 var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* 桌面端：内容区往右移动，与 header 容器内容区对齐 */
@media (min-width: 1024px) {
  .content-section {
    /* 使用与 Banner 相同的布局逻辑，确保对齐 */
    padding: 0 var(--space-3) 0 calc(var(--space-3) + var(--space-4));
    width: calc(1400px - var(--space-3) * 2 - var(--space-4));
    margin-left: 0;
  }
  
  /* 当屏幕宽度小于等于 1400px 时 */
  @media (max-width: 1400px) {
    .content-section {
      width: calc(100vw - 230px - var(--space-3) * 2 - var(--space-4));
      max-width: calc(100vw - 230px - var(--space-3) * 2 - var(--space-4));
      margin-right: 0;
    }
  }
  
  /* 当屏幕宽度大于 1400px 时 */
  @media (min-width: 1401px) {
    .content-section {
      width: calc(1400px - var(--space-3) * 2 - var(--space-4));
      /* 右边缘对齐到 Header 右边缘，与 Banner 使用相同的 margin-right */
      margin-right: calc((100vw - 1860px) / 2);
    }
  }
}
</style>
