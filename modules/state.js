// 全局状态管理模块
// 集中管理应用状态，避免状态散落

let jwtToken = null;
let currentUser = null;
let socket = null;
let isBetting = false;

/**
 * 获取 JWT Token
 */
export function getToken() {
    return jwtToken;
}

/**
 * 设置 JWT Token
 */
export function setToken(token) {
    jwtToken = token;
    if (token) {
        localStorage.setItem('jwt_token', token);
    } else {
        localStorage.removeItem('jwt_token');
    }
}

/**
 * 获取当前用户
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * 设置当前用户
 */
export function setCurrentUser(user) {
    currentUser = user;
}

/**
 * 获取 Socket 实例
 */
export function getSocket() {
    return socket;
}

/**
 * 设置 Socket 实例
 */
export function setSocket(socketInstance) {
    socket = socketInstance;
}

/**
 * 获取下注状态
 */
export function getBettingState() {
    return isBetting;
}

/**
 * 设置下注状态
 */
export function setBettingState(state) {
    isBetting = state;
}

/**
 * 清除所有状态（登出时使用）
 */
export function clearState() {
    jwtToken = null;
    currentUser = null;
    isBetting = false;
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    localStorage.removeItem('jwt_token');
}

/**
 * 从 localStorage 恢复 Token
 */
export function restoreTokenFromStorage() {
    const savedToken = localStorage.getItem('jwt_token');
    if (savedToken) {
        jwtToken = savedToken;
        return savedToken;
    }
    return null;
}

