<template>
  <!-- 頂部導航欄：絕對定位懸浮，帶頂部漸層 -->
  <header class="absolute top-0 left-0 w-full z-50 bg-gradient-to-b from-black/60 to-transparent py-3 px-4 flex justify-between items-center">
    <!-- 左側 Logo 區 -->
    <div class="flex items-center gap-2 shrink-0">
      <!-- Logo 圖片 -->
      <img src="/images/common/platformLogo.svg" alt="CYBER GAIN" class="w-[161px] h-[35px]" />
    </div>

    <!-- 右側按鈕區 -->
    <div class="flex items-center gap-2 shrink-0">
      <!-- 登入按鈕 -->
      <button 
        class="h-[34px] min-w-[54px] px-[10px] flex items-center justify-center bg-[#1b2a52] text-[#d1d5dc] text-sm font-medium rounded-[8px] whitespace-nowrap"
        @click="handleLogin"
      >
        登入
      </button>

      <!-- 註冊按鈕（含徽章） -->
      <button 
        class="relative h-[34px] min-w-[96px] px-[10px] flex items-center justify-center bg-gradient-to-br from-[#f6ff92] to-[#fdc700] text-[#101828] text-sm font-medium rounded-[8px] whitespace-nowrap shadow-[0_2px_0_0_#a27f00,0_0_5.25px_0_#ffe500b2]"
        @click="handleRegister"
      >
        註冊
        
        <!-- 徽章 (+150%) - 絕對定位 -->
        <span class="absolute -top-2 -right-2 flex items-center justify-center bg-[#E11D48] text-white text-[10px] font-bold px-1.5 h-[16px] rounded-full border border-[#0B132B] whitespace-nowrap z-10">
          <!-- 黃色圓點代表金幣 -->
          <span class="w-2 h-2 bg-yellow-400 rounded-full mr-1"></span>
          +150%
        </span>
      </button>
    </div>
  </header>
</template>

<script setup>
// 登入按鈕處理函數
const handleLogin = () => {
  console.log('[Header] 登入按鈕點擊')
  // 後續可路由到登入頁
}

// 註冊按鈕處理函數
const handleRegister = () => {
  console.log('[Header] 註冊按鈕點擊')
  // 後續可路由到註冊頁
}
</script>

<style scoped>
/* 如需額外樣式可在此處添加 */
</style>
