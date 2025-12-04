<template>
  <el-container class="layout-container">
    <el-header class="layout-header">
      <div class="header-left">
        <el-button 
          @click="toggleSidebar"
          text
          class="collapse-btn"
          :title="isCollapsed ? '展開側邊欄' : '縮小側邊欄'"
        >
          <el-icon v-if="!isCollapsed" :size="20">
            <DArrowLeft />
          </el-icon>
          <el-icon v-else :size="20">
            <DArrowRight />
          </el-icon>
        </el-button>
        <span>{{ platformName }} 管理後台</span>
      </div>
      <div class="header-right">
        <span class="user-info">(用户: {{ displayName }})</span>
        <el-dropdown @command="handleCommand" trigger="click">
          <el-avatar :size="40" class="user-avatar">
            {{ (displayName || 'A').charAt(0).toUpperCase() }}
          </el-avatar>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">
                <el-icon><User /></el-icon>
                <span style="margin-left: 8px;">个人资料</span>
              </el-dropdown-item>
              <el-dropdown-item command="googleAuth">
                <el-icon><Lock /></el-icon>
                <span style="margin-left: 8px;">{{ hasGoogleAuth ? '解绑谷歌验证' : '绑定谷歌验证' }}</span>
              </el-dropdown-item>
              <el-dropdown-item divided command="logout">
                <el-icon><Right /></el-icon>
                <span style="margin-left: 8px;">登出</span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-header>
    <el-container>
      <el-aside :width="isCollapsed ? '64px' : '200px'" class="layout-aside" :class="{ 'is-collapsed': isCollapsed }">
        <el-menu
          :default-active="activeMenu"
          class="el-menu-vertical-demo"
          :router="true"
          :unique-opened="true" 
          :collapse="isCollapsed"
          background-color="#1a4d00" 
          text-color="#fff"
          active-text-color="#fff"
          v-if="$permissions.isLoaded" 
        >
          
          <el-menu-item index="/dashboard" v-if="$permissions.has('dashboard', 'read')">
             <el-icon><DataLine /></el-icon>
            <span>仪表板</span>
          </el-menu-item>
          
          <el-sub-menu index="user-management" v-if="$permissions.has('users', 'read') || $permissions.has('users_addresses', 'read')" data-parent-name="用户管理">
            <template #title><el-icon><User /></el-icon><span>用户管理</span></template>
            <el-menu-item index="/users" v-if="$permissions.has('users', 'read')">用户列表</el-menu-item>
            <el-menu-item index="/users/deposit-addresses" v-if="$permissions.has('users_addresses', 'read')">用户充值地址</el-menu-item>
            <el-menu-item index="/users/login-query" v-if="$permissions.has('users', 'read')">登录查询</el-menu-item>
            <el-menu-item index="/risk/same-ip" v-if="$permissions.has('users', 'update_status')">同IP风控监控</el-menu-item>
          </el-sub-menu>
          
          <el-sub-menu index="bet-management" v-if="$permissions.has('bets', 'read')" data-parent-name="投注管理">
            <template #title><el-icon><Coin /></el-icon><span>投注管理</span></template>
            <el-menu-item index="/bets">注单列表</el-menu-item>
          </el-sub-menu>
          
          <el-sub-menu index="report-management" v-if="$permissions.has('reports', 'read') || $permissions.has('wallets', 'read')" data-parent-name="数据报表管理">
            <template #title><el-icon><PieChart /></el-icon><span>数据报表管理</span></template>
            <el-menu-item index="/reports" v-if="$permissions.has('reports', 'read')">盈虧报表</el-menu-item>
            <el-menu-item index="/collection-logs" v-if="$permissions.has('reports', 'read')">归集记录</el-menu-item>
            <el-menu-item index="/wallet-monitoring" v-if="$permissions.has('wallets', 'read')">钱包监控</el-menu-item> 
          </el-sub-menu>
          
          <el-sub-menu index="finance-management" v-if="$permissions.has('withdrawals', 'read') || $permissions.has('deposits', 'read') || $permissions.has('balance_changes', 'read')" data-parent-name="财务管理"> <template #title><el-icon><Money /></el-icon><span>财务管理</span></template>
            <el-menu-item index="/finance/withdrawals" v-if="$permissions.has('withdrawals', 'read')">提款審核</el-menu-item>
            <el-menu-item index="/finance/deposits" v-if="$permissions.has('deposits', 'read')">充值记录</el-menu-item>
            <el-menu-item index="/finance/balance-changes" v-if="$permissions.has('balance_changes', 'read')">账变记录</el-menu-item>
          </el-sub-menu>
          
          <el-sub-menu index="admin-management" v-if="$permissions.has('admin_accounts', 'read') || $permissions.has('admin_permissions', 'read') || $permissions.has('admin_ip_whitelist', 'read')" data-parent-name="後台管理">
            <template #title><el-icon><Lock /></el-icon><span>後台管理</span></template>
            <el-menu-item index="/admin/accounts" v-if="$permissions.has('admin_accounts', 'read')">帐号管理</el-menu-item>
            <el-menu-item index="/admin/permissions" v-if="$permissions.has('admin_permissions', 'read')">权限组设定</el-menu-item>
            <el-menu-item index="/admin/ip-whitelist" v-if="$permissions.has('admin_ip_whitelist', 'read')">後台ip白名单</el-menu-item>
            <el-menu-item index="/admin/audit-logs" v-if="$permissions.has('admin_permissions', 'read')">操作稽核日志</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="system-settings" v-if="$permissions.has('settings_game', 'read') || $permissions.has('settings_regions', 'read') || $permissions.has('settings_levels', 'read')" data-parent-name="系统设定">
            <template #title><el-icon><Setting /></el-icon><span>系统设定</span></template>
            <el-menu-item index="/settings/game-parameters" v-if="$permissions.has('settings_game', 'read')">系统参数</el-menu-item>
            <el-menu-item index="/settings/blocked-regions" v-if="$permissions.has('settings_regions', 'read')">阻挡地区</el-menu-item>
            <el-menu-item index="/settings/user-levels" v-if="$permissions.has('settings_levels', 'read')">用户等级</el-menu-item>
          </el-sub-menu>
        </el-menu>
      </el-aside> 
      <el-main class="layout-main">
        <!-- 分頁列 -->
        <div class="tabs-bar" v-if="tabs.length">
          <div
            v-for="tab in tabs"
            :key="tab.path"
            :class="['tab-item', { active: tab.path === activeMenu }]"
          >
            <span class="tab-label" @click="handleClickTab(tab)">
              {{ tab.title }}
            </span>
            <span
              class="tab-close"
              v-if="tab.path !== '/dashboard'"
              @click.stop="handleCloseTab(tab)"
            >
              ×
            </span>
          </div>
        </div>

        <router-view v-slot="{ Component, route }">
          <keep-alive :include="cachedViews">
            <component :is="Component" :key="route.name || route.path" />
          </keep-alive>
        </router-view>
      </el-main>
    </el-container>
    
    <!-- 个人资料弹窗 -->
    <ProfileDialog 
      v-model="showProfileDialog"
      @updated="handleProfileUpdated"
    />
    
    <!-- 谷歌验证弹窗 -->
    <GoogleAuthDialog 
      v-model="showGoogleAuthDialog"
      @updated="handleGoogleAuthUpdated"
    />
  </el-container>
