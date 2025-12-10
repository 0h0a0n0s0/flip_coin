// 语言管理 composable (集成 vue-i18n)

import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const SUPPORTED_LANGUAGES = {
  'zh-CN': { code: 'zh-CN', name: '简体中文', flag: '🇨🇳' },
  'en-US': { code: 'en-US', name: 'English', flag: '🇺🇸' },
  'zh-TW': { code: 'zh-TW', name: '繁體中文', flag: '🇹🇼' }
}

export function useLanguage() {
  const { locale, t } = useI18n()
  
  const language = computed(() => {
    // 转换 i18n locale 格式到应用格式
    const i18nLocale = locale.value
    if (i18nLocale === 'en') return 'en-US'
    return i18nLocale
  })
  
  const languageInfo = computed(() => {
    const langCode = language.value
    return SUPPORTED_LANGUAGES[langCode] || SUPPORTED_LANGUAGES['zh-CN']
  })
  
  const supportedLanguages = computed(() => Object.values(SUPPORTED_LANGUAGES))
  
  function setLanguage(langCode) {
    if (SUPPORTED_LANGUAGES[langCode]) {
      // 转换应用格式到 i18n locale 格式
      const i18nLocale = langCode === 'en-US' ? 'en' : langCode
      locale.value = i18nLocale
      try {
        localStorage.setItem('app_language', langCode)
      } catch (e) {
        console.warn('Failed to save language to localStorage:', e)
      }
    }
  }
  
  // 根据语言获取游戏名称（响应式）
  function getGameName(game) {
    if (!game) return ''
    
    const lang = language.value
    
    // 英文环境：优先返回 name_en（英文名字），如果不存在则回退到 name_zh
    if (lang === 'en-US') {
      return game.name_en || game.name_zh || game.name || ''
    }
    
    // 中文环境（默认）：返回 name_zh（游戏名字），如果不存在则回退到 name
    return game.name_zh || game.name || ''
  }
  
  // 监听语言变化
  watch(locale, (newLocale) => {
    const langCode = newLocale === 'en' ? 'en-US' : newLocale
    try {
      localStorage.setItem('app_language', langCode)
    } catch (e) {
      console.warn('Failed to save language to localStorage:', e)
    }
  })
  
  return {
    language,
    languageInfo,
    supportedLanguages,
    setLanguage,
    getGameName,
    t // 导出翻译函数
  }
}

