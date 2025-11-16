// 檔案: admin-ui/src/api/index.js (★★★ v7.3 RBAC 擴充版 ★★★)

import request from '@/utils/request';

// --- Auth ---
export function login(data) {
    return request({
        url: '/api/admin/login',
        method: 'post',
        data: data,
    });
}
// (★★★ Y-A: 新增：獲取當前用戶權限 ★★★)
export function getMyPermissions() {
    return request({
        url: '/api/admin/my-permissions', // (我們將在下一步的 server.js 中新增此路由)
        method: 'get',
    });
}


// --- Dashboard ---
export function getDashboardStats() {
    return request({
        url: '/api/admin/stats',
        method: 'get',
    });
}

// --- User Management ---
export function getUsers(params) {
    return request({
        url: '/api/admin/users',
        method: 'get',
        params: params,
    });
}
export function updateUserStatus(userId, status) {
    return request({
        url: `/api/admin/users/${userId}/status`,
        method: 'patch',
        data: { status }
    });
}
export function updateUser(userId, data) {
    return request({
        url: `/api/admin/users/${userId}`,
        method: 'put',
        data: data // { nickname, level, referrer_code, balance }
    });
}
export function getReferrals(inviteCode) {
    return request({
        url: `/api/admin/users/by-referrer/${inviteCode}`,
        method: 'get',
    });
}
export function getUserDepositAddresses(params) {
    return request({
        url: '/api/admin/users/deposit-addresses',
        method: 'get',
        params: params,
    });
}

// --- Bet Management ---
export function getBets(params) {
    return request({
        url: '/api/admin/bets',
        method: 'get',
        params: params,
    });
}

// --- Report Management ---
export function getProfitLossReport(params) {
    return request({
        url: '/api/admin/reports/profit-loss',
        method: 'get',
        params: params,
    });
}

// --- Wallet Monitoring ---
export function getWallets(params) { 
    return request({
        url: '/api/admin/wallets',
        method: 'get',
        params,
    });
}
export function addWallet(data) {
    return request({
        url: '/api/admin/wallets',
        method: 'post',
        data,
    });
}
export function updateWallet(id, data) {
    return request({
        url: `/api/admin/wallets/${id}`,
        method: 'put',
        data,
    });
}
export function deleteWallet(id) {
    return request({
        url: `/api/admin/wallets/${id}`,
        method: 'delete',
    });
}

// --- System Settings ---
export function getSettings() {
    return request({
        url: '/api/admin/settings',
        method: 'get',
    });
}
export function updateSetting(key, value) {
    return request({
        url: `/api/admin/settings/${key}`,
        method: 'put',
        data: { value },
    });
}

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
        data,
    });
}
export function deleteBlockedRegion(id) {
    return request({
        url: `/api/admin/blocked-regions/${id}`,
        method: 'delete',
    });
}

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

// --- 後台帳號管理 API ---
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
        data, // (★★★ Y-B: 注意：前端將傳送 role_id ★★★)
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

// (★★★ Y-C: 新增 RBAC 相關 API ★★★)
/**
 * @description 獲取所有權限組 (Roles)
 */
export function getRoles() {
    return request({
        url: '/api/admin/roles',
        method: 'get'
    });
}

/**
 * @description 獲取單一權限組的詳細資料 (包含 permission_ids)
 */
export function getRoleDetails(id) {
    return request({
        url: `/api/admin/roles/${id}`,
        method: 'get'
    });
}

/**
 * @description 獲取所有可用的權限 (Permissions) (已按 category 分組)
 */
export function getAllPermissions() {
    return request({
        url: '/api/admin/permissions',
        method: 'get'
    });
}

/**
 * @description 新增權限組
 */
export function addRole(data) {
    // data: { name, description, permission_ids: [...] }
    return request({
        url: '/api/admin/roles',
        method: 'post',
        data
    });
}

/**
 * @description 更新權限組
 */
export function updateRole(id, data) {
    // data: { name, description, permission_ids: [...] }
    return request({
        url: `/api/admin/roles/${id}`,
        method: 'put',
        data
    });
}

/**
 * @description 刪除權限組
 */
export function deleteRole(id) {
    return request({
        url: `/api/admin/roles/${id}`,
        method: 'delete'
    });
}

/**
 * @description (獲取充值記錄)
 */
export function getDeposits(params) {
    return request({
        url: '/api/admin/deposits',
        method: 'get',
        params: params,
    });
}

export function getWithdrawals(params) {
    return request({
        url: '/api/admin/withdrawals',
        method: 'get',
        params: params,
    });
}
export function approveWithdrawal(id) {
    return request({
        url: `/api/admin/withdrawals/${id}/approve`,
        method: 'post',
    });
}
export function rejectWithdrawal(id, reason) { // reason: { reason: '...' }
    return request({
        url: `/api/admin/withdrawals/${id}/reject`,
        method: 'post',
        data: reason,
    });
}
/**
 * @description (手動完成提款)
 * @param {number} id - 提款單 ID
 * @param {object} data - { tx_hash, gas_fee }
 */
export function completeWithdrawal(id, data) {
    return request({
        url: `/api/admin/withdrawals/${id}/complete`,
        method: 'post',
        data: data,
    });
}