# r1-site-inventory — todos.dev 公开站全量盘点（页面/文案/设计 token/PWA/定价边界）

- 票：xiechimon/pacman #35（研究）。目的：为像素级复刻提供公开素材正典。
- 抓取时间：2026-09-18 20:44 → 2026-09-19 05:09 UTC（单次会话内完成，站内容器版本未变：CSS/JS 文件名 hash 全程一致）。
- 方法：`curl` 直抓 HTML / CSS / JSON 源文件 + 自写 Python 解析器（`.crawl/`，未入库）。UA 固定 `Chrome/129 macOS`。未使用第三方阅读器，未访问任何登录后页面。
- 引用约定：`[文件]` = 本票 `docs/research/assets/r1/` 下**已入库**的快照（见 §0 索引表）；`URL` = 一手出处；`[pricing.html]`、`[home.html]`、`[docs_*.txt]` 等指的是**抓取产物名**，未入库但可按对应 URL 原样重取（docs 正文另含在已入库的 `[llms-full.txt]` 内）；**【推断】** = 无直接出处、由素材推得的判断。
- 范围外：`/app/**`、`/api/**`、`/qr`、`/enroll`、`/invite`、`/_mp`（robots 禁止且需登录，另有票负责）。

## 0. 素材快照索引（`docs/research/assets/r1/`）

| 文件 | 内容 | 大小 |
|---|---|---|
| `f965382e067739e9.css` | 主样式表全量（含全部主题 token） | 91,274 B |
| `71fd990866a15643.css` | 字体样式表（2 个 `@font-face` + metric override） | 859 B |
| `manifest.webmanifest` | PWA manifest 全量 | 1,146 B |
| `sw.js` | Service Worker 全量（含设计注释原文） | 3,495 B |
| `favicon.svg` | 站点图标 SVG 源 | 286 B |
| `llms.txt` | LLM 入口索引（57 行，5 组 32 篇 docs + Optional 段） | 5,848 B |
| `llms-full.txt` | **全站文档单文件正典**（en 全 32 篇 docs 合成；实测 3,079 行 / 32 个 `#` 顶级标题） | 311,487 B |
| `sitemap.xml` | 92 URL 全量含 hreflang | 33,721 B |
| `asset-manifest.json` | 二进制素材 URL + HTTP 码 + 字节数 | — |
| `scan-resource-identity.txt` | 163 页资源声明一致性扫描 + docs 翻译矩阵（§4.1/§8 出处） | — |
| `i18n-{landing,features,install,mcp,pricing}.txt` | 5 个营销页 en/zh-CN/zh-TW/ja 逐行四语对照 | — |
| `i18n-docs-matrix.txt` | 32 篇 docs × 4 语翻译状态 | — |
| `i18n-page-inventory.json` | 每页每语字符量统计 | — |

---

## 1. 站点结构与技术栈

### 1.1 已证实的技术事实

| 项 | 值 | 出处 |
|---|---|---|
| 框架 | Next.js（App Router，SSG 预渲染） | `[headers]` `x-powered-by: Next.js`、`x-nextjs-prerender: 1`、`x-nextjs-cache: HIT`、`/_next/static/*` 路径 |
| CDN/DNS | Cloudflare | `server: cloudflare`、`cf-ray`、`nel` 指向 `a.nel.cloudflare.com` |
| CSS 框架 | **Tailwind CSS v3.4.19** | `[f965382e067739e9.css]` 文件头 banner |
| 排版插件 | Tailwind Typography（`--tw-prose-*` 全量 + `prose-invert`） | `[f965382e067739e9.css]` |
| 边缘缓存 | `cache-control: s-maxage=31536000`（1 年） | `[headers]` |
| 本地化 | 预渲染静态页；`/` 由 middleware 重写到 `/en` | `x-middleware-rewrite: /en` |
| 首访埋点 | cookie `tds_ft={"landing_path":"/"} Path=/; Max-Age=7776000`(90d)`HttpOnly; SameSite=lax` | `set-cookie` `[headers]` |
| 语言切换 | 4 语：`en`(无前缀) / `zh-CN`(`/zh`) / `zh-TW`(`/zh-TW`) / `ja`(`/ja`)，`x-default`→en | `<link rel="alternate" hrefLang>`、`[sitemap.xml]` |

`robots.txt` 的 `Disallow` 列表本身即泄露了应用内路由面（复刻时用于对齐 URL 形状）：
`/api/  /app/  /admin/  /embed/  /invite/  /enroll/  /qr/  /_mp/` — `[robots.txt 抓取]`

### 1.2 公开页面全集（去 locale 后 **41** 条路由）

营销面（4 语全覆盖，6 页）：`/`、`/features`、`/install`、`/pricing`、`/mcp`、`/docs`
法务面（**仅英文正文**，见 §8）：`/privacy`、`/terms`
登录面：`/login` —— **不在 sitemap 内**（实测 0 条），与 changelog 2026-09-06「ログイン・アップグレードなどのページは robots で noindex に」一致
Docs 面（32 页，见 §7.1）：`/docs/{overview,install,quickstart,concepts,todos,chief,agents,conversation,plans-and-diffs,ai-review,skills,memory,context,schedules,inbox,mobile,teams,projects,platform-git,machines,platform-machines,providers,mcp-servers,secrets,permissions,remote-shell,cli,mcp,api-keys,github,troubleshooting,changelog}`

`[sitemap.xml]` 共 **92** 条 `<loc>`，按 locale 分布 = en 40 / zh 38 / zh-TW 7 / ja 7。三处不完整，复刻时按 URL 形状直连而非依赖 sitemap：
1. **zh 侧缺法务**：`/zh/privacy`、`/zh/terms` 返回 200 但不在 sitemap（故 zh=38 而非 40）。
2. **zh-TW/ja 侧只有 7 条**：6 个营销页 + `/docs/changelog`；其余 31 篇 `/zh-TW/docs/*`、`/ja/docs/*` 实际存在且 HTTP 200，但被有意排除（原因见 §8 引文与 §7.3 末）。
3. docs 正文在 sitemap 内只出现 **64 条** = en 32 + zh 32，正好对应 §8 的「只有 zh-CN 全译 docs」。

### 1.3 路由与 404 规则（实测，复刻必须照搬）

| 请求 | 结果 | 实测 |
|---|---|---|
| `https://todos.dev/` | 200，服务端 rewrite 到 `/en` 渲染 | `x-middleware-rewrite: /en` |
| `/en/pricing` | **308 → `/pricing`**（附 `refresh: 0;url=/pricing`） | 实测 |
| `/zh/ja/pricing`（二级 locale） | 404，返回空壳 HTML | 实测 |
| `/fr/pricing`（不支持的 locale） | **307 → `/login?callbackUrl=%2Ffr%2Fpricing`** | 实测 |
| 任意未知顶层路径（`/nonexistent-xyz`、`/random-a1b2c3`、`/app/dashboard`） | **307 → `/login?callbackUrl=<原路径>`** | 实测 |
| `/compare`、`/use-cases` | **404**（30 KB 空壳） | 实测 |
| 404 页本体 | SSR body 为空，仅 `<title>Todos</title>`；错误界面纯客户端渲染 | 抓取 `compare.html`：`<body>` 去 script 后 62 B |

规则总结：**已知营销/docs 路由 → 静态渲染；`en` 前缀 → 308 去前缀；其余一切未匹配路径 → 307 到 `/login?callbackUrl=`**（即未匹配路径被当作应用路由兜底给登录）。真正 404 仅出现在「已注册路由 + 该路由无内容」（`/compare`、`/use-cases`）与多级非法 locale。

【推断】`/compare`、`/use-cases` 目前是 404 但已在路由表内占位——changelog 2026-09-06 原文称二者「Markdown コレクションとして収録し、最初のエントリをドラフトで公開」（作为 Markdown 集合收录，首条以草稿发布）[ja changelog]，与「路由存在、内容未发布」一致。

---

## 2. Landing（`https://todos.dev/`）

### 2.1 关于票面「菜单」的关键纠正

票面提示「Open the menu to browse the other pages / Click any icon to open its page」并推测其为菜单入口。实测结论相反：

**这两句话是 hero 区应用内 demo mock 的提示文案，不是站点导航。** 该 mock 内的全部条目都是 `<button>`，**零个 `<a href>`**——在含此文案的 HTML 区间（offset 240000–265000）内实测 `anchors: 0 / buttons: 6`，其余 sidebar 行同样是 button。整页真实可点的站内链接只有 8 条：`/`、`/features`、`/install`、`/docs`、`/pricing`、`/login`、`/privacy`、`/terms`（`[home.html]` 全量 href 去重实测）。

所以「菜单内全部页面」的正解是 **§1.2 的 40 条路由**，而非某个隐藏子页集合。下面把 mock 的内容结构完整记下，因为它本身就是要复刻的 UI。

提示文案两语分支（响应式，非 i18n 分支）：`<span class="md:hidden">` = "Open the menu to browse the other pages"；`<span class="hidden md:inline">` = "Click any icon to open its page"。即窄屏才说"打开菜单"。

### 2.2 Hero 应用 mock 的结构（desktop ≥768px 常驻；窄屏为左滑 drawer `<aside class="w-60">`）

