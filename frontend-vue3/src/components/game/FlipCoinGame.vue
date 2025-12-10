<template>
  <section class="flip-coin-game">
    <div class="game-header">
      <h2>{{ gameName }}</h2>
      <div class="streak-info" v-if="currentUser">
        <span v-if="currentStreak > 0" class="streak-positive">
          🔥 連胜 {{ currentStreak }} 场
        </span>
        <span v-else-if="currentStreak < 0" class="streak-negative">
          🥶 連败 {{ Math.abs(currentStreak) }} 场
        </span>
        <span v-if="maxStreak > 0" class="max-streak">
          最高連胜: {{ maxStreak }}
        </span>
      </div>
    </div>

    <div class="coin-container">
      <div
        class="coin"
        :class="{
          flipping: betting,
          'show-head': coinResult === 'head',
          'show-tail': coinResult === 'tail'
        }"
      >
        <div class="coin-front"></div>
        <div class="coin-back"></div>
      </div>
    </div>

    <div class="bet-controls">
      <div class="choice-group">
        <el-radio-group v-model="selectedChoice">
          <el-radio label="head">正面</el-radio>
          <el-radio label="tail">反面</el-radio>
        </el-radio-group>
      </div>

      <div class="amount-input">
        <el-input
          v-model.number="betAmount"
          type="number"
          placeholder="下注金额 (USDT)"
          step="0.01"
          :min="0.01"
        />
      </div>

      <el-button
        type="primary"
        @click="handleBet"
        :loading="betting"
        :disabled="!canBet"
        class="bet-button"
      >
        {{ betting ? '下注中...' : '确认下注' }}
      </el-button>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useGame } from '@/composables/useGame.js'
import { getCurrentUser, getGamesCache, setGamesCache } from '@/store/index.js'
import { notifyError } from '@/utils/notify.js'
import { getGames } from '@/api/index.js'
import { useLanguage } from '@/composables/useLanguage.js'

const props = defineProps({
  onBetSuccess: Function
})

const emit = defineEmits(['bet-success'])

const { betting, coinResult, handleConfirmBet } = useGame()
const { language, getGameName } = useLanguage()
const selectedChoice = ref('head')
const betAmount = ref('')

const currentUser = computed(() => getCurrentUser())
const currentStreak = computed(() => currentUser.value?.current_streak || 0)
const maxStreak = computed(() => currentUser.value?.max_streak || 0)

// 游戏信息
const gameInfo = ref(null)
const isLoadingGameInfo = ref(true)

const gameName = computed(() => {
  // 读取 language.value 以确保响应式追踪
  // 当 language 变化时，这个 computed 会重新计算
  const currentLang = language.value
  if (gameInfo.value) {
    // 根据当前语言显示名称：
    // - 中文环境（zh-CN）：显示 name_zh（游戏名字）
    // - 英文环境（en-US）：显示 name_en（英文名字）
    return getGameName(gameInfo.value)
  }
  // 如果正在加载，返回空字符串（避免显示预设值）
  if (isLoadingGameInfo.value) {
    return ''
  }
  // 只有在加载完成且没有找到游戏信息时，才返回默认名称
  return 'Flip Coin'
})

// 获取游戏信息
async function fetchGameInfo() {
  isLoadingGameInfo.value = true
  try {
    // 先尝试从缓存中获取游戏列表
    let games = getGamesCache()
    
    // 如果缓存中没有，则从 API 获取
    if (!games) {
      games = await getGames()
      // 更新缓存
      setGamesCache(games)
    }
    
    // 查找 Flip Coin 游戏（优先使用 game_code，如果没有则使用名称匹配）
    const flipCoin = games.find(g => g.game_code === 'flip-coin' || g.name_zh === 'Flip Coin' || g.name_en === 'FlipCoin')
    if (flipCoin) {
      gameInfo.value = flipCoin
    }
  } catch (error) {
    console.error('Failed to fetch game info:', error)
  } finally {
    isLoadingGameInfo.value = false
  }
}

