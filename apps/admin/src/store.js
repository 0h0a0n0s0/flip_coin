// 档案: admin-ui/src/store.js (新档案 - v7.4 修正版)

import { reactive } from 'vue';
import * as api from './api';

const permissionsStore = reactive({
  permissions: {},
  isLoaded: false, // (★★★ 1. 新增狀态 ★★★)

  has(resource, action) {
    return this.permissions[`${resource}:${action}`] === true;
  },

  async loadPermissions() {
    if (this.isLoaded) return; // (★★★ 2. 防止重复加载 ★★★)
    try {
      const perms = await api.getMyPermissions();
      // (★★★ 修復：後端使用標準響應格式 { success: true, data: {...} } ★★★)
      // request.js 攔截器返回 response.data，所以 perms = { success: true, data: {...} }
      this.permissions = (perms && perms.success && perms.data) ? perms.data : perms;
      this.isLoaded = true; // (★★★ 3. 标记为已加载 ★★★)
      console.log('[RBAC Store] Permissions loaded:', this.permissions);
    } catch (error) {
      console.error('[RBAC Store] Failed to load permissions:', error);
      this.permissions = {};
      this.isLoaded = false;
      throw error; // (将错误拋给 router guard 处理)
    }
  },

  clearPermissions() {
    this.permissions = {};
    this.isLoaded = false; // (★★★ 4. 重置狀态 ★★★)
  }
});

// 提款審核計數 Store
const withdrawalStore = reactive({
  pendingWithdrawalCount: 0,

  setPendingCount(count) {
    this.pendingWithdrawalCount = count;
  },

  increment() {
    this.pendingWithdrawalCount++;
  },

  decrement() {
    if (this.pendingWithdrawalCount > 0) {
      this.pendingWithdrawalCount--;
    }
  }
});

export default permissionsStore;
export { withdrawalStore };