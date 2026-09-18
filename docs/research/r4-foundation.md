# r4-foundation — 地基对比：craft-agents-oss / pi SDK / Claude Agent SDK / 全自研基线

- 票：xiechimon/pacman #38（研究）。destination = 为「锁定：地基选型终拍」（#39）供决策证据；「库化」路线（不 fork 直改）与「付费三项排除、保留 OAuth 连自有 ChatGPT/Codex/Copilot/XAI 订阅」已在 #34 Notes 锁定，本票不重议。
- 对象钉版（全部 2026-09-19 实测）：
  - `craft-ai-agents/craft-agents-oss` @ `e8963854c3679edcceb105a42537a06749e6cb64`（tag 信息 "v0.13.3"，2026-09-07；`git clone --depth 1` 到 `/tmp/craft-agents-oss` 实读）。
  - `@earendil-works/pi-*`：npm dist-tag `latest = 0.85.1`（2026-09-05 发布；registry 实测 2026-09-19，**与 r9 钉版一致，r9 全部行号结论仍有效**）；`legacy-node20 = 0.74.2`。
  - `@anthropic-ai/claude-agent-sdk`：npm dist-tag `latest = next = 0.3.277`（2026-09-18；tarball 解包至 `/tmp/casdk-npm/package/` 实读 `sdk.d.ts`/`manifest.json`；GitHub repo `anthropics/claude-agent-sdk-typescript` @ main 实读 `LICENSE.md`/`CHANGELOG.md`）。
- 引用约定：craft 路径相对其仓库根；SDK 路径相对 npm tarball `package/` 根；pi 结论引用 `docs/research/r9-pi-sdk.md`（下称 r9）章节/行号。无出处的解读一律标 **[推断]**。todos.dev 特征清单引 #34 Notes（研究票不依赖未完成的 #36 屏幕盘点，屏级同型度打分待 #36 产物补）。

---

## S0 结论速览（四路各一句）

1. **craft-agents-oss**：架构与 todos.dev 同型度最高的已跑通实现（任务 DAG 编排、双 SDK 后端抽象、BYOK 多 provider 都现成），但 **npm 无发布物（`@craft-agent/*` registry 404 实测）→「当库引」对 craft 只剩 vendor 源码/仅参考设计两档**；Apache-2.0 允许 vendor，代价是 TRADEMARK 换名换 logo 换 bundle ID + bun/Electron 形态与本栈（Node24/pnpm/Web）的适配改造面。
2. **pi SDK**：r9 钉版核对通过（0.85.1 未动）；「直接可用」面（provider/OAuth/compaction/session tree）与「缺口」面（多会话编排/MCP/cron/memory）边界清晰，**零硬缺口、无需 fork**（r9 S9.1），是三库中唯一「能力全开源可钉版」的地基。
3. **Claude Agent SDK**：todos.dev 同型场景（并行 worktree、多 agent、per-agent memory、transcript/成本记账）的**原生功能面最厚**（worktree 隔离与 `SessionStore` 抽象是现成的，S3.1），但 **agent 本体是 217–234 MB/平台的闭源签名 `claude` 二进制**、license「All rights reserved + Commercial ToS」、与 Claude Code 逐日追平（302 版本），且 **模型面仅 Claude 家族——不覆盖本图锁定的 ChatGPT/Copilot/XAI 订阅连接**。
4. **全自研基线**：r2–r4 必保语义 + r9 S8 全部 35 项判定的规模感 = 上游 nanobot 629 个 py 文件 / 4,443 commits / 7.5 个月 / 2–3 核心开发者（r1 表头）；选任何库地基都不免自写 todos.dev 的 Chief/看板/编排层，**全自研的增量恰是「把 r9 E 清单（pi 白赚面）从零写一遍」**，其中 provider wire 怪癖表 + OAuth 全家桶（r9 S9.8）是最大单块。

---

## S1 craft-agents-oss（实测）

### S1.1 仓库结构与规模

- 布局（`ls` 实测）：`apps/{cli,electron,viewer,webui}` + `packages/{core,messaging-gateway,messaging-whatsapp-worker,pi-agent-server,server,server-core,session-mcp-server,session-tools-core,shared,ui}`；bun workspaces（根 `package.json` `"workspaces":["packages/*","apps/*"]`，`bun.lock`/`bunfig.toml`，测试 `bun test`）。全仓版本锁步 `0.13.3`，license `Apache-2.0`（根 package.json + LICENSE 全文 161 行 + gh api spdx 三处一致）。
- src TS/TSX 规模（`wc -l` 聚合 2026-09-19，含测试文件）：

