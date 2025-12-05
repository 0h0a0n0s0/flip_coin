<template>
  <div class="winner-ticker">
    <div class="ticker-header">
      <div class="header-icon">
        <Trophy class="icon" />
      </div>
      <div>
        <h3 class="ticker-title">Latest Wins</h3>
        <p class="ticker-subtitle">Live results from players</p>
      </div>
    </div>

    <div class="ticker-list" ref="listRef">
      <div
        v-for="(win, index) in wins"
        :key="win.id || index"
        class="ticker-item"
        :class="{ 'is-new': win.isNew }"
      >
        <div class="ticker-item-left">
          <div class="item-icon">
            <Lightning class="icon-small" />
          </div>
          <div class="item-info">
            <div class="item-user-row">
              <span class="item-user">{{ win.user }}</span>
              <span class="item-won-text">won</span>
            </div>
            <span class="item-game">{{ win.game }}</span>
          </div>
        </div>
        <div class="ticker-item-right">
          <div class="item-amount">{{ win.amount }}</div>
          <div class="item-time">{{ win.time }}</div>
        </div>
        <span v-if="win.multiplier" class="item-multiplier">
          {{ win.multiplier }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Trophy, Lightning } from '@element-plus/icons-vue'
import { useSocket } from '@/composables/useSocket.js'
import { getToken } from '@/store/index.js'

const wins = ref([])
const listRef = ref(null)
let socket = null

function formatUserDisplayName(username) {
  if (!username) return 'Anonymous***'
  if (username.length <= 6) return username + '***'
  const visible = username.substring(0, 3)
  return visible + '***' + username.substring(username.length - 2)
}

function formatAmount(amount) {
  const num = parseFloat(amount)
  if (isNaN(num)) return '0 USDT'
  if (num >= 1) {
    return num.toFixed(2) + ' USDT'
  }
  return num.toFixed(4) + ' USDT'
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Just now'
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function addWin(winData) {
  const win = {
    id: Date.now() + Math.random(),
    user: formatUserDisplayName(winData.username || winData.user),
    game: winData.game || 'Flip Coin',
    amount: formatAmount(winData.amount || winData.win_amount || 0),
    multiplier: winData.multiplier ? `${winData.multiplier}x` : null,
    time: formatTimeAgo(winData.timestamp || winData.bet_time),
    timestamp: winData.timestamp || winData.bet_time || Date.now(),
    isNew: true
  }
  
  wins.value.unshift(win)
  
  if (wins.value.length > 15) {
    wins.value = wins.value.slice(0, 15)
  }
  
  setTimeout(() => {
    const winIndex = wins.value.findIndex(w => w.id === win.id)
    if (winIndex !== -1) {
      wins.value[winIndex].isNew = false
    }
  }, 1000)
}

function initializeSocketListener() {
  const token = getToken()
  if (!token) return
  
  const { initializeSocket, getSocket } = useSocket()
  
  socket = initializeSocket(token, {
    onBetUpdated: (betData) => {
      if (betData.status === 'won' && betData.amount) {
        addWin({
          username: betData.username,
          game: 'Flip Coin',
          amount: betData.amount * 2,
          multiplier: '2x',
          timestamp: new Date(betData.settled_at || Date.now()).getTime()
        })
      }
    },
    onLeaderboardUpdated: (data) => {
      if (Array.isArray(data) && data.length > 0) {
        const latestWinner = data[0]
        if (latestWinner && latestWinner.max_streak > 0) {
          addWin({
            username: latestWinner.username || latestWinner.display_name,
            game: 'Flip Coin',
            amount: 'N/A',
            timestamp: Date.now()
          })
        }
      }
    }
  })
}

onMounted(() => {
  initializeSocketListener()
  
  setTimeout(() => {
    initializeSocketListener()
  }, 1000)
})

onUnmounted(() => {
  if (socket) {
    socket.disconnect()
  }
})
</script>

<style scoped>
.winner-ticker {
  background-color: rgba(26, 28, 31, 0.4);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-2);
}

@media (min-width: 768px) {
  .winner-ticker {
    padding: calc(var(--space-2) + var(--space-1));
  }
}

.ticker-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, rgba(243, 195, 64, 0.3), rgba(138, 108, 244, 0.3));
  border: 1px solid rgba(243, 195, 64, 0.5);
}

.header-icon .icon {
  width: 14px;
  height: 14px;
  color: var(--primary);
}

.ticker-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--foreground);
  margin: 0;
  line-height: 1.2;
}

.ticker-subtitle {
  font-size: 10px;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.2;
}

.ticker-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-height: 240px;
  overflow-y: auto;
  padding-right: var(--space-1);
}

.ticker-list::-webkit-scrollbar {
  width: 4px;
}

.ticker-list::-webkit-scrollbar-track {
  background: transparent;
}

.ticker-list::-webkit-scrollbar-thumb {
  background-color: var(--border);
  border-radius: 2px;
}

.ticker-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-md);
  background-color: rgba(138, 108, 244, 0.3);
  border: 1px solid transparent;
  transition: all 0.3s;
}

.ticker-item.is-new {
  border-color: rgba(243, 195, 64, 0.5);
  background-color: rgba(243, 195, 64, 0.1);
}

.ticker-item-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

.item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, rgba(138, 108, 244, 0.2), rgba(107, 76, 230, 0.2));
}

.icon-small {
  width: 10px;
  height: 10px;
  color: var(--accent);
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-user-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: 2px;
}

.item-user {
  font-size: 11px;
  font-weight: 600;
  color: var(--foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-won-text {
  font-size: 10px;
  color: var(--text-muted);
  display: none;
}

@media (min-width: 640px) {
  .item-won-text {
    display: inline;
  }
}

.item-game {
  display: block;
  font-size: 10px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ticker-item-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

.item-amount {
  font-size: 11px;
  font-weight: 700;
  color: var(--primary);
  line-height: 1.2;
}

.item-time {
  font-size: 9px;
  color: var(--text-muted);
  line-height: 1.2;
}

.item-multiplier {
  font-size: 10px;
  font-weight: 700;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, rgba(138, 108, 244, 0.2), rgba(107, 76, 230, 0.2));
  border: 1px solid rgba(138, 108, 244, 0.5);
  color: var(--accent);
  flex-shrink: 0;
}
</style>
