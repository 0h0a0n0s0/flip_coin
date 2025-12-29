#!/usr/bin/env node

/**
 * i18n 自动扫描脚本
 * 功能：
 * 1. 扫描 src 目录下的所有 .vue, .js, .ts 文件
 * 2. 检测硬编码的中文/英文文字
 * 3. 自动生成 i18n key（根据文件路径推断 namespace）
 * 4. 自动写入对应语言档
 * 5. 可选：自动替换代码中的硬编码文字为 i18n key
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SRC_DIR = path.resolve(__dirname, '../src')
const LOCALES_DIR = path.resolve(__dirname, '../src/locales')

// 支持的语言
const LANGUAGES = {
  'zh-CN': { name: '简体中文', file: 'zh-CN.json' },
  'en': { name: 'English', file: 'en.json' },
  'zh-TW': { name: '繁體中文', file: 'zh-TW.json' }
}

// 中文正则（包括繁体）
const CHINESE_REGEX = /[\u4e00-\u9fa5\u3400-\u4dbf\uf900-\ufaff]+/g

// 英文单词正则（排除已存在的 i18n key 和变量名）
const ENGLISH_REGEX = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g

// 已处理的文件
const processedFiles = new Set()

// 检测到的文字映射：{ key: { zh-CN: '...', en: '...', zh-TW: '...' } }
const detectedTexts = new Map()

/**
 * 根据文件路径生成 namespace
 */
function getNamespace(filePath) {
  const relativePath = path.relative(SRC_DIR, filePath)
  const parts = relativePath.split(path.sep)
  
  // 移除文件扩展名
  const fileName = parts[parts.length - 1].replace(/\.(vue|js|ts)$/, '')
  
  // 根据目录结构生成 namespace
  if (parts.length === 1) {
    // 根目录文件
    return fileName.toLowerCase()
  } else if (parts[0] === 'views') {
    // views 目录
    return parts[1] ? parts[1].toLowerCase() : fileName.toLowerCase()
  } else if (parts[0] === 'components') {
    // components 目录
    const componentPath = parts.slice(1, -1)
    return componentPath.length > 0 
      ? componentPath.join('.').toLowerCase() 
      : fileName.toLowerCase()
  } else {
    // 其他目录
    return parts[0].toLowerCase()
  }
}

/**
 * 生成 i18n key
 */
function generateKey(namespace, text, index = 0) {
  // 清理文本，生成 key
  const cleanText = text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50)
  
  const key = index > 0 ? `${cleanText}_${index}` : cleanText
  return `${namespace}.${key}`
}

/**
 * 检测文件中的硬编码文字
 */
function detectHardcodedTexts(content, filePath) {
  const namespace = getNamespace(filePath)
  const texts = []
  
  // 检测中文
  const chineseMatches = content.matchAll(CHINESE_REGEX)
  for (const match of chineseMatches) {
    const text = match[0]
    // 排除注释、字符串中的 i18n key、变量名等
    if (text.length > 1 && !text.includes('$t') && !text.includes('t(')) {
      texts.push({ text, lang: 'zh-CN' })
    }
  }
  
  // 检测英文（标题大小写）
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // 跳过注释、import、export 等
    if (line.trim().startsWith('//') || 
        line.trim().startsWith('/*') ||
        line.trim().startsWith('*') ||
        line.trim().startsWith('import') ||
        line.trim().startsWith('export') ||
        line.includes('$t(') ||
        line.includes('t(')) {
      continue
    }
    
    // 检测 HTML 标签内的英文文字
    const htmlTextMatch = line.match(/>([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)</)
    if (htmlTextMatch && htmlTextMatch[1].length > 2) {
      const text = htmlTextMatch[1]
      // 排除常见的 HTML 属性值
      if (!['class', 'id', 'name', 'type', 'value'].includes(text.toLowerCase())) {
        texts.push({ text, lang: 'en' })
      }
    }
  }
  
  // 生成 key 并添加到映射
  texts.forEach(({ text, lang }, index) => {
    const key = generateKey(namespace, text, index)
    
    if (!detectedTexts.has(key)) {
      detectedTexts.set(key, {})
    }
    
    const entry = detectedTexts.get(key)
    entry[lang] = text
    
    // 如果检测到中文，也添加到繁体（可以后续手动调整）
    if (lang === 'zh-CN' && !entry['zh-TW']) {
      entry['zh-TW'] = text // 默认使用简体，可后续手动调整
    }
    
    // 如果检测到英文，也添加到其他语言（需要翻译）
    if (lang === 'en' && !entry['zh-CN']) {
      entry['zh-CN'] = text // 默认使用英文，需要翻译
      entry['zh-TW'] = text
    }
  })
}

