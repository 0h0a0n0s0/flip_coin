<template>
  <div class="i18n-management-container">
    <h2>多语系设定</h2>
    <p class="page-description">管理前台多语系翻译，支持导出、上传和实时编辑。</p>

    <el-card shadow="never" v-loading="loading">
      <!-- 语言选择器 -->
      <div class="language-selector">
        <el-select v-model="currentLang" @change="loadLanguageData" style="width: 200px; margin-bottom: 20px;">
          <el-option
            v-for="lang in availableLanguages"
            :key="lang.code"
            :label="lang.name"
            :value="lang.code"
          />
        </el-select>
        
        <div class="language-stats">
          <el-tag type="info">总键数: {{ totalKeys }}</el-tag>
          <el-tag type="warning">缺字: {{ missingKeysCount }}</el-tag>
        </div>
      </div>

      <!-- 工具栏 -->
      <div class="toolbar">
        <el-button type="primary" @click="handleExport" :loading="exporting">
          <el-icon><Download /></el-icon>
          导出语言 JSON
        </el-button>
        <el-button @click="handleImport" :loading="importing">
          <el-icon><Upload /></el-icon>
          上传语言 JSON
        </el-button>
        <el-button type="success" @click="handleSave" :loading="saving">
          <el-icon><Check /></el-icon>
          保存更改
        </el-button>
        <el-input
          v-model="searchText"
          placeholder="搜索 key 或 value..."
          style="width: 300px; margin-left: 10px;"
          clearable
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>

      <!-- 语言编辑器表格 -->
      <el-table
        :data="filteredTranslations"
        border
        stripe
        style="width: 100%; margin-top: 20px;"
        max-height="600"
      >
        <el-table-column prop="key" label="Key" width="300" fixed="left">
          <template #default="{ row }">
            <code>{{ row.key }}</code>
          </template>
        </el-table-column>
        
        <el-table-column prop="value" label="Value（当前语言）" min-width="300">
          <template #default="{ row }">
            <el-input
              v-model="row.value"
              type="textarea"
              :rows="2"
              @change="markAsChanged(row)"
            />
          </template>
        </el-table-column>
        
        <el-table-column label="缺字状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.isMissing" type="danger" size="small">缺字</el-tag>
            <el-tag v-else type="success" size="small">完整</el-tag>
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="150" align="center">
          <template #default="{ row }">
            <el-button
              type="danger"
              size="small"
              @click="handleDeleteKey(row.key)"
              :disabled="row.isSystem"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 添加新键值对 -->
      <div class="add-key-section" style="margin-top: 20px;">
        <el-card shadow="never">
          <template #header>
            <span>添加新键值对</span>
          </template>
          <el-form :inline="true">
            <el-form-item label="Key">
              <el-input v-model="newKey.key" placeholder="例如: home.welcome" style="width: 300px;" />
            </el-form-item>
            <el-form-item label="Value">
              <el-input v-model="newKey.value" placeholder="输入翻译文本" style="width: 300px;" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleAddKey">添加</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </div>
    </el-card>

    <!-- 上传文件对话框 -->
    <el-dialog v-model="importDialogVisible" title="上传语言 JSON" width="500px">
      <el-upload
        ref="uploadRef"
        :auto-upload="false"
        :on-change="handleFileChange"
        :limit="1"
        accept=".json"
        drag
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">
          将 JSON 文件拖到此处，或<em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            只能上传 JSON 文件，格式需与前台 i18n 兼容
          </div>
        </template>
      </el-upload>
      
      <el-radio-group v-model="importMode" style="margin-top: 20px;">
        <el-radio label="merge">合并（保留现有，新增缺失）</el-radio>
        <el-radio label="replace">覆盖（完全替换）</el-radio>
      </el-radio-group>
      
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleConfirmImport" :loading="importing">确认上传</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, Upload, Check, Search } from '@element-plus/icons-vue'
import { UploadFilled } from '@element-plus/icons-vue'

