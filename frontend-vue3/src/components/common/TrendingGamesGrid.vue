<template>
  <section class="trending-games-section">
    <div class="section-header">
      <div>
        <h2 class="section-title">Trending Now</h2>
        <p class="section-subtitle">24h Volume Leaders</p>
      </div>
      <button class="view-all-button">
        View All →
      </button>
    </div>

    <div class="games-grid" v-loading="loading">
      <GameCard
        v-for="game in games"
        :key="game.id"
        :game="game"
        @play="handlePlay"
        @click="handleGameClick"
      />
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getGames } from '@/api/index.js'
import { getGamesCache, setGamesCache } from '@/store/index.js'
import { useLanguage } from '@/composables/useLanguage.js'
import GameCard from '@/components/ui/GameCard.vue'

const router = useRouter()
const { language, getGameName } = useLanguage()

const gamesData = ref([]) // 存储原始游戏数据
const loading = ref(false)

// 根据当前语言计算游戏名称（响应式）
// 注意：需要依赖 language 来确保语言切换时重新计算
const games = computed(() => {
  // 读取 language.value 以确保响应式追踪
  // 当 language 变化时，这个 computed 会重新计算
  const currentLang = language.value
  return gamesData.value.map(game => ({
    ...game,
    // 根据当前语言显示名称：
    // - 中文环境（zh-CN）：显示 name_zh（游戏名字）
    // - 英文环境（en-US）：显示 name_en（英文名字）
    name: getGameName(game)
  }))
})

// 从 API 获取游戏列表
async function fetchGames() {
  loading.value = true
  try {
    // 先尝试从缓存中获取游戏列表
    let gamesList = getGamesCache()
    
    // 如果缓存中没有，则从 API 获取
    if (!gamesList) {
      gamesList = await getGames()
      // 更新缓存
      setGamesCache(gamesList)
    }
    
    // 存储原始游戏数据
    gamesData.value = gamesList.map(game => ({
      id: game.id,
      game_code: game.game_code,
      name_zh: game.name_zh,
      name_en: game.name_en,
      provider: game.provider || '自营',
      thumbnail: null,
      icon: null,
      hot: game.game_status === '热门',
      new: game.game_status === '新游戏',
      recommended: game.game_status === '推荐',
      rating: 4.8,
      volume: '$124K',
      status: game.status
    }))
  } catch (error) {
    console.error('Failed to fetch games:', error)
    // 如果 API 失败，使用默认的 Flip Coin
    gamesData.value = [{
    id: 'flip-coin',
      game_code: 'flip-coin',
      name_zh: 'Flip Coin',
      name_en: 'FlipCoin',
      provider: '自营',
    thumbnail: null,
    icon: null,
    hot: true,
    new: false,
    rating: 4.8,
    volume: '$124K'
    }]
  } finally {
    loading.value = false
  }
}

function handlePlay(game) {
  // 根据游戏代码判断路由
  if (game.game_code === 'flip-coin') {
    router.push({ path: '/hash/flip-coin' })
  } else if (game.game_code) {
    // 如果有其他游戏代码，可以根据代码路由
    router.push({ path: `/hash/${game.game_code}` })
  }
}

function handleGameClick(game) {
  handlePlay(game)
}

onMounted(() => {
  fetchGames()
})
</script>

<style scoped>
.trending-games-section {
  padding: var(--space-2) 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: calc(var(--space-2) + var(--space-1));
}

.section-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--foreground);
  margin: 0;
  line-height: 1.2;
}

@media (min-width: 768px) {
  .section-title {
    font-size: 18px;
  }
}

.section-subtitle {
  font-size: 10px;
  color: var(--text-muted);
  margin: var(--space-1) 0 0 0;
  line-height: 1.2;
}

@media (min-width: 768px) {
  .section-subtitle {
    font-size: 11px;
  }
}

.view-all-button {
  font-size: 11px;
  font-weight: 500;
  color: var(--primary);
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.2s;
  padding: 0;
}

.view-all-button:hover {
  color: #E5B530;
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);
}

@media (min-width: 768px) {
  .games-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-2);
  }
}

@media (min-width: 1024px) {
  .games-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-2);
  }
}

@media (min-width: 1280px) {
  .games-grid {
    grid-template-columns: repeat(5, 1fr);
    gap: var(--space-2);
  }
}
</style>
