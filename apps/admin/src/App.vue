<template>
  <router-view/>
</template>

<style>
/* 基础 CSS 重置 */
body, html, #app {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', '微软雅黑', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ========== 全局样式系统 - 现代简约风格 ========== */

/* 配色系统 - 适合长时间阅读 */
:root {
  /* 主背景色 - 柔和的浅灰色 */
  --bg-primary: #f5f7fa;
  --bg-secondary: #ffffff;
  --bg-tertiary: #fafbfc;
  
  /* 文字颜色 - 层次分明 */
  --text-primary: #303133;
  --text-secondary: #606266;
  --text-tertiary: #909399;
  --text-disabled: #c0c4cc;
  
  /* 边框颜色 */
  --border-light: #ebeef5;
  --border-base: #dcdfe6;
  --border-dark: #c0c4cc;
  
  /* 主色调 - 绿色系（深绿色） */
  --color-primary: #237804;
  --color-primary-dark: #135200;
  --color-primary-medium: #389e0d;
  --color-primary-light: #52c41a;
  --color-primary-lighter: #73d13d;
  --color-success: #67c23a;
  
  /* 辅色 - 红橘系 */
  --color-accent: #ff6b35;
  --color-accent-dark: #e55a2b;
  --color-accent-light: #ff8c42;
  --color-warning: #ff8c42;
  --color-danger: #f56c6c;
  --color-info: #909399;
  
  /* 绿色系背景 */
  --bg-green-light: #f6ffed;
  --bg-green-lighter: #f0f9eb;
  --bg-green-border: #b7eb8f;
  --bg-green-dark: #135200;
  --bg-green-medium: #237804;
  
  /* 红橘系背景 */
  --bg-orange-light: #fff4e6;
  --bg-orange-lighter: #ffe7cc;
  
  /* 阴影 */
  --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.06);
  --shadow-base: 0 2px 12px rgba(0, 0, 0, 0.08);
  --shadow-hover: 0 8px 24px rgba(0, 0, 0, 0.12);
  
  /* 圆角 */
  --radius-sm: 6px;
  --radius-base: 8px;
  --radius-lg: 12px;
  
  /* 间距 */
  --spacing-xs: 8px;
  --spacing-sm: 12px;
  --spacing-base: 16px;
  --spacing-md: 20px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
}

/* 全局页面容器样式 */
.page-container {
  padding: var(--spacing-lg);
  background: var(--bg-primary);
  min-height: calc(100vh - 60px);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.5px;
  display: flex;
  align-items: center;
}

.page-container > h2:first-child {
  margin-top: 0;
}

.page-description {
  margin: 8px 0 0 0;
  font-size: 14px;
  color: var(--text-tertiary);
  font-weight: 400;
  line-height: 1.5;
}

/* 统一卡片样式 */
.el-card {
  border-radius: var(--radius-lg) !important;
  border: none !important;
  box-shadow: var(--shadow-base) !important;
  transition: all 0.3s ease !important;
  background: var(--bg-secondary) !important;
}

.el-card:hover {
  box-shadow: var(--shadow-hover) !important;
}

.el-card__header {
  border-bottom: 1px solid var(--border-light) !important;
  padding: var(--spacing-base) var(--spacing-lg) !important;
  background: var(--bg-tertiary) !important;
}

.el-card__body {
  padding: var(--spacing-lg) !important;
}

/* 统一表格样式 */
.el-table {
  border-radius: var(--radius-base);
  overflow: hidden;
}

.el-table th {
  background: var(--bg-tertiary) !important;
  color: var(--text-primary) !important;
  font-weight: 600 !important;
  border-bottom: 2px solid var(--border-light) !important;
}

.el-table td {
  border-bottom: 1px solid var(--border-light) !important;
}

.el-table tr:hover > td {
  background: var(--bg-tertiary) !important;
}

/* 表格中的链接按钮样式 - 常态白色文字，确保在绿色背景上可见 */
.el-table .el-button--text,
.el-table .el-button.is-link,
.el-table .el-button[type="primary"].is-link {
  color: #ffffff !important;
  transition: all 0.2s ease !important;
}

.el-table .el-button--text:hover,
.el-table .el-button.is-link:hover,
.el-table .el-button[type="primary"].is-link:hover {
  color: #ffffff !important;
  opacity: 0.9;
}

/* 确保在hover行时也保持白色 */
.el-table tr:hover .el-button--text,
.el-table tr:hover .el-button.is-link,
.el-table tr:hover .el-button[type="primary"].is-link,
.el-table td:hover .el-button--text,
.el-table td:hover .el-button.is-link,
.el-table td:hover .el-button[type="primary"].is-link {
  color: #ffffff !important;
}

/* 统一表单样式 */
.el-form-item__label {
  color: var(--text-secondary) !important;
  font-weight: 500 !important;
}

.el-input__inner,
.el-textarea__inner,
.el-select .el-input__inner {
  border-color: var(--border-base) !important;
  border-radius: var(--radius-sm) !important;
  transition: all 0.2s ease !important;
}

.el-input__inner:focus,
.el-textarea__inner:focus {
  border-color: var(--color-primary) !important;
  box-shadow: 0 0 0 2px rgba(35, 120, 4, 0.1) !important;
}

/* 统一按钮样式 */
.el-button {
  border-radius: var(--radius-sm) !important;
  font-weight: 500 !important;
  transition: all 0.2s ease !important;
}

.el-button--primary {
  background: var(--color-primary) !important;
  border-color: var(--color-primary) !important;
}

.el-button--primary:hover {
  background: var(--color-primary-medium) !important;
  border-color: var(--color-primary-medium) !important;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(35, 120, 4, 0.3) !important;
}

/* 统一分页样式 */
.el-pagination {
  margin-top: var(--spacing-md) !important;
}

.el-pagination .el-pager li {
  border-radius: var(--radius-sm) !important;
}

/* 统一对话框样式 */
.el-dialog {
  border-radius: var(--radius-lg) !important;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.15) !important;
}

.el-dialog__header {
  border-bottom: 1px solid var(--border-light) !important;
  padding: var(--spacing-lg) !important;
  background: var(--bg-tertiary) !important;
}

.el-dialog__title {
  font-weight: 600 !important;
  color: var(--text-primary) !important;
}

/* 统一标签样式 */
.el-tag {
  border-radius: var(--radius-sm) !important;
  font-weight: 500 !important;
}

/* 统一选择器样式 */
.el-select-dropdown {
  border-radius: var(--radius-base) !important;
  box-shadow: var(--shadow-hover) !important;
}

/* 统一日期选择器样式 */
.el-picker-panel {
  border-radius: var(--radius-base) !important;
  box-shadow: var(--shadow-hover) !important;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--bg-tertiary);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: var(--border-dark);
  border-radius: 4px;
  transition: background 0.2s ease;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}

/* 搜索卡片样式 */
.search-card {
  margin-bottom: var(--spacing-md) !important;
}

.search-form .el-form-item {
  margin-bottom: var(--spacing-sm) !important;
}

/* 表格卡片样式 */
.table-card {
  margin-bottom: var(--spacing-md) !important;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .page-container {
    padding: var(--spacing-base);
  }
  
  .page-title {
    font-size: 20px;
  }
}
</style>