<!-- 模块 1: Header - 顶部导航栏 -->
<!-- 包含：Logo、平台名称、登入/注册/馀额/储值/头像 -->
<template>
  <header class="header">
    <div class="header-container">
      <!-- Logo 区块 - 固定位置：左边 6px，宽 160px，高 35px -->
      <div class="logo-block">
        <!-- 预留平台 logo 区块 -->
        <div class="logo-placeholder">
          <!-- 可以在这里放置实际的 logo 图片 -->
        </div>
      </div>

      <!-- 平台名称 - 与 logo 保持 6px 距离 -->
      <div class="platform-name">
        {{ platformName }}
      </div>

      <!-- Right Actions - 用户认证/钱包/头像区，永远置右对齐 -->
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
  </header>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Wallet, User, UserFilled } from '@element-plus/icons-vue'
import { getCurrentUser, getToken } from '@/store/index.js'
import * as api from '@/api/index.js'

const props = defineProps({
  onWalletClick: Function,
  onPersonalCenterClick: Function,
  onLoginClick: Function,
  onRegisterClick: Function
})

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
  height: 64px;
  border-bottom: 1px solid rgb(var(--border));
  background-color: rgb(var(--background) / 0.95);
  backdrop-filter: blur(8px);
}

.header-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  padding-left: 24px;
  padding-right: var(--space-6);
}

/* Logo 区块 - 固定位置：左边 24px，宽 160px，高 35px，上下置中 */
.logo-block {
  position: absolute;
  left: 24px;
  height: 35px;
  width: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 预留样式，可以放置 logo 图片 */
  /* background-color: rgb(var(--surface-light)); */
  /* border: 1px dashed rgb(var(--border)); */
}

/* 平台名称 - 与 logo 保持 6px 距离，上下置中 */
.platform-name {
  position: absolute;
  left: calc(24px + 160px + 6px); /* logo 左边 24px + logo 宽度 160px + 间距 6px */
  height: 100%;
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: bold;
  color: rgb(var(--foreground));
}

/* Right Actions - 用户认证/钱包/头像区，永远置右对齐，上下置中 */
.header-actions {
  position: absolute;
  right: var(--space-6);
  height: 100%;
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
  background-color: rgb(var(--surface-light) / 0.5);
  border: 1px solid rgb(var(--border));
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--foreground));
}

@media (min-width: 768px) {
  .wallet-balance-desktop {
    display: flex;
  }
}

.deposit-btn :deep(.el-button) {
  height: 32px;
  padding: 0 var(--space-4);
  font-size: 12px;
  font-weight: 600;
  background-color: rgb(var(--primary));
  border-color: rgb(var(--primary));
  color: rgb(var(--primary-foreground));
  border-radius: var(--radius-lg);
}

.deposit-btn :deep(.el-button:hover) {
  background-color: rgb(var(--primary) / 0.9);
  border-color: rgb(var(--primary) / 0.9);
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

