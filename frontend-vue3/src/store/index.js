// 全局状态管理模块
// 從 modules/state.js 遷移，使用 Vue 3 reactive

import { reactive } from 'vue'

const state = reactive({
  jwtToken: null,
  currentUser: null,
  socket: null,
  isBetting: false,
  gamesCache: null, // 遊戲列表緩存
  gamesCacheTimestamp: null, // 緩存時間戳（用於判斷是否需要刷新）
  platformName: null // 平台名稱緩存
})

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
 */
export function setCurrentUser(user) {
  state.currentUser = user
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
  localStorage.removeItem('jwt_token')
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

// 导出 state 供组件直接访问（如果需要）
export { state }