- 团队名 `Avery's team`；侧栏行：`Search` / `Kanban`(badge 5) / `Schedules` / `Projects`(可展开) / `Resources`(可展开)
- 「Go to」命令面板项（7 个）：`Kanban` `Schedules` `Team` `Skills` `MCP` `Secrets` `Providers`
- 看板 6 列（列名+计数，与 §6/§7 的 9 阶段模型不同口径）：`Backlog 6` `Planning 2` `To confirm 1` `Building 3` `To review 4` `Done 5`
- 项目分组 `Inkwell` / `Pulse`，卡片编号 `#151–#201`，角色标签 `Frontend engineer` `Backend engineer` `DevOps engineer`
- 每列卡片带相对时间（`20 minutes ago`…`14 days ago`）与动作按钮 `Start` / `Confirm` / `Done`
- Agent 头像字体许可内嵌于 DOM：Lorelei / © Lisa Wischofsky / Figma community file `1198749693280469639` / CC0 1.0（全页重复 ~40 次，属真实站点行为，复刻需保留该 attribution）

### 2.3 Landing 正文区块顺序与核心文案（en 原文，四语对照见 `[i18n-landing.txt]`）

1. Header：`Features · Get the app · Docs · Pricing` + 语言切换（`EN`/`简`/`繁`/`日`）
2. Hero H1：`The task-driven workspace` / `for humans and agents.`
3. Hero lede：`Todos is a task-driven workspace. Humans and agents collaborate efficiently in one space to reach the goals you set.`
4. 「为什么任务驱动」4 条（lede：`Why task-driven? The todo is the best unit of work for collaboration between humans and agents.`）：
   `Better quality` / `Easy to track` / `Easier to evaluate` / `Built for collaboration`
5. 「支柱」4 条（lede：`The workspace for the AI era. Todos designs the workflow that best fits how humans and agents work together.`）：
   `Shared space` / `Agent team` / `Orchestration` / `Across machines`
6. FAQ（**9 问**，原文全文见 `[i18n-landing.txt]`）：工作类型 / 如何编排 / 是否支持手机 / 与 Claude·Codex 的差异 / 可连哪些模型 / **能否用 ChatGPT·Codex·Copilot 订阅** / **定价与模型调用费用** / executor 机器要求 / 代码与构建在哪跑
7. 收尾 CTA：`Your workspace is ready.` + 按钮 `Open Todos`
8. Footer：`Sign in · Pricing · Docs · Changelog · Privacy Policy · Terms of Service` + `© 2026 Todos`

三条与定价边界直接相关的 FAQ 原文（务必照抄，§6 要核对）：
- `Which models can it connect to?` → "Todos supports **700+ models from dozens of providers** — Anthropic, OpenAI, Deepseek and the rest — local models included."
- `Can I use a ChatGPT, Codex, or Copilot subscription?` → "Yes. Besides API keys, you can **sign in to connect a ChatGPT/Codex, GitHub Copilot, or XAI subscription**."
- `How does pricing work, and what do model calls cost?` → "The **Free plan supports BYOK and BYOC and is free forever**. On Pro, **built-in models and the cloud sandbox are billed at the provider's own rates, with no markup**."

页面 `<title>` = `Todos — The task-driven workspace for humans and agents.`；`og:image` = `https://todos.dev/og.png`(1200×630)。

---

## 3. 其余公开页

### 3.1 `/features` — **21 条功能卡**（h3），区块标题 `Core features`

无分组，纯「标题 + 一句说明」列表，顺序即视觉顺序（全文见 `[i18n-features.txt]`）：
`Agent chief` `Parallel delivery` `Scheduled runs` `MCP integration` `Live preview` `Independent agent review` `Chief supervision` `Plan-then-build mode` `BYOC & BYOK` `Runs across machines` `Team composition` `Anywhere, anytime` `Third-party MCP servers` `Fine-grained permissions` `Voice input` `Skills library` `Change review` `Plan versions` `Transparent usage` `Run history` `Full audit trail`

（实测 22 个 h2/h3 标题 = 上述 21 个 `h3` + 收尾 CTA 区的 `h2 Your workspace is ready.`）

两条含实现细节的原文（复刻需按此对齐行为）：
- Voice input：`Dictate into any text box, powered by Doubao speech recognition.`（语音输入后端 = 豆包语音识别）
- Scheduled runs：`Run routine agent tasks on a schedule, with an email alert if a run fails.`（失败走**邮件**告警，非 push）

### 3.2 `/install` — 移动端 PWA 落地页，H1 `Build from anywhere`

结构：H1+lede → 一个**滚动驱动的脚本化对话时间轴 demo**（时间点 `00:00 09:15 11:30 12:05 12:40 14:10 16:20 17:05 17:30`）→ 4 张能力卡 → PWA 安装卡。

时间轴 demo 是最高价值的应用行为语料（全 4 语逐条对照，见 `[i18n-install.txt]`），完整讲了一个「博客 PoC」案例：
- 用户一句话目标 → Chief 拆 3 个并行 todo `#151/#152/#153`，各自绑角色（Frontend/Backend/DevOps engineer）
- 进度播报用 emoji 前缀：`🔀 On it:`（拆分）→ `🔄`（进行中/返工）→ `✅`（过审/合并）→ `🚀 We're live!`（上线）
- 评审会抓出问题并自动派回原作者：`review caught something: it misses HTML escaping. The backend engineer is patching it.`
- 实时预览报 URL：`Preview's running at localhost:4321`
- 用户口头反馈 → Chief 再拆分并按角色分派 → 复审通过 → 询问 `Want me to ship it?` → 用户 `Ship it.` → `inkwell.blog is up`

4 张能力卡：`Capture ideas by voice` / `Never miss a notification` / `The full Todos experience` / `Put Todos on your Home Screen`
PWA 安装卡文案：`Todos` / `Todo-driven vibe coding` / `Todos opens in its own window, with notifications and an icon of its own.` / `Click the install icon at the end of the address bar`（用 `<img src="/icon-192.png" class="w-12 h-12 rounded-xl ring-1 ring-line">` 示意）

### 3.3 `/mcp` — 公开 MCP 接入页（营销页，非 docs）

H1：`One to-do list shared by every coding agent`。三步骤：Create an API key → Point at the server → Paste the config。
- **端点**：`https://todos.dev/api/mcp`（实测 HTTP 401 `application/json`，24 B — 未鉴权的真实 MCP 入口）
- 鉴权：`Authorization: Bearer tds_<key>`；key 从头像菜单 → API keys 创建并勾选 MCP 访问，**只显示一次**
- 明确「**No OAuth dance, nothing to install**」
- 配置块原文（`mcp.json`）：`{"mcpServers":{"todos":{"url":"https://todos.dev/api/mcp","headers":{"Authorization":"Bearer tds_your_key"}}}}`
- 兼容性注记原文：VS Code 用 `servers` 而非 `mcpServers`；**"Browser connectors that only support OAuth cannot use a key"**（只支持 OAuth 的浏览器连接器无法用 key）
- 连接后能力 6 组：`Read the board` / `Read the repo`(GitHub issue·PR·CI，issue 可直转 todo) / `Capture todos` / `Follow progress` / `Dispatch work` / `Run the lifecycle`(done/close/reopen)

### 3.4 `/docs` — 文档站首页（见 §7.1）

### 3.5 `/privacy`、`/terms` — 法务页

`/privacy` 正文 9,474 B、`/terms` 11,142 B（英文，`[i18n-page-inventory.json]`）。四语 URL 均 200 但**正文不翻译**（§8）。changelog 称法务页改为「ドキュメントレンダラー経由（実アンカーを獲得）」= 走 docs 渲染器以取得真锚点。

### 3.6 `/login`（公开可渲染，未做任何登录后访问）

文案：`Sign in to Todos` / `Sign in or create your account to continue.` / 二维码分支 `Scan with a phone signed in to Todos to sign in here.` + `New phone? Scan, sign in, then add Todos to your Home Screen.` / 分割线 `or` / `GitHub` `Google` / `Use an email code instead` / `Continue with GitHub` `Continue with Google` / `<> Email me a code` / 免责句 `By signing in, you agree to the Terms of Service and acknowledge the Privacy Policy.`

登录方式共 4 类：**扫码、GitHub、Google、邮箱验证码**。注意：§6.3 的 OAuth 是「连模型订阅」的另一套 OAuth，与此处账号登录无关。

---

## 4. 设计 token

### 4.1 字体（HTML preload 全量，共 **2** 个 woff2）

一致性实测（`[scan-resource-identity.txt]`，覆盖全部 163 个已抓页面）：**160 个内容页的 preload 字体集与 CSS 链字节级完全一致**（同一对 woff2 + 同一对 css）。3 个例外，规律清晰：

| 页 | woff2 preload | CSS link | 说明 |
|---|---|---|---|
| `/login` | **0 个** | 2 个（同全站） | 登录页不预载字体，只挂样式表 —— 独立极简 shell，`<title>Sign in to Todos` |
| `/compare`（404 空壳） | 0 | 0 | 404 页无任何资源声明 |
| `/zh/ja/pricing`（404 空壳） | 0 | 0 | 同上 |

`theme-color = #18181b` 与 `manifest href = /manifest.webmanifest` 则在**全部 163 页一致**（含 404 空壳与 /login）。

| 用途 | family | URL | 实际字节 | 权重范围 | `font-display` |
|---|---|---|---|---|---|
| 正文/UI | `inter` | `/_next/static/media/6c596dfcddeca1e9-s.p.woff2` | 48,256 | **variable 100–900** | `optional` |
| 等宽 | `jetbrainsMono` | `/_next/static/media/a865edea076e0166-s.p.woff2` | 40,404 | **variable 100–800** | `optional` |

