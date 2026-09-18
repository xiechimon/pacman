# 01 · TS 技术栈锁死

> Wayfinder 票：xiechimon/pacman #24（wayfinder:grilling，决议 2026-09-18）。
> 引用约定：`<路径>:<行号>` 指上游 nanobot 仓库（clone 于 /Users/xmon/Code/AgentProjects/nanobot）相对路径与行号，钉 **v0.3.5**（commit sha 由 00 总册声明；v0.3.5 之后变更仅 README/images/tui，Python 源码行号与 tag 一致，实测）。npm 版本为 2026-09-17 registry 实测（见 `docs/research/r8-ts-stack.md`）。
> 类型记号：沿用（原样搬）/ 改造（语义不变、实现替换）/ 新增（TS 侧特有，无上游引用义务）/ 降级（功能面缩水）/ 砍（不做）。

## 1. 定位

本册把 pacman（nanobot 的 TypeScript 全栈复刻）实现所需的全部技术选型逐项锁死：runtime、LLM 传输、HTTP/WS、validation/config、存储、锁、telegram、tokenizer、cron、git、文档解析、搜索/抓取、模板、日志、CLI、监听、模糊匹配、JSON 修复、测试、monorepo 布局、前端、编译器、lint。实现者拿到本册后**不再做任何选型决策**；只改决定，不改实现。

pi SDK 替换政策（map Notes 锁定）：pi 提供的能力直接用，pi 没有的按上游设计走。据此本册两条作废线：`openai` 与 `@anthropic-ai/sdk` 直连选型正式删除，由 **pi ModelRuntime** 取代（#33 近读 `docs/research/r9-pi-sdk.md`）。

## 2. 上游速览

上游是 Python ≥3.11 单包（`pyproject.toml:6`），依赖全部集中声明于 `pyproject.toml:25-67`（core）与 extras（`:58`、`:77` 等）。形态：长驻 asyncio 服务（aiohttp HTTP `nanobot/api/server.py:17` + websockets WS `nanobot/channels/websocket/runtime.py:20`）+ CLI（typer `nanobot/cli/` 多处）+ 进程内组件。存储无数据库：JSONL 文件 + filelock（`nanobot/process_runtime.py:24`、`nanobot/triggers/local_store.py:15`）。三个依赖是**声明未用**（全库无 import，实测）：`chardet`（`pyproject.toml:46`）、`defusedxml`（`:58`、`:77`）、`qrcode[pil]`（`:39`，仅 out-of-scope 的 feishu/weixin channel 用）。

## 3. pacman 设计

pnpm workspaces 五包：`packages/core`、`packages/channel-telegram`、`packages/api`、`apps/cli`、`apps/webui`；依赖方向 `channel-telegram / api / cli → core`，core 零反向依赖，webui 纯前端叶子。全线 ESM（`"type": "module"`），tsconfig `module: nodenext` + `strict`，target 对齐 Node 24。共享依赖版本走 pnpm **catalog** 统一。

**接口替换缝**（处置模板，全栈统一）：停更/高断风险依赖一律 pin 精确版本 + 在 core 包一层接口，接口即替换缝，换库不动调用面：

- `DocumentExtractor` ← officeparser（pdf 质量不过退 unpdf）
- `SearchProvider` ← duck-duck-scrape（默认）+ 自建 html.duckduckgo fallback + key 型第三方 API 出口
- `TemplateRenderer` ← nunjucks
- `SessionStore` / `MemoryStore` ← JSONL 文件实现（SQLite 后端仅接口预留，不引入）

