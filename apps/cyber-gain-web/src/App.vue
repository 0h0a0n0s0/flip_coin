<template>
  <div class="min-h-screen w-full bg-[#121212] flex justify-center">
    <div class="w-full max-w-[500px] min-h-screen bg-[#0B132B] relative overflow-x-hidden">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth.js'
import { useSocket } from '@/composables/useSocket.js'
import { getToken } from '@/store/index.js'

onMounted(async () => {
  console.log('[Cyber Gain Web] 應用已啟動')
  const { autoLogin } = useAuth()
  const { initializeSocket } = useSocket()
  await autoLogin()
  const token = getToken()
  if (token) {
    initializeSocket(token)
  }
})
</script>

<style>
/* 全局樣式重置 */
body {
  margin: 0;
  padding: 0;
  background-color: #121212;
}

#app {
  min-height: 100vh;
}
</style>
