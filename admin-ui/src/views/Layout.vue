<template>
  <el-container class="layout-container">
    <el-header class="layout-header">
      <span>FlipCoin 管理後台</span>
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
        >
          <el-menu-item index="/dashboard">
             <el-icon><DataLine /></el-icon>
            <span>儀表板</span>
          </el-menu-item>
          <el-sub-menu index="user-management">
            <template #title><el-icon><User /></el-icon><span>用戶管理</span></template>
            <el-menu-item index="/users">用户列表</el-menu-item>
            <el-menu-item index="/users/deposit-addresses">用戶充值地址</el-menu-item>
          </el-sub-menu>
          <el-sub-menu index="bet-management">
            <template #title><el-icon><Coin /></el-icon><span>投注管理</span></template>
            <el-menu-item index="/bets">注单列表</el-menu-item>
          </el-sub-menu>
          <el-sub-menu index="report-management">
            <template #title><el-icon><PieChart /></el-icon><span>數據報表管理</span></template>
            <el-menu-item index="/reports">盈虧報表</el-menu-item>
            <el-menu-item index="/wallet-monitoring">錢包監控</el-menu-item> 
          </el-sub-menu>
          
          <el-sub-menu index="admin-management">
            <template #title><el-icon><Lock /></el-icon><span>後台管理</span></template>
            <el-menu-item index="/admin/accounts">帳號管理</el-menu-item>
            <el-menu-item index="/admin/permissions">權限組設定</el-menu-item>
            <el-menu-item index="/admin/ip-whitelist">後台ip白名单</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="system-settings">
            <template #title><el-icon><Setting /></el-icon><span>系統設定</span></template>
            <el-menu-item index="/settings/game-parameters">遊戲參數</el-menu-item>
            <el-menu-item index="/settings/blocked-regions">阻擋地區</el-menu-item>
            <el-menu-item index="/settings/user-levels">用戶等級</el-menu-item>
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
import { DataLine, User, Coin, PieChart, Setting, Lock } from '@element-plus/icons-vue' // (★★★ 新增 Lock ★★★)
export default {
  name: 'LayoutView',
  computed: { activeMenu() { return this.$route.path; } },
  components: { DataLine, User, Coin, PieChart, Setting, Lock }, // (★★★ 新增 Lock ★★★)
  methods: {
    handleLogout() {
      localStorage.removeItem('admin_token');
      this.$router.push('/login');
    }
  }
}
</script>
<style scoped>
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
  height: calc(100vh - 60px); /* 減去 header 高度 */
  overflow-y: auto; /* 如果菜單過長，允許滾動 */
}
/* (★★★ 修改：el-menu 樣式調整 ★★★) */
.el-menu-vertical-demo {
  border-right: none; /* 移除右邊框 */
  /* height: 100%; (移除，讓 aside 控制高度) */
}
/* (修復子菜單背景色) */
.el-menu-item, 
.el-sub-menu :deep(.el-sub-menu__title) { /* 使用 :deep() 穿透子組件樣式 */
  color: #fff; /* 確保文字顏色 */
}
.el-menu-item:hover, 
.el-sub-menu :deep(.el-sub-menu__title:hover) {
  background-color: #434a50 !important; /* !important 提高優先級 */
}
/* (修復激活的子菜單項樣式) */
.el-menu-item.is-active {
  color: #ffd04b !important;
  background-color: #434a50 !important;
}
/* (修復子菜單展開時的背景) */
.el-menu--inline .el-menu-item {
   background-color: #3e454c !important; /* 子菜單項背景色 */
}
.el-menu--inline .el-menu-item:hover {
   background-color: #4a5158 !important; /* 子菜單項 hover 背景色 */
}
.el-menu--inline .el-menu-item.is-active {
   background-color: #4a5158 !important; 
   color: #ffd04b !important;
}

.layout-main {
  background-color: #f0f2f5;
  padding: 20px;
  height: calc(100vh - 60px); /* 減去 header 高度 */
  overflow-y: auto; /* 內容過長時允許滾動 */
}

/* (可選) 為圖標添加一些右邊距 */
.el-icon {
  margin-right: 8px;
}
</style>