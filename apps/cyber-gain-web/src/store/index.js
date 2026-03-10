// 全局状态管理模块
// 從 modules/state.js 遷移，使用 Vue 3 reactive

import { reactive } from 'vue'

/** 本地緩存 key，用於刷新頁面時同步恢復登入狀態，避免 header 閃爍 */
const CURRENT_USER_CACHE_KEY = 'current_user_cache'

const state = reactive({
  jwtToken: null,
  currentUser: null,
  socket: null,
  isBetting: false,
  gamesCache: null, // 遊戲列表緩存
  gamesCacheTimestamp: null, // 緩存時間戳（用於判斷是否需要刷新）
  platformName: null, // 平台名稱緩存
  showDepositModal: false // 充值 BottomSheet 顯示狀態（與餘額彈窗同結構，遮罩後為當前頁面）
})

export function openDepositModal() {
  state.showDepositModal = true
}

export function closeDepositModal() {
  state.showDepositModal = false
}

/**
 * 获取 JWT Token
 */
export function getToken() {
  return state.jwtToken
}

/**
 * 设置 JWT Token
 */
export function setToken(token) {
  state.jwtToken = token
  if (token) {
    localStorage.setItem('jwt_token', token)
  } else {
    localStorage.removeItem('jwt_token')
  }
}

/**
 * 获取当前用户
 */
export function getCurrentUser() {
  return state.currentUser
}

/**
 * 设置当前用户
 * 登入時同步寫入 localStorage，供刷新頁面時同步恢復，避免 header 閃爍
 */
export function setCurrentUser(user) {
  state.currentUser = user
  if (user && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(CURRENT_USER_CACHE_KEY, JSON.stringify(user))
    } catch (e) {
      // 儲存空間已滿或其他錯誤，不影響主要流程
    }
  } else if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(CURRENT_USER_CACHE_KEY)
  }
}

/**
 * 获取 Socket 实例
 */
export function getSocket() {
  return state.socket
}

/**
 * 设置 Socket 实例
 */
export function setSocket(socketInstance) {
  state.socket = socketInstance
}

/**
 * 获取下注状态
 */
export function getBettingState() {
  return state.isBetting
}

/**
 * 设置下注状态
 */
export function setBettingState(bettingState) {
  state.isBetting = bettingState
}

/**
 * 获取游戏列表缓存
 */
export function getGamesCache() {
  return state.gamesCache
}

/**
 * 设置游戏列表缓存
 */
export function setGamesCache(games) {
  state.gamesCache = games
  state.gamesCacheTimestamp = Date.now()
}

/**
 * 清除游戏列表缓存
 */
export function clearGamesCache() {
  state.gamesCache = null
  state.gamesCacheTimestamp = null
}

/**
 * 获取平台名称缓存
 */
export function getPlatformName() {
  return state.platformName
}

/**
 * 设置平台名称缓存
 */
export function setPlatformName(name) {
  state.platformName = name
}

/**
 * 清除所有状态（登出时使用）
 */
export function clearState() {
  state.jwtToken = null
  state.currentUser = null
  state.isBetting = false
  if (state.socket) {
    state.socket.disconnect()
    state.socket = null
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('jwt_token')
    localStorage.removeItem(CURRENT_USER_CACHE_KEY)
  }
  clearGamesCache()
  setPlatformName(null)
}

/**
 * 从 localStorage 恢复 Token
 */
export function restoreTokenFromStorage() {
  const savedToken = localStorage.getItem('jwt_token')
  if (savedToken) {
    state.jwtToken = savedToken
    return savedToken
  }
  return null
}

/**
 * 同步從 localStorage 恢復登入狀態（Token + 用戶快取）
 * 在 app 掛載前執行，確保首次渲染時 header 已為正確狀態，避免閃爍
 */
function hydrateAuthFromStorage() {
  if (typeof localStorage === 'undefined') return
  const savedToken = localStorage.getItem('jwt_token')
  const userJson = localStorage.getItem(CURRENT_USER_CACHE_KEY)
  if (savedToken && userJson) {
    try {
      const user = JSON.parse(userJson)
      state.jwtToken = savedToken
      state.currentUser = user
    } catch (e) {
      // JSON 解析失敗，清除可能已損壞的快取
      localStorage.removeItem(CURRENT_USER_CACHE_KEY)
    }
  }
}
hydrateAuthFromStorage()

// 导出 state 供组件直接访问（如果需要）
export { state }