| 包 | LOC | 一句话职责（README「Architecture」+ 目录实读） |
|---|---:|---|
| `apps/electron` | 135,725 | 桌面 GUI 主进程 + renderer（React 18.3.1 + Radix 子集 + cmdk；renderer components 258 个 .tsx） |
| `packages/shared` | 119,627 | 业务核心：`agent/`（双后端+权限+模式）、`config/`（LLM connections）、`credentials/`（AES-256-GCM，README 架构段）、`sources/`（MCP/REST API）、`automations/`（cron-matcher+event-bus）、`tasks/`（task.yaml schema）、`mcp/mcp-pool.ts`（`McpClientPool` :102）、`auth/chatgpt-oauth.ts`（261 行，PKCE，Codex app-server 端点，idToken→API key 交换） |
| `packages/ui` | 29,980 | 跨 app React 组件（chat/TurnCard 3,284 行、terminal、code-viewer、markdown、annotations） |
| `packages/server-core` | 29,411 | headless 服务端：`sessions/SessionManager.ts`（**单文件 9,023 行**）、`tasks/TaskRunner.ts`（926 行，进程内 "Conductor"）、`handlers/rpc`、`transport`、`webui/http-server.ts`（web 客户端静态面） |
| `packages/pi-agent-server` | 6,444 | Pi 后端子进程：stdio JSONL 自建协议（非 pi RPC mode），r9 S7 已近读 |
| `packages/session-tools-core` | 9,399 | 会话工具的共享 handler（Claude 侧 session-scoped tools 与 Codex 侧 stdio MCP 的公共实现） |
| `packages/core` | 1,310 | 共享类型（`AgentEvent` 等） |
| `packages/server` | 542 | 服务器入口薄壳（`@craft-agent/server`，作者字段 Craft Docs Ltd.） |
| `apps/{webui,cli,viewer}` | 5,157（三者合计） | webui 用 Vite+React+jotai 复用 `@craft-agent/{ui,shared}` + electron shim；cli 为远端 server 的 WS 客户端（README「CLI Client」） |

- 仓库热度（gh api 实测 2026-09-19）：7,187 stars / 1,064 forks / created 2026-01-19 / pushed 2026-09-07。

### S1.2 它如何「并用」Claude Agent SDK 与 Pi SDK

README:21 原话："It uses the Claude Agent SDK and the Pi SDK side by side—building on what we found great and improving areas where we've desired improvements."（机制实测如下。）

- **统一接口**：`packages/shared/src/agent/backend/types.ts`（688 行）`export interface AgentBackend`（:337）——`chat()/abort/forceAbort/interruptForHandoff/redirect/runMiniCompletion/postInit/applyBridgeUpdates/ensureBranchReady/setModel/setThinkingLevel/setPermissionMode/setSourceServers/respondToPermission…`（成员清单实读）；provider 无关事件（文件头注释：All backends emit the same AgentEvent types / Capabilities-driven UI）。
- **工厂与驱动**：`backend/factory.ts`（857 行）`DRIVER_REGISTRY: Record<AgentProvider, ProviderDriver> = { anthropic: anthropicDriver, pi: piDriver }`（:66-69）；`backend/internal/drivers/{anthropic,pi}.ts` + `runtime-resolver.ts`（263 行，解析平台二进制路径）。
- **Claude 路线（in-process SDK）**：`shared/src/agent/claude-agent.ts` 3,175 行，直接 `import { query, createSdkMcpServer, tool, … } from '@anthropic-ai/claude-agent-sdk'`（:1）；pin **精确 `0.3.258`**（`packages/shared/package.json:93`、`packages/core/package.json:15`）；`options.ts` 处理平台可选二进制包 `@anthropic-ai/claude-agent-sdk-{platform}-{arch}`（:158,:248 注释）。会话作用域工具经 `createSdkMcpServer` 注入（`session-scoped-tools.ts`、`sources/server-builder.ts:18`）。
- **Pi 路线（out-of-process）**：`shared/src/agent/pi-agent.ts` 2,719 行 = 「Thin subprocess client…Spawns a pi-agent-server subprocess and communicates via JSONL over stdin/stdout」（头注释 :1-13）；`packages/pi-agent-server` 以精确 pin `@earendil-works/pi-{coding-agent,agent-core,ai}: 0.85.1` 运行 pi SDK 进程内（r9 S7 近读其装配与踩坑）。
- **适配层体量**：`claude-agent.ts + pi-agent.ts + base-agent.ts(1,286) + backend/(6,128) + pi-agent-server(6,444)` ≈ **22.8k 行**——这是 craft 为「双 SDK 并架在同一个产品事件面上」实际支付的工程量，也是 pacman 若走双后端时的改造面参考。
- **多 provider 订阅连接**：pi 后端 + `auth/chatgpt-oauth.ts`（自实现 ChatGPT PKCE）+ `config/models-pi.ts`（214 行，pi 模型表）；CLI `run --provider openai|google|openrouter|groq|mistral|xai`（README CLI 表）。即 craft 的非 Anthropic 订阅面**走的是 pi 通道 + 宿主自装 OAuth**，与 Claude SDK 无关。
- **多 agent 并行**：`spawn_session` 工具（`spawn-session-tool.ts`，「Create a new session that runs independently…delegate tasks to parallel sessions」，可覆写 model/llmConnection/permissionMode/thinkingLevel/workingDirectory）+ Tasks 子系统（S1.4）。

### S1.3 「当 npm 依赖引」实测不成立

