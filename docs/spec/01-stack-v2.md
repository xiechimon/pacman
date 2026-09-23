# 01 · 技术栈锁定 v2（todos.dev 复刻）

> Wayfinder 票：xiechimon/pacman #43（`wayfinder:grilling`，决议 2026-09-20，两轮全 frontier 裁决）。
> 方法论承旧 01-stack（`git show 131620e:docs/spec/01-stack.md`，nanobot 复刻册，仓库转向后仅方法论有效）：逐项锁死、实现会话零选型权、接口替换缝、pin 纪律、对拍验收。
> 边界继承：`00-地基决议.md` D1–D7（记作 `00/D*`）；`02-架构平价.md` A1–A12（记作 `02/§*`）；词汇与实体边界 = 根 `CONTEXT.md`。上游证据：`docs/research/r1-site-inventory.md`（记 `r1 §…`）、`r2-app-ui-inventory.md`（`r2 §…`）、`r3-protocol-executor.md`（`r3 §…`）、`r4-foundation.md`（`r4 §…`）。
> npm 版本为 **2026-09-20 registry 实测**（latest 或指定 tag）；pi 系版本从 00/D6 canon。
> 类型记号：**沿用**（继承旧 01-stack 或 00/02 既有决议）/ **锁定**（本票新拍板）/ **[设计]**（官方不可观测，复刻自设）/ **[推断]**（无一手观测的黑盒逼近）/ **移交**（本册只定边界，细案归他票）。

## 0. 结论一览

| # | 决策 | 一句话 |
|---|---|---|
| S1 | 同栈原则 | **像素平价不要求同栈**；验收 =「用户视角不可分辨」（#34 口径），每项带观测栈差异注记（§8） |
| S2 | 前端形态 | **单 Vite + React SPA**：landing 与 workspace 同应用、路由分隔；不引 Next.js/SSR |
| S3 | runtime | **Node 24 LTS**（`engines >=22.19.0`，pi 底线），CI 矩阵 22/24；Bun 不引入 |
| S4 | 存储 | **SQLite（better-sqlite3）+ Drizzle**；schema 面 = 02 §6.2 record 形状投影（§6） |
| S5 | 样式体系 | **Tailwind 3.4.19（= 观测同版，v3-lts）**+ CSS 变量 token 层 + Radix（`radix-ui` 统一包）+ cmdk；深色默认 `.light` 反相 trick 原样复刻 |
| S6 | i18n | **分层同构官方不对称**：landing 四语 / docs 仅 en+zh-CN / 法务仅英文 / workspace zh-CN 权威 + en 兜底；react-i18next |
| S7 | 流式渲染 | **streamdown**（内置 shiki + katex + 流式半渲染安全），patch-pin |
| S8 | 状态与数据层 | **TanStack Query v5**（SSE 事件 → `invalidateQueries`，兑现 02 §1.2）+ **Zustand**；localStorage 键名照 r2 §1.5 契约 |
| S9 | daemon 发行 | **纯 JS npm 包**（esbuild 单文件 + node shebang）；不复刻 6 平台二进制 |
| S10 | git 操作层 | **spawn 系统 git + 自建薄 wrapper**（词表 = 02 §5.5 契约）；server 端 `git http-backend` CGI；isomorphic-git/simple-git 不引入 |
| S11 | 批量沿用面 | Hono、zod 4、pnpm+catalog、Biome、vitest+playwright、commander+clack、pino、cron-parser、TS 7.0.2、ESM nodenext、PWA 原样搬、keyfile AES-256-GCM、EventSource、undici 代理（§4.5） |
| S12 | AgentBackend 缝 | 落 `packages/shared`，事件面 = 02 §5.6 pi 词表 1:1（签名草案 §5） |

---

## 1. 定位与裁决原则

本册把复刻实现所需**全部技术选型逐项锁死**。实现者拿到 00 + 02 + 本册后不做任何选型决策；只改决定，不改实现。00 定地基边界（引擎/craft 档位/UI 地基/pin 纪律），02 定架构 canon（进程拓扑/协议契约/安全边界），本册钉引擎与逐项 pin 表——三册分工即 00 §「对下游票的影响」与 02 §10 的移交清单，本册逐项闭环。

**S1 同栈裁决（票面问「像素平价是否要求同栈」）**：**不要求**，且「同栈」无单一对象——官方自身两套异构（landing = Next.js App Router SSG，r1 §1.1 headers 实证；workspace = 原子类 `r-*`/`css-*` DOM → **[推断] React Native Web / Expo 系**，r2 §92）。验收口径「像素级 UI + 功能等价，用户视角不可分辨」约束的是渲染结果与行为，不是构建栈。RNW 复刻成本极高且与 00/D5（从零 React + Radix + 自建 token）冲突，同栈路线不成立。**义务转化为**：每项决策带观测栈差异注记（§8 汇总），不可观测处标 [设计]/[推断]，像素对拍靶 = r1/r2 截图与 CSS 抓包原件。

