# R1 — 上游 nanobot 构建顺序考古

| 项 | 值 |
|---|---|
| 研究对象 | `/Users/xmon/Code/AgentProjects/nanobot`（本地 clone，只读） |
| 上游 remote | `https://github.com/HKUDS/nanobot.git`，branch `main` |
| commit 总数 | 4443（`git rev-list --count HEAD`），HEAD = `2fb16593` |
| 时间跨度 | 2026-02-01（`086d65ac`）→ 2026-09-16（`2fb16593`） |
| 文件规模 | t=0 快照 67 文件 → HEAD 1472 文件（其中 `nanobot/` 629） |
| 检索日期 | 2026-09-17 |
| 方法 | 本地 git 历史考古：`log --diff-filter=A`（出生 commit）、`log -S`（符号出现）、`ls-tree`（快照层次）、`for-each-ref refs/tags`（发布锚点）、`rev-list --count`（序号/区间规模） |
| 标记约定 | 未标记者 = 有 git 时间证据；「**结构推断**」= 由快照依赖方向反推；「**推断**」= 无直接证据的解读 |
| 引用校验 | 本文引用的 139 个 distinct 8 位 SHA 已机器校验：134 个解析为 `main` 上的 commit，5 个解析为 annotated tag object（见 §2.2 †）。校验法：`grep -oE '\b[0-9a-f]{8}\b'` 抽取 → 与 `git rev-list HEAD \| cut -c1-8` 做 `comm -23` → 差集逐个 `git cat-file -t` |

---

## 0. 结论速览

