# R8 · pacman TS 技术栈选型调研

- **日期**：2026-09-17（所有版本号与发布日期均为当日实测）
- **票号**：xiechimon/pacman #22（wayfinder research）
- **目的**：为 nanobot（Python ≥3.11，v0.3.5）→ pacman（TypeScript 全栈复刻，npm scoped 包）逐项选定 TS 技术栈，给出候选比较、明确推荐与风险/缺口。

---

## 调研方法

1. **版本号与发布日期**：全部来自 npm registry 实测（`https://registry.npmjs.org/<pkg>` 完整 packument 的 `dist-tags.latest` + `time` 字段，以及 `/-/v1/search`、`/-/package/<pkg>/dist-tags` 端点），不凭记忆写版本号。
2. **维护状态**：GitHub API（`archived`、`pushed_at`、stars、open issues）+ 官方 docs/repo README 实读。
3. **平台事实**（Node LTS 时间线、node:sqlite stability 等）：nodejs.org 官方页面、`nodejs/Release` schedule.json、`nodejs/node` 对应版本 tag 下的 `doc/api/*.md` 原文。
4. **标注规则**：凡未能联网核实到具体版本/日期/状态的，显式标注「未核实」；能力性描述以官方 docs 链接为出处。
5. npm 包引用格式：`名称 版本（发布日期）`，链接指向 npm 页面或官方 repo/docs。

---

## 总对照表

> 上游 Python 依赖 → TS 候选（latest 版本 @ 发布日期，2026-09-17 实测）→ 推荐 → 主要风险/缺口。详述见对应小节。

| # | 领域 | 上游 Python | TS 候选 | **推荐** | 主要风险/缺口 |
|---|------|-------------|---------|----------|----------------|
| 1 | runtime | CPython ≥3.11 | Node 24 LTS（24.21.0）/ Bun 1.4.2 / Deno 2.9.7 | **Node 24 LTS**（engines ≥22.13） | node:sqlite 仍 1.2-RC；原生模块随 Node 大版本需重编译 |
| 2 | HTTP+WS 框架 | aiohttp + websockets | Hono 4.13.8 / Fastify 5.12.5 / node:http+ws 8.21.3 | **Hono + @hono/node-server 2.1.1** | @hono/node-ws 已弃用（WS 并入 node-server）；Hono 插件生态小于 Fastify |
| 3 | validation+config | pydantic + pydantic-settings | zod 4.6.5 / valibot 1.5.0 / arktype 2.2.3 | **zod v4 + 自建分层 Settings loader** | pydantic-settings 无 1:1 等价（需薄层自建） |
| 4 | 存储 | JSONL + MEMORY.md（无 DB） | node:fs 文件存储 / better-sqlite3 13.0.3 / node:sqlite（1.2-RC）/ drizzle-orm 0.45.2 | **复刻文件存储 + SessionStore 接口抽象** | node:sqlite 未 stable；better-sqlite3 为原生模块 |
| 5 | telegram | python-telegram-bot | grammY 1.46.0 / telegraf 4.16.3 | **grammY** | telegraf 停更（2024-02 后无发布，README 标 Bot API 7.1）；grammY 中间件模型与 PTB 不同需重写 runtime |
| 6 | tokenizer | tiktoken ≥0.12 | gpt-tokenizer 4.0.0 / js-tiktoken 1.0.21 / tiktoken(wasm) 1.0.22 | **js-tiktoken**（gpt-tokenizer 备选） | dqbd/tiktoken 系全部停更于 2025-08-09；Claude 无官方 tokenizer（上游同样近似） |
| 7 | cron 解析 | croniter ≥6 | cron-parser 5.10.1 / croner 10.0.1 / node-cron 4.6.0 | **cron-parser** | 无明显风险；node-cron 是调度器与上游用法不对口 |
| 8 | git | dulwich ≥0.22 | isomorphic-git 1.42.2 / simple-git 3.36.0 | **isomorphic-git** | 纯 JS 性能弱于 git CLI；复杂 merge/shallow 覆盖不全（gitstore 场景够用） |
| 9a | pdf 解析 | pypdf ≥5 | unpdf 1.8.1 / pdfjs-dist 6.3.289 / pdf-parse 2.4.5 | **unpdf** | pdf-parse v1 曾停更 7 年，v2 为 TS 重写（历史短） |
| 9b | docx 解析 | python-docx ≥1.1 | mammoth 1.12.3 / officeparser 8.0.0 | **mammoth**（文本/HTML 提取） | 结构化读写（python-docx 式）无等价，需要时 jszip+fast-xml-parser 自写 |
| 9c | xlsx 解析 | openpyxl ≥3.1 | exceljs 4.4.0 / SheetJS（CDN 发行）/ officeparser 8.0.0 | **exceljs**（读写）+ 风险注记 | exceljs 半停更（npm 2023-10、808 open issues）；SheetJS npm 版冻结在 0.18.5（2022-03），官方源已迁 cdn.sheetjs.com |
| 9d | pptx 解析 | python-pptx ≥1.0 | officeparser 8.0.0 / node-pptx-parser 1.0.1 / 自写 jszip+XML | **officeparser**（只读提取） | **缺口**：无 python-pptx 级结构化读写库；写侧仅 @office-kit/pptx 0.13.0（0.x） |
| 10 | 搜索+readability | ddgs + readability-lxml + lxml-html-clean | duck-duck-scrape 2.2.7 / @mozilla/readability 0.6.0 + linkedom 0.18.13 / sanitize-html 2.17.7 | **SearchProvider 抽象 + duck-duck-scrape；readability + linkedom** | duck-duck-scrape 半停更（npm 2025-01），DDG 无官方 API，随时可能断 |
| 11 | 模板 | jinja2 | nunjucks 3.2.4 / eta 4.6.0 / 原生模板字符串 | **nunjucks** | 维护模式（npm 停于 2023-04）；eta 语法非 jinja2，迁移成本高 |
| 12 | 日志 | loguru | pino 10.3.1（+pino-pretty 13.1.3）/ consola 3.4.2 | **pino** | 无明显风险；Node 内置无完整 logger |
| 13a | CLI 参数 | typer | commander 15.0.0 / yargs 18.1.0 / clipanion 4.0.0-rc.4 | **commander** | clipanion latest 仍是 RC（2024-09），不选 |
| 13b | 交互提示 | questionary + prompt-toolkit | @clack/prompts 1.8.1 / @inquirer/prompts 8.7.2 / prompts 2.4.2 | **@clack/prompts** | prompts（terkelg）停更（2021-10）；REPL 用内置 readline/promises |
| 13c | TUI 渲染 | rich | ink 7.1.1 | **ink（按需）** | 仅 live 面板/富文本渲染需要；普通输出用 @clack + pino |
| 14a | 文件监听 | watchfiles ≥1.1 | chokidar 5.0.0 / node:fs.watch | **chokidar 5** | v5 为 ESM-only、Node ≥20.19；v4 起移除 glob（配 minimatch 10.2.6） |
| 14b | 文件锁 | filelock ≥3.25 | proper-lockfile 4.1.2 / 自建 O_EXCL | **proper-lockfile**（或 core 内自建 ~50 行） | proper-lockfile 停更（npm 2021-01、repo 2023-10），机制成熟风险低 |
| 15 | 模糊匹配 | rapidfuzz ≥3.14 | fuzzball 2.2.6 / rapidfuzz-js 0.12.0 / fast-levenshtein 3.0.0 | **fuzzball** | 是 TheFuzz 移植而非 rapidfuzz 本体，分数不逐位一致需对拍；rapidfuzz-js 过年轻（repo 1 star） |
| 16 | JSON 修复 | json-repair ≥0.57 | jsonrepair 3.15.0 | **jsonrepair** | 与 Python json-repair 为**独立实现**（非移植），边缘行为差异需用上游用例对拍 |
| 17 | 测试 | pytest 全家桶 | vitest 5.0.1 / node:test（Stability 2） | **vitest（projects 模式）** | 上游 webui 用 vitest 2.1.8，与 monorepo 主版本有跨代差（pnpm 按包隔离可解） |
| 18 | monorepo | —（上游单包） | pnpm 12.4.2 workspaces / turbo 2.10.13 / nx 23.2.1 | **pnpm workspaces（+catalog），CI 变慢后再加 turbo** | nx 对 5 包规模过重 |
| 19 | 前端 | 上游 webui 本就是 TS | React 18.3.1（现 19.3.0）/ Tailwind 3.4.17（现 4.3.3，有 v3-lts 3.4.19）/ Vite 5（现 8.3.0）/ TS 5.7（现 7.0.2） | **复刻期沿用上游 pin，升级后置** | Tailwind 4 / React 19 / Vite 8 / TS 7 均为破坏性大版本，升级各自独立成票 |
| 附 | LLM SDK | anthropic / openai | @anthropic-ai/sdk 0.126.0 / openai 7.17.0 | 官方 SDK | anthropic SDK 仍 0.x 主版本，breaking 风险需严格 pin |
| 附 | MCP | mcp ≥1.26 | @modelcontextprotocol/sdk 1.30.0 | 官方 SDK | 1.x 稳定线 |
| 附 | 编码检测 | chardet | chardet 2.2.0 / jschardet 3.1.4 | **chardet** | jschardet 为 LGPL-2.1+（license 注意）且停于 2024-09 |
| 附 | YAML | pyyaml | yaml 2.9.1 | **yaml（eemeli）** | 3.0 尚在 prerelease（3.0.0-2） |
| 附 | 二维码 | qrcode[pil] | qrcode 1.5.4 | **qrcode** | 与上游 webui 同版本；发布较久（2024-08）但功能冻结面小 |
| 附 | 进程标题 | setproctitle | 内置 `process.title`（可写） | **process.title** | **缺口**：无法如 Python setproctitle 重写任意 argv，仅覆盖改进程名主用例 |
| 附 | HTTP 客户端 | httpx[socks] | 内置 fetch（v21 起稳定）+ undici 8.10.2 + socks-proxy-agent 10.1.0 | **内置 fetch + undici dispatcher** | SOCKS 代理需 undici 自定义 dispatcher 组合 |
| 附 | WS 客户端 | websockets（客户端侧） | 内置 WebSocket（v22.4 起稳定）/ ws 8.21.3 | **内置 WebSocket**（服务端用 ws） | 内置仅客户端 |

