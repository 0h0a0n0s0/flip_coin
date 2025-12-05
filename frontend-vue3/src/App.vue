<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth.js'
import { useSocket } from '@/composables/useSocket.js'
import { getToken } from '@/store/index.js'

const { autoLogin } = useAuth()
const { initializeSocket } = useSocket()

onMounted(async () => {
  // 自动登录
  await autoLogin()
  
  // 初始化 Socket.IO
  const token = getToken()
  if (token) {
    initializeSocket(token)
  }
})
</script>

<style>
#app {
  min-height: 100vh;
  background-color: var(--background);
  color: var(--foreground);
}
</style>

