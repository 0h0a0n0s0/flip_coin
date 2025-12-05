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
      
      // 显示硬币结果
      const outcome = (parseInt(settledBet.tx_hash.slice(-1), 16) % 2 === 0) ? 'head' : 'tail'
      coinResult.value = outcome
      
      return settledBet
    } catch (error) {
      console.warn('Bet failed:', error.message)
      
      if (error.status === 400 || error.status === 401) {
        notifyWarning(`下注失败：${error.message}`)
      } else {
        notifyError(`下注失败：${error.message}`)
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

