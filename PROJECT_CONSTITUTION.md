# PROJECT_CONSTITUTION.md

# flip_coin 项目开发宪法（Enterprise Edition v2.0）

本文件为 **flip_coin 项目最高等级开发规范（Supreme Project Law）**。

适用对象：

* 所有开发者
* Cursor AI
* 任何自动化程式码生成工具
* 外包与协作人员

目标：

* 维持**高一致性、高可维护性、高安全性**
* 确保整个平台 UI / UX 符合**国际加密赌场级标准**

⚠️ 若任何开发需求、设计、程式码生成与本宪法冲突：
→ **必须立即停止执行，并向使用者（产品拥有者）确认。**

---

## 📘 目录（TOC）

1. 系统架构规范（Architecture Rules）
2. API 规范（API Contract Rules）
3. 命名与文件规范（Naming & File Rules）
4. 前端编码规范（Frontend Coding Rules）
5. 后端编码规范（Backend Coding Rules）
6. UI/UX 组件开发规范（Component Constitution）
7. 视觉密度系统（UI Density System）
8. Design System（Color / Radius / Typography Tokens）
9. RWD 响应式规范（Responsive Behavior Rules）
10. 禁止事项（Prohibited Practices）
11. 安全规定（Security Rules）
12. 版本管理（Versioning Rules）
13. 测试与部署规范（Testing & Deployment）
14. 宪法冲突处理机制（Conflict Protocol）
15. Cursor 自动违宪检测协议（AI Enforcement Protocol）

---

## 1. 系统架构规范（Architecture Rules）

### 1.1 前端（Next.js / React）

* 所有 HTTP 请求必须通过 `modules/api.js` 或统一 API 模块
* 禁止在任意组件内直接 `fetch()` 远端 API（＝禁止裸 fetch）
* DOM 操作仅允许在 UI 组件内部，禁止与业务逻辑混写
* 状态统一由 Store（如 Zustand / Redux / 自订 store）管理，不散落在多个不相关组件
* 业务模块目录建议为：

  * `auth/`
  * `game/`
  * `wallet/`
  * `history/`
  * `ui/`
  * `layout/`

### 1.2 后端（Node.js）

* 路由（routes）只负责：**接收参数 → 校验 → 调用 service → 回传结果**
* 禁止在路由中撰写 SQL
* 业务逻辑必须写在 `services/` 内
* 输入验证写在 `validators/`
* 中间件写在 `middleware/`
* 工具函数写在 `utils/`

---

## 2. API 规范（API Contract Rules）

所有 API 必须统一采用以下格式。

**成功返回：**

```json
{
  "success": true,
  "data": {
    "...": "..."
  }
}
```

**失败返回：**

```json
{
  "success": false,
  "error": "訊息"
}
```

补充规则：

* 所有错误必须经由 `sendError()` 处理
* 禁止将数据库原始错误 / 链上错误直接回传给前端
* 错误讯息必须经过 sanitize，避免暴露内部结构与敏感资讯

---

## 3. 命名与文件规范（Naming & File Rules）

### 3.1 命名规范

| 类型              | 规范                                    |
| --------------- | ------------------------------------- |
| 文件              | `kebab-case.js` 或 `lowerCamelCase.js` |
| 变量 / 函数         | `camelCase`                           |
| Class           | `PascalCase`                          |
| React Component | `PascalCase`                          |
| Hook            | `useXxx`                              |

### 3.2 其他规则

* `require` / `import` 大小写必须与实际文件路径完全一致
* 禁止在任何程式码中加入「版本号注释」（例如：`// v1.2`, `// v7`）
* 所有版本差异与变更纪录统一写入 `CHANGELOG.md`

---

## 4. 前端编码规范（Frontend Coding Rules）

### 4.1 必须遵守

* 禁止裸 `fetch()`，必须使用专用 API 模组（如 `apiClient`）
* 所有用户提示必须使用统一的提示系统：`notifySuccess()` / `notifyError()`
* 重复出现的逻辑（例如金额格式化、时间格式化、余额显示）必须抽出至 util
* 单一 React 组件程式码不得超过 **300 行**：超过则强制拆分

### 4.2 禁止事项

* 禁止在组件内直接写复杂业务逻辑（应移动至 hooks 或 service）
* 禁止复制相同逻辑到多个组件（应抽象成共用 util/hook）
* 禁止在组件中直接操作 DOM（除非封装在专用 hook / ref 逻辑中）

---

