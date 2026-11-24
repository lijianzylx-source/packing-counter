# 速达跨境计件 · 前端（Stitch 设计落地版）

基于 [001.产品PRD/跨境包裹打包统计-PRD-v1.0.1.md](../001.产品PRD/跨境包裹打包统计-PRD-v1.0.1.md) 实现的前端工程，
把 Stitch 产出的 4 张静态设计稿改造成**可运行、可跳转、数据真实**的应用。

> 设计规范见 [docs/设计规范.md](docs/设计规范.md)，需求映射见 [docs/需求对照表.md](docs/需求对照表.md)。

---

## 1. 快速开始

本工程是**纯前端**，账号接口由 `003.网站/server.js` 提供，因此需要**两个服务**：

```bash
# ① 账号后端（提供 /api/register|login|logout|me）—— 默认 5173
node ../003.网站/server.js

# ② 前端静态服务 —— 默认 5174
node server.js            # 指定端口：node server.js 8080
```

浏览器打开 **http://localhost:5174** → 自动进入登录页 → 注册/登录 → 工作台。

> **服务器地址**：前端默认连 `http://localhost:5173`（账号后端）。
> 若后端在别的端口/别的电脑（如手机访问电脑的局域网地址），在登录页或设置页的
> 「服务器地址」里改写即可，保存到本机 `psc.server.v1`。

### 手机访问

```bash
# 先放行防火墙（右键「以管理员身份运行」，需 003.网站 下的 开放手机访问.bat）
# 再用手机浏览器打开控制台打印的 LAN 地址，例如
http://192.168.43.87:5174
```

> **接口地址无需手填**：页面会按「当前主机名 + 接口端口」自动推导
> （手机打开 `192.168.43.87:5174` → 自动连 `192.168.43.87:5173`）。
> 早期版本写死 `http://localhost:5173`，在手机上它指的是**手机自己**，所以永远登录失败。
> 若之前手动保存过 localhost 地址，系统会自动忽略并按当前主机名重新推导。

### 常驻运行（推荐）

两个服务都已配好 **Windows 计划任务**，登录系统后自动启动、崩溃后一分钟内自愈：

| 计划任务 | 负责 | 端口 |
|---|---|---|
| `PackCounterServer` | 账号后端（`003.网站`） | 5173 |
| `PackCounterFrontend` | 前端静态服务（本工程） | 5174 |

```powershell
Get-ScheduledTask -TaskName "PackCounter*"            # 看状态（Running=运行中）
Start-ScheduledTask -TaskName "PackCounterFrontend"    # 手动启动前端
Stop-ScheduledTask  -TaskName "PackCounterFrontend"    # 手动停止
schtasks /Delete /TN "PackCounterFrontend" /F          # 彻底取消自启
```

也可以随时双击 **`启动服务.bat`** 手动拉起（端口已占用时会提示「已在运行」并直接打开浏览器）。

> ⚠️ 不要用 `file://` 直接打开 `index.html`：浏览器会拦截「本地文件 → 本机服务器」的访问，
> 且账号接口无法工作（可用「以离线模式直接进入」绕过，但拿不到账号）。
>
> ⚠️ `.bat` 脚本里**只能用英文/ASCII**，不要写中文——cmd 按系统代码页（GBK）解析批处理，
> UTF-8 中文会导致命令被拆散执行（已踩过一次）。

## 2. 目录结构

```
前端代码（前端工程师）/
├── index.html                    入口（跳转登录页）
├── pages/                        页面（每页一个 HTML + 一个脚本）
│   ├── login.html                登录 / 注册 / 离线入口 / 服务器地址
│   ├── workbench.html            今日录入（日期锁定、实时结算、快捷加件）
│   ├── history.html              历史明细（补录通道 + 流水账本 + 行内编辑）
│   ├── dashboard.html            统计看板（KPI + 趋势图 + 对账明细）
│   └── settings.html             系统设置（账号 / 单价 / 提醒 / 数据）
├── assets/
│   ├── css/
│   │   ├── tokens.css            设计令牌：色板、字阶、间距、圆角（唯一来源）
│   │   ├── base.css              重置、排版、工具类、[hidden] 守卫
│   │   ├── components.css        组件：卡片/按钮/输入/徽章/表格/提示条
│   │   ├── layout.css            骨架：侧边栏 / 顶栏 / 主内容 / 响应式
│   │   ├── chart.css             图表容器与提示框
│   │   └── utilities.css         精简工具类（grid/flex 栅格等，替代 Tailwind CDN）
│   └── js/
│       ├── config.js             配置：接口地址、存储键、默认值、路由表
│       ├── core.js               业务纯逻辑（零 DOM，可单测）
│       ├── store.js              本地存储层（后端注入，可测）
│       ├── api.js                账号接口封装
│       ├── auth.js               会话与路由守卫
│       ├── avatar.js             头像处理（选图 → 居中裁剪 256×256 → DataURL）
│       ├── icons.js              内联 SVG 图标精灵（38 个图标，零外部依赖）
│       ├── ui.js                 共享外壳（侧栏/顶栏）+ 通用交互
│       ├── chart.js              轻量 SVG 柱状图（dataviz 规范）
│       └── pages/                各页面逻辑（login / workbench / history / dashboard / settings）
├── docs/
│   ├── 设计规范.md
│   └── 需求对照表.md
├── legacy/stitch-原始产出/        Stitch 原始设计存档（4 张设计图 + DESIGN.md 规范）
├── server.js                     静态服务器（零依赖）
└── test/core.test.js             业务逻辑测试（18 项）
```