## 2. 观测栈底账（差异注记的事实基线）

| 面 | todos.dev 观测 | 出处 |
|---|---|---|
| landing 框架 | Next.js App Router、SSG 预渲染（`x-nextjs-prerender: 1`、`/_next/static/*`） | r1 §1.1 |
| landing CSS | Tailwind CSS **3.4.19**（文件头 banner）+ Tailwind Typography（`--tw-prose-*` 全量） | r1 §1.1 |
| 主题 | **深色 = `:root` 默认态**，浅色 = 根挂 `.light`；`dark:*` 编译为 `.dark\:x:where(:not(.light):not(.light *))`；`theme-color #18181b`、`color-scheme dark light` 全 163 页一致 | r1 §4.3 |
| 色板 | 深色侧 zinc 原色阶、浅色侧 stone 暖米白；主强调 indigo 原色阶；状态色 rose/amber/green/gray；阴影未自定义（`shadow-sm` 主力）；断点 = Tailwind 默认五档 | r1 §5 |
| 字体 | 仅 2 个 woff2：Inter + JetBrains Mono；**CJK 无 webfont，全靠系统字体 + emoji 字体族兜底**；CSS 变量 `--font-inter`/`--font-jetbrains-mono` + Arial 兜底度量覆写（859B 样式表已全量抓取） | r1 §4.1 |
| workspace 框架 | **[推断]** React Native Web / Expo 系（原子类实证） | r2 §92 |
| 实时面 | **全 SSE 无 WebSocket**（team stream / conversation stream / machine stream） | r3 §8.1、02 §1.2 |
| executor 发行 | npm -g `@todos-dev/cli` 0.1.52，包体 275MB：6 平台二进制（`@todos-dev/cli-darwin-arm64` 等）+ 内嵌依赖；`pi-ai`/`pi-coding-agent` **0.84.3** 明文 | r3 §1.1 |
| PWA | `manifest.webmanifest`（1,146B）+ `sw.js`（3,495B，自述「notification click routing only, 无 fetch handler」）全量已抓 | r1 §5.1/§5.3 |
| i18n | `en` 无前缀 / `/zh` / `/zh-TW` / `/ja`，`x-default`→en；营销四语全译、docs 仅 zh-CN 全译、privacy/terms 仅英文；未匹配路径 307 → `/login?callbackUrl=` | r1 §1.1/§8 |
| DB / server 框架 / 状态库 / markdown 渲染栈 | **不可观测**（服务端黑盒；前端在 minified bundle 内） | r1 §9、r3 §11 |

## 3. monorepo 布局与 pin 纪律

**pnpm 12.5.1 workspaces + catalog**（沿用旧 §3；turbo 后置——CI 时长成痛点再加）。四包：

```
apps/web        # SPA：landing（41 路由 × locale）+ workspace（/app 树），Vite 构建，路由分隔
apps/server     # Hono：REST + SSE + SPA 静态同源托管（02/A1）+ git http-backend + cron + DB + 通知
apps/daemon     # executor CLI（tds 品牌位→#44）：claim/心跳/worktree/pi 会话/上传，esbuild 单文件
packages/shared # 协议词表、record 形状 zod schema、命名常量表（02 §5.8）、AgentBackend 缝（§5）
```

依赖方向：`web / server / daemon → shared`，三端互不依赖，shared 零反向。全线 ESM（`"type": "module"`），tsconfig `module: nodenext` + `strict`，target Node 24。共享依赖版本走 catalog 统一。

**pin 纪律（00/D6 展开为逐项 pin 表 = §4 各表「pin」列）**：一切依赖精确 patch-pin；pi 系（`@earendil-works/*`）钉 **0.85.1**（00/D6 canon；registry 实测 2026-09-20 已出 0.86.0——**不动 pin**，首个升级窗口按 D6 读 Breaking 段后评估，观察项见 §9）。升级票后置纪律承旧：复刻验收前禁止框架 major 抬版（Tailwind 4 / TS 7 / react-router 8 各自成票，§9）。

**接口替换缝**（沿用旧 §3 方法论，lint 规则强制——缝外直接 import 被包依赖 = 违规）：

- `AgentBackend` ← pi SDK（§5，00/D1 缝的签名落地）
- `GitOps` ← 系统 git spawn wrapper（词表 = 02 §5.5 worktree 契约 + §3 http-backend/读树）
- `Settings` ← 自建分层 config（zod schema，优先级 = 显式入参 > env > .env > 配置文件 > 默认值，承旧）
- `SecretBox` ← node:crypto AES-256-GCM（keyfile 细案 §4.2）
- `Scheduler` ← cron-parser + 自建调度循环（02 §9.2 词表）