## 5. 后端编码规范（Backend Coding Rules）

* `service` 层不得存取 `req` / `res`，仅接受参数与回传结果
* 所有金额相关逻辑必须经过输入验证 + 风控校验
* 所有异常（特别是金额 / 交易 / 拆帐）必须写入 audit log
* 禁止回传包含堆叠（stack trace）的原始错误讯息给前端
* SQL 查询仅可存在于 `services/` 或专用 `repository/` / `dal/` 之类目录内

---

## 6. UI/UX 组件开发规范（Component Constitution）

### 6.1 组件拆分原则

* 遵循 SRP（Single Responsibility Principle，单一职责原则）
* 禁止单一组件档案超过 **300 行**，超过则必须拆分
* 所有可复用 UI 元件必须放入 `/components/ui`
* 页面布局结构（Header、Sidebar、Footer、Layout）放入 `/components/layout`

### 6.2 标准组件目录结构（建议）

```txt
/components
  /layout
    Header.jsx
    TopNav.jsx
    Sidebar.jsx
    Footer.jsx
    MobileTabBar.jsx

  /ui
    Button.jsx
    Card.jsx
    Badge.jsx
    Icon.jsx
    Modal.jsx
    Drawer.jsx
    Input.jsx
    Select.jsx
    GameCard.jsx
    QuickEntryCard.jsx
```

### 6.3 组件开发要求

* 每个组件必须支援 `className` 传入以利覆写样式
* 优先撰写无状态组件（presentational），状态由上层掌控
* 所有 Tailwind class 必须遵守 **spacing / radius / color token** 规范
* 响应式行为（RWD）必须符合第 9 章规范

---

## 7. 视觉密度系统（UI Density System）

本章为「UI 密度」相关之强制性规范，适用于所有页面与组件。

若产生冲突：
**本章优先于其他设计偏好与临时决定。**

### 7.1 核心原则

1. **高信息密度（High Density）**

   * 画面不得出现类似 SaaS 登陆页那种大量留白。

2. **结构一致（Structural Consistency）**

   * Web / H5 必须使用相同结构，仅作比例缩放，**不得重新设计版面**。

3. **节奏统一（Rhythm Consistency）**

   * 所有 padding / margin 必须使用 spacing token，不得随意指定。

4. **快速扫描（Fast Scanability）**

   * UI 必须支持玩家在 0.2 秒内扫视理解各区块功能。

5. **组件尺寸统一（Component Size Consistency）**

   * 同类组件（卡片、按钮、Modal 等）必须使用统一高度 / 结构。

---

### 7.2 Spacing Token（间距单位）

所有间距必须使用以下 token，不得新增自订尺寸：

| Token   | px   |
| ------- | ---- |
| space-1 | 4px  |
| space-2 | 8px  |
| space-3 | 12px |
| space-4 | 16px |
| space-5 | 20px |
| space-6 | 24px |

强制规则：

* Section 间距：约 `space-6`（24px）
* 组件内部 padding：`space-3` ~ `space-4`（12–16px）
* GameCard 之间间隔：`space-4`（16px）
* Sidebar 行高：不得超过约 48px（`space-6 * 2`）

禁止：

* 使用 `p-7`、`p-8`、`p-10`、`mt-[22px]`、`p-[30px]` 等非制式值。
* 若确有特殊需求，Cursor / 开发者须先取得使用者明确同意。

---

### 7.3 组件密度规范（Component Density）

#### 7.3.1 Quick Entry Cards（首页入口卡）

**Web：**

* 高度：88–110px
* Icon：28–32px
* 圆角：约 8px
* 内距：`p-3`（12px 为主）

**H5：**

* 高度：68–82px
* Icon：24–28px
* 布局结构不变，仅整体缩小

---

#### 7.3.2 游戏卡片（GameCard）

**Web：**

* 一行 4–5 张卡片
* 封面图比例：16:9 或 4:3
* 内距：`p-3`（12px）
* 整体高度约 180–210px（依封面比例微调）

**H5：**

* 固定两栏布局
* 高度缩小 Web 的约 30–35%
* 保持相同比例封面图与排版结构

---

#### 7.3.3 Banner（Hero）

* 高度：160–220px，禁止超过 260px
* CTA 按钮建议在 Banner 右侧或 Banner 中间偏右区
* Web / H5 使用同一 Banner 结构，仅做比例缩放

---

#### 7.3.4 Header

**Web：**

* 高度：56–64px
* 搜寻栏宽度：占 Header 的 32–40%
* Deposit / Wallet CTA 为视觉主角

