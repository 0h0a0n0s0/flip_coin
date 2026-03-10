<template>
  <div class="wallet-deposit-page min-h-screen w-full max-w-[500px] mx-auto bg-[#0B132B]">
    <Header />
    <!-- 路由頁面：充提中心作為襯底，關閉時返回 /wallet -->
    <main class="deposit-route-backdrop min-h-screen pt-14 pb-[72px]" />
    <BottomNav />
  </div>
</template>

<script setup>
/**
 * 充值內容區塊 - 路由版
 * 路徑：/wallet/deposit
 * 進入時自動展開充值彈窗，遮罩後方為充提中心
 */
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { state, openDepositModal } from '@/store/index.js'
import Header from '@/components/layout/Header.vue'
import BottomNav from '@/components/layout/BottomNav.vue'

const router = useRouter()

onMounted(() => {
  openDepositModal()
})

watch(
  () => state.showDepositModal,
  (v) => {
    if (!v) {
      router.replace('/wallet')
    }
  }
)
</script>