## 4. 逐项决策表

### 4.1 前端（apps/web）

| 项 | 决策 | pin | 类型 | 理由 / 观测栈注记 |
|---|---|---|---|---|
| 框架 | React 19 SPA（从零，00/D5） | react / react-dom **19.3.0** | 锁定 | 新建无升级债，直取 latest 19；官方 workspace RNW [推断] 不复刻（S1） |
| 构建 | Vite + @vitejs/plugin-react；dev 期 proxy → server | vite **8.3.0** / plugin-react **6.1.1** | 锁定 | 单 SPA 无 SSR 诉求；PWA/桌面壳包 SPA 最顺（02 §1.1 前提）；官方 landing Next.js SSG → 差异注记 §8 |
| 路由 | React Router v7（library mode），手写路由表 | react-router **7.18.4** | 锁定 | 路由表固定（41 landing + locale + /app 树）；v8.4.0 已发布 → 升级窗口观察（§9）；locale 形状照抄：`en` 无前缀 `/zh` `/zh-TW` `/ja` + hreflang alternate + `x-default`→en（r1 §1.1） |
| 样式 | Tailwind CSS **3.4.19（= 观测同版）**，v3-lts tag 实测 | tailwindcss **3.4.19** | 锁定 | r1 抓的编译产物即 3.4.19：类名语义、默认断点五档、shadow 值零翻译直接对拍；`dark:` 变体用 plugin `addVariant('dark', '&:where(:not(.light):not(.light *))')` **精确复刻官方反相选择器**（r1 §4.3，勿按常规「默认浅色+dark:前缀」做）；Tailwind 4 = 升级票后置（§9） |
| design token | CSS 变量层：r1 §5 色名→变量映射表照抄进 `theme.extend.colors` 消费；`--font-inter`/`--font-jetbrains-mono` 照抄；zinc/stone/indigo 原色阶语义保持 | — | 锁定 | 00/D5「自建 token」的落地形；对拍靶 = r1 `[f965382e067739e9.css]` 原件 |
| 字体 | r1 已抓 859B `@font-face` CSS 原样搬 + 2 woff2 自托管；CJK 无 webfont 系统兜底（r1 关键复刻约束）；emoji 字体族进 font stack | — | 沿用 | woff2 文件与位图图标下载归 #44 素材清单（§9） |
| 组件层 | Radix Primitives（`radix-ui` 统一包）+ cmdk（⌘K 面板骨架，行为靶 = r2 §8.4 面板形 + 02 §6.3 wire） | radix-ui **1.6.7** / cmdk **1.1.1** | 锁定 | 00/D5 已定 Radix 类 + 自建 token；craft UI 仅交互参考 |
| 图标 | 自建 SVG sprite；字形提取（登录态抓 workspace bundle/截图描摹）列 #44 素材清单；不引 lucide 占位 | — | 移交 | 官方图标字形不可观测（RNW bundle 内）；占位库字形错配返工 |
| 数据层 | TanStack Query v5：server state 全走查询失效重取（02 §1.2 [推断] 策略的复刻实现）；SSE 事件仅作 `invalidateQueries` 提示信号 | @tanstack/react-query **5.103.1** | 锁定 | 02 已锁策略，本册钉库 |
| 客户端状态 | Zustand；localStorage 键名照 r2 §1.5 实测契约（`tds.` 前缀 = 品牌位→#44） | zustand **5.0.15** | 锁定 | 官方状态库不可观测 [设计] |
| 流式 markdown | streamdown（底层 react-markdown 管线 + 流式未闭合块安全 + 内置 shiki 高亮 + katex 数学） | streamdown **2.6.0** | 锁定 | transcript `text_delta` 流（02 §5.6 词表）+ plan 卡 + docs `.tex` 数学面（r1 changelog 09-08 实测）；官方渲染栈不可观测 [设计]；对拍靶 = r3 transcript 行形 + 截图 |
| 拖拽 | @dnd-kit/core + sortable（看板卡跨列 + 列内 `orderIndex` 排序） | core **6.3.1** / sortable **10.0.0** | 锁定 | 85 号截图实测拖动；react-beautiful-dnd 停更不选 |
| 表单 | 手写受控组件 + zod 校验；不引 react-hook-form | — | 锁定 | 像素全定制时 RHF 只省注册样板；评论框 = 原生 textarea + 自建 mention/附件弹层（r2 工具条三钮实测）；「语音输入」= Web Speech API **[推断]**（形状平价，行为尽力，差异注记 §8） |
| diff 视图 | npm `diff` 算数据 + 自建渲染（行级/词级高亮 ~150 行） | diff **9.0.0** | 锁定 | plan 卡 Changes 像素靶 = 69 号截图；diff2html 自带样式对不上靶 |
| emoji 选择器 | 自建：`Intl.Segmenter` grapheme 切分 + Unicode property escape 校验「恰好一个 emoji cluster」（旗帜/keycap/肤色/ZWJ，r1 changelog 09-08 实测语义）；常用网格子集归 #44 | — | 锁定 | 第三方 picker 像素对不上且重 |
| 日期 | date-fns（前端展示层；locale 覆盖 en/zh-CN/zh-TW/ja 恰配 S6） | date-fns **4.4.0** | 锁定 | 定时表单四档分刻/tz 注文案靶 = r3 §9；后端时区 = 内置 `Intl`（§4.2） |
| i18n | react-i18next；**分层口径（S6，地图雾本次裁决）**：landing 四语全量（素材 = r1 `i18n-*.txt` 逐语对照已抓）；docs 仅 en+zh-CN 全译、zh-TW/ja 仅 6 营销页+changelog（sitemap 92 条形状照抄）；privacy/terms 仅英文；**workspace zh-CN 权威**（r2/r3 全部文案 canon 即中文）+ en 兜底，zh-TW/ja 不做 | i18next **26.4.2** / react-i18next **17.0.14** | 锁定 | 验收 = 对官方不可分辨，官方本就不对称（r1 §8）；workspace 另两语无观测真值，做了也无对照物；路由形状照抄，未匹配路径官方 307→`/login?callbackUrl=`——复刻无登录页（02/A2 自动登录），改 **[设计]** 未匹配 → `/app` 重定向 |
| PWA | `manifest.webmanifest` + `sw.js` **照 r1 全量抓包原样搬**（仅品牌槽/图标 URL 替换，归 #44）；不引 PWA 插件库；`theme-color #18181b` + `color-scheme dark light` 全页一致照抄 | — | 沿用 | sw.js 自述「notification click routing only、无 fetch handler」= 02 §9.1 通知设计的前提，字节级搬最省对拍 |
| 通知 | 页内 `new Notification()`，仅 `document.hidden` 时弹（02 §9.1 canon）；无 VAPID/Web Push 库 | — | 沿用 | 02/A12 已锁，零选型 |
| SSE 客户端 | 原生 `EventSource`（同源 cookie 会话，无自定义 header 需求） | — | 锁定 | 三通道端点 = 02 §1.2 表 |
| 虚拟滚动 | 不锁定；transcript 长流实现期可选 `@tanstack/react-virtual` | — | 移交 | 性能面非平价面，实现期按实测定 |

