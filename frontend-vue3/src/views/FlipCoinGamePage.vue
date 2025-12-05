<template>
  <div class="flip-coin-page">
    <FlipCoinGame @bet-success="handleBetSuccess" />
  </div>
</template>

<script setup>
import FlipCoinGame from '@/components/game/FlipCoinGame.vue'
import { useSocket } from '@/composables/useSocket.js'
import { getToken } from '@/store/index.js'
import { onMounted } from 'vue'

const { initializeSocket } = useSocket()

function handleBetSuccess(result) {
  console.log('Bet success:', result)
}

onMounted(() => {
  const token = getToken()
  if (token) {
    initializeSocket(token)
  }
})
</script>

<style scoped>
.flip-coin-page {
  padding: var(--space-4);
  max-width: 1280px;
  margin: 0 auto;
}
</style>