`[71fd990866a15643.css]` 全文仅 859 B，内容就是这两个 `@font-face` + Arial 兜底度量覆写 + 两个 CSS 变量：

- `inter Fallback`：`local("Arial")`，`ascent-override:89.79%` `descent-override:22.36%` `line-gap-override:0.00%` `size-adjust:107.89%`
- `jetbrainsMono Fallback`：`local("Arial")`，`ascent-override:77.57%` `descent-override:22.82%` `line-gap-override:0.00%` `size-adjust:131.49%`
- 暴露变量：`--font-inter:"inter","inter Fallback"`、`--font-jetbrains-mono:"jetbrainsMono","jetbrainsMono Fallback"`

最终字体栈（`[f965382e067739e9.css]` 实测两条）：
- 正文 `var(--font-inter),-apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue",Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji"`
- 等宽 `ui-monospace,JetBrains Mono,Fira Code,Menlo,Monaco,Consolas,monospace`

**关键复刻约束**：中文/日文**没有任何 CJK webfont**——四语页面 preload 的字体文件集完全相同（`[scan-resource-identity.txt]`），CJK 全靠系统字体 + emoji 字体族兜底。changelog 2026-09-08 亦记「The web font stack gains the colour emoji families so the glyph renders the same on every platform」（为 topic emoji 图标加入彩色 emoji 字体族）。

### 4.2 配色：默认深色，`.light` 类切浅色

`<meta name="theme-color" content="#18181b">` + `<meta name="color-scheme" content="dark light">`。**深色是 `:root` 默认态**，浅色靠根元素挂 `.light` 类；Tailwind 侧用 `dark:` 变体的反相实现——所有 `dark:*` 工具类的选择器编译为 `.dark\:xxx:where(:not(.light):not(.light *))`（`[f965382e067739e9.css]`）。复刻时不要按「默认浅色 + dark: 前缀」的常规做法。

完整 token 表（`[f965382e067739e9.css]` `:root` / `.light` 两个块，逐条实测）：

| CSS 变量 | dark（`:root`） | light（`.light`） |
|---|---|---|
| `--surface` | `#18181b` | `#faf7f2` |
| `--surface-secondary` | `#1f1f23` | `#f2ede6` |
| `--surface-tertiary` | `#27272a` | `#e8e2d9` |
| `--surface-inset` | `#09090b` | `#f2ede6` |
| `--surface-elevated` | `#1f1f23` | `#fdfaf6` |
| `--surface-hover` | `#1f1f23` | `#f2ede6` |
| `--text-primary` | `#fafaf9` | `#1c1917` |
| `--text-secondary` | `#d4d4d8` | `#57534e` |
| `--text-tertiary` | `#71717a` | `#78716c` |
| `--text-dim` | `#52525b` | `#a8a29e` |
| `--border-default` | `#27272a` | `#e2dbd1` |
| `--border-strong` | `#3f3f46` | `#cec6bb` |
| `--nav-bg` | `rgba(24,24,27,0.85)` | `rgba(250,250,249,0.85)` |

配色体系判断：深色侧是 **Tailwind zinc 原色阶**（`#18181b`=zinc-900、`#1f1f23`≈zinc-850/900 之间、`#27272a`=zinc-800、`#71717a`=zinc-500、`#fafaf9`=stone-50）；浅色侧是**暖米白/奶油**（stone 偏黄系，非纯白），文字侧落 stone-900/700/500/400。即「深色冷灰 + 浅色暖米」的非对称双主题。

Tailwind 语义色名 → CSS 变量映射（v3 `theme.extend.colors` 反推，`[f965382e067739e9.css]` 工具类定义实测）：

| 工具类 | 编译到 |
|---|---|
| `.text-content` | `var(--text-primary)` |
| `.text-content-secondary` | `var(--text-secondary)` |
| `.text-content-tertiary` | `var(--text-tertiary)` |
| `.text-content-dim` / `.bg-content-dim` / `.fill-content-dim` | `var(--text-dim)` |
| `.border-content-tertiary` | `var(--text-tertiary)` |
| `.bg-line` / `.border-line` / `.ring-line` | `var(--border-default)` |
| `.border-line-strong` | `var(--border-strong)` |
| `.bg-surface{,-secondary,-tertiary,-inset,-elevated,-hover}` / `.border-surface` / `.ring-surface` / `.fill-surface-tertiary` | 对应 `var(--surface*)` |

即三族语义色名：`content`（文字）、`line`（描边）、`surface`（面）。注意**变量名用 `text-*`、类名用 `content-*`**，两套命名不同源，复刻时别写混。

主强调色 = **indigo**（非自定义，走 Tailwind 原色阶）：`bg-indigo-600`(84 次，主 CTA) `text-indigo-600`(44) `text-indigo-500`(40，Pro 勾选) `bg-indigo-500`(28) `bg-indigo-500/10`(16) `bg-indigo-400`(12)；状态色直接用 `rose-500` `amber-500` `green-500` `gray-400` 原色阶。

### 4.3 形状 token：圆角 / 阴影 / 字号 / 间距（全站 HTML `class=` 词频实测，518 个不同类）

圆角（按频次）：`rounded-md` **5594**（绝对主力）· `rounded-xl` 556 · `rounded-full` 340 · `rounded-lg` 200 · `rounded` 148 · `rounded-[3px]` 84 · `rounded-sm` 24 · `rounded-tl-sm` 12 · `rounded-t-2xl` 4 · 手机 mock 外框硬编码 `rounded-[2.8rem]` / `rounded-[2.3rem]` 各 4。

阴影：`shadow-sm` **140** 压倒性主力，`shadow-md`/`shadow-2xl` 各 4；`shadow-lg` 定义了但站点未用。阴影值即 Tailwind v3 默认（`shadow-sm = 0 1px 2px 0 rgb(0 0 0/0.05)`、`shadow-2xl = 0 25px 50px -12px rgb(0 0 0/0.25)`）——**未自定义阴影**。另有 4 处硬编码 arbitrary 阴影用于 hero/手机 mock 的悬浮投影：
`shadow-[0_18px_40px_-8px_rgba(0,0,0,0.28)]`、`shadow-[0_24px_50px_-12px_rgba(0,0,0,0.14)]`、`shadow-[0_12px_32px_-4px_rgb(0_0_0/0.5)]`、`shadow-[0_25px_50px_-12px_rgb(0_0_0/0.35)]`

字号：`text-sm`(14px) **6316**（基准）· `text-[13px]` 1658 · `text-[11px]` 1344 · `text-xs`(12px) 640 · `text-2xl` 192 · `text-[10px]` 156 · `text-[7px]` 84（看板 mock 微缩卡）· `text-[15px]` 64 · `text-3xl` 12 · `text-[9px]`/`text-[14px]` 各 4 · `text-[1.625rem]` 3（H1）· `text-[2rem]` 1。
→ 【推断】正文基准 14px，`13px` 为次级密集文本（列表行/表单），`11px`/`10px` 为 caption 与微缩 mock，营销大标题用 1.625rem/2rem 而非 `text-3xl`。

间距：未见自定义 spacing scale（v3 默认 0.25rem 基准）。高频形状组合实例：pricing 行 `flex items-center gap-2.5 text-[13px]`、drawer `w-60`、图标槽 `h-3.5 w-3.5`、状态点 `h-2 w-2`。

断点（`@media (min-width:)` 实测）：`640 / 768 / 1024 / 1280 / 1536`（即 Tailwind 默认 `sm md lg xl 2xl`，未改）。另有 `@media not all and (min-width:768px)`、`@media (hover:hover) and (pointer:fine)`、`@media (pointer:coarse)`、`@media (prefers-reduced-motion:reduce)`。
**全站动效普遍配 `motion-reduce:` 降级**（如 `motion-reduce:transition-none`、`motion-reduce:animate-none`），这是可复刻的一致性约定。

### 4.4 动画 keyframes 全量（13 个，`[f965382e067739e9.css]`）

Tailwind 内置：`bounce` `ping` `pulse` `spin`。
自定义：`fade-in`(opacity 0→1) · `shake`（10 段 translate3d ±1/2/4px，登录错误抖动）· `robot-eye-l`/`robot-eye-r`（空态机器人眨眼，左右眼交替 opacity 1↔0.12，50% 处互换）· `text-draw`（`stroke-dashoffset:1→0`，35% 后完成）· `hourglass-flip`（0–35% 保持，65%–100% rotate 180°，等待沙漏翻转）
`checkout-*` 4 个（定价/结账页动效）：`checkout-card-tap`(translateX 0→4px→0) · `checkout-wave`(opacity .15→1→.15) · `checkout-draw`(dashoffset 100→0) · `checkout-pop`(scale .92/opacity .6 → 1/1)

→ 【推断】`checkout-*` 前缀表明升级支付走 **Stripe checkout 风格**卡片动画；changelog 2026-09-08 也提到 "the Stripe return reopens it"（Stripe 回跳），二者一致。

---

## 5. PWA

### 5.1 `manifest.webmanifest`（全量，`[manifest.webmanifest]`）

