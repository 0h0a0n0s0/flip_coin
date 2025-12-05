// Socket.IO 连接管理 composable
// 從 modules/socket.js 遷移

import { onUnmounted } from 'vue'
import { io } from 'socket.io-client'
import { getToken, getCurrentUser, setCurrentUser, setSocket, getSocket, getBettingState, clearState } from '@/store/index.js'
import { notifySuccess, notifyError } from '@/utils/notify.js'

export function useSocket() {
  let socket = null

  /**
   * 初始化 Socket.IO 连接
   */
  function initializeSocket(token, callbacks = {}) {
    const existingSocket = getSocket()
    if (existingSocket) {
      existingSocket.disconnect()
    }
    
    socket = io(window.location.origin, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling']
    })

    socket.on('connect', () => {
      console.log('[Socket.io] Connected with token.')
    })
    
    socket.on('connect_error', (err) => {
      console.error('[Socket.io] Connection Error:', err.message)
      if (err.message === 'Authentication error: Invalid token' || 
          err.message === 'Authentication error: User not found or disabled.') {
        clearState()
        notifyError('連线已过期，请重新登入。')
        // 触发页面刷新或重定向到登录
        if (typeof window !== 'undefined') {
          window.location.reload()
        }
      }
    })
    
    socket.on('bet_updated', async (betData) => {
      console.log('[Socket.io] Received bet update:', betData)
      if (callbacks.onBetUpdated) {
        callbacks.onBetUpdated(betData)
      }
    })

    socket.on('user_info_updated', (fullUser) => {
      console.log('[Socket.io] Received FULL user info update:', fullUser)
      const currentUser = getCurrentUser()
      if (currentUser && currentUser.id === fullUser.id) {
        const oldBalance = currentUser.balance
        setCurrentUser(fullUser)
        
        // 只有在非下注状态 且 余额真的变动时 才弹出提示
        if (!getBettingState() && oldBalance !== fullUser.balance) {
          notifySuccess(`帐户已更新！新余额: ${parseFloat(fullUser.balance).toFixed(2)} USDT`)
        }
        
        if (callbacks.onUserUpdated) {
          callbacks.onUserUpdated(fullUser)
        }
      }
    })
    
    socket.on('leaderboard_updated', async (leaderboardData) => {
      console.log('[Socket.io] Received leaderboard update:', leaderboardData)
      if (callbacks.onLeaderboardUpdated) {
        callbacks.onLeaderboardUpdated(leaderboardData)
      }
    })
    
    socket.on('disconnect', () => {
      console.log('[Socket.io] Disconnected.')
    })

    setSocket(socket)
    return socket
  }

  /**
   * 断开连接
   */
  function disconnect() {
    if (socket) {
      socket.disconnect()
      socket = null
      setSocket(null)
    }
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    initializeSocket,
    disconnect,
    getSocket: () => socket
  }
}

