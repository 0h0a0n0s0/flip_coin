// 認證相關 composable
// 從 modules/auth.js 遷移

import { ref } from 'vue'
import * as api from '@/api/index.js'
import { setToken, setCurrentUser, clearState, getToken, getCurrentUser } from '@/store/index.js'
import { notifySuccess, notifyError, notifyWarning } from '@/utils/notify.js'

export function useAuth() {
  const loading = ref(false)

  /**
   * 处理用户注册
   */
  async function handleRegister(username, password, confirmPassword) {
    if (password !== confirmPassword) {
      notifyError('两次输入的密码不一致')
      return false
    }
    if (username.length < 3 || username.length > 20) {
      notifyError('帐号长度必须在 3-20 字元之间')
      return false
    }
    if (password.length < 6) {
      notifyError('密码长度至少需要 6 位')
      return false
    }

    loading.value = true
    try {
      const { user, token } = await api.register(username, password)
      notifySuccess('注册成功！已自动登入。')
      
      setToken(token)
      setCurrentUser(user)
      
      return true
    } catch (error) {
      if (error.status === 400) {
        notifyWarning(error.message)
      } else {
        notifyError(`注册失败：${error.message}`)
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
      notifyError('请输入帐号和密码')
      return false
    }
    
    loading.value = true
    try {
      const { user, token } = await api.login(username, password)
      notifySuccess('登入成功！')
      
      setToken(token)
      setCurrentUser(user)
      
      return true
    } catch (error) {
      if (error.status === 401) {
        notifyWarning(error.message)
      } else {
        notifyError(`登入失败：${error.message}`)
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
    notifySuccess('您已成功登出。')
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