export default {
  name: 'I18nManagementView',
  components: {
    Download,
    Upload,
    Check,
    Search,
    UploadFilled
  },
  data() {
    return {
      loading: false,
      saving: false,
      exporting: false,
      importing: false,
      currentLang: 'zh-CN',
      availableLanguages: [
        { code: 'zh-CN', name: '简体中文' },
        { code: 'en', name: 'English' },
        { code: 'zh-TW', name: '繁體中文' }
      ],
      translations: [],
      originalTranslations: {},
      changedKeys: new Set(),
      searchText: '',
      importDialogVisible: false,
      importMode: 'merge',
      uploadFile: null,
      newKey: {
        key: '',
        value: ''
      }
    }
  },
  computed: {
    totalKeys() {
      return this.translations.length
    },
    missingKeysCount() {
      return this.translations.filter(t => t.isMissing).length
    },
    filteredTranslations() {
      if (!this.searchText) {
        return this.translations
      }
      const search = this.searchText.toLowerCase()
      return this.translations.filter(t => 
        t.key.toLowerCase().includes(search) || 
        (t.value && t.value.toLowerCase().includes(search))
      )
    }
  },
  created() {
    this.loadLanguageData()
  },
  methods: {
    async loadLanguageData() {
      this.loading = true
      try {
        const response = await this.$api.getI18nLanguage(this.currentLang)
        // request.js 的响应拦截器已经返回 response.data，所以这里直接使用 response
        const data = response || {}
        
        console.log('[I18n] Loaded language data:', this.currentLang, data)
        
        // 将嵌套对象转换为扁平数组
        this.translations = this.flattenObject(data, '')
        this.originalTranslations = JSON.parse(JSON.stringify(data))
        this.changedKeys.clear()
        
        console.log('[I18n] Flattened translations:', this.translations.length)
      } catch (error) {
        console.error('Failed to load language data:', error)
        ElMessage.error('加载语言数据失败: ' + (error.message || '未知错误'))
        this.translations = []
      } finally {
        this.loading = false
      }
    },
    
    flattenObject(obj, prefix) {
      const result = []
      const referenceLang = this.currentLang === 'en' ? 'en' : 'zh-CN'
      
      function traverse(current, keyPrefix) {
        for (const key in current) {
          const fullKey = keyPrefix ? `${keyPrefix}.${key}` : key
          const value = current[key]
          
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            traverse(value, fullKey)
          } else {
            result.push({
              key: fullKey,
              value: value || '',
              isMissing: !value || value.trim() === '',
              isSystem: false
            })
          }
        }
      }
      
      traverse(obj, prefix)
      return result.sort((a, b) => a.key.localeCompare(b.key))
    },
    
    unflattenObject(translations) {
      const result = {}
      for (const item of translations) {
        const keys = item.key.split('.')
        let current = result
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) {
            current[keys[i]] = {}
          }
          current = current[keys[i]]
        }
        current[keys[keys.length - 1]] = item.value
      }
      return result
    },
    
    markAsChanged(row) {
      this.changedKeys.add(row.key)
    },
    
    async handleSave() {
      if (this.changedKeys.size === 0) {
        ElMessage.info('没有更改需要保存')
        return
      }
      
      this.saving = true
      try {
        const updatedData = this.unflattenObject(this.translations)
        await this.$api.updateI18nLanguage(this.currentLang, updatedData)
        
        ElMessage.success('保存成功')
        this.changedKeys.clear()
        await this.loadLanguageData()
      } catch (error) {
        console.error('Failed to save:', error)
        ElMessage.error('保存失败')
      } finally {
        this.saving = false
      }
    },
    
    async handleExport() {
      this.exporting = true
      try {
        const response = await this.$api.getI18nLanguage(this.currentLang)
        // request.js 的响应拦截器已经返回 response.data，所以这里直接使用 response
        const data = response || {}
        
        const jsonStr = JSON.stringify(data, null, 2)
        const blob = new Blob([jsonStr], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${this.currentLang}.json`
        link.click()
        URL.revokeObjectURL(url)
        
        ElMessage.success('导出成功')
      } catch (error) {
        console.error('Failed to export:', error)
        ElMessage.error('导出失败')
      } finally {
        this.exporting = false
      }
    },
    
    handleImport() {
      this.importDialogVisible = true
      this.uploadFile = null
    },
    
    handleFileChange(file) {
      this.uploadFile = file.raw
    },
    
    async handleConfirmImport() {
      if (!this.uploadFile) {
        ElMessage.warning('请选择文件')
        return
      }
      
      this.importing = true
      try {
        const text = await this.uploadFile.text()
        const importedData = JSON.parse(text)
        
        if (this.importMode === 'replace') {
          // 完全替换
          await this.$api.updateI18nLanguage(this.currentLang, importedData)
          ElMessage.success('语言文件已完全替换')
        } else {
          // 合并模式
          const currentData = this.unflattenObject(this.translations)
          const mergedData = this.mergeObjects(currentData, importedData)
          await this.$api.updateI18nLanguage(this.currentLang, mergedData)
          ElMessage.success('语言文件已合并')
        }
        
        this.importDialogVisible = false
        await this.loadLanguageData()
      } catch (error) {
        console.error('Failed to import:', error)
        ElMessage.error('导入失败：' + (error.message || '无效的 JSON 格式'))
      } finally {
        this.importing = false
      }
    },
    
    mergeObjects(target, source) {
      const result = { ...target }
      for (const key in source) {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
          result[key] = this.mergeObjects(result[key] || {}, source[key])
        } else {
          result[key] = source[key]
        }
      }
      return result
    },
    
    handleAddKey() {
      if (!this.newKey.key || !this.newKey.value) {
        ElMessage.warning('请填写完整的 key 和 value')
        return
      }
      
      // 检查 key 是否已存在
      if (this.translations.some(t => t.key === this.newKey.key)) {
        ElMessage.warning('该 key 已存在')
        return
      }
      
      this.translations.push({
        key: this.newKey.key,
        value: this.newKey.value,
        isMissing: false,
        isSystem: false
      })
      
      this.changedKeys.add(this.newKey.key)
      this.newKey = { key: '', value: '' }
      ElMessage.success('已添加新键值对，请记得保存')
    },
    
    async handleDeleteKey(key) {
      try {
        await ElMessageBox.confirm(
          `确定要删除键 "${key}" 吗？`,
          '确认删除',
          {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          }
        )
        
        // 从 translations 中移除
        const index = this.translations.findIndex(t => t.key === key)
        if (index > -1) {
          this.translations[index].value = ''
          this.translations[index].isMissing = true
          this.changedKeys.add(key)
          ElMessage.success('已标记为删除，请保存以生效')
        }
      } catch (error) {
        // 用户取消
      }
    }
  }
}
</script>

<style scoped>
.i18n-management-container {
  padding: 20px;
}

.page-description {
  color: #909399;
  margin-bottom: 20px;
}

.language-selector {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
}

.language-stats {
  display: flex;
  gap: 10px;
}

.toolbar {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

code {
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}
</style>