### 4.2 server（apps/server）

| 项 | 决策 | pin | 类型 | 理由 / 观测栈注记 |
|---|---|---|---|---|
| runtime | Node 24 LTS；`engines >=22.19.0`（pi 底线，00/D6）；CI 矩阵 22/24、24 为主 | — | 沿用 | 承旧 stack 论证（LTS 覆盖周期；验收红须归因自代码）；官方 runtime 不可直接观测，npm 发行 + pi 依赖 → Node [推断] |
| HTTP 框架 | Hono + @hono/node-server；SSE 走 streaming helper（`streamSSE`）；SPA 静态同源托管（02/A1） | hono **4.13.8** / @hono/node-server **2.1.1** | 沿用 | 旧 stack 决议平移：SSE 一等支持、zod 集成；**无 WS 库**——02/A1 已锁全 SSE |
| DB | SQLite：better-sqlite3 + Drizzle ORM（schema-as-code + migration 进 repo） | better-sqlite3 **13.0.3** / drizzle-orm **0.45.2** / drizzle-kit **0.31.10**(dev) | 锁定 | 官方 DB 黑盒 [设计]；self-host 单机恰配；⌘K 搜索（02 §6.3 LIKE）、tokenUsage 记账、transcript 查询都要 SQL 面；`node:sqlite` 仍 experimental（旧 stack 拒入生产路径的判定延续）；Postgres 对单用户 self-host 过重 |
| schema 面 | = 02 §6.2 record 形状 + §1.3 数据所有权的投影（表清单 §6） | — | 沿用 | 字段即契约，schema 不发明新形状 |
| git 服务端 | `GitOps` wrapper spawn 系统 git：`git http-backend`（CGI env + stdio 管道，托管 repo 远端 URL 形状 = 02 §3）+ bare repo 读树/单文件（`ls-tree`/`cat-file`，服务 `tree?ref=`/`file?path=&ref=` 端点） | — | 锁定 | 前置条件「系统 git ≥ 2.x」写安装文档；isomorphic-git 无 http-backend/worktree 面出局；simple-git 覆盖面不足仍须裸 spawn，多一层 pin 无收益 |
| 密钥 at-rest | `SecretBox`：node:crypto **AES-256-GCM**；keyfile = `crypto.randomBytes(32)` base64、权限 0600、首次启动生成（02 §8 已锁「不引外部 KMS/口令派生」）；信封 = `v1` 版本头 + iv + ciphertext + authTag；加密对象 = provider key、team secret 值、git 凭证；apiKey/machine token 存哈希不入 SecretBox（02 §8） | — | 锁定 | keyfile 丢失 = 存量 provider key 报废需重录——文档护栏照 02 §8 原话 |
| 定时 | `Scheduler`：cron-parser 纯解析 + 自建调度循环（词表照抄 02 §9.2：每小时/每天/每周/单次、分 00/15/30/45 四档、tz = 内置 `Intl.DateTimeFormat().resolvedOptions().timeZone`、`once` 触发后出队） | cron-parser **5.10.1** | 沿用 | 承旧（croniter 对应物）；调度语义 02 已锁 |
| MCP server 面 | `/api/mcp` 端点用 @modelcontextprotocol/sdk（server 侧）；24 工具白名单 + key 级授权 = 02 §7.2 | @modelcontextprotocol/sdk **1.30.0** | 沿用 | 00/D4 薄桥归属的 server 半 |
| validation | zod 4（record 形状 schema 落 shared，双端消费） | zod **4.6.5** | 沿用 | 旧 stack 决议平移 |
| config | 自建分层 `Settings`（§3 缝；zod schema + 加载器 <200 行）；env 前缀 = 品牌位→#44 | — | 沿用 | 承旧 |
| 日志 | pino + pino-pretty(dev)；server 结构化 JSON；`daemon.log` 行形在 daemon 侧（§4.3） | pino **10.3.1** / pino-pretty **13.1.3**(dev) | 沿用 | 承旧 |
| 认证 | 无 auth 库：单用户 seed + 自动登录（02/A2），httpOnly cookie 自设；apiKey Bearer（MCP 面）与 machine token 校验 = 哈希比对 | — | 沿用 | 02/A2 已锁形状 |
| 数据目录 | server 数据根（DB 文件 + keyfile + bare repo 存储）路径 = 品牌位→#44 | — | 移交 | 形状：单一数据根，备份 = 拷目录 |

