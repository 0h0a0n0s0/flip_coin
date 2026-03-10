import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home.vue'
import Register from '@/views/Register.vue'
import Wallet from '@/views/wallet/Wallet.vue'
import WalletDeposit from '@/views/wallet/WalletDeposit.vue'
import WalletWithdraw from '@/views/wallet/WalletWithdraw.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/auth',
    name: 'Auth',
    component: Register
  },
  {
    path: '/wallet',
    name: 'Wallet',
    component: Wallet
  },
  {
    path: '/wallet/deposit',
    name: 'WalletDeposit',
    component: WalletDeposit
  },
  {
    path: '/wallet/withdraw',
    name: 'WalletWithdraw',
    component: WalletWithdraw
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