## 3. 分层约定

```
HTML  ── 只放结构与语义 class，不写内联样式与业务逻辑
CSS   ── tokens → base → components → layout → chart → utilities（分层引入，后者可覆盖前者）
JS    ── config → core(纯逻辑) → store → api → auth → icons → ui → chart → pages/*
```

**硬性约定**

- 业务逻辑一律放 `assets/js/core.js`，**零 DOM 依赖**，才能被 `test/core.test.js` 直接跑；
- 页面脚本只做「取数 → 渲染 → 绑事件」，不重复实现业务规则；
- 颜色只在 `tokens.css` 定义一次，`components.css` 与图表都引用 CSS 变量；
- 导航由 `ui.js` 依据 `config.js` 的路由表统一渲染 —— **新增页面只改路由表**；
- 组件类名 `c-<block>__<element>`，布局 `l-<block>`，工具类 `u-<property>`；
- **零外网依赖**：Tailwind 与图标字体均已移除（见下），页面在离线 / 内网可完整渲染。

### 为什么移除了 Tailwind CDN

Stitch 原稿用 `cdn.tailwindcss.com`（**阻塞解析**的外部脚本）与 Google Fonts 图标字体。
一旦外网不可达（代理超时、内网隔离），页面会**白屏**——实测本机环境下即是如此。

改造方案：

| 原依赖 | 替代 |
|--------|------|
| Tailwind CDN（工具类） | `assets/css/utilities.css` 自带精简工具类 + 语义化组件类 |
| Material Symbols 图标字体 | `assets/js/icons.js` 内联 SVG 精灵（37 个图标，`<use href="#i-xxx">`） |
| Google Fonts | 改为非阻塞加载（`media="print" onload=...`），失败自动回退系统字体 |

> 图标精灵由 `icons.js` 自动注入一次；新增图标只需在 `icons.js` 的 `PATHS` 里加一条路径。

## 4. 页面跳转关系

```
index.html ──► pages/login.html ──登录/注册──► pages/workbench.html
                    │                              │
                    └────离线进入──────────────────┤
                                                   ├─► pages/history.html
                                                   ├─► pages/dashboard.html
                                                   └─► pages/settings.html
```

侧边栏（PC）/ 底部导航（移动）在所有页面一致，由 `ui.js` 渲染，当前页 `aria-current="page"` 高亮。

## 5. 测试

```bash
node test/core.test.js            # 全部（18 项）
node test/core.test.js 收入        # 只跑名称匹配的用例
```

覆盖 PRD §5 全部业务规则：收入公式、件数校验、一日一记录覆盖、单价调整重算、统计口径（工作天数 / 未记录天数）、
首页日期恒为当天、补录序列、筛选、CSV 导出与转义、用户名与密码规则、月份切换。

## 6. 与后端的关系

- 前端只负责静态资源，**不包含账号逻辑**；
- 账号接口契约见 PRD §4.6：`POST /api/register|login|logout`、`GET /api/me`，令牌用 `Authorization: Bearer` 携带；
- 前端默认连接 `http://localhost:5173`（账号后端），可在登录页 / 设置页改写，**保存在本机**（`psc.server.v1`）；
- 前端使用独立的存储命名空间（`psc.*`），与 `003.网站` 的数据互不干扰；
- 本机没有账号后端时：登录页底部「以离线模式直接进入」可用，记录/统计照常（不做账号校验）。

### 6.1 头像上传（前端已实现，后端待补）

设置页点击头像（或「更换头像」）→ 打开系统文件选择器：

1. **校验**：仅图片类型、原始文件 ≤ 8MB；
2. **处理**：Canvas **居中裁剪**为 256×256 —— PNG/WebP 保留透明（输出 PNG），其余输出 JPEG(0.85)，体积从数 MB 降到几十 KB；
3. **存储**：先写本机 `psc.avatar.v1`（立即可见），再 `POST /api/me/avatar` 尝试上传；
4. **降级**：接口未就绪 / 不可达 → 保留本机头像，并提示「后端头像接口未就绪，头像暂存在本机」；
5. 设置页与侧边栏头像同步刷新，并提供「恢复默认头像」。

> 后端补齐时只需实现 `POST /api/me/avatar`（请求体 `{avatar: "<dataURL>"}`，返回 `{avatar: "<可访问URL>"}`），前端无需改动。

## 6.1 快速自检

```bash
node test/core.test.js                                   # 业务逻辑 18 项
# 端到端（需两个服务都启动）：
#   node ../003.网站/server.js 5173     # 账号后端
#   node server.js 5174                 # 前端
# 然后浏览器打开 http://localhost:5174
```

## 7. 与 Stitch 原稿的差异

原稿是**静态设计稿**：页面互不相通、数据写死、登录是假的、保存不落盘。
本次改造逐项修复见 [docs/需求对照表.md](docs/需求对照表.md#stitch-原稿的问题清单本次已修复)（15 项）。
设计参考图与原始规范保留在 `legacy/stitch-原始产出/`（原稿源码已随重构移除）。