/**
 * 扫描目录
 */
function scanDirectory(dir) {
  const files = fs.readdirSync(dir)
  
  for (const file of files) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    
    if (stat.isDirectory()) {
      // 跳过 node_modules, dist 等目录
      if (!['node_modules', 'dist', '.git', 'locales', 'scripts'].includes(file)) {
        scanDirectory(filePath)
      }
    } else if (stat.isFile()) {
      // 只处理 .vue, .js, .ts 文件
      if (/\.(vue|js|ts)$/.test(file)) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8')
          detectHardcodedTexts(content, filePath)
          processedFiles.add(filePath)
        } catch (error) {
          console.warn(`Failed to read file ${filePath}:`, error.message)
        }
      }
    }
  }
}

/**
 * 将检测到的文字写入语言档
 */
function writeToLocales() {
  for (const [langCode, langInfo] of Object.entries(LANGUAGES)) {
    const localeFile = path.join(LOCALES_DIR, langInfo.file)
    
    // 读取现有语言档
    let existingMessages = {}
    try {
      if (fs.existsSync(localeFile)) {
        const content = fs.readFileSync(localeFile, 'utf-8')
        existingMessages = JSON.parse(content)
      }
    } catch (error) {
      console.warn(`Failed to read locale file ${localeFile}:`, error.message)
    }
    
    // 合并新检测到的文字
    for (const [key, translations] of detectedTexts.entries()) {
      const keys = key.split('.')
      let current = existingMessages
      
      // 创建嵌套结构
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {}
        }
        current = current[keys[i]]
      }
      
      // 只在不存在时才添加
      const finalKey = keys[keys.length - 1]
      if (!current[finalKey] && translations[langCode]) {
        current[finalKey] = translations[langCode]
      }
    }
    
    // 写入文件
    try {
      const sortedMessages = sortObject(existingMessages)
      fs.writeFileSync(
        localeFile,
        JSON.stringify(sortedMessages, null, 2) + '\n',
        'utf-8'
      )
      console.log(`✓ Updated ${langInfo.file}`)
    } catch (error) {
      console.error(`Failed to write locale file ${localeFile}:`, error.message)
    }
  }
}

/**
 * 递归排序对象
 */
function sortObject(obj) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return obj
  }
  
  const sorted = {}
  const keys = Object.keys(obj).sort()
  
  for (const key of keys) {
    sorted[key] = sortObject(obj[key])
  }
  
  return sorted
}

/**
 * 主函数
 */
function main() {
  console.log('🔍 Scanning for hardcoded texts...\n')
  
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`Error: Source directory not found: ${SRC_DIR}`)
    process.exit(1)
  }
  
  if (!fs.existsSync(LOCALES_DIR)) {
    fs.mkdirSync(LOCALES_DIR, { recursive: true })
    console.log(`Created locales directory: ${LOCALES_DIR}`)
  }
  
  // 扫描目录
  scanDirectory(SRC_DIR)
  
  console.log(`\n📊 Statistics:`)
  console.log(`  - Processed files: ${processedFiles.size}`)
  console.log(`  - Detected texts: ${detectedTexts.size}`)
  
  // 写入语言档
  console.log(`\n📝 Writing to locale files...\n`)
  writeToLocales()
  
  console.log(`\n✅ Scan completed!`)
  console.log(`\n💡 Next steps:`)
  console.log(`  1. Review and translate the detected texts`)
  console.log(`  2. Replace hardcoded texts in your code with i18n keys`)
  console.log(`  3. Run this script again to detect new texts`)
}

// 运行主函数
main()

