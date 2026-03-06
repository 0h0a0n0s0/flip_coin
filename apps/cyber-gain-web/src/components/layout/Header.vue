<template>
  <header
    class="header-floating fixed top-0 left-0 w-full z-50 py-3 px-4 flex items-center"
    :class="isLoggedIn ? 'gap-[100px]' : 'justify-between'"
    :style="{ backgroundColor: headerBgStyle }"
  >
    <!-- 左側：CG Logo（登入後區塊僅包含圖片本身，無多餘容器空間） -->
    <div
      class="flex items-center shrink-0 h-[35px]"
      :class="isLoggedIn ? 'w-fit' : 'w-[161px]'"
    >
      <img
        :src="isLoggedIn ? '/images/common/platformLogoNoWord.svg' : '/images/common/platformLogo.svg'"
        alt="CYBER GAIN"
        class="h-full w-auto max-w-full object-contain object-left"
      />
    </div>

    <!-- 右側：登入前 vs 登入後 -->
    <div v-if="!isLoggedIn" class="flex items-center gap-2 shrink-0 ml-auto">
      <button
        class="h-[34px] min-w-[54px] px-[10px] flex items-center justify-center bg-[#1b2a52] text-[#d1d5dc] text-sm font-medium rounded-[8px] whitespace-nowrap"
        @click="handleLogin"
      >
        登入
      </button>
      <button
        class="relative h-[34px] min-w-[96px] px-[10px] flex items-center justify-center bg-gradient-to-br from-[#f6ff92] to-[#fdc700] text-[#101828] text-sm font-medium rounded-[8px] whitespace-nowrap shadow-[0_2px_0_0_#a27f00,0_0_5.25px_0_#ffe500b2]"
        @click="handleRegister"
      >
        註冊
        <span class="absolute -top-2 -right-2 flex items-center justify-center bg-[#E11D48] text-white text-[10px] font-bold px-1.5 h-[16px] rounded-full border border-[#0B132B] whitespace-nowrap z-10">
          <span class="w-2 h-2 bg-yellow-400 rounded-full mr-1"></span>
          +150%
        </span>
      </button>
    </div>

    <!-- 登入後：餘額區塊+加值按鈕（連成一體） + 頭像 + 寶箱；整體靠右，寶箱距畫面內容右緣 16px -->
    <div v-else class="flex items-center gap-2 shrink-0 ml-auto">
      <!-- 餘額區塊 + 黃色方框：總寬至少 128×36px，餘額區可伸長；深藍底多延伸 8px 填補重合 -->
      <div class="flex shrink-0 h-[36px] min-w-[128px]">
        <button
          class="h-[36px] min-w-[94px] pl-2 pr-3 flex items-center justify-between gap-1.5 bg-[#1b2a52] text-[#d1d5dc] rounded-l-[8px] rounded-r-none -mr-4 shrink-0"
          @click="handleDeposit"
        >
          <div class="flex items-center gap-1.5 shrink-0">
            <img src="/images/common/tetherCoin.png" alt="USDT" class="w-4 h-4 object-contain shrink-0" />
            <span class="text-sm font-medium whitespace-nowrap">{{ displayBalance }}</span>
          </div>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="shrink-0">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <!-- 黃色方框：34×34px（含下緣陰影），垂直置中，靠右對齊紫色框區塊右緣 -->
        <button
          class="relative z-10 ml-auto h-[34px] w-[34px] min-h-[34px] min-w-[34px] max-h-[34px] max-w-[34px] flex items-center justify-center bg-gradient-to-br from-[#f6ff92] to-[#fdc700] text-[#101828] rounded-[8px] border-b-2 border-[#a27f00] shadow-[0_0_5.25px_0_#ffe500b2] shrink-0 box-border self-center"
          @click="handleDeposit"
          aria-label="充值"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M4 7h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <!-- 頭像：圓形，使用 avatar.png -->
      <button class="w-[34px] h-[34px] rounded-full overflow-hidden shrink-0 flex-shrink-0" @click="handleAvatar" aria-label="個人中心">
        <img src="/images/common/avatar.png" alt="頭像" class="w-full h-full object-cover" />
      </button>

      <!-- 寶箱圖示 + 紅色通知徽章 -->
      <button class="relative w-[34px] h-[34px] flex items-center justify-center shrink-0 focus:outline-none ring-0 focus:ring-0 focus:ring-0" @click="handleBonus" aria-label="獎勵入口">
        <img src="/images/common/bonusEntry.png" alt="獎勵" class="w-full h-full object-contain" />
        <span
          v-if="bonusCount > 0"
          class="absolute right-0 top-0 translate-x-1/2 -translate-y-1/2 flex items-center justify-center bg-[#E11D48] text-white text-[10px] font-bold rounded-[4px] py-[1.5px] px-[2px] whitespace-nowrap outline-none ring-0"
        >
          {{ bonusCount > 99 ? '99+' : bonusCount }}
        </span>
      </button>
    </div>
  </header>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { state } from '@/store/index.js'

const router = useRouter()

/** 滾動過渡範圍：0px ~ 150px */
const SCROLL_RANGE = 150
/** 品牌背景色 Dark Navy #0B132B */
const BRAND_BG_RGB = '11, 19, 43'

/** 滾動位置對應的 alpha 值 (0~1) */
const scrollAlpha = ref(0)

/** 根據 scrollAlpha 計算 header 背景色 */
const headerBgStyle = computed(() => {
  const alpha = scrollAlpha.value
  return `rgba(${BRAND_BG_RGB}, ${alpha})`
})

/** 滾動事件處理：在 0~150px 範圍內線性計算 alpha */
const handleScroll = () => {
  const y = typeof window !== 'undefined' ? window.scrollY ?? window.pageYOffset : 0
  scrollAlpha.value = Math.min(1, Math.max(0, y / SCROLL_RANGE))
}

onMounted(() => {
  handleScroll() // 初始化
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})

/** 是否已登入（依 state.currentUser 響應式切換） */
const isLoggedIn = computed(() => !!state.currentUser)

/** 顯示餘額，格式 0.00 */
const displayBalance = computed(() => {
  const bal = state.currentUser?.balance
  if (bal == null || bal === '') return '0.00'
  const n = parseFloat(bal)
  return isNaN(n) ? '0.00' : n.toFixed(2)
})

/** 寶箱/獎勵通知數量（暫用佔位，後續可接 API） */
const bonusCount = computed(() => 8)

const handleLogin = () => {
  router.push({ path: '/auth', query: { tab: 'login' } })
}

const handleRegister = () => {
  router.push({ path: '/auth', query: { tab: 'register' } })
}

const handleDeposit = () => {
  // TODO: 開啟充值彈窗或導向充值頁
  console.log('[Header] 充值')
}

const handleAvatar = () => {
  // TODO: 開啟個人中心或導向設定頁
  console.log('[Header] 頭像')
}

const handleBonus = () => {
  // TODO: 開啟獎勵入口
  console.log('[Header] 獎勵入口')
}
</script>

<style scoped>
.header-floating {
  transition: background-color 0.3s ease;
}
</style>
