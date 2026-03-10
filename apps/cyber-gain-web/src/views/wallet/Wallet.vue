<template>
  <div class="wallet-page min-h-screen w-full max-w-[500px] mx-auto bg-[#0B132B]">
    <Header />
    <div class="wallet-content pt-14 pb-[72px] px-4">
      <h1 class="text-xl font-medium text-white mb-6">充提中心</h1>
      <div class="flex flex-col gap-4">
        <router-link
          to="/wallet/deposit"
          class="flex items-center justify-between p-4 rounded-xl bg-[#1b2a52] text-white hover:bg-[#1b2a52]/90 transition-colors"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-[#0f182f] flex items-center justify-center">
              <img src="/images/common/tetherCoin.png" alt="" class="w-6 h-6 object-contain" />
            </div>
            <div>
              <div class="font-medium">加密貨幣充值</div>
              <div class="text-sm text-[#8a8ca6]">存入 USDT 至錢包</div>
            </div>
          </div>
          <img src="/images/common/vectorLeft.svg" alt="" class="w-4 h-4 rotate-180" />
        </router-link>
        <router-link
          to="/wallet/withdraw"
          class="flex items-center justify-between p-4 rounded-xl bg-[#1b2a52] text-white hover:bg-[#1b2a52]/90 transition-colors"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-[#0f182f] flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" class="text-[#8a8ca6]">
                <path d="M12 4v16m0-16l4 4m-4-4l-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <div>
              <div class="font-medium">提款</div>
              <div class="text-sm text-[#8a8ca6]">提取 USDT 至外部錢包</div>
            </div>
          </div>
          <img src="/images/common/vectorLeft.svg" alt="" class="w-4 h-4 rotate-180" />
        </router-link>
      </div>
    </div>
    <BottomNav />
  </div>
</template>

<script setup>
/**
 * 充提中心 - 錢包主頁
 * 路徑：/wallet
 */
import Header from '@/components/layout/Header.vue'
import BottomNav from '@/components/layout/BottomNav.vue'
</script>
