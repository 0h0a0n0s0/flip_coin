import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/components/layout/MainLayout.vue'
import Home from '@/views/Home.vue'
import HashGame from '@/views/HashGame.vue'
import FlipCoinGamePage from '@/views/FlipCoinGamePage.vue'

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
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router