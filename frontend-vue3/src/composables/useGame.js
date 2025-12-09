// 游戏相关 composable
// 從 modules/game.js 遷移

import { ref } from 'vue'
import * as api from '@/api/index.js'
import { getToken, getCurrentUser, setBettingState, getBettingState } from '@/store/index.js'
import { notifySuccess, notifyError, notifyWarning } from '@/utils/notify.js'

export function useGame() {
  const betting = ref(false)
  const coinResult = ref(null) // 'head' or 'tail'

  /**
   * 处理确认下注
   */
  async function handleConfirmBet(choice, amount) {
    if (getBettingState()) {
      notifyError('正在处理上一笔下注，请稍候...')
      return
    }

    const currentUser = getCurrentUser()

    if (!choice) {
      notifyError('请选择正面或反面')
      return
    }
    if (isNaN(amount) || amount <= 0) {
      notifyError('请输入有效的下注金额')
      return
    }
    if (currentUser && amount > parseFloat(currentUser.balance)) {
      notifyError('余额不足')
      return
    }

    setBettingState(true)
    betting.value = true
    notifySuccess('注单已提交，正在等待链上开奖...')

    try {
      const token = getToken()
      const settledBet = await api.placeBet(token, choice, amount)
      
      console.log('Bet settled:', settledBet)
      
      if (settledBet.status === 'won') {
        notifySuccess(`恭喜中奖！`)
      } else if (settledBet.status === 'lost') {
        notifyError('可惜，未中奖')
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
          notifyError('余额不足，请先充值')
        } else if (errorMessage.includes('链上交易失败') || errorMessage.includes('On-chain transaction failed')) {
          notifyWarning('链上交易失败，资金已自动退回，请稍后重试')
        } else if (errorMessage.includes('帐号已被禁用') || errorMessage.includes('Account disabled')) {
          notifyError('账户已被禁用，请联系客服')
        } else {
          notifyWarning(`下注失败：${errorMessage}`)
        }
      } else if (error.status === 401) {
        // 认证错误
        notifyError('登录已过期，请重新登录')
      } else if (error.status === 503) {
        // 服务不可用
        notifyError('投注服务暂未就绪，请稍后重试')
      } else {
        // 其他错误（网络错误、服务器错误等）
        notifyError(`下注失败：${errorMessage}`)
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