- `curl registry.npmjs.org/@craft-agent%2F{core,pi-agent-server}` 均 **404 "Not found"**（2026-09-19 实测）；npm search "@craft-agent" 无一物属该 scope。`@craft-agent/*` 只在仓库内以 `workspace:*` 互引。
- 含义（对 #39 三档形态）：**npm 依赖 = 不存在此选项**（除非自己 build 发布物挂私有 registry）；**vendor 源码 = Apache-2.0 允许**（义务：保留 LICENSE/NOTICE、标注修改，§4(a)-(c)；NOTICE 自带「本使用 Claude Agent SDK 受 Anthropic Commercial ToS」条款需一并传递）；**仅参考设计 = 零许可约束**。fork 直改已被 #34 排除。
- vendor 的现实摩擦：bun workspaces/`bun test`（本栈 Node24+pnpm+vitest，01-stack §3/§4）；Electron renderer 组件与主进程 IPC 深耦合（`apps/electron/src/main`）；版本无 semver 稳定承诺（0.13.x、全仓锁步）；上游一周未动（pushed 9/7）但 issue/PR 流活跃——**vendor 即自担 divergence**。[推断] 摩擦程度基于目录与构建脚本实读，未做移植 PoC。

### S1.4 LICENSE / TRADEMARK 边界（名字/logo 哪些不能碰）

- `TRADEMARK.md`（全文实读）：Craft Docs Ltd. 商标四项——**"Craft"、"Craft Agents" 文字商标 + Craft logo/icon + Craft Agents logo/icon**。
  - 可以：用/改/分发代码、商用；事实性声明（"Based on Craft Agents"/"Fork of Craft Agents"）。
  - fork/derivative 必须：起不含 "Craft" 的名字、移除/替换全部 logo 与 icon、改 bundle identifier（例 `com.lukilabs.craft-agent`）、去掉 `craft.do` 域名引用（连官方 Craft 服务除外）。
  - 不可：以 "Craft"/"Craft Agents" 命名产品、用 Craft logo 当应用图标、暗示官方背书。
  - 点名换名要动的文件：`apps/electron/electron-builder.yml`、`apps/electron/resources/`、`packages/shared/src/branding.ts`。
- 对 pacman 无冲突：产品名 = pacman/todos.dev 复刻，不沾 Craft 字样；若 vendor 其组件，源码内保留 Apache 头 + NOTICE 即可，UI 文案/logo 本就要按 todos.dev 重做（#44 素材票）。

### S1.5 与 todos.dev 的架构同型点（逐项，README/docs/源码为据；屏级打分待 #36）

| todos.dev 特征（#34 Notes） | craft 对应物 | 证据 | 同型度 |
|---|---|---|---|
| Chief 拆目标→分配 agent | Tasks：goal→`task.yaml` 子任务 DAG（"Each node becomes a child AI session"，`depends_on` 传 `${nodes.<id>.output}`，acceptance_criteria 打分回路、`max_iterations` 修复环 3/10） | `shared/src/tasks/generator-prompt.ts`（头注释 :1-8 + prompt 正文）、`schema.ts`（`NODE_KINDS` 14 种：session/orchestrator/route/parallel/map/loop/approval/synthesize/verify/judge/filter/aggregate/finally）、`server-core/tasks/TaskRunner.ts`(926 行,进程内 Conductor) | 高（机制同型，prompt 策略黑盒另对） |
| agent 团队 role/model | `spawn_session`（独立会话可覆写 model/connection/permissionMode/thinkingLevel/workingDirectory）；节点级 `permissionMode` | `spawn-session-tool.ts:43-52`、`tasks/schema.ts` | 中-高 |
| agent memory（per-agent） | workspace/project 级 memory（`loadProjectMemory` 进系统提示）+ Claude SDK 侧 agents 概念 | `shared/src/agent/pi-agent.ts:47` import；SDK 面见 S3.1 `AgentDefinition.memory` | 中（无 per-agent 独立 memory 目录证据）[推断] |
| 并行 git worktree | **无**——全仓 TS 源码 "worktree" 仅 1 处命中（`claude-agent.ts:1239` 注释，且是讲 Claude 会话 resume 在 worktree↔main repo 间 "No conversation found" 的坑） | grep 实测 2026-09-19 | **零**（pacman 这块 craft 帮不上） |
| 看板/状态流 | Inbox/Archive + 动态状态系统（Todo→In Progress→Needs Review→Done 可自定义）+ labels | README Features「Dynamic Status System」「Multi-Session Inbox」；`shared/src/labels/`、`shared/src/statuses/` | 高 |
| 定时 | Automations：cron-matcher + event-bus + conditions（label 变化/定时/工具使用触发建会话） | `shared/src/automations/`（cron-matcher.ts、event-bus.ts、conditions.ts）+ README「Automations」 | 高 |
| 项目 | `shared/src/projects/`（project 继承规则：explicit project > 调用会话 project） | `server-core/tasks/create-task.ts:28-33` | 高 |
| 资源{技能} | Skills per-workspace，`@` 提及即时生效 | README「Skills」「Do I need to restart」 | 高 |
| 资源{MCP} | Sources：MCP servers（本地 stdio 子进程 + 远程）+ REST API（Google/Slack/Microsoft OAuth）+ 本地文件系统；`McpClientPool` | README「Things that just work」全部 + `shared/src/mcp/mcp-pool.ts:102`、`shared/src/sources/` | 高 |
| 资源{密钥} | `shared/src/credentials/`（AES-256-GCM 加密存储，README 架构图） | 同上 | 高 |
| 资源{机器} | Remote headless server（WS+token+TLS+Docker）+ thin client；`apps/cli` 连远端 | README「Remote Server (Headless)」全节 | 高 |
| 资源{模型服务} | 多 LLM connections（Anthropic API/Claude Max、Google AI Studio、ChatGPT Plus Codex OAuth、Copilot OAuth、openai-compat 自定义端点） | README「Connection」+ `chatgpt-oauth.ts` + `backend/factory.ts` LLM Connection 注释 | 高 |
| 搜索 ⌘K | cmdk 命令面板（`@radix`/`cmdk` deps 实读于 `apps/electron/package.json`；`renderer/components/ui/command.tsx`、`slash-command-menu.tsx`） | grep/ls 实测 | 中（组件级，需按 todos.dev 屏重排） |
| 安装 App | Electron 桌面 App（+一行安装脚本） | README Installation | 中（todos.dev 是 PWA/App 形态待 #35 盘点）[推断] |
| 浏览器通知 | `apps/electron/src/main/notifications.ts`（桌面通知） | ls 实测 | 低-中（非 Web Push）[推断] |
| `tds start` executor | `craft-cli run`（自含：起 server→建会话→流式→退出）+ server 守护进程 | README「CLI Client」 | 高（形似 CLI executor 闭环） |
| 平台托管 repo / GitHub merge | 未见原生功能；GitHub 走 MCP source | README「Connect to Linear, Gmail…」 | 低 |
| transcript + token 记账 | 会话全量落盘 + Claude result `total_cost_usd`/usage（SDK 事件面） | `shared/src/agent/claude-agent.ts`（usage/cost 字段消费）；SDK S3.1 | 中-高 |

