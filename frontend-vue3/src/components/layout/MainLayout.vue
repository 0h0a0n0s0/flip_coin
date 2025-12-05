<template>
  <div class="main-layout-wrapper">
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
        @update:active-category="handleCategoryChange"
        ref="sidebarRef"
      />

      <main class="main-content">
        <router-view />
      </main>
    </div>

    <Footer />

    <MobileBottomNav
      :on-menu-click="openSidebar"
      :on-deposit-click="openWallet"
    />

    <!-- Global Modals -->
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
import { ref, computed, provide, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Header from '@/components/layout/Header.vue'
import Footer from '@/components/layout/Footer.vue'
import LeftSidebar from '@/components/layout/LeftSidebar.vue'
import TopCategoryNav from '@/components/layout/TopCategoryNav.vue'
import MobileBottomNav from '@/components/layout/MobileBottomNav.vue'
import LoginModal from '@/components/auth/LoginModal.vue'
import RegisterModal from '@/components/auth/RegisterModal.vue'
import WalletModal from '@/components/wallet/WalletModal.vue'
import PersonalCenter from '@/components/wallet/PersonalCenter.vue'
import { getToken, getCurrentUser } from '@/store/index.js'
import { useSocket } from '@/composables/useSocket.js'

const router = useRouter()
const route = useRoute()
const { initializeSocket } = useSocket()

const activeCategory = ref('all')

function getCategoryFromRoute(path) {
  if (path === '/' || path === '') return 'all'
  if (path.startsWith('/hash')) return 'hash'
  if (path.startsWith('/trending')) return 'trending'
  if (path.startsWith('/new')) return 'new'
  if (path.startsWith('/slots')) return 'slots'
  if (path.startsWith('/crash')) return 'crash'
  if (path.startsWith('/quick')) return 'quick'
  if (path.startsWith('/tap')) return 'tap'
  if (path.startsWith('/scratch')) return 'scratch'
  if (path.startsWith('/bingo')) return 'bingo'
  if (path.startsWith('/lowdata')) return 'lowdata'
  return 'all'
}

watch(() => route.path, (newPath) => {
  activeCategory.value = getCategoryFromRoute(newPath)
}, { immediate: true })
const showLoginModal = ref(false)
const showRegisterModal = ref(false)
const showWalletModal = ref(false)
const showPersonalCenter = ref(false)
const sidebarRef = ref(null)

const isLoggedIn = computed(() => {
  return !!getToken() && !!getCurrentUser()
})

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

function handleCategoryChange(category) {
  activeCategory.value = category
  
  if (category === 'hash') {
    router.push({ path: '/hash' })
  } else if (category === 'all') {
    router.push({ path: '/' })
  } else {
    router.push({ path: `/${category}` })
  }
}

function handleLoginSuccess() {
  showLoginModal.value = false
  const token = getToken()
  if (token) {
    initializeSocket(token)
  }
}

function handleRegisterSuccess() {
  showRegisterModal.value = false
  const token = getToken()
  if (token) {
    initializeSocket(token)
  }
}

provide('openLogin', openLogin)
provide('openRegister', openRegister)
provide('openWallet', openWallet)
provide('openPersonalCenter', openPersonalCenter)
</script>

<style scoped>
.main-layout-wrapper {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding-bottom: 48px;
}

@media (min-width: 768px) {
  .main-layout-wrapper {
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
  overflow-y: auto;
}
</style>
