<template>
  <div class="language-switcher" :class="{ collapsed: isCollapsed }">
    <el-dropdown 
      trigger="click" 
      placement="top"
      @command="handleLanguageChange"
    >
      <button class="language-button" :title="isCollapsed ? languageInfo.name : undefined">
        <span class="flag-icon">{{ languageInfo.flag }}</span>
        <span v-if="!isCollapsed" class="language-label">{{ languageInfo.name }}</span>
        <el-icon v-if="!isCollapsed" class="dropdown-icon"><ArrowDown /></el-icon>
      </button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item 
            v-for="lang in supportedLanguages" 
            :key="lang.code"
            :command="lang.code"
            :class="{ 'is-selected': language === lang.code }"
          >
            <span class="flag-icon">{{ lang.flag }}</span>
            <span>{{ lang.name }}</span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'
import { useLanguage } from '@/composables/useLanguage.js'

const props = defineProps({
  isCollapsed: {
    type: Boolean,
    default: false
  }
})

const { language, languageInfo, supportedLanguages, setLanguage } = useLanguage()

function handleLanguageChange(langCode) {
  setLanguage(langCode)
}
</script>

<style scoped>
.language-switcher {
  margin-top: auto;
  padding-top: var(--space-2);
  border-top: 1px solid rgb(var(--border));
}

.language-button {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2);
  height: 32px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  justify-content: space-between;
}

.language-button:hover {
  color: rgb(var(--foreground));
  background-color: rgb(var(--surface-light) / 0.5);
}

.flag-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.language-label {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.language-switcher.collapsed .language-button {
  justify-content: center;
}

.language-switcher.collapsed .language-label,
.language-switcher.collapsed .dropdown-icon {
  display: none;
}

/* Dropdown menu styles */
:deep(.el-dropdown-menu__item.is-selected) {
  background-color: rgb(var(--primary) / 0.1);
  color: rgb(var(--primary));
}

:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
</style>