1. **公开 git 历史不包含真正的从零构建过程，且 t=0 就是完整可跑产品而非骨架。** `086d65ac`(2026-02-01) 只有 README.md 一行；`d4cc48af`(2026-02-01, "🐈nanobot: hello world!") 一次性投放 **67 个文件**，已同时含 `bus/ agent/ agent/tools/ providers/ channels/ cli/ config/ cron/ heartbeat/ session/ skills/ utils/` + TypeScript `bridge/` + `workspace/` 模板；`pyproject.toml` 里 `version = "0.1.3.post1"` —— 即 0.1.0→0.1.3.post1 的迭代发生在开源之前，被 squash 掉了（`git show d4cc48af:pyproject.toml`、`git ls-tree -r --name-only d4cc48af`）。
2. **最小可跑形态 = commit #2（`d4cc48af`）**，入口 `nanobot agent -m "..."`：`MessageBus()` + `LiteLLMProvider()` + `AgentLoop.process_direct()` 三件套，不依赖任何 channel（`git show d4cc48af:nanobot/cli/commands.py` L277-335）。
3. **provider 层 t=0 只有一个实现**：`providers/base.py`（ABC + `LLMResponse`/`ToolCallRequest` 数据契约）+ `providers/litellm_provider.py`（用 LiteLLM 一把梭 OpenRouter/Anthropic/OpenAI，默认模型 `anthropic/claude-opus-4-5`）。litellm 在 **`3dfdab70`(2026-03-24, #1445)** 被原生 openai + anthropic SDK 替换。
4. **tools 与 loop 同期存在**，不是后加的：t=0 已有 `base/registry/filesystem/shell/web/message` 6 个文件，`AgentLoop._register_default_tools()` 在构造时硬编码注册 8 个工具。
5. **channels 铺量发生在开源后 8 天内、由社区 PR 驱动**：t=0 只有 telegram + whatsapp；`ba6c4b74`discord(02-02) → `50fa024a`feishu(02-04) → `051e396a`slack(02-04) → `cfe43e49`email(02-07) → `240db894`dingtalk(02-08) → `34dc933f`qq / `20b8a2fc`moltchat / `0d3dc57a`matrix(02-09)。HEAD 有 17 个 channel 插件目录。同期第二核心开发者 `chengyongru` 于 2026-02-13 入场（首个 `740294fd`，最终 1001 commits，与原作者 `Xubin Ren` 1048 + `Re-bin` 304 同量级）—— 项目第 13 天从单人变双核。
6. **AgentLoop / AgentRunner 分家 = `e7d371ec`(2026-03-26, #1469)** "refactor: extract shared agent runner and preserve subagent progress on failure"：新建 `agent/runner.py` 221 行，`loop.py` 644→584 行，同 commit 带 `tests/agent/test_runner.py` 186 行 + `test_task_cancel.py` 80 行；同日 `5bf0f6fe` 追加 "unify agent runner lifecycle hooks" 引入 `agent/hook.py`。驱动力是 subagent 复用，不是预防性设计。
7. **subagent 是 launch 当天第 15 个 commit**：`051a97fa`(2026-02-01) "feat: add sub-agent system"，+`agent/subagent.py` 233 行 +`agent/tools/spawn.py` 65 行。多智能体不是后期能力。
8. **MCP 在第 12 天进入**：`cb5964c2`(2026-02-12, #268) "feat(tools): add mcp support"；后来在 `418cb23d`(2026-05-25) "feat(apps): unify CLI apps and MCP" 被并入 apps 抽象。
9. **架构演化的主线是「硬编码 → 可发现插件」**：provider if-elif → 声明式 registry（`299d8b33`, 2026-02-08, #192）；channel 硬编码表 → pkgutil auto-discover（`254cfd48`, 2026-03-11, #1162）→ channel plugin architecture（`dbdb43fa`, 2026-03-13）→ self-contained channel packages（`462a0dfb`, 2026-07-19, 388 files changed）；tool 硬编码注册 → JSON Schema（`e7798a28`, 2026-04-04）→ plugin-based discovery（`043f0e67`, 2026-05-11）→ execution boundary（`e73cce70`, 2026-08-28）。
10. **前端在架构成熟之后才铺**：WebUI `9ed3031a`(2026-04-18, #1995) 才出现，TUI `ce070c83`(2026-08-12, #3980) 是倒数第二阶段。t=0 的唯一 UI 是 typer CLI（`cli/commands.py` 634 行单文件，直到 `e2563e2e`, 2026-07-30 才拆成 20 个模块）。

---

## 1. 最小可跑形态

### 1.1 「第一个能跑的东西」

**commit #2 = `d4cc48af`（2026-02-01, Re-bin, "🐈nanobot: hello world!"）**。git 可见范围内不存在更早的可跑形态（#1 `086d65ac` 只有 README）。

可跑判据（均可在 `d4cc48af` 快照验证）：

| 判据 | 证据 |
|---|---|
| 有 console entry point | `pyproject.toml` → `nanobot = "nanobot.cli.commands:app"`；`nanobot/__main__.py` → `from nanobot.cli.commands import app` |
| 有不依赖 channel 的直连路径 | `cli/commands.py` 的 `agent` 命令：`--message` 单发 + 无参交互 REPL，两者都走 `agent_loop.process_direct(...)` |
| 有完整依赖声明 | `pyproject.toml` dependencies: typer / litellm / pydantic / pydantic-settings / websockets / websocket-client / httpx / loguru / readability-lxml / rich / croniter / python-telegram-bot |
| 有默认模型 | `providers/litellm_provider.py` → `default_model: str = "anthropic/claude-opus-4-5"` |
| 有开箱 prompt/记忆模板 | `workspace/{AGENTS,SOUL,TOOLS,USER,HEARTBEAT}.md` + `workspace/memory/MEMORY.md` |

**最小可跑组合（3 个对象）**：`MessageBus()` → `LiteLLMProvider(api_key, api_base, default_model)` → `AgentLoop(bus, provider, workspace, brave_api_key)`，然后 `await loop.process_direct(msg, session_id)`。channel / cron / heartbeat 全部不在这条路径上。

### 1.2 t=0 快照层次拆解（67 文件）

| 层 | t=0 文件 | 行数/字节量级 |
|---|---|---|
| **入口** | `__main__.py`, `cli/commands.py` | commands.py 20149 B / 634 行（t=0 最大单文件） |
| **配置** | `config/loader.py`, `config/schema.py` | 2765 B / 3473 B |
| **事件契约** | `bus/events.py` | 1038 B（`InboundMessage` / `OutboundMessage` 两个 dataclass） |
| **传输** | `bus/queue.py` | 2929 B（`MessageBus`：inbound/outbound 两个 asyncio.Queue + outbound 订阅分发） |
| **模型抽象** | `providers/base.py`, `providers/litellm_provider.py` | 1900 B / 4717 B |
| **核心循环** | `agent/loop.py` | 7274 B / **213 行** |
| **上下文** | `agent/context.py`, `agent/memory.py`, `agent/skills.py` | 6298 / 3482 / 8422 B |
| **工具** | `agent/tools/{base,registry,filesystem,shell,web,message}.py` | registry 仅 1937 B |
| **会话** | `session/manager.py` | 6325 B |
| **通道** | `channels/{base,manager,telegram,whatsapp}.py` | telegram 7521 B |
| **定时/心跳** | `cron/{service,types}.py`, `heartbeat/service.py` | 12031 / 1586 / 4293 B |
| **技能库** | `skills/{github,skill-creator,summarize,tmux,weather}/` | skill-creator SKILL.md 18356 B |
| **Node 边车** | `bridge/{package.json,tsconfig.json,src/{index,server,whatsapp,types.d}.ts}` | whatsapp.ts 4934 B |
| **工作区模板** | `workspace/*.md`, `workspace/memory/MEMORY.md` | — |

### 1.3 依赖方向（结构推断）

从 `d4cc48af` 快照的 import 图读出：

```
cli/commands.py  (composition root, 唯一 new 出全部对象的地方)
   ├─→ config/loader.py ─→ config/schema.py
   ├─→ bus/queue.py ─────→ bus/events.py            [叶子: 只依赖 stdlib + loguru]
   ├─→ providers/litellm_provider.py ─→ providers/base.py   [叶子: 只依赖 stdlib ABC]
   └─→ agent/loop.py  (汇聚点)
          ├─→ bus/events.py, bus/queue.py
          ├─→ providers/base.py            ← 只依赖 ABC，不依赖 litellm 实现
          ├─→ agent/context.py ─→ agent/memory.py, agent/skills.py
          ├─→ agent/tools/registry.py ─→ tools/base.py
          │     └─ loop._register_default_tools() 硬编码 register(filesystem/shell/web/message)
          └─→ session/manager.py

channels/manager.py ─→ channels/base.py ─→ bus/events.py, bus/queue.py   [与 agent 平行，只通过 bus 通信]
cron/service.py, heartbeat/service.py ─→ bus/queue.py                    [同上]
```

**结构推断的构建顺序**（依据：叶子节点无内部依赖，汇聚点依赖全部叶子）：

1. `bus/events.py` —— 两个 dataclass，定义 `InboundMessage.session_key = f"{channel}:{chat_id}"`。这是整个系统的最小词汇表。
2. `providers/base.py` —— ABC + `LLMResponse`/`ToolCallRequest`。工具循环的全部语义都建立在这个契约上。
3. `bus/queue.py` —— 两个 asyncio.Queue + `subscribe_outbound`/`dispatch_outbound`，实现「channel 与 agent 解耦」这条注释里明写的设计意图。
4. `agent/tools/{base,registry}.py` + 具体 tool —— registry t=0 只有 1937 B，是最薄的抽象。
5. `agent/context.py` + `session/manager.py` + `agent/memory.py` + `agent/skills.py` —— prompt 组装。
6. `agent/loop.py` —— 213 行把上面全部串起来，`max_iterations: int = 20` 的 tool-call 循环。
7. `channels/{base,manager,telegram}.py` —— 第一个真实 IO 端。
8. `config/` + `cli/commands.py` —— composition root，最后写。

> ⚠️ 这是**结构推断**，不是时间证据：`d4cc48af` 是 squash 投放，1-8 之间的真实顺序不可从 git 观测。支持它的旁证是 t=0 各文件的抽象成熟度差异极大（`registry.py` 1937 B vs `cron/service.py` 12031 B），说明它们不是在同一个设计冲刺里写出来的。

---

## 2. 构建阶段聚类

### 2.1 阶段总表

| # | 阶段名 | 时间区间 | commit 范围 | 区间 commit 数 | 主轴 |
|---|---|---|---|---|---|
| P0 | 预开源迭代（不可观测） | ? → 2026-02-01 | — | — | 0.1.0 → 0.1.3.post1 |
| P1 | 整包投放 | 2026-02-01 | `086d65ac` → `d4cc48af` | 2 | 全部核心子系统一次到位 |
| P2 | 接入面扩张 | 2026-02-01 → 2026-02-13 | `d4cc48af` → `202f0a31` (v0.1.3.post7) | 95 + 195 = **290** | provider × channel 双向铺量 + subagent/MCP/memory |
| P3 | 内核插件化与硬化 | 2026-02-14 → 2026-03-27 | `202f0a31` → `c15f63a3` (v0.1.4.post6) | 142 + 431 + 617 = **1190** | API 层、registry/plugin、安全沙箱、Runner 分家 |
| P4 | 图形前端与长任务 | 2026-03-28 → 2026-05-16 | `c15f63a3` → `c018c3fb` (v0.2.0) | 243 + 509 + 259 = **1011** | WebUI、tool schema 化、goal/long_task、failover |
| P5 | 平台化 | 2026-05-17 → 2026-07-25 | `c018c3fb` → `3f602fbc` (v0.3.0) | 629 + 510 = **1139** | apps/SDK/gateway/triggers 模块化、context governance、channel 自包含 |
| P6 | 多前端与生态 | 2026-07-26 → 2026-09-16 | `3f602fbc` → `2fb16593` (HEAD，v0.3.5 之后) | **811** | TUI、Agent Plugins、usage 后端、events 统一、monorepo packages |

区间 commit 数来源：`git rev-list --count <tagA>..<tagB>`。tag → commit 映射来源：`git for-each-ref --sort=creatordate --format='%(refname:short)|%(creatordate:short)|%(objectname:short)' refs/tags`。

### 2.2 发布锚点（全部 tag）

| tag | 日期 | 指向 commit | tag | 日期 | 指向 commit |
|---|---|---|---|---|---|
| v0.1.3.post4 | 2026-02-04 | `795f8105` | v0.1.5 | 2026-04-06 | `79234d23` |
| v0.1.3.post5 | 2026-02-07 | `9fe2c09f` | v0.1.5.post1 | 2026-04-14 | `64830714` |
| v0.1.3.post6 | 2026-02-10 | `fc9dc4b3` | v0.1.5.post2 | 2026-04-21 | `950dddec` |
| v0.1.3.post7 | 2026-02-13 | `202f0a31` | v0.1.5.post3 | 2026-04-29 | `0b1631f3` |
| v0.1.4 | 2026-02-18 | `b14d4711` | **v0.2.0** | 2026-05-16 | `c018c3fb` |
| v0.1.4.post1 | 2026-02-21 | `af71ccf0` | v0.2.1 | 2026-06-01 | `f309982b` † |
| v0.1.4.post2 | 2026-02-24 | `17de3699` | v0.2.2 | 2026-06-23 | `e2e75c91` † |
| v0.1.4.post3 | 2026-02-28 | `4f0530dd` | **v0.3.0** | 2026-07-25 | `3f602fbc` † |
| v0.1.4.post4 | 2026-03-08 | `a0bb4320` | **v0.3.5** | 2026-09-16 | `1bb712d3` † |
| v0.1.4.post5 | 2026-03-16 | `337c4600` † | | | |
| v0.1.4.post6 | 2026-03-27 | `c15f63a3` | | | |

† = annotated tag（tag object SHA 与 commit SHA 不同）。这 5 个 tag 的 tag-object SHA 分别是 `b1ee2051`(post5) / `ede4c692`(v0.2.1) / `7e7216d9`(v0.2.2) / `78a7ee31`(v0.3.0) / `b9857d74`(v0.3.5)；上表「指向 commit」列统一给 peel 之后的 commit（`git for-each-ref --format='%(objectname:short)|%(*objectname:short)' refs/tags`）。其余 15 个是 lightweight tag，两者相同。

发布节奏：2 月 5 个 tag（3-4 天一个），3 月 3 个，4 月 4 个，5-9 月 5 个（间隔拉长到 2-8 周）。**推断**：早期高频 patch 发布是社区洪峰的产物（每次合入 provider/channel 就发一版），后期节奏放缓说明架构进入稳定期。

无 tag 但存在的发布 commit：`76df1bc7`(2026-02-01, #18) "release 0.1.3.post2"、`959c4dad`(2026-02-01) "release 0.1.3.post3" —— 说明 tag 从 post4 才开始打。

### 2.3 各阶段展开

#### P2 — 接入面扩张（2026-02-01 → 2026-02-13，290 commits）

| 类别 | commit | 日期 | 内容 |
|---|---|---|---|
| 标志性 | `051a97fa` (#15) | 02-01 | sub-agent system：`agent/subagent.py` +233，`agent/tools/spawn.py` +65，`loop.py` +115 |
| provider | `2dd28466` | 02-01 | Zhipu API，并把 `glm-4.7-flash` 设为默认模型 |
| provider | `2b19dcf9` (#25) | 02-02 | vLLM / local LLM |
| provider | `ab45185e` | 02-02 | Gemini |
| provider | `5c49bbc0` | 02-02 | Amazon Bedrock |
| provider | `f23548f2` | 02-03 | DeepSeek |
| provider | `5bff2409` | 02-05 | OpenAI Codex OAuth login |
| provider | `299d8b33` (#192) | 02-08 | **refactor: replace provider if-elif chains with declarative registry** |
| channel | `ba6c4b74` (#30) | 02-02 | Discord |
| channel | `50fa024a` / `051e396a` | 02-04 | Feishu / Slack |
| channel | `cfe43e49` | 02-07 | Email（consent-gated IMAP/SMTP） |
| channel | `240db894` | 02-08 | DingTalk |
| channel | `34dc933f` / `20b8a2fc` / `0d3dc57a` | 02-09 | QQ / Moltchat / Matrix |
| tool | `b1d6670c` | 02-05 | cron tool（调度提醒） |
| memory | `94c21fc2` | 02-12 | **redesign memory system — two-layer architecture with grep-based retrieval**（`memory.py` 103 行改动，净减） |
| MCP | `cb5964c2` (#268) | 02-12 | feat(tools): add mcp support |
| 测试 | `7ef18c4e` | 02-02 | 项目首个 test commit（"Validate tool params and add tests"） |
| 安全 | `00841309` / `a20d887f` | 02-02 / 02-04 | exec tool safety guard + 参数校验 |
| 安全 | `ea849650` | 02-02 | web_fetch URL validation |
| 人力 | `740294fd` | 02-13 | chengyongru 首次提交（第二核心开发者入场） |

验收信号：5 个 tag（post4-post7 + 无 tag 的 post2/post3）；`tests/` 目录出现（`7ef18c4e`）。

#### P3 — 内核插件化与硬化（2026-02-14 → 2026-03-27，1190 commits）

**这是 commit 密度最高的阶段（1190/41 天 ≈ 29 commits/天），也是架构分歧最大的一段。**

| 类别 | commit | 日期 | 内容 |
|---|---|---|---|
| API | `80219baf` (#840) | 03-01 | **OpenAI-compatible endpoint with x-session-key isolation** → `nanobot/api/` 出生 |
| 打包 | `577b3d10` | 02-23 | **refactor: move `workspace/` to `nanobot/templates/` for packaging** |
| channel | `254cfd48` (#1162) | 03-11 | **auto-discover channels via pkgutil, eliminate hardcoded registry** |
| channel | `dbdb43fa` | 03-13 | **channel plugin architecture with decoupled configs**（同时 `docs/` 目录出生） |
| CI | `ec6e0993` | 03-12 | GitHub Actions workflow for test directory（项目首个 CI） |
| CLI | `f127af04` | 03-14 | interactive onboard wizard（`cli/onboard.py` 出生） |
| CLI | `f2e1cb36` | 03-22 | extract streaming renderer to `cli/stream.py` with Rich Live |
| 安全 | `6e2b6396` (#1289) | 03-16 | **SSRF protection, untrusted content marking, internal URL blocking** → `nanobot/security/` 出生 |
| 安全 | `7913e715` | 03-16 | sandbox exec calls with bwrap, run container as non-root |
| 命令 | `20494a2c` | 03-23 | refactor command routing for future plugins → `nanobot/command/` 出生 |
| **provider** | `3dfdab70` (#1445) | 03-24 | **replace litellm with native openai + anthropic SDKs**：删 `litellm_provider.py`(413) + `custom_provider.py`(152)，加 `anthropic_provider.py`(441) + `openai_compat_provider.py`(349)，`registry.py` 339 行改动，18 files / +1014 −1258 |
| **agent** | `e7d371ec` (#1469) | 03-26 | **extract shared agent runner**：新建 `agent/runner.py`(221)，`loop.py` 644→584，+`tests/agent/test_runner.py`(186) +`test_task_cancel.py`(80) |
| agent | `5bf0f6fe` | 03-26 | unify agent runner lifecycle hooks → `agent/hook.py` 出生 |
| SDK | `7fad1480` | 03-30 | Python SDK facade and per-session isolation |
| agent | `411b059d` | 03-14 | replace `<SILENT_OK>` with structured post-run evaluation |

验收信号：4 个 tag（v0.1.4 → post6）；CI 出现（`ec6e0993`）；`docs/` 出现（`dbdb43fa`）；重构 commit 首次自带成套测试（`e7d371ec`）。

#### P4 — 图形前端与长任务（2026-03-28 → 2026-05-16，1011 commits）

| 类别 | commit | 日期 | 内容 |
|---|---|---|---|
| tool | `15cc9b23` | 04-02 | built-in grep and glob search tools |
| **tool** | `e7798a28` | 04-04 | **streamline Tool class and add JSON Schema for parameters** |
| 模板 | `d436a1d6` | 04-04 | Jinja2 templating for agent responses and memory consolidation |
| tool | `651aeae6` | 04-10 | improve file editing + notebook tool |
| context | `5932482d` | 04-11 | rename auto compact module → `agent/autocompact.py` 现名 |
| tool | `b51da93c` | 04-15 | SelfTool（runtime self-inspection） |
| **WebUI** | `9ed3031a` (#1995) | 04-18 | **initial webui with websocket chat flow**：`webui/` 源码树 + `nanobot/web/__init__.py` + `channels/websocket.py` +339 |
| WebUI | `4650b23d` | 04-19 | i18n support and locale switcher |
| channel | `ad57bcd1` | 04-08 | WebSocket server channel and tests |
| channel | `824dcca5` | 04-02 | Microsoft Teams |
| tool | `cfc76ffb` | 04-25 | ask_user tool |
| channel | `b1a3053c` | 04-28 | napcat |
| 协作 | `6eef3d0f` | 04-29 | **CLAUDE.md + `.agent/` guides for AI contributors** |
| **tool** | `043f0e67` | 05-11 | **plugin-based tool discovery and runtime context protocol** |
| provider | `913b0774` | 05-12 | model failover with `fallback_models` |
| 配对 | `4c4a9ae5` | 05-14 | chat-native DM sender approval → `nanobot/pairing/` 出生 |
| channel | `8ec10251` | 05-15 | Signal |
| 图像 | `e936ed48` | 05-08 | image generation tool and WebUI mode |
| **长任务** | `1c2ea1aa` | 05-16 | **`/goal` command & long-running tasks (`long_task`)** |
| 发布 | `c018c3fb` | 05-16 | chore(release): **bundle webui into wheel** and prep 0.2.0 |

验收信号：v0.2.0（首个 minor bump）；WebUI 进 wheel（`c018c3fb`）；`nanobot/webui/` Python 侧模块在 `57d5276d`(2026-05-19) 出生。

#### P5 — 平台化（2026-05-17 → 2026-07-25，1139 commits）

| 类别 | commit | 日期 | 内容 |
|---|---|---|---|
| **apps** | `418cb23d` | 05-25 | **unify CLI apps and MCP** → `nanobot/apps/` 出生 |
| **heartbeat** | `fe2af64e` | 05-27 | **migrate heartbeat service to cron-based auto-registration** → `nanobot/heartbeat/` 目录被删除（t=0 就有的模块在此消失） |
| bus | `628b250e` | 06-01 | decouple webui runtime state via events |
| context | `3460ca3c` | 06-07 | gate microcompaction on context pressure → `agent/context_governance.py` 出生 |
| 音频 | `f3eb2aa0` / `9c812803` | 06-06 / 06-09 | AssemblyAI transcription provider / shared voice input → `nanobot/audio/` 出生 |
| cron | `a326ba40` | 06-11 | bind scheduled automations to sessions |
| **SDK** | `dbf3c4b2` | 06-21 | expand Python runtime controls → `nanobot/sdk/` 出生 |
| **gateway** | `e3c9aff4` | 06-22 | background and service controls → `nanobot/gateway/{runtime,service}.py` 出生（gateway 概念在 t=0 就存在于 CLI，此处才独立成模块） |
| channel | `fff38f11` | 06-22 | Mattermost |
| **bridge** | `2a9e288d` | 06-26 | **replace bridge with neonize** → t=0 的 TypeScript `bridge/` 目录被删除 |
| bus | `5f4cfbcb` | 06-30 | type outbound runtime events |
| 触发器 | `2a0cd19a` | 06-30 | session-bound local triggers → `nanobot/triggers/` 出生 |
| model | `bd94fefd` | 07-10 | **introduce immutable model runtime resolver** → `agent/model_runtime.py` 出生 |
| **channel** | `462a0dfb` | 07-19 | **make built-in channels self-contained (#4908)**：388 files / +17032 −5049，每个 channel 变成 `{manifest,runtime,validation,tests,webui/locales}` 的独立包 |
| agent | `3a400e02` | 07-24 | support inline subagent consultation |
| 发布 | `5328a95a` / `d6f6bbdd` | 07-25 | prepare v0.3.0 / "preview the **agency release**" |

验收信号：v0.2.1、v0.2.2、v0.3.0 三个 tag；tests 目录扩到 19 个子目录（与 package 目录一一对应）。

#### P6 — 多前端与生态（2026-07-26 → 2026-09-16，811 commits）

| 类别 | commit | 日期 | 内容 |
|---|---|---|---|
| **CLI** | `e2563e2e` | 07-30 | **split commands into focused modules (#5175)** → t=0 的 634 行 `cli/commands.py` 最终散成 20 个文件 |
| session | `9b25da7b` | 08-02 | cross-session references |
| MCP | `8e77f3f8` | 08-10 | browser OAuth for remote MCP servers |
| **插件** | `d5e0df69` | 08-11 | **integrate portable Agent Plugins** → `agent/plugins.py` 出生 |
| **TUI** | `ce070c83` (#3980) | 08-12 | **native TypeScript terminal UI** → 顶层 `tui/`（bun + TypeScript）出生 |
| TUI | `df142597` | 08-18 | reduce cold-start latency |
| usage | `2ac802b2` | 08-22 | unified provider usage backend → `nanobot/llm_usage/` 出生 |
| tool | `e73cce70` | 08-28 | extract tool execution boundary (#5569) → `agent/tools/execution.py` |
| **events** | `192e2e90` | 09-06 | **unify scoped runtime notifications across clients (#5670)** → `nanobot/events.py` 出生 + 顶层 `packages/client-events` 出生（monorepo 化） |
| TUI | `2fb16593` | 09-16 | keep input responsive during agent output (#5791)（当前 HEAD 附近） |

验收信号：v0.3.5 tag（2026-09-16, `b9857d74`）；`packages/` 出现意味着跨语言共享契约（TS client + Python server）。

---

## 3. 子系统出生顺序表

`#` = `git rev-list --count <hash>`（该 commit 可达的 commit 数，近似全库序号；含 merge，故为近似值）。未测量者留空。

| 子系统 | 出生 commit | 日期 | # | 证据 |
|---|---|---|---|---|
| bus（events + queue） | `d4cc48af` | 2026-02-01 | 2 | t=0 快照含 `bus/events.py`, `bus/queue.py` |
| providers（base + litellm） | `d4cc48af` | 2026-02-01 | 2 | t=0 快照含 `providers/base.py`, `litellm_provider.py` |
| agent loop | `d4cc48af` | 2026-02-01 | 2 | t=0 `agent/loop.py` 213 行，class `AgentLoop` |
| agent context/memory/skills | `d4cc48af` | 2026-02-01 | 2 | t=0 `agent/{context,memory,skills}.py` |
| tools（base/registry/filesystem/shell/web/message） | `d4cc48af` | 2026-02-01 | 2 | t=0 `agent/tools/` 6 文件 |
| session manager | `d4cc48af` | 2026-02-01 | 2 | t=0 `session/manager.py` |
| channels（telegram, whatsapp） | `d4cc48af` | 2026-02-01 | 2 | t=0 `channels/{base,manager,telegram,whatsapp}.py` |
| cli（typer） | `d4cc48af` | 2026-02-01 | 2 | t=0 `cli/commands.py` 634 行 |
| config（loader + pydantic schema） | `d4cc48af` | 2026-02-01 | 2 | t=0 `config/{loader,schema}.py` |
| cron | `d4cc48af` | 2026-02-01 | 2 | t=0 `cron/{service,types}.py` |
| heartbeat | `d4cc48af` | 2026-02-01 | 2 | t=0 `heartbeat/service.py`；**于 `fe2af64e`(2026-05-27) 删除** |
| skills 库（github/skill-creator/summarize/tmux/weather） | `d4cc48af` | 2026-02-01 | 2 | t=0 `nanobot/skills/*` |
| bridge（TypeScript WhatsApp 边车） | `d4cc48af` | 2026-02-01 | 2 | t=0 `bridge/src/*.ts`；**于 `2a9e288d`(2026-06-26) 删除** |
| workspace 模板 | `d4cc48af` | 2026-02-01 | 2 | t=0 `workspace/*.md`；**于 `577b3d10`(2026-02-23) 迁入 `nanobot/templates/`** |
| **subagent** | `051a97fa` | 2026-02-01 | 15 | `agent/subagent.py` +233, `agent/tools/spawn.py` +65 |
| tests | `7ef18c4e` | 2026-02-02 | — | "Validate tool params and add tests" |
| provider declarative registry | `299d8b33` | 2026-02-08 | 192 | 替换 if-elif 链 |
| cron tool | `b1d6670c` | 2026-02-05 | — | `agent/tools/cron.py` |
| 两层 memory + grep 检索 | `94c21fc2` | 2026-02-12 | — | `agent/memory.py` 重写 |
| **MCP** | `cb5964c2` | 2026-02-12 | 268 | "feat(tools): add mcp support" |
| templates（打包用） | `577b3d10` | 2026-02-23 | — | `workspace/` → `nanobot/templates/` |
| **api（OpenAI 兼容端点）** | `80219baf` | 2026-03-01 | 840 | `nanobot/api/` |
| channel pkgutil auto-discover | `254cfd48` | 2026-03-11 | 1162 | 消除硬编码 registry |
| CI（GitHub Actions） | `ec6e0993` | 2026-03-12 | — | `.github/workflows/` |
| docs/ | `dbdb43fa` | 2026-03-13 | — | channel plugin architecture 同 commit |
| cli/onboard.py | `f127af04` | 2026-03-14 | — | 交互式配置向导 |
| **security** | `6e2b6396` | 2026-03-16 | 1289 | SSRF / 不可信内容标记 |
| sandbox（bwrap） | `7913e715` | 2026-03-16 | — | exec 沙箱化 |
| cli/stream.py | `f2e1cb36` | 2026-03-22 | — | Rich Live 流式渲染 |
| command/ | `20494a2c` | 2026-03-23 | — | 命令路由重构 |
| **native openai/anthropic provider** | `3dfdab70` | 2026-03-24 | 1445 | 替换 litellm |
| **agent/runner.py（AgentRunner）** | `e7d371ec` | 2026-03-26 | 1469 | 从 loop 抽出共享执行循环 |
| agent/hook.py | `5bf0f6fe` | 2026-03-26 | — | 生命周期 hook 统一 |
| sdk/ | `7fad1480` | 2026-03-30 | — | Python SDK facade |
| grep/glob tool | `15cc9b23` | 2026-04-02 | — | — |
| Tool JSON Schema | `e7798a28` | 2026-04-04 | — | 参数 schema 化 |
| Jinja2 模板层 | `d436a1d6` | 2026-04-04 | — | — |
| websocket channel | `ad57bcd1` | 2026-04-08 | — | — |
| autocompact（现名） | `5932482d` | 2026-04-11 | — | 模块改名 |
| **webui/（前端源码树）** | `9ed3031a` | 2026-04-18 | 1995 | Vite + React + Tailwind |
| nanobot/web/ | `9ed3031a` | 2026-04-18 | 1995 | 后端挂载点 |
| CLAUDE.md + `.agent/` | `6eef3d0f` | 2026-04-29 | — | AI 贡献者指南 |
| tool plugin discovery | `043f0e67` | 2026-05-11 | — | runtime context protocol |
| provider failover | `913b0774` | 2026-05-12 | — | `fallback_models` |
| pairing/ | `4c4a9ae5` | 2026-05-14 | — | DM 发送者审批 |
| goal / long_task | `1c2ea1aa` | 2026-05-16 | — | 长任务 |
| nanobot/webui/（Python 侧） | `57d5276d` | 2026-05-19 | — | settings/sidebar |
| **apps/（CLI apps + MCP 统一）** | `418cb23d` | 2026-05-25 | — | — |
| audio/ | `f3eb2aa0` / `9c812803` | 2026-06-06 / 06-09 | — | 转写 |
| context_governance.py | `3460ca3c` | 2026-06-07 | — | microcompaction 门控 |
| **gateway/（独立模块）** | `e3c9aff4` | 2026-06-22 | — | runtime.py + service.py |
| **sdk/（扩展）** | `dbf3c4b2` | 2026-06-21 | — | runtime controls |
| triggers/ | `2a0cd19a` | 2026-06-30 | — | session-bound local triggers |
| model_runtime.py | `bd94fefd` | 2026-07-10 | — | immutable resolver |
| channel 自包含包 | `462a0dfb` | 2026-07-19 | — | 388 files changed |
| cli 模块化拆分 | `e2563e2e` | 2026-07-30 | — | #5175 |
| agent/plugins.py | `d5e0df69` | 2026-08-11 | — | portable Agent Plugins |
| **tui/（TypeScript 终端 UI）** | `ce070c83` | 2026-08-12 | 3980 | bun + TS |
| llm_usage/ | `2ac802b2` | 2026-08-22 | — | 统一用量后端 |
| tools/execution.py | `e73cce70` | 2026-08-28 | — | tool 执行边界 |
| **events.py + packages/client-events** | `192e2e90` | 2026-09-06 | — | 跨客户端事件统一，monorepo 化 |

---

## 4. 依赖顺序推断

### 4.1 先 bus/loop 还是先 provider？

**时间证据：不可判定。** 三者同属 `d4cc48af`（#2）单一 squash commit，git 不提供内部顺序。

**结构推断：契约先行 → bus → provider ABC → loop。** 依据：

| 模块 | t=0 内部依赖 | 拓扑位置 |
|---|---|---|
| `bus/events.py` | 无（纯 stdlib dataclass） | 叶子 |
| `providers/base.py` | 无（纯 stdlib ABC） | 叶子 |
| `bus/queue.py` | → `bus/events` | 一层 |
| `providers/litellm_provider.py` | → `providers/base` | 一层 |
| `agent/tools/{base,registry}.py` | → `tools/base` | 一层 |
| `agent/loop.py` | → bus.events, bus.queue, providers.base, agent.context, tools.registry, tools.*, session.manager | **汇聚点（6 个内部依赖）** |
| `cli/commands.py` | → 上述全部 + config | composition root |

`providers/base.py` 定义的是 `ToolCallRequest(id, name, arguments)` 与 `LLMResponse(content, tool_calls, finish_reason, usage)` + `has_tool_calls` 属性 —— loop 的整个工具循环语义都挂在这两个 dataclass 上。**契约先于实现**是这类设计的必然顺序，故推断 provider 的**抽象层**早于 loop，而 provider 的**具体实现**（litellm）可以与 loop 并行或稍后。

关键佐证：t=0 的 `agent/loop.py` 类型标注是 `provider: LLMProvider`（ABC），从不引用 `LiteLLMProvider`；具体实现只在 `cli/commands.py` 里 new 出来。这个「loop 只认 ABC、CLI 负责注入」的边界从 #2 一直保持到 HEAD（`git show HEAD:nanobot/agent/runner.py` 仍 `from nanobot.providers.base import LLMProvider, LLMResponse, ...`）。

另一处 t=0 就已定型的耦合：`MessageTool` 在 `_register_default_tools()` 里以 `MessageTool(send_callback=self.bus.publish_outbound)` 构造 —— **tool 层从第一天起就持有 bus 的写入口**，即「工具能主动往通道发消息」是初始设计而非后加能力（`git show d4cc48af:nanobot/agent/loop.py` L57-74）。

**bus 的角色值得单独强调**：`bus/queue.py` 的类 docstring 明写 "Async message bus that **decouples chat channels from the agent core**"。t=0 就有两个方向的 queue（inbound/outbound）+ outbound 订阅表。这意味着作者从一开始就把「多通道」当作架构前提，而不是先做单通道 REPL 再补总线。**推断**：因为 `InboundMessage.channel` 字段的注释直接列了 "telegram, discord, slack, whatsapp"，其中 discord/slack 在 t=0 尚不存在 —— 说明 bus 的抽象是按未来多通道设计的。

### 4.2 tools 何时进？

**时间证据：t=0 已在（`d4cc48af`, #2）。** tools 与 loop 同期，不存在「先 loop 后 tools」的阶段。

t=0 的 8 个默认工具（`AgentLoop._register_default_tools()` 硬编码）：
`ReadFileTool` / `WriteFileTool` / `EditFileTool` / `ListDirTool`（filesystem.py）、`ExecTool`（shell.py，带 `working_dir`）、`WebSearchTool`（web.py，需 `brave_api_key`）、`WebFetchTool`（web.py）、`MessageTool`（message.py）。

tools 的演化不是「何时进」而是「抽象如何加深」，共四跳：

| 跳 | commit | 日期 | 变化 |
|---|---|---|---|
| 1 | `d4cc48af` | 02-01 | `Tool` 基类 + `ToolRegistry`（1937 B），loop 内硬编码 register |
| 2 | `7ef18c4e` / `00841309` | 02-02 | 参数 schema 校验 + exec safety guard（首个测试就是 tool 测试） |
| 3 | `e7798a28` | 04-04 | streamline Tool class + **JSON Schema for parameters** |
| 4 | `043f0e67` | 05-11 | **plugin-based tool discovery + runtime context protocol** |
| 5 | `e73cce70` | 08-28 | extract **tool execution boundary** → `tools/execution.py`（Runner 只调 `execute_tool_calls`） |

HEAD 的 `agent/tools/` 有 29 个文件（含 `apply_patch.py`、`exec_session.py`、`sandbox.py`、`schema.py`、`loader.py`、`context.py`、`spawn.py`、`long_task.py`、`mcp.py`、`mcp_oauth.py`、`runtime_control.py`、`session_messages.py`、`sessions.py`、`self.py`、`image_generation.py`、`cli_apps.py`、`_windows_job.py`、`path_utils.py`、`file_state.py`、`search.py`、`registry.py`、`base.py`、`execution.py`）。

### 4.3 channels 何时铺量？

**时间证据：开源后第 2–9 天一次性铺 8 个，全部来自社区 PR。**

| channel | commit | 日期 | 距 t=0 |
|---|---|---|---|
| telegram, whatsapp | `d4cc48af` | 02-01 | t=0（#2） |
| discord | `ba6c4b74` | 02-02 | #30 |
| feishu | `50fa024a` | 02-04 | +3 天 |
| slack | `051e396a` | 02-04 | +3 天 |
| email | `cfe43e49` | 02-07 | +6 天 |
| dingtalk | `240db894` | 02-08 | +7 天 |
| qq | `34dc933f` | 02-09 | +8 天 |
| moltchat | `20b8a2fc` | 02-09 | +8 天 |
| matrix | `0d3dc57a` | 02-09 | +8 天 |
| wecom | `a660a255` | 03-09 | +36 天 |
| weixin | `ebc4c2ec` | 03-22 | +49 天 |
| msteams | `824dcca5` | 04-02 | +60 天 |
| websocket | `ad57bcd1` | 04-08 | +66 天 |
| napcat | `b1a3053c` | 04-28 | +86 天 |
| signal | `8ec10251` | 05-15 | +103 天 |
| mattermost | `fff38f11` | 06-22 | +141 天 |

铺量之后作者做的是**把 channel 从平铺文件变成插件**，三跳：

1. `254cfd48`（2026-03-11, #1162）—— pkgutil auto-discover，消除硬编码 registry。
2. `dbdb43fa`（2026-03-13）—— channel plugin architecture with decoupled configs（同时创建 `docs/`）。
3. `462a0dfb`（2026-07-19）—— make built-in channels self-contained，**388 files / +17032 −5049**。HEAD 的 17 个 channel 各自是 `nanobot/channels/<name>/{__init__.py, manifest.py, runtime.py, validation.py, tests/, webui/index.ts, webui/locales/*.json}`（10 种语言）。

**推断**：channel 铺量不是原作者的计划驱动，而是开源后的社区需求拉动。判据：8 个新 channel 的作者都不是 `Xubin Ren`/`Re-bin`，而原作者在同期的 commit 全是 merge/resolve conflicts/docs（`git log --author='xubinrencs@gmail.com' --since=2026-02-01 --until=2026-02-09`：`72c9aaba` Merge pr-15、`a0950cf6` resolve conflicts、`2a26eb0c` Merge pr-9、`8c759b25` Merge pr-11、`ac279b2d` Merge pr-12 …）。作者的真实贡献是把 channel 层重构成可发现的插件体系（上述三跳），而不是写 channel。

### 4.4 provider 铺量的同一模式

| provider | commit | 日期 |
|---|---|---|
| litellm（多路复用） | `d4cc48af` | 02-01 |
| Zhipu（并改默认模型） | `2dd28466` | 02-01 |
| vLLM / local | `2b19dcf9` (#25) | 02-02 |
| Gemini | `ab45185e` | 02-02 |
| Bedrock | `5c49bbc0` | 02-02 |
| DeepSeek | `f23548f2` | 02-03 |
| Codex OAuth | `5bff2409` | 02-05 |
| Azure OpenAI | `813d37ad` | 03-06 |
| **litellm → native SDKs** | `3dfdab70` (#1445) | 03-24 |
| native Bedrock Converse | `306958d6` | 05-01 |
| xAI Grok OAuth | `c7393c78` | 07-23 |
| OAuth model catalog 在线发现 | `bc4de246` | 08-29 |

HEAD 的 `nanobot/providers/` 有 24 个条目：`anthropic_provider.py`、`azure_openai_provider.py`、`bedrock_provider.py`、`openai_compat_provider.py`、`openai_codex_provider.py`、`openai_codex_oauth.py`、`openai_responses/{__init__,converters,parsing,state}.py`、`github_copilot_provider.py`、`xai_grok_provider.py`、`xai_oauth.py`、`fallback_provider.py`、`unconfigured_provider.py`、`registry.py`、`factory.py`、`conversation_state.py`、`image_generation.py`、`transcription.py`、`oauth_guidance.py`、`oauth_model_catalog.py`、`base.py`。

**推断**：t=0 选 litellm 是「用一个依赖换掉 N 个 provider」的最快路径 —— 这与最小可跑形态的目标一致。51 天后换成原生 SDK（`3dfdab70`）说明这个便利的代价（流式/reasoning/tool-call 语义受制于中间层）超过了收益。这是**先借抽象、后还债**的典型案例。

---

## 5. 早期架构与现状差异

| # | 差异 | t=0（`d4cc48af`, 2026-02-01） | HEAD（`2fb16593`, 2026-09-16） | 关键 commit |
|---|---|---|---|---|
| 1 | **AgentLoop 单体 → Loop + Runner 双层** | `agent/loop.py` 213 行，`AgentLoop` 一个类同时做：消费 bus、建 context、调 LLM、执行 tool、发回响应（类 docstring 明写这 5 步） | `loop.py` **2388 行** + `runner.py` **1374 行**。`AgentRunner` docstring = "Shared execution loop for tool-using agents"，负责 tool-call 循环 / context governance / hooks / usage 统计；`AgentLoop` 保留 "the core processing engine" 的编排职责 | `e7d371ec`(2026-03-26, #1469) 抽出 runner（loop 644→584，runner +221，含 266 行新测试）；`5bf0f6fe`(2026-03-26) 统一 lifecycle hooks → `agent/hook.py` |
| 2 | **provider：litellm 中间层 → 原生 SDK + registry/factory/fallback** | 2 个文件：`base.py`(ABC) + `litellm_provider.py`，靠 `default_model` 字符串前缀（`"anthropic" in default_model`）判断厂商并 `os.environ.setdefault` 塞 key | 24 个条目：每厂商独立 provider + `registry.py` + `factory.py` + `fallback_provider.py` + `unconfigured_provider.py` + `conversation_state.py` + `openai_responses/` 子包 + 多个 OAuth 流 | `299d8b33`(2026-02-08, #192) 声明式 registry；`3dfdab70`(2026-03-24, #1445) 移除 litellm（18 files, +1014 −1258）；`f670da6c`(2026-04-26) snapshot 进 factory；`913b0774`(2026-05-12) failover；`bd94fefd`(2026-07-10) immutable model runtime resolver |
| 3 | **channel：平铺 .py → 自包含插件包** | `channels/{base,manager,telegram,whatsapp}.py` 4 个文件，2 个通道 | 17 个通道，每个是 `channels/<name>/{__init__,manifest,runtime,validation,tests/,webui/index.ts,webui/locales/{en,es,fr,id,ja,ko,pt-BR,vi,zh-CN,zh-TW}.json}`；`channels/` 下 149 个 .py | `254cfd48`(2026-03-11, #1162) pkgutil auto-discover；`dbdb43fa`(2026-03-13) plugin architecture + decoupled configs；`462a0dfb`(2026-07-19) self-contained（388 files, +17032 −5049） |
| 4 | **CLI：单文件 → 20 模块 + 独立 TUI** | `cli/commands.py` 634 行单文件，全部 typer 命令（onboard/gateway/agent/channels/cron/status）内联，业务逻辑写在命令闭包里（如 `async def on_cron_job`、`async def on_heartbeat` 定义在 `gateway` 命令内部） | `cli/` 20 个文件：`agent.py` `entry.py` `gateway.py` `gateway_runtime.py` `models.py` `onboard.py` `provider.py` `runtime_config.py` `stream.py` `terminal.py` `tui_launcher.py` `webui.py` `webui_support.py` `desktop_target.py` `desktop_tui.py` `log_control.py` `process_identity.py` `windows_browser.py` …；另有顶层 `tui/`（bun + TypeScript） | `f2e1cb36`(2026-03-22) 抽出 stream.py；`f127af04`(2026-03-14) 抽出 onboard；`e2563e2e`(2026-07-30) split commands into focused modules (#5175)；`ce070c83`(2026-08-12, #3980) 原生 TS TUI |
| 5 | **heartbeat 模块消失** | t=0 有 `nanobot/heartbeat/service.py`(4293 B) + `workspace/HEARTBEAT.md` | `nanobot/heartbeat/` 目录不存在；能力由 cron 承载 | `fe2af64e`(2026-05-27) "refactor(heartbeat): migrate heartbeat service to cron-based auto-registration" —— 该 commit 是 `-- nanobot/heartbeat` 路径的最后一次也是删除性一次改动 |
| 6 | **TypeScript bridge 消失** | t=0 有 `bridge/{package.json,tsconfig.json,src/{index,server,whatsapp,types.d}.ts}`，通过 `cli/commands.py:_get_bridge_dir()` 启 Node 子进程；wheel 用 `force-include` 打包 | `bridge/` 目录不存在 | `2a9e288d`(2026-06-26) "refactor(whatsapp): replace bridge with neonize" —— Node 边车换成 Go 库绑定。**这是 t=0 唯一的非 Python 组件，存活 145 天** |
| 7 | **workspace 模板 → 包内 templates** | t=0 顶层 `workspace/{AGENTS,SOUL,TOOLS,USER,HEARTBEAT}.md` + `workspace/memory/MEMORY.md`，`cli/commands.py:_create_workspace_templates()` 负责落地 | `nanobot/templates/`（包内资源），并由 Jinja2 渲染 | `577b3d10`(2026-02-23) move workspace/ to nanobot/templates/ for packaging；`d436a1d6`(2026-04-04) integrate Jinja2 templating |
| 8 | **memory：单文件 → 两层 + 治理** | `agent/memory.py` 3482 B，`MemoryStore` 一个类 | `agent/memory.py` + `agent/context_governance.py`（`ContextGovernor` / `HistoryConsolidator` / `TranscriptBuilder` / `ContextCompactionState` / `ModelRequestState` / `ProviderCompactionConsolidator`）+ `agent/autocompact.py` + `session/summary.py`（`SessionSummaryCheckpoint`） | `94c21fc2`(2026-02-12) two-layer architecture with grep-based retrieval；`5932482d`(2026-04-11) auto compact 模块改名；`3460ca3c`(2026-06-07) context_governance + microcompaction 门控；`3548aec5`(2026-09-08) summary checkpoints for all compaction triggers |
| 9 | **事件模型：bus 双队列 → 独立 events 模块 + 跨语言包** | `bus/events.py` 1038 B，只有 `InboundMessage`/`OutboundMessage` 两个 dataclass | `nanobot/events.py`（`EventSink`, `NO_EVENTS`）+ `bus/` 类型化 outbound runtime events + 顶层 `packages/client-events`（TS 侧共享契约） | `628b250e`(2026-06-01) decouple webui runtime state via events；`5f4cfbcb`(2026-06-30) type outbound runtime events；`192e2e90`(2026-09-06) unify scoped runtime notifications across clients (#5670) |
| 10 | **gateway：CLI 命令内联 → 独立模块** | t=0 gateway 只是 `cli/commands.py:156 def gateway(...)`，回调闭包写在命令里 | `nanobot/gateway/{runtime.py, service.py}` + `cli/gateway.py` + `cli/gateway_runtime.py` | `e3c9aff4`(2026-06-22) feat(gateway): add background and service controls；`af8192dc`(2026-06-12) move bound cron execution out of gateway；`1a585288`(2026-05-31) extract GatewayHTTPHandler from WebSocketChannel |
| 11 | **tests：0 → 19 个镜像目录** | t=0 无 `tests/`（`pyproject.toml` 已声明 `testpaths = ["tests"]` 但目录不存在） | `tests/{agent,apps,bus,channels,cli,cli_apps,command,config,cron,gateway,llm_usage,pairing,providers,security,session,tools,triggers,utils,webui}`；channel 另有包内 `channels/<name>/tests/` | `7ef18c4e`(2026-02-02) 首个测试；`ec6e0993`(2026-03-12) CI；`897eedaa`(2026-05-16) CI 聚焦 Python 3.13/3.14 |
| 12 | **session：1 文件 → 13 文件** | t=0 只有 `session/manager.py`(6325 B) 一个 `SessionManager` | `session/{manager,summary,keys,recovery,goal_state,session_handles,session_messages,turn_continuation,automation_turns,webui_turns,history_visibility,model_selection}.py` + `__init__.py` | `1c2ea1aa`(2026-05-16) goal/long_task 引入 `goal_state`；`a326ba40`(2026-06-11) cron 绑定 session；`c22efb5f`(2026-07-23) model presets session-scoped；`9b25da7b`(2026-08-02) cross-session references |

### 5.1 AgentLoop / AgentRunner 分家细节

**分家 commit：`e7d371ec`（2026-03-26，全库序号 #1469，距 t=0 第 53 天）**

```
nanobot/agent/loop.py           | 144 ++++++++------------------   (644 行 → 584 行)
nanobot/agent/runner.py         | 221 ++++++++++++++++++++++++++   (新建)
nanobot/agent/subagent.py       | 102 +++++++++++--------
tests/agent/test_runner.py      | 186 ++++++++++++++++++++++++     (新建)
tests/agent/test_task_cancel.py |  80 ++++++++++++++++             (新建)
5 files changed, 587 insertions(+), 146 deletions(-)
```

commit message: "refactor: extract shared agent runner and preserve subagent progress on failure"。

**分家的驱动力（从 message + diff 形状读出）**：`subagent.py` 同 commit 改了 102 行 —— 主 agent 与 subagent 各自维护了一份 tool-call 循环，失败时 subagent 进度会丢。抽出 `AgentRunner` 是为了让两者共享同一个执行循环。**这是「第二个调用方出现」触发的抽取，不是预防性设计。**

**同日跟进：`5bf0f6fe`（2026-03-26）"refactor: unify agent runner lifecycle hooks"** → 引入 `agent/hook.py`（`AgentHook`, `AgentHookContext`, `AgentRunHookContext`）。

**分家后的持续演化**：`fbedf7ad`(2026-04-01) harden agent runtime for long-running tasks；`714a4c7b`(2026-04-02) fix(runtime): retry and cleanup；`52855d46`(2026-04-23) move progress event helpers out of loop；`e73cce70`(2026-08-28) extract tool execution boundary → `tools/execution.py`（Runner 现在只 `from nanobot.agent.tools.execution import execute_tool_calls`）。

**注意：`loop.py` 并没有因为分家而变小** —— 213 行(t=0) → 644 行(分家前) → 584 行(分家后) → **2388 行(HEAD)**。分家只搬走了执行循环，编排/context/记忆/技能/投递等职责继续在 loop 里堆积。**推断**：这说明「抽 Runner」解决的是复用问题，不是 loop 的复杂度问题；loop 至今仍是最大的单体。

---

## 6. 对 pacman ROADMAP 的启示

> pacman 当前状态：worktree 内只有 `.gitignore`（bun / node_modules / apps/electron / *.tsbuildinfo / pnpm-lock.yaml），无源码。**推断**：pacman 是 TypeScript/bun 技术栈的 agent 框架复刻，与 nanobot 的 Python 栈不同 —— 下面所有「顺序」结论可迁移，所有「具体依赖选择」需按 TS 生态重估。

### 6.1 从 nanobot 顺序提炼的里程碑骨架

| 里程碑 | 目标 | nanobot 对应 | 验收清单（可直接抄） |
|---|---|---|---|
| **M0 · 契约与最小可跑** | 一条不依赖任何 IO 通道的直连路径能跑通一轮 tool-call | `d4cc48af`（#2）：`bus/events` + `providers/base` + `agent/loop`(213 行) + 8 个默认 tool + CLI `agent -m` | ① 消息事件契约（inbound/outbound 两个类型）定型 ② LLM provider 抽象（ABC/interface + 响应类型含 tool_calls + usage）定型 ③ 单条 CLI 命令能 `-m "..."` 拿到回复 ④ tool 循环有 `max_iterations` 上限（nanobot 用 20） ⑤ provider 只实现 1 个 ⑥ 零 channel、零 cron、零前端 |
| **M1 · 会话与上下文** | 多轮对话有持久历史、有 prompt 组装层 | t=0 已含 `session/manager.py` + `agent/context.py` + `agent/memory.py` + `agent/skills.py`；`94c21fc2`(02-12) 两层 memory | ① session key 规则确定（nanobot: `f"{channel}:{chat_id}"`） ② 历史落盘 ③ context builder 独立于 loop ④ workspace 模板文件（AGENTS/TOOLS/USER 类）能自动落地 ⑤ memory 检索方式确定（nanobot 选 grep-based，非向量） |
| **M2 · 第一通道 + 总线解耦** | 一个真实 IM 通道端到端跑通，且不直连 agent | t=0 `channels/telegram.py`(7521 B) + `channels/manager.py` + `bus/queue.py` 双队列 | ① 通道只通过 bus 收发，不 import agent ② outbound 有订阅分发（`subscribe_outbound`/`dispatch_outbound`） ③ 通道 base 类定义生命周期 ④ manager 负责启停多通道 |
| **M3 · 定时与自主性** | 无人触发也能产生 turn | t=0 `cron/service.py`(12031 B) + `cron/types.py` + `heartbeat/service.py` | ① cron 表达式调度（nanobot 用 croniter） ② heartbeat 周期性 prompt ③ **注意 nanobot 后来把 heartbeat 并进 cron（`fe2af64e`, 05-27）—— 推断 pacman 应一开始就只做 cron，把 heartbeat 建成 cron 的一个预置 job，省掉这次合并** |
| **M4 · 工具面扩张 + 参数 schema** | tool 从硬编码注册变成声明式 | `7ef18c4e`(02-02) 校验 + `e7798a28`(04-04) JSON Schema + `043f0e67`(05-11) plugin discovery | ① 每个 tool 自带 JSON Schema ② registry 支持动态发现 ③ exec 类 tool 有参数校验 + 安全 guard（`00841309`/`a20d887f`, 02-02/02-04） ④ 首个测试就写在 tool 层（nanobot 的 `tests/` 出生 commit 就是 tool 测试） |
| **M5 · 多 agent** | subagent 可被 spawn，进度可回收 | `051a97fa`(#15, 02-01) subagent + spawn tool；`e7d371ec`(03-26) 抽 Runner 共享执行循环；`3a400e02`(07-24) inline consultation | ① `spawn` 作为 tool 暴露给模型 ② **subagent 与主 agent 共用同一个执行循环类**（nanobot 的教训：先各写一份，54 天后才被迫抽出 Runner） ③ 失败时保留 subagent 已完成进度 |
| **M6 · provider 铺开** | 多厂商 + 故障转移 | `299d8b33`(02-08) 声明式 registry → `3dfdab70`(03-24) 原生 SDK → `913b0774`(05-12) failover | ① 声明式 registry（不要 if-elif 链） ② **推断：pacman 应直接写原生 SDK 适配，跳过 nanobot 的 litellm 中间层阶段** —— nanobot 用了 51 天才还清这笔债，代价是流式/reasoning/tool-call 语义长期受中间层限制 ③ `fallback_models` 列表 ④ 未配置时的显式 unconfigured provider（nanobot HEAD 有 `unconfigured_provider.py`） |
| **M7 · 通道插件化** | 加通道不改核心 | `254cfd48`(03-11) auto-discover → `dbdb43fa`(03-13) plugin arch → `462a0dfb`(07-19) self-contained | ① 目录扫描自动注册，无硬编码表 ② 每通道自带 manifest + runtime + validation ③ **推断：nanobot 花了约 5.5 个月（168 天）才走到 self-contained（`462a0dfb` 动了 388 files），pacman 应从第一个通道起就用包结构** |
| **M8 · 安全边界** | 不可信输入 + 危险执行都有闸 | `6e2b6396`(03-16) SSRF/不可信内容标记；`7913e715`(03-16) bwrap 沙箱；`ea849650`(02-02) URL 校验 | ① web fetch 有 URL 校验 + SSRF 防护 + 内网地址阻断 ② 外部内容进 context 时带不可信标记 ③ exec 有沙箱（TS 侧可用容器/权限降级） |
| **M9 · 对外 API** | 第三方程序能当客户端 | `80219baf`(03-01, #840) OpenAI 兼容端点 + session key 隔离；`7fad1480`(03-30) SDK facade | ① OpenAI 兼容 HTTP 端点（复用现有客户端生态） ② 请求级 session 隔离头 ③ 语言内 SDK facade |
| **M10 · 长任务与上下文治理** | 单 turn 能跑几十分钟不炸 context | `1c2ea1aa`(05-16) /goal + long_task；`5932482d`(04-11) autocompact；`3460ca3c`(06-07) context_governance；`bd94fefd`(07-10) model_runtime | ① 显式 goal/长任务命令 ② 自动压缩 + 压缩门控（按 context pressure） ③ summary checkpoint ④ 长任务期间放宽 wall-clock 超时（nanobot `2144af7c`/`e804f2fd`, 05-16） |
| **M11 · 图形前端** | Web/TUI 成为一等客户端 | `9ed3031a`(04-18, #1995) WebUI；`ce070c83`(08-12, #3980) TUI；`192e2e90`(09-06) events 统一 + `packages/client-events` | ① 先有 websocket 通道，前端只是它的一个客户端（nanobot 的 WebUI 建立在 `channels/websocket.py` 上） ② 事件类型跨语言共享（monorepo package） ③ 前端产物打进发布包（`c018c3fb`, 05-16 bundle webui into wheel） |

### 6.2 nanobot 顺序里值得照抄的三点

1. **契约与总线在第 2 个 commit 就完整存在，前端在第 1995 个才出现。** bus/events/providers-base/tools-base 这些「叶子」全部先于汇聚点。
2. **测试与 CI 跟得很紧但很晚才成体系**：首个 test 在 launch 次日（`7ef18c4e`, 02-02），CI 在第 39 天（`ec6e0993`, 03-12），贡献者文档在第 87 天（`6eef3d0f`, 04-29）。**推断**：对单人复刻项目，这个顺序合理 —— 先把核心 tool 层测住，CI 等有第二个贡献者再上。
3. **重构都是被第二个用例逼出来的**，没有预防性抽象：Runner 因 subagent 复用而抽（`e7d371ec`）、gateway 因 cron 绑定而独立（`af8192dc`）、events 因 WebUI 状态解耦而生（`628b250e`）、tool execution 因 plugin discovery 而分层（`043f0e67`→`e73cce70`）。

### 6.3 pacman 应当偏离的三点（均标「推断」）

1. **跳过 litellm 类中间层**（推断）。nanobot 用 litellm 换来 t=0 的多厂商覆盖，51 天后在 `3dfdab70` 全量替换，代价 18 files / +1014 −1258 且期间流式与 reasoning 语义受限。TS 生态同类中间层（Vercel AI SDK 之类）同样会挡在 tool-call/stream 语义前面。建议 M6 直接写 2 个原生 provider（Anthropic + OpenAI-compatible），把 registry 抽象做在自有代码里。
2. **一开始就把 heartbeat 建成 cron 的预置 job**（推断）。nanobot t=0 把 heartbeat 做成独立模块（`heartbeat/service.py`），115 天后在 `fe2af64e` 整体迁入 cron 并删掉目录。两者本质都是「定时产生一个 turn」。
3. **通道从第一个起就用 self-contained 包结构**（推断）。nanobot 从 4 个平铺 .py 走到 17 个自包含包，最后一步 `462a0dfb` 动了 388 个文件。这条路径的成本主要来自「先平铺、后收拢」，而不是包结构本身复杂。
4. **subagent 与主 agent 从第一天共享执行循环**（推断）。这是 `e7d371ec` 的直接教训：nanobot 先让 loop 和 subagent 各持一份 tool-call 循环，等到「失败丢进度」的 bug 出现才抽 Runner。M5 的验收项②就是为此设的。

### 6.4 反面参照：nanobot 至今未解决的问题

`loop.py` 从 t=0 的 213 行长到 HEAD 的 **2388 行**，期间经历过一次显式抽取（`e7d371ec`）也没能压住。`cli/commands.py` 从 634 行到需要 `e2563e2e`(#5175) 专门拆成 20 个文件。**推断**：编排层（谁决定下一个 turn、turn 的结果投递到哪）是最容易堆积职责的位置。pacman 若在 M0 就把「turn 编排」与「turn 执行」分成两个类型（而不是像 nanobot 那样先合成一个 `AgentLoop` 再拆），可以避免这次 11 倍膨胀。

---

## 7. 证据缺口与不确定性

| # | 缺口 | 影响 | 可行的补证方式 |
|---|---|---|---|
| 1 | **t=0 之前的构建顺序完全不可观测。** `d4cc48af` 是 squash 投放，`pyproject.toml` 显示已到 `0.1.3.post1`，意味着 0.1.0 → 0.1.3.post1 的全部迭代（可能数十次）不在 git 里。§1.3 的构建顺序 1-8 是**结构推断**，不是时间证据。 | 高 —— 「作者真正的第一版骨架长什么样」无法回答 | PyPI 上 `nanobot-ai` 的历史版本 sdist（0.1.0/0.1.1/0.1.2/0.1.3）可逐个下载对比文件树，能重建 squash 前的演化 |
| 2 | **序号（`git rev-list --count`）在含 merge 的历史里是近似值。** 本库有大量 merge commit（`72c9aaba` Merge pr-15、`2049e1a8` Merge pull request #4 等），且 `--reverse` 列表顺序受拓扑约束而非严格按 author date（例：`ad57bcd1` author date 04-08 在 `824dcca5` 04-02 之前出现）。§3 表中的 `#` 列应理解为量级而非精确排位。 | 中 | 需要精确排位时用 `git rev-list --topo-order --reverse` 重新编号 |
| 3 | **无法区分「作者本人写的」与「作者合并的社区代码」在架构决策上的权重。** `Xubin Ren`(1048) + `Re-bin`(304) 的 commit 里有大量 `Merge PR #N` / `resolve conflicts`。§4.3 对 channel 铺量的归因基于首周 author 过滤，样本只覆盖 02-01→02-09。 | 中 | 对每个关键架构 commit 跑 `git log --format='%an' -1 <hash>` + `git show --stat` 判断实际作者；或对 `refactor` 类 commit 全量按 author 分组 |
| 4 | **`nanobot/webui/`（Python 侧，`57d5276d`, 05-19）与顶层 `webui/`（TS 源码，`9ed3031a`, 04-18）的分工未在 git 里显式说明。** v0.2.0 的 `c018c3fb`(05-16) 说 "bundle webui into wheel"，但 `nanobot/webui/` 的出生 commit 晚于它 3 天。 | 低 | `git show c018c3fb --stat` 看 05-16 时打包进 wheel 的是哪个路径 |
| 5 | **阶段边界用 tag 划定，而 tag 是发布决策不是架构决策。** P3/P4 的分界（v0.1.4.post6, 03-27）与真正的架构转折（`3dfdab70` 03-24、`e7d371ec` 03-26）差 1-3 天，属巧合对齐；P5/P6 的分界（v0.3.0, 07-25）则与 `e2563e2e`(07-30) 错位。 | 低 | 若要严格按架构转折划阶段，应改用 §5 表中 11 个差异的关键 commit 作为分界 |
| 6 | **pacman 自身的设计约束未知。** worktree 内只有 `.gitignore`，§6 的偏离建议全部基于「TS/bun 栈 + agent 框架复刻」这一从 `.gitignore` 内容做出的**推断**。 | 高 | 需要 pacman 的 CONTEXT.md / ROADMAP 草案或 issue #15 的完整上下文来校准 |

---

## 附录 A. 复现命令

所有命令以 `NB=/Users/xmon/Code/AgentProjects/nanobot` 为只读目标。

```bash
# --- 全局形状 ---
git -C $NB log --oneline | wc -l                                  # 4443
git -C $NB log --reverse --format='%h|%ad|%an|%s' --date=short | head -5
git -C $NB log --format='%ad' --date=format:'%Y-%m' | sort | uniq -c
git -C $NB log --no-merges --format='%an' | sort | uniq -c | sort -rn | head -25
git -C $NB log --no-merges --format='%an <%ae>' | sort -u | grep -iE 'xubin|re-bin|chengyongru'
git -C $NB remote -v

# --- 发布锚点 ---
git -C $NB for-each-ref --sort=creatordate \
  --format='%(refname:short)|%(creatordate:short)|%(objectname:short)|%(*objectname:short)' refs/tags
git -C $NB log --grep='release' -i --format='%h|%ad|%s' --date=short --reverse | head -30
git -C $NB rev-list --count <tagA>..<tagB>                        # 区间 commit 数
git -C $NB rev-list --count <hash>                                # 全库序号

# --- t=0 快照 ---
git -C $NB show --stat --format='%h %s' 086d65ac                  # 1 file
git -C $NB ls-tree -r --name-only d4cc48af                        # 67 files
git -C $NB ls-tree -r --name-only d4cc48af | wc -l
git -C $NB ls-tree -r -l d4cc48af -- nanobot bridge pyproject.toml | sort -k4 -rn | head -40
git -C $NB show d4cc48af:pyproject.toml                           # version = "0.1.3.post1"
git -C $NB show d4cc48af:nanobot/__main__.py
git -C $NB show d4cc48af:nanobot/bus/events.py
git -C $NB show d4cc48af:nanobot/bus/queue.py
git -C $NB show d4cc48af:nanobot/providers/base.py
git -C $NB show d4cc48af:nanobot/providers/litellm_provider.py | head -45
git -C $NB show d4cc48af:nanobot/agent/loop.py | head -70
git -C $NB show d4cc48af:nanobot/agent/__init__.py
git -C $NB show d4cc48af:nanobot/cli/commands.py | grep -nE '^(class|def|async def|    def|    async def|@)'
git -C $NB show d4cc48af:nanobot/cli/commands.py | sed -n '277,350p'   # agent 命令 = 最小可跑路径
git -C $NB show d4cc48af:nanobot/agent/loop.py | sed -n '56,90p'       # _register_default_tools：8 个默认工具

# --- 子系统出生 ---
git -C $NB log --diff-filter=A --format='%h|%ad|%s' --date=short --reverse -- <path> | head -N
#   <path> 依次取: tui webui tests .github .github/workflows docs packages scripts CLAUDE.md AGENTS.md
#                  nanobot/{api,apps,audio,gateway,sdk,security,triggers,pairing,command,llm_usage,
#                           templates,web,webui,heartbeat,bus,session,channels,providers,cron,config,
#                           skills,utils,cli,agent/tools}
#                  nanobot/agent/{runner,subagent,autocompact,model_runtime,context_governance,hook,plugins,memory}.py
#                  nanobot/channels/websocket.py  nanobot/events.py
git -C $NB log -S'AgentRunner' --format='%h|%ad|%s' --date=short --reverse | head -5
git -C $NB log -S'mcp' -i --format='%h|%ad|%s' --date=short --reverse | head -5

# --- 目录/模块消失 ---
git -C $NB log --diff-filter=D --format='%h|%ad|%s' --date=short -1 -- bridge          # 2a9e288d
git -C $NB log --diff-filter=D --format='%h|%ad|%s' --date=short -- nanobot/heartbeat  # fe2af64e
git -C $NB log -1 --format='%h|%ad|%s' --date=short -- nanobot/heartbeat

# --- 重构细节 ---
git -C $NB show --stat --format='%h %ad %s' --date=short e7d371ec   # Runner 分家
git -C $NB show --stat --format='%h %ad %s' --date=short 3dfdab70   # litellm → native
git -C $NB show --stat --format='%h %ad %s' --date=short 051a97fa   # subagent
git -C $NB show --stat --format='%h %ad %s' --date=short 94c21fc2   # memory 两层
git -C $NB show --stat --format='%h %ad %s' --date=short 9ed3031a   # webui
git -C $NB show --stat --format='%h %ad %s' --date=short 462a0dfb | tail -3   # channel self-contained

# --- 规模对比 ---
git -C $NB show d4cc48af:nanobot/agent/loop.py | wc -l              # 213
git -C $NB show HEAD:nanobot/agent/loop.py | wc -l                  # 2388
git -C $NB show e7d371ec^:nanobot/agent/loop.py | wc -l             # 644
git -C $NB show e7d371ec:nanobot/agent/loop.py | wc -l              # 584
git -C $NB show HEAD:nanobot/agent/runner.py | wc -l                # 1374
git -C $NB show d4cc48af:nanobot/cli/commands.py | wc -l            # 634
git -C $NB ls-tree -r --name-only HEAD | wc -l                      # 1472
git -C $NB ls-tree -r --name-only HEAD -- nanobot | wc -l           # 629
git -C $NB ls-tree -r --name-only HEAD -- nanobot/channels | grep -c '\.py$'   # 149
git -C $NB ls-tree -d --name-only HEAD:nanobot/channels | wc -l     # 17

# --- HEAD 结构 ---
git -C $NB ls-tree -d --name-only HEAD
git -C $NB ls-tree -d --name-only HEAD:nanobot
git -C $NB ls-tree --name-only HEAD:nanobot/agent
git -C $NB ls-tree --name-only HEAD:nanobot/agent/tools
git -C $NB ls-tree -r --name-only HEAD -- nanobot/providers
git -C $NB ls-tree -r --name-only HEAD -- nanobot/session          # 13 文件
git -C $NB ls-tree --name-only HEAD:tui
git -C $NB ls-tree --name-only HEAD:webui
git -C $NB ls-tree -d --name-only HEAD:tests                        # 19 个镜像目录
git -C $NB show HEAD:nanobot/agent/runner.py | head -60             # Runner 的 import 面

# --- 阶段窗口 ---
git -C $NB log --format='%h|%ad|%s' --date=short --since=2026-05-10 --until=2026-05-17 --no-merges
git -C $NB log --format='%h|%ad|%s' --date=short --since=2026-07-20 --until=2026-07-26 --no-merges
git -C $NB log --reverse --format='%h|%ad|%an|%s' --date=short \
  --author='xubinrencs@gmail.com' --since=2026-02-01 --until=2026-02-09
git -C $NB log --reverse --format='%h|%ad|%s' --date=short --author='chengyongru' | head -3
```