| 字段 | 值 |
|---|---|
| `id` | `/` |
| `name` / `short_name` | `Todos` / `Todos` |
| `description` | 与 landing meta description 同文 |
| **`start_url`** | **`/app`**（不是 `/`） |
| `scope` | `/` |
| `display` | `standalone` |
| `categories` | `["productivity","developer"]` |
| `launch_handler` | `{"client_mode":"navigate-existing"}` |
| `background_color` / `theme_color` | `#18181b` / `#18181b` |
| `icons` | `/icon-192.png`(192) · `/icon-512.png`(512) · `/icon-maskable-192.png`(maskable) · `/icon-maskable-512.png`(maskable)，全 `image/png` |
| `related_applications` | `[{platform:"webapp", url:"https://todos.dev/manifest.webmanifest"}]` |
| `screenshots` | `/screenshots/narrow.png` **780×1688** form_factor `narrow`；`/screenshots/wide.png` **2560×1600** form_factor `wide`；label 均 `Your todos, and the agents working them` |

### 5.2 图标 / splash 集合

- `/favicon.svg`（286 B，源文件已存）：`viewBox 0 0 100 100`，底 `<rect fill="#18181b">`，字 `[t]` 用 `font-family:'JetBrains Mono','Courier New',monospace; font-size:46; font-weight:500; fill:#fafaf9`，`x=50 y=67 text-anchor=middle`。**logo 就是 JetBrains Mono 排出来的 `[t]`，是文本而非路径**——复刻可直接用字体排。
- 位图图标实测字节（`[asset-manifest.json]`，全部 200）：`favicon.ico` 1,169 · `apple-touch-icon.png` 1,698 · `icon-192.png` 2,494 · `icon-512.png` 10,021 · `icon-maskable-192.png` 1,718 · `icon-maskable-512.png` 8,245 · `og.png` 37,926 · `screenshots/narrow.png` 83,613 · `screenshots/wide.png` 124,462
- **Apple splash 共 46 张**（23 portrait + 23 landscape，覆盖 **18 个 distinct device-width**），命名规律 `/splash/apple-splash-{W}x{H}.png`，每张带精确 `media="(device-width/height/-webkit-device-pixel-ratio/orientation)"`；尺寸覆盖 iPhone SE→Pro Max 全系与 iPad 全系（750×1334 … 2752×2064）。体积很小（抽样 1,737–7,453 B，纯色底+logo）。`[home.html]` head 全量实测。
- iOS/Android meta：`mobile-web-app-capable: yes`、`apple-mobile-web-app-capable: yes`、`apple-mobile-web-app-title: Todos`、`apple-mobile-web-app-status-bar-style: default`

### 5.3 `sw.js`（全量已存，3,495 B）

自我定位原文注释：`// Minimal PWA service worker: notification click routing only. Deliberately NO fetch handler — Chrome no longer requires one for install, and an empty one taxes every request with SW dispatch/boot latency (worst on iOS...)`。

行为四要点（逐条对应源码）：
1. `install` → `skipWaiting()`；`activate` → `clients.claim()`。
2. **无 `fetch` 事件**：站点完全不靠 SW 做缓存，离线能力=无。
3. `push`（为**不支持 Declarative Web Push** 的 Chrome/Firefox 兜底；Safari 18.4+ 原生消费同一 payload，注释明确「never runs this handler」）：payload 形状 `{ web_push: 8030, notification: { title, body, navigate, tag } }`；**前台抑制**=已有 visible+focused 窗口则直接 `return` 不弹系统通知（交给应用内 toast）；`navigate` 只取 `pathname+search+hash`，因页面走客户端路由；通知 title 用 **todo 标题**而非应用名，注释解释是为避免 iOS 固定 "from \<app name>" 归因行重复标题。
4. `notificationclick`：先 `caches.open('nav').put('/__pending-nav', {href, at})` **把深链落到 CacheStorage**，再 `postMessage` 作快路径。源码注释给出理由：iOS 会挂起后台 PWA 页面并丢弃 postMessage，且 iOS standalone 忽略 `WindowClient.navigate()`；消费方点名是 `ServiceWorkerRegister.tsx`。

### 5.4 `/.well-known/apple-app-site-association`（200，386 B，`application/json`）

```
appIDs: ["78MKE32NHU.dev.todos.app"]
components: [{ "/": "/app/*" }]
comment: "The app surface. Everything else on this origin — the marketing pages, /docs,
/login, /qr, /enroll, /invite — has no screen in the app and stays in the browser."
```

→ 存在一个 **iOS 原生 App（Team ID `78MKE32NHU`，bundle id `dev.todos.app`）**，接管 `/app/*` universal link。这与 `/install` 页「installs to your Home Screen as a web app, outside the app stores」并存：PWA 路径与原生 App 路径同时在线。【推断】原生 App 存在但不在公开营销主推路径上。

`/.well-known/assetlinks.json` → 404（无 Android Digital Asset Links）。

---

## 6. 定价与功能边界（Free vs Pro 精确圈线）

### 6.1 数值矩阵（`[pricing.html]` 逐行 DOM 解析，18 行 feature row 全量实测）

| 维度 | Free | Pro |
|---|---|---|
| 价格 | **$0 forever** | **$19 /month per team**；年付 **$15.20/month billed annually** |
| 副标题 | Use your own machines and API keys. | Hosted sandboxes and built-in models, out of the box. |
| Agent count | **5** | **15** |
| Add your own machines | **1** | **4** |
| Parallel builds | **2** | **10** |
| Storage | **1 GB** | **20 GB** |
| Monthly credits | **0** | **35,000** |
| Projects | **6** | **20** |
| Platform machines（云端沙箱） | ✗ X | ✓ check |
| Platform-hosted repositories（托管仓库） | **◷ clock — `title="Available for a limited time"`** | ✓ check |
| Built-in models（内置模型） | ✗ X | ✓ check |
| CTA | `Get started` + `No credit card required.` | `Start free trial` |

布尔行**三态**（不是二态）——像素复刻必须实现第三种：
- Free 的 `Platform machines` / `Built-in models` = 12×12 **X** 图标（path `M18 6 6 18` + `m6 6 12 12`），色 `text-content-dim`
- Pro 全部 = 14×14 **check**（path `M20 6 9 17l-5-5`，`stroke-width="2.5"`），色 **`text-indigo-500`**
- Free 的 `Platform-hosted repositories` = 14×14 **时钟**（circle r=9 + `M12 7v5l3.5 2`），色 **`text-amber-500`**，外层 `<span title="Available for a limited time">`

定价页整页只出现 **1 个** `title=` 属性，就是这个"限时可用"。即：**Free 目前可用平台托管仓库（限时），但无云端沙箱、无内置模型**。这条在纯文本抓取下会丢失，只能从 DOM 的 title/图标 path 恢复。

表格下方限定语原文：`Pro adds platform-hosted machines and built-in models, both drawn from the monthly credits. Parallel build limits count tasks only; chief conversations do not use a slot.`

⚠️ 与 landing FAQ 存在**口径差异**：定价页说 "chief conversations do not use a slot"，而 FAQ「What is a parallel build?」说 "each in-progress chief turn takes one as well"。两处相邻文本对「Chief 对话是否占并行额度」表述相反（`[pricing.html]` 表格注 vs 同页 FAQ JSON-LD）。【推断】表格注是较新口径（限定语针对 Pro 说明），FAQ 段可能未同步。复刻计费逻辑时需按票面另行确认，本票只登记矛盾。

### 6.2 与票面「已知排除项」逐条核对

| 票面已知 | 官方定价页原文核对结果 |
|---|---|
| 排除 built-in models | ✅ 一致。`Built-in models` 在 Free 行是 X |
| 排除 cloud sandbox | ✅ **部分一致，措辞需修正**：Free 无 `Platform machines`（云端沙箱）。但同页 Pro 副标题用词是 "Hosted sandboxes"，而 zh-CN 把 `Platform machines` 译作 **`云端沙箱`**，ja 译作 `プラットフォームのマシン`——同一概念三语三词，复刻文案要按 locale 分别对齐 |
| 排除订阅计费 | ✅ 一致且更精确：**"billed per team, not per seat"**（按团队不按席位，加 agent/项目/资源不加价）；年付只是折扣价，不是另一种计费模型 |
| 保留 OAuth 连自有 ChatGPT/Codex/Copilot/XAI 订阅 | ✅ 一致，见 §6.3 |
| （新发现，票面未列）Free 有托管仓库 | ⚠️ Free 行 `Platform-hosted repositories` = 时钟"限时可用"，**不是 X**。若照"Free 只有 BYOK/BYOC"理解会漏掉这一项 |

### 6.3 OAuth 连自有订阅 = 明确保留（原文核对）

- `/pricing` FAQ 与 `/mcp` 都**未**提及模型订阅 OAuth；保留证据在两处：
- Landing FAQ 原文：`Can I use a ChatGPT, Codex, or Copilot subscription?` → "Yes. Besides API keys, you can sign in to connect a ChatGPT/Codex, GitHub Copilot, or XAI subscription."（`[home.html]`）
- `/docs/providers` 原文（最权威，逐条）：
  - `A subscription you already pay for. **ChatGPT/Codex and GitHub Copilot have no API keys at all. xAI takes either**, so picking it asks which you want. The page shows a short code and a link; you sign in at the vendor, and the connection lands once we have proved it can run a model.`
  - `A provider holds one credential at a time, so **signing in to xAI replaces an xAI API key the team already had**. If a subscription login expires later, the provider shows a reconnect prompt.`
  - `**Subscription refreshes are performed by the server alone.** Two machines refreshing the same login independently used to invalidate one another.`
  → 结论：**订阅 OAuth 是 Free 与 Pro 共有的能力**（providers 页全文无 plan 限定，且 Free 定位就是 BYOK/BYOC）；xAI 的 key/subscription 二选一互斥；服务端单点刷新 token。
