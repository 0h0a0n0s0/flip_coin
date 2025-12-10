<template>
  <nav class="mobile-bottom-nav">
    <div class="nav-grid">
      <button
        v-for="item in navItems"
        :key="item.id"
        @click="handleNavClick(item.id)"
        :class="['nav-item', { active: activeTab === item.id, highlight: item.highlight }]"
      >
        <div v-if="item.highlight" class="highlight-button">
          <component :is="item.icon" class="nav-icon" />
        </div>
        <template v-else>
          <component :is="item.icon" class="nav-icon" />
          <span class="nav-label">{{ item.label }}</span>
        </template>
      </button>
    </div>
  </nav>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Grid, ChatDotRound, User, Wallet } from '@element-plus/icons-vue'

const { t } = useI18n()

const props = defineProps({
  onMenuClick: Function,
  onDepositClick: Function
})

const activeTab = ref('home')

const navItems = computed(() => [
  { icon: Grid, label: t('mobile.menu'), id: 'menu' },
  { icon: Grid, label: t('mobile.home'), id: 'home' },
  { icon: Wallet, label: t('mobile.deposit'), id: 'deposit', highlight: true },
  { icon: ChatDotRound, label: t('mobile.chat'), id: 'chat' },
  { icon: User, label: t('mobile.me'), id: 'me' }
])

function handleNavClick(id) {
  activeTab.value = id
  if (id === 'menu' && props.onMenuClick) {
    props.onMenuClick()
  } else if (id === 'deposit' && props.onDepositClick) {
    props.onDepositClick()
  }
}
</script>

<style scoped>
.mobile-bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  border-top: 1px solid var(--border);
  background-color: rgba(19, 20, 22, 0.95);
  backdrop-filter: blur(8px);
  display: block;
}

@media (min-width: 768px) {
  .mobile-bottom-nav {
    display: none;
  }
}

.nav-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  height: 48px;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  transition: color 0.2s;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  position: relative;
}

.nav-item.active {
  color: var(--primary);
}

.nav-item.highlight {
  position: relative;
}

.highlight-button {
  position: absolute;
  top: -10px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--primary);
  box-shadow: 0 4px 12px rgba(243, 195, 64, 0.5);
}

.highlight-button .nav-icon {
  color: var(--surface);
}

.nav-icon {
  width: 18px;
  height: 18px;
}

.nav-label {
  font-size: 9px;
  font-weight: 500;
}
</style>

