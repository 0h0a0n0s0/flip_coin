<template>
  <section class="history" v-if="isLoggedIn">
    <h2>投注历史</h2>
    <ul v-if="displayedHistory.length > 0" class="history-list">
      <li
        v-for="(item, index) in displayedHistory"
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
    
    <!-- 查看更多按钮 -->
    <div v-if="hasMoreHistory" class="view-more">
      <button class="view-more-button" @click="handleViewMore">
        查看更多 →
      </button>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import * as api from '@/api/index.js'
import { getToken, getCurrentUser } from '@/store/index.js'

const router = useRouter()
const route = useRoute()
const historyList = ref([])
const loading = ref(false)
const MAX_DISPLAY = 5 // 最多显示5笔

const props = defineProps({
  // 是否限制显示数量（在投注记录页面显示全部）
  limitDisplay: {
    type: Boolean,
    default: true
  }
})

const isLoggedIn = computed(() => {
  return !!getToken() && !!getCurrentUser()
})

// 根据 limitDisplay prop 决定显示数量
const displayedHistory = computed(() => {
  if (props.limitDisplay) {
    return historyList.value.slice(0, MAX_DISPLAY)
  }
  return historyList.value
})

// 是否有更多记录（只在限制显示时显示）
const hasMoreHistory = computed(() => {
  return props.limitDisplay && historyList.value.length > MAX_DISPLAY
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

function handleViewMore() {
  // 跳转到投注记录页面
  router.push({ path: '/history' })
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

.view-more {
  margin-top: var(--space-3);
  text-align: center;
}

.view-more-button {
  font-size: 12px;
  font-weight: 500;
  color: var(--primary);
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  transition: all 0.2s;
}

.view-more-button:hover {
  background-color: rgb(var(--primary) / 0.1);
  color: #E5B530;
}
</style>

