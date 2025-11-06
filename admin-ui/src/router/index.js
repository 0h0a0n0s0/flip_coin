// 檔案: admin-ui/src/router/index.js (★★★ v7.4 修正版 ★★★)

import { createRouter, createWebHistory } from 'vue-router'
import { jwtDecode } from 'jwt-decode';
import { ElMessage } from 'element-plus';
import permissionsStore from '@/store'; // (★★★ 1. 導入 Store ★★★)

// (導入所有組件)
import Login from '../views/Login.vue'
import Layout from '../views/Layout.vue' 
import Dashboard from '../views/Dashboard.vue' 
import UserManagement from '../views/UserManagement.vue'
import UserDepositAddresses from '../views/UserDepositAddresses.vue'
import BetManagement from '../views/BetManagement.vue'
import ReportManagement from '../views/ReportManagement.vue'
import WalletMonitoring from '../views/WalletMonitoring.vue'
import GameParameters from '../views/settings/GameParameters.vue'
import BlockedRegions from '../views/settings/BlockedRegions.vue'
import UserLevels from '../views/settings/UserLevels.vue'
import AccountManagement from '../views/admin/AccountManagement.vue'
import Permissions from '../views/admin/Permissions.vue'
import IpWhitelist from '../views/admin/IpWhitelist.vue'

const routes = [
  { path: '/login', name: 'Login', component: Login },
  {
    path: '/', 
    component: Layout,
    redirect: '/dashboard', 
    children: [
      // (★★★ 2. 添加 meta.permission 用於路由守衛 ★★★)
      { path: 'dashboard', name: 'Dashboard', component: Dashboard, meta: { requiresAuth: true, permission: 'dashboard:read' } },
      { path: 'users', name: 'UserManagement', component: UserManagement, meta: { requiresAuth: true, permission: 'users:read' } },
      { path: 'users/deposit-addresses', name: 'UserDepositAddresses', component: UserDepositAddresses, meta: { requiresAuth: true, permission: 'users_addresses:read' } },
      { path: 'bets', name: 'BetManagement', component: BetManagement, meta: { requiresAuth: true, permission: 'bets:read' } },
      { path: 'reports', name: 'ReportManagement', component: ReportManagement, meta: { requiresAuth: true, permission: 'reports:read' } },
      { path: 'wallet-monitoring', name: 'WalletMonitoring', component: WalletMonitoring, meta: { requiresAuth: true, permission: 'wallets:read' } },
      { path: '/settings/game-parameters', name: 'GameParameters', component: GameParameters, meta: { requiresAuth: true, permission: 'settings_game:read' } },
      { path: '/settings/blocked-regions', name: 'BlockedRegions', component: BlockedRegions, meta: { requiresAuth: true, permission: 'settings_regions:read' } },
      { path: '/settings/user-levels', name: 'UserLevels', component: UserLevels, meta: { requiresAuth: true, permission: 'settings_levels:read' } },
      { path: '/admin/accounts', name: 'AccountManagement', component: AccountManagement, meta: { requiresAuth: true, permission: 'admin_accounts:read' } },
      { path: '/admin/permissions', name: 'Permissions', component: Permissions, meta: { requiresAuth: true, permission: 'admin_permissions:read' } },
      { path: '/admin/ip-whitelist', name: 'IpWhitelist', component: IpWhitelist, meta: { requiresAuth: true, permission: 'admin_ip_whitelist:read' } },
    ]
  }
]

const router = createRouter({
  history: createWebHistory('/admin/'),
  routes
})

// (★★★ 3. 升級路由守衛 ★★★)
router.beforeEach(async (to, from, next) => {
  const token = localStorage.getItem('admin_token');

  if (to.meta.requiresAuth) {
    if (token) {
      try {
        const decoded = jwtDecode(token);
        if (decoded.exp * 1000 < Date.now()) throw new Error('Token expired');
        
        // (★★★ 4. 檢查 Store 是否已加載 ★★★)
        if (!permissionsStore.isLoaded) {
            console.log('[Router Guard] Token valid, loading permissions...');
            await permissionsStore.loadPermissions();
        }

        // (★★★ 5. 檢查路由權限 ★★★)
        const requiredPermission = to.meta.permission;
        if (requiredPermission) {
            const [resource, action] = requiredPermission.split(':');
            if (!permissionsStore.has(resource, action)) {
                 console.warn(`[Router Guard] Denied. Role does not have permission ${requiredPermission} for route ${to.name}.`);
                 ElMessage.warning('您的權限不足，無法訪問此頁面。');
                 
                 // (如果連儀表板都沒權限，強制登出)
                 if (to.name === 'Dashboard') {
                     localStorage.removeItem('admin_token');
                     permissionsStore.clearPermissions();
                     return next({ name: 'Login' });
                 }
                 return next({ name: 'Dashboard' });
            }
        }
        next();

      } catch (error) {
        // (Token 過期 或 loadPermissions 失敗)
        console.error('Router Guard: Token/Permission check failed.', error.message);
        localStorage.removeItem('admin_token');
        permissionsStore.clearPermissions();
        return next({ name: 'Login' });
      }
    } else {
      // (無 token)
      permissionsStore.clearPermissions();
      next({ name: 'Login' });
    }
  } else {
    // (訪問 /login 頁面)
    if (token && to.name === 'Login') {
      next({ name: 'Dashboard' });
    } else {
      next();
    }
  }
});

export default router