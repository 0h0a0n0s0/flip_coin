<template>
  <div 
    class="relative shrink-0 rounded-xl overflow-hidden cursor-pointer transform transition-transform duration-200 hover:scale-105 bg-[#111928]"
    :class="sizeClasses"
  >
    <img 
      :src="image" 
      :alt="title"
      class="absolute inset-0 w-full h-full object-cover"
    />
    
    <div class="absolute bottom-0 w-full h-2/3 bg-gradient-to-t from-[#0B132B] via-[#0B132B]/60 to-transparent"></div>
    
    <div 
      v-if="badge"
      class="absolute top-0 right-0 bg-gradient-to-br from-[#E11D48] to-[#EF4444] text-white text-[9px] px-2 py-0.5 rounded-bl-lg rounded-tr-[11px] font-bold shadow-sm z-10"
    >
      {{ badge }}
    </div>
    
    <div class="absolute bottom-0 left-0 w-full px-2 pb-2 pt-1 z-10">
      <h3 class="text-white text-[13px] font-bold leading-none mb-0.5 text-center w-full truncate">
        {{ title }}
      </h3>
      
      <p class="text-gray-400 text-[10px] leading-none mb-1 text-center truncate">
        {{ provider }}
      </p>
      
      <div class="flex justify-between items-center w-full">
        <div class="flex items-center gap-0.5">
          <svg 
            class="w-3 h-3 fill-[#fdc700] drop-shadow-md" 
            viewBox="0 0 20 20"
          >
            <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
          </svg>
          <span class="text-[#fdc700] text-[11px] font-bold">{{ rating }}</span>
        </div>
        
        <span class="text-white text-[11px] font-bold">{{ amount }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// Props 定義
const props = defineProps({
  image: {
    type: String,
    required: true,
    default: 'https://placehold.co/220x280/1a1a2e/eab308?text=+'
  },
  title: {
    type: String,
    required: true,
    default: '遊戲名稱'
  },
  provider: {
    type: String,
    default: 'CYBER GAIN GAMING'
  },
  rating: {
    type: [String, Number],
    default: '4.9'
  },
  amount: {
    type: String,
    default: '$124K'
  },
  badge: {
    type: String,
    default: ''
  },
  isHot: {
    type: Boolean,
    default: false
  },
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['lg', 'md'].includes(value)
  }
})

// 根據 size 計算尺寸類名
const sizeClasses = computed(() => {
  if (props.size === 'lg') {
    return 'w-[120px] aspect-[120/172]'
  }
  return 'w-[110px] aspect-[110/154]'
})
</script>