**H5：**

* Header 整体高度为 Web 的约 80%
* 元素结构与顺序必须一致，不得重新排列成完全不同样式

---

#### 7.3.5 Modal（Deposit / Withdraw / Login）

**Web：**

* Modal 宽度：约 420–480px
* 背景颜色：必须比页面背景更亮，以产生清楚层级
* QR Code 大小不得超过 Modal 宽度的 40–45%
* 链类型 Badge（如 TRC20）：

  * 高度约 20–24px
  * 字号 10–12px
  * 使用小 capsule 形态
* 警示区块必须为小条状 Alert，而非占据大量空间的面板

**H5：**

* 使用 bottom sheet 或置中小型 Modal，禁止全屏模糊一大片
* QR Code 大小约为 Web 的 60–65%
* 内容区域必须可滚动（scrollable），Modal 本身不应超出 viewport

---

### 7.4 圆角（Radius Density）

| Token     | px   | 用途                                |
| --------- | ---- | --------------------------------- |
| radius-sm | 4px  | 输入框、游戏卡片基础边缘                      |
| radius-md | 8px  | Quick Entry Cards、一般卡片、Modal 内部元素 |
| radius-lg | 12px | Banner / 大型 CTA 按钮                |

禁止使用 > 16px 以上之超大圆角（除非特殊 Avatar 或小型 badge）。
赌场 UI 应具科技感与锐利感，避免整体变得过于「卡通」或「可爱」。

---

### 7.5 图标密度（Icon Density）

| 图标类型              | Web     | H5      |
| ----------------- | ------- | ------- |
| Header Icons      | 20px    | 18px    |
| Sidebar Icons     | 18px    | 16px    |
| Quick Entry Icons | 28–32px | 24–28px |
| GameCard 状态图标     | 14–16px | 14px    |

所有图标必须来自统一 Icon 套件（例如 Lucide），禁止混用不同风格图标。

---

### 7.6 字体密度（Typography Density）

| 用途                       | 字级          |
| ------------------------ | ----------- |
| Banner Title             | `text-2xl`  |
| Section Title (Trending) | `text-xl`   |
| Game Title               | `text-base` |
| Provider / 分类标签          | `text-sm`   |
| 状态 / 徽章 (HOT / NEW)      | `text-xs`   |

禁止为了「看起来更大方」随意调成过大文字，破坏密度系统与层级。

---

### 7.7 RWD 密度缩放规则（Responsive Scaling）

H5 版仅允许做「比例缩放」，禁止改版面结构。

Scaling 规则（相对 Web）：

* spacing：约 70–80%
* icon：80–90%
* 卡片高度：60–70%
* Modal：整体宽高约 Web 尺寸的 70%
* Banner 高度：约 Web 的 75–80%

---

### 7.8 视觉对比（Contrast Density）

* Modal 背景必须比主背景亮至少约 8%（视觉上能明显看出层次）
* Alert 颜色必须显眼但不过度刺眼（偏深红或深黄而非纯亮红）
* 主要 CTA（例如 Deposit）必须是页面最亮、最显眼元素之一
* 禁止对比不足导致文字难以阅读或组件「吃色」的情况

---

## 8. Design System（Color / Radius / Typography Tokens）

### 8.1 Color Tokens

```txt
--primary:        #F3C340;  // 金色（主 CTA、重要按钮）
--secondary:      #8A6CF4;  // 次要强调
--success:        #28C081;
--danger:         #E85555;
--text:           #E6E6E6;
--text-muted:     #999999;
--surface:        #131416;
--surface-light:  #1A1C1F;
--border:         #292B2F;
```

禁止直接在代码中使用裸色号（`#fff`, `#333` 等），必须透过 token 或预设 class。

---

### 8.2 Radius Tokens

* `radius-sm` = 4px
* `radius-md` = 8px
* `radius-lg` = 12px

---

### 8.3 Typography Tokens

* Title: `text-2xl` / `text-xl`
* Section 标题: `text-lg`
* Body: `text-base`
* 小字: `text-sm`
* 微字: `text-xs`

---

## 9. RWD 响应式规范（Responsive Behavior Rules）

### 9.1 Breakpoints

```txt
desktop ≥ 1280px  
tablet  768–1279px  
mobile  ≤ 767px
```

### 9.2 强制行为规则

