// 游戏相关 composable
// 從 modules/game.js 遷移

import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import * as api from '@/api/index.js'
import { getToken, getCurrentUser, setBettingState, getBettingState } from '@/store/index.js'
import { notifySuccess, notifyError, notifyWarning } from '@/utils/notify.js'

export function useGame() {
  const betting = ref(false)
  const coinResult = ref(null) // 'head' or 'tail'
  const { t } = useI18n()

  /**
   * 处理确认下注
   */
  async function handleConfirmBet(choice, amount) {
    if (getBettingState()) {
      notifyError(t('notifications.bet_processing'))
      return
    }

    const currentUser = getCurrentUser()

    if (!choice) {
      notifyError(t('notifications.bet_choice_required'))
      return
    }
    if (isNaN(amount) || amount <= 0) {
      notifyError(t('notifications.bet_amount_required'))
      return
    }
    if (currentUser && amount > parseFloat(currentUser.balance)) {
      notifyError(t('notifications.bet_insufficient_balance'))
      return
    }

    setBettingState(true)
    betting.value = true
    notifySuccess(t('notifications.bet_success'))

    try {
      const token = getToken()
      const settledBet = await api.placeBet(token, choice, amount)
      
      console.log('Bet settled:', settledBet)
      
      // 如果是 pending_tx 状态（余额不足，等待补开），不显示任何额外提示
      // 因为已经在第39行显示了"注单已提交，正在等待链上开奖..."
      if (settledBet.status === 'pending_tx') {
        // 不显示任何提示，只返回注单
        return settledBet
      }
      
      if (settledBet.status === 'won') {
        notifySuccess(t('notifications.bet_won'))
      } else if (settledBet.status === 'lost') {
        notifyError(t('notifications.bet_lost'))
      }
      
      // 显示硬币结果（检查 tx_hash 是否存在）
      if (settledBet.tx_hash) {
      const outcome = (parseInt(settledBet.tx_hash.slice(-1), 16) % 2 === 0) ? 'head' : 'tail'
      coinResult.value = outcome
      } else {
        // 如果没有 tx_hash，根据 status 推断结果
        coinResult.value = settledBet.status === 'won' ? 'head' : 'tail'
      }
      
      return settledBet
    } catch (error) {
      console.warn('Bet failed:', error.message)
      
      // 根据错误类型提供更详细的错误提示
      let errorMessage = error.message || '未知错误'
      
      // 错误分类处理
      if (error.status === 400) {
        // 客户端错误（参数错误、余额不足等）
        if (errorMessage.includes('余额不足') || errorMessage.includes('Insufficient balance')) {
          notifyError(t('notifications.bet_insufficient_funds'))
        } else if (errorMessage.includes('链上交易失败') || errorMessage.includes('On-chain transaction failed')) {
          // 检查是否是余额不足导致的链上交易失败
          // 如果是余额不足，不应该显示错误，因为注单已经被标记为pending_tx
          if (errorMessage.includes('INSUFFICIENT_BALANCE') || errorMessage.includes('余额不足')) {
            // 余额不足的情况已经在后端处理为pending_tx，不应该进入这里
            // 但如果进入了，说明可能是其他原因，不显示错误
            return // 静默处理，不显示错误
          }
          notifyWarning(t('notifications.bet_transaction_failed'))
        } else if (errorMessage.includes('帐号已被禁用') || errorMessage.includes('Account disabled')) {
          notifyError(t('notifications.bet_account_disabled'))
        } else {
          notifyWarning(t('notifications.bet_failed') + ': ' + errorMessage)
        }
      } else if (error.status === 401) {
        // 认证错误
        notifyError(t('notifications.bet_login_expired'))
      } else if (error.status === 503) {
        // 服务不可用
        notifyError(t('notifications.bet_service_not_ready'))
      } else {
        // 其他错误（网络错误、服务器错误等）
        notifyError(t('notifications.bet_failed') + ': ' + errorMessage)
      }
      
      throw error
    } finally {
      setBettingState(false)
      betting.value = false
    }
  }

  return {
    betting,
    coinResult,
    handleConfirmBet
  }
}

