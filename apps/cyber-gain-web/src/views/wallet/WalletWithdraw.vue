<template>
  <div class="wallet-withdraw-page min-h-screen w-full max-w-[500px] mx-auto bg-[#0B132B]">
    <Header />
    <main class="withdraw-main pt-14 pb-[72px] px-4">
      <div class="flex items-center gap-3 mb-6">
        <router-link
          to="/wallet"
          class="w-7 h-7 flex items-center justify-center rounded-lg bg-[#1b2a52] shrink-0"
          aria-label="返回充提中心"
        >
          <img src="/images/common/vectorLeft.svg" alt="" class="w-4 h-4 object-contain" />
        </router-link>
        <h1 class="text-xl font-medium text-white">提款</h1>
      </div>
      <div class="p-6 rounded-xl bg-[#1b2a52] text-center text-[#8a8ca6]">
        提款功能即將上線
      </div>
    </main>
    <BottomNav />
  </div>
</template>

<script setup>
/**
 * 提款頁面
 * 路徑：/wallet/withdraw
 */
import Header from '@/components/layout/Header.vue'
import BottomNav from '@/components/layout/BottomNav.vue'
</script>
