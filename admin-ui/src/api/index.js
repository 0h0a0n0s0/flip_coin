// 檔案: admin-ui/src/api/index.js

import request from '@/utils/request';

// --- Auth ---
/**
 * @description 管理員登入
 */
export function login(data) {
    return request({
        url: '/api/admin/login',
        method: 'post',
        data: data,
    });
}

// --- Dashboard ---
/**
 * @description 獲取儀表板統計數據
 */
export function getDashboardStats() {
    return request({
        url: '/api/admin/stats',
        method: 'get',
    });
}

// --- User Management ---
/**
 * @description 獲取用戶列表 (v6 版)
 */
export function getUsers(params) {
    return request({
        url: '/api/admin/users',
        method: 'get',
        params: params, // (params 內容已在 vue 檔案中更新)
    });
}


/**
 * @description 更新用戶狀態 (禁用投注)
 */
export function updateUserStatus(userId, status) {
    return request({
        url: `/api/admin/users/${userId}/status`,
        method: 'patch',
        data: { status }
    });
}

/**
 * @description (管理員) 更新用戶資料
 */
export function updateUser(userId, data) { // (★★★ v6 新增 ★★★)
    return request({
        url: `/api/admin/users/${userId}`,
        method: 'put',
        data: data // { nickname, level, referrer_code, balance }
    });
}

/**
 * @description 根據邀請碼獲取推薦用戶列表
 */
export function getReferrals(inviteCode) {
    return request({
        url: `/api/admin/users/by-referrer/${inviteCode}`,
        method: 'get',
    });
}

/**
 * @description 獲取用戶充值地址列表 (分頁/搜尋)
 */
export function getUserDepositAddresses(params) {
    return request({
        url: '/api/admin/users/deposit-addresses',
        method: 'get',
        params: params,
    });
}

// --- Bet Management ---
/**
 * @description 獲取注单管理列表 (分頁/搜尋)
 */
export function getBets(params) {
    return request({
        url: '/api/admin/bets',
        method: 'get',
        params: params,
    });
}

// --- Report Management ---
/**
 * @description 獲取盈虧報表
 */
export function getProfitLossReport(params) {
    return request({
        url: '/api/admin/reports/profit-loss',
        method: 'get',
        params: params, // { userQuery, dateRange }
    });
}

// --- Wallet Monitoring ---
/**
 * @description 獲取監控錢包列表 (含餘額)
 */
export function getWallets(params) { 
    return request({
        url: '/api/admin/wallets',
        method: 'get',
        params, // (params 內容 {name, chain_type, address})
    });
}
/**
 * @description 新增監控錢包
 */
export function addWallet(data) { // (★★★ 確保此函數存在 ★★★)
    return request({
        url: '/api/admin/wallets',
        method: 'post',
        data,
    });
}
/**
 * @description 更新監控錢包
 */
export function updateWallet(id, data) { // (★★★ 確保此函數存在 ★★★)
    return request({
        url: `/api/admin/wallets/${id}`,
        method: 'put',
        data,
    });
}
/**
 * @description 刪除監控錢包
 */
export function deleteWallet(id) { // (★★★ 確保此函數存在 ★★★)
    return request({
        url: `/api/admin/wallets/${id}`,
        method: 'delete',
    });
}

// --- System Settings ---
/**
 * @description 獲取所有系統設定
 */
export function getSettings() { // (★★★ 確保此函數存在 ★★★)
    return request({
        url: '/api/admin/settings',
        method: 'get',
    });
}
/**
 * @description 更新單個系統設定
 */
export function updateSetting(key, value) { // (★★★ 確保此函數存在 ★★★)
    return request({
        url: `/api/admin/settings/${key}`,
        method: 'put',
        data: { value },
    });
}

// ★★★ (v2 新增) 阻擋地區 API ★★★
export function getBlockedRegions() {
    return request({
        url: '/api/admin/blocked-regions',
        method: 'get',
    });
}

export function addBlockedRegion(data) {
    return request({
        url: '/api/admin/blocked-regions',
        method: 'post',
        data, // { ip_range: string, description?: string }
    });
}

export function deleteBlockedRegion(id) {
    return request({
        url: `/api/admin/blocked-regions/${id}`,
        method: 'delete',
    });
}

// ★★★ (v2 新增) 用戶等級 API ★★★
export function getUserLevels() {
    return request({
        url: '/api/admin/user-levels',
        method: 'get',
    });
}

export function addUserLevel(data) {
    return request({
        url: '/api/admin/user-levels',
        method: 'post',
        data,
    });
}

export function updateUserLevel(level, data) {
    return request({
        url: `/api/admin/user-levels/${level}`,
        method: 'put',
        data,
    });
}

export function deleteUserLevel(level) {
    return request({
        url: `/api/admin/user-levels/${level}`,
        method: 'delete',
    });
}

// ★★★ (v2 新增) 後台帳號管理 API ★★★
export function getAdminAccounts() {
    return request({
        url: '/api/admin/accounts',
        method: 'get',
    });
}

export function addAdminAccount(data) {
    return request({
        url: '/api/admin/accounts',
        method: 'post',
        data,
    });
}

export function updateAdminAccount(id, data) {
    return request({
        url: `/api/admin/accounts/${id}`,
        method: 'put',
        data,
    });
}

export function deleteAdminAccount(id) {
    return request({
        url: `/api/admin/accounts/${id}`,
        method: 'delete',
    });
}

export function getIpWhitelist() {
    return request({
        url: '/api/admin/ip-whitelist',
        method: 'get'
    });
}
export function addIpToWhitelist(data) {
    return request({
        url: '/api/admin/ip-whitelist',
        method: 'post', data 
    });
}
export function deleteIpFromWhitelist(id) {
    return request({
        url: `/api/admin/ip-whitelist/${id}`,
        method: 'delete'
    });
}