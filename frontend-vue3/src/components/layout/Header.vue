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
              {{ t('header.deposit') }}
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
              {{ t('header.login') }}
            </el-button>
            <el-button
              type="primary"
              @click="openRegister"
              class="signup-btn"
            >
              {{ t('header.sign_up') }}
            </el-button>
          </template>
        </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Wallet, User, UserFilled } from '@element-plus/icons-vue'
import { getCurrentUser, getToken } from '@/store/index.js'
import * as api from '@/api/index.js'

const { t } = useI18n()

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
/* 全局样式覆盖 - 针对 Deposit 按钮 */
</style>

<style>
/* 非 scoped 样式，确保能覆盖 Element Plus 默认样式 */
/* 使用最高优先级选择器覆盖所有可能的 Element Plus 样式 */
.header-actions .deposit-btn.el-button.el-button--primary,
.header-actions .deposit-btn.el-button.el-button--primary.el-button,
.header-actions .deposit-btn.el-button.el-button--primary .el-button__wrapper,
.header-actions .el-button.deposit-btn.el-button--primary,
button.deposit-btn.el-button.el-button--primary,
button.el-button.el-button--primary.deposit-btn {
  width: 82.97px !important;
  height: 32px !important;
  min-width: 82.97px !important;
  max-width: 82.97px !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  box-sizing: border-box !important;
  line-height: 1 !important;
  margin: 0 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.header-actions .deposit-btn.el-button.el-button--primary span,
.header-actions .deposit-btn.el-button.el-button--primary .el-button__wrapper span,
button.deposit-btn.el-button.el-button--primary span {
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}
</style>

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

/* 强制固定 Deposit 按钮尺寸 - 使用更高优先级的选择器 */
.deposit-btn.el-button,
.deposit-btn :deep(.el-button),
.deposit-btn :deep(.el-button__wrapper),
.header-actions .deposit-btn,
.header-actions .deposit-btn.el-button {
  width: 82.97px !important; /* 固定宽度，强制应用 */
  height: 32px !important; /* 固定高度，强制应用 */
  min-width: 82.97px !important; /* 确保最小宽度也是固定值 */
  max-width: 82.97px !important; /* 确保最大宽度也是固定值 */
  padding: 0 !important; /* 移除内边距，确保精确尺寸 */
  font-size: 12px !important;
  font-weight: 600 !important;
  background-color: rgb(var(--primary)) !important;
  border-color: rgb(var(--primary)) !important;
  color: rgb(var(--primary-foreground)) !important;
  border-radius: var(--radius-lg) !important;
  white-space: nowrap !important; /* 防止文字换行 */
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  overflow: hidden !important; /* 如果文字过长则隐藏 */
  text-overflow: ellipsis !important; /* 文字过长显示省略号 */
  box-sizing: border-box !important; /* 确保边框计算在内 */
  line-height: 1 !important; /* 防止行高影响高度 */
  margin: 0 !important; /* 移除外边距 */
}

.deposit-btn.el-button:hover,
.deposit-btn :deep(.el-button:hover),
.header-actions .deposit-btn:hover {
  width: 82.97px !important; /* hover 时也保持固定宽度 */
  height: 32px !important; /* hover 时也保持固定高度 */
  min-width: 82.97px !important;
  max-width: 82.97px !important;
  background-color: rgb(var(--primary) / 0.9) !important;
  border-color: rgb(var(--primary) / 0.9) !important;
}

.login-btn-desktop {
  display: none;
  height: 32px;
  min-width: 70px; /* 固定最小宽度 */
  padding: 0 var(--space-3);
  font-size: 13px;
  white-space: nowrap; /* 防止文字换行 */
}

@media (min-width: 768px) {
  .login-btn-desktop {
    display: inline-flex;
  }
}

.signup-btn {
  height: 32px;
  min-width: 90px; /* 固定最小宽度，适应 "Sign Up" */
  padding: 0 var(--space-4);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap; /* 防止文字换行 */
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

