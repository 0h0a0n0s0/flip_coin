<template>
  <header class="header">
    <div class="header-container">
      <div class="header-content">
        <!-- Logo -->
        <div class="logo">
          <div class="logo-icon">#</div>
          <span class="logo-text">{{ platformName }}</span>
        </div>

        <!-- Search Bar - Desktop only -->
        <div class="search-bar-desktop">
          <el-input
            v-model="searchQuery"
            placeholder="Search games..."
            class="search-input"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>

        <!-- Right Actions -->
        <div class="header-actions">
          <template v-if="isLoggedIn">
            <!-- Wallet Balance - Desktop -->
            <div class="wallet-balance-desktop">
              <el-icon><Wallet /></el-icon>
              <span>${{ formatBalance(currentUser?.balance) }}</span>
            </div>
            <el-button
              type="primary"
              @click="openWallet"
              class="deposit-btn"
            >
              Deposit
            </el-button>
            <el-button
              circle
              @click="openPersonalCenter"
              class="user-btn"
            >
              <el-icon><User /></el-icon>
            </el-button>
          </template>
          <template v-else>
            <el-button
              text
              @click="openLogin"
              class="login-btn-desktop"
            >
              <el-icon><UserFilled /></el-icon>
              Login
            </el-button>
            <el-button
              type="primary"
              @click="openRegister"
              class="signup-btn"
            >
              Sign Up
            </el-button>
          </template>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Search, Wallet, User, UserFilled } from '@element-plus/icons-vue'
import { getCurrentUser, getToken } from '@/store/index.js'
import * as api from '@/api/index.js'

const props = defineProps({
  onWalletClick: Function,
  onPersonalCenterClick: Function,
  onLoginClick: Function,
  onRegisterClick: Function
})

const searchQuery = ref('')
const platformName = ref('FairHash')

const isLoggedIn = computed(() => {
  return !!getToken() && !!getCurrentUser()
})

const currentUser = computed(() => getCurrentUser())

function formatBalance(balance) {
  if (!balance) return '0.00'
  return parseFloat(balance).toFixed(2)
}

function openWallet() {
  if (props.onWalletClick) props.onWalletClick()
}

function openPersonalCenter() {
  if (props.onPersonalCenterClick) props.onPersonalCenterClick()
}

function openLogin() {
  if (props.onLoginClick) props.onLoginClick()
}

function openRegister() {
  if (props.onRegisterClick) props.onRegisterClick()
}

onMounted(async () => {
  try {
    const data = await api.getPlatformName()
    platformName.value = data.platform_name || 'FairHash'
    document.title = platformName.value
  } catch (error) {
    console.error('Failed to load platform name:', error)
  }
})
</script>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 50;
  border-bottom: 1px solid var(--border);
  background-color: rgba(19, 20, 22, 0.95);
  backdrop-filter: blur(8px);
}

.header-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--space-2) var(--space-3);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.logo {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.logo-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: linear-gradient(to bottom right, var(--accent), var(--accent-secondary));
  font-size: 13px;
  font-weight: bold;
  color: var(--foreground);
}

.logo-text {
  font-size: 16px;
  font-weight: bold;
  color: var(--foreground);
}

.search-bar-desktop {
  display: none;
  flex: 1;
  max-width: 35%;
}

@media (min-width: 768px) {
  .search-bar-desktop {
    display: block;
  }
}

.search-input {
  width: 100%;
}

.search-input :deep(.el-input__inner) {
  height: 32px;
  font-size: 13px;
  background-color: rgba(26, 28, 31, 0.5);
  border-color: var(--border);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.wallet-balance-desktop {
  display: none;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background-color: rgba(26, 28, 31, 0.5);
  border: 1px solid var(--border);
  font-size: 13px;
  font-weight: 600;
  color: var(--foreground);
}

@media (min-width: 768px) {
  .wallet-balance-desktop {
    display: flex;
  }
}

.deposit-btn {
  height: 32px;
  padding: 0 var(--space-4);
  font-size: 12px;
  font-weight: 600;
}

.login-btn-desktop {
  display: none;
  height: 32px;
  padding: 0 var(--space-3);
  font-size: 13px;
}

@media (min-width: 768px) {
  .login-btn-desktop {
    display: inline-flex;
  }
}

.signup-btn {
  height: 32px;
  padding: 0 var(--space-4);
  font-size: 12px;
  font-weight: 600;
}

.user-btn {
  display: none;
  width: 32px;
  height: 32px;
}

@media (min-width: 768px) {
  .user-btn {
    display: inline-flex;
  }
}
</style>

