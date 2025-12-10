// 認證相關 composable
// 從 modules/auth.js 遷移

import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import * as api from '@/api/index.js'
import { setToken, setCurrentUser, clearState, getToken, getCurrentUser } from '@/store/index.js'
import { notifySuccess, notifyError, notifyWarning } from '@/utils/notify.js'

export function useAuth() {
  const loading = ref(false)
  const { t } = useI18n()

  /**
   * 处理用户注册
   */
  async function handleRegister(username, password, confirmPassword) {
    if (password !== confirmPassword) {
      notifyError(t('notifications.register_failed') + ': ' + t('auth.confirm_password_placeholder'))
      return false
    }
    if (username.length < 3 || username.length > 20) {
      notifyError(t('auth.username_register_placeholder'))
      return false
    }
    if (password.length < 6) {
      notifyError(t('auth.password_register_placeholder'))
      return false
    }

    loading.value = true
    try {
      const { user, token } = await api.register(username, password)
      notifySuccess(t('notifications.register_success'))
      
      setToken(token)
      setCurrentUser(user)
      
      return true
    } catch (error) {
      if (error.status === 400) {
        notifyWarning(error.message)
      } else {
        notifyError(t('notifications.register_failed') + ': ' + (error.message || ''))
      }
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * 处理用户登录
   */
  async function handleLogin(username, password) {
    if (!username || !password) {
      notifyError(t('auth.username_placeholder') + ' / ' + t('auth.password_placeholder'))
      return false
    }
    
    loading.value = true
    try {
      const { user, token } = await api.login(username, password)
      notifySuccess(t('notifications.login_success'))
      
      setToken(token)
      setCurrentUser(user)
      
      return true
    } catch (error) {
      if (error.status === 401) {
        notifyWarning(error.message)
      } else {
        notifyError(t('notifications.login_failed') + ': ' + (error.message || ''))
      }
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * 处理用户登出
   */
  function handleLogout() {
    clearState()
    notifySuccess(t('notifications.logout_success'))
  }

  /**
   * 自动登录（从 localStorage 恢复）
   */
  async function autoLogin() {
    const savedToken = localStorage.getItem('jwt_token')
    if (savedToken) {
      console.log('Found saved JWT, attempting to login...')
      setToken(savedToken)
      await fetchUserInfo(savedToken)
    }
  }

  /**
   * 获取用户信息
   */
  async function fetchUserInfo(token) {
    try {
      const user = await api.getUserInfo(token)
      setCurrentUser(user)
    } catch (error) {
      console.error('Auto-login failed:', error.message)
      handleLogout()
    }
  }

  return {
    loading,
    handleLogin,
    handleRegister,
    handleLogout,
    autoLogin,
    fetchUserInfo,
    getToken,
    getCurrentUser
  }
}

