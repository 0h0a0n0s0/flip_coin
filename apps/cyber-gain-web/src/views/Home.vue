<template>
  <div class="home-page">
    <Header />

    <Banner />

    <HomeTabs />

    <div class="space-y-6 pt-4 px-4">
      <GameSection
        title="热门游戏"
        subtitle="24小时交易量领先"
        :games="hotGames"
        size="lg"
        @view-all="handleViewAll('hot')"
      />

      <GameSection
        title="体育"
        subtitle="实时赛事投注"
        :games="sportsGames"
        @view-all="handleViewAll('sports')"
      />

      <GameSection
        title="真人娱乐"
        subtitle="线上互动体验"
        :games="liveGames"
        @view-all="handleViewAll('live')"
      />

      <GameSection
        title="扑克"
        subtitle="经典策略游戏"
        :games="pokerGames"
        @view-all="handleViewAll('poker')"
      />

      <GameSection
        title="老虎机"
        subtitle="刺激转盘奖励"
        :games="slotsGames"
        @view-all="handleViewAll('slots')"
      />

      <GameSection
        title="街机"
        subtitle="复古经典游戏"
        :games="arcadeGames"
        @view-all="handleViewAll('arcade')"
      />
    </div>

    <Leaderboard />

    <div class="pb-20">
      <Footer />
    </div>

    <BottomNav />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Header from '@/components/layout/Header.vue'
import Footer from '@/components/layout/Footer.vue'
import BottomNav from '@/components/layout/BottomNav.vue'
import Banner from '@/components/common/Banner.vue'
import HomeTabs from '@/components/home/HomeTabs.vue'
import GameSection from '@/components/home/GameSection.vue'
import Leaderboard from '@/components/home/Leaderboard.vue'

// Mock Data - 熱門遊戲
const hotGames = ref([
  {
    id: 1,
    image: '/images/games/card_1.png',
    title: '哈希闪电轮盘',
    provider: 'CYBER GAIN GAMING',
    rating: '4.9',
    amount: '$124K',
    badge: '热门'
  },
  {
    id: 2,
    image: '/images/games/card_2.png',
    title: '哈希大小',
    provider: 'CYBER GAIN GAMING',
    rating: '4.9',
    amount: '$124K',
    badge: '热门'
  },
  {
    id: 3,
    image: '/images/games/card_3.png',
    title: '哈希单双',
    provider: 'CYBER GAIN GAMING',
    rating: '4.9',
    amount: '$124K',
    badge: ''
  },
  {
    id: 4,
    image: 'https://placehold.co/220x280/8b5cf6/ffffff?text=+',
    title: '哈希猜拳',
    provider: 'CYBER GAIN GAMING',
    rating: '4.8',
    amount: '$98K',
    badge: ''
  },
  {
    id: 5,
    image: 'https://placehold.co/220x280/ec4899/ffffff?text=+',
    title: '哈希百家乐',
    provider: 'CYBER GAIN GAMING',
    rating: '4.9',
    amount: '$156K',
    badge: ''
  },
  {
    id: 6,
    image: 'https://placehold.co/220x280/f43f5e/ffffff?text=+',
    title: '哈希龙虎',
    provider: 'CYBER GAIN GAMING',
    rating: '4.7',
    amount: '$89K',
    badge: ''
  }
])

// Mock Data - 體育
const sportsGames = ref([
  {
    id: 11,
    image: '/images/games/card_4.png',
    title: 'IM 体育',
    provider: 'SPORTS',
    rating: '4.9',
    amount: '$124K',
    badge: ''
  },
  {
    id: 12,
    image: '/images/games/card_5.png',
    title: 'BTI 体育',
    provider: 'SPORTS',
    rating: '4.9',
    amount: '$124K',
    badge: ''
  },
  {
    id: 13,
    image: '/images/games/card_6.png',
    title: 'WG 体育',
    provider: 'SPORTS',
    rating: '4.9',
    amount: '$124K',
    badge: ''
  }
])

// Mock Data - 真人娛樂
const liveGames = ref([
  {
    id: 21,
    image: '/images/games/card_7.png',
    title: '百家乐',
    provider: 'ONLINE',
    rating: '4.9',
    amount: '$124K',
    badge: ''
  },
  {
    id: 22,
    image: '/images/games/card_8.png',
    title: '百家乐',
    provider: 'ONLINE',
    rating: '4.9',
    amount: '$124K',
    badge: ''
  },
  {
    id: 23,
    image: '/images/games/card_9.png',
    title: '百家乐',
    provider: 'ONLINE',
    rating: '4.0',
    amount: '$124K',
    badge: ''
  }
])

// Mock Data - 撲克
const pokerGames = ref([
  {
    id: 31,
    image: '/images/games/card_10.png',
    title: '封神',
    provider: 'CYBER GAIN GAMING',
    rating: '4.9',
    amount: '$124K',
    badge: '热门'
  },
  {
    id: 32,
    image: '/images/games/card_11.png',
    title: '超级王牌',
    provider: 'CYBER GAIN GAMING',
    rating: '4.9',
    amount: '$124K',
    badge: ''
  },
  {
    id: 33,
    image: '/images/games/card_12.png',
    title: '迦罗宝石2',
    provider: 'CYBER GAIN GAMING',
    rating: '4.9',
    amount: '$124K',
    badge: ''
  }
])

// Mock Data - 老虎機
const slotsGames = ref([
  {
    id: 41,
    image: 'https://placehold.co/220x280/f59e0b/ffffff?text=+',
    title: '超级王牌',
    provider: 'CYBER GAIN GAMING',
    rating: '4.9',
    amount: '$124K',
    badge: '热门'
  },
  {
    id: 42,
    image: 'https://placehold.co/220x280/eab308/ffffff?text=+',
    title: '幸运宝石2',
    provider: 'CYBER GAIN GAMING',
    rating: '4.9',
    amount: '$124K',
    badge: '热门'
  },
  {
    id: 43,
    image: 'https://placehold.co/220x280/3b82f6/ffffff?text=+',
    title: '封神',
    provider: 'CYBER GAIN GAMING',
    rating: '4.9',
    amount: '$124K',
    badge: ''
  }
])

// Mock Data - 街機
const arcadeGames = ref([
  {
    id: 51,
    image: 'https://placehold.co/220x280/f59e0b/ffffff?text=+',
    title: '幸运宝石2',
    provider: 'CYBER GAIN GAMING',
    rating: '4.9',
    amount: '$124K',
    badge: ''
  },
  {
    id: 52,
    image: 'https://placehold.co/220x280/6366f1/ffffff?text=+',
    title: '封神',
    provider: 'CYBER GAIN GAMING',
    rating: '4.9',
    amount: '$124K',
    badge: ''
  },
  {
    id: 53,
    image: 'https://placehold.co/220x280/f59e0b/ffffff?text=+',
    title: '超级王牌',
    provider: 'CYBER GAIN GAMING',
    rating: '4.9',
    amount: '$124K',
    badge: ''
  }
])

// 處理查看全部
const handleViewAll = (category) => {
  console.log(`[Home] 查看全部 - ${category}`)
}

onMounted(() => {
  console.log('[Cyber Gain Web] 首頁已載入')
})
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  width: 100%;
}
</style>
