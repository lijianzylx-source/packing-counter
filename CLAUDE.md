# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 仓库结构

```
001.产品PRD/              产品需求文档（需求唯一来源，v1.0 / v1.0.1 / v1.1.0-PC版）
002.设计/                 配色方案与设计变量（图表配色的可访问性校验结论在此）
003.网站/                 独立 Web 应用（前端 + 账号后端，零依赖）
前端代码（前端工程师）/    Stitch 设计稿落地的前端工程（前端 + 复用 003.网站 的账号接口）
```

> `003.网站` 与 `前端代码（前端工程师）` 是**同一产品的两套前端实现**，共用 `003.网站/server.js` 的账号接口，但**数据存储命名空间不同**（`pkgstat.*` vs `psc.*`），互不干扰。

文档与代码配套：改需求先动 `001.产品PRD/`（第 4 章 F-xxx 需求编号、第 5 章业务规则、第 11 章验收清单），改配色同时更新 `002.设计/配色方案.md`。

## 常用命令

无构建步骤、无 npm 依赖、没有 package.json。Node 仅用于 HTTP 服务与测试。

```bash
# 本地预览（默认 5173；账号接口需要它，Service Worker 也需要 http 环境）
node 003.网站/server.js
node 003.网站/server.js 8080
node 003.网站/server.js --open     # 启动后自动打开浏览器
# 或直接双击 003.网站/启动服务.bat

# 测试
node 003.网站/test/core.test.js     # 记录与统计逻辑（19 项）
node 003.网站/test/auth.test.js     # 账号与会话（18 项）
node 003.网站/test/auth.test.js 令牌  # 只跑名称匹配的用例（子串过滤）

# Stitch 前端工程（见下文）
node 前端代码（前端工程师）/server.js 5174          # 前端静态服务
node 前端代码（前端工程师）/test/core.test.js      # 业务逻辑（18 项）
```

**两个服务都配了 Windows 计划任务，登录自启 + 崩溃一分钟内自愈**（别用临时进程跑，会随会话结束被回收）：

| 计划任务 | 服务 | 端口 |
|---|---|---|
| `PackCounterServer` | 账号后端（`003.网站/server.js`） | 5173 |
| `PackCounterFrontend` | 前端静态服务（`前端代码（前端工程师）/server.js`） | 5174 |

```powershell
Get-ScheduledTask -TaskName "PackCounter*"    # 看状态
Start-ScheduledTask  -TaskName "PackCounterFrontend"
```

路径含中文与空格，shell 里必须加引号。

## 架构

**三块，逻辑与 DOM、HTTP 各自分离：**

- `003.网站/assets/core.js` —— 前端纯逻辑，零 DOM 依赖。同时以 `module.exports`（Node）和 `window.Core`（浏览器）发布，测试跑的就是浏览器跑的那份代码。含日期/格式化、校验、记录操作（`upsertRecord` `removeRecord` `repriceRecords`）、统计口径（`computeMonthStats` `recentSeries` `filterRecords`）、`toCSV`（带 BOM）、以及 `createStore(backend)`——存储后端是**注入**的（浏览器 `localStorage`，测试用内存 Map）。
- `003.网站/assets/app.js` —— 前端交互层，一个 IIFE。`state` 保存视图/月份/图表选项/登录态；每个视图一个 `renderXxx()`，`renderAll()` 全量刷新；图表是手写 SVG，没有图表库。
- `003.网站/auth.js` —— **服务端**账号逻辑（scrypt 哈希、令牌、会话），不依赖 HTTP，可直接单测。
- `003.网站/server.js` —— HTTP 层：静态文件 + `/api/register|login|logout|me`。账号存 `data/users.json`（运行时生成）。

**接口契约**：`Authorization: Bearer <token>`；错误响应统一 `{ok:false, code, message}`，前端读 `data.message` 展示。

**存储键**：`pkgstat.records.v1` / `pkgstat.settings.v1`（浏览器本地）、`pkgstat.auth.v1`（令牌）、`pkgstat.server.v1`（服务器地址）、服务端 `data/users.json`。

**业务规则（改动时必须保持，来自 PRD 第 5 章）：**

