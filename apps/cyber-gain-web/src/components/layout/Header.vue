<template>
  <header
    class="header-floating fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[500px] z-50 py-3 px-4 flex items-center"
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
          @click="openCurrencyModal"
        >
          <div class="flex items-center gap-1.5 shrink-0">
            <img :src="selectedCurrencyInfo.icon" :alt="selectedCurrency" class="w-4 h-4 object-contain shrink-0" />
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
          <img src="/images/common/plus.svg" alt="" class="w-[22px] h-[22px] object-contain" aria-hidden="true" />
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

    <!-- 選擇貨幣彈窗：底部遮罩 + 依據 footer.pen 設計 -->
    <Teleport to="body">
      <Transition name="currency-modal">
        <div
          v-if="showCurrencyModal"
          class="fixed inset-0 z-[100] flex flex-col justify-end"
          @click.self="closeCurrencyModal"
        >
          <!-- 半透明遮罩：點擊等同關閉 -->
          <div
            class="absolute inset-0 bg-black/50 cursor-pointer"
            aria-hidden="true"
            @click="closeCurrencyModal"
          />
          <!-- 彈窗內容：最高 504px，依貨幣數量自適應高度，無需捲軸時完整顯示 -->
          <div
            class="relative w-full max-w-[500px] mx-auto max-h-[504px] flex flex-col rounded-t-[10px] overflow-hidden bg-[#0f182f]"
            style="box-shadow: 0 -4px 17.5px rgba(253, 199, 0, 0.3)"
          >
            <!-- 主內容區（自適應高度，列表依項目數撐開，超 504 時列表捲動） -->
            <div class="flex flex-col min-h-0 p-4 gap-3">
            <!-- 標題列 -->
            <div class="flex items-center justify-between shrink-0">
              <span class="text-base font-medium text-white">选择货币</span>
              <button
                class="w-8 h-8 flex items-center justify-center text-[#8a8ca6] hover:text-white transition-colors"
                aria-label="关闭"
                @click="closeCurrencyModal"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round" />
                </svg>
              </button>
            </div>
            <!-- 搜尋列：343×52px，聚焦時邊線 #355FD1 -->
            <div class="flex items-center gap-3 h-[52px] rounded-[8px]">
              <div
                class="w-[343px] max-w-full h-[52px] flex items-center gap-3 rounded-[5px] bg-[#0b1223] border px-3 transition-colors shrink-0"
                :class="isSearchFocused ? 'border-[#355FD1]' : 'border-[#1b2a52]'"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="shrink-0 text-[#8a8ca6]">
                  <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5" />
                  <path d="M11 11l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                </svg>
                <input
                  v-model="currencySearch"
                  type="text"
                  placeholder="搜索"
                  class="flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-[#8a8ca6] outline-none h-full"
                  @focus="isSearchFocused = true"
                  @blur="isSearchFocused = false"
                />
              </div>
            </div>
            <!-- 貨幣列表：自適應高度，超 504px 時捲動（每項 h-12 + gap-1.5，固定區約 200px） -->
            <div
              class="flex flex-col gap-1.5 overflow-y-auto shrink-0"
              style="max-height: calc(504px - 200px)"
            >
              <button
                v-for="item in filteredCurrencyList"
                :key="item.code"
                class="flex items-center justify-between h-12 px-3 rounded-[8px] gap-2 shrink-0 transition-colors"
                :class="selectedCurrency === item.code ? 'bg-[#1b2a52]' : 'bg-transparent hover:bg-[#1b2a52]/50'"
                @click="selectCurrency(item.code)"
              >
                <div class="flex items-center gap-2 shrink-0">
                  <img :src="item.icon" :alt="item.code" class="w-6 h-6 object-contain" />
                  <span
                    class="text-base font-medium"
                    :class="selectedCurrency === item.code ? 'text-white' : 'text-[#8a8ca6]'"
                  >
                    {{ item.code }}
                  </span>
                </div>
                <span
                  class="text-sm font-medium"
                  :class="selectedCurrency === item.code ? 'text-white' : 'text-[#8a8ca6]'"
                >
                  {{ getCurrencyBalance(item.code) }}
                </span>
              </button>
            </div>
            </div>
            <!-- 底部區塊（依據 footer.pen Section fill #1b2a52 padding 16） -->
            <div class="flex items-center justify-between shrink-0 p-4 bg-[#1b2a52]">
              <span class="text-xs font-medium text-white">隐藏 0 余额</span>
              <button
                type="button"
                class="relative w-10 h-5 rounded-full p-0.5 cursor-pointer overflow-hidden"
                :class="hideZeroBalance ? 'bg-[#2283f6]' : 'bg-[#0f182f]'"
                style="transition: background-color 0.2s ease"
                @click="hideZeroBalance = !hideZeroBalance"
                aria-label="隐藏 0 余额"
              >
                <div
                  class="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 ease-in-out"
                  :class="hideZeroBalance ? 'left-[22px] bg-white' : 'left-0.5 bg-[#8a8ca6]'"
                />
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 充值內容區塊：與餘額彈窗同結構，點擊黃色方框向上展出，遮罩後方為當前頁面（首頁等） -->
    <DepositSheet
      :model-value="state.showDepositModal"
      @update:model-value="(v) => (state.showDepositModal = v)"
    />
  </header>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { state } from '@/store/index.js'
