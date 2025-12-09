<!-- 模块 4: LeftSidebar - 左侧可收缩菜单 -->
<!-- 包含：游戏分类菜单、搜索、收缩/展开功能 -->
<template>
  <!-- Desktop Sidebar -->
  <aside
    v-if="!isMobile"
    class="sidebar-desktop"
    :class="{ collapsed: isCollapsed }"
  >
    <div class="sidebar-content">
      <!-- Search - Hidden when collapsed -->
      <div v-if="!isCollapsed" class="sidebar-search">
        <el-input
          v-model="searchQuery"
          placeholder="Search games..."
          class="search-input"
        >
          <template #prefix>
            <el-icon class="search-icon"><Search /></el-icon>
          </template>
        </el-input>
      </div>

      <!-- Menu Items -->
      <nav class="sidebar-nav">
        <button
          v-for="item in menuItems"
          :key="item.id"
          @click="setActiveItem(item.id)"
          :class="['menu-item', { active: activeItem === item.id }]"
          :title="isCollapsed ? item.label : undefined"
        >
          <component :is="item.icon" class="menu-icon" />
          <span v-if="!isCollapsed" class="menu-label">{{ item.label }}</span>
        </button>
      </nav>
    </div>
  </aside>

  <!-- Mobile Drawer -->
  <el-drawer
    v-model="mobileDrawerOpen"
    :with-header="false"
    direction="ltr"
    size="260px"
    class="sidebar-drawer-mobile"
  >
    <div class="drawer-content">
      <div class="drawer-header">
        <h3>Game Categories</h3>
      </div>
      <nav class="sidebar-nav">
        <button
          v-for="item in menuItems"
          :key="item.id"
          @click="setActiveItem(item.id)"
          :class="['menu-item', { active: activeItem === item.id }]"
        >
          <component :is="item.icon" class="menu-icon" />
          <span class="menu-label">{{ item.label }}</span>
        </button>
      </nav>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  Search,
  ArrowLeft,
  Grid,
  DataLine,
  Star,
  Money,
  Bottom,
  Lightning,
  Pointer,
  Tickets,
  CircleCheck,
  Link,
  Lock
} from '@element-plus/icons-vue'

const props = defineProps({
  activeCategory: {
    type: String,
    default: 'all'
  }
})

const emit = defineEmits(['update:activeCategory'])

const isCollapsed = ref(false)
const searchQuery = ref('')
const activeItem = ref('all')
const mobileDrawerOpen = ref(false)
const isMobile = ref(false)

const menuItems = [
  { id: 'all', label: 'All Games', icon: Grid },
  { id: 'hash', label: 'Hash Game', icon: Lock },
  { id: 'trending', label: 'Trending', icon: DataLine },
  { id: 'new', label: 'New', icon: Star },
  { id: 'slots', label: 'Slots', icon: Money },
  { id: 'crash', label: 'Crash Games', icon: Bottom },
  { id: 'quick', label: 'Quick Games', icon: Lightning },
  { id: 'tap', label: 'Tap Games', icon: Pointer },
  { id: 'scratch', label: 'Scratch Cards', icon: Tickets },
  { id: 'bingo', label: 'Bingo', icon: CircleCheck },
  { id: 'lowdata', label: 'Low Data Games', icon: Link }
]

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}

function setActiveItem(id) {
  activeItem.value = id
  emit('update:activeCategory', id)
  if (isMobile.value) {
    mobileDrawerOpen.value = false
  }
}

function checkMobile() {
  isMobile.value = window.innerWidth < 1024
}

function openDrawer() {
  if (isMobile.value) {
    mobileDrawerOpen.value = true
  }
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

defineExpose({
  openDrawer,
  toggleCollapse,
  isCollapsed
})
</script>

<style scoped>
.sidebar-desktop {
  display: none;
  position: sticky;
  top: 104px; /* Header 64px + TopCategoryNav 40px */
  height: calc(100vh - 104px);
  width: 230px; /* 展开宽度改为 230px */
  border-right: 1px solid rgb(var(--border));
  background-color: rgb(var(--background) / 0.6);
  backdrop-filter: blur(8px);
  transition: width 0.3s;
  overflow-y: auto;
}

.sidebar-desktop.collapsed {
  width: 54px;
}

@media (min-width: 1024px) {
  .sidebar-desktop {
    display: block;
  }
}

.sidebar-content {
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* Collapse Button 已移至 TopCategoryNav，此处样式已移除 */

/* Search Bar - 暗色科技风格，符合项目宪法 */
.sidebar-search {
  margin-bottom: var(--space-1);
}

/* 覆盖 Element Plus 外层容器 - 强制深色背景 */
.search-input :deep(.el-input__wrapper) {
  background-color: rgb(var(--surface)) !important; /* 强制深色背景 #131416 */
  box-shadow: none !important; /* 去除预设阴影 */
  border: 1px solid rgb(var(--border)) !important; /* 加上深灰边框 */
  border-radius: var(--radius-sm); /* 稍微圆角 (4px) */
  padding: 0 var(--space-2);
  transition: all 0.2s ease;
  height: 32px; /* 固定高度 */
}

/* 聚焦时的效果 */
.search-input :deep(.el-input__wrapper.is-focus) {
  border-color: rgb(var(--primary)) !important; /* 聚焦变金色 */
  box-shadow: 0 0 0 1px rgb(var(--primary)) !important; /* 金色光晕 */
}

/* 输入框内部文字 */
.search-input :deep(.el-input__inner) {
  height: 32px;
  color: rgb(var(--foreground)) !important; /* 文字颜色：白灰 */
  font-size: 13px;
  background-color: transparent !important; /* 输入框内部透明，使用外层背景 */
  border: none !important; /* 移除内部边框，使用外层边框 */
}

.search-input :deep(.el-input__inner::placeholder) {
  color: rgb(var(--text-muted)) !important; /* Placeholder 颜色：暗灰 */
}

/* 图标样式 */
.search-input .search-icon {
  width: 14px;
  height: 14px;
  color: rgb(var(--text-muted)); /* 默认灰色 */
  transition: color 0.2s;
}

/* 聚焦时图标变金色 */
.search-input :deep(.el-input__wrapper.is-focus) .search-icon {
  color: rgb(var(--primary)) !important; /* 聚焦时变金色 */
}

/* 图标容器样式 */
.search-input :deep(.el-input__prefix-inner) {
  padding-right: var(--space-2);
  display: flex;
  align-items: center;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2);
  height: 32px;
  border-radius: var(--radius-md);
  font-size: 14px; /* 文案增加到 14px */
  font-weight: 500;
  transition: all 0.2s;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
}

.menu-item:hover {
  color: rgb(var(--foreground));
  background-color: rgb(var(--surface-light) / 0.5);
}

.menu-item.active {
  background-color: rgb(var(--primary) / 0.1);
  color: rgb(var(--primary));
  border: 1px solid rgb(var(--primary) / 0.2);
}

.menu-icon {
  width: 20px; /* icon 改为 20x20 */
  height: 20px;
  flex-shrink: 0;
}

.menu-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-desktop.collapsed .menu-label {
  display: none;
}

.sidebar-drawer-mobile {
  display: block;
}

@media (min-width: 1024px) {
  .sidebar-drawer-mobile {
    display: none;
  }
}

.drawer-content {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.drawer-header {
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border);
}

.drawer-header h3 {
  font-size: 14px;
  color: var(--foreground);
}
</style>