- 形态错位总结（vendor 前的定性）：craft = **Electron 桌面 + 单用户 + 本地进程模型**；todos.dev = **Web SaaS + 服务端编排**。同型的是「产品概念层」，不是「进程拓扑层」。[推断] 基于 README 架构图与 `server-core/transport`、`apps/electron/src/main` 目录实读。

### S1.6 给 #39 的输入问题（craft）

1. craft 取哪一档：**仅参考设计**（零许可义务、零移植成本，S1.5 的高同型行当蓝本）/ **vendor 组件级**（UI 件 + tasks schema/generator prompt + mcp-pool 等离散件，带 Apache 义务与 divergence 债）/ **build 私有 npm 包**（把 monorepo 包重发布进私有 registry——工具链 bun→pnpm 仍需先解决）。三档可**逐包混选**，需要一张「包×档位」清单。
2. UI 地基（#39 第 3 问）：craft UI 与 Electron renderer 耦合 + 风格是 Craft 自家（非 todos.dev 外观）——是否降级为「组件粒度/交互模式参考」，像素复刻直接以 #36 盘点为准从零做 React？
3. Tasks DAG（task.yaml schema + generator prompt + Conductor/TaskRunner）是 craft 与 todos.dev Chief 最同型的一块：vendor、参考、还是按 todos.dev 黑盒观察（#37/#41）另写？
4. 若最终选 Claude Agent SDK 后端，craft 的 `claude-agent.ts`(3,175 行) 与 backend 抽象是现成参考实现；若选 pi-only，r9 S7 的 pi-agent-server 已拆解过。两者不必都留。

---

## S2 pi SDK —— 直接可用 / 有缝 / 缺口 三表（r9 复核 + registry 核对）

版本核对（2026-09-19）：`pi-coding-agent`/`pi-agent-core` `latest = 0.85.1`、`legacy-node20 = 0.74.2`（npm registry 实测）——**r9（09-18 研究）钉的 v0.85.1 就是当前最新，r9 行号与判定全部未过期**；breaking 记录见 r9 S6（minor 周更、0.85.0 自带 Breaking 段：harness 转正默认导出/删 legacy repo API/`ModelsStreamTransforms` 更名；Node ≥22.19.0；MIT）。

### S2.1 直接可用（原生，r9 S8 判「用 pi」项）

| 能力 | pi 现状 | 依据（r9） |
|---|---|---|
| provider 传输/wire 怪癖表 | pi-ai ~40 家 provider + 生成式 catalog + pi.dev 远程 catalog 4h 刷新 | S4.1、S9.8（「最大红利」= r4 §1.3/§2 整块自研成本删掉） |
| **OAuth 订阅连接** | `ai/src/auth/oauth/` 实有：`anthropic.ts`（Claude 订阅）、`openai-codex.ts`（ChatGPT/Codex）、`github-copilot.ts`、`xai.ts`、kimi/openrouter/radius/device-code/pkce | S4.1；**直接命中 #34 锁定的「保留 OAuth 连自有 ChatGPT/Codex/Copilot/XAI 订阅」** |
| 重试 | pi-ai retry 词表分类 + AgentSession 双层重试 | S4.1 |
| Agent 循环回调面 | AgentRunSpec 同形物齐全（injection/continuation/consolidation/stop） | S1.5、S1.6#5 |
| compaction | threshold/overflow+retry/manual + 独立重试预算 + `session_before_compact` hook | S1.4（idle-TTL 除外→S2.3） |
| 会话持久化/分支 | JSONL tree（v3）：branch/fork/label/弃分支摘要/inMemory | S3.1 |
| tool 契约 | TypeBox schema + `promptSnippet/promptGuidelines` + `executionMode` + `terminate` + `addedToolNames` | S2.1 |
| durable runtime（可选） | harness：事务性 operation state、恢复重放（`replay:"safe"`）、中断物化、deferred/suspend | S1.4、S3.2（0.85.0 刚转正，experimental 消费中） |
| 观测 | before/after_provider_request + pi-telemetry(OTel) | S8 C7 |
| 事件流/嵌入 | RPC mode JSON 事件流 + extension 体系（30 事件） | S1.1、E 清单 |

