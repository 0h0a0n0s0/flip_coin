// 檔案: admin-ui/src/store.js (新檔案 - v7.4 修正版)

import { reactive } from 'vue';
import * as api from './api';

const permissionsStore = reactive({
  permissions: {},
  isLoaded: false, // (★★★ 1. 新增狀態 ★★★)

  has(resource, action) {
    return this.permissions[`${resource}:${action}`] === true;
  },

  async loadPermissions() {
    if (this.isLoaded) return; // (★★★ 2. 防止重複加載 ★★★)
    try {
      const perms = await api.getMyPermissions();
      this.permissions = perms;
      this.isLoaded = true; // (★★★ 3. 標記為已加載 ★★★)
      console.log('[RBAC Store] Permissions loaded.');
    } catch (error) {
      console.error('[RBAC Store] Failed to load permissions:', error);
      this.permissions = {};
      this.isLoaded = false;
      throw error; // (將錯誤拋給 router guard 處理)
    }
  },

  clearPermissions() {
    this.permissions = {};
    this.isLoaded = false; // (★★★ 4. 重置狀態 ★★★)
  }
});

export default permissionsStore;