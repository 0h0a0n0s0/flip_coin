<!-- 模块 2: TopCategoryNav - Header 下方游戏分类 Tab 区 -->
<!-- 包含：Home, Hash Game, Sports, Live Casino, Pokers, Slot, 街机 -->
<template>
  <div class="top-category-nav">
    <!-- Desktop -->
    <div class="category-nav-desktop">
      <div class="category-nav-container">
        <!-- Collapse Button - 放在 Home 左边 -->
        <button
          @click="handleToggleSidebar"
          class="collapse-toggle-btn"
          :title="isSidebarCollapsed ? '展开菜单' : '收缩菜单'"
        >
          <el-icon class="collapse-icon">
            <ArrowRight v-if="isSidebarCollapsed" />
            <ArrowLeft v-else />
          </el-icon>
        </button>
        
        <button
          v-for="category in categories"
          :key="category.id"
          @click="handleCategoryClick(category.id)"
          :class="['category-item', { active: activeCategory === category.id }]"
        >
          <component :is="category.icon" class="category-icon" />
          <span>{{ category.label }}</span>
          <div v-if="activeCategory === category.id" class="active-indicator" />
        </button>
      </div>
    </div>

    <!-- Mobile -->
    <div class="category-nav-mobile">
      <div class="category-nav-scroll">
        <!-- Collapse Button - 移动端也放在 Home 左边 -->
        <button
          @click="handleToggleSidebar"
          class="collapse-toggle-btn"
          :title="isSidebarCollapsed ? '展开菜单' : '收缩菜单'"
        >
          <el-icon class="collapse-icon">
            <ArrowRight v-if="isSidebarCollapsed" />
            <ArrowLeft v-else />
          </el-icon>
        </button>
        
        <button
          v-for="category in categories"
          :key="category.id"
          @click="handleCategoryClick(category.id)"
          :class="['category-item', { active: activeCategory === category.id }]"
        >
          <component :is="category.icon" class="category-icon" />
          <span>{{ category.label }}</span>
          <div v-if="activeCategory === category.id" class="active-indicator" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  HomeFilled,
  Lock,
  Trophy,
  VideoPlay,
  Grid,
  Coin,
  Monitor,
  ArrowLeft,
  ArrowRight
} from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: 'home'
  },
  isSidebarCollapsed: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'toggle-sidebar'])

const router = useRouter()
const route = useRoute()
const activeCategory = ref(props.modelValue)

// 监听路由变化，更新 activeCategory
watch(() => route.path, (newPath) => {
  if (newPath === '/' || newPath === '') {
    activeCategory.value = 'home'
  } else if (newPath.startsWith('/hash')) {
    activeCategory.value = 'hash-game'
  } else if (newPath.startsWith('/sports')) {
    activeCategory.value = 'sports'
  } else if (newPath.startsWith('/live-casino')) {
    activeCategory.value = 'live-casino'
  } else if (newPath.startsWith('/pokers')) {
    activeCategory.value = 'pokers'
  } else if (newPath.startsWith('/slot')) {
    activeCategory.value = 'slot'
  } else if (newPath.startsWith('/arcade')) {
    activeCategory.value = 'arcade'
  }
  emit('update:modelValue', activeCategory.value)
}, { immediate: true })

const categories = [
  { id: 'home', label: 'Home', icon: HomeFilled, route: '/' },
  { id: 'hash-game', label: 'Hash Game', icon: Lock, route: '/hash' },
  { id: 'sports', label: 'Sports', icon: Trophy, route: '/sports' },
  { id: 'live-casino', label: 'Live Casino', icon: VideoPlay, route: '/live-casino' },
  { id: 'pokers', label: 'Pokers', icon: Grid, route: '/pokers' },
  { id: 'slot', label: 'Slot', icon: Coin, route: '/slot' },
  { id: 'arcade', label: '街机', icon: Monitor, route: '/arcade' }
]

function handleCategoryClick(id) {
  activeCategory.value = id
  emit('update:modelValue', id)
  
  const category = categories.find(cat => cat.id === id)
  if (category) {
    router.push({ path: category.route })
  }
}

function handleToggleSidebar() {
  emit('toggle-sidebar')
}
</script>

<style scoped>
.top-category-nav {
  position: sticky;
  top: 64px; /* Header 高度 64px */
  z-index: 40;
  border-bottom: 1px solid var(--border);
  background-color: rgba(19, 20, 22, 0.95);
  backdrop-filter: blur(8px);
}

