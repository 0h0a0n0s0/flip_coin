import { createI18n } from 'vue-i18n'
import en from './en.json'
import zhCN from './zh-CN.json'
import zhTW from './zh-TW.json'

// 从 localStorage 或系统设置获取默认语言
const getDefaultLocale = () => {
  try {
    const stored = localStorage.getItem('app_language')
    if (stored) {
      // 转换语言代码格式
      if (stored === 'zh-CN') return 'zh-CN'
      if (stored === 'en-US') return 'en'
      if (stored === 'zh-TW') return 'zh-TW'
    }
  } catch (e) {
    console.warn('Failed to read language from localStorage:', e)
  }
  return 'zh-CN' // 默认简体中文
}

const i18n = createI18n({
  legacy: false, // 使用 Composition API 模式
  locale: getDefaultLocale(),
  fallbackLocale: 'en',
  messages: {
    en,
    'zh-CN': zhCN,
    'zh-TW': zhTW
  },
  missing: (locale, key) => {
    // 开发模式下警告缺失的翻译
    if (import.meta.env.DEV) {
      console.warn(`[i18n] Missing translation for key: ${key} in locale: ${locale}`)
    }
  }
})

// 监听语言变化，同步到 localStorage
i18n.global.locale.value = getDefaultLocale()

export default i18n