import { formatBalance } from '@/utils/format.js'
import DepositSheet from '@/components/deposit/DepositSheet.vue'

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

/** 貨幣列表（依據設計稿） */
const CURRENCY_LIST = [
  { code: 'USDT', name: '泰達幣', icon: '/images/common/tetherCoin.png' },
  { code: 'BTC', name: '比特幣', icon: '/images/common/btcCoin.png' },
  { code: 'ETH', name: '以太坊', icon: '/images/common/ethCoin.png' },
  { code: 'BNB', name: '幣安幣', icon: '/images/common/bnbCoin.png' },
  { code: 'TRX', name: '波場幣', icon: '/images/common/trxCoin.png' }
]

/** 選擇貨幣彈窗 */
const showCurrencyModal = ref(false)
const currencySearch = ref('')
const isSearchFocused = ref(false)
const hideZeroBalance = ref(false)
const selectedCurrency = ref('USDT')

const selectedCurrencyInfo = computed(() => {
  const c = CURRENCY_LIST.find((x) => x.code === selectedCurrency.value)
  return c || CURRENCY_LIST[0]
})

const filteredCurrencyList = computed(() => {
  let list = CURRENCY_LIST
  if (currencySearch.value.trim()) {
    const q = currencySearch.value.trim().toLowerCase()
    list = list.filter((x) => x.code.toLowerCase().includes(q) || x.name.includes(q))
  }
  if (hideZeroBalance.value) {
    list = list.filter((x) => parseFloat(getCurrencyBalance(x.code)) > 0)
  }
  return list
})

/** 取得貨幣餘額（目前僅 USDT 接 API，其餘為 0.00；統一小數點後兩位） */
const getCurrencyBalance = (code) => {
  if (code === 'USDT') return formatBalance(state.currentUser?.balance)
  return '0.00'
}

/** 顯示餘額，格式 0.00（依所選貨幣） */
const displayBalance = computed(() => getCurrencyBalance(selectedCurrency.value))

/** 寶箱/獎勵通知數量（暫用佔位，後續可接 API） */
const bonusCount = computed(() => 8)

const openCurrencyModal = () => {
  showCurrencyModal.value = true
  currencySearch.value = ''
}

const closeCurrencyModal = () => {
  showCurrencyModal.value = false
  isSearchFocused.value = false
}

const selectCurrency = (code) => {
  selectedCurrency.value = code
  closeCurrencyModal()
}

const handleLogin = () => {
  router.push({ path: '/auth', query: { tab: 'login' } })
}

const handleRegister = () => {
  router.push({ path: '/auth', query: { tab: 'register' } })
}

const handleDeposit = () => {
  router.push('/wallet/deposit')
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

<style>
/* 選擇貨幣彈窗過渡動畫（非 scoped 以作用於 Teleport 內容） */
.currency-modal-enter-active,
.currency-modal-leave-active {
  transition: opacity 0.25s ease;
}
.currency-modal-enter-active .relative,
.currency-modal-leave-active .relative {
  transition: transform 0.25s ease;
}
.currency-modal-enter-from,
.currency-modal-leave-to {
  opacity: 0;
}
.currency-modal-enter-from .relative,
.currency-modal-leave-to .relative {
  transform: translateY(100%);
}
</style>