.category-nav-desktop {
  display: none;
  overflow-x: auto; /* 支持横向滚动 */
  scrollbar-width: thin; /* Firefox 滚动条 */
  scrollbar-color: rgb(41, 43, 47) transparent; /* Firefox 滚动条颜色 */
}

/* 自定义桌面端滚动条样式 - 黑色，比底色浅 */
.category-nav-desktop::-webkit-scrollbar {
  height: 4px; /* 滚动条高度 */
}

.category-nav-desktop::-webkit-scrollbar-track {
  background: transparent; /* 滚动条轨道透明 */
}

.category-nav-desktop::-webkit-scrollbar-thumb {
  background-color: rgb(41, 43, 47); /* 比背景色浅的黑色 */
  border-radius: 2px;
}

.category-nav-desktop::-webkit-scrollbar-thumb:hover {
  background-color: rgb(50, 52, 56); /* 悬停时稍亮一点 */
}

@media (min-width: 1024px) {
  .category-nav-desktop {
    display: block;
  }
}

.category-nav-container {
  padding-left: 24px; /* 与浏览器左侧保持 24px 距离，与 logo 对齐 */
  padding-right: 24px; /* 减少右边距，与左边保持一致 */
  display: flex;
  align-items: center;
  gap: var(--space-2); /* 固定间隔 8px，与移动端保持一致 */
  min-width: max-content; /* 确保内容不会被压缩，可以横向滚动 */
}

/* Collapse Toggle Button - 放在 Home 左边 */
.collapse-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: auto;
  height: 40px; /* 与 category-item 高度一致 */
  padding: 0 var(--space-2);
  background: transparent;
  border: none;
  cursor: pointer;
  color: rgb(var(--text-muted)); /* 默认灰色，不变化 */
  transition: none; /* 不需要颜色变化 */
  flex-shrink: 0;
}

.collapse-toggle-btn:hover {
  color: rgb(var(--foreground)); /* 悬停时稍微变亮 */
}

.collapse-icon {
  width: 16px; /* 与 Home icon 大小一样 */
  height: 16px;
}

.category-nav-mobile {
  display: block;
  overflow-x: auto;
  scrollbar-width: thin; /* Firefox 滚动条 */
  scrollbar-color: rgb(41, 43, 47) transparent; /* Firefox 滚动条颜色 */
}

/* 自定义移动端滚动条样式 - 黑色，比底色浅 */
.category-nav-mobile::-webkit-scrollbar {
  height: 4px; /* 滚动条高度 */
}

.category-nav-mobile::-webkit-scrollbar-track {
  background: transparent; /* 滚动条轨道透明 */
}

.category-nav-mobile::-webkit-scrollbar-thumb {
  background-color: rgb(41, 43, 47); /* 比背景色浅的黑色 */
  border-radius: 2px;
}

.category-nav-mobile::-webkit-scrollbar-thumb:hover {
  background-color: rgb(50, 52, 56); /* 悬停时稍亮一点 */
}

@media (min-width: 1024px) {
  .category-nav-mobile {
    display: none;
  }
}

.category-nav-scroll {
  display: flex;
  align-items: center;
  gap: var(--space-2); /* 固定间隔 8px，与桌面端保持一致，避免跳动 */
  padding-left: 24px; /* 左边距 24px，与桌面端对齐 */
  padding-right: 24px; /* 右边距 24px，与桌面端保持一致 */
  min-width: max-content;
}

/* 移动端 Collapse Button */
.category-nav-mobile .collapse-toggle-btn {
  height: 40px; /* 与桌面端一致 */
}

.category-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-3);
  height: 40px; /* 固定高度 */
  font-size: 16px; /* 固定字体大小 16px */
  font-weight: 500;
  transition: all 0.2s;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  position: relative;
  white-space: nowrap;
  flex-shrink: 0; /* 防止被压缩 */
}

.category-item:hover {
  color: var(--foreground);
  background-color: rgba(26, 28, 31, 0.3);
}

.category-item.active {
  color: rgb(var(--primary)); /* 文字颜色变黄 */
}

.category-item.active .category-icon {
  color: rgb(var(--primary)); /* icon 颜色变黄 */
}

.category-icon {
  width: 16px; /* 固定 icon 大小 16px */
  height: 16px;
  flex-shrink: 0; /* 防止 icon 被压缩 */
  transition: color 0.2s;
}

.active-indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background-color: rgb(var(--primary)); /* 底线：黄色 */
  border-radius: 2px 2px 0 0;
}

/* 移除移动端的响应式样式，保持固定大小 */
/* 无论浏览器宽度如何，文字和 icon 都保持 16px 大小 */
</style>

