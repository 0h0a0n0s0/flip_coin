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
      <!-- Collapse Button -->
      <el-button
        text
        @click="toggleCollapse"
        class="collapse-btn"
      >
        <el-icon><ArrowLeft /></el-icon>
        <span v-if="!isCollapsed">Collapse</span>
      </el-button>

      <!-- Search - Hidden when collapsed -->
      <div v-if="!isCollapsed" class="sidebar-search">
        <div class="search-input-wrapper">
          <div class="search-icon-wrapper">
            <el-icon class="search-icon"><Search /></el-icon>
          </div>
          <el-input
            v-model="searchQuery"
            placeholder="Search games..."
            class="search-input"
          />
        </div>
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
  openDrawer
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

.collapse-btn {
  width: 100%;
  justify-content: flex-start;
  height: 28px;
  padding: 0 var(--space-2);
  font-size: 11px;
  color: var(--text-muted);
}

/* Search Bar - 暗色科技风格，符合项目宪法 */
.sidebar-search {
  margin-bottom: var(--space-1);
  position: relative;
}

.search-input-wrapper {
  position: relative;
  width: 100%;
}

.search-icon-wrapper {
  position: absolute;
  left: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  pointer-events: none;
  display: flex;
  align-items: center;
  transition: color 0.2s;
}

.search-icon {
  width: 14px;
  height: 14px;
  color: rgb(var(--text-muted)); /* 默认灰色 */
  transition: color 0.2s;
}

/* 聚焦时图标变金色 */
.search-input-wrapper:focus-within .search-icon {
  color: rgb(var(--primary)); /* 聚焦时变金色 */
}

.search-input :deep(.el-input__inner) {
  height: 32px;
  font-size: 13px;
  background-color: rgb(var(--surface)); /* 背景色：深灰色 #131416 */
  border: 1px solid rgb(var(--border)); /* 边框：深灰边框，1px */
  color: rgb(var(--foreground)); /* 文字颜色：白灰 */
  border-radius: var(--radius-md); /* 圆角：8px */
  padding-left: calc(var(--space-3) + 14px + var(--space-2)); /* 为图标留出空间 */
  padding-right: var(--space-3);
  transition: all 0.2s;
}

.search-input :deep(.el-input__inner:focus) {
  outline: none;
  border-color: rgb(var(--primary)); /* 聚焦时边框变金色 */
  box-shadow: 0 0 0 1px rgb(var(--primary)); /* 金色光晕效果 */
}

.search-input :deep(.el-input__inner::placeholder) {
  color: rgb(var(--text-muted)); /* Placeholder 颜色：暗灰 */
}

.search-input :deep(.el-input__wrapper) {
  box-shadow: none; /* 移除 Element Plus 默认阴影 */
}

.search-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: none; /* 聚焦时也移除默认阴影，使用自定义光晕 */
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
  width: 14px; /* icon 增加到 14px */
  height: 14px;
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

