// 钱包相关 composable
// 從 modules/wallet.js 遷移

import { ref } from 'vue'
import * as api from '@/api/index.js'
import { getToken, getCurrentUser, setCurrentUser } from '@/store/index.js'
import { notifySuccess, notifyError, notifyWarning } from '@/utils/notify.js'

export function useWallet() {
  const loading = ref(false)
  const depositHistory = ref([])
  const withdrawalHistory = ref([])

  /**
   * 复制地址到剪贴板
   */
  async function copyAddress(address) {
    if (!navigator.clipboard) {
      notifyError('您的浏览器不支持复制功能')
      return false
    }
    try {
      await navigator.clipboard.writeText(address)
      notifySuccess('地址已复制')
      return true
    } catch (err) {
      notifyError('复制失败')
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
      const history = await api.getDepositHistory(token)
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
      const history = await api.getWithdrawalHistory(token)
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
      notifyError('昵称长度不能超过 50 個字元')
      return false
    }
    const currentUser = getCurrentUser()
    if (!newNickname || newNickname === (currentUser?.nickname || '')) {
      notifyWarning('昵称未变更')
      return false
    }

    loading.value = true
    try {
      const token = getToken()
      const updatedUser = await api.updateNickname(token, newNickname)
      setCurrentUser(updatedUser)
      notifySuccess('昵称更新成功！')
      return true
    } catch (error) {
      notifyError(`更新失败：${error.message}`)
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
      notifyError('请输入推薦码')
      return false
    }
    const currentUser = getCurrentUser()
    if (referrerCode === currentUser?.invite_code) {
      notifyError('不能绑定自己的邀请码')
      return false
    }

    loading.value = true
    try {
      const token = getToken()
      const updatedUser = await api.bindReferrer(token, referrerCode)
      setCurrentUser(updatedUser)
      notifySuccess('推薦人绑定成功！')
      return true
    } catch (error) {
      notifyWarning(`绑定失败：${error.message}`)
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
      notifyError('两次输入的新密码不一致')
      return false
    }
    if (!loginPassword || newPassword.length < 6) {
      notifyError('请输入登入密码，且新密码至少 6 位')
      return false
    }

    loading.value = true
    try {
      const token = getToken()
      await api.setWithdrawalPassword(token, loginPassword, newPassword)
      notifySuccess('提款密码设置成功！')
      
      // 手动更新本地状态
      const currentUser = getCurrentUser()
      if (currentUser) {
        currentUser.has_withdrawal_password = true
      }
      return true
    } catch (error) {
      notifyError(`设置失败：${error.message}`)
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
      notifyError('两次输入的新密码不一致')
      return false
    }
    if (!oldPassword || newPassword.length < 6) {
      notifyError('请输入旧密码，且新密码至少 6 位')
      return false
    }

    loading.value = true
    try {
      const token = getToken()
      await api.updateWithdrawalPassword(token, oldPassword, newPassword)
      notifySuccess('提款密码修改成功！')
      return true
    } catch (error) {
      notifyError(`修改失败：${error.message}`)
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
      notifyError('请填寫所有提款栏位')
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
      const result = await api.requestWithdrawal(token, data)
      notifySuccess(result.message || '提款请求已提交！')
      
      // 刷新历史
      await fetchWithdrawalHistory()
      return true
    } catch (error) {
      notifyError(`提交失败：${error.message}`)
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

