<template>
  <!-- 主選單 Tab 容器：深色背景，圓角，負 margin 往上覆蓋，銳利的頂部金邊 -->
  <div class="relative bg-[#111928] rounded-t-2xl -mt-4 py-2 px-4 shadow-lg border-t-[1.5px] border-[#EAB308]/60 shadow-[0_-2px_15px_rgba(234,179,8,0.12)]">
    <!-- 橫向滾動 Tab 列表 -->
    <div class="flex overflow-x-auto scrollbar-hide whitespace-nowrap gap-6 h-[32px] items-center">
      <!-- Tab 項目 -->
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="activeTab = tab.id"
        :class="[
          'flex flex-row items-center gap-1 shrink-0 transition-colors duration-200 whitespace-nowrap relative h-[32px]',
          activeTab === tab.id ? 'text-[#fdc700]' : 'text-[#8a8ca6]'
        ]"
      >
        <!-- Icon 容器 (20x20) -->
        <div class="w-[20px] h-[20px] flex items-center justify-center shrink-0 relative">
          <component :is="tab.icon" :is-active="activeTab === tab.id" class="w-full h-full" />
        </div>
        
        <!-- 文字 -->
        <span 
          :class="[
            'text-sm font-medium whitespace-nowrap leading-none',
            activeTab === tab.id ? 'font-bold' : 'font-normal'
          ]"
        >
          {{ tab.label }}
        </span>
        
        <!-- Active 狀態金色發光效果（底部） -->
        <div 
          v-if="activeTab === tab.id" 
          class="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-[2px] bg-yellow-500 blur-[4px] opacity-50"
        ></div>
      </button>
    </div>
    
    <!-- 右側漸層遮罩（滾動提示） -->
    <div class="absolute right-0 top-0 w-8 h-full bg-gradient-to-l from-[#111928] to-transparent pointer-events-none"></div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import IconHome from '@/components/icons/IconHome.vue'
import IconHash from '@/components/icons/IconHash.vue'
import IconSports from '@/components/icons/IconSports.vue'
import IconLive from '@/components/icons/IconLive.vue'
import IconPoker from '@/components/icons/IconPoker.vue'
import IconSlots from '@/components/icons/IconSlots.vue'
import IconArcade from '@/components/icons/IconArcade.vue'

// 當前選中的 Tab
const activeTab = ref('home')

// Tab 列表（使用自定義 SVG 圖標組件）
const tabs = ref([
  { id: 'home', label: '首页', icon: IconHome },
  { id: 'hash', label: '哈希游戏', icon: IconHash },
  { id: 'sports', label: '体育', icon: IconSports },
  { id: 'live', label: '真人娱乐', icon: IconLive },
  { id: 'poker', label: '扑克', icon: IconPoker },
  { id: 'slots', label: '老虎机', icon: IconSlots },
  { id: 'arcade', label: '街机', icon: IconArcade }
])
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
