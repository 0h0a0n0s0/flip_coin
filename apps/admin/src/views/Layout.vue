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
        <!-- 提款審核通知 -->
        <div 
          class="header-action-button" 
          @click="handleWithdrawalClick" 
          v-if="$permissions.has('withdrawals', 'read')"
        >
          <el-icon :size="24" class="action-icon">
            <Wallet />
          </el-icon>
          <span class="action-text">提款审核:{{ pendingWithdrawalCount }}</span>
        </div>
        <!-- 波场异常通知 -->
        <div 
          class="header-action-button" 
          @click="showTronNotificationDialog = true" 
          v-if="$permissions.has('wallets', 'read')"
        >
          <el-icon :size="24" class="action-icon">
            <Connection />
          </el-icon>
          <span class="action-text">监听异常:{{ tronNotificationCount }}</span>
        </div>
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
          :collapse-transition="false"  :default-active="activeMenu"
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
          
          <el-sub-menu index="game-management" v-if="$permissions.has('settings_game', 'read')" data-parent-name="游戏管理">
            <template #title><el-icon><Coin /></el-icon><span>游戏管理</span></template>
            <el-menu-item index="/games/management" v-if="$permissions.has('settings_game', 'read')">自营游戏管理</el-menu-item>
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
            <el-menu-item index="/finance/address-blacklist" v-if="$permissions.has('withdrawals', 'read')">地址黑名單</el-menu-item>
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
            <el-menu-item index="/settings/data-retention" v-if="$permissions.has('settings_game', 'read')">資料保存規範</el-menu-item>
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
    
    <!-- 波场异常通知弹窗 -->
    <TronNotificationDialog 
      v-model="showTronNotificationDialog"
      @updated="loadTronNotificationCount"
    />
  </el-container>
</template>

<script>
import { jwtDecode } from 'jwt-decode';
// (★★★ 新增 Money Icon 和 Wallet Icon ★★★)
import { DataLine, User, Coin, PieChart, Setting, Lock, Money, Right, DArrowLeft, DArrowRight, Connection, Wallet } from '@element-plus/icons-vue' 
import { ElMessage } from 'element-plus';
import ProfileDialog from '@/components/ProfileDialog.vue';
import GoogleAuthDialog from '@/components/GoogleAuthDialog.vue';
import TronNotificationDialog from '@/components/TronNotificationDialog.vue';