### 4.3 executor daemon（apps/daemon）

| 项 | 决策 | pin | 类型 | 理由 / 观测栈注记 |
|---|---|---|---|---|
| 发行 | 纯 JS npm 包：esbuild bundle 单文件 + node shebang，`npm i -g` 装；**不复刻平台二进制** | esbuild **0.28.2**(build) | 锁定 | 官方 275MB/6 平台二进制（r3 §1.1）[推断] = `tds-tunnel`(tsnet) + 防睡栈——tunnel 已挂雾（02 §9.3），防睡用平台命令表 spawn（darwin `caffeinate -i`；linux `systemd-inhibit` **[推断]** 可缺省）；差异注记 §8 |
| CLI | commander（命令面照抄 02 §5.1：`start/stop/restart/logs [-f]/logout/status/version/provider`）+ @clack/prompts（交互注册流 02 §5.2 路径一） | commander **15.0.0** / @clack/prompts **1.8.1** | 沿用 | 承旧；`provider` 命令仅提示文案（r3 实测语义） |
| supervisor | 自建：detach spawn + `daemon.json{pid,startedAt,runner}`（02 §5.3 形状）+ 崩溃保活重启，~100 行 | — | 锁定 | 02 §5.1「detached + supervisor 跨崩溃保活」的实现形 |
| 执行引擎 | pi 单引擎（00/D1）：`@earendil-works/pi-ai` / `pi-coding-agent` / `pi-agent-core`，AgentSession 稳定面（00/D3）；经 `AgentBackend` 缝消费（§5） | **0.85.1**（D6 canon；0.86.0 已发布，待首个升级窗口，§9） | 沿用 | 官方 executor = pi 0.84.3 构建（r3 §1.5 明文）——同族同型，pin 高两档 |
| worktree/git | `GitOps` wrapper（与 server 共缝，shared 定义 daemon 实现）：词表 = 02 §5.5 全表（add -b/reused/reset --hard+clean -fd/remove --force+prune+branch -D/TTL 7×24h/projectLock/diverged 护栏/每步 push/merge --no-edit） | — | 沿用 | 系统 git 前置同 §4.2 |
| MCP client 面 | @modelcontextprotocol/sdk（daemon 侧薄桥，00/D4）：per-turn 连接已授权 server、失败降级不阻断（02 §7.1 canon 行为）、工具名 `mcp__<slug>__<tool>` | 同 1.30.0 | 沿用 | 桥归 daemon：回合在 daemon 内跑 |
| HTTP 客户端 | 内置 fetch + undici（`EnvHttpProxyAgent` honor `HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY`）；启动探测代理并打印、代理死持续重试不退出（形状保形 r3 §1.5） | undici **8.10.2** | 沿用 | 承旧 fetch+undici 路线；重试预算数值照 02 §5.5 表 |
| 步骤 journal | outbox/ + heartbeat/tool/done/upload-urls/token 端点词表照 02 §5.4；持久化 = 文件（daemon 本地状态无 SQL 需求） | — | 沿用 | 02 §1.3 数据所有权已锁 |
| 本地状态 | `machine.json`/`device.json`/`daemon.json`/`daemon.log` 形状照 02 §5.3（目录/前缀品牌位→#44）；`daemon.log` 行前缀词表 `supervisor/machine/step/workspace/recover/wake` 照抄，pino 自定义 transport 输出行形 | — | 沿用 | 日志形状 = 平价面（r3 实测词表） |
| 流超时 | `streamFirstEvent 300000 / streamIdle 480000 / streamBodyTimeout 540000` ms 照抄（r3 bundle 原文） | — | 沿用 | 02 §5.6 已收录 |
| 自定义工具 | `web_fetch`（≤8000 字符）/`remote_shell`/`push_branch` 三件 + 记忆工具（02 §4.4；r5 §6 改判名 `save_memory` 族，经 remoteTools relay 服务端执行，原 `remember` 名作废——M4b 落地）；描述 canon 照 r3 | — | 沿用 | pi 内建工具面之外的宿主增量 |

