<template>
  <div class="main-layout-wrapper">
    <!-- 模块 1: Header - 顶部导航栏（Logo、Search、登入/注册/馀额/储值/头像） -->
    <Header
      :on-wallet-click="openWallet"
      :on-personal-center-click="openPersonalCenter"
      :on-login-click="openLogin"
      :on-register-click="openRegister"
    />

    <!-- 模块 2: TopCategoryNav - Header 下方游戏分类 Tab 区（Home 到 Promotions） -->
    <TopCategoryNav 
      v-model="activeCategory"
      :is-sidebar-collapsed="isSidebarCollapsed"
      @toggle-sidebar="handleToggleSidebar"
    />

    <div class="main-layout">
      <!-- 模块 4: LeftSidebar - 左侧可收缩菜单（游戏分类、搜索） -->
      <LeftSidebar
        :active-category="activeCategory"
        @update:active-category="handleCategoryChange"
        ref="sidebarRef"
      />

      <!-- 模块 3: PageContent - 页面内容区（Banner、游戏列表、最近赢得等） -->
      <main class="main-content" :class="{ 'sidebar-collapsed': isSidebarCollapsed }">
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
import { ref, computed, provide, watch, nextTick } from 'vue'
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
  if (path === '/' || path === '') return 'home'
  if (path.startsWith('/hash')) return 'hash-game'
  if (path.startsWith('/sports')) return 'sports'
  if (path.startsWith('/live-casino')) return 'live-casino'
  if (path.startsWith('/pokers')) return 'pokers'
  if (path.startsWith('/slot')) return 'slot'
  if (path.startsWith('/arcade')) return 'arcade'
  // 保留左侧菜单的分类映射
  if (path.startsWith('/trending')) return 'trending'
  if (path.startsWith('/new')) return 'new'
  if (path.startsWith('/slots')) return 'slots'
  if (path.startsWith('/crash')) return 'crash'
  if (path.startsWith('/quick')) return 'quick'
  if (path.startsWith('/tap')) return 'tap'
  if (path.startsWith('/scratch')) return 'scratch'
  if (path.startsWith('/bingo')) return 'bingo'
  if (path.startsWith('/lowdata')) return 'lowdata'
  return 'home'
}

watch(() => route.path, (newPath) => {
  activeCategory.value = getCategoryFromRoute(newPath)
}, { immediate: true })
const showLoginModal = ref(false)
const showRegisterModal = ref(false)
const showWalletModal = ref(false)
const showPersonalCenter = ref(false)
const sidebarRef = ref(null)
const isSidebarCollapsed = ref(false)

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

function handleToggleSidebar() {
  if (sidebarRef.value) {
    sidebarRef.value.toggleCollapse()
    // 同步状态
    nextTick(() => {
      isSidebarCollapsed.value = sidebarRef.value.isCollapsed
    })
  }
}

// 监听 sidebar 的 collapsed 状态变化
watch(() => sidebarRef.value?.isCollapsed, (newVal) => {
  if (newVal !== undefined) {
    isSidebarCollapsed.value = newVal
  }
}, { immediate: true })

function handleCategoryChange(category) {
  activeCategory.value = category
  
  // 处理 TopCategoryNav 的分类切换
  if (category === 'home') {
    router.push({ path: '/' })
  } else if (category === 'hash-game') {
    router.push({ path: '/hash' })
  } else if (category === 'sports') {
    router.push({ path: '/sports' })
  } else if (category === 'live-casino') {
    router.push({ path: '/live-casino' })
  } else if (category === 'pokers') {
    router.push({ path: '/pokers' })
  } else if (category === 'slot') {
    router.push({ path: '/slot' })
  } else if (category === 'arcade') {
    router.push({ path: '/arcade' })
  } else if (category === 'hash') {
    // 左侧菜单的 hash 分类
    router.push({ path: '/hash' })
  } else if (category === 'all') {
    // 左侧菜单的 all 分类
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
provide('isSidebarCollapsed', isSidebarCollapsed)
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
