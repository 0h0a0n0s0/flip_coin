// 语言管理 composable

import { ref, computed, watch } from 'vue'

const SUPPORTED_LANGUAGES = {
  'zh-CN': { code: 'zh-CN', name: '简体中文', flag: '🇨🇳' },
  'en-US': { code: 'en-US', name: 'English', flag: '🇺🇸' }
}

const DEFAULT_LANGUAGE = 'zh-CN'

// 从 localStorage 读取语言设置，如果没有则使用默认语言
const getStoredLanguage = () => {
  try {
    const stored = localStorage.getItem('app_language')
    if (stored && SUPPORTED_LANGUAGES[stored]) {
      return stored
    }
  } catch (e) {
    console.warn('Failed to read language from localStorage:', e)
  }
  return DEFAULT_LANGUAGE
}

const currentLanguage = ref(getStoredLanguage())

// 保存语言设置到 localStorage
const saveLanguage = (lang) => {
  try {
    localStorage.setItem('app_language', lang)
    currentLanguage.value = lang
  } catch (e) {
    console.warn('Failed to save language to localStorage:', e)
  }
}

export function useLanguage() {
  const language = computed(() => currentLanguage.value)
  
  const languageInfo = computed(() => SUPPORTED_LANGUAGES[currentLanguage.value])
  
  const supportedLanguages = computed(() => Object.values(SUPPORTED_LANGUAGES))
  
  function setLanguage(langCode) {
    if (SUPPORTED_LANGUAGES[langCode]) {
      saveLanguage(langCode)
    }
  }
  
  // 根据语言获取游戏名称（响应式）
  // 注意：这个函数应该在 computed 中使用，以确保语言变化时重新计算
  // 函数内部读取 currentLanguage.value 以确保 Vue 能够追踪响应式依赖
  // 规则：
  // - 中文环境（zh-CN）：显示 name_zh（游戏名字）
  // - 英文环境（en-US）：显示 name_en（英文名字），如果不存在则回退到 name_zh
  function getGameName(game) {
    if (!game) return ''
    
    // 读取 currentLanguage.value 以确保响应式追踪
    // 在 computed 中调用此函数时，Vue 会追踪到 currentLanguage 的变化
    const lang = currentLanguage.value
    
    // 英文环境：优先返回 name_en（英文名字），如果不存在则回退到 name_zh
    if (lang === 'en-US') {
      return game.name_en || game.name_zh || game.name || ''
    }
    
    // 中文环境（默认）：返回 name_zh（游戏名字），如果不存在则回退到 name
    return game.name_zh || game.name || ''
  }
  
  // 监听语言变化，可以用于触发其他更新
  watch(currentLanguage, (newLang) => {
    // 可以在这里添加语言变化时的其他逻辑
    console.log('Language changed to:', newLang)
  })
  
  return {
    language,
    languageInfo,
    supportedLanguages,
    setLanguage,
    getGameName
  }
}