- `收入 = 件数 × 单价`，件数须为 ≥ 0 的整数，单价范围 0.01–100。
- 一个自然日只允许一条记录；重复保存即覆盖，保留 `createdAt`、更新 `updatedAt`。
- 改单价会**重算所有历史记录的收入**（`repriceRecords`）。
- 未记录的日期不计入工作天数，但计入未记录天数；「今天/本月」按本地自然日与自然月。
- **记录页日期恒为当天且不可选**（只读文本展示，PRD F-001/F-020）。补录与修改往日记录统一在历史页完成：「补录这天」与行内「改」，两者最终都走 `store.upsert`。
- 用户名 2–20 位（中文/英文/数字/下划线/短横线），大小写不敏感判重；密码 6–72 位；同一用户名 5 次密码错误锁定 15 分钟。
- **打包记录与设置永远留在浏览器本地，不上传服务器**；账号只做身份识别。

## 改 UI 时的四个坑

1. **不要把步进器的 input 改成 `flex: 1` 或放进 grid 轨道让它撑满。** Chrome 不会把 `<input type="number">` 拉伸到轨道宽度（固有宽度会变成下限），实测会撑破容器造成横向溢出。现在用的是固定基准宽度 + 允许收缩：`flex: 0 1 160px; width: 160px`。
2. **`sw.js` 是网络优先 + 缓存兜底**，不是 cache-first；`/api/` 请求与**跨源请求**显式不走缓存（令牌校验必须实时）。改动资源文件名时记得同步 `sw.js` 里的 `ASSETS` 列表。
3. **CSP 含 `frame-ancestors 'none'`**，所以不能把页面塞进 iframe 来做窄屏截图（会被浏览器拦成「已阻止」）。窄屏验证要用 CDP 设备模拟（见下）。
4. **`hidden` 属性必须靠全局 `[hidden] { display: none !important; }` 生效。** `.btn`/`.view`/`.record-list` 自身设了 `display`，会覆盖浏览器默认的 `[hidden]{display:none}`，导致本该隐藏的按钮/列表一直显示（这个 bug 已经踩过一次）。

## 布局：移动版 / PC 版同一套代码

- 结构：`.app-shell` > `.sidebar`（品牌 + 导航 `.tabbar` + 今日概览 `.sidebar-panel` + 账号条 `.sidebar-user`）+ `.app-body`（顶栏 + `.container` 四个视图）。
- **同一份 DOM，CSS 切换**：<1024px 时 `.sidebar` 变成底部导航条（只显示 `.tabbar`）；≥1024px 时变成 252px 左侧栏（sticky）。**不要为 PC 版另建一套页面**——业务逻辑、账号、数据都是同一份。
- PC 断点写在 `style.css` 末尾的 `@media (min-width: 1024px)` 里：容器最大 1240px、记录页双栏（`.record-form` / `.record-overview`）、历史行五列 grid（`grid-template-areas`）、统计 4 列、设置两栏。
- 历史行是**扁平子元素**（`.record-date` `.record-count` `.record-income` `.record-note` `.record-actions`），靠 grid-area 在移动/PC 两种形态下重排；改行结构时两套 area 都要同步。
- 图表在宽屏会把绘图区限制到 900px 并居中（`MAX_PLOT`），否则柱子会被拉得很散；柱宽上限仍是 24px。
- 快捷键在 `app.js` 的 keydown 处理：`N` 聚焦、`Ctrl/⌘+Enter` 保存、`1~4` 切视图；输入框内不触发单键快捷键。

## 接口地址与本地文件（v1.0.1 修）

- 接口基址由 `Core.resolveApiBase()` 决定：用户设置 > `file://` 时用 `http://localhost:5173` 绝对地址 > 同源相对路径。**不要写死相对路径**：`file://` 下相对路径会被浏览器直接拦截。
- Chrome 的「本地网络访问」策略会拦截 `file://` 页面发往本机服务器的**子资源请求**（加 CORS/PNA 头也拦不住），但**顶层跳转**不受影响 —— 所以 `file://` 场景的解法是「在服务器上打开页面」按钮（`openOnServer()`），不要指望改请求头解决。
- 服务器接口已开 CORS（`Access-Control-Allow-Origin: *` + `Access-Control-Allow-Private-Network: true`）并处理 OPTIONS 预检；鉴权走 `Authorization` 头而非 Cookie，故跨源无法读取他人数据。

## 图表的硬性约束（来自 dataviz skill，已在配色方案中通过色盲与对比度校验）

单序列：主蓝 `#2563EB`、不放图例（标题已说明画的是什么）、只标注极值与末点、柱宽 ≤24px 且顶端 4px 圆角、网格线 1px 实线、**未记录的日期不画柱**（避免把「没记录」误读成 0 件）、必须保留「表格视图」作为颜色之外的等价读数通道。改动图表前先读 `002.设计/配色方案.md`。

