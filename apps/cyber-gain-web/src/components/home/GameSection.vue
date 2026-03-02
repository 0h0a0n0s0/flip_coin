<template>
  <!-- 分類區塊容器（增加底部留白） -->
  <section class="w-full mb-8">
    <!-- 標題區塊（帶微妙漸變背景） -->
    <div class="flex items-center justify-between mb-3 px-2 py-1.5 -mx-2 rounded-lg bg-gradient-to-r from-yellow-500/10 to-transparent">
      <!-- 左側：裝飾線 + 標題與副標題（垂直居中對齊） -->
      <div class="flex items-center gap-2">
        <!-- 黃色垂直裝飾線（與標題等高） -->
        <div class="w-1 h-5 bg-[#fdc700] rounded-full shrink-0"></div>
        
        <!-- 主標題（白色粗體） -->
        <h2 class="text-white text-base font-bold leading-tight whitespace-nowrap">
          {{ title }}
        </h2>
        
        <!-- 副標題（灰色小字、斜體，垂直居中） -->
        <p v-if="subtitle" class="text-[10px] text-[#64748B] italic whitespace-nowrap">
          {{ subtitle }}
        </p>
      </div>
      
      <!-- 右側：查看全部按鈕 -->
      <button 
        class="flex items-center gap-1 text-[#fdc700] text-sm font-medium whitespace-nowrap shrink-0"
        @click="$emit('view-all')"
      >
        查看全部
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
        </svg>
      </button>
    </div>
    
    <!-- 卡片列表區塊：橫向滾動 + 動態漸層遮罩 -->
    <div class="relative">
      <!-- 橫向滾動容器 -->
      <div 
        ref="scrollContainer"
        @scroll="handleScroll"
        :style="maskStyle"
        class="flex overflow-x-auto scrollbar-hide gap-2"
      >
        <GameCard
          v-for="game in games"
          :key="game.id"
          :image="game.image"
          :title="game.title"
          :provider="game.provider"
          :rating="game.rating"
          :amount="game.amount"
          :badge="game.badge"
          :is-hot="game.badge === '热门'"
          :size="size"
        />
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import GameCard from '@/components/ui/GameCard.vue'

// Props 定義
const props = defineProps({
  title: {
    type: String,
    required: true,
    default: '分類標題'
  },
  subtitle: {
    type: String,
    default: ''
  },
  games: {
    type: Array,
    required: true,
    default: () => []
  },
  size: {
    type: String,
    default: 'md'
  }
})

// Emits 定義
defineEmits(['view-all'])

// 滾動容器 ref
const scrollContainer = ref(null)

// 滾動狀態
const isAtStart = ref(true)
const isAtEnd = ref(false)

// 處理滾動事件
const handleScroll = () => {
  if (!scrollContainer.value) return
  
  const { scrollLeft, scrollWidth, clientWidth } = scrollContainer.value
  
  // 判斷是否在最左側（容錯 5px）
  isAtStart.value = scrollLeft <= 5
  
  // 判斷是否在最右側（容錯 5px）
  isAtEnd.value = scrollLeft + clientWidth >= scrollWidth - 5
}

// 動態計算 mask-image 樣式
const maskStyle = computed(() => {
  let maskImage = ''
  
  if (isAtStart.value && !isAtEnd.value) {
    // 在最左側：只顯示右側漸層
    maskImage = 'linear-gradient(to right, black 90%, transparent 100%)'
  } else if (isAtEnd.value && !isAtStart.value) {
    // 在最右側：只顯示左側漸層
    maskImage = 'linear-gradient(to right, transparent 0%, black 10%)'
  } else if (!isAtStart.value && !isAtEnd.value) {
    // 在中間：兩側都顯示漸層
    maskImage = 'linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)'
  } else {
    // 內容不足以滾動：不顯示漸層
    maskImage = 'none'
  }
  
  return {
    maskImage,
    WebkitMaskImage: maskImage
  }
})

// 組件掛載時檢查初始狀態
onMounted(() => {
  if (scrollContainer.value) {
    handleScroll()
    // 監聽窗口大小變化
    window.addEventListener('resize', handleScroll)
  }
})

// 組件卸載時清理
onUnmounted(() => {
  window.removeEventListener('resize', handleScroll)
})
</script>

<style scoped>
/* 隱藏滾動條 */
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
