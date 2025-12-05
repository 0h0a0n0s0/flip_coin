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
        <el-input
          v-model="searchQuery"
          placeholder="Search..."
          class="search-input"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
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
  openDrawer
})
</script>

<style scoped>
.sidebar-desktop {
  display: none;
  position: sticky;
  top: 88px;
  height: calc(100vh - 88px);
  width: 200px;
  border-right: 1px solid var(--border);
  background-color: rgba(19, 20, 22, 0.6);
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

.sidebar-search {
  margin-bottom: var(--space-1);
}

.search-input :deep(.el-input__inner) {
  height: 28px;
  font-size: 11px;
  background-color: rgba(26, 28, 31, 0.5);
  border-color: var(--border);
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
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
}

.menu-item:hover {
  color: var(--foreground);
  background-color: rgba(26, 28, 31, 0.5);
}

.menu-item.active {
  background-color: rgba(243, 195, 64, 0.1);
  color: var(--primary);
  border: 1px solid rgba(243, 195, 64, 0.2);
}

.menu-icon {
  width: 16px;
  height: 16px;
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

