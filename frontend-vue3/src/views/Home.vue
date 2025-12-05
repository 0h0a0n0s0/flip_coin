<template>
  <div class="home-page">
    <Header
      :on-wallet-click="openWallet"
      :on-personal-center-click="openPersonalCenter"
      :on-login-click="openLogin"
      :on-register-click="openRegister"
    />

    <TopCategoryNav v-model="activeCategory" />

    <div class="main-layout">
      <LeftSidebar
        :active-category="activeCategory"
        @update:active-category="activeCategory = $event"
        ref="sidebarRef"
      />

      <main class="main-content">
        <!-- Hero Strip -->
        <div class="hero-strip">
          <h1>Win Big with Crypto Fairness</h1>
          <p>Transparent blockchain gaming • Instant crypto payouts</p>
        </div>

        <div class="content-container">
          <!-- Flip Coin Game -->
          <FlipCoinGame @bet-success="handleBetSuccess" />

          <!-- Leaderboard -->
          <Leaderboard ref="leaderboardRef" />

          <!-- History -->
          <History v-if="isLoggedIn" />
        </div>
      </main>
    </div>

    <Footer />

    <MobileBottomNav
      :on-menu-click="openSidebar"
      :on-deposit-click="openWallet"
    />

    <!-- Modals -->
    <LoginModal
      v-model="showLoginModal"
      @success="handleLoginSuccess"
    />
    <RegisterModal
      v-model="showRegisterModal"
      @success="handleRegisterSuccess"
    />
    <WalletModal
      v-model="showWalletModal"
    />
    <PersonalCenter
      v-model="showPersonalCenter"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import Header from '@/components/layout/Header.vue'
import Footer from '@/components/layout/Footer.vue'
import LeftSidebar from '@/components/layout/LeftSidebar.vue'
import TopCategoryNav from '@/components/layout/TopCategoryNav.vue'
import MobileBottomNav from '@/components/layout/MobileBottomNav.vue'
import FlipCoinGame from '@/components/game/FlipCoinGame.vue'
import Leaderboard from '@/components/common/Leaderboard.vue'
import History from '@/components/common/History.vue'
import LoginModal from '@/components/auth/LoginModal.vue'
import RegisterModal from '@/components/auth/RegisterModal.vue'
import WalletModal from '@/components/wallet/WalletModal.vue'
import PersonalCenter from '@/components/wallet/PersonalCenter.vue'
import { getToken, getCurrentUser } from '@/store/index.js'
import { useSocket } from '@/composables/useSocket.js'

const activeCategory = ref('home')
const showLoginModal = ref(false)
const showRegisterModal = ref(false)
const showWalletModal = ref(false)
const showPersonalCenter = ref(false)
const sidebarRef = ref(null)
const leaderboardRef = ref(null)

const isLoggedIn = computed(() => {
  return !!getToken() && !!getCurrentUser()
})

const { initializeSocket } = useSocket()

function openLogin() {
  showLoginModal.value = true
}

function openRegister() {
  showRegisterModal.value = true
}

function openWallet() {
  showWalletModal.value = true
}

function openPersonalCenter() {
  showPersonalCenter.value = true
}

function openSidebar() {
  if (sidebarRef.value) {
    sidebarRef.value.openDrawer()
  }
}

function handleLoginSuccess() {
  showLoginModal.value = false
  const token = getToken()
  if (token) {
    initializeSocket(token, {
      onLeaderboardUpdated: (data) => {
        if (leaderboardRef.value) {
          leaderboardRef.value.updateData(data)
        }
      }
    })
  }
}

function handleRegisterSuccess() {
  showRegisterModal.value = false
  const token = getToken()
  if (token) {
    initializeSocket(token, {
      onLeaderboardUpdated: (data) => {
        if (leaderboardRef.value) {
          leaderboardRef.value.updateData(data)
        }
      }
    })
  }
}

function handleBetSuccess() {
  // 刷新排行榜等
  if (leaderboardRef.value) {
    leaderboardRef.value.refresh()
  }
}
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding-bottom: 48px;
}

@media (min-width: 768px) {
  .home-page {
    padding-bottom: 0;
  }
}

.main-layout {
  display: flex;
  flex: 1;
}

.main-content {
  flex: 1;
  min-width: 0;
  padding: var(--space-4);
}

.hero-strip {
  background: linear-gradient(to right, rgba(243, 195, 64, 0.2), rgba(138, 108, 244, 0.2));
  border-bottom: 1px solid var(--border);
  padding: var(--space-6);
  margin-bottom: var(--space-4);
  border-radius: var(--radius-md);
}

.hero-strip h1 {
  font-size: 24px;
  margin-bottom: var(--space-2);
  background: linear-gradient(to right, var(--primary), var(--accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-strip p {
  color: var(--text-muted);
  font-size: 13px;
}

.content-container {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

@media (min-width: 768px) {
  .hero-strip h1 {
    font-size: 32px;
  }
}
</style>