### S2.2 有缝（官方注入点存在，但要作者实现/绕行）

| 缝 | 现状与 workaround | 依据 |
|---|---|---|
| 沙箱/命令围栏 | 内置 bash 裸跑（无 deny patterns/路径/SSRF）；`BashOperations`/`BashSpawnHook`/各文件工具 Operations 接口是官方缝，r3 bwrap/seatbelt 矩阵可平移 | S2.2、S9.3 |
| per-turn systemPrompt | 无公开 API；workaround = inline extension `before_agent_start` 返回 或 craft 式钉三个内部字段（`craft-agents-oss#782` 同期问题单） | S7 踩坑1、S8 D2 |
| tool_call 孤儿修复 | sequential abort 留未应答 toolCall、SessionManager 回放不修补；公开 `transformContext` 是干净外置点 | S1.6#2、S8 A5/A6 |
| message_end 先于持久化 | craft workaround：`queueMicrotask` 读 leaf（craft#782）；harness 事件带 entryId 无此缝 | S7 踩坑2、S8 D3 |
| 压缩竞态 | wrapper 侧并发 compact 与 SDK 自压缩打架（craft#464）→ `waitForCompaction` 串行化 | S7 踩坑3 |
| 工具热更 | 改 tools = dispose+`continueRecent()` 整会话重建（craft）；`refreshTools` 公开但 `_buildRuntime` 私有 | S7 踩坑5、S1.5 |
| session 存储后端 | SessionManager 具体类无 storage 抽象；`inMemory()`+事件自存 / 复制公开面重写 / **harness 层有官方 `SessionRepo` 契约（正路）** | S3.1、S8 D1 |
| 多会话并发编排 | 「跨会话编排整体是宿主职责」——pi 单活跃会话模型，无锁表/semaphore | S1.6#1、S8 A2 |

### S2.3 缺口（pi 无对应物，全在作者层）

| 缺口 | 判定 | 依据 |
|---|---|---|
| MessageBus/渠道分发 | 外置-host | S8 A1 |
| cron/heartbeat 子系统 | 纯作者（宿主调度 + `session.prompt()/steer()` 注入即等价） | S8 B5、S9.5 |
| Memory/Dream 子系统 | 放弃或纯作者（零耦合点） | S8 A8 |
| **per-agent memory** | 缺口（pi 无任何 per-agent 记忆面；对比 SDK `AgentDefinition.memory` S3.1） | S1.6#6 消息即状态、S8 A8 |
| MCP | 核心零 MCP（grep 实测+官方文档零提及）；社区 `pi-mcp-adapter@2.34.0` 或自建桥 | S5、S8 B4 |
| subagent 原语 | 无（craft 以 ephemeral `createAgentSession` 外置示范） | S8 A7、S7 |
| web tools / exec_session / apply_patch / FallbackProvider / provider_state / idle-TTL 压缩 | 各判外置/放弃 | S8 B2/B3/B9/C2/A11/A9 |

### S2.4 给 #39 的输入问题（pi）

1. 路线层决定：**AgentSession（稳定面、craft 已验证、缝清单现成）vs harness（durable 同形物多、产品接线自待）**（r9 S9.2）——这决定 S2.2 各缝走哪条 workaround。
2. pin 纪律：延续 01-stack §3（patch-pin + 显式升级窗口读 Breaking 段）；0.85.1→下一次 minor 的 Breaking 窗口成本按 r9 S6 预算。
3. MCP 归属：依赖社区 pi-mcp-adapter（快但第三方债）vs 以 `@modelcontextprotocol/sdk` 自建 defineTool 桥（r3 S3 语义全自担）——01-stack 已选「外置于 pacman」，本票只需确认桥由谁维护。
4. 是否同时引入第二 SDK（Claude Agent SDK 或 Codex 侧 executor）：若引入，craft 的 `AgentBackend` 双驱动抽象（S1.2）是唯一一手参考。

---

## S3 Claude Agent SDK（@anthropic-ai/claude-agent-sdk @0.3.277 实测）

### S3.1 todos.dev 同型场景适用面（多 agent 并行、worktree、memory、记账）

**功能命中度是四路中最高的——但这些语义全部跑在闭源二进制内**（见 S3.2）。证据全在 `sdk.d.ts`（9,451 行）/ `manifest.json` / `CHANGELOG.md`：