---

## 分节详述

### 1. Runtime：Node 24 LTS

**事实（全部官方源核实）**：

- Node 发布计划（[nodejs/Release schedule.json](https://github.com/nodejs/Release/blob/main/schedule.json) + [nodejs.org/en/about/previous-releases](https://nodejs.org/en/about/previous-releases)）：

  | 线 | 首发 | 转 LTS | 转 maintenance | EOL | 现状（2026-09-17） |
  |---|---|---|---|---|---|
  | v20 Iron | 2023-04-18 | 2023-10-24 | 2024-10-22 | **2026-04-30（已 EOL）** | 不可用 |
  | v22 Jod | 2024-04-24 | 2024-10-29 | 2025-10-21 | 2027-04-30 | Maintenance LTS（最新 22.23.2） |
  | v24 Krypton | 2025-05-06 | 2025-10-28 | 2026-10-20 | **2028-04-30** | **当前 LTS**（最新 24.21.0，官网标 "Latest LTS"） |
  | v26 | 2026-05-05 | 2026-10-28 | 2027-10-20 | 2029-04-30 | Current（最新 26.9.0，下月转 LTS） |

- **原生 fetch**：v18.0.0 起免 flag，v21.0.0 起「No longer experimental」（[globals 文档](https://nodejs.org/docs/latest-v24.x/api/globals.html)，基于 undici）。
- **原生 WebSocket（客户端）**：v22.0.0 免 flag、v22.4.0 起「No longer experimental」（同上 globals 文档）。**服务端 WS 无内置**，需 [ws](https://www.npmjs.com/package/ws)。
- **node:sqlite**：v22.5.0 引入；v22.13.0/v23.4.0 移除 `--experimental-sqlite` flag；v22 线文档 Stability **1.1（Active development）**，v24.15.0/v25.7.0 起升为 **1.2（Release candidate）**，v26.9.0 仍是 1.2（[v22 docs](https://nodejs.org/docs/latest-v22.x/api/sqlite.html) / [v24 docs](https://nodejs.org/docs/latest-v24.x/api/sqlite.html)）。**尚未 stable，不作为主存储**（见第 4 节）。
- **Bun**：最新 v1.4.2（2026-09-05，[GitHub releases](https://github.com/oven-sh/bun/releases)）。内置 [bun:sqlite](https://bun.com/docs/api/sqlite)（同步 API；docs 页未标注稳定性等级）。无 LTS 概念、发版节奏快。
- **Deno**：最新 v2.9.7（2026-09-17，[GitHub releases](https://github.com/denoland/deno/releases)）。`node:sqlite` 兼容层自 Deno 2.2 起提供（[docs.deno.com/api/node/sqlite](https://docs.deno.com/api/node/sqlite/)，部分子 API 标 unstable）。

**候选比较**：

| | Node 24 LTS | Bun 1.4.2 | Deno 2.9.7 |
|---|---|---|---|
| 稳定性承诺 | LTS 至 2028-04-30 | 无 LTS | 无正式 LTS 承诺 |
| 原生模块（better-sqlite3 等 N-API） | 一等公民 | 兼容层，个别包有边缘问题（未逐一核实） | Node 兼容层，同样存在边缘情况 |
| 与上游服务形态匹配 | aiohttp（长驻 HTTP 服务）+ websockets（WS 服务）→ node:http/ws 直接对应，事件循环模型一致 | 同样可行 | 同样可行 |
| 工具链生态（vitest/turbo/pnpm） | 全兼容 | 良好 | 良好（npm 兼容） |

**推荐**：**Node 24 LTS** 为主运行时（`engines: >=22.13.0`，22.13 是 node:sqlite 免 flag 的最低 22.x 版本；CI 矩阵跑 22/24，24 为主）。理由：LTS 时间线覆盖项目生命周期、原生模块兼容最稳、npm 生态零摩擦。选 Hono（第 2 节）保留未来平移到 Bun/Deno 的选项，但复刻期不为第二运行时付出验证成本。

**风险**：Node 大版本升级时原生模块（better-sqlite3、jsdom 的 canvas 可选依赖等）需重编译/等 prebuild；node:sqlite 在 v22 线仍是 1.1，跨线行为可能不一致。

---

### 2. HTTP + WS 框架：Hono + @hono/node-server

上游形态：aiohttp（api extra，HTTP 服务 + 给 webui 的接口）+ websockets（WS 服务/客户端），需要 SSE（流式输出到 webui）。

**候选**（npm 实测）：

| | [hono](https://www.npmjs.com/package/hono) 4.13.8（2026-09-15） | [fastify](https://www.npmjs.com/package/fastify) 5.12.5（2026-09-16） | 原生 node:http + [ws](https://www.npmjs.com/package/ws) 8.21.3（2026-08-07） |
|---|---|---|---|
| SSE | **内置** `streamSSE()`（hono/streaming，[docs](https://hono.dev/docs/helpers/streaming)） | 需插件：[@fastify/sse](https://www.npmjs.com/package/@fastify/sse) 0.6.0（2026-07-27）或 [fastify-sse-v2](https://www.npmjs.com/package/fastify-sse-v2) 4.2.2（2026-01-27） | 手写响应头 + 流 |
| WS 集成 | WS 支持**内置于 [@hono/node-server](https://www.npmjs.com/package/@hono/node-server) 2.1.1（2026-08-14）**：`serve()` 的 `websocket` 选项 + `upgradeWebSocket`，底层用 `ws`（`noServer: true`）。**[@hono/node-ws](https://www.npmjs.com/package/@hono/node-ws) 1.3.1 已弃用**（[官方 Node.js 指南](https://hono.dev/docs/getting-started/nodejs)） | [@fastify/websocket](https://www.npmjs.com/package/@fastify/websocket) 11.3.0（2026-07-08），底层同为 ws | ws 直接挂 `upgrade` 事件 |
| 运行时耦合 | 框架无关（Node/Bun/Deno/edge 均可跑） | Node 专属 | Node 专属 |
| schema 校验 | @hono/zod-validator 与 zod 集成 | 内置 JSON Schema 校验（ajv） | 无 |
| 生态/成熟度 | 中间件生态增长快但年轻 | 插件生态最大、生产验证最久 | 零依赖 |

**推荐**：**Hono 4.13.8 + @hono/node-server 2.1.1 + ws**。理由：SSE/WS 都是一等支持、与 zod 天然集成、runtime 无关性与「复刻后可选多运行时」的余量匹配；上游 aiohttp 的路由 + 中间件形态迁移直观。注意用内置 WS 路径而非已弃用的 @hono/node-ws。

**风险/缺口**：Hono 在 Node 上的生产案例少于 Fastify；若后续需要成熟插件（rate-limit、multipart 等重型场景），Fastify 5（next 已到 6.0.0-alpha.4）是备选。HTTP 客户端侧：内置 fetch（稳定）+ [undici](https://www.npmjs.com/package/undici) 8.10.2（2026-09-04）自定义 dispatcher；上游 httpx[socks] 的 SOCKS 代理用 [socks-proxy-agent](https://www.npmjs.com/package/socks-proxy-agent) 10.1.0（2026-06-08）+ undici 组合覆盖。

---

### 3. Validation + Config：zod v4 + 自建分层 Settings

上游层次：pydantic（模型/schema 校验）+ pydantic-settings（env/dotenv/文件分层配置）。

**候选**（npm 实测）：

| | [zod](https://www.npmjs.com/package/zod) 4.6.5（2026-09-13） | [valibot](https://www.npmjs.com/package/valibot) 1.5.0（2026-09-09） | [arktype](https://www.npmjs.com/package/arktype) 2.2.3（2026-07-07） |
|---|---|---|---|
| 现状 | **Zod 4 已 stable**、4.6 为当前线（[zod.dev/v4](https://zod.dev/v4)）；提供 v3/v4 共存兼容路径 | 1.x 稳定，模块化、bundle 小 | 2.x 稳定，主打性能与新语法 |
| pydantic 语义对照 | schema→类型推导、refine、discriminated union、JSON Schema 输出，覆盖面最接近 | 覆盖大部分，生态小 | 覆盖大部分，社区最小 |
| 与 Hono/生态集成 | @hono/zod-validator、AI SDK 生态默认 | 有适配 | 有适配 |

**推荐**：**zod 4.6.5**。事实上的 TS pydantic 等价物，生态（Hono、MCP SDK、AI 工具链）默认选它。

**config 分层（pydantic-settings 对照）**：TS 无 1:1 等价库 → **缺口，用薄层自建**：`Settings` 类 = zod schema + 加载器，按上游语义实现优先级（显式入参 > 进程 env > .env > 配置文件(YAML/TOML) > 默认值）。env 层可选 [@t3-oss/env-core](https://www.npmjs.com/package/@t3-oss/env-core) 0.13.11（2026-03-22）或 [envalid](https://www.npmjs.com/package/envalid) 8.2.0（2026-06-09），但两者都只覆盖 env 单层，完整分层仍需自写（预估 <200 行 + 测试）。

**风险**：zod 4 与旧生态（部分库仍 ship zod 3 类型）偶有类型摩擦，用官方共存方案（`zod/v3` subpath）过渡。

---

### 4. 存储：先复刻文件存储，SQLite 后置

上游事实：session = JSONL 文件 + MEMORY.md，**无数据库**。

**取舍**：

| 方案 | 优点 | 缺点 |
|---|---|---|
| **A. 直接复刻文件存储（node:fs）** | 与上游 1:1，diff 面最小；数据目录可与上游互通（同格式）；零依赖零原生模块 | 无索引/并发查询（上游本来也没有）；JSONL 追加 + 定期 compact 需自己写对 |
| B. better-sqlite3 | 成熟同步 API，[13.0.3](https://www.npmjs.com/package/better-sqlite3)（2026-08-05，MIT，repo [WiseLibs/better-sqlite3](https://github.com/WiseLibs/better-sqlite3) 活跃） | 原生模块（Node 大版本升级需 prebuild/重编译）；偏离上游数据形态 |
| C. node:sqlite | 零安装 | **Stability 1.1（v22 线）/ 1.2 Release candidate（v24.15+、v26.9）**，未 stable（[v24 docs](https://nodejs.org/docs/latest-v24.x/api/sqlite.html)） |
| D. drizzle-orm | 若未来上关系型查询 | [0.45.2](https://www.npmjs.com/package/drizzle-orm)（2026-03-27），1.0 在 rc（dist-tag `rc`=1.0.0-rc.5）；现阶段是过度设计 |

**推荐**：**A（文件存储）**，但在 core 内定义 `SessionStore` / `MemoryStore` 接口，把「JSONL + MEMORY.md」作为默认实现；B（better-sqlite3）作为未来可选后端预留（接口就位即可，不提前引入）。C 在 stability 到 2 之前不用于生产路径。D 仅在真的出现关系型查询需求时再评估。

**风险**：JSONL 并发追加语义（上游 filelock 配合）要一并复刻，见第 14b 节。

---

### 5. Telegram：grammY

**维护状态对比**（npm + GitHub + README 实测，2026-09-17）：

| | [grammy](https://www.npmjs.com/package/grammy) 1.46.0 | [telegraf](https://www.npmjs.com/package/telegraf) 4.16.3 |
|---|---|---|
| 最后发布 | **2026-08-26**（3 周前） | **2024-02-29**（约 2.5 年前） |
| repo 活动 | [grammyjs/grammY](https://github.com/grammyjs/grammY) pushed 2026-08-26 | [telegraf/telegraf](https://github.com/telegraf/telegraf) pushed 2025-01-11 |
| Bot API 覆盖 | README 徽章标 **Bot API 10.3** | README 徽章仍标 **Bot API 7.1** |
| 当前 Bot API | **10.3（2026-08-24）**（[core.telegram.org/bots/api](https://core.telegram.org/bots/api)） | 落后约 3 个大版本 |
| 运行时 | Node.js / Deno（README） | Node.js / Deno |

**推荐**：**grammY 1.46.0**。活跃、TS-first、Bot API 覆盖跟到当前版本（10.3）；文档站 [grammy.dev](https://grammy.dev/)。telegraf 事实上进入低维护，新 Bot API 特性（如近年 gifts/paid media 等）跟进滞后。

**风险/缺口**：上游 `nanobot/channels/telegram/runtime.py` 基于 python-telegram-bot 的 handler/filter 模型，grammY 是 middleware + composer 模型，复刻时是「按语义重写」而非逐行翻译；grammY 官方插件（session、ratelimit、menu）可覆盖常见需求。

---

### 6. Tokenizer：js-tiktoken（gpt-tokenizer 备选）

**候选**（npm 实测）：

| | [js-tiktoken](https://www.npmjs.com/package/js-tiktoken) 1.0.21 | [tiktoken](https://www.npmjs.com/package/tiktoken) 1.0.22 / [@dqbd/tiktoken](https://www.npmjs.com/package/@dqbd/tiktoken) 1.0.22 | [gpt-tokenizer](https://www.npmjs.com/package/gpt-tokenizer) 4.0.0 |
|---|---|---|---|
| 发布日期 | 2025-08-09 | 均 2025-08-09 | **2026-08-16** |
| 实现 | 纯 JS BPE，可加载 tiktoken 编码文件 | Rust→wasm 绑定（两个包同源） | 纯 TS，按模型入口（ESM/CJS） |
| repo | [dqbd/tiktoken](https://github.com/dqbd/tiktoken)（pushed 2025-08-09，1072★） | 同左 | [niieani/gpt-tokenizer](https://github.com/niieani/gpt-tokenizer) |
| 维护 | 全家停更约 13 个月 | 同左 | 活跃（v4 主版本 2026-08） |

**推荐**：**js-tiktoken**——与上游 `tiktoken`（Python）语义最接近（同为 tiktoken 编码体系、支持自定义 BPE rank 表），纯 JS 无 wasm 资产加载问题（对打包/多运行时友好）。若只关心 OpenAI 词表且想要活跃维护，**gpt-tokenizer 4.0.0** 是更新鲜的选择。

**风险/缺口**：dqbd 系（js-tiktoken/tiktoken/@dqbd/tiktoken）停更于 2025-08-09——tokenizer 功能面稳定，但**新模型词表（如未来 o200k 后继）需自行内嵌 rank 文件**（js-tiktoken 支持 `Tiktoken` 自定义构造，风险可控）。Claude 无公开 tokenizer，上游同样用 tiktoken 近似计数，复刻保持同等近似即可。

---

### 7. Cron 解析：cron-parser

上游用法（已核实定位）：croniter 用于 **cron 表达式 → 下次触发时间**的解析，不是调度器。

| | [cron-parser](https://www.npmjs.com/package/cron-parser) 5.10.1 | [croner](https://www.npmjs.com/package/croner) 10.0.1 | [node-cron](https://www.npmjs.com/package/node-cron) 4.6.0 |
|---|---|---|---|
| 发布日期 | **2026-09-12**（5 天前） | 2026-02-01 | 2026-07-05 |
| 定位 | 纯解析（parseExpression → next/prev），**croniter 直接对应** | 解析 + 可选调度，零依赖 | 调度器（包装解析） |
| repo | [harrisiirak/cron-parser](https://github.com/harrisiirak/cron-parser) | [hexagon/croner](https://github.com/hexagon/croner) | [node-cron/node-cron](https://github.com/node-cron/node-cron) |

**推荐**：**cron-parser 5.10.1**（功能定位与上游一致，维护活跃）。**croner** 为备选——若复刻中还需要内嵌调度（定时任务执行），croner 一库两用可减一个依赖。

**风险**：croniter 6.x 的一些边缘语义（如 `year` 扩展字段、秒级精度选项）与 cron-parser 不完全一致，迁移时对上游测试用例对拍 next-fire 结果。

---

### 8. Git：isomorphic-git

上游：dulwich（纯 Python git 实现）用于 memory gitstore（`nanobot/utils/gitstore.py`，本地 add/commit/log 型操作）。

| | [isomorphic-git](https://www.npmjs.com/package/isomorphic-git) 1.42.2 | [simple-git](https://www.npmjs.com/package/simple-git) 3.36.0 |
|---|---|---|
| 发布日期 | **2026-09-11** | 2026-04-12 |
| 实现 | **纯 JS**（与 dulwich「纯语言实现」哲学一致），Node+浏览器 | shell 出系统 git |
| repo 活动 | [isomorphic-git/isomorphic-git](https://github.com/isomorphic-git/isomorphic-git) pushed 2026-09-11，8353★ | [steveukx/git-js](https://github.com/steveukx/git-js) |
| 依赖前提 | 无 | 部署环境必须有 git 二进制 |

**推荐**：**isomorphic-git**——上游选 dulwich 就是为了不依赖系统 git，纯 JS 保持同一约束（Docker 镜像可裁剪、跨平台一致）。gitstore 所需的 init/add/commit/log/branch 均在 API 面内。

**风险**：纯 JS 实现在大仓库上性能弱于 git CLI；复杂 merge、shallow clone、LFS 等边缘特性覆盖不全——memory gitstore 场景（小仓库、线性提交）风险低。若未来需要重型 git 操作，simple-git 3.36.0（活跃）作为升级路径。

---

### 9. Doc Parsers（弱项显式标注）

#### 9a. PDF（上游 pypdf ≥5）

| | [unpdf](https://www.npmjs.com/package/unpdf) 1.8.1 | [pdfjs-dist](https://www.npmjs.com/package/pdfjs-dist) 6.3.289 | [pdf-parse](https://www.npmjs.com/package/pdf-parse) 2.4.5 |
|---|---|---|---|
| 发布日期 | **2026-08-13** | 2026-08-29 | 2025-10-20 |
| 说明 | unjs 出品，封装 pdfjs，`extractText` 简洁 API，Node/serverless/浏览器通用 | Mozilla pdf.js 官方 npm 发行，canonical 引擎 | v1（1.1.1，2018-10-24）停更约 7 年；**v2 为纯 TS 重写**（repo 描述：text/images/tabular data，浏览器+Node），repo [mehmet-kozan/pdf-parse](https://github.com/mehmet-kozan/pdf-parse) pushed 2026-05-04；dist-tags：`minor`=1.1.4（legacy）、latest=2.4.5 |
| license | MIT | Apache-2.0 | Apache-2.0 |

**推荐**：**unpdf**（活跃、API 面对口「提取文本」、unjs 维护）；需要精细控制页面/渲染时用 **pdfjs-dist** 直连。pdf-parse v2 功能面最大（含表格/图片）但重写历史短（2.0 起于 2025），观察名单。

#### 9b. DOCX（上游 python-docx ≥1.1）

- **[mammoth](https://www.npmjs.com/package/mammoth) 1.12.3（2026-09-12，5 天前发布，BSD-2-Clause）**——repo [mwilliamson/mammoth.js](https://github.com/mwilliamson/mammoth.js) 重新活跃。docx → 语义 HTML/纯文本，适配「读内容喂给 LLM」的主用例。
- 备选：[officeparser](https://www.npmjs.com/package/officeparser) 8.0.0（见 9d，多格式统一入口）。
- **缺口**：python-docx 式**结构化读写**（段落/样式/表格对象模型）无成熟 TS 等价；需要时用 [jszip](https://www.npmjs.com/package/jszip) 3.10.2（2026-09-08，MIT OR GPL-3.0 双许可，选 MIT）+ [fast-xml-parser](https://www.npmjs.com/package/fast-xml-parser) 5.11.1（2026-08-27）自写 OOXML 访问。

#### 9c. XLSX（上游 openpyxl ≥3.1）

| | [exceljs](https://www.npmjs.com/package/exceljs) 4.4.0 | SheetJS（[xlsx](https://www.npmjs.com/package/xlsx) npm 0.18.5） | officeparser 8.0.0（只读） |
|---|---|---|---|
| 发布日期 | **2023-10-19**；repo pushed 2025-01-21，**808 open issues**（半停更） | **2022-03-24（冻结）**；官方 docs 明言 npm「registry is out of date」，权威发行源是 **cdn.sheetjs.com** tarball（[docs](https://docs.sheetjs.com/docs/getting-started/installation/nodejs)）；GitHub repo pushed 2024-04-18 | 2026-09-16（活跃） |
| 能力 | 读写 xlsx/csv，流式 | 保真度最高的读写 | 提取文本/AST/Markdown |
| license | MIT | Apache-2.0（CE） | MIT |

**推荐**：**exceljs**（npm 原生、MIT、读写全）——接受半停更风险（xlsx 格式本身稳定，功能面已够用）；对保真度有硬要求时改用 **SheetJS 官方 CDN tarball**（`https://cdn.sheetjs.com/xlsx-<ver>/xlsx-<ver>.tgz`，注意安装源脱离 npm registry 的供应链流程差异）；只读场景可并入 officeparser。

#### 9d. PPTX（上游 python-pptx ≥1.0）——**显式缺口（读侧有解，写侧无解）**

npm 搜索实测（2026-09-17，`/-/v1/search?text=pptx`）：**不存在 python-pptx 级的成熟结构化读写库**。可用选项：

| 包 | 版本（发布） | 能力 |
|---|---|---|
| [officeparser](https://www.npmjs.com/package/officeparser) | **8.0.0（2026-09-16，前一日发布）** | **读取** docx/pptx/xlsx/odt/odp/ods/pdf/rtf/csv/md/html → AST/Markdown/HTML/文本/RAG chunks（repo [harshankur/officeParser](https://github.com/harshankur/officeParser) pushed 2026-09-16，MIT） |
| [node-pptx-parser](https://www.npmjs.com/package/node-pptx-parser) | 1.0.1（2025-02-17） | pptx 文本提取（保留格式） |
| [@jvmr/pptx-to-html](https://www.npmjs.com/package/@jvmr/pptx-to-html) | 1.1.2（2026-09-03） | pptx → HTML |
| [@office-kit/pptx](https://www.npmjs.com/package/@office-kit/pptx) | 0.13.0（2026-09-13） | 生成/编辑 OOXML PresentationML（**0.x，年轻**） |
| [pptxgenjs](https://www.npmjs.com/package/pptxgenjs) | 4.0.1（2025-06-26） | 仅生成 |
| 自写 | jszip 3.10.2 + fast-xml-parser 5.11.1 | 读 `ppt/slides/slide*.xml` 文本节点，工作量可控 |

**推荐**：读侧用 **officeparser**（活跃、统一覆盖 pptx/docx/xlsx/pdf，可能一个依赖吃掉 9a-9d 的只读需求）；若确认上游 python-pptx 仅用于内容读取，则缺口被 officeparser 覆盖。**结构化写 pptx 标注为缺口**（@office-kit/pptx 太年轻，暂缓依赖）。

---

### 10. Web Search / Fetch / Readability

**搜索（上游 ddgs）**：

- [duck-duck-scrape](https://www.npmjs.com/package/duck-duck-scrape) 2.2.7（**2025-01-09**，MIT）；repo [Snazzah/duck-duck-scrape](https://github.com/Snazzah/duck-duck-scrape) pushed 2025-03-20，231★——**半停更约 18 个月**。
- 结构性事实：DDG 无官方 web search API；上游 Python ddgs 同样是逆向公开端点，「随 DDG 改版而断」是两端共同固有风险，非 TS 特有。
- npm 搜索实测：无更活跃的通用 DDG 客户端（其余多为 MCP server 封装或图片搜索专用）。

**推荐**：core 内定义 **`SearchProvider` 接口**，默认实现 duck-duck-scrape；配一个 ~100 行的自建 fallback（`html.duckduckgo.com/html/` + linkedom/cheerio 解析），并预留可配置的第三方搜索 API（key 型）出口。不把搜索可用性绑死在单一半停更库上。

**Readability（上游 readability-lxml + lxml-html-clean）**：

| | [@mozilla/readability](https://www.npmjs.com/package/@mozilla/readability) 0.6.0 | DOM 实现 |
|---|---|---|
| 发布日期 | 2025-03-03（npm）；repo [mozilla/readability](https://github.com/mozilla/readability) pushed **2026-08-04**，11446★——本体活跃，npm 发版低频 | [linkedom](https://www.npmjs.com/package/linkedom) 0.18.13（2026-07-07，ISC，轻）/ [jsdom](https://www.npmjs.com/package/jsdom) 30.1.0（**2026-09-17 当日发版**，最兼容但重）/ [cheerio](https://www.npmjs.com/package/cheerio) 1.2.0（2026-01-23，非完整 DOM） |

**推荐**：**@mozilla/readability + linkedom**（对应上游 readability-lxml 的轻量路线），怪异页面回退 jsdom；cheerio 用于一般 HTML 抓取/解析。HTML 清洗（lxml-html-clean 对应）：[sanitize-html](https://www.npmjs.com/package/sanitize-html) 2.17.7（2026-08-13，MIT）；浏览器侧/webui 用 [dompurify](https://www.npmjs.com/package/dompurify) 3.4.15（2026-09-06，MPL-2.0 OR Apache-2.0）。

---

### 11. 模板：nunjucks

上游 jinja2 用于 prompt/skill 模板——**jinja2 语法兼容度是第一约束**（模板文件要能近乎原样搬运）。

| | [nunjucks](https://www.npmjs.com/package/nunjucks) 3.2.4 | [eta](https://www.npmjs.com/package/eta) 4.6.0 | 原生模板字符串 |
|---|---|---|---|
| 发布日期 | **2023-04-13** | 2026-04-25 | — |
| 维护 | repo [mozilla/nunjucks](https://github.com/mozilla/nunjucks) 未归档、pushed 2026-02-07、366 open issues——**维护模式** | repo [bgub/eta](https://github.com/bgub/eta)（registry 所示）活跃 | — |
| jinja2 兼容 | 官方文档自述 “Heavily inspired by jinja2”（[mozilla.github.io/nunjucks](https://mozilla.github.io/nunjucks/)）；继承/宏/过滤器/自定义 tag 齐备，**最接近** | EJS-like（`<%= %>`）语法，**不兼容** jinja2，模板需重写 | 无逻辑/继承 |

**推荐**：**nunjucks**（兼容性压倒活跃度；纯 JS、零原生依赖，功能冻结面 = 停更风险可控）。pin 版本 + 在 core 侧包一层 `TemplateRenderer` 接口，留出未来换引擎（或社区 fork）的缝。

**风险**：3 年无发布，若遇 Node 新版本兼容问题需自行 patch/fork；上游 jinja2 的少数扩展（如自定义 Python 函数注入）需用 nunjucks filters/globals 等价重写。

---

### 12. 日志：pino

| | [pino](https://www.npmjs.com/package/pino) 10.3.1（2026-02-09） | [consola](https://www.npmjs.com/package/consola) 3.4.2（2025-03-18） | Node 内置 |
|---|---|---|---|
| 定位 | 结构化 JSON、child logger、transports（文件/轮转/pretty） | 人眼友好 console 输出 | 无完整 logger（`util.styleText` 仅着色） |
| loguru 对照 | loguru 的「生产结构化 + 文件 rotation」面 | loguru 的「dev 漂亮 stderr」面 | — |

**推荐**：**pino + [pino-pretty](https://www.npmjs.com/package/pino-pretty) 13.1.3（2025-12-01）**：dev 用 pretty transport 还原 loguru 的开发体验，生产 JSON 输出 + 文件 transport 对应 loguru 的 rotation。consola 仅在 CLI 交互层做点缀（可选）。

---

### 13. CLI：commander + @clack/prompts + ink（按需）

上游：typer（参数解析）+ rich（渲染）+ prompt-toolkit（REPL）+ questionary（问答）。

**参数解析**：[commander](https://www.npmjs.com/package/commander) 15.0.0（2026-05-29，[tj/commander.js](https://github.com/tj/commander.js)）——typer 的直接对应（子命令/类型化 option/帮助生成），生态最稳。备选 [yargs](https://www.npmjs.com/package/yargs) 18.1.0（2026-07-26，链式 API 偏重）。[clipanion](https://www.npmjs.com/package/clipanion) latest 仍是 **4.0.0-rc.4（2024-09-06）**——RC 停滞，不选。

**交互提示**（questionary 对应）：**[@clack/prompts](https://www.npmjs.com/package/@clack/prompts) 1.8.1（2026-09-13，4 天前，[bombshell-dev/clack](https://github.com/bombshell-dev/clack)）**——现代 UI、活跃。备选 [@inquirer/prompts](https://www.npmjs.com/package/@inquirer/prompts) 8.7.2（2026-09-07，inquirer 的模块化重写，同样活跃）。[prompts](https://www.npmjs.com/package/prompts) 2.4.2 停更（2021-10-07），不选。prompt-toolkit 的 REPL 面用 Node 内置 `readline/promises`（Stability 2）。

**TUI 渲染**（rich 对应）：[ink](https://www.npmjs.com/package/ink) 7.1.1（2026-07-16；repo [vadimdemedes/ink](https://github.com/vadimdemedes/ink) pushed 2026-09-16，39887★）——React 式声明 TUI，覆盖 rich 的 live 布局/markdown/表格场景。**按需引入**：只在 CLI 需要 live 面板（如会话监视）时用；普通彩色输出交给 @clack/pino-pretty，避免全线背上 React 运行时。

---

### 14. 文件监听 / 锁

**监听**（上游 watchfiles）：

- **[chokidar](https://www.npmjs.com/package/chokidar) 5.0.0（2025-11-25，MIT，[paulmillr/chokidar](https://github.com/paulmillr/chokidar)）**。v5 官方 release notes：**ESM-only、最低 Node v20.19、readdirp v5**、Trusted Publishing 发布。**v4 起移除 glob 支持**（README）——glob 过滤配 [minimatch](https://www.npmjs.com/package/minimatch) 10.2.6（2026-07-27）。
- node:fs.watch 零依赖备选：recursive 监听自 **v19.1.0** 支持 Linux/AIX/IBMi，v24.16.0 新增 `ignore`（minimatch glob）选项（[fs docs](https://nodejs.org/docs/latest-v24.x/api/fs.html#fswatchfilename-options-listener)）；但官方 Caveats 自述「not 100% consistent across platforms」、NFS/Docker 下不可靠——watchfiles（Rust notify）的可靠性对标还是 chokidar。

**推荐**：**chokidar 5**（注意 ESM-only 对包 `type` 字段的约束，pacman 全线 ESM 即无摩擦）。

**锁**（上游 filelock）：[proper-lockfile](https://www.npmjs.com/package/proper-lockfile) 4.1.2（**2021-01-25**；repo [moxystudio/node-proper-lockfile](https://github.com/moxystudio/node-proper-lockfile) pushed 2023-10-25）——停更但机制成熟（lockdir + mtime 判活 + retry），API 面小、行为可验证。**推荐 proper-lockfile**；若不愿引入停更依赖，在 core 自建 `fs.open(O_CREAT|O_EXCL)` + stale 检测的小工具（~50 行，对应 filelock 语义），二选一皆可，倾向后者以减少依赖面（复刻项目自有实现便于对拍上游行为）。

---

### 15. 模糊匹配：fuzzball

上游 rapidfuzz 用于名称/内容模糊匹配（ratio + extract 类 API）。

| | [fuzzball](https://www.npmjs.com/package/fuzzball) 2.2.6 | [rapidfuzz-js](https://www.npmjs.com/package/rapidfuzz-js) 0.12.0 | [fast-levenshtein](https://www.npmjs.com/package/fast-levenshtein) 3.0.0 |
|---|---|---|---|
| 发布日期 | **2026-04-30**（repo pushed 2026-09-10，639★） | 2026-08-16（repo [sarunast/rapidfuzz-js](https://github.com/sarunast/rapidfuzz-js) **1★**，过年轻） | 2020-07-22（停更） |
| 血统 | **TheFuzz（fuzzywuzzy）API 移植**：ratio/partial_ratio/token_sort/extract | rapidfuzz 的直接移植尝试（0.x） | 仅 Levenshtein 距离 |

事实：rapidfuzz 无成熟完整 TS port；fuzzball 移植的 TheFuzz 与 rapidfuzz 共享同名 API 面（rapidfuzz 即从 fuzzywuzzy 兼容层演化而来），常用调用可 1:1 对上。

**推荐**：**fuzzball**。风险：分数实现与 rapidfuzz **不逐位一致**（不同实现细节），复刻验收时用上游真实调用点做双端对拍（容差断言而非精确相等）；纯 JS 性能低于 rapidfuzz C++——上游为小规模匹配，可接受。观察名单：rapidfuzz-js、[@3leaps/string-metrics-wasm](https://www.npmjs.com/package/@3leaps/string-metrics-wasm) 0.3.11（2026-06-16，rapidfuzz-rs 的 wasm 绑定，0.x）。

---

### 16. JSON 修复：jsonrepair

- **[jsonrepair](https://www.npmjs.com/package/jsonrepair) 3.15.0（2026-07-03，ISC，[josdejong/jsonrepair](https://github.com/josdejong/jsonrepair)）**——活跃维护。
- 与上游 PyPI `json-repair`（≥0.57）的关系：**独立实现，非移植**（不同作者/代码库，同一问题域：修复 LLM 输出的残缺 JSON——引号/尾逗号/markdown 围栏/单引号等）。

**推荐**：**jsonrepair**。风险：边缘输入的具体修复策略两端可能不同——把上游 json-repair 的测试用例集搬来做对拍，差异点按上游行为为准写适配测试。

---

### 17. 测试：vitest（projects）

| | [vitest](https://www.npmjs.com/package/vitest) 5.0.1（**2026-09-15**） | node:test（内置） |
|---|---|---|
| 状态 | dist-tags：V3=3.2.7、V4=4.1.11、latest=5.0.1（大版本迭代快但均有维护线） | v18 引入，v24 docs **Stability: 2 - Stable** |
| 能力 | mock/spy/coverage/snapshot/browser mode/projects 全 | 基础 runner + mock，coverage/生态偏弱 |
| 与上游对照 | 上游 webui 已用 vitest ^2.1.8，工具链同源 | — |

**推荐**：**vitest 5.0.1**，用 **projects** 配置镜像上游 pytest 布局：`tests/`（根集成测试）+ `channels/*/tests/`（包内 colocated 测试）→ 每包一个 project、test 目录随包走；pytest-asyncio → vitest 原生 async；pytest-xdist → vitest 并行 worker；pytest-cov → v8 coverage。webui 若保留上游 vitest 2.x pin，pnpm 按包隔离依赖，不与根 v5 冲突（或随前端升级票一并抬升）。

---

### 18. Monorepo：pnpm workspaces（+ turbo 后置）

| | [pnpm](https://www.npmjs.com/package/pnpm) 12.4.2（2026-09-15） | [turbo](https://www.npmjs.com/package/turbo) 2.10.13（2026-09-14） | [nx](https://www.npmjs.com/package/nx) 23.2.1（2026-09-09） |
|---|---|---|---|
| 角色 | workspaces 基础设施 + catalog 版本对齐 | 任务图/增量缓存（薄配置，叠加在 workspaces 上） | 全家桶（generators/依赖图/插件），重 |

**推荐**：**pnpm workspaces 起步**（catalog 统一管理 zod/hono/vitest 等共享版本），**turbo 在 CI 时长成为痛点后再加**（一条 `turbo.json` 的引入成本，不锁定）；5 包规模不上 nx。

**包边界（@pacman/*）**：见下节布局。原则：core 不依赖任何 channel/api/cli（依赖只能向内）；channel-telegram 只依赖 core；api 依赖 core（未来 channel-* 通过 core 的事件/接口接入）；cli 组装 core(+channel/api)；webui 是纯前端叶子。

---

### 19. 前端（React webui）

上游 webui 本就是 TS（React ^18.3.1 + Radix + Tailwind ^3.4.17 + i18next ^26 + Vite ^5 + vitest ^2.1.8 + TS ^5.7.2）。当前稳定版实测（npm，2026-09-17）：

| 包 | 上游 pin | 当前 latest | 发布 | 备注 |
|---|---|---|---|---|
| react / react-dom | ^18.3.1 | **19.3.0** | 2026-09-09 | 19 稳定线（backport tag 19.0.8） |
| tailwindcss | ^3.4.17 | **4.3.3** | 2026-07-16 | 官方保留 **`v3-lts` dist-tag = 3.4.19** |
| vite | ^5.4.11 | **8.3.0** | 2026-09-10 | 跨 3 个大版本 |
| vitest | ^2.1.8 | **5.0.1** | 2026-09-15 | 见第 17 节 |
| typescript | ^5.7.2 | **7.0.2** | 2026-07-08 | TS 7 = 原生（Go）编译器主线；5.9.3（2025-09-30）为 5.x 后期版本 |
| i18next | ^26.0.6 | 26.4.2 | 2026-09-03 | **上游已在当前大版本线** |
| react-i18next | ^17.0.4 | 17.0.14 | 2026-09-13 | 同上 |
| @radix-ui/react-dialog | ^1.1.4 | 1.1.23 | 2026-07-24 | Radix primitives 仍活跃 |

**策略建议**：见文末「前端版本策略」小节（复刻期沿用上游 pin，升级后置为独立票）。

---

## 顺带核实项（一行结论）

| 上游 | TS 对应 | 核实结果（2026-09-17） |
|---|---|---|
| anthropic | [@anthropic-ai/sdk](https://www.npmjs.com/package/@anthropic-ai/sdk) | **0.126.0（2026-09-15）**，官方，仍 0.x 主版本 → 严格 pin |
| openai | [openai](https://www.npmjs.com/package/openai) | **7.17.0（2026-09-16）**，官方 v7 |
| mcp ≥1.26 | [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) | **1.30.0（2026-07-27）**，官方 TS SDK 1.x 稳定线 |
| chardet | [chardet](https://www.npmjs.com/package/chardet) / [jschardet](https://www.npmjs.com/package/jschardet) | chardet **2.2.0（2026-06-20，MIT）** 推荐；jschardet 3.1.4（2024-09-30，**LGPL-2.1+**，license 注意） |
| pyyaml | [yaml](https://www.npmjs.com/package/yaml)（eemeli） | **2.9.1（2026-09-11，ISC）**；3.0 在 prerelease（3.0.0-2） |
| qrcode[pil] | [qrcode](https://www.npmjs.com/package/qrcode) | **1.5.4（2024-08-05，MIT）**，与上游 webui 同版本 |
| setproctitle | 内置 `process.title` | **缺口（有缓解）**：`process.title` 可写（[process docs](https://nodejs.org/docs/latest-v24.x/api/process.html#processtitle)），覆盖改进程名主用例；无任意 argv 重写等价 |
| httpx[socks] | 内置 fetch + [undici](https://www.npmjs.com/package/undici) 8.10.2（2026-09-04）+ [socks-proxy-agent](https://www.npmjs.com/package/socks-proxy-agent) 10.1.0（2026-06-08） | fetch v21 起稳定；SOCKS 走 undici 自定义 dispatcher |
| websockets（客户端） | 内置 WebSocket | v22.4.0 起非 experimental（[globals docs](https://nodejs.org/docs/latest-v24.x/api/globals.html)）；服务端仍用 ws 8.21.3 |
| lxml-html-clean | [sanitize-html](https://www.npmjs.com/package/sanitize-html) 2.17.7（2026-08-13）/ [dompurify](https://www.npmjs.com/package/dompurify) 3.4.15（2026-09-06） | Node 侧 sanitize-html，浏览器侧 dompurify |
| jinja2 → 见 11；dulwich → 见 8；rich/typer/questionary → 见 13；croniter → 见 7；filelock/watchfiles → 见 14 | — | — |

---

## Monorepo 布局建议

```
pacman/                          # private root，pnpm workspace
├── package.json                 # "packageManager": "pnpm@12.x"
├── pnpm-workspace.yaml          # packages: packages/*, apps/*；catalog: 统一依赖版本
├── turbo.json                   # （后置）CI 缓存需要时再加
├── tsconfig.base.json           # strict；ESM；target 对齐 Node 24
├── packages/
│   ├── core/                    # @pacman/core
│   │   ├── src/                 #   agent loop、LLM clients(anthropic/openai/mcp)、
│   │   │                        #   tools、memory(gitstore=isomorphic-git)、
│   │   │                        #   session(JSONL 存储实现)、config(zod Settings)、
│   │   │                        #   logging(pino)、tokenizer(js-tiktoken)、
│   │   │                        #   doc parsers、search provider、templates(nunjucks)
│   │   └── test/                #   ← 镜像上游 tests/ 的 core 部分
│   ├── channel-telegram/        # @pacman/channel-telegram（grammY runtime）
│   │   ├── src/                 #   ← 对应上游 nanobot/channels/telegram/
│   │   └── test/                #   ← 对应上游 channels/telegram/tests/
│   └── api/                     # @pacman/api（Hono + @hono/node-server：HTTP/SSE/WS）
│       ├── src/
│       └── test/
├── apps/
│   ├── cli/                     # @pacman/cli（commander + @clack/prompts，ink 按需）
│   └── webui/                   # @pacman/webui（private；沿用上游 React/Tailwind pin）
└── docs/
    └── research/                # 本文件所在位置
```

- **依赖方向**：`channel-telegram / api / cli → core`；core 零反向依赖；webui 为叶子（构建产物由 api 或 cli serve）。
- **测试布局**：每包 `test/` colocated（vitest projects），根级 `vitest.workspace`/projects 汇总——语义等价上游「tests/ + channels/*/tests/」的 pytest 布局。
- **工具链取舍**：pnpm workspaces（catalog 锁版本）为基座；**turbo 后置**——首个里程碑用 `pnpm -r run build/test` 即可，CI 增量缓存成为瓶颈时加 turbo.json（迁移成本≈0）；nx 不引入。
- **ESM 决策**：chokidar 5 ESM-only、全线现代依赖 → 所有包 `"type": "module"`，tsconfig `module: nodenext`。

---

## 前端版本策略（复刻项目：diff 面最小化优先）

**结论：复刻期直接沿用上游 webui 的 pin，不做任何大版本升级。**

1. **沿用**：React 18.3.1、Radix 各包上游版本、Tailwind 3.4.17、Vite ^5.4.11、i18next ^26 / react-i18next ^17（这两项上游已是当前大版本线，直接随 latest 补丁即可：26.4.2 / 17.0.14）、streamdown/katex/remark/rehype 栈照搬。
2. **唯一低风险例外**：Tailwind 可在 3.x 内抬到 **v3-lts 3.4.19**（官方 `v3-lts` dist-tag，2026-09-17 实测在架）——同大版本线的安全/补丁更新，不产生 diff 面。
3. **后置升级（各自独立成票，均在复刻验收后）**：
   - **Tailwind 3 → 4**（4.3.3）：CSS-first 配置、`@apply`/插件行为破坏性变更，涉及全部样式文件。
   - **React 18 → 19**（19.3.0）：types/ref 语义变更，Radix 需同步抬版本。
   - **Vite 5 → 8**（8.3.0）：跨 3 个大版本，插件链（vitest 2 → 5 同步）。
   - **TypeScript 5.7 → 7**（7.0.2，2026-07-08 起为 latest；原生 Go 编译器主线）：全 monorepo 级决策，不止 webui——core/cli 侧起步直接用 TS 5.9.3（2025-09-30）或 7.0.2 需在脚手架票里单独定（工具链兼容面：vitest/eslint 生态对 TS 7 的支持情况**未核实**）。
4. **理由**：webui 迁移成本本来≈0（上游即 TS）；任何版本升级都会把「行为复刻验收」和「框架升级排错」两类问题搅在一起，违背复刻项目最小 diff 原则。

---

## 缺口与未核实清单

**明确缺口（无成熟 TS 等价 / 需自建）**：

| 缺口 | 影响 | 缓解 |
|---|---|---|
| **pptx 结构化读写**（python-pptx 无对等库） | 高（若上游有写 pptx 路径） | 读侧 officeparser 8.0.0 / 自写 jszip+fast-xml-parser；写侧 @office-kit/pptx 0.13.0 过年轻——**复刻前需确认上游 python-pptx 的实际调用面** |
| **pydantic-settings 分层配置** | 中 | zod + 自建 Settings loader（<200 行） |
| **setproctitle 任意 argv 重写** | 低 | `process.title` 覆盖主用例 |
| **rapidfuzz 本体移植** | 低 | fuzzball（TheFuzz API 兼容面）+ 对拍验收 |
| **docx 结构化读写**（python-docx 式对象模型） | 低-中 | mammoth 覆盖读文本；结构化需求出现时自写 OOXML |

**半停更/停更依赖（选用即接受风险，均已给替代路径）**：duck-duck-scrape（2025-01）、nunjucks（2023-04）、exceljs（2023-10）、proper-lockfile（2021-01）、prompts/terkelg（2021-10，已弃选）、dqbd/tiktoken 系（2025-08）、SheetJS npm 版（2022-03，官方源迁 CDN）、fast-levenshtein（2020，已弃选）、clipanion（RC 停滞，已弃选）、telegraf（2024-02，已弃选）。

**未核实项**：

- TS 侧各工具链对 **TypeScript 7.0.2**（原生编译器）的兼容面（vitest/eslint 插件等）——脚手架票前置调研。
- better-sqlite3 13.0.3 对 Node 26 的 prebuild ABI 覆盖（未逐一验证；Node 24 按发布节奏推断已覆盖，**未核实**）。
- Bun/Deno 上原生模块（jsdom、better-sqlite3）的兼容边缘情况（未逐一实测——主推 Node，非阻塞）。
- `oauth-cli-kit`（上游 OAuth device-flow CLI）的 TS 等价——不在本票 19 项内，**未调研**（候选方向：openid-client 或自建 device flow，需单独核实）。
- `packaging`（→ semver）、`tzdata/tzlocal`（→ 内置 Intl / Temporal / luxon）、`defusedxml`（→ JS XML 解析器默认不解析外部实体的安全性声明）、`ruff/basedpyright`（→ eslint+typescript-eslint 或 biome + tsc/tsgo）——**未逐项联网核实**，建议并入脚手架票。
- node:fs.watch `ignore` 选项（v24.16.0 新增）在 22.x 线的可用性（22 线文档未对照，**未核实**；推荐 chokidar 后非阻塞）。

---

## 主要出处

- npm registry：`https://registry.npmjs.org/<pkg>`（版本/日期/license/repo，2026-09-17 实测）；各包页面 `https://www.npmjs.com/package/<pkg>`
- Node：[nodejs.org/en/about/previous-releases](https://nodejs.org/en/about/previous-releases)、[nodejs/Release schedule.json](https://github.com/nodejs/Release/blob/main/schedule.json)、[node:sqlite v24 docs](https://nodejs.org/docs/latest-v24.x/api/sqlite.html)、[globals（fetch/WebSocket）](https://nodejs.org/docs/latest-v24.x/api/globals.html)、[fs.watch](https://nodejs.org/docs/latest-v24.x/api/fs.html)、[process.title](https://nodejs.org/docs/latest-v24.x/api/process.html)
- Hono：[Node.js 指南](https://hono.dev/docs/getting-started/nodejs)（@hono/node-ws 弃用声明）、[streaming/SSE](https://hono.dev/docs/helpers/streaming)
- Zod：[zod.dev/v4](https://zod.dev/v4)；SheetJS：[docs.sheetjs.com Node 安装页](https://docs.sheetjs.com/docs/getting-started/installation/nodejs)
- Telegram：[grammy.dev](https://grammy.dev/)、[grammyjs/grammY](https://github.com/grammyjs/grammY)（Bot API 10.3 徽章）、[telegraf/telegraf](https://github.com/telegraf/telegraf)、[core.telegram.org/bots/api](https://core.telegram.org/bots/api)
- 其余 repo 链接见各节表格（GitHub API 实测 archived/pushed_at/stars，2026-09-17）
