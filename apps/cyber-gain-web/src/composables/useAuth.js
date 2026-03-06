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
   * @param {string} username - 帳號（6-32 字，英文大小寫、數字、. _ - @）
   * @param {string} password - 密碼（8-64 字，允許所有字符）
   * @param {string} [confirmPassword] - 確認密碼（可選，傳入時須與 password 一致）
   * @param {string} [referrerCode] - 推薦碼（可選，註冊成功後會嘗試綁定）
   * @returns {Promise<boolean|{success: boolean, errorType: string}>} 成功 true；格式錯誤回傳 { success: false, errorType }
   */
  async function handleRegister(username, password, confirmPassword, referrerCode) {
    if (confirmPassword !== undefined && password !== confirmPassword) {
      notifyError(t('notifications.register_failed') + ': ' + t('auth.confirm_password_placeholder'))
      return false
    }
    // 格式驗證由 Register.vue 在送出前執行，此處不再重複
    const trimmedUsername = (username || '').trim()

    loading.value = true
    try {
      const response = await api.register(trimmedUsername, password, referrerCode)
      const data = (response && response.success && response.data) ? response.data : response
      const { user, token } = data

      if (!user || !token) {
        throw new Error('註冊響應格式錯誤')
      }

      notifySuccess(t('notifications.register_success'))

      setToken(token)
      setCurrentUser(user)

      if (referrerCode && typeof referrerCode === 'string' && referrerCode.trim()) {
        try {
          await api.bindReferrer(token, referrerCode.trim())
          notifySuccess(t('notifications.referrer_bind_success'))
        } catch (bindErr) {
          notifyWarning(t('notifications.referrer_bind_failed') + ': ' + (bindErr.message || ''))
        }
      }

      return true
    } catch (error) {
      const errorCode = error.data?.errorCode
      if (errorCode === 'referral_format_error' || errorCode === 'referral_not_found') {
        return { success: false, errorType: errorCode === 'referral_format_error' ? 'format_error' : 'not_found' }
      }
      if (errorCode === 'username_format') {
        return { success: false, errorType: 'username_format' }
      }
      if (errorCode === 'password_format') {
        return { success: false, errorType: 'password_format' }
      }
      if (error.status === 400) {
        notifyWarning(error.message)
      } else if (error.status >= 500) {
        notifyError(t('notifications.register_failed') + ': ' + (error.message || '') + '。' + t('notifications.server_error_hint'))
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
    const trimmedUsername = (username || '').trim()
    if (!trimmedUsername || !password) {
      notifyError(t('auth.username_placeholder') + ' / ' + t('auth.password_placeholder'))
      return false
    }
    // 登入：相容舊帳號 3-32 字，允許 . _ - @
    if (!/^[a-zA-Z0-9._\-@]{3,32}$/.test(trimmedUsername)) {
      notifyError(t('auth.username_placeholder'))
      return false
    }
    
    loading.value = true
    try {
      const response = await api.login(trimmedUsername, password)
      // (★★★ 修復：適配標準 API 響應格式 { success: true, data: { user, token } } ★★★)
      const data = (response && response.success && response.data) ? response.data : response
      const { user, token } = data
      
      if (!user || !token) {
        throw new Error('登入響應格式錯誤')
      }
      
      notifySuccess(t('notifications.login_success'))
      
      setToken(token)
      setCurrentUser(user)
      
      return true
    } catch (error) {
      if (error.status === 401) {
        notifyWarning(error.message)
      } else if (error.status >= 500) {
        notifyError(t('notifications.login_failed') + ': ' + (error.message || '') + '。' + t('notifications.server_error_hint'))
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
      const response = await api.getUserInfo(token)
      // (★★★ 修復：適配標準 API 響應格式 { success: true, data: user } ★★★)
      const user = (response && response.success && response.data) ? response.data : response
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