| 场景 | 原生面 | 出处 |
|---|---|---|
| **git worktree 并行** | `Options.projectConfigRoot`：「The trusted checkout `cwd` is a **worktree** of…Project settings (hooks, permissions), `.mcp.json`, `.claude` config trees…come from here instead of cwd」——worktree 会话的信任配置与分支内容解耦 | sdk.d.ts:1461-1469 |
| worktree 生命周期 | settings `worktree.{symlinkDirectories, sparsePaths, baseRef:'fresh'|'head', bgIsolation:'worktree'|'none', location}`；`bgIsolation` 默认「blocks Edit/Write in the main checkout until EnterWorktree is called」（后台会话自动隔离进 worktree） | sdk.d.ts:6798-6816 |
| worktree 会话检索/恢复 | `listSessions({dir, includeWorktrees:true 默认})` 「include sessions from all git worktree paths」；启动失败原因含 `worktree_resume_refused`/`worktree_unverified` | sdk.d.ts:1014-1054, 5559-5561 |
| worktree 钩子 | `HOOK_EVENTS` 含 `WorktreeCreate`/`WorktreeRemove`（33 种事件全集 :891） | sdk.d.ts:891,910,912 |
| **多 agent** | `agents: Record<string, AgentDefinition>` 子代理（tools/disallowed/model/maxTurns/permissionMode/skills/mcpServers/background）；主线程可整体换 agent（`agent:'name'`） | sdk.d.ts:38-107,1488,1504 |
| agent 团队/后台任务 | `teammateMode:'auto'|'tmux'|'iterm2'|'in-process'`（teammate 执行面）+ `TeammateIdle`/`TaskCreated`/`TaskCompleted` hooks + 后台任务完成聚合（changelog 0.3.274） | sdk.d.ts:8856-8858,910; CHANGELOG |
| **per-agent memory** | `AgentDefinition.memory: 'user'|'project'|'local'` → `.claude/agent-memory/<agentType>/` 等目录自动加载；`omitClaudeMd` 指令文件裁剪 | sdk.d.ts:87 |
| 旁观/评审 | `observer`/`observerMessage`：agent 运行时自动 spawn 只读观察员并经 `ObserverReport` 回报 | sdk.d.ts:99-105 |
| transcript/记账 | `getSessionMessages`/`getSubagentMessages`/`listSubagents`/`forkSession`/`resume`；result 消息 `total_cost_usd`/`modelUsage`/`usage_report` | sdk.d.ts:770-1084; CHANGELOG 0.3.273/0.3.277 |
| 会话存储可插拔 | `SessionStore` 接口 + `InMemorySessionStore` + `importSessionToStore`/`foldSessionSummary`（WORM/append-only 友好）——**craft 在 pi 侧求而不得的 D1 缝，SDK 是官方契约** | sdk.d.ts:820,935-977; r9 S3.1/S8 D1 对照 |
| MCP | `createSdkMcpServer` 进程内 server + stdio/HTTP 外部 server + 后台连接语义（`status:"pending"`、`alwaysLoad`、`CLAUDE_CODE_MCP_STARTUP_WAIT_MS`）+ per-agent `mcpServers` | sdk.d.ts:543; CHANGELOG 0.3.142/0.3.274 |
| 权限/BYOH | `canUseTool` 回调（含 `mcpServer.source==="sdk"` 信任键）、`permissionMode`、allowed/disallowedTools、`toolAliases`（把内置 Bash 重定向进自家沙箱） | sdk.d.ts:1517, :1558 |
| OS 沙箱 | settings `sandbox.{filesystem,network,credentials}`——网络 egress 域白名单、denyRead、env 变量 mask；`WorktreeCreate/Remove` hooks | sdk.d.ts:8324,8447 区段 |

**不适用的**：模型仅 Claude 家族（`AgentDefinition.model` 注释示例 = 'fable/opus/sonnet/haiku' 别名 + `claude-*` ID，:56）——ChatGPT/Codex/Copilot/XAI 订阅连接**不在此 SDK 面内**（#34 锁定保留项 → 若走此 SDK 必须另有第二引擎或接受订阅连接面缩水）；编排/看板/Chief 逻辑全在宿主（与 pi 同）。

### S3.2 锁定风险（协议变更史 + 许可 + 数据条款）

- **本体是闭源二进制**：npm 包只有 wrapper（`sdk.mjs` + 类型）+ `optionalDependencies` 8 个平台包；`manifest.json` 声明每平台 `binary: "claude"`，darwin-arm64 217,662,576 B / linux-x64 234,082,616 B，`manifestSignatureEnforcement: "flag"`，版本 = Claude Code **v2.1.277**、带 commit 与 checksum。→ agent loop、工具实现、worktree 语义的**实际行为由 Anthropic 单方演进**，pacman 拿不到源码、无法 vendor、无法 fork。
- **许可**：`LICENSE.md` 全文 1 行：「© Anthropic PBC. All rights reserved. Use is subject to Anthropic's Commercial Terms of Service.」；README「License and terms」重申（含「用它给自家客户服务」场景）。**非 OSI 开源、不可再分发二进制**。
- **数据条款**：README「Data collection…」：SDK 会话收集 feedback（含代码接受/拒绝、关联对话数据），受其 data-usage 政策约束——BYOC 本地跑仍受此条款，pacman spec 需写明（对照 #34 零幻觉：这条影响「用户视角不可分辨」之外的合规面）。
- **追平节奏**：302 个版本；0.3.270→0.3.277 共 9 天（registry time 实测），每版尾行「Updated to parity with Claude Code v2.1.x」——**版本面 = Claude Code 发布面，不可独立钉死行为**。
- **breaking 史**（CHANGELOG.md 全文 1,607 行扫描）：标 `**Breaking**` 共 5 条，聚在两个窗口——0.2.113（2026-04-17，`options.env` 由 overlay 改回 replace）与 **0.3.142（2026-05-14，三连：删 v2 session API / MCP 默认后台连接 / TodoWrite→Task tools 换轨）**；此后 4 个月无新 Breaking 标记，但有**不标 Breaking 的编译级删除**（0.3.271 删 `MonitorInput.persistent`，CHANGELOG:56；0.3.234 从 `ExitReason` 移除 `bypass_permissions_disabled`，CHANGELOG:264，明言 "TypeScript consumers with an explicit case branch get a compile error on upgrade"）。→ 钉版能保接口、保不住二进制行为；craft 把它 pin 在 `0.3.258`（落后 19 版）正是这种策略的活样本。
- **多路并行的现实约束**：每次 `query()` spawn 一个 CLI 子进程；N 个并行 worktree 会话 = N 个 ~220MB 二进制共享的 Node 子进程。[推断] 进程数/内存上限未实测（本图不写代码）。