export default {
  name: 'LayoutView',
  components: {
    ProfileDialog,
    GoogleAuthDialog,
    TronNotificationDialog,
    DataLine, 
    User, 
    Coin, 
    PieChart, 
    Setting, 
    Lock, 
    Money, 
    Right,
    DArrowLeft,
    DArrowRight,
    Connection,
    Wallet
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
      isCollapsed: false, // 側邊欄是否折疊
      showTronNotificationDialog: false, // 波场异常通知弹窗
      tronNotificationCount: 0, // 未解决的异常通知数量
      socket: null // Socket.IO 連接實例
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
    },
    // 從 store 獲取待審核提款數量
    pendingWithdrawalCount() {
      return this.$withdrawalStore?.pendingWithdrawalCount || 0;
    }
  },
  created() {
    this.decodeToken();
    this.initTabs();
    this.loadPlatformName(); // 加载平台名称
    // 延迟加载个人资料，确保token已设置
    this.$nextTick(() => {
      this.loadProfile();
      // 如果有权限，加载波场通知数量
      if (this.$permissions && this.$permissions.has('wallets', 'read')) {
        this.loadTronNotificationCount();
        // 每30秒刷新一次
        setInterval(() => {
          this.loadTronNotificationCount();
        }, 30000);
      }
      // 如果有提款審核權限，初始化 Socket.IO 連接和載入初始計數
      if (this.$permissions && this.$permissions.has('withdrawals', 'read')) {
        this.initSocketConnection();
        this.loadPendingWithdrawalCount();
      }
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
    },
    async loadTronNotificationCount() {
      try {
        const response = await this.$api.getTronNotificationsCount();
        // (★★★ 修復：後端使用標準響應格式 { success: true, data: { count } } ★★★)
        if (response && response.success && response.data && response.data.count !== undefined) {
          this.tronNotificationCount = response.data.count;
        } else if (response && response.data && response.data.count !== undefined) {
          // 向後兼容：如果沒有 success 標記，但有 data.count
          this.tronNotificationCount = response.data.count;
        } else if (response && response.count !== undefined) {
          // 向後兼容：如果直接有 count
          this.tronNotificationCount = response.count;
        }
      } catch (error) {
        console.error('Failed to load tron notification count:', error);
      }
    },
    /**
     * 初始化 Socket.IO 連接
     */
    initSocketConnection() {
      try {
        // 動態導入 socket.io-client（如果未安裝則跳過）
        import('socket.io-client').then(({ default: io }) => {
          const token = localStorage.getItem('admin_token');
          if (!token) {
            console.warn('[Layout] No admin token found, skipping socket connection');
            return;
          }

          // 連接到後端 Socket.IO 服務器
          this.socket = io(window.location.origin, {
            auth: { token },
            transports: ['websocket', 'polling']
          });

          // 加入 admin room
          this.socket.on('connect', () => {
            console.log('[Layout] Socket.IO connected');
            this.socket.emit('join_admin_room');
          });

          // 監聽管理員統計更新事件
          this.socket.on('admin:stats_update', (data) => {
            if (data && data.type === 'withdrawal_pending_count' && typeof data.count === 'number') {
              this.$withdrawalStore.setPendingCount(data.count);
            }
          });

          // 監聽新通知事件
          this.socket.on('admin:notification_new', (data) => {
            console.log('[Layout] Received new notification:', data);
            // 刷新通知計數
            this.loadTronNotificationCount();
          });

          this.socket.on('disconnect', () => {
            console.log('[Layout] Socket.IO disconnected');
          });

          this.socket.on('error', (error) => {
            console.error('[Layout] Socket.IO error:', error);
          });
        }).catch((error) => {
          console.warn('[Layout] Socket.IO client not available, using polling instead:', error);
          // 如果 socket.io-client 未安裝，使用輪詢方式
          setInterval(() => {
            this.loadPendingWithdrawalCount();
          }, 30000); // 每30秒輪詢一次
        });
      } catch (error) {
        console.error('[Layout] Failed to initialize socket connection:', error);
        // 降級到輪詢
        setInterval(() => {
          this.loadPendingWithdrawalCount();
        }, 30000);
      }
    },
    /**
     * 載入待審核提款數量
     */
    async loadPendingWithdrawalCount() {
      try {
        const response = await this.$api.getDashboardStats();
        if (response && response.success && response.data) {
          const count = response.data.pendingPayouts || 0;
          this.$withdrawalStore.setPendingCount(count);
        } else if (response && response.pendingPayouts !== undefined) {
          // 向後兼容
          this.$withdrawalStore.setPendingCount(response.pendingPayouts || 0);
        }
      } catch (error) {
        console.error('Failed to load pending withdrawal count:', error);
      }
    },
    /**
     * 點擊提款審核通知，導航到提款審核頁面
     */
    handleWithdrawalClick() {
      this.$router.push('/finance/withdrawals');
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
    // 清理 Socket.IO 連接
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
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
  gap: 8px;
  height: 100%;
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

/* 統一的 Header 操作按鈕樣式 - 最大化尺寸，圓角方形，垂直堆疊 */
.header-action-button {
  cursor: pointer;
  padding: 0 12px;
  margin: 1px 0;
  border-radius: 6px;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 2px;
  height: 100%;
  min-width: 75px;
  box-sizing: border-box;
}

.header-action-button:hover {
  background: rgba(255, 255, 255, 0.1);
}

.action-icon {
  color: #fff;
  flex-shrink: 0;
}

.action-text {
  color: #fff;
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
  font-weight: 600;
  text-align: center;
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
  /* transition 已移至全局样式，避免冲突 */
}

.el-menu-item,
.el-sub-menu :deep(.el-sub-menu__title) {
  color: rgba(255, 255, 255, 0.85) !important;
  transition: all 0.2s ease;
  border-radius: 8px;
  margin: 4px 12px;
  width: calc(100% - 24px);
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
  /* =================================================================
     PART 1: 侧边栏主体 - 防抖动 + 垂直对齐核心
     ================================================================= */
  
  /* 1. 锁定选单容器宽度 */
  .el-menu-vertical-demo:not(.el-menu--collapse) {
    width: 200px;
    min-height: 400px;
  }
  
  /* 2. 侧边栏所有项 - 基础重置 (防抖动) */
  .layout-aside .el-menu-item, 
  .layout-aside .el-sub-menu__title {
    /* 仅允许颜色过渡 */
    transition: background-color 0.3s, color 0.3s !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: clip !important;
    margin: 0 !important;
    border-radius: 0 !important;
    /* 默认高度 */
    height: 50px !important;
    line-height: 50px !important;
  }
  
  /* --- 🎯 核心修改：文字左侧切齐逻辑 --- */
  
  /* 3. 展开状态：父级菜单 (有图标) */
  /* 20px (左间距) + 24px (图标) + 12px (间距) = 文字从 56px 处开始 */
  .layout-aside:not(.is-collapsed) .el-sub-menu__title,
  .layout-aside:not(.is-collapsed) > .el-menu-item {
    padding-left: 20px !important;
  }
  
  /* 4. 展开状态：子级菜单 (无图标) */
  /* 强行设定 padding-left 为 56px，让文字直接对齐父级文字 */
  .layout-aside:not(.is-collapsed) .el-menu--inline .el-menu-item {
    padding-left: 56px !important; 
  }
  
  /* ----------------------------------- */
  
  /* 5. 左侧图标 - 钉死位置与尺寸 */
  .layout-aside .el-menu-item .el-icon,
  .layout-aside .el-sub-menu__title .el-icon:not(.el-sub-menu__icon-arrow) {
    width: 24px !important;
    min-width: 24px !important;
    height: 24px !important;
    display: inline-flex !important;
    justify-content: center !important;
    align-items: center !important;
    margin-right: 12px !important; /* 图标与文字间距 */
    font-size: 18px !important;
    vertical-align: middle !important;
    transition: none !important; 
  }
  
  /* 6. 折叠状态 - 强制居中对齐 */
  .layout-aside.is-collapsed .el-menu-item,
  .layout-aside.is-collapsed .el-sub-menu__title {
    padding: 0 !important;
    margin: 0 !important; 
    width: 100% !important;
    justify-content: center !important; 
  }
  .layout-aside.is-collapsed .el-menu-item .el-icon,
  .layout-aside.is-collapsed .el-sub-menu__title .el-icon:not(.el-sub-menu__icon-arrow) {
    margin-right: 0 !important; /* 折叠时不需要右边距 */
  }
  
  /* 7. 右侧箭头 - 绝对定位防挤压 */
  .layout-aside .el-sub-menu__title .el-sub-menu__icon-arrow {
    position: absolute !important;
    right: 16px !important;
    top: 50% !important;
    margin: 0 !important;
    width: auto !important;
    height: auto !important;
    transform: translateY(-50%) rotate(0deg); 
    transition: transform 0.3s !important;
  }
  
  /* 8. 箭头展开旋转 */
  .layout-aside .el-sub-menu.is-opened > .el-sub-menu__title .el-sub-menu__icon-arrow {
    transform: translateY(-50%) rotate(180deg) !important;
  }
  
  /* 9. 折叠时隐藏杂项 */
  .layout-aside.is-collapsed .el-sub-menu__title .el-sub-menu__icon-arrow,
  .layout-aside.is-collapsed .el-sub-menu__title span,
  .layout-aside.is-collapsed .el-menu-item span {
    display: none !important;
    opacity: 0 !important;
  }
  
  /* 10. 确保父容器相对定位 */
  .layout-aside .el-sub-menu__title {
    position: relative !important;
    padding-right: 40px !important;
  }
  
  /* =================================================================
   PART 2: 彈出菜單 - 滿版無縫樣式 (Full-Width Seamless)
   ================================================================= */

  /* 1. 外框容器 - 移除所有內距 */
  .el-sub-menu__popper {
    background: linear-gradient(180deg, #1a4d00 0%, #237804 100%) !important;
    border: none !important;
    border-radius: 8px !important;
    box-shadow: 2px 4px 12px rgba(0, 0, 0, 0.2) !important;
    /* 關鍵：容器本身不留白 */
    padding: 0 !important; 
    overflow: hidden !important; 
  }

  /* 2. 內部列表容器 - 清除 Element 預設 Padding */
  /* 注意：這裡同時選取 .el-menu 和 .el-menu--popup 以防萬一 */
  .el-sub-menu__popper .el-menu,
  .el-sub-menu__popper .el-menu--popup,
  .el-sub-menu__popper .el-menu--inline {
    padding: 0 !important;
    margin: 0 !important;
    background-color: transparent !important;
    border: none !important;
    width: 100% !important; /* 確保列表容器填滿外框 */
  }

  /* 3. 菜單項目 - 強制滿版直角 */
  .el-sub-menu__popper .el-menu-item,
  .el-sub-menu__popper .el-sub-menu__title {
    background-color: transparent !important;
    color: rgba(255, 255, 255, 0.85) !important;
    
    /* 關鍵：移除邊距，寬度 100% 填滿容器 */
    margin: 0 !important;       
    border-radius: 0 !important;    
    width: 100% !important;
    box-sizing: border-box !important; /* 確保 padding 不會撐爆寬度 */
    
    height: 40px !important;
    line-height: 40px !important;
  }

  /* 4. 懸停效果 - 滿版填充 */
  .el-sub-menu__popper .el-menu-item:hover,
  .el-sub-menu__popper .el-sub-menu__title:hover {
    background-color: rgba(255, 255, 255, 0.15) !important;
    color: #fff !important;
  }

  /* 5. 激活狀態 - 滿版填充 */
  .el-sub-menu__popper .el-menu-item.is-active {
    background-color: rgba(255, 255, 255, 0.2) !important;
    color: #fff !important;
    font-weight: 600;
  }

  /* 6. 父標題特殊處理 (如果有) */
  .el-sub-menu__popper .menu-parent-title {
    margin: 0 !important;
    border-radius: 0 !important;
    background: rgba(0, 0, 0, 0.2) !important;
    width: 100% !important;
  }

  /* --- 强制左侧菜单项目满宽 (200px) --- */
  /* 1. 针对所有左侧菜单项 (包括子菜单标题) */
  .layout-container .el-aside .el-menu-item,
  .layout-container .el-aside .el-sub-menu__title {
    /* 核心：移除左右边距，宽度设为 100% */
    margin: 0 !important;
    width: 100% !important;
    border-radius: 0 !important; /* 移除圆角，变回直角 */
    box-sizing: border-box !important; /* 确保 padding 不会撑大宽度 */
  }

  /* 2. 修正选中和悬停状态的背景色范围 */
  .layout-container .el-aside .el-menu-item.is-active,
  .layout-container .el-aside .el-menu-item:hover,
  .layout-container .el-aside .el-sub-menu__title:hover {
    width: 100% !important;
    border-radius: 0 !important;
  }

  /* 3. (可选) 如果不需要右侧的边框线，可以隐藏 */
  .layout-container .el-aside .el-menu {
    border-right: none !important;
  }
  </style>