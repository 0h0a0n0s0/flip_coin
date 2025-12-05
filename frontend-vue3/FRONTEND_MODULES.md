# 前台模块定义

本文档定义了前台各个模块的职责和边界，用于指导代码组织和布局对齐。

## 模块划分

### 1. Header（顶部导航栏）
**文件位置**: `src/components/layout/Header.vue`

**职责**:
- 显示平台 Logo 和名称
- 搜索栏（桌面端）
- 用户认证相关：登入/注册按钮
- 钱包功能：馀额显示、储值按钮
- 用户头像/个人中心入口

**布局特性**:
- `max-width: 1400px`
- `margin: 0 auto` (居中)
- `padding: var(--space-2) var(--space-3)`
- 固定定位在页面顶部（sticky）

**对齐参考点**:
- 右边缘：头像右边是其他模块右边缘对齐的参考点

---

### 2. TopCategoryNav（游戏分类 Tab 区）
**文件位置**: `src/components/layout/TopCategoryNav.vue`

**职责**:
- 显示游戏分类导航：Home, Sports, Live, Casino, Aviator, Live Casino, Lucky Numbers, BetGames, Esports, Virtuals, Promotions
- 处理分类切换逻辑
- 响应式设计（桌面端和移动端不同展示）

**布局特性**:
- 位于 Header 下方
- `position: sticky` (跟随滚动)
- `top: 56px` (Header 高度)
- `max-width: 1280px` (桌面端)
- `margin: 0 auto` (居中)

---

### 3. PageContent（页面内容区）
**文件位置**: `src/views/Home.vue` 及其他页面视图

**职责**:
- Banner 横幅区域
- 游戏列表（Trending Games、New Games 等）
- 最近赢得（Latest Wins）
- 其他页面特定内容

**布局特性**:
- 位于 `main-content` 容器中（sidebar 右侧）
- 左边对齐：与 "Trending Now" 文案对齐
- 右边对齐：与 Header 头像右边对齐
- 响应式宽度计算：
  - 宽度 ≤ 1400px: `100vw - 200px(sidebar) - padding`
  - 宽度 > 1400px: `1400px - padding` + `margin-right` 调整

**对齐规则**:
- 左边距：`calc(var(--space-3) + var(--space-4))` (与 content-section 一致)
- 右边距：`var(--space-3)` (与 Header 的 padding-right 一致)
- 当页面宽度 > 1400px 时，使用 `margin-right: calc((100vw - 1800px) / 2)` 来对齐右边缘

---

### 4. LeftSidebar（左侧可收缩菜单）
**文件位置**: `src/components/layout/LeftSidebar.vue`

**职责**:
- 游戏分类菜单（All Games, Hash Game, Trending, New, Slots 等）
- 收缩/展开功能
- 搜索功能（展开时显示）
- 移动端抽屉式菜单

**布局特性**:
- 桌面端：固定宽度 `200px`（展开）/ `54px`（收缩）
- `position: sticky`
- `top: 88px` (Header + TopCategoryNav 高度)
- 位于 `main-layout` 左侧

---

## 布局对齐规则

### 桌面端（≥ 1024px）

1. **Header 容器**:
   - `max-width: 1400px`
   - `margin: 0 auto`
   - `padding: var(--space-2) var(--space-3)`

2. **PageContent 对齐**:
   - 左边：从 sidebar 右边缘开始，padding-left = `calc(var(--space-3) + var(--space-4))`
   - 右边：对齐到 Header 容器的右边缘
   - 宽度计算：
     ```css
     /* ≤ 1400px */
     width: calc(100vw - 200px - padding-left - padding-right);
     
     /* > 1400px */
     width: calc(1400px - padding-left - padding-right);
     margin-right: calc((100vw - 1800px) / 2);
     ```

3. **TopCategoryNav**:
   - `max-width: 1280px`
   - `margin: 0 auto`

### 移动端（< 1024px）

- Header: 全宽
- TopCategoryNav: 横向滚动
- LeftSidebar: 抽屉式菜单
- PageContent: 全宽，无 sidebar 偏移

---

## 模块依赖关系

```
MainLayout
├── Header (模块 1)
├── TopCategoryNav (模块 2)
├── main-layout
│   ├── LeftSidebar (模块 4)
│   └── main-content
│       └── PageContent (模块 3) - router-view
└── Footer
```

---

## 注意事项

1. **对齐一致性**: PageContent 的所有子元素（Banner、游戏列表等）都应该遵循相同的对齐规则
2. **响应式**: 所有模块都应该有移动端适配
3. **间距使用**: 统一使用 design tokens (`var(--space-*)`)
4. **最大宽度**: Header 和 PageContent 都使用 `1400px` 作为最大宽度基准