### S3.3 给 #39 的输入问题（Claude Agent SDK）

1. 定位问题：**引擎之一还是唯一**？若唯一 → #34 保留的 ChatGPT/Codex/Copilot/XAI 订阅连接面直接缺失（Claude-only 模型面），除非把订阅连接判给 pi 双后端（craft 模式）或砍出范围。
2. 闭源二进制 + All-rights-reserved + 数据条款，与「复刻闭源 SaaS」的镜像关系是否可接受（法务口径，关联 #44 DMCA 评估票）。
3. 若引入：钉 `0.3.x` 的具体 patch + 升级窗口（craft 样本 = 落后 17 版存活，registry 计数实测）；worktree/memory/session-store 面按 S3.1 表当需求基线写进 04+ 架构册。
4. 「付费三项」排除与 Commercial ToS 的关系（built-in models 网关本就排除）——ToS 是否允许把 SDK 塞进未来分发的自托管产品，留 #39 终拍。

---

## S4 全自研基线（必保语义清单规模感 → 增量估算）

### S4.1 必保语义清单规模（旧 r2–r4 实测锚点；[推断] 作 todos.dev 自研规模代理——#34 Notes：旧研究「可引用不继承」）

- **r2（agent core）**：6 项点名必保（per-session 串行锁 / tool_call 配对 / 中断物化不重放 / concurrency_safe 分批 / AgentRunSpec 回调面 / contextvars 隔离，r9 S1.6 表转述）+ 附录三件套（不丢消息、双层持久化节奏、pending-queue 锁不变量，r2 §5/附4）。载体规模：`loop.py` 2,388 行、`runner.py` 1,374 行（r1 附录 wc 锚点 + r2 §4 管线 7 阶段）。
- **r3（tools/MCP/cron）**：24 静态工具 + 3 MCP 动态包装形态（r3 S2 汇总表计数行）；`_guard_command` 全套围栏语义（allow/deny 分段 fullmatch、SSRF 标记、path traversal、绝对路径多源提取——r3 S1 命令守卫段，shell.py 引用 10+ 处）；MCP 子系统（三类 wrapper/OAuth/两级重连/webui presets，r3 S3）；cron 子系统（jobs.json/action.jsonl/runs 审计/defer-until-idle，r3 S4）。
- **r4（providers/config/security）**：provider 选择算法 + 7 后端类 + `ProviderSpec` ~35 家 wire 开关（registry.py:146-786）；FallbackProvider 触发条件集；config 分层+`${VAR}` 插值+watchfiles 热更；SSRF/DNS pinning + workspace 围栏；CLI 11 命令面（r4 §0 十条摘要）。
- **r9 S8 聚合**：35 项必保语义逐条判定（A1–A15、B1–B9、C1–C8、D1–D3）+ E 清单（pi 白赚多出面 13 项，r9:326）——**这张表本身就是「全自研 vs pi 地基」的差集**。

### S4.2 增量估算（相对「pi 地基 + 宿主编排」路线）

- 选任何一条库化路线都免不掉的自研面（**决策不变量**）：todos.dev 的 Chief 拆分策略、看板/状态机、项目/资源模型、`tds start` executor、机器管理、Web SaaS 服务端多用户形态——craft 证明的是「概念层可复刻」，其产品代码在这层与 Electron 深耦合（S1.5 末），而 #34 已锁黑盒逼近口径（Chief prompt 策略无源码证据处标 [推断]）。**各路线的真实差异集中在执行引擎层**：agent loop、provider 传输、会话持久化、MCP、沙箱。
- 全自研增量 ≈ 把 r9「用 pi」面全部重写：~40 家 provider wire 怪癖表与 catalog 维护（r9 S9.8，r4 §1.3 对应物）、OAuth 六件套（anthropic/codex/copilot/xai/pkce/device-code，r9 S4.1）、session tree+compaction+重试词表（S3/S1.4）、事件面（30+ extension 事件，S1.1）。**craft 的对照数字**：为复用 pi+Claude 两引擎、把自有语义架上去，适配层就花 22.8k LOC（S1.2）——全自研等于连 pi 那 ~3 万行量级的 coding-agent 包一并自产。[推断]：量级类比，非逐行测算。
- 上游人力参照：nanobot（Python，含 17 渠道/CLI/webui/TUI 全家）629 py 文件 / 4,443 commits / 2026-02-01→09-16 / 峰值 3 核心开发者（r1 表头与 §0.5）；craft（TS，Electron 全栈产品）src TS ≈ 338k 行 / 8 个月（created 2026-01-19）。单人+AI agents 路线（#34 Notes）下，这三组锚点都指向：**自研引擎层是三库路线的净增成本，且没有外部证据说明它能换回任何 todos.dev 平价分**。

