// 檔案: admin-ui/src/router/index.js (新檔案)

import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'
import Layout from '../views/Layout.vue' 
import Dashboard from '../views/Dashboard.vue' 
import UserManagement from '../views/UserManagement.vue' 
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
  {
    path: '/login', // (★★★ v2 修改 ★★★)
    name: 'Login',
    component: Login
  },
  {
    path: '/', // (★★★ v2 修改 ★★★)
    component: Layout, // 使用 Layout 佈局
    redirect: '/dashboard', // 預設重定向到儀表板
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: Dashboard,
        meta: { requiresAuth: true } // (★★★ v2 新增 ★★★) 標記此路由需要驗證
      },
      // (★★★ v2 新增 ★★★)
      {
        path: 'users',
        name: 'UserManagement',
        component: UserManagement,
        meta: { requiresAuth: true }
      },
      {
        path: 'bets',
        name: 'BetManagement',
        component: BetManagement,
        meta: { requiresAuth: true }
      },
      {
        path: 'reports',
        name: 'ReportManagement',
        component: ReportManagement,
        meta: { requiresAuth: true }
      },
      {
        path: 'wallet-monitoring', // 新的子路徑
        name: 'WalletMonitoring',
        component: WalletMonitoring,
        meta: { requiresAuth: true }
      },
      {
        path: '/settings/game-parameters', // (使用 / 開頭確保是絕對路徑)
        name: 'GameParameters',
        component: GameParameters,
        meta: { requiresAuth: true }
      },
      {
        path: '/settings/blocked-regions',
        name: 'BlockedRegions',
        component: BlockedRegions,
        meta: { requiresAuth: true }
      },
      {
        path: '/settings/user-levels',
        name: 'UserLevels',
        component: UserLevels,
        meta: { requiresAuth: true }
      },
      {
        path: '/admin/accounts',
        name: 'AccountManagement',
        component: AccountManagement,
        meta: { requiresAuth: true }
      },
      {
        path: '/admin/permissions',
        name: 'Permissions',
        component: Permissions,
        meta: { requiresAuth: true }
      },
      {
        path: '/admin/ip-whitelist',
        name: 'IpWhitelist',
        component: IpWhitelist,
        meta: { requiresAuth: true }
      },
      
    ]
  }
]

const router = createRouter({
  // (★★★ 關鍵：告訴 Vue Router 基礎路徑是 /admin/ ★★★)
  history: createWebHistory('/admin/'),
  routes
})

// (★★★ v2 新增 ★★★) 全局前置路由守衛 (Navigation Guard)
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('admin_token');

  // 1. 檢查路由是否需要驗證
  if (to.meta.requiresAuth) {
    // 2. 如果需要驗證，檢查是否有 token
    if (token) {
      // 有 token，放行
      next();
    } else {
      // 沒有 token，跳轉回登入頁
      console.log('Router Guard: No token found, redirecting to login.');
      next({ name: 'Login' });
    }
  } else {
    // 3. 如果路由 *不* 需要驗證 (例如登入頁)
    
    // (可選) 如果用戶已登入 (有 token) 且試圖訪問登入頁
    if (token && to.name === 'Login') {
      // 將他導向儀表板
      console.log('Router Guard: Already logged in, redirecting to dashboard.');
      next({ name: 'Dashboard' });
    } else {
      // 正常放行
      next();
    }
  }
});

export default router