// 监听语言变化，确保游戏名称更新
// gameName computed 会自动响应 language 的变化
watch(language, (newLang) => {
  console.log('[FlipCoinGame] Language changed to:', newLang)
  // computed 会自动重新计算，这里只是用于调试
})

// 在 setup 中立即开始获取游戏信息，而不是等到 onMounted
// 这样可以尽快获取数据，减少预设值显示的时间
  fetchGameInfo()

const canBet = computed(() => {
  return selectedChoice.value && betAmount.value > 0 && !betting.value && currentUser.value
})

async function handleBet() {
  if (!canBet.value) return

  const amount = parseFloat(betAmount.value)
  if (isNaN(amount) || amount <= 0) return

  try {
    const result = await handleConfirmBet(selectedChoice.value, amount)
    if (result && props.onBetSuccess) {
      props.onBetSuccess(result)
    }
    emit('bet-success', result)
  } catch (error) {
    console.error('Bet failed:', error)
    // 后备错误处理：如果 useGame 中的错误处理没有正常工作，这里确保用户能看到错误
    // 注意：useGame 中已经会显示错误通知，这里主要是作为最后的保障
    // 但是，如果是余额不足导致的pending_tx状态，不应该显示错误
    if (error && error.message) {
      // 检查是否是余额不足相关错误，如果是则不显示错误
      if (error.message.includes('INSUFFICIENT_BALANCE') || 
          error.message.includes('余额不足') ||
          error.message.includes('pending_tx')) {
        // 余额不足的情况已经在后端处理为pending_tx，不显示错误
        return
      }
      if (!error.message.includes('下注失败')) {
        notifyError(`投注处理失败：${error.message}`)
      }
    }
  }
}
</script>

<style scoped>
.flip-coin-game {
  padding: var(--space-4);
  background-color: var(--card);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.game-header h2 {
  margin: 0;
  font-size: 20px;
  color: var(--foreground);
}

.streak-info {
  display: flex;
  gap: var(--space-3);
  font-size: 14px;
}

.streak-positive {
  background-color: rgb(var(--success) / 0.2);
  color: rgb(var(--success));
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.streak-negative {
  background-color: rgb(var(--danger) / 0.2);
  color: rgb(var(--danger));
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.max-streak {
  color: var(--text-muted);
  font-size: 12px;
}

.coin-container {
  width: 150px;
  height: 150px;
  perspective: 1000px;
  margin: var(--space-6) auto;
}

.coin {
  width: 100%;
  height: 100%;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.8s;
}

.coin.flipping {
  animation: flip 1.5s infinite linear;
}

.coin.show-head {
  transform: rotateY(0deg);
}

.coin.show-tail {
  transform: rotateY(1800deg);
}

.coin-front,
.coin-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 50%;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.coin-front {
  background-color: #ffd700;
  background-image: url('https://i.imgur.com/KydL1m2.png');
  background-size: 60%;
  background-repeat: no-repeat;
  background-position: center;
}

.coin-back {
  background-color: #c0c0c0;
  background-image: url('https://i.imgur.com/KxT5GjQ.png');
  background-size: 60%;
  background-repeat: no-repeat;
  background-position: center;
  transform: rotateY(180deg);
}

@keyframes flip {
  0% {
    transform: rotateY(0deg);
  }
  100% {
    transform: rotateY(360deg);
  }
}

.bet-controls {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-top: var(--space-6);
}

.choice-group {
  display: flex;
  justify-content: center;
}

.amount-input {
  width: 100%;
  max-width: 300px;
  margin: 0 auto;
}

.bet-button {
  width: 100%;
  max-width: 300px;
  margin: 0 auto;
  height: 40px;
  font-size: 16px;
  font-weight: 600;
}

@media (max-width: 767px) {
  .coin-container {
    width: 120px;
    height: 120px;
  }

  .game-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }
}
</style>