**pin 策略**：一切依赖 pin 精确版本；**pi 系（@earendil-works/*）pin 到 patch 级 + 显式升级窗口**（0.x 周更、minor 自带 Breaking 段，catalog 滞后类风险由 bump pi 承接）。

## 4. 逐单元决策表

| 单元 | 上游行为(path:line) | pacman 决策 | 类型 | 理由 |
|---|---|---|---|---|
| runtime | CPython ≥3.11（pyproject.toml:6） | **Node 24 LTS**；`engines: >=22.19.0`（pi 底线）；CI 矩阵 22/24、24 为主 | 新增 | LTS 覆盖项目生命周期；Bun 无 LTS 且 child_process/信号语义压着沙箱票（G4），验收红必须归因自代码；Hono 已买回平移期权 |
| TypeScript 编译器 | — | **5.9.3** 全线起步；升 7（原生编译器）后置为复刻验收后独立票 | 新增 | vitest 等工具链对 TS 7 兼容面未核实（r8），复刻期不背工具链风险 |
| LLM 传输层 | openai（pyproject.toml:48）/ anthropic（:27）SDK 直连 providers | **pi ModelRuntime（@earendil-works/pi-ai）**：传输/发现/OAuth/retry 词表全交 pi；pacman 不再引 openai/@anthropic-ai/sdk | 新增 | #33：pi ~40 家 provider wire 怪癖表 + catalog + OAuth 全家桶对应 r4 §1.3/§2 整块自研成本直接删掉 |
| HTTP 服务 | aiohttp（api/server.py:17） | **Hono 4.13.8 + @hono/node-server 2.1.1 + ws 8.21.3**；WS 走 node-server 内置 upgradeWebSocket 路径（@hono/node-ws 已弃用，不用） | 改造 | SSE/WS 一等支持、zod 集成、runtime 无关 |
| HTTP 客户端 | httpx[socks]（:32；providers/transcription.py:18） | **内置 fetch + undici 8.10.2 dispatcher + socks-proxy-agent 10.1.0** | 改造 | fetch v21 起稳定；SOCKS 走 undici 自定义 dispatcher |
| WS 客户端 | websockets（:31；客户端侧） | **内置 WebSocket**（≥22.4 非 experimental）；服务端用 ws | 改造 | 零依赖 |
| validation | pydantic（:28；config_base.py:8） | **zod 4.6.5**；旧生态摩擦走 `zod/v3` subpath 共存 | 改造 | 事实上的 TS pydantic 等价物，生态默认 |
| config 分层加载 | pydantic-settings BaseSettings（:29；config/schema.py:8,422；loader.py:10）+ `${VAR}` 插值（r4） | **自建分层 Settings**：zod schema + 加载器 <200 行，优先级=显式入参 > env > .env > 配置文件 > 默认值，语义按上游复刻；YAML 读用 yaml 2.9.1 | 新增 | TS 无 1:1 等价库（r8 缺口），薄层自建可控可对拍 |
| config 热更新 | watchfiles（config/watcher.py:8） | **chokidar 5.0.0 + minimatch 10.2.6**（v4 起无 glob）；按 provider_signature 重建逻辑归 04 册 | 改造 | watchfiles（Rust notify）可靠性对标；v5 ESM-only 与全线 ESM 一致 |
| 存储 | JSONL + MEMORY.md + filelock（process_runtime.py:24；triggers/local_store.py:15） | **node:fs 文件存储原样复刻**（格式与上游互通）+ `SessionStore`/`MemoryStore` 接口；node:sqlite（1.2-RC）/better-sqlite3 不入生产路径 | 沿用 | 上游无 DB，diff 面最小；接口已为未来后端留缝 |
| 文件锁 | filelock FileLock | **core 自建 `fs.open(O_CREAT\|O_EXCL)` + stale 检测 ~50 行** | 新增 | proper-lockfile 停更（2021）；自有实现便于对拍上游语义、减依赖面 |
| telegram | python-telegram-bot（channels/telegram/runtime.py:17-29） | **grammY 1.46.0**：handler/filter 模型按语义重写为 middleware+composer；三层长度分割/流式 edit 语义按 r5 必保清单实现 | 改造 | telegraf 停更（2024-02）、Bot API 落后 3 大版本；grammY 活跃、TS-first、API 10.3 |
| tokenizer | tiktoken cl100k_base（utils/helpers.py:19,106-107）+ UTF-8 字节兜底（:414） | **js-tiktoken 1.0.21**，范围钉死为「上游估算面复刻」（context 预算、tool 定义计数）；新模型词表缺口 = 自嵌 rank 文件 | 改造 | 与上游同编码体系、纯 JS 无 wasm；dqbd 系停更风险由 rank 自嵌缓解。Claude 无官方 tokenizer，上游同为近似，保持同等近似 |
| compaction | AutoCompact（r2；含空闲 TTL 触发） | **pi AgentSession compaction**（threshold/overflow/manual + 独立重试预算）；idle-TTL 语义 pi 无对应物（r9），由 pacman 外置定时器调 `session.compact()` 补齐，细节归 02 册 | 改造 | 「pi 有的用 pi」；TTL 缺口已核实可外置安放 |
| cron 解析 | croniter（cron/service.py:58） | **cron-parser 5.10.1** 纯解析；调度器按上游设计（进程内伪装用户消息，r3）自建 | 改造 | croniter 直接对应；croner 调度器形状与上游语义不匹配 |
| git（memory gitstore） | dulwich（utils/gitstore.py:14-16） | **isomorphic-git 1.42.2**：init/add/commit/log/branch 面 | 改造 | 与 dulwich 同「纯语言实现、零系统二进制」约束；gitstore 小仓库线性提交，性能/边缘特性风险不触发 |
| 文档解析（读侧） | pypdf/python-docx/openpyxl/python-pptx 全读侧零写入（utils/document.py:119-160,292；建图实测） | **officeparser 8.0.0 单库统一入口**（docx/xlsx/pptx/pdf）包进 `DocumentExtractor`；不引入 unpdf/mammoth/exceljs；officeparser 对 pdf 抽取对拍不过 → 换 unpdf 走同接口 | 改造 | 一个依赖吃掉四格式；「需确认上游调用面」缺口已闭环（纯读） |
| pptx/docx/xlsx 写侧 | 上游无写路径（写仅在 feishu，out of scope） | **砍**（无需决定降级——上游本就没有） | 砍 | r8 §9d 缺口塌缩：写侧库缺失不构成复刻缺口 |
| web 搜索 | ddgs（agent/tools/web.py:1023） | **SearchProvider 接口** + duck-duck-scrape 2.2.7 默认 + ~100 行自建 `html.duckduckgo.com/html/` fallback + 可配置 key 型第三方 API 出口 | 新增 | DDG 无官方 API、两端同断（r8 结构性事实）；不绑死单一半停更库 |
| 正文抽取 | readability-lxml（web.py:1323）+ lxml-html-clean（:37，无直接 import，readability 挂接清洗） | **@mozilla/readability 0.6.0 + linkedom 0.18.13**（怪异页回退 jsdom）；清洗 Node 侧 sanitize-html 2.17.7 / 浏览器侧 dompurify 3.4.15；一般 HTML 解析 cheerio | 改造 | 对应上游轻量路线；cheerio 覆盖一般抓取 |
| 模板 | jinja2（utils/prompt_templates.py:12） | **nunjucks 3.2.4** pin + `TemplateRenderer` 接口；上游自定义 Python 函数注入 → nunjucks filters/globals 等价重写 | 改造 | jinja2 语法兼容度第一约束（模板近原样搬运）；维护模式风险由接口缝兜住 |
| 日志 | loguru（optional_features.py:14 等全局） | **pino 10.3.1 + pino-pretty 13.1.3**：dev pretty 还原 loguru 体验、生产 JSON + 文件 rotation | 改造 | 结构化 + rotation 两面都对上；Node 无内置完整 logger |
| CLI 参数 | typer（cli/runtime_config.py:5 等） | **commander 15.0.0**；11 命令面按 r4 清单 | 改造 | typer 直接对应、生态最稳；clipanion RC 停滞不选 |
| 交互提示 | questionary（cli/onboard.py:13）+ prompt_toolkit（cli/terminal.py:13） | **@clack/prompts 1.8.1**；REPL 用内置 `readline/promises` | 改造 | clack 活跃现代；prompts 停更不选 |
| 终端富渲染 | rich（cli/gateway.py:13；helpers.py:927） | **ink 7.1.1 仅按需**（live 面板场景才引入）；普通彩色输出交给 @clack + pino-pretty | 降级 | 不为个别渲染面让全线背 React 运行时；TUI 包本体 out of scope |
| 模糊匹配 | rapidfuzz.distance.{Indel,Opcode,Opcodes}（utils/file_edit_events.py:11） | **fuzzball 2.2.6** 覆盖 ratio/extract 面；**Indel/Opcodes 为 fuzzball 未提供**（上游用的是 distance API），core 自建 ~60 行（indel 距离 = LCS 式、opcode = 编辑脚本） | 改造+新增 | rapidfuzz 无成熟 TS port；实测上游调用点是 distance 子模块（r8 未展开），小块自建 + 对拍 |
| JSON 修复 | json-repair（providers/base.py:19,155） | **jsonrepair 3.15.0** | 改造 | 独立实现非移植，边缘差异按上游 fixture 对拍定（§5） |
| 进程标题 | setproctitle（cli/process_identity.py:17） | **`process.title`** | 降级 | 覆盖改进程名主用例；任意 argv 重写无等价（建图会话已接受） |
| 版本比较 | packaging（optional_features.py:15-16；webui/version_check.py:13） | **semver 7**（node 生态标准位） | 改造 | Requirement 语义面窄，semver + 少量本地比较够用 |
| 时区 | tzlocal + zoneinfo（config/timezone.py:3-5；llm_usage/store.py:14） | **内置 Intl API**（resolvedOptions().timeZone + Intl 日期格式）；不引 luxon | 改造 | 上游用法（取本地时区名 + 按 tz 分组）Intl 全覆盖；Node 自带 ICU |
| 编码检测 | chardet 声明未用（pyproject.toml:46，全库零 import） | **砍**（无对应消费面；若文档解析实测出编码需求再按 r8 行补 chardet 2.2.0） | 砍 | 复刻未用依赖 = 不复制死重 |
| XML 安全 | defusedxml 声明未用（:58、:77，全库零 import） | **砍**；pacman 用到的 XML 解析器（fast-xml-parser 路径若启用）默认不解析外部实体 | 砍 | 同上；安全声明面随接口缝复查 |
| 二维码（py 侧） | qrcode[pil]（:39）仅 feishu/weixin 用 | **砍**（channel out of scope）；WebUI 侧 qrcode npm 1.5.4 归前端行 | 砍 | 消费面在 scope 外 |
| MCP | mcp ≥1.26（:44） | **@modelcontextprotocol/sdk 1.30.0**，外置于 pacman（pi 无内置 MCP，r9 S5）；per-turn readiness hook + 两级重连 + `mcp_{server}_` 前缀语义按 r3 必保清单 | 改造 | 官方 TS SDK 1.x 稳定线 |
| 测试 | pytest 全家桶 | **vitest 5.0.1 projects 模式**：每包 test/ colocated，根 projects 汇总；async 原生、并行 worker、v8 coverage 对应 asyncio/xdist/cov | 改造 | 上游 webui 已用 vitest，工具链同源；pnpm 按包隔离，webui 留 vitest 2.x pin 不冲突 |
| monorepo | 上游单包 | **pnpm 12 workspaces + catalog**；turbo 后置（CI 时长成痛点再加一条 turbo.json）；nx 不引入 | 新增 | 5 包规模 nx 过重；turbo 引入成本≈0 无需预支 |
| 前端 | webui 本就是 TS（React 18.3.1/Tailwind 3.4.17/Vite 5/TS 5.7/vitest 2.1.8/i18next 26） | **复刻期沿用上游 pin 零升级**；唯一例外 Tailwind 抬 **3.4.19（官方 v3-lts）**；i18next 26.x / react-i18next 17.0.x / Radix 随补丁线；qrcode 1.5.4、streamdown/katex/remark/rehype 栈照搬；升级（React 19 / Tailwind 4 / Vite 8 / TS 7）各自独立成票、后置 | 沿用 | webui 迁移成本≈0；版本升级会把「行为复刻验收」与「框架升级排错」搅在一起 |
| lint/format | ruff + basedpyright（上游工具链） | **Biome** 单工具 lint+format；prettier 不引入；类型检查 = tsc 5.9.3 | 新增 | 复刻项目 lint 只保代码卫生、无历史规则包袱；单工具减移动部件 |

## 5. 验收要点（供 08 册 ROADMAP 汇入）

1. **对拍义务**（差分测试进对应阶段验收清单）：
   - fuzzball vs rapidfuzz：上游真实调用点双端对拍，**容差断言**（实现不同、分数不逐位一致）；自建 Indel/Opcodes 对拍 `file_edit_events` 上游用例。
   - jsonrepair vs json-repair：搬运上游 Python 测试用例集，差异点按上游行为为准写适配测试。
   - cron-parser vs croniter：上游 cron 表达式样本的 next-fire 序列对拍。
   - Settings 分层加载 vs pydantic-settings：优先级、`${VAR}` 插值、类型强制行为对拍（04 册 config 阶段）。
   - DocumentExtractor：officeparser 抽取输出 vs 上游四库抽取输出（同文档样本），pdf 差异超阈值触发 unpdf 换缝。
2. **engines 门禁**：CI 矩阵 Node 22.19+/24 双跑，24 为主；`package.json engines >=22.19.0` 装不住即红。
3. **pi pin 纪律**：@earendil-works/* 全部 patch-pin；升级 = 显式窗口（读 changelog Breaking 段后 bump），禁止 catalog 隐式抬版。
4. **缝纪律**：四个接口（DocumentExtractor/SearchProvider/TemplateRenderer/SessionStore）之外，实现不得直接 import 被包依赖（lint 规则强制）。
5. **格式互通**：SessionStore JSONL/MEMORY.md 产物可被上游版本直接读取（同格式验收样本互换）。

## 6. 术语增量（供 #32 汇总进 CONTEXT.md）

- **技术栈锁死（stack lock-in）**：本册产物状态——每项一个决定 + 理由，实现会话无选型权。
- **接口替换缝（replacement seam）**：pin 依赖外层的一层接口（DocumentExtractor、SearchProvider、TemplateRenderer、SessionStore/MemoryStore），换库不动调用面；缝外直接 import 依赖为 lint 违规。
- **对拍验收（differential acceptance）**：TS 实现与上游 Python 库在真实调用点上双端比对的验收形式；容差断言或精确断言按项定义。
- **DocumentExtractor**：文档读侧统一入口接口，默认实现包 officeparser。
- **SearchProvider**：web 搜索统一入口接口，默认 duck-duck-scrape + 自建 fallback。
- **TemplateRenderer**：prompt/skill 模板渲染接口，默认 nunjucks。
- **SessionStore / MemoryStore**：会话与记忆持久化接口，默认 JSONL + MEMORY.md 文件实现（与上游格式互通）。
- **升级票（upgrade ticket）**：复刻验收后才允许开动的版本抬版独立票（React 19 / Tailwind 4 / Vite 8 / TS 7），复刻期禁止。