- 凭证安全模型（`[docs_providers.txt]` 原文）：密钥服务端加密存储、保存后任何页面/API 不再回读、编辑恒从空字段开始；**仅在任务派发到你自己机器那一刻解密**，机器侧只驻内存；机器永不落盘 provider 凭证。

### 6.4 额度与云端沙箱成本（`[docs_platform_machines.txt]`，定价页未给的数字都在这）

- 沙箱基座：**Cloudflare Sandboxes**，一个平台机器 = 一个 container。
- 三档规格（尺寸只能升不能降，Small 是地板：装不下 image+clone+依赖的最小规格）：

| Size | vCPU | Memory | Disk | 默认并发 | credits/清醒小时 | 35,000 credits 可买 |
|---|---|---|---|---|---|---|
| **Small (default)** | 1 | 6 GiB | 12 GB | 3 | **340** | 102 hours |
| Medium | 2 | 8 GiB | 16 GB | 5 | **490** | 71 hours |
| Large | 4 | 12 GiB | 20 GB | 8 | **785** | 44 hours |

- 计费：`Sleeping costs nothing at any size — the bill follows awake time and nothing else.`；`Machine time and platform-paid inference draw on the same monthly credit pool.`；`Credits are denominated at what the platform actually pays: machine time and inference alike are **billed at cost with no platform markup**. Only a **payment processing fee** is added when topping up.`
- 休眠/唤醒：闲置 **10 分钟**入睡；有排队任务自动唤醒，冷启动「usually seconds」，在 build 里表现为一个 **`Waking machine`** 阶段；任务运行期间不会被 idle 计时器切断。
- 磁盘：容器盘**每次入睡即销毁**，下次唤醒从备份恢复 → 「不是存文件的地方」，agent 产出必须落在 todo 分支上；备份丢失不丢已提交工作，最坏是空盘冷启动重 clone。
- 硬限制 4 条：**不是 remote-shell 目标**（remote shell 走 sync tunnel，平台机器不跑）· Pro **每团队 1 台**（要更多就 resize 或自带机器）· **credits 耗尽即停止唤醒**（自带机器与自带 key 不受影响，"there is always a path that costs nothing"）· 移除即销毁，且**团队最后一台在 plan 含平台机器时不可移除**。
- `A self-hosted Todos server with no sandbox backend configured never shows the platform-machine option at all.` → 自托管无沙箱后端时该选项整体不渲染。

### 6.5 限额触顶行为与生命周期（`[pricing.html]` FAQ 原文，复刻必须照做的规则）

- 触顶：`Nothing is interrupted and nothing is billed extra.` 运行中的 build 必完成；机器满→先移除一台才能接入新设备；存储满→新构建/上传前需腾空间；并行槽满→等有任务完成即可开始；升级一次性解除全部限额。
- 升级付款后立即生效；取消则 Pro 持续到当前计费周期末，之后团队回落 Free；**超 Free 限额的数据不立即删，保留 15 天**。
- 每账号最多 **3 个免费团队**；Pro 按团队订阅，可分别升级任意多个团队。
- 机器名额规则：一台 = 跑 `tds` CLI 并为团队执行 build 的设备；**手机/浏览器访问 Web 不占名额**；多 agent 共用一台不额外占；移除立即释放。
- 存储计入项（穷举）：附件、构建会话记录、代码 diff、技能文件、项目图标、agent 头像、**托管在 Todos 的仓库磁盘体积**；**托管在 GitHub 的仓库不计入**。
- 并行构建计入项：处于 queued/planning/building 的每个 todo 各占 1 槽，一个 todo 从开始到结束持槽（与它跑多少 step 无关）。

### 6.6 结构化数据（SEO 侧的权威定价声明）

`[pricing.html]` 的 JSON-LD `@graph`：
- `SoftwareApplication`（`@id: https://todos.dev/#software`）：`applicationCategory: DeveloperApplication`、`operatingSystem: "Web, iOS, Android"`、`inLanguage: en-US`、author/publisher 均指向 `#organization`
- `offers[]`：**Free** `price "0"` / **Pro** `price "19.00"` USD，`priceSpecification.UnitPriceSpecification` + `referenceQuantity {value:1, unitCode:"MON"}`（= 每月）
- `FAQPage`（7 问全文，与可见 FAQ 一致）

各页 schema 类型分布（`[jsonld 实测]`）：`Organization` `WebSite` `SoftwareApplication(+Offer)` `FAQPage` `BreadcrumbList` `CollectionPage` `Article`。changelog 佐证：全站加 JSON-LD（组织/网站/带 offer 的软件应用/FAQ/面包屑/文章）。

⚠️ `[llms.txt]` 第 56 行对 pricing 的描述是：`One flat price per team. No seats, no usage bills, no credits.` ——**与实际定价页矛盾**（定价页明写 `Monthly credits 35,000` 且沙箱按 credits 计费）。【推断】llms.txt 的这句是过时营销文案；复刻文案以定价页与 JSON-LD 为准。

---

## 7. 公开补充材料

### 7.1 docs 子站结构（同域 `/docs`，非独立子域）

5 个分组、31 篇 + 1 索引页 = 32 条 URL（`[docs.html]` 侧栏顺序实测；**侧栏顺序即信息架构**）：

| 分组 | 页面（按侧栏顺序） |
|---|---|
| **Start here** | Overview · Install · Quick start · Concepts |
| **Using Todos** | Todos · Chief · Agents · Conversations · Plans and diffs · AI review · Skills · Memory · Context and persistence · Schedules · Inbox and notifications · Mobile |
| **Team & projects** | Teams · Projects · Repos on Todos · Machines · Platform machines · Model providers · MCP servers · Secrets · Permissions · Remote shell |
| **Reference** | CLI · MCP · API keys · GitHub |
| **Help** | Troubleshooting · Changelog |

docs 页 UI 约定：左侧栏分组 + 当前页高亮、右上 `Search ⌘K`、底部 `← Previous X / Next Y` 线性翻页、右侧 `On this page` 锚点目录。**docs 站内搜索无公开索引端点**（`/api/search`、`/api/docs/search`、`/docs/search.json`、`/search-index.json`、`/api/docs/search-index`、`/llms.json` 全 404）→ 【推断】索引在前端 bundle 内或走 `/llms-full.txt` 之类的静态语料。

标题命名（复刻需照抄 `<title>` 格式 `X — Todos`）：`Context and persistence`、`Inbox and notifications`、`Plans and diffs`、`Repos on Todos`、`Model providers`、`MCP servers`、`Quick start`、`Platform machines`、`API keys`、`AI review`（页内 H1 与 `<title>` 一致，`docs_todos` 的 H1 则叫 `Todos`）。

### 7.2 LLM 正典语料（复刻最省力的单一入口）

- `https://todos.dev/llms.txt`（5,848 B，200，`text/plain`）：标准 llms.txt 格式，`# Todos` + `>` 引用块（= 站点 tagline）+ 正文一段定位语 + **与 docs 同构的 5 组链接清单**（每条带截断到 ~80 字符的描述）+ `## Optional` 段给 Pricing 与 Full documentation 链接。
- `https://todos.dev/llms-full.txt`（**311,487 B**，200，`text/plain`）：**全站文档单文件全量**。已整份入库为 `[llms-full.txt]`，这是行为语义的机器可读正典，比对逐页抓取更省事。

### 7.3 Changelog（应用内行为的主要来源，公开无鉴权）

`https://todos.dev/docs/changelog` —— **单页无分页**（实测无 `Load more`/`?page`/`?after`/`Older` 控件，页尾日期锚点直接到底 2026-06-04）。
- 覆盖 **105 个日期**，`2026-06-04 → 2026-09-17`（缺 09-11），**约 326 条**条目；HTML **599,278 B**（全站最大页）。
- 条目格式：`<日期> + 每条一段`，段首是 `板块 — 一句话标题 ：正文`，板块名实测有 `App` `Plans` `Kanban` `Task detail` `Builds` `Branch sync` `Chief` `Landing page`/`Landing` `Models` `Desktop` `Executor` `Sidebar` `Topics` `Progress` `File preview` `UI polish`。
- **无 demo 视频、无外部社交链接**：全站 HTML 实测 `<video>`/`<iframe>`/`<source>` 标签 **0 个**，youtube/vimeo/bilibili/discord/twitter 链接 **0 个**；唯一外链是 `github.com/settings/installations`（docs/github）与 Lorelei 字体的 figma/CC0 attribution。落地页"演示"是纯 HTML/CSS mock（见 §2.2、§3.2）。→ 票面第 5 项的「demo 视频链接」在公开面**不存在**，demo 素材就是 hero mock + install 时间轴 + changelog 文本。

从 changelog 可直接抄的**应用内行为事实**（每条均带日期，摘最影响复刻的）：