</template>

<script>
import { jwtDecode } from 'jwt-decode';
// (★★★ 新增 Money Icon ★★★)
import { DataLine, User, Coin, PieChart, Setting, Lock, Money, Right, DArrowLeft, DArrowRight } from '@element-plus/icons-vue' 
import { ElMessage } from 'element-plus';
import ProfileDialog from '@/components/ProfileDialog.vue';
import GoogleAuthDialog from '@/components/GoogleAuthDialog.vue';

export default {
  name: 'LayoutView',
  components: {
    ProfileDialog,
    GoogleAuthDialog,
    DataLine, 
    User, 
    Coin, 
    PieChart, 
    Setting, 
    Lock, 
    Money, 
    Right,
    DArrowLeft,
    DArrowRight
  },
  data() {
    return {
      username: 'N/A',
      nickname: '', // 用户昵称
      platformName: 'FlipCoin', // 平台名称，默认值
      tabs: [],
      pageStates: {}, // 保存每个页面的状态
      cachedViews: [], // keep-alive 缓存的组件名称
      showProfileDialog: false,
      showGoogleAuthDialog: false,
      hasGoogleAuth: false, // 是否已绑定谷歌验证
      isCollapsed: false // 側邊欄是否折疊
    };
  },
  computed: {
    // 显示名称：有昵称显示昵称，没有昵称显示帐号
    displayName() {
      if (this.nickname && this.nickname.trim() !== '') {
        return this.nickname;
      }
      return this.username !== 'N/A' ? this.username : 'admin';
    },
    activeMenu() { 
      return this.$route.path; 
    }
  },
  created() {
    this.decodeToken();
    this.initTabs();
    this.loadPlatformName(); // 加载平台名称
    // 延迟加载个人资料，确保token已设置
    this.$nextTick(() => {
      this.loadProfile();
    });
  },
  watch: {
    $route(to, from) {
      // 路由切换前保存旧页面状态（滚动位置）
      if (from && from.path && from.path !== '/login') {
        this.savePageState(from.path);
      }
      // 添加新分页
      this.addTabFromRoute(to);
    }
  },
  beforeUnmount() {
    // 组件销毁前保存所有页面状态
    this.tabs.forEach(tab => {
      this.savePageState(tab.path);
    });
    
    // 移除事件监听
    window.removeEventListener('platformNameUpdated', this.loadPlatformName);
  },
  methods: {
    // 取得當前路由標題
    getRouteTitle(route) {
      if (route.meta && route.meta.title) return route.meta.title;
      return route.name || '未命名頁面';
    },
    // 初始化分頁（載入當前頁）
    initTabs() {
      const route = this.$route;
      if (!route || !route.path || route.path === '/login') return;
      const fullPath = route.path.startsWith('/') ? route.path : `/${route.path}`;
      this.tabs = [{
        path: fullPath,
        title: this.getRouteTitle(route),
      }];
    },
    // 監聽路由變更
    addTabFromRoute(route) {
      if (!route || !route.path || route.path === '/login') return;
      const fullPath = route.path.startsWith('/') ? route.path : `/${route.path}`;
      const title = this.getRouteTitle(route);

      const existingIndex = this.tabs.findIndex(t => t.path === fullPath);
      if (existingIndex !== -1) {
        // 已存在：移到最左側
        const [existing] = this.tabs.splice(existingIndex, 1);
        this.tabs.unshift(existing);
        // 恢复页面状态
        this.restorePageState(fullPath);
      } else {
        // 新增在最左側，舊的往右退
        this.tabs.unshift({ path: fullPath, title });
        
        // 限制最多10个分页
        if (this.tabs.length > 10) {
          const removedTab = this.tabs.pop();
          // 移除时保存状态
          this.savePageState(removedTab.path);
          // 从缓存中移除
          const componentName = this.getComponentName(removedTab.path);
          if (componentName) {
            const index = this.cachedViews.indexOf(componentName);
            if (index > -1) {
              this.cachedViews.splice(index, 1);
            }
          }
        }
        
        // 添加到缓存
        const componentName = this.getComponentName(fullPath);
        if (componentName && !this.cachedViews.includes(componentName)) {
          this.cachedViews.push(componentName);
        }
        
        // 检查是否有保存的状态
        const stateKey = `page_state_${fullPath}`;
        const hasSavedState = sessionStorage.getItem(stateKey);
        if (hasSavedState) {
          // 有保存的状态，恢复它
          this.restorePageState(fullPath);
        } else {
          // 没有保存的状态，说明是首次打开或已被清除
          // keep-alive 会使用组件的默认状态
        }
      }
    },
    // 获取组件名称（用于 keep-alive）
    // 路由 name 到组件 name 的映射（如果不同的话）
    getComponentName(path) {
      const route = this.$router.resolve(path);
      const routeName = route.name;
      
      // 组件 name 映射表（路由 name -> 组件 name）
      const nameMap = {
        'UserManagement': 'UserManagementView',
        'BetManagement': 'BetManagementView',
        'ReportManagement': 'ReportManagementView',
        'CollectionLogs': 'CollectionLogsView',
        'WalletMonitoring': 'WalletMonitoringView',
        'WithdrawalReview': 'WithdrawalReviewView',
        'DepositHistory': 'DepositHistoryView',
        'GameParameters': 'GameParametersView',
        'BlockedRegions': 'BlockedRegionsView',
        'UserLevels': 'UserLevelsView',
        'SameIpMonitor': 'SameIpMonitor', // 组件名称就是 SameIpMonitor
        'AccountManagement': 'AccountManagementView',
        'Permissions': 'PermissionsView',
        'IpWhitelist': 'IpWhitelistView',
        'AuditLogs': 'AuditLogsView',
        'LoginQuery': 'LoginQueryView',
        'UserDepositAddresses': 'UserDepositAddressesView',
        'Dashboard': 'DashboardView'
      };
      
      return nameMap[routeName] || routeName || null;
    },
    // 保存页面状态（keep-alive 会自动保存组件状态，这里主要保存滚动位置）
    savePageState(path) {
      const stateKey = `page_state_${path}`;
      const state = {
        scrollTop: document.querySelector('.layout-main')?.scrollTop || 0,
        timestamp: Date.now()
      };
      
      try {
        sessionStorage.setItem(stateKey, JSON.stringify(state));
      } catch (e) {
        console.warn('Failed to save page state:', e);
      }
    },
    // 恢复页面状态
    restorePageState(path) {
      const stateKey = `page_state_${path}`;
      try {
        const saved = sessionStorage.getItem(stateKey);
        if (saved) {
          const state = JSON.parse(saved);
          // 恢复滚动位置
          this.$nextTick(() => {
            setTimeout(() => {
              const mainEl = document.querySelector('.layout-main');
              if (mainEl) {
                mainEl.scrollTop = state.scrollTop || 0;
              }
            }, 100);
          });
        }
      } catch (e) {
        console.warn('Failed to restore page state:', e);
      }
    },
    // 清除页面状态（分页关闭时调用）
    clearPageState(path) {
      const stateKey = `page_state_${path}`;
      try {
        sessionStorage.removeItem(stateKey);
      } catch (e) {
        console.warn('Failed to clear page state:', e);
      }
      // 从内存中清除
      delete this.pageStates[path];
    },
    handleClickTab(tab) {
      if (tab.path === this.activeMenu) return;
      this.$router.push(tab.path);
    },
    handleCloseTab(tab) {
      const index = this.tabs.findIndex(t => t.path === tab.path);
      if (index === -1) return;

      const isActive = tab.path === this.activeMenu;
      
      // 关闭分页时清除状态，这样重新打开时会使用默认状态
      this.clearPageState(tab.path);
      
      // 从缓存中移除
      const componentName = this.getComponentName(tab.path);
      if (componentName) {
        const cacheIndex = this.cachedViews.indexOf(componentName);
        if (cacheIndex > -1) {
          this.cachedViews.splice(cacheIndex, 1);
        }
      }
      
      this.tabs.splice(index, 1);

      if (isActive) {
        // 關閉當前頁：優先跳到左邊的分頁，否則右邊，否則儀表板
        const target = this.tabs[index] || this.tabs[index - 1] || this.tabs[0];
        if (target) {
          this.$router.push(target.path);
        } else {
          this.$router.push('/dashboard');
        }
      }
    },
    async decodeToken() {
      try {
        const token = localStorage.getItem('admin_token');
        if (token) {
          const decoded = jwtDecode(token);
          this.username = decoded.username || 'admin';
          // 加载个人资料以获取昵称
          await this.loadProfile();
        } else {
          this.handleLogout(true); 
        }
      } catch (error) {
        console.error('Failed to decode token:', error);
        ElMessage.error('Token 验证失败，请重新登入。');
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
    },
    handleCommand(command) {
      if (command === 'profile') {
        this.showProfileDialog = true;
      } else if (command === 'googleAuth') {
        this.showGoogleAuthDialog = true;
      } else if (command === 'logout') {
        this.handleLogout();
      }
    },
    async handleProfileUpdated() {
      // 个人资料更新后刷新用户信息
      await this.loadProfile();
    },
    async loadProfile() {
      try {
        const data = await this.$api.getProfile();
        this.hasGoogleAuth = data.hasGoogleAuth || false;
        this.nickname = data.nickname || '';
      } catch (error) {
        console.error('Failed to load profile:', error);
      }
    },
    async loadPlatformName() {
      try {
        const settings = await this.$api.getSettings();
        if (settings.General && settings.General.PLATFORM_NAME) {
          this.platformName = settings.General.PLATFORM_NAME.value || 'FlipCoin';
        }
        // 更新页签标题
        this.updatePageTitle();
      } catch (error) {
        console.error('Failed to load platform name:', error);
      }
    },
    updatePageTitle() {
      document.title = `${this.platformName} 管理後台`;
    },
    handleGoogleAuthUpdated() {
      // 谷歌验证绑定/解绑后刷新状态
      this.loadProfile();
    },
    toggleSidebar() {
      this.isCollapsed = !this.isCollapsed;
      // 保存折疊狀態到 localStorage
      localStorage.setItem('sidebarCollapsed', this.isCollapsed);
      // ⚠️ 父菜單標題的 hover popup 功能暫時關閉，避免在某些瀏覽器安全沙箱中拋出 SES_UNCAUGHT_EXCEPTION
    }
  },
  mounted() {
    // 從 localStorage 恢復折疊狀態
    const savedCollapsed = localStorage.getItem('sidebarCollapsed');
    if (savedCollapsed !== null) {
      this.isCollapsed = savedCollapsed === 'true';
    }
    
    // 监听平台名称更新事件
    window.addEventListener('platformNameUpdated', this.loadPlatformName);
  },
  beforeUnmount() {
    // 目前沒有 observer 需要清理，保留鉤子以便未來擴充
  }
}
</script>
<style scoped>
.layout-container {
  height: 100vh;
  background: #f5f7fa;
}

/* 头部样式 - 深绿色系 */
.layout-header {
  background: linear-gradient(135deg, #135200 0%, #237804 100%);
  color: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 18px;
  font-weight: 500;
  padding: 0 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}


.layout-header .el-button {
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  transition: all 0.2s ease;
}

.layout-header .el-button:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-1px);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.collapse-btn {
  color: #fff !important;
  font-size: 18px;
  padding: 8px !important;
  border: none !important;
  background: transparent !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.collapse-btn:hover {
  background: rgba(255, 255, 255, 0.1) !important;
}

.collapse-btn .el-icon {
  color: #fff !important;
}

.user-info {
  font-size: 16px;
  opacity: 0.9;
}

.user-avatar {
  cursor: pointer;
  background: rgba(255, 255, 255, 0.2) !important;
  color: #fff !important;
  transition: all 0.2s ease;
  display: flex !important;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

.user-avatar:hover {
  background: rgba(255, 255, 255, 0.3) !important;
  transform: scale(1.05);
}

/* 侧边栏样式 - 深绿色系 */
.layout-aside {
  background: linear-gradient(180deg, #1a4d00 0%, #237804 100%);
  height: calc(100vh - 60px);
  overflow-y: auto;
  overflow-x: hidden;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
  transition: width 0.3s ease;
}

.layout-aside.is-collapsed {
  width: 64px !important;
}

.el-menu-vertical-demo {
  border-right: none;
  background: transparent !important;
  transition: all 0.3s ease;
}

/* 折疊狀態下的菜單樣式 */
.layout-aside.is-collapsed .el-menu-item {
  padding: 0 !important;
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  text-align: center;
  margin: 4px 0 !important;
  width: 64px !important;
  height: 48px;
}

.layout-aside.is-collapsed .el-sub-menu__title {
  padding: 0 !important;
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  text-align: center;
  margin: 4px 0 !important;
  width: 64px !important;
  height: 48px;
}

/* 確保圖標本身居中且統一大小 */
.layout-aside.is-collapsed .el-menu-item .el-icon,
.layout-aside.is-collapsed .el-sub-menu__title .el-icon {
  margin: 0 !important;
  padding: 0 !important;
  width: 20px !important;
  height: 20px !important;
  font-size: 20px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
}

/* 隱藏文字 */
.layout-aside.is-collapsed .el-menu-item span,
.layout-aside.is-collapsed .el-sub-menu__title span {
  display: none !important;
}

/* 隱藏箭頭 */
.layout-aside.is-collapsed .el-sub-menu__icon-arrow {
  display: none !important;
}

/* 確保所有圖標容器都居中且寬度一致 */
.layout-aside.is-collapsed .el-menu-item,
.layout-aside.is-collapsed .el-sub-menu__title {
  width: 64px !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
}

/* 移除可能的偽元素 */
.layout-aside.is-collapsed .el-menu-item::after,
.layout-aside.is-collapsed .el-sub-menu__title::after {
  display: none !important;
}

/* 確保子菜單標題內的內容也居中 */
.layout-aside.is-collapsed .el-sub-menu__title > * {
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  margin: 0 !important;
}

/* 使用深度選擇器確保樣式正確應用 */
.layout-aside.is-collapsed :deep(.el-sub-menu__title) {
  padding: 0 !important;
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  width: 64px !important;
  margin: 4px 0 !important;
}

.layout-aside.is-collapsed :deep(.el-sub-menu__title .el-icon) {
  margin: 0 !important;
  padding: 0 !important;
  width: 20px !important;
  height: 20px !important;
  font-size: 20px !important;
}

.layout-aside.is-collapsed :deep(.el-sub-menu__title span) {
  display: none !important;
}

.el-menu-item,
.el-sub-menu :deep(.el-sub-menu__title) {
  color: rgba(255, 255, 255, 0.85) !important;
  transition: all 0.2s ease;
  border-radius: 8px;
  margin: 4px 12px;
  width: calc(100% - 24px);
}

/* 父菜單標題使用 flex 布局，設為相對定位以便箭頭絕對定位 */
.el-sub-menu :deep(.el-sub-menu__title) {
  display: flex !important;
  align-items: center !important;
  position: relative !important;
  padding-right: 28px !important;
}

/* 父菜單標題左側內容區域（圖標和文字） */
.el-sub-menu :deep(.el-sub-menu__title) > .el-icon:not(.el-sub-menu__icon-arrow) {
  margin-right: 8px !important;
  flex-shrink: 0 !important;
}

.el-sub-menu :deep(.el-sub-menu__title) > span {
  flex: 0 1 auto !important;
  margin-right: 0 !important;
}

/* 父菜單箭頭圖標（右側） - 使用絕對定位強制放在右側 */
.el-sub-menu :deep(.el-sub-menu__icon-arrow) {
  position: absolute !important;
  right: 12px !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  margin: 0 !important;
  padding: 0 !important;
  flex-shrink: 0 !important;
  display: block !important;
}

.el-menu-item:hover,
.el-sub-menu :deep(.el-sub-menu__title:hover) {
  background-color: rgba(255, 255, 255, 0.1) !important;
  color: #fff !important;
}

.el-menu-item.is-active {
  color: #fff !important;
  background-color: rgba(255, 255, 255, 0.1) !important;
  font-weight: 600;
}

.el-menu--inline {
  background: rgba(0, 0, 0, 0.2) !important;
  padding: 8px 0;
}

.el-menu--inline .el-menu-item {
  background-color: transparent !important;
  margin: 2px 12px;
  padding-left: 48px !important;
}

.el-menu--inline .el-menu-item:hover {
  background-color: rgba(255, 255, 255, 0.08) !important;
  color: #fff !important;
}

.el-menu--inline .el-menu-item.is-active {
  background-color: rgba(255, 255, 255, 0.08) !important;
  color: #fff !important;
  font-weight: 500;
}

/* 主内容区样式 */
.layout-main {
  background-color: #f5f7fa;
  padding: 0;
  height: calc(100vh - 60px);
  overflow-y: auto;
  transition: margin-left 0.3s ease;
}

/* 分頁列樣式 */
.tabs-bar {
  display: flex;
  align-items: center;
  padding: 8px 16px 0 16px;
  gap: 8px;
  background-color: #f5f7fa;
  position: sticky;
  top: 0;
  z-index: 900;
}

.tab-item {
  display: inline-flex;
  align-items: center;
  width: 112px; /* 固定 7 個中文字元寬度 (7 * 16px = 112px，考慮字體大小) */
  min-width: 112px;
  max-width: 112px;
  padding: 6px 8px;
  border-radius: 16px;
  background-color: #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  box-sizing: border-box;
  flex-shrink: 0;
  flex-grow: 0;
}

.tab-item.active {
  background-color: #237804;
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(19, 82, 0, 0.35);
}

.tab-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
  max-width: calc(112px - 32px); /* 减去关闭按钮(16px)和padding(16px)的空间 */
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-item.active .tab-label {
  color: #ffffff;
}

.tab-close {
  margin-left: 6px;
  font-size: 12px;
  opacity: 0.7;
  cursor: pointer;
}

.tab-item.active .tab-close {
  color: #ffffff;
}

.tab-close:hover {
  opacity: 1;
}

/* 图标间距 */
.el-icon {
  margin-right: 8px;
}

/* 侧边栏滚动条样式 */
.layout-aside::-webkit-scrollbar {
  width: 6px;
}

.layout-aside::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
}

.layout-aside::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.layout-aside::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>

<style>
/* 全局樣式：優化折疊狀態下的菜單彈出樣式 */
.el-sub-menu__popper {
  background: linear-gradient(180deg, #1a4d00 0%, #237804 100%) !important;
  border: none !important;
  border-radius: 8px !important;
  box-shadow: 2px 4px 12px rgba(0, 0, 0, 0.2) !important;
  padding: 0 !important;
  min-width: 200px !important;
}

/* 彈出菜單容器 */
.el-sub-menu__popper .el-menu {
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
}

/* 父菜單標題樣式（更深的背景以區分） */
.el-sub-menu__popper .menu-parent-title {
  padding: 10px 20px !important;
  color: rgba(255, 255, 255, 0.95) !important;
  font-weight: 600 !important;
  font-size: 14px !important;
  background: rgba(0, 0, 0, 0.3) !important;
  margin: 0 !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.15) !important;
  border-radius: 8px 8px 0 0 !important;
}

/* 子菜單容器樣式（與展開狀態保持一致 - 較淺的背景） */
.el-sub-menu__popper .el-menu--inline {
  background: rgba(0, 0, 0, 0.2) !important;
  padding: 8px 0 !important;
  margin-top: 0 !important;
}

/* 子菜單項樣式（與展開狀態相同的背景色差異 - 透明背景在深色容器上） */
.el-sub-menu__popper .el-menu--inline .el-menu-item {
  background-color: transparent !important;
  color: rgba(255, 255, 255, 0.85) !important;
  padding: 10px 20px 10px 48px !important;
  margin: 2px 12px !important;
  border-radius: 6px !important;
  transition: all 0.2s ease !important;
}

.el-sub-menu__popper .el-menu--inline .el-menu-item:hover {
  background-color: rgba(255, 255, 255, 0.08) !important;
  color: #fff !important;
}

.el-sub-menu__popper .el-menu--inline .el-menu-item.is-active {
  background-color: rgba(255, 255, 255, 0.15) !important;
  color: #fff !important;
  font-weight: 500 !important;
}

/* 確保父菜單標題和子菜單容器之間有明顯的視覺區分 */
.el-sub-menu__popper .menu-parent-title + .el-menu--inline {
  margin-top: 0 !important;
}
</style>