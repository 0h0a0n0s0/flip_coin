<template>
  <section class="history" v-if="isLoggedIn">
    <h2>投注历史</h2>
    <ul v-if="historyList.length > 0" class="history-list">
      <li
        v-for="(item, index) in historyList"
        :key="item.id || index"
        class="history-item"
      >
        <span class="time">[{{ formatTime(item.bet_time) }}]</span>
        <span class="choice">选择: {{ item.choice === 'head' ? '正面' : '反面' }}</span>
        <span class="amount">金额: {{ item.amount }} USDT</span>
        <span :class="['status', `status-${item.status}`]">
          {{ getStatusText(item.status) }}
        </span>
        <a
          v-if="item.tx_hash"
          :href="getTxLink(item.tx_hash)"
          target="_blank"
          class="tx-link"
        >
          TX: {{ item.tx_hash.substring(0, 10) }}...
        </a>
      </li>
    </ul>
    <div v-else class="empty">登入後以查看历史记录</div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import * as api from '@/api/index.js'
import { getToken, getCurrentUser } from '@/store/index.js'

const historyList = ref([])
const loading = ref(false)

const isLoggedIn = computed(() => {
  return !!getToken() && !!getCurrentUser()
})

function formatTime(timeString) {
  return new Date(timeString).toLocaleString('zh-CN')
}

function getStatusText(status) {
  const statusMap = {
    won: '✅ 已中奖',
    lost: '❌ 未中奖',
    pending: '⌛️ 待开奖',
    failed: '⚠️ 处理失败'
  }
  return statusMap[status] || '⌛️ 处理中'
}

function getTxLink(txHash) {
  return `https://sepolia.etherscan.io/tx/${txHash}`
}

async function loadHistory() {
  const token = getToken()
  if (!token) {
    historyList.value = []
    return
  }

  loading.value = true
  try {
    const data = await api.getHistory(token)
    historyList.value = data || []
  } catch (error) {
    console.error('Failed to load history:', error)
    historyList.value = []
  } finally {
    loading.value = false
  }
}

function refresh() {
  loadHistory()
}

watch(isLoggedIn, (newVal) => {
  if (newVal) {
    loadHistory()
  } else {
    historyList.value = []
  }
}, { immediate: true })

onMounted(() => {
  if (isLoggedIn.value) {
    loadHistory()
  }
})

defineExpose({
  refresh
})
</script>

<style scoped>
.history {
  padding: var(--space-4);
  background-color: var(--card);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
}

.history h2 {
  margin: 0 0 var(--space-4) 0;
  font-size: 18px;
  color: var(--foreground);
}

.history-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 300px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.history-item {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-2);
  background-color: var(--surface-light);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-family: 'SF Mono', 'Courier New', monospace;
}

.time {
  color: var(--text-muted);
}

.choice {
  color: var(--foreground);
}

.amount {
  color: var(--foreground);
  font-weight: 500;
}

.status {
  font-weight: 500;
}

.status-won {
  color: var(--success);
}

.status-lost {
  color: var(--danger);
}

.status-pending {
  color: var(--text-muted);
}

.status-failed {
  color: var(--danger);
}

.tx-link {
  color: var(--primary);
  text-decoration: none;
}

.tx-link:hover {
  text-decoration: underline;
}

.empty {
  text-align: center;
  color: var(--text-muted);
  padding: var(--space-4);
}
</style>