### 4.4 shared（packages/shared）

| 项 | 内容 | 类型 |
|---|---|---|
| 协议词表 | 02 §5/§6 端点 + record 形状 + SSE 事件词表的 zod schema/TS 类型单一来源；双端（server/daemon/web）消费 | 沿用（02/A9 canonical） |
| 命名常量表 | 02 §5.8 品牌槽集中为常量模块，改名 = #44 一次性替换 | 沿用 |
| AgentBackend 缝 | §5 签名；pi 实现落 daemon，接口落 shared | 锁定（00/D1 移交闭环） |
| GitOps / Settings / SecretBox / Scheduler 缝 | 接口定义落 shared，实现各归其端 | 锁定 |

### 4.5 工具链

| 项 | 决策 | pin | 类型 | 理由 |
|---|---|---|---|---|
| TypeScript | 7.0.2 全线；ESM nodenext + strict 全配置保持 | typescript **7.0.2** | 沿用 | #104 兑现：vitest 5 / drizzle-kit 0.31 / @vitejs/plugin-react / biome 与 TS 7 原生编译器共存核实全绿；i18n 门改用 `typescript/unstable/ast` scanner（旧 JS parser API 已随原生编译器下线） |
| lint/format | Biome 单工具（lint+format）；prettier 不引入；类型检查 = tsc | @biomejs/biome **2.5.14** | 沿用 | 承旧；复刻项目无历史规则包袱 |
| 单测 | vitest projects 模式：每包 test/ colocated，根 projects 汇总 | vitest **5.0.1** | 沿用 | 承旧 |
| E2E | playwright：关键流 = 02 §4.2 主时序全链（建 todo→开始→confirm→building→review→merge→done）+ 定时触发 + ⌘K | @playwright/test **1.63.0** | 锁定 | 主时序是功能平价的脊柱；**像素 diff 工具不入本册**——地图雾「像素平价验收工具」待 UI 规格切分票 graduate（§9） |
| 包管理 | pnpm workspaces + catalog；`--frozen-lockfile` CI 门禁 | pnpm **12.5.1** | 沿用 | 承旧 |
| CI 门禁 | Node 22/24 双矩阵 + biome ci + tsc + vitest + playwright + engines 检查 | — | 沿用 | 承旧 §5.2 |

## 5. AgentBackend 缝签名（00/D1 移交项闭环，**锁定**形状、实现期可精化字段）