## 前端代码（前端工程师）：Stitch 设计落地版

同一产品的**另一套前端实现**：把 Stitch 产出的 4 张静态设计稿改造成可运行、页面互跳、数据真实的前端工程；功能依据同一份 PRD。

- **层次**：CSS `tokens → base → components → layout → chart → utilities`；JS `config → core(纯逻辑) → store → api → auth → avatar → icons → ui → chart → pages/*`。
- **导航**：`ui.js` 依据 `config.js` 的路由表统一渲染侧边栏/顶栏，新增页面只改路由表；`mountShell(pageId)` 的 pageId 可能带 `.html`，**要 strip 后**再匹配路由 id（否则标题与高亮错位）。
- **存储命名空间** `psc.*`，与 `003.网站` 的 `pkgstat.*` 隔离，两套实现互不干扰。
- **账号接口复用** `003.网站/server.js`（默认 5173），前端默认端口 5174；地址可在页面内改（`psc.server.v1`）。

### 这个工程的五个坑

1. **不要引入 Tailwind CDN 或图标字体 CDN** —— 脚本阻塞解析，外网不可达（代理超时 / 内网隔离）时**整页白屏**。工具类在 `assets/css/utilities.css`，图标在 `assets/js/icons.js`（内联 SVG 精灵，`<use href="#i-xxx">`）。字体已改为非阻塞加载，失败回退系统字体。
2. **`hidden` 属性依赖 base.css 的全局 `[hidden]{display:none!important}`** —— `.c-field`/`.c-btn` 自身设了 `display`，会覆盖浏览器默认的 `[hidden]{display:none}`（已踩过两次）。
3. **图表颜色用 `var(--c-chart)`**（tokens.css 定义为 `#2563EB`），别写死；写错变量名会静默变黑柱。
4. **`core.js` 是纯逻辑、零 DOM**，页面脚本只做「取数→渲染→绑事件」；业务规则改动一律落在 `core.js` 并补 `test/core.test.js`。
5. **数据仍存本机**（`psc.records.v1`），换设备登录看不到本机数据 —— 这是 PRD §5.10 的既定决策，不是 bug。
6. **头像走「本机优先 + 后端兜底」**：`avatar.js` 负责裁剪（256×256 Canvas），`store.setAvatar` 写 `psc.avatar.v1` 立即可见，随后 `POST /api/me/avatar` 尝试上传；后端未实现时**不要报错**，只提示「暂存在本机」。
7. **接口地址必须按当前主机名推导（手机能用的关键）**：`Core.resolveApiBase()` 优先级为 用户设置 > 同端口同源 > **当前主机名 + `apiPort`**。**不要写死 `http://localhost:5173`** —— 手机打开 `192.168.x.x:5174` 时，localhost 指的是手机自己，登录必然失败；页面上遗留的 localhost 保存值会被自动忽略（自愈）。

## 验证方式

没有 UI 测试框架。改了界面用真实浏览器核对（Chromium 对 `--window-size` 有约 496px 的最小宽度限制，要模拟手机宽度必须用 CDP 设备模拟）：

```powershell
# 启动带调试端口的浏览器
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu `
  --user-data-dir="$env:TEMP\edge-cdp" --remote-debugging-port=9222 --remote-allow-origins=* about:blank
# 用 CDP 设置 390px 视口并截图（Node 22+ 自带全局 WebSocket，无第三方依赖）
node 003.网站/tools/shot.js "http://localhost:5173/index.html" out.png 390 844
```

`index.html#stats|#history|#settings` 可直接定位到对应视图。逻辑改动则靠两个测试脚本。

## 改代码时的约定

- 新增记录字段：同步改 `core.js` 的 `createStore`/`toCSV`/`importBackup`，并在 `test/core.test.js` 补用例。
- 新增接口：在 `auth.js` 写可测的业务逻辑，`server.js` 只做 HTTP 壳；错误一律返回 `{ok:false, code, message}`。
- 行为变更：PRD 与测试一起改，测试用例名直接写清对应的业务规则，便于日后反查。
- 涉及「清空/覆盖数据」的功能必须二次确认（`window.confirm`）。
- 服务端不要把 `data/`、`test/`、`tools/`、`.tmp/` 目录以及 `auth.js`、`server.js` 暴露出去（`server.js` 的 `BLOCKED` 列表已拦截，新增敏感路径要一并加进去）。
- **服务必须保持运行**：页面依赖后端接口，`node server.js` 的窗口关掉服务就停了。端口占用时 `server.js` 会打印可读提示并退出。