- **看板 = 6 列**（2026-09-12）：`Backlog, Planning, To confirm, Building, To review, Done (last 7 days)`，每列可折叠且折叠态按设备记忆；失败的 build、以及 review 阶段无可验收产物的 todo **钉在 Building 列顶部**而非单开列；排队 todo 坐落它 build 要跑的那一步；手机端同一批 6 桶改为 tab。页面由 Progress 改名 Kanban 并换图标（侧栏行与全局搜索同步）。
- **卡片主按钮随阶段变**（09-12/09-14）：`Start`(backlog) / `Confirm`(确认门且 plan 已就绪) / `Done`(review) / `Retry`(失败后) / `Reply`(agent 在等你)；桌面可拖卡到目标列，`Ctrl/Cmd-click` 多选同列批量拖，批量只作用于「该移动适用」的卡并报告跳过数，拖到别处则打开预设为该路径的 start dialog。
- **右键/长按出快捷菜单**（09-16）：桌面 pointer 右键、触屏长按 → 与 header kebab 同一个自适应 sheet（web 是指针处 popover，手机是 bottom sheet），头部显示 todo 编号+标题；菜单项按当前 phase 出：`Edit` 直进编辑器、`Complete` 走看板自带 confirm-and-merge、`Close`/`Delete` 遵循延迟 Undo 窗口（卡片立即隐藏、短时间可撤）；`Delete` 需先确认，且在 turn 进行中保持可见但禁用（服务端会拒）。
- **删除与关闭语义分家**（09-17）：delete 过去与 close 同样先隐藏行、等延迟 Undo 窗口，detail 页提前离开使删除像没发生；现在 **delete 先确认再立即生效**（请求中显示进度注记，落地后才从 list/board 移除并关页；失败则 todo 原地保留）。列表批量 delete 同样改为确认即生效，**close 保留延迟 Undo 窗口**。同批新增卡片菜单 `Duplicate task`（带 title/description/tags，有指派则连指派一起带，副本落在看板上）与 `Copy link`。
- **空态文案精确化**（09-17）：尚未规划的 task 的 plan tab 不再显示 change set 占位 `No diff to show`，改显 **`No plan yet`**。
- **plan 修订改为就地编辑**（09-17）：新增 `edit_plan` 工具，一次调用一处精确替换（被替换片段必须与当前 plan **逐字且唯一**匹配，替换为空即删除），改动先落到该 turn run 上的 draft、turn 结束时铸成下一 plan 版本，并行编辑有 ordering 防互踩；大面积重写仍整块发出。**只有真的改到的片段才计费**。
- **版本对比**（09-15/09-16）：change set 与 **plan 都**支持「Compare with another version…」，选旧版作 baseline，触发器显示 `v3 → v5`，两份 plan 源以单文件行 diff 渲染在同一 change-review 视图；plan 版本不在任何仓库里 → 仓库专属操作（开文件、图片预览）保持关闭；**无 commit 的 plan 版本仍可选**，故每个版本都可比。change set 侧 pinned baseline 随新 build 前移（新 head 仍对同一旧版比），若 rewind 删掉 pinned 版则回落 base。版本切换器额外显示每个版本的增删行数（绿 `+n` / 红 `−n`），无 diff 可读的版本只显版本+时间。
- **停止 turn 先问且默认丢弃**（09-16）：stop 按钮弹出带 **"Discard this turn's work — the plan and code go back to the previous version"** 默认勾选的确认框；勾选则在下一 turn 前 rewind worktree/branch/session 到上一 checkpoint，todo 停在上一完成 turn 留下的 gate（首次 implement 被取消则回到 confirm 而非空 review），被取消的消息作为 pending input 留在 thread 里；不勾选保留旧行为（保留半成品）。
- **取消即时生效**（09-15）：旧行为靠置位标记、只在 model 流式响应或 60 秒心跳时被读到，长 tool call 期间无流 → 取消可干等近一分钟；现在推一个 machine-channel 事件直接推进该步心跳，机器当场 abort/checkpoint/上报。
- **迟到的 done report 仍要落账**（09-15）：取消或 stale-run sweep 抢在机器 abort 完成前占了 run 时，后到的带 commit 的 done report 旧会被当 "run not owned" 丢弃，导致分支上有工作而 build 不知情（diff hash 停在 null、review 面板显示旧 diff、Done 报 "No changes to merge"）；现在在 restore mutex 下锚定该 report。
- **merge 等 rewind 落地**（09-15）：merge 路由与 Chief 的 merge 工具原先基于快速预检直接起 merge turn，可能把正在被 rewind 掉的 worktree 发出去；两者现在都走与 confirm plan 相同的 physical-restore gate，路由回 `restore_pending` 契约由客户端轮询穿过。
- **model 错误中断要指名原因**（09-16）：原先统一一句 `cut off by a model error — may be incomplete`，真因（如配额耗尽）闷在机器 daemon 日志里；现在按失败 run 的分类法归类并指名，例 **`cut off by a model error (model service quota exceeded)`**，无规则命中时回落 provider 原话。
- **watchdog 静默预算**（09-13/09-08）：某些网关把整个 tool call 缓冲完才转发，流因此长时间静默；改为**每流一份静默预算**——等首事件 300 秒、生成中 480 秒，超预算即诚实失败而非重放烧光 retry 预算；空 delta 不续计时器，真 provider 错误仍走自动重试。09-08 条目另记：同一 step 的 attempts 共享 stall run，**每次 watchdog 触发把下一次的 idle bound 翻倍**，连续第三次 stall 用词避开 pi 的 retryable pattern 从而失败退出（此前 120s 平预算导致 8 attempts / 20 分钟 / 8× token）。
- **executor 中断要杀全部在飞命令**（09-10）：一个 turn 并发多条 bash 时，中断只杀掉最后启动的那条，其余继续跑（有用户等了一次 9 分钟的递归 grep）；现在在飞命令作为集合跟踪，中断全部 abort，tool 边界要等所有兄弟任务落定才出现。
- **edit 参数宽松解析**（09-13）：某些网关把 edit tool 的改动以 JSON 字符串呈现给模型，模型回写时把内容里的引号留裸，严格解析即失败；executor 现在宽松解析（引号只在该结束字符串处才结束）。
- **Chief 从侧栏搬进悬浮球**（09-15）：Chief 原为侧栏 Topics 里的整页 chat，现改为看板上可拖拽的悬浮球 = Chief 自己的脸 + 右上角未读圆环 + hover 显示 **`Chief · C`**；桌面可拖到看板任一侧且记住停泊位，单击展开为独立 chat 窗口（按 header 移动、四边可 resize、折叠回球所在角落）；手机用与 task 相同的 peek sheet；**裸键 `C` 打开**（与 `N` 建新 todo 同条件：正在输入或有 dialog/menu 弹出时忽略），`Esc` 关闭并让位于任何 modal；topic 切换收进窗口标题处，Chief 设置变成 chat 上的 dialog 而非页面；每个 topic 的 composer 草稿存设备，关窗不丢；侧栏去掉 Topics；**旧 `/chat` 与 chief-settings 链接（push、`tds://` 深链、旧 redirect）仍然可用**，落到所指内容后把屏幕交还看板。
- **侧栏运行态可视化**（09-10）：有 todo 在跑时 progress 入口把 needs-you 药丸换成**带 running count 的彗星环**（drawer 行、rail 图标、手机汉堡按钮一致），无任务时回落药丸；有 turn 在飞的 thread 在最远端（rail 的 thread picker 里则在标题旁）显示打点 ellipsis，发送即标记 busy。
- **首访三步看板引导**（09-14）：创建任务 → 阶段与推进 → 本机预览；完成三步即不再自动弹出（中途用 ✕ 或点遮罩关闭**不算已读**，但当次启动不再重弹），header 的 `?` 按钮可随时重开。桌面 shortcut 与 drag 两行只在 desktop web 出现。
- **分支下载合并为一个对话框**（09-13）：todo header 原先 admin-only 的 sync-to-machine 图标 + 藏在手机溢出菜单的 branch-and-PR 弹窗合并为**一个 download 按钮**（桌面手机都有），两 tab：sync tab 单面板（build 分支与目标 commit 并排且都可复制、带在线圆点的机器选择器、sync 目录、force 开关、pending→running→synced/failed 结果卡）；**权限从 admin-only 降到任意团队成员**。Git tab 显示 branch/PR 状态与可直接复制的 fetch 命令（平台托管仓库另给 clone 命令）；**从此处提交 PR 的入口被移除** —— build 通过 Done 的 merge 落地。
- **机器成为独立页面**（09-10）：机器从团队设置的一个 tab 移到侧栏 **Resources** 下的独立页面，侧栏 machines 行在有机器离线或版本落后时显示一个点。
- **项目页默认开在文件**（09-09）：`/project/[id]` 原先开 todo 列表、仓库浏览器藏在 folder 图标后的第二条路由；现在默认开文件，header 里用分段开关 `Tasks | Files` 替代标题位置，**tab 随 URL 走（`?tab=tasks`）**刷新保持，但指名 phase 而不指名 tab 的 `?phase=` 链接仍落在列表；旧 `/files` 地址保留为 redirect（连 `ref`/`dir`/`path` 一起），因为 agent 消息与书签带着它。
- **新账号直落工作区**（09-08）：原被挡在 setup guide 直到有机器+模型+激活工作区；现在直接进工作区，**setup sheet（hosted / own-machine 两个 tab，activate 按钮钉在 footer）只在 send 或 start build 发现团队缺机器或缺模型时才出现**；别处配好但从未激活的团队在首次 send 时静默 seeded。Chief 不再在创建时或读取时获得 thread —— **首次 send 才铸成**；其余 lazy creator（pre-thread aliases、build watches、wakes）按 Chief 串行化，防止首波并发铸出多个。旧 `/onboarding` 仍 redirect 进 sheet，Stripe 回跳重开它。
- **空态与新手卡片**（09-09/09-08）：新团队 Chief 空态把两个玩具示例（crypto dashboard、fortune-teller）换成两个指向用户自己工作的入口 —— `Import my existing project` 与 `Import a skill`，都预填 prompt 且开局先问东西在哪（GitHub 仓库还是别处；仓库 URL 还是粘贴的 SKILL.md）；有编制团队+项目的空态四张卡改为 `build the agent team` `create a project` `summarize progress` `show this month's token usage`（去掉 product intro 与 hand-off search）。
- **topic 可设 emoji 图标**（09-08）：原先每行都是同一方框井号；点该字形或行菜单 `Change icon` 打开选择器（常用 emoji 网格 + 一个自由输入框），**校验只接受恰好一个 emoji cluster**（含旗帜、keycap、肤色与 ZWJ 序列）；`PATCH` 路由接受 title、emoji 或两者；彩色 emoji 字体族因此进栈。
- **双击就地改名**（09-08）：drawer 的 topic 与 project 行接受双击——第一次仍打开该行，第二次把标签换成同度量的输入框；Enter/失焦提交，Esc 还原，空或不变即取消；project 改名限 admin（PATCH 要求），走新的 `renameProject`，乐观更新、写失败则回滚。
- **桌面端**（09-10/09-09）：桌面 App 由 macOS-only 扩到 **Windows(x64 NSIS EXE) + Linux(x64 AppImage 与 deb)**；Win/Linux 用原生标题栏，macOS 保持隐藏标题栏（红绿灯居中在应用自己的 44px 顶带，可拖动、双击 zoom）；Win 关窗→任务继续在托盘跑，Linux 关窗→询问 minimize/quit/cancel；两者都有托盘图标，Win 用 overlay badge 画未读数；shell 更新 Win/Linux 自动下载重启时安装、Linux 仅 AppImage 形态自动更新（deb 手动），web OTA 通道三端共享，**web 更新与 shell 更新各自独立移动**；跑本地任务需要系统 PATH 上有 Git（Windows 要 Git for Windows 带 Git Bash），缺 Git Bash 会在启动 local worker 前报出。macOS 侧则把 executor 打包进 App，「Use this Mac」一键把本机变成 build machine，**App 与 CLI 共用 `~/.tds` state root 与 daemon pid lock**，故两者绝不会同时跑同一台机器（CLI 先起则 App 只 watch 并显示 "run by tds CLI"）。
- **模型 catalog**（09-10）：DeepSeek V4.1 Flash 上架，canonical id **`deepseek-flash`**，跨 4 个 provider 跟进（DeepSeek 本身 / OpenRouter `deepseek/deepseek-v4.1-flash` / Vercel AI Gateway / OpenCode Go）；原生多模态（文本+图像输入）、**1M window、384k 输出上限**、thinking levels `low/high/max`；managed inference 侧 `deepseek-flash` 成为新的 included default，定价 **0.15 / 0.6**、cache read **0.003**，典型任务从 ~280 降到 ~210 credits；退役的 `deepseek-v4-flash`、`vision-exp` 两个 id 仍路由到 V4.1 Flash 并按其价格计费；**DeepSeek 高峰时段 2× 区间收窄为周一–周五 01:00–04:00 与 06:00–10:00 UTC，周末永不高峰**。
- **plan 文档里的仓库文件路径变成可点链接**（09-14）：inline-code 路径若指向仓库文件，现在渲染成强调色可点链接，在文档旁边的 file viewer 里打开该文件；匹配器只认独立相对文件路径（先规整尾部行号与 `./` 前缀），命令、URL、表达式、绝对路径与机器本地路径保持纯代码。
- **`.tex` 数学渲染大幅补强**（09-08）：定界符 `\big…\Bigg` 及 l/r/m 变体、`\|` 与 `\lvert` 族；参数内含命令的字体命令（`\boldsymbol{\theta}`、`\mathbf{\hat{x}}`）按 math 解析并施加样式；`\hspace{2mm}` 不再漏出 `2mm`；`\phantom` `\tag` `\overset` `\underset` `\operatorname*` `\sum\limits_{i}` 解析到本义；上下标按 Unicode Superscripts/Subscripts 整块切分；投影到 `.tex` 时 TeX 引号与破折号转成文字、`\` 转空格、`\cline` 从表格剥离、`\textcolor`/`\setcounter`/`\pagestyle` 去 markup。
- **本地化发布工程**（09-06，据 `[ja_docs_changelog]` 原文）：公开站改为**预渲染静态本地化页**；英文无前缀、`/zh`、`/zh-TW`、`/ja`；`/pricing` 等旧地址 308 重写到 `/en/pricing` 再按用户记住的 locale 回落；全站补 canonical/hreflang/OG；加 JSON-LD（Organization、WebSite、SoftwareApplication+Offer、FAQ、Breadcrumb、Article）与多语 sitemap；新增 **`/llms.txt` 与 `/llms-full.txt`**；登录、升级等页用 robots 设 noindex；**未翻译的 docs 以本地化外壳展示，但 canonical 仍指英文，并从 hreflang 与 sitemap 排除**；法务页改走 docs 渲染器；收录 `/compare` 与 `/use-cases` 两个 Markdown 集合且首条以 draft 发布；旧 dashboard redirect 改为 **308**。

### 7.4 可推断的应用内语义（docs 正典，复刻的领域模型）

- **9 个 phase（不是 6 个）**（`[docs_concepts.txt]`、`[docs_todos.txt]` 两处表格一致）：`To Do`(已建档未开始) `Queued`(已启动，等空闲机器) `Planning`(读仓库写计划) `Confirm`(计划就绪等你) `Building`(在改) `Review`(改动就绪等你) `Done`(已接受，若选了则已合并) `Failed`(run 停在错误上) `Closed`(未完成即搁置)。**一个 todo 恒处恰好一个 phase**。看板 6 列是对这 9 阶段的视图折叠 ——【推断】折叠映射为 `To Do`+`Queued`→`Backlog`、`Failed`→钉在 `Building` 列顶、`Done`→「Last 7 days」列；其中 Failed 与 Done 的落位有 changelog 2026-09-12 原文支撑（"A failed build … stays pinned to the top of the Building column"、"Done (last 7 days)"），`To Do`+`Queued`→`Backlog` 是本票推得。
- **只有两个人工门**：`Confirm`（计划写出后、碰代码前）与 `Review`（改动完成后、发布前）；原文 `A todo stops for a person at exactly two points, and nowhere else.`
- **启动时二选一**：`Plan first` 会停在 Confirm；`Run now` 直入 Building。`Whether a todo plans at all is your choice when you start it.`
- **并行槽占用规则**：todo 在 `Queued`/`Planning`/`Building` 期间持 1 槽；**停在 Confirm 或 Review 即释放槽**，到达终态也释放（`[docs_todos.txt]`，这条比定价页 FAQ 更精确）。
- **终态不是终的**：`Done`/`Failed`/`Closed` 都可重跑，rerun 起一个全新 build 并把旧 build 留作历史，**无需先 reopen**。
- **文档（Documents）4 种 kind**，都挂在 build 上且各自版本化：`Plan`（打算做什么，待你确认）· `Changes`（该 run 产出的 diff）· `Proposal`（Chief 建议跑的工作，以你接受或忽略的卡片呈现）· `Question`（agent 需要你回答的结构化问题）。
- **收件箱 5 类事件**（`[docs_inbox.txt]`）：`Plan ready` `Build finished` `Build failed` `Agent note` `Assigned to you`；通知恒发给 **todo 的 owner，而 owner 永远是人**（无论谁建的 todo）。
- **Agent 提问语义**：问题带**建议答案 + 一个 `Other` 自由输入框**；答完 run 从那里继续；问题可 lapse（run 已推进则显示为不再等你）；属于别团队 topic 的问题会要求你先切回该团队。
- **通知渠道 2 类**：Browser（tab 在后台时的桌面提醒；被拒需到浏览器站点设置重新放行）· Phone push。iPhone/iPad **只有加到主屏的 App 能收通知**（Safari 分享菜单添加），否则等你的 agent 根本联系不上你；**每台设备单独在收件箱里启用**。
- **权限分四处**（`[docs_permissions.txt]`）：agent 能做什么 · 机器允许什么 · 人的 role 允许什么 · API key 带什么。
  - 默认可用无需授予：读改文件、在自己 build 内跑命令、读团队 todos、向你提问、通知你。
  - **7 个 per-agent 开关，默认全关**，位于 agent 页 Tools：`Push branch` `Merge branch` `Create tag` `Create skill` `Update skill` `Remote shell` `Team secrets`；可授予者 = 团队 admin 或 Chief；**授予从 agent 的下一个 turn 生效**。
  - Chief 授权的前提：它代你行事，故你得是 admin，且**它从不主动发** shell 或凭证，只在你明确要求时给。
- **Chief 语义**（`[docs_chief.txt]`）：一团队**恰好一个** Chief；一条覆盖所有项目的常驻对话；**不写代码**，一切改动都作为它指派的 agent 上的独立 build 跑；两项跨 topic 持久 = `Charter`(你写的常设指令，讲优先级与路由) 与 `Memory`(它自己在所跑 agent 上的实践记忆)，**每 turn 都读**；派活两种方式 = 你要求→立即起 build，它自己决定→以 **proposal 卡片**待你接受；**不会自己叫醒自己**，只在你下次说话时汇报（同时压低噪音与 token 成本）；它由「看的」而非「记得的」驱动：读 build 对话（含在飞 turn）、看板、团队与机器名册，重复读**只回增量**，名册没变只回一行，需要全量时要；compaction/rewind 后读取重新开始，被丢的东西不当作还记得；context 面板显占用并给 `Compact now`；换所跑 agent 即换到该 agent 的记忆。
- **Build/run 模型**：build = 某 agent 在某个 todo 上工作；每次尝试是一个 run，一个 todo 可有多个（plan run、build run、失败后 rerun）；run 跑在**某台机器上的隔离 git worktree** 里，产出（消息、plan、diff、token 用量）挂到 todo 上。
- **机器与 agent 的关系**：`Machines claim runs; agents do not own them.` todo 起来后落到空闲机器或你钉住的那台；每台机器有自己的并发上限与 builds/remote-shell 两个开关。
- **三层上下文**（`/docs/context` 摘要）：`Nothing an agent needs to know depends on a conversation staying open. Context is kept in three layers`；记忆按 agent 私有、**彼此不共享**，该全团队知道的东西属于 skill 而非 memory。
- **调度语义**：todo 可挂常设 schedule 规则，规则触发时该 todo **作为全新 build 重跑**（同 agent、同起点）。
- **team/project 语义**：team 是一切归属的单位（成员、agent、机器、项目、模型服务、密钥、技能全按 team 作用域），**计费按团队不按席位**；一人可属多团队并切换；project = 一个 git 仓库 + 其中发生的工作，连 GitHub 或 Todos 托管仓库之一 + **一个 base branch，且该连接永久不可改**。
- **Remote shell**：agent 本跑在隔离 build 内，碰不到你的本地文件/dev server/设备；remote shell 是显式开关的能力，走 sync tunnel（平台机器不提供）。
- **CLI 与运行时**：npm 包 **`@todos-dev/cli`**（`npm install -g @todos-dev/cli@latest`），**要求 Node.js ≥ 22.19**；daemon 日志 `~/.tds/daemon.log`，**超 10 MB 轮转**；`TDS_SERVER`/`TDS_API_KEY`/`TDS_TEAM`/`TDS_WORKSPACES_DIR` 四个环境变量；尊重 `HTTP_PROXY`/`HTTPS_PROXY` 及 macOS 系统代理；`tds provider` 子命令已废弃，只剩把你指向网页的提示。
- **平台托管仓库**：`/docs/platform-git` —— 项目不非得托管在 GitHub，Todos 可直接托管仓库；changelog 记 Git tab 会额外给 clone 命令。

---

## 8. i18n 矩阵（翻译状态实测）

判定方法：页面文本里搜各 locale 的「本页未翻译」横幅；并统计字符量。全表见 `[i18n-docs-matrix.txt]`、`[i18n-page-inventory.json]`。

| 面 | en | zh-CN | zh-TW | ja |
|---|---|---|---|---|
| 6 个营销页（`/`、`/features`、`/install`、`/pricing`、`/mcp`） | ✅ 原文 | ✅ 真翻译 | ✅ 真翻译 | ✅ 真翻译 |
| `/docs` 索引页 | ✅ | ✅ 真翻译(1,771 CJK) | ❌ 英文兜底(153 CJK) | ❌ 英文兜底(48 CJK) |
| 31 篇 docs 正文 | ✅ | ✅ **32/32 全译** | ❌ **1/32**（仅 Changelog 译） | ❌ **1/32**（仅 Changelog 译） |
| `/privacy`、`/terms` | ✅ | ❌ 英文 | ❌ 英文 | ❌ 英文（zh 侧 CJK≈16、ja 侧≈11，即只有导航外壳） |
| Changelog | ✅ | ✅ | ✅ (81,891 B 真繁中) | ✅ (112,800 B、62,591 假名) |

未翻译时的横幅原文（**只有这一句**，复刻要照抄）：
- zh-TW：`本頁尚未翻譯，暫以英文顯示。`
- ja：`このページはまだ翻訳されていないため、英語で表示しています。`

导航外壳（分组名、`検索 ⌘K`、`ドキュメント目次`、`更新履歴`、上下篇）**即使正文未译也已本地化**——见 `[i18n-*.txt]` 与 `ja_docs_cli.txt` 样本。

`/docs/providers` 的三语术语对照（docs 侧术语正典）：

| en | zh-CN | ja |
|---|---|---|
| Model providers | 模型服务 | —（英文标题） |
| Secrets | 密钥 | —（英文标题） |
| Chief | 总管 | —（英文标题） |
| Skills | 技能 | —（英文标题） |
| Memory | 记忆 | —（英文标题） |
| Schedules | 定时重跑 | —（英文标题） |
| Platform machines | 平台机器 | —（英文标题） |
| Repos on Todos | Todos 托管仓库 | —（英文标题） |

**只有 zh-CN 翻译了 docs 页面标题**；ja 的 31 篇 docs `<title>` 全部保持英文原样（实测仅 `更新履歴 — Todos` 即 changelog 一条译出），zh-TW 同理。故 docs 侧术语对照只在 en↔zh-CN 之间成立。

定价/营销侧术语对照（同页四语实测）：

| en | zh-CN | zh-TW | ja |
|---|---|---|---|
| Platform machines | **云端沙箱** | 平台機器 | プラットフォームのマシン |
| Platform-hosted repositories | **托管仓库** | 託管倉庫 | プラットフォームのリポジトリ |
| Built-in models | 内置模型 | 內建模型 | 組み込みモデル |
| Monthly credits | 每月积分 | 每月積分 | 月間クレジット |
| Parallel builds | 并行构建 | 並行建置 | 並行ビルド |
| Free / Pro | 免费版 / 专业版 | 免費版 / 專業版 | Free / Pro（**日文不译 Free/Pro**） |
| Chief | 总管 | 總管 | Chief（**日文营销侧不译 Chief**） |
| Docs / Get the app / Pricing / Features | 文档 / 下载 / 定价 / 功能 | 文件 / 下載 / 定價 / 功能 | ドキュメント / アプリを入手 / 料金 / 機能 |
| Kanban | 看板 | 看板 | **ボード** |

⚠️ 复刻注意：zh-CN 把 `Platform machines` 译作 **云端沙箱**，而 zh-TW/ja 保留「平台机器 / プラットフォームのマシン」字面；`Built-in models` zh-TW 作 **內建模型**（非 内置）。四语不是简繁转换关系，是各自独立译文（如 ja 营销侧保留 Chief/Free/Pro 英文、docs 侧却用 チーフ）。

---

## 9. 【推断】条目汇总（共 9 条）

1. `/compare`、`/use-cases` 是「路由已注册、内容未发布」（依据：404 但 changelog 称首条以 draft 发布）。
2. 正文基准字号 14px，13px=次级密集文本，11px/10px=caption 与微缩 mock，营销大标题用 1.625rem/2rem 而非 `text-3xl`（依据：类词频）。
3. `checkout-*` keyframes 表明升级走 Stripe checkout 风格动画（依据：命名 + changelog "the Stripe return"）。
4. 存在 iOS 原生 App 但不在公开营销主推路径上（依据：AASA 有 `dev.todos.app`，而 `/install` 只推 PWA、无 App Store 链接）。
5. docs 站内搜索为前端内嵌索引或走 `/llms-full.txt` 类静态语料（依据：6 个候选索引端点全 404，无任何搜索 API）。
6. 定价表格注「chief conversations do not use a slot」是较新口径，同页 FAQ 的相反表述可能未同步（依据：同页两处冲突，docs_todos 的槽释放规则支持表格注）。
7. `[llms.txt]` 的 "No usage bills, no credits" 是过时营销文案，以定价页与 JSON-LD 为准（依据：与 `Monthly credits 35,000` 直接矛盾）。
8. 订阅 OAuth 属 Free/Pro 共有能力（依据：`/docs/providers` 全文无 plan 限定，Free 定位即 BYOK/BYOC）。
9. 9 phase → 6 看板列的折叠映射中，`To Do`+`Queued`→`Backlog` 这一段为本票推得（其余两段有 changelog 原文支撑，见 §7.4）。

---

## 10. 本次未覆盖 / 复刻前需补的缺口

1. **登录后界面全量**（`/app/**`）：真实看板、任务详情、Chief 悬浮球、review 视图的实际渲染与交互态 —— 另有票负责；本票只提供了它的营销 mock 与 changelog 行为描述作为间接正典。
2. **二进制素材本体**：两个 woff2、9 个 png 图标/截图、46 张 splash 均只记 URL+HTTP 码+字节数（`[asset-manifest.json]`），未入库。CSS/JS 文件名带 content hash，`/_next/static/` 路径不可变；若需逐像素比对需另行下载原件。
3. **JS chunk 内部**：未解析 `/_next/static/chunks/*.js`（Next.js RSC payload 与前端逻辑），文案 i18n 字典在 bundle 内的键名未提取 —— 若要 1:1 复刻文案键结构需补。
4. **Stripe/支付流程**、`/qr`、`/enroll`、`/invite`、`/_mp`、`/admin`、`/embed`：robots 禁止且需登录，未触碰。
5. **`/llms-full.txt` 未逐节展开对照**：已整份入库（311 KB），本报告只引用其中 providers / platform-machines / concepts / todos / chief / inbox / permissions / cli 八篇；其余 24 篇的行为细节待后续票按需用。
6. **模型 catalog 全量**：`/docs/providers` 只给规则不给表；具体 700+ 模型的 id / 定价 / 能力位需走登录后 providers 页或应用内 API。