```ts
// packages/shared/src/agent-backend.ts —— 事件词表 = 02 §5.6 pi 词表 1:1，不得增删改名
export type StepEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'thinking_delta'; text: string }
  | { type: 'toolcall_end'; call: ToolCallRecord }
  | { type: 'message_update' | 'message_end' | 'message_stop'; message: MessageRecord }
  | { type: 'compaction' | 'compaction_start' | 'compaction_end' }
  | { type: 'auto_retry_start' | 'auto_retry_end'; attempt: number }
  | { type: 'steer'; text: string }
  | { type: 'done'; usage: TokenUsage }
  | { type: 'error'; error: { message: string; retryable: boolean } };

export interface AgentBackendCapabilities {
  readonly name: string;                    // 'pi'
  readonly thinkingLevels: readonly string[]; // 配置面「思考强度」（02 §6.2 agent 形状）
  readonly oauthProviders: readonly string[]; // anthropic/openai-codex/github-copilot/xai（#34 锁定订阅项）
  readonly compaction: boolean;
  readonly sessionResume: boolean;          // continue session（合并轮复用，02 §4.2）
}

export interface SessionOpts {
  provider: ProviderConfig;   // kind: api_key | oauth | http（02 §5.6 配置 kind）
  modelId: string;
  thinkingLevel?: string;
  systemPrompt?: string;      // memory 注入经 pi before_agent_start 缝（00/D3、02 §4.4）
  tools?: ToolSpec[];         // web_fetch / remote_shell / push_branch / remember（宿主增量）
  mcpServers?: McpEndpoint[]; // per-turn 连接、失败降级不阻断（02 §7.1）
  cwd: string;                // worktree 目录（02 §5.5）
}

export interface AgentSessionHandle {
  readonly events: AsyncIterable<StepEvent>;
  steer(text: string): Promise<void>;
  stop(): Promise<void>;
  usage(): TokenUsage;        // build × model × {输入,输出,缓存读,缓存写}（02 §6.2）
}

export interface AgentBackend {
  readonly capabilities: AgentBackendCapabilities;
  createSession(opts: SessionOpts): Promise<AgentSessionHandle>;           // new session <convId>
  continueSession(id: string, opts: SessionOpts): Promise<AgentSessionHandle>; // continue session <convId>
}
```

缝纪律：daemon 内 pi 实现类之外，任何模块不得 import `@earendil-works/*`（lint 规则）。第二引擎将来 = 新增一个 `AgentBackend` 实现，事件面/能力面不动（00/D1「bolt-on 非重写」兑现）。

## 6. 存储 schema 面（02 §6.2 投影，**锁定**清单；列细节 = 实现期按 record 形状展开）

`user`（seed 一行）· `team`（seed 一行，含 `plan` 字段形状不参与门控 02/A3）· `project`（repo 形态字段：托管 bare / GitHub 接入，02/A4）· `todo`（§4.1 字段表全量）· `tag` + `todo_tag` · `build`（`buildId ≡ conversationId`，CONTEXT.md）· `step`（三类步队列 + journal 状态，02/A6；M4a：`buildId` 去 FK 兼作 chief conv id `chief-<threadId>`、`kind` 增 `chief`、增内部列 `prompt` = 续轮指令）· `message`（transcript 消息/工具行，经 upload-urls 回传落库）· `plan`（build facet：版本 v1/v2 + Context/Changes/Edge cases/Verification 卡）· `document_diff`（`documents/{id}/diff` 端点源）· `schedule`（02 §6.2 形状，kind 枚举含 [推断] 词）· `notification`（02 §9.1 五事件矩阵 [推断]）· `agent`（含 6 工具开关/secrets/skills/mcpServers 关联表）· `agent_memory`（02 §4.4 条目集）· `skill`（含文件内容，`skills/{sid}/file` 端点源）· `mcp_server`（02 §6.2 形状；**M4b 回写补录**：wire record 保 r3 §5.1 原样，stdio 命令/参数与 http 请求头值 wire 未采 [推断] → 增内部列 `command`/`args`/`headersCipher`（headers 密文经 SecretBox，值只写不读、`credentialKeys`=头名清单，02 §8 凭证纪律同族））· `provider`（38 presets + custom，apiKey 密文经 SecretBox）· `secret`（值密文经 SecretBox，只写不读）· `api_key`（哈希 + gitAccess/mcpAccess/toolGrants 白名单，02 §6.2）· `machine`（02 §6.2 + presence 状态）· `token_usage`（build×model 四维计数）· `chief`（**M4a 回写补录**：02 §4.3/r5 §3.6 `GET /chief` 的 chief 记录本体——绑定 Agent/charter/watches/wakes 的持久位；原清单仅列线程面两表，记录本体无表位，M4a 补 `chief` 单行表，watches/wakes 为 per-chief JSON 列 [设计]）· `chief_thread` + `chief_message`（02 §4.3 线程面）· `whats_new`（形状保留内容自选，02 §6.1）。

migration 纪律：drizzle-kit 生成、进 repo、CI 校验 drift；**不发明 02 之外的字段形状**——协议面字段即契约（02/A9）。

## 7. 验收要点（供 #45 ROADMAP 汇入）

