<template>
  <el-container class="layout-container">
    <el-header class="layout-header">
      <span>FlipCoin 管理後台 (用戶: {{ username }})</span>
      <el-button type="danger" @click="handleLogout">登出</el-button>
    </el-header>
    <el-container>
      <el-aside width="200px" class="layout-aside">
        <el-menu
          :default-active="activeMenu"
          class="el-menu-vertical-demo"
          :router="true"
          :unique-opened="true" 
          background-color="#545c64" 
          text-color="#fff"
          active-text-color="#ffd04b"
          v-if="$permissions.isLoaded" 
        >
          
          <el-menu-item index="/dashboard" v-if="$permissions.has('dashboard', 'read')">
             <el-icon><DataLine /></el-icon>
            <span>儀表板</span>
          </el-menu-item>
          
          <el-sub-menu index="user-management" v-if="$permissions.has('users', 'read') || $permissions.has('users_addresses', 'read')">
            <template #title><el-icon><User /></el-icon><span>用戶管理</span></template>
            <el-menu-item index="/users" v-if="$permissions.has('users', 'read')">用户列表</el-menu-item>
            <el-menu-item index="/users/deposit-addresses" v-if="$permissions.has('users_addresses', 'read')">用戶充值地址</el-menu-item>
          </el-sub-menu>
          
          <el-sub-menu index="bet-management" v-if="$permissions.has('bets', 'read')">
            <template #title><el-icon><Coin /></el-icon><span>投注管理</span></template>
            <el-menu-item index="/bets">注单列表</el-menu-item>
          </el-sub-menu>
          
          <el-sub-menu index="report-management" v-if="$permissions.has('reports', 'read') || $permissions.has('wallets', 'read')">
            <template #title><el-icon><PieChart /></el-icon><span>數據報表管理</span></template>
            <el-menu-item index="/reports" v-if="$permissions.has('reports', 'read')">盈虧報表</el-menu-item>
            <el-menu-item index="/wallet-monitoring" v-if="$permissions.has('wallets', 'read')">錢包監控</el-menu-item> 
          </el-sub-menu>
          
          <el-sub-menu index="finance-management" v-if="$permissions.has('withdrawals', 'read')">
            <template #title><el-icon><Money /></el-icon><span>財務管理</span></template>
            <el-menu-item index="/finance/withdrawals">提款審核</el-menu-item>
          </el-sub-menu>
          
          <el-sub-menu index="admin-management" v-if="$permissions.has('admin_accounts', 'read') || $permissions.has('admin_permissions', 'read') || $permissions.has('admin_ip_whitelist', 'read')">
            <template #title><el-icon><Lock /></el-icon><span>後台管理</span></template>
            <el-menu-item index="/admin/accounts" v-if="$permissions.has('admin_accounts', 'read')">帳號管理</el-menu-item>
            <el-menu-item index="/admin/permissions" v-if="$permissions.has('admin_permissions', 'read')">權限組設定</el-menu-item>
            <el-menu-item index="/admin/ip-whitelist" v-if="$permissions.has('admin_ip_whitelist', 'read')">後台ip白名单</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="system-settings" v-if="$permissions.has('settings_game', 'read') || $permissions.has('settings_regions', 'read') || $permissions.has('settings_levels', 'read')">
            <template #title><el-icon><Setting /></el-icon><span>系統設定</span></template>
            <el-menu-item index="/settings/game-parameters" v-if="$permissions.has('settings_game', 'read')">遊戲參數</el-menu-item>
            <el-menu-item index="/settings/blocked-regions" v-if="$permissions.has('settings_regions', 'read')">阻擋地區</el-menu-item>
            <el-menu-item index="/settings/user-levels" v-if="$permissions.has('settings_levels', 'read')">用戶等級</el-menu-item>
          </el-sub-menu>
        </el-menu>
      </el-aside> 
      <el-main class="layout-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script>
import { jwtDecode } from 'jwt-decode';
// (★★★ 新增 Money Icon ★★★)
import { DataLine, User, Coin, PieChart, Setting, Lock, Money } from '@element-plus/icons-vue' 
import { ElMessage } from 'element-plus';

export default {
  name: 'LayoutView',
  data() {
    return {
      username: 'N/A'
    };
  },
  computed: { 
    activeMenu() { 
      return this.$route.path; 
    },
  },
  // (★★★ 新增 Money Icon ★★★)
  components: { DataLine, User, Coin, PieChart, Setting, Lock, Money },
  created() {
    this.decodeToken();
  },
  methods: {
    decodeToken() {
      try {
        const token = localStorage.getItem('admin_token');
        if (token) {
          const decoded = jwtDecode(token);
          this.username = decoded.username;
        } else {
          this.handleLogout(true); 
        }
      } catch (error) {
        console.error('Failed to decode token:', error);
        ElMessage.error('Token 驗證失敗，請重新登入。');
        this.handleLogout(true);
      }
    },
    handleLogout(isError = false) {
      localStorage.removeItem('admin_token');
      if (this.$permissions) {
          this.$permissions.clearPermissions();
      }
      this.$router.push('/login');
      if (!isError) {
        ElMessage.success('登出成功');
      }
    }
  }
}
</script>
<style scoped>
/* ... (保留所有現有樣式) ... */
.layout-container {
  height: 100vh;
}
.layout-header {
  background-color: #303133;
  color: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 20px;
}
.layout-aside {
  background-color: #545c64; 
  height: calc(100vh - 60px); 
  overflow-y: auto; 
}
.el-menu-vertical-demo {
  border-right: none; 
}
.el-menu-item, 
.el-sub-menu :deep(.el-sub-menu__title) { 
  color: #fff; 
}
.el-menu-item:hover, 
.el-sub-menu :deep(.el-sub-menu__title:hover) {
  background-color: #434a50 !important; 
}
.el-menu-item.is-active {
  color: #ffd04b !important;
  background-color: #434a50 !important;
}
.el-menu--inline .el-menu-item {
   background-color: #3e454c !important; 
}
.el-menu--inline .el-menu-item:hover {
   background-color: #4a5158 !important; 
}
.el-menu--inline .el-menu-item.is-active {
   background-color: #4a5158 !important; 
   color: #ffd04b !important;
}
.layout-main {
  background-color: #f0f2f5;
  padding: 20px;
  height: calc(100vh - 60px); 
  overflow-y: auto; 
}
.el-icon {
  margin-right: 8px;
}
</style>