### S4.3 给 #39 的输入问题（自研基线）

1. 全自研在 #39 里的合法角色是否只剩「兜底/对照」——即当且仅当 pi 与 Claude SDK 双双不可接受时才启用？
2. 若 pi 路线后续撞穿（如 harness 面长期 experimental），「重写 pi 层」与「换 harness」哪个先动（r9 S9.2 的路线问题在自研语境下的续命版）？
3. provider wire 怪癖表的维护承诺（40 家持续更新 vs 上游 pi.dev catalog）写不写进 04+ 册的运维义务？

---

## S5 四路对比总表（复用面 / 改造面 / 新增面 / 许可与锁定）

| 轴 | craft-agents-oss | pi SDK | Claude Agent SDK | 全自研基线 |
|---|---|---|---|---|
| **复用面（现成可取）** | 产品概念层全套（Chief-DAG/看板/automations/sources/credentials/机器/CLI executor，S1.5）+ 双后端 `AgentBackend` 抽象 + tasks schema/generator prompt + ChatGPT OAuth 实现 + 事件适配（pi 1,071 行/Claude 545 行） | provider 传输全家桶（~40 家+catalog 更新+OAuth 六件套+重试词表）+ AgentSession 循环原语 + session tree/compaction + RPC mode + extension 面（S2.1） | worktree 原生（隔离/钩子/跨 worktree 会话检索）、子代理+teammates+observer、per-agent memory、SessionStore 契约、OS 沙箱、MCP 内嵌、transcript/成本 API（S3.1） | 无（全部自产）；唯一"复用"= 旧图 r1–r9 已钉的语义清单本身 |
| **改造面（拿过来要动的）** | monorepo 工具链（bun→pnpm/Node24）、Electron↔Web 形态拆分、品牌/域名/bundle ID 清理（TRADEMARK）、338k LOC 中选件剥离、无 semver 承诺的 divergence 债 | S2.2 八条缝的 workaround 层（craft S7 清单即现成答案）+ harness-vs-AgentSession 路线选择 + patch-pin 升级窗口 | 模型面缩水为 Claude-only → 订阅连接需另一引擎补位；行为黑盒（闭源二进制）无法对拍/修 bug；版本策略=「钉旧版+滞后存活」（craft 样本：pin 0.3.258，当前 0.3.277 之后有 17 个发布版） | r2–r4 全部必保语义 + r9「用 pi」面 + E 清单重写；工程参照 nanobot/craft 8 个月量级（S4.2） |
| **新增面（无论选谁都逃不掉）** | todos.dev 像素级 Web UI（craft 外观不相干）、tds executor 平价协议（#37 观察）、平台托管 repo/GitHub merge 平价、服务端多用户化 | 宿主编排层（多会话注册/锁表/bus）、cron、memory、MCP 桥、web tools、沙箱策略（S2.2/S2.3 外置项） | 同 pi（编排/看板仍宿主）+ Claude 特有协议对拍 | Chief/看板/编排/executor（与各行相同）+ 引擎层全部 |
| **许可与锁定风险** | 代码：Apache-2.0（宽松、可 vendor，NOTICE 需传递其 Claude SDK ToS 提示）；商标：四项硬边界（S1.4）；锁定=**组织性**（craft.do 上游方向 + 无发布物），非技术 | MIT；锁定=**版本面**（0.x 周更带 Breaking，钉 patch + 升级窗口可控；r9 S6）；行为可审计（全开源） | **© Anthropic PBC All rights reserved + Commercial ToS**；217–234MB/平台闭源签名二进制 + 逐日 parity；数据收集条款；Breaking 史两窗口 + 不标记的编译级删除（S3.2）；锁定=**最深**（行为与条款双不可控） | 零第三方锁定；锁定=**自身维护成本**（40 家 provider 表 + wire 兼容随模型市场漂移需自养） |

---

## S6 汇总：#39 终拍前必须回答的问题（按依赖序）

1. **引擎数量**：单引擎（pi）还是双引擎（pi + Claude SDK，craft 模式 S1.2）？——决定 #34 保留的 ChatGPT/Codex/Copilot/XAI 订阅连接走 pi 原生 OAuth（S2.1）还是接受 Claude-only 缩水，也决定要不要 `AgentBackend` 抽象层。
2. **Claude Agent SDK 的闭源+ToS 风险定价**：S3.1 的 worktree/memory 原生面值不值 S3.2 的锁定？若不值 → pi 单引擎 + 宿主 worktree 编排（r9 无 worktree 原生面，纯外置）。
3. **craft 的档位选择逐包过一遍**（S1.6.1）：npm 无发布物是既成事实，「当库引」只对 pi/SDK 成立；craft 在 #39 语义里的准确身份 = **同型架构的一手证据 + 可 vendor 组件源 + 双后端抽象的参考实现**，三取 N。
4. **UI 地基**：craft UI（Electron React/Radix/cmdk，S1.1/S1.5）对像素级复刻 todos.dev 的帮助上限是交互参考；若 #36 盘点显示 Web 组件从零更省，UI 行选「仅参考」。
5. **自研兜底条款**：S4.3 三问，尤其「pi 撞穿时重写 vs 换 harness」的触发条件。
6. 全部路线共担项（不进对比表分歧）：Chief/看板/executor/托管 repo 平价、Web 服务端形态、素材替换（#44）——与地基选择正交。