* Mobile 版本 **不得重新设计** 页面结构，仅能等比例缩放、改列数
* Sidebar 在 mobile → Drawer（滑出式侧边菜单）
* TopNav 在 mobile → 横向可滚动 Tab 列
* 游戏列表在 Web → 4–5 列；在 mobile → 2 列
* Modal 在 mobile → bottom sheet 或适当尺寸之置中弹窗

---

## 10. 禁止事项（Prohibited Practices）

* 禁止新增巨石档案（单档 > 400 行必须拆分）
* 禁止复制业务逻辑至多个档案（必须抽出 util 或 hooks）
* 禁止在路由写 SQL / ORM 操作
* 禁止新增非 spacing token / 非 radius token 的尺寸
* 禁止使用裸色号（未经过 Design System 的颜色）
* 禁止在前端散落复杂业务逻辑与 DOM 操作混写

---

## 11. 安全规定（Security Rules）

* 所有金额相关 API 必须具备输入验证 + 权限检查
* 管理后台必须使用 IP 白名单或额外审查机制
* 区块链地址必须做格式验证与部分掩码（mask）
* 禁止回传包含数据库结构或链上内部错误细节的原始错误讯息

---

## 12. 版本管理（Versioning Rules）

* 所有功能改动必须记录在 `CHANGELOG.md`
* 禁止在程式码中写入版本号注释
* API 变更必须同步更新前后端 API 文档与 Swagger（若有）

---

## 13. 测试与部署规范（Testing & Deployment）

* DB Schema 变更必须通过 migrations，不得直接改数据库
* 关键 service 函数必须具备基础测试或 debug 脚本
* `.env` 文件一律禁止纳入 Git
* Docker 配置主要用于本地开发，生产环境须有独立部署说明文档

---

## 14. 宪法冲突处理机制（Conflict Protocol）

当开发或 Cursor 在制定 plan、编写或重构代码时，若发现：

* 需要使用非 spacing token
* 要在路由加入 SQL
* 要新增巨石组件
* 要在前端复制业务逻辑
* 要破坏 Web/H5 统一结构
* 要使用未定义颜色 / radius / 字级

则必须视为 **可能违反宪法** 的行为。

此时：
**必须立即暂停执行，并向使用者确认。**

建议提示内容范例：

```txt
⚠️ 此变更将违反 PROJECT_CONSTITUTION.md 第 X 条（简述条文内容），是否继续？
```

若使用者未明确表示「同意继续」或「临时豁免」：
→ Cursor / 开发者 **禁止继续执行该操作**。

---

## 15. Cursor 自动违宪检测协议（AI Enforcement Protocol）

本章节专门规范 **Cursor / 其他 AI 工具** 在生成任何代码前，必须进行的自动自检逻辑。

### 15.1 视觉规范自检

生成或修改前端代码时，Cursor 必须检查：

* 是否使用 spacing token（`space-1` ~ `space-6` 对应 Tailwind）
* 是否遵守 radius token
* 是否违反组件密度系统（第 7 章）
* Web/H5 是否维持相同结构而仅进行缩放

### 15.2 前端结构自检

* 是否产生单档 > 400 行或单组件 > 300 行
* 是否出现裸 `fetch()`
* 是否出现重复 util 函数
* 是否将复杂业务逻辑写入 UI 组件

### 15.3 后端结构自检

* 路由中是否出现 SQL / ORM 操作
* `services` 是否遵守不得存取 `req` / `res`
* API 返回格式是否符合第 2 章规范

### 15.4 安全自检

* 金额与钱包相关逻辑是否具备输入验证与权限检查
* 是否试图回传内部错误堆叠
* 区块链地址是否完全外露而未 mask

### 15.5 自检失败时的行为

若 Cursor 侦测到任一规则可能被违反：
必须中止本次自动生成，并提示使用者，例如：

```txt
⚠️ Generation blocked: This action may violate PROJECT_CONSTITUTION.md (Section X: 简述条文). 
Please confirm whether to override the constitution for this specific change.
```

仅当使用者明确输入例如：

```txt
确认继续（本次例外）
```

时，Cursor 才能在该次操作中暂时豁免相关条文。
此豁免仅适用于该次操作，不得视为宪法永久变更。

---

### 🏛 本宪法即刻生效

所有开发行为与 AI 自动生成代码，
皆须以本文件为最高准则。
如无特别说明，任何人不得单方面修改或忽略本宪法条文。

> 若未来确需修改本宪法，必须经由使用者（项目拥有者）明确同意，并更新版本号至 `CHANGELOG.md`。