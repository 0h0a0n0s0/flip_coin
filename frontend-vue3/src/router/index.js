import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/components/layout/MainLayout.vue'
import Home from '@/views/Home.vue'
import HashGame from '@/views/HashGame.vue'
import FlipCoinGamePage from '@/views/FlipCoinGamePage.vue'
import BetHistoryPage from '@/views/BetHistoryPage.vue'
import GameListPage from '@/views/GameListPage.vue'

const routes = [
  {
    path: '/',
    component: MainLayout,
    children: [
      {
        path: '',
        name: 'Home',
        component: Home
      },
      {
        path: 'hash',
        name: 'HashGame',
        component: HashGame
      },
      {
        path: 'hash/flip-coin',
        name: 'FlipCoinGame',
        component: FlipCoinGamePage
      },
      {
        path: 'history',
        name: 'BetHistory',
        component: BetHistoryPage
      },
      {
        path: 'sports',
        name: 'Sports',
        component: GameListPage,
        props: { category: 'sports', title: 'Sports' }
      },
      {
        path: 'live-casino',
        name: 'LiveCasino',
        component: GameListPage,
        props: { category: 'live-casino', title: 'Live Casino' }
      },
      {
        path: 'pokers',
        name: 'Pokers',
        component: GameListPage,
        props: { category: 'pokers', title: 'Pokers' }
      },
      {
        path: 'slot',
        name: 'Slot',
        component: GameListPage,
        props: { category: 'slot', title: 'Slot' }
      },
      {
        path: 'arcade',
        name: 'Arcade',
        component: GameListPage,
        props: { category: 'arcade', title: '街机' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router