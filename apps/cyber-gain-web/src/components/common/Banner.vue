<template>
  <div class="relative w-full aspect-[375/220] overflow-hidden">
    <transition-group name="fade">
      <img
        v-for="(banner, index) in banners"
        v-show="index === currentIndex"
        :key="index"
        :src="banner.url"
        :alt="`Banner ${index + 1}`"
        class="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
      />
    </transition-group>

    <div class="absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t from-[#0B132B] to-transparent pointer-events-none z-10"></div>

    <div class="absolute bottom-[26px] w-full flex justify-center gap-1.5 z-20">
      <button
        v-for="(banner, index) in banners"
        :key="`dot-${index}`"
        @click="goToSlide(index)"
        :class="[
          'transition-all duration-300 rounded-full',
          index === currentIndex 
            ? 'w-4 h-1.5 bg-[#EAB308]' 
            : 'w-1.5 h-1.5 bg-black/50'
        ]"
        :aria-label="`切換到第 ${index + 1} 張圖片`"
      ></button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

// 輪播圖片陣列
const banners = ref([
  {
    url: '/images/home/banner01.png',
    alt: '首頁橫幅 1'
  },
  {
    url: '/images/home/banner02.png',
    alt: '首頁橫幅 2'
  }
])

// 當前顯示的索引
const currentIndex = ref(0)

// 定時器 ID
let intervalId = null

// 下一張圖片
const nextSlide = () => {
  currentIndex.value = (currentIndex.value + 1) % banners.value.length
}

// 切換到指定圖片
const goToSlide = (index) => {
  currentIndex.value = index
  // 重置定時器
  resetInterval()
}

// 重置定時器
const resetInterval = () => {
  if (intervalId) {
    clearInterval(intervalId)
  }
  startAutoPlay()
}

// 啟動自動輪播
const startAutoPlay = () => {
  intervalId = setInterval(() => {
    nextSlide()
  }, 5000) // 5 秒自動切換
}

// 組件掛載時啟動輪播
onMounted(() => {
  startAutoPlay()
  console.log('[Banner] 輪播已啟動，5 秒自動切換')
})

// 組件卸載時清除定時器
onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId)
    console.log('[Banner] 輪播已停止')
  }
})
</script>

<style scoped>
/* 淡入淡出過渡效果 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from {
  opacity: 0;
}

.fade-leave-to {
  opacity: 0;
}

.fade-enter-to,
.fade-leave-from {
  opacity: 1;
}
</style>
