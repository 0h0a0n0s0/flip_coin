// 钱包相关 composable
// 從 modules/wallet.js 遷移

import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import * as api from '@/api/index.js'
import { getToken, getCurrentUser, setCurrentUser } from '@/store/index.js'
import { notifySuccess, notifyError, notifyWarning } from '@/utils/notify.js'

export function useWallet() {
  const loading = ref(false)
  const depositHistory = ref([])
  const withdrawalHistory = ref([])
  const { t } = useI18n()

  /**
   * 复制地址到剪贴板
   */
  async function copyAddress(address) {
    if (!navigator.clipboard) {
      notifyError(t('notifications.copy_not_supported'))
      return false
    }
    try {
      await navigator.clipboard.writeText(address)
      notifySuccess(t('notifications.copy_success'))
      return true
    } catch (err) {
      notifyError(t('notifications.copy_failed'))
      console.error('Failed to copy text: ', err)
      return false
    }
  }

  /**
   * 获取充值历史
   */
  async function fetchDepositHistory() {
    loading.value = true
    try {
      const token = getToken()
      const response = await api.getDepositHistory(token)
      // (★★★ 修復：適配標準 API 響應格式 { success: true, data: [...] } ★★★)
      const history = (response && response.success && Array.isArray(response.data)) ? response.data : (Array.isArray(response) ? response : [])
      depositHistory.value = history || []
      return history
    } catch (error) {
      console.error('Failed to fetch deposit history:', error)
      depositHistory.value = []
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取提款历史
   */
  async function fetchWithdrawalHistory() {
    loading.value = true
    try {
      const token = getToken()
      const response = await api.getWithdrawalHistory(token)
      // (★★★ 修復：適配標準 API 響應格式 { success: true, data: [...] } ★★★)
      const history = (response && response.success && Array.isArray(response.data)) ? response.data : (Array.isArray(response) ? response : [])
      withdrawalHistory.value = history || []
      return history
    } catch (error) {
      console.error('Failed to fetch withdrawal history:', error)
      withdrawalHistory.value = []
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * 保存昵称
   */
  async function handleSaveNickname(newNickname) {
    if (newNickname.length > 50) {
      notifyError(t('notifications.nickname_too_long'))
      return false
    }
    const currentUser = getCurrentUser()
    if (!newNickname || newNickname === (currentUser?.nickname || '')) {
      notifyWarning(t('notifications.nickname_unchanged'))
      return false
    }

    loading.value = true
    try {
      const token = getToken()
      const response = await api.updateNickname(token, newNickname)
      // (★★★ 修復：適配標準 API 響應格式 { success: true, data: user } ★★★)
      const updatedUser = (response && response.success && response.data) ? response.data : response
      setCurrentUser(updatedUser)
      notifySuccess(t('notifications.nickname_save_success'))
      return true
    } catch (error) {
      notifyError(t('notifications.update_failed') + ': ' + (error.message || ''))
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * 绑定推荐人
   */
  async function handleBindReferrer(referrerCode) {
    if (!referrerCode) {
      notifyError(t('notifications.referrer_code_required'))
      return false
    }
    const currentUser = getCurrentUser()
    if (referrerCode === currentUser?.invite_code) {
      notifyError(t('notifications.referrer_self_bind'))
      return false
    }

    loading.value = true
    try {
      const token = getToken()
      const response = await api.bindReferrer(token, referrerCode)
      // (★★★ 修復：適配標準 API 響應格式 { success: true, data: user } ★★★)
      const updatedUser = (response && response.success && response.data) ? response.data : response
      setCurrentUser(updatedUser)
      notifySuccess(t('notifications.referrer_bind_success'))
      return true
    } catch (error) {
      notifyWarning(t('notifications.referrer_bind_failed') + ': ' + (error.message || ''))
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * 设置提款密码
   */
  async function handleSubmitSetPwd(loginPassword, newPassword, confirmPassword) {
    if (newPassword !== confirmPassword) {
      notifyError(t('notifications.password_mismatch'))
      return false
    }
    if (!loginPassword || newPassword.length < 6) {
      notifyError(t('notifications.password_login_required'))
      return false
    }

    loading.value = true
    try {
      const token = getToken()
      await api.setWithdrawalPassword(token, loginPassword, newPassword)
      notifySuccess(t('notifications.password_set_success'))
      
      // 手动更新本地状态
      const currentUser = getCurrentUser()
      if (currentUser) {
        currentUser.has_withdrawal_password = true
      }
      return true
    } catch (error) {
      notifyError(t('notifications.update_failed') + ': ' + (error.message || ''))
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * 修改提款密码
   */
  async function handleSubmitChangePwd(oldPassword, newPassword, confirmPassword) {
    if (newPassword !== confirmPassword) {
      notifyError(t('notifications.password_mismatch'))
      return false
    }
    if (!oldPassword || newPassword.length < 6) {
      notifyError(t('notifications.password_old_required'))
      return false
    }

    loading.value = true
    try {
      const token = getToken()
      await api.updateWithdrawalPassword(token, oldPassword, newPassword)
      notifySuccess(t('notifications.password_change_success'))
      return true
    } catch (error) {
      notifyError(t('notifications.update_failed') + ': ' + (error.message || ''))
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * 提交提款请求
   */
  async function handleSubmitWithdrawal(chainType, address, amount, withdrawalPassword) {
    if (!chainType || !address || !amount || amount <= 0 || !withdrawalPassword) {
      notifyError(t('notifications.withdraw_fields_required'))
      return false
    }
    
    loading.value = true
    try {
      const token = getToken()
      const data = {
        chain_type: chainType,
        address: address.trim(),
        amount: parseFloat(amount),
        withdrawal_password: withdrawalPassword
      }
      const response = await api.requestWithdrawal(token, data)
      // (★★★ 修復：適配標準 API 響應格式 { success: true, data: { message: ... } } ★★★)
      const result = (response && response.success && response.data) ? response.data : response
      notifySuccess(result.message || t('notifications.withdraw_success'))
      
      // 刷新历史
      await fetchWithdrawalHistory()
      return true
    } catch (error) {
      notifyError(t('notifications.withdraw_failed') + ': ' + (error.message || ''))
      return false
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    depositHistory,
    withdrawalHistory,
    copyAddress,
    fetchDepositHistory,
    fetchWithdrawalHistory,
    handleSaveNickname,
    handleBindReferrer,
    handleSubmitSetPwd,
    handleSubmitChangePwd,
    handleSubmitWithdrawal
  }
}

