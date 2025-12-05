<template>
  <div class="top-category-nav">
    <!-- Desktop -->
    <div class="category-nav-desktop">
      <div class="category-nav-container">
        <button
          v-for="category in categories"
          :key="category.id"
          @click="setActiveCategory(category.id)"
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
        <button
          v-for="category in categories"
          :key="category.id"
          @click="setActiveCategory(category.id)"
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
import { ref } from 'vue'
import {
  Grid,
  Trophy,
  VideoPlay,
  Box,
  Promotion,
  VideoCamera,
  Key,
  Coin,
  DataLine,
  Monitor,
  Present
} from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: 'home'
  }
})

const emit = defineEmits(['update:modelValue'])

const activeCategory = ref(props.modelValue)

const categories = [
  { id: 'home', label: 'Home', icon: Grid },
  { id: 'sports', label: 'Sports', icon: Trophy },
  { id: 'live', label: 'Live', icon: VideoPlay },
  { id: 'casino', label: 'Casino', icon: Box },
  { id: 'aviator', label: 'Aviator', icon: Promotion },
  { id: 'live-casino', label: 'Live Casino', icon: VideoCamera },
  { id: 'lucky-numbers', label: 'Lucky Numbers', icon: Key },
  { id: 'betgames', label: 'BetGames', icon: Coin },
  { id: 'esports', label: 'Esports', icon: DataLine },
  { id: 'virtuals', label: 'Virtuals', icon: Monitor },
  { id: 'promotions', label: 'Promotions', icon: Present }
]

function setActiveCategory(id) {
  activeCategory.value = id
  emit('update:modelValue', id)
}
</script>

<style scoped>
.top-category-nav {
  position: sticky;
  top: 56px;
  z-index: 40;
  border-bottom: 1px solid var(--border);
  background-color: rgba(19, 20, 22, 0.95);
  backdrop-filter: blur(8px);
}

.category-nav-desktop {
  display: none;
}

@media (min-width: 1024px) {
  .category-nav-desktop {
    display: block;
  }
}

.category-nav-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 var(--space-4);
  display: flex;
  align-items: center;
}

.category-nav-mobile {
  display: block;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.category-nav-mobile::-webkit-scrollbar {
  display: none;
}

@media (min-width: 1024px) {
  .category-nav-mobile {
    display: none;
  }
}

.category-nav-scroll {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 var(--space-2);
  min-width: max-content;
}

.category-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-3);
  height: 40px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  position: relative;
  white-space: nowrap;
}

.category-item:hover {
  color: var(--foreground);
  background-color: rgba(26, 28, 31, 0.3);
}

.category-item.active {
  color: var(--primary);
}

.category-icon {
  width: 16px;
  height: 16px;
}

.active-indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background-color: var(--primary);
  border-radius: 2px 2px 0 0;
}

.category-nav-mobile .category-item {
  padding: 0 var(--space-2);
  height: 36px;
  font-size: 11px;
}

.category-nav-mobile .category-icon {
  width: 14px;
  height: 14px;
}
</style>

