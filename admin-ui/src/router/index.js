// 档案: admin-ui/src/router/index.js (★★★ v7.4 修正版 ★★★)

import { createRouter, createWebHistory } from 'vue-router'
import { jwtDecode } from 'jwt-decode';
import { ElMessage } from 'element-plus';
import permissionsStore from '@/store'; // (★★★ 1. 导入 Store ★★★)

// (导入所有组件)
import Login from '../views/Login.vue'
import Layout from '../views/Layout.vue' 
import Dashboard from '../views/Dashboard.vue' 
import UserManagement from '../views/UserManagement.vue'
import UserDepositAddresses from '../views/UserDepositAddresses.vue'
import BetManagement from '../views/BetManagement.vue'
import ReportManagement from '../views/ReportManagement.vue'
import WalletMonitoring from '../views/WalletMonitoring.vue'
import WithdrawalReview from '../views/finance/WithdrawalReview.vue'
import DepositHistory from '../views/finance/DepositHistory.vue'
import BalanceChanges from '../views/finance/BalanceChanges.vue'
import GameParameters from '../views/settings/GameParameters.vue'
import SameIpMonitor from '../views/risk/SameIpMonitor.vue'
import BlockedRegions from '../views/settings/BlockedRegions.vue'
import UserLevels from '../views/settings/UserLevels.vue'
import AccountManagement from '../views/admin/AccountManagement.vue'
import Permissions from '../views/admin/Permissions.vue'
import IpWhitelist from '../views/admin/IpWhitelist.vue'
import AuditLogs from '../views/admin/AuditLogs.vue'
import CollectionLogs from '../views/CollectionLogs.vue'
import LoginQuery from '../views/LoginQuery.vue'
import GameManagement from '../views/games/GameManagement.vue'

const routes = [
  { path: '/login', name: 'Login', component: Login },
  {
    path: '/', 
    component: Layout,
    redirect: '/dashboard', 
    children: [
      // (★★★ 2. 添加 meta.permission 用于路由守卫 ★★★)
      { path: 'dashboard', name: 'Dashboard', component: Dashboard, meta: { requiresAuth: true, permission: 'dashboard:read', title: '儀表板' } },
      { path: 'users', name: 'UserManagement', component: UserManagement, meta: { requiresAuth: true, permission: 'users:read', title: '用户列表' } },
      { path: 'users/deposit-addresses', name: 'UserDepositAddresses', component: UserDepositAddresses, meta: { requiresAuth: true, permission: 'users_addresses:read', title: '用户充值地址' } },
      { path: 'users/login-query', name: 'LoginQuery', component: LoginQuery, meta: { requiresAuth: true, permission: 'users:read', title: '登录查询' } },
      { path: 'games/management', name: 'GameManagement', component: GameManagement, meta: { requiresAuth: true, permission: 'settings_game:read', title: '自营游戏管理' } },
      { path: 'bets', name: 'BetManagement', component: BetManagement, meta: { requiresAuth: true, permission: 'bets:read', title: '注单列表' } },
      { path: 'reports', name: 'ReportManagement', component: ReportManagement, meta: { requiresAuth: true, permission: 'reports:read', title: '盈虧报表' } },
      { path: 'collection-logs', name: 'CollectionLogs', component: CollectionLogs, meta: { requiresAuth: true, permission: 'reports:read', title: '归集记录' } },
      { path: 'wallet-monitoring', name: 'WalletMonitoring', component: WalletMonitoring, meta: { requiresAuth: true, permission: 'wallets:read', title: '钱包监控' } },
      { path: 'finance/withdrawals', name: 'WithdrawalReview', component: WithdrawalReview, meta: { requiresAuth: true, permission: 'withdrawals:read', title: '提款審核' } },
      { path: 'finance/deposits', name: 'DepositHistory', component: DepositHistory, meta: { requiresAuth: true, permission: 'deposits:read', title: '充值记录' } },
      { path: 'finance/balance-changes', name: 'BalanceChanges', component: BalanceChanges, meta: { requiresAuth: true, permission: 'balance_changes:read', title: '账变记录' } },
      { path: '/settings/game-parameters', name: 'GameParameters', component: GameParameters, meta: { requiresAuth: true, permission: 'settings_game:read', title: '系统参数' } },
      { path: '/settings/blocked-regions', name: 'BlockedRegions', component: BlockedRegions, meta: { requiresAuth: true, permission: 'settings_regions:read', title: '阻挡地区设定' } },
      { path: '/settings/user-levels', name: 'UserLevels', component: UserLevels, meta: { requiresAuth: true, permission: 'settings_levels:read', title: '用户等级设定' } },
      { path: '/risk/same-ip', name: 'SameIpMonitor', component: SameIpMonitor, meta: { requiresAuth: true, permission: 'users:update_status', title: '同IP风控监控' } },
      { path: '/admin/accounts', name: 'AccountManagement', component: AccountManagement, meta: { requiresAuth: true, permission: 'admin_accounts:read', title: '帐号管理' } },
      { path: '/admin/permissions', name: 'Permissions', component: Permissions, meta: { requiresAuth: true, permission: 'admin_permissions:read', title: '权限组设定' } },
      { path: '/admin/ip-whitelist', name: 'IpWhitelist', component: IpWhitelist, meta: { requiresAuth: true, permission: 'admin_ip_whitelist:read', title: '後台ip白名单' } },
      { path: '/admin/audit-logs', name: 'AuditLogs', component: AuditLogs, meta: { requiresAuth: true, permission: 'admin_permissions:read', title: '操作稽核日志' } },
    ]
  }
]

const router = createRouter({
  history: createWebHistory('/admin/'),
  routes
})

// (★★★ 3. 升级路由守卫 ★★★)
router.beforeEach(async (to, from, next) => {
  const token = localStorage.getItem('admin_token');

  if (to.meta.requiresAuth) {
    if (token) {
      try {
        const decoded = jwtDecode(token);
        if (decoded.exp * 1000 < Date.now()) throw new Error('Token expired');
        
        // (★★★ 4. 检查 Store 是否已加载 ★★★)
        if (!permissionsStore.isLoaded) {
            console.log('[Router Guard] Token valid, loading permissions...');
            await permissionsStore.loadPermissions();
        }

        // (★★★ 5. 检查路由权限 ★★★)
        const requiredPermission = to.meta.permission;
        if (requiredPermission) {
            const [resource, action] = requiredPermission.split(':');
            if (!permissionsStore.has(resource, action)) {
                 console.warn(`[Router Guard] Denied. Role does not have permission ${requiredPermission} for route ${to.name}.`);
                 ElMessage.warning('您的权限不足，無法访问此页面。');
                 
                 // (如果連仪表板都没权限，强制登出)
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
        // (Token 过期 或 loadPermissions 失败)
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
    // (访问 /login 页面)
    if (token && to.name === 'Login') {
      next({ name: 'Dashboard' });
    } else {
      next();
    }
  }
});

export default router