1. **engines 门禁**：CI Node 22.19+/24 双跑，24 为主（承旧）。
2. **pi pin 纪律**：`@earendil-works/*` 全 patch-pin 0.85.1；升级 = 显式窗口读 Breaking 段（0.86.0 为首个窗口候选）。
3. **缝纪律**：五个接口缝（AgentBackend/GitOps/Settings/SecretBox/Scheduler）之外直接 import 被包依赖 = lint 红。
4. **协议对拍**：shared 词表 schema 快照测试 vs 02 §5/§6 表；E2E 主时序全链（02 §4.2）为功能平价脊柱。
5. **像素对拍**：靶索引 = r1（landing 41 路由 + CSS/字体原件）、r2（19 路由 63 截图）；diff 工具归雾票，本册只锁「对拍义务存在」。
6. **i18n 分层验收**：landing 四语逐页对照 r1 `i18n-*.txt`；docs en/zh-CN；workspace zh-CN canon 逐条对照 r2/r3 文案表。
7. **PWA 字节级**：manifest/sw.js 与 r1 抓包原件 diff = 仅品牌槽差异。
8. **通知/OS 弹窗**：真人各一次（02 附验收提示沿用）。

## 8. 差异注记汇总（S1 义务履行：决策 vs 观测栈）

| 面 | 观测 | 决策 | 性质 |
|---|---|---|---|
| landing 框架 | Next.js App Router SSG | Vite SPA（与 workspace 同应用） | **差异**：官方双栈异构 → 复刻统一单 SPA；无 SEO 诉求，SSG 不保 |
| workspace 框架 | RNW/Expo [推断] | React 19 + Radix + Tailwind | **差异**（00/D5 已锁）；RNW 不复刻 |
| landing CSS | Tailwind 3.4.19 | 同版 | 同栈 |
| 主题/色板/字体 | 深色默认 `.light` 反相、zinc/stone/indigo、Inter+JBM、CJK 无 webfont | 逐项照抄（§4.1） | 同栈 |
| 实时面 | 全 SSE 无 WS | 同 | 同栈（02/A1） |
| executor 发行 | npm -g 275MB、6 平台二进制 | 纯 JS npm 包 | **差异**：二进制栈 [推断] = tunnel/防睡，tunnel 挂雾不复刻 |
| executor 引擎 | pi 0.84.3 | pi 0.85.1（D6 pin） | 同族，pin 高两档 |
| runtime | Node [推断] | Node 24 LTS | 近似同栈 |
| DB / server 框架 / 状态库 / markdown 栈 | 不可观测 | SQLite+Drizzle / Hono / TQ+Zustand / streamdown | **[设计]**：无对照物，验收走行为/像素靶 |
| 未匹配路径 | 307 → `/login?callbackUrl=` | 重定向 `/app`（无登录页，02/A2） | **差异** [设计] |
| 语音输入按钮 | 存在（r2 工具条），实现未观测 | Web Speech API [推断] | 形状平价、行为尽力 |

## 9. 移交与观察项

| 项 | 去向 |
|---|---|
| 图标字形提取（登录态抓 workspace bundle/SVG）、字体 woff2 与位图图标下载、emoji 常用网格子集、PWA 品牌槽替换 | **#44 素材清单增补** |
| 像素 diff 验收工具与逐屏 UI 规格切分 | 已落地：#53 parity harness 建成，验收规则正典 = 04 册 §2（本册 §7.5 对拍义务已兑现） |
| pi 0.86.0 升级窗口评估（读 Breaking 段） | 首个 D6 升级窗口；排期 = 03 册 §3（M3 期间） |
| TS 7.0.2 / react-router 8.4.0 / Tailwind 4.x 升级票 | 复刻验收后各自成票（承旧「升级票」纪律）；节奏 = 03 册 §3（M6 后） |
| turbo 引入 | CI 时长成痛点时触发（承旧） |
| transcript 虚拟滚动（@tanstack/react-virtual 候选） | 实现期按实测定，不预锁 |
| `preview-token`/`tds-tunnel` | 02 §9.3 在册不设计；触发条件 = 04 册附录 B |
| daemon 防睡 linux 路径（`systemd-inhibit` [推断]） | 实现期按平台实测 |

## 10. 对下游票的影响

- **#45 ROADMAP**：已完成（2026-09-22）——§7 验收要点汇入 04 册；§9 升级窗口/升级票节奏汇编入 03 册 §3；构建顺序按 §3 包切分落 03 册 §2（两线并行，后端段 shared → server → daemon → 编排）。
- **#44 发布与素材**：§9 素材清单增补四项；02 §5.8 + 本册品牌位（localStorage 前缀、env 前缀、数据目录、包名）一次性替换面完整。
- **#42 原型双屏**：前端栈即本册 §4.1（React 19 + Tailwind 3.4.19 + Radix + TQ），原型可直接按 pin 表起。
- **#46 Chief 实验**：Chief = 挂团队工具的 pi 会话（02 §4.3），跑在 `AgentBackend` 缝上，实验产物回填不改本册。
