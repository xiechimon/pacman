# C 组：自主循环 / 执行器 / 编排家族 — 一手事实调研

调研日期：2026-09-30。所有 star / license / pushedAt 为当日 `gh api` 实时取值。
方法：优先 `gh repo view` / `gh api repos/<r>/readme`（raw）与仓库源码文件；文档站走 WebFetch；关键词扩展用 `gh search repos`。
凡未能从一手来源证实的，标注「未证实」，不做推断填充。

---

## 0. 分层框架

先给结论性分层，再逐项列事实。这族不是一条连续谱，而是四个功能位置，同一个项目可能跨两层。

**L1 循环执行器（loop runner）** — 提供一个不断重跑 agent 的外层循环，核心问题是「怎么知道该停」。
代表：snarktank/ralph、ralphex、continuous-claude、open-ralph-wiggum、ralph-loop-agent、gemini-cli-extensions/ralph、PageAI-Pro/ralph-loop、Task Master 的 `tm loop`。

**L2 编排面板（human-facing orchestrator）** — 不驱动循环，而是给人一个界面去并行开多个 agent、审 diff、合并。核心问题是「人怎么同时盯 N 个 agent」。
代表：vibe-kanban、claude-squad、Backlog.md、multi-agent-shogun、codex-orchestrator。

**L3 任务/规格管理层（task & spec layer）** — 提供 PRD → epic → task 的结构化载体与人审 checkpoint，循环由 harness 或人驱动。核心问题是「上下文和规格放哪」。
代表：ccpm、claude-task-master、compound-engineering。

**L4 环境 / 运行时供给（isolation & runtime）** — 不管循环也不管界面，只负责给每个 agent 一块隔离的执行地。核心问题是「并行怎么不互相踩」。
代表：dagger/container-use、humanlayer/agentcontrolplane。

**跨层或方法论层**：ruvnet/ruflo（自称 meta-harness，横跨 L1/L2/L3）、HumanLayer ACE（纯方法论文档，不含可执行循环）。

---

## 1. 必查项目明细

### 1.1 snarktank/ralph

- **仓库**：`snarktank/ralph` — https://github.com/snarktank/ralph
- **实时指标（2026-09-30）**：star 21887 ｜ license MIT ｜ 主语言 TypeScript（实际循环主体是 bash）｜ pushed 2026-02-02 ｜ created 2026-01-07 ｜ forks 2099 ｜ open issues 75 ｜ archived false
- **一句话定位（README 原文）**：Ralph is an autonomous AI agent loop that runs AI coding tools (Amp or Claude Code) repeatedly until all PRD items are complete. Each iteration is a fresh instance with clean context. Memory persists via git history, `progress.txt`, and `prd.json`.
- **核心机制**：
  - `ralph.sh` 是 bash `for i in $(seq 1 $MAX_ITERATIONS)` 循环，默认 `MAX_ITERATIONS=10`（README 与脚本一致）。
  - 每次迭代起一个全新 agent 实例（`amp --dangerously-allow-all` 或 `claude --dangerously-skip-permissions --print`），上下文干净；跨迭代记忆靠三件外部载体：git history、`progress.txt`（append-only 学习日志，含 Codebase Patterns 段）、`prd.json`（`passes: true/false` 的故事列表）。
  - 每次迭代：挑最高优先级 `passes: false` 的故事 → 实现单个故事 → 跑质量检查（typecheck/lint/test，由 agent 自己选命令）→ 通过则 commit → 把 `passes` 置 true → 追加 progress。
- **停止条件（源码级核实，`ralph.sh`）**：循环每轮把 agent stdout 抓进 `$OUTPUT`，然后
  `if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then ... exit 0`；
  否则跑完 max iterations 后打印 `Ralph reached max iterations ($MAX_ITERATIONS) without completing all tasks.` 并 `exit 1`。
  → **判定主体是模型自判（agent 在输出里写一个约定 token），叠加一个硬预算上限（迭代次数）**。README 说的「until all PRD items are complete」在机制上并不由脚本检查 `prd.json` —— `passes: true` 也是 agent 自己写的。**无外部机械验证谓词**：质量检查由 agent 自己执行、自己判通过。
- **让 agent 自己跑 vs 给人看的编排面板**：让 agent 自己跑（headless，无面板）。
- **形态**：bash CLI 脚本 + 两个 skill（`/prd`、`/ralph`）+ Claude Code marketplace 插件（`/plugin marketplace add snarktank/ralph`）。
- **依赖**：`jq`、一个 git 仓库、Amp CLI 或 Claude Code。不需要 tmux；不需要容器；不使用 git worktree（自己创建 feature branch）。
- **harness 支持**：Amp（默认）、Claude Code。
- **维护状态**：最后一次 commit 2026-02-02，无任何 release，距调研日约 8 个月无更新；open issues 75 未处理。性质更接近「被广泛 fork 的参考实现」而非活跃产品。同族大量变体在持续活跃（见 §2），说明该模式已扩散出原仓。

来源：https://github.com/snarktank/ralph ｜ https://github.com/snarktank/ralph/blob/main/ralph.sh ｜ https://github.com/snarktank/ralph/blob/main/CLAUDE.md

补充：Ralph 模式的**原始出处是 Geoffrey Huntley 的博客文章**（https://ghuntley.com/ralph/），不是仓库；上表 README 明确写 "Based on Geoffrey Huntley's Ralph pattern"。

---

### 1.2 ruvnet/claude-flow（已改名 ruvnet/ruflo）

- **仓库名核实**：`ruvnet/claude-flow` 现在会重定向到 **`ruvnet/ruflo`**；README 内自述 "Claude Flow is now Ruflo"。两种 URL 都可用，正式名是 ruflo。
- **仓库**：`ruvnet/ruflo` — https://github.com/ruvnet/ruflo
- **实时指标（2026-09-30）**：star 73551 ｜ license MIT ｜ TypeScript ｜ pushed 2026-09-30（当天）｜ created 2025-06-02 ｜ forks 8728 ｜ open issues 1030 ｜ archived false
- **一句话定位（README 原文）**：An agent meta-harness for Claude Code and Codex. —— "Agent = Model + Harness... Ruflo is the harness — the execution layer around Claude Code and Codex that adds 100+ specialized agents, coordinated swarms, self-learning memory, federated comms across machines, and enterprise security guardrails."
- **核心机制**：自述链路 `User → Ruflo (CLI/MCP) → Router → Swarm → Agents → Memory → LLM Providers`，并有一条回填的 `Learning Loop`。`npx ruflo init` 写入 `.claude/`、`.claude-flow/`、`CLAUDE.md`、hooks 与 settings，并注册 MCP server；自述规模为 98 agents、60+ commands、30 skills、314 个 MCP 工具、26 个 CLI 命令、35 个插件。hooks 系统在后台自动路由任务并从成功模式学习。
- **停止条件（未证实）**：README 未描述任何循环终止谓词。所谓 "Learning Loop" 是把成功模式回填记忆的机制，不是终止条件。仅有 `ruflo-cost-tracker` 插件提供 token 用量追踪与预算告警（预算轴存在，但不是自动停机谓词）。→ **标注：未证实存在机械终止谓词**。
- **让 agent 自己跑 vs 给人看的编排面板**：偏「让 agent 自己跑」——swarm 自治 + 后台 hooks 自动协调；同时有 monitoring/health 能力，但不是以人审为中心的面板设计。
- **形态**：npm CLI（`npx ruflo init`）+ Claude Code / Codex 插件（双安装路径：轻量 plugin track 与完整 CLI track）+ MCP server + hooks + daemon。
- **依赖**：node。README 未声明需要 tmux / 容器 / worktree（未证实）。
- **harness 支持**：Claude Code（插件 + CLI）、Codex（插件）、Hermes 及 README 所谓 "many more"（未逐一证实）。
- **维护状态**：当日 push，极活跃。但 open issues 1030，吞吐高、积压也高。
- **可信度备注**：README 含大量自我宣称指标（"ecosystem downloads 8.1M+"、"git clones 14d 106k" 等，均有指向仓库内 data/*.json 的链接）。这些**未独立核实**，报告引用其机制描述时不引用其规模宣称。

来源：https://github.com/ruvnet/ruflo ｜ https://github.com/ruvnet/claude-flow

---

### 1.3 eyaltoledano/claude-task-master（Taskmaster）

- **仓库**：`eyaltoledano/claude-task-master` — https://github.com/eyaltoledano/claude-task-master
- **实时指标（2026-09-30）**：star 28112 ｜ license NOASSERTION（README badge 写作 "MIT with Commons Clause"）｜ JavaScript ｜ pushed 2026-04-28 ｜ created 2025-03-04 ｜ forks 2616 ｜ open issues 212 ｜ archived false
- **一句话定位（README 原文）**：Taskmaster: A task management system for AI-driven development, designed to work seamlessly with any AI chat. —— README 顶部品牌已改为 Hamster 的 Taskmaster，文档全部外迁到 tryhamster.com。
- **核心机制**：任务图 + 依赖 + tags/workstreams。`tm loop` 是自动化循环：定位依赖与优先级上的下一个可用任务 → 组装带任务上下文的 prompt → 调用 Claude Code → 等待完成 → 挑下一个。README 强调它 respects your dependency graph — it won't skip ahead。进度写入 `.taskmaster/loop-progress.txt`，Ctrl+C 可中断后续跑。另有 `tm clusters start` 走并行 agent。
- **停止条件**（来源：tryhamster.com/docs/taskmaster/automation/loop）：
  - 文档原话 "Stops when all tasks are done or a task is blocked"，受阻时 "the loop stops and reports why"。→ **机械的任务列表状态检查**（但检查对象是任务标记，不是测试/构建结果）。
  - 完成检测是 "detected via structured markers"，即 agent 自己输出完成标记 → **模型自判**。
  - **无测试类谓词被文档化**；`test-coverage` preset 只影响每轮 agent 做什么（"Enforce tests with each task"），不构成停机条件。
  - **无迭代 / token / 时间上限被文档化**。
- **让 agent 自己跑 vs 给人看的编排面板**：混合。核心是任务管理层（人可读的 task 结构），`tm loop` 让它自己跑。
- **形态**：npm MCP server + CLI（包名 `task-master-ai`），接入各 IDE/agent 客户端。
- **依赖**：node；需至少一个模型 provider API key（README 列出 Anthropic / OpenAI / Google / Mistral / Grok / OpenRouter / xAI / Azure / Ollama 等）。不依赖 tmux / 容器 / worktree（未证实）。
- **harness 支持**：Cursor、Claude Code、Lovable、Windsurf、Roo 及任何 MCP 兼容客户端。
- **维护状态**：pushed 2026-04-28，距调研日约 5 个月无更新；文档与马甲整体外迁到商业站点 tryhamster.com，读作开源仓活跃度下降、重心转向商业产品。

来源：https://github.com/eyaltoledano/claude-task-master ｜ https://tryhamster.com/docs/taskmaster/automation/loop

---

### 1.4 automazeio/ccpm（Claude Code PM）

- **仓库**：`automazeio/ccpm` — https://github.com/automazeio/ccpm
- **实时指标（2026-09-30）**：star 8395 ｜ license MIT ｜ Shell ｜ pushed 2026-03-18 ｜ created 2025-08-18 ｜ forks 843 ｜ open issues 4 ｜ archived false
- **一句话定位（仓库 description 原文）**：Project management skill system for Agents that uses GitHub Issues and Git worktrees for parallel agent execution. —— README 自述 "Spec-driven development for AI agents – ship better using PRDs, GitHub issues, and multiple agents running in parallel."
- **核心机制**：
  - 5 阶段纪律（README "Core Principle: No Vibe Coding"）：Brainstorm → Document（PRD）→ Plan（epic）→ Execute → Track。
  - 分解：PRD → epic（`.claude/epics/<name>/epic.md`）→ task 文件，每个 task 带 acceptance criteria、effort、`depends_on`、`parallel`、`conflicts_with` 元数据；默认每 epic ≤10 个 task。
  - 同步：epic → GitHub Issues（用 `gh-sub-issue` 扩展建父子关系，未装则退化为 task list），任务文件由 `001.md` 改名为 `{issue-id}.md`。
  - 并行：`parallel: true` 的任务跨多个 agent 并发。README 举的例是 5 个 agent（Agent 1–5，分 UI/表单/测试/文档）**同时跑在同一个 worktree 里**；"Your main conversation becomes the conductor — it never drowns in implementation details."
  - 确定性操作（status / standup / search / validate）跑 bash 脚本，明确标注 "no LLM token cost"。
- **停止条件**：**未发现任何自动循环停止谓词**。CCPM 不驱动循环——它是「人下自然语言指令 → agent 按 skill 执行」的技能层，终止由人（如 "merge the X epic" 触发测试+合并+清理）。→ **停止条件属于「人确认」，不属于「循环执行器」**。
- **让 agent 自己跑 vs 给人看的编排面板**：偏「给人编排」——skill + GitHub Issues 作为 single source of truth（人可读的审计轨迹）+ worktree 隔离。但并发 agent 本身是自动跑的。
- **形态**：Agent Skill（`skill/ccpm/`，遵循 agentskills.io 标准）+ bash 脚本；含截图表明有可视化产物（screenshot.webp）。
- **依赖**：`git` + `gh` CLI（需 `gh auth login`）+ 一个 GitHub 仓库。worktree 用于并行隔离。不需要 tmux / 容器。
- **harness 支持**：Claude Code、Factory/Droid、Amp、OpenCode、Codex、Cursor 及任何 agentskills.io 兼容 harness。
- **维护状态**：pushed 2026-03-18，约 6.5 个月无更新；open issues 仅 4。旧版 `/pm:*` slash command 系统保留在 `v1` 分支。低活跃但低争议。

来源：https://github.com/automazeio/ccpm

---

### 1.5 Every 的 Compound Engineering

- **仓库名核实**：正确仓库是 `EveryInc/compound-engineering-plugin`（org 大小写为 EveryInc）。
- **仓库**：`EveryInc/compound-engineering-plugin` — https://github.com/EveryInc/compound-engineering-plugin
- **实时指标（2026-09-30）**：star 25339 ｜ license MIT ｜ TypeScript ｜ pushed 2026-09-30（当天）｜ created 2025-10-09 ｜ forks 2067 ｜ open issues 119 ｜ archived false
- **一句话定位（README 原文）**：AI skills that make each unit of engineering work easier than the last. —— 36 个 skills，跑在 14 个 agent host 上。维护者 Kieran Klaassen 与 Trevin Chow。
- **核心机制**：
  - 循环六步（Core loop）：`ce-brainstorm` → `ce-plan` → `ce-work` → `ce-simplify-code` → `ce-code-review` → `ce-compound`。理念是 80% 在规划与 review、20% 在执行；`ce-compound` 负责把这次改动学到的知识写下来，让下一次读得到。
  - 全自动入口是 `/lfg`（Autonomous pipeline，README 原文）：runs the loop hands-off — 选定到已验证工作源的路线（一个 plan，或为 bug report 走 `ce-debug` fix）→ 做完 → simplify → 跑 code review 并应用修复 → capture 学习 → 跑 browser tests → commit。有 git remote 时 push、开 PR、盯 CI，且 "watches CI with a bounded repair loop (it does not merge unless you grant that, and it can finish with leftovers if the repair budget is hit)"。无 remote 时止于本地 commit。
  - 配套：`ce-babysit-pr`、`ce-resolve-pr-feedback`、`ce-worktree`（worktree 支持是 skill 级可选）。
- **停止条件**：**混合型**。机械成分：CI 检查（`gh pr checks` 类）+ repair budget 上限（"bounded repair loop"）。人成分：**不授权就不 merge**（"it does not merge unless you grant that"），且 budget 用尽时允许带着 leftovers 结束。→ 默认路径不假设「模型自判完成即可收工」。
- **让 agent 自己跑 vs 给人看的编排面板**：让 agent 自己跑（`/lfg` hands-off），但设计上把人的决策点（plan 批准、review、merge 授权）作为一等公民保留。
- **形态**：插件（Claude Code marketplace、Cursor `/add-plugin`、Codex app 自定义 marketplace、Codex CLI `codex plugin marketplace add`）；另支持 Kimi Code CLI、Cline、Grok Build CLI、Devin CLI、GitHub Copilot、Factory Droid、Qwen Code、OpenCode、Pi、oh-my-pi、Antigravity CLI 等共 14 host。
- **依赖**：git；有 remote 时需要 PR/CI 通路。不依赖 tmux / 容器。worktree 由 `ce-worktree` skill 提供（可选）。
- **harness 支持**：见上，14 host。
- **维护状态**：当日 push，高活跃；open issues 119。

来源：https://github.com/EveryInc/compound-engineering-plugin ｜ https://github.com/EveryInc/compound-engineering-plugin/blob/main/docs/guides/README.md

---

### 1.6 HumanLayer 的 ACE / codelayer

**仓库名核实结论**：
- `humanlayer/ace` **不存在**（GitHub 返回 Could not resolve to a Repository）。
- ACE = **`humanlayer/advanced-context-engineering-for-coding-agents`**。
- 「codelayer」在 humanlayer org 内**未找到同名仓库**。名字最接近的是 `humanlayer/claudelayer`（非 codelayer）。→ **codelayer 标注为「未证实 / 疑为记错」**。

#### 1.6.1 humanlayer/advanced-context-engineering-for-coding-agents（ACE）

- **仓库**：https://github.com/humanlayer/advanced-context-engineering-for-coding-agents
- **实时指标（2026-09-30）**：star 2676 ｜ license 无（`null`）｜ 无主语言（无代码）｜ pushed 2026-08-04 ｜ created 2025-08-29 ｜ forks 209 ｜ open issues 4 ｜ archived false
- **形态（重要）**：这是一个**文章 / 方法论文档仓，不是工具**。**无 README**（GitHub readme API 返回 404）。根目录内容为：`ace-fca.md`（27.8 KB，"Getting AI to Work in Complex Codebases"）、`wsff.md`（48.9 KB，"Why Software Factories Fail — or: harness engineering is not enough"）、两篇 `benchmarking-*-on-slop-code-bench.md`、`images/`、`side-quests/`。
- **一句话定位**：一篇文章定义的方法论——"frequent intentional compaction"：刻意安排整个开发流程中的上下文投喂节奏，把 context 利用率压在 40-60% 区间，并在高杠杆点插入人类 review。工作流为 research → plan → implement。
- **核心机制 / 循环结构**：无代码、无循环。作者自述在 30 万行 Rust 代码库（BAML）上验证：一小时内提交被 maintainer 认可的 bug fix PR；与另一人配对在约 7 小时内产出两个 draft PR，团队估算是资深工程师各 3-5 天。
- **停止条件**：**人确认**（"building in high-leverage human review at exactly the right points"）。
- **依赖 / harness 支持**：不适用（文档）。
- **维护状态**：最后一次 commit 2026-08-04，约 2 个月无更新。

#### 1.6.2 wsff.md 的核心立场（同仓另一篇长文，值得单独记）

`wsff.md`（"Why Software Factories Fail"）是一篇**明确的反对派文章**，对 C 组讨论有直接价值：
- 刻画了主流叙事 "You are the bottleneck. The models are good enough. Code is free. Just ship more stuff."，并点名 StrongDM 的 lights-off software factory（https://factory.strongdm.ai）与 OpenAI 的 Symphony / harness engineering（Ryan Lopopolo）。
- 引用 Faros AI 报告（https://www.faros.ai/research/ai-acceleration-whiplash）称：PR review 质量下滑（review 评论 +25%、评论长度 +22.7%、完全跳过 review 的 PR 占 +31.3%），生产事故上升（事故/PR +242.7%、月度事故 +57.9%、人均 bug +54%）。
- 论点是「harness engineering is not enough」——光把循环搭起来不够。

来源：https://github.com/humanlayer/advanced-context-engineering-for-coding-agents ｜ https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/ace-fca.md ｜ https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/wsff.md

#### 1.6.3 humanlayer/claudelayer

- **仓库**：`humanlayer/claudelayer` — https://github.com/humanlayer/claudelayer
- **实时指标（2026-09-30）**：star 26 ｜ 无 license ｜ TypeScript ｜ pushed 2026-01-12 ｜ created 2025-11-13 ｜ forks 11 ｜ open issues 0 ｜ archived false
- **一句话定位（仓库 description 原文）**：Sub-agent recursion with Claude Code。
- **可查到的实质内容有限**：README 正文只有一行标题 "ClaudeLayer"，无描述。→ 除 description 外的机制细节**未证实**。
- **维护状态**：pushed 2026-01-12，约 8.5 个月无更新，视为已停更的早期实验。

#### 1.6.4 同 org 的相关编排器：humanlayer/agentcontrolplane（ACP）

作为 HumanLayer 在「执行器 / 编排」位置上的实际产物，一并记录：
- **仓库**：https://github.com/humanlayer/agentcontrolplane
- **实时指标（2026-09-30）**：star 490 ｜ license NOASSERTION（badge 为 Apache）｜ Go ｜ pushed 2025-07-02 ｜ open issues 未取 ｜ archived false
- **一句话定位（README 原文）**：ACP (Agent Control Plane) is a cloud-native orchestrator for AI Agents built on Kubernetes. It supports long-lived outer-loop agents that can process asynchronous execution of both LLM inference and long-running tool calls.
- **核心机制**：Kubernetes 上的调度器，核心对象为 LLM / Agent / Tools / Task / ToolCall；Tools 可指向 MCP Server、**Humans**（人作为工具）或**其他 Agent**（委派子 agent）。设计上继承 12-factor-agents，主打异步 tool call 与持久性保证。
- **停止条件**：不适用——它是调度层，不定义任务的完成谓词；人审批（"Incorporating Human Approval"）是一等能力。
- **形态 / 依赖**：Kubernetes 部署；本地开发需 kind + Docker + kubectl。README 自标 "ACP is in alpha"。
- **维护状态**：pushed 2025-07-02，约 15 个月无更新，实质停更。

---

### 1.7 MrLesk/Backlog.md

- **仓库**：`MrLesk/Backlog.md` — https://github.com/MrLesk/Backlog.md
- **实时指标（2026-09-30）**：star 6901 ｜ license MIT ｜ TypeScript ｜ pushed 2026-09-28 ｜ created 2025-06-04 ｜ forks 437 ｜ open issues 67 ｜ archived false
- **一句话定位（README 原文）**：Markdown-native Task Manager & Kanban visualizer for any Git repository. —— 副标题 "AI agents write the code. You review the tasks: before, during, and after."
- **核心机制**：任务就是仓库里的纯 Markdown 文件。围绕**三个 review checkpoint** 组织 agent 工作：
  1. Review the spec — agent 在实施前把你的想法分解成带 description、acceptance criteria、milestones 的 task。
  2. Review the plan — agent 研究代码库并把实施计划写进 task，人在写码前批准或纠偏。
  3. Review the code — one task = one context window = one PR（diff 保持在人能真读完的尺寸）。
  完成后 task 留在 Git 里，成为永久记录。另有 acceptance criteria + 可复用 DoD checklist、milestones + dependencies（任务详情显示它等谁、谁等它）。README 自述近乎全部自身代码由 AI agent 走 Backlog.md 写成（dogfooded，任务账本在仓库 `backlog/tasks`）。
- **停止条件**：**人确认**（三个 checkpoint）。验收标准是可验证 scope，但由人审。**无自动循环，无机械谓词**。
- **让 agent 自己跑 vs 给人看的编排面板**：明确是**给人看的**——核心卖点是把人的注意力瓶颈前移到 task spec（"You can't meaningfully review 15,000 generated lines in one sitting, but you can read a screenful of task specs"）。
- **形态**：npm / bun / brew / nix 安装的 CLI；终端 Kanban（`backlog board`，`backlog board export` 出 Markdown 报告）；**本地 web UI**（`backlog browser`，支持拖拽与表单编辑）；可选 MCP connector。自述 local-first：no server, no account, no telemetry。
- **依赖**：git（可选，`--no-git` 亦可）。不依赖 tmux / 容器 / worktree。
- **harness 支持**：Claude Code、Gemini CLI、Codex、Kiro 及任何 MCP 或 CLI 兼容助手。
- **维护状态**：pushed 2026-09-28（调研前 2 天），活跃。

来源：https://github.com/MrLesk/Backlog.md

---

### 1.8 BloopAI/vibe-kanban

- **仓库**：`BloopAI/vibe-kanban` — https://github.com/BloopAI/vibe-kanban
- **实时指标（2026-09-30）**：star 28220 ｜ license Apache-2.0 ｜ Rust ｜ pushed 2026-09-19 ｜ created 2025-06-14 ｜ forks 3029 ｜ open issues 544 ｜ archived false
- **重要状态：项目正在 sunset**。README 顶部即 `<strong>Vibe Kanban is sunsetting.</strong>` 并链到 https://www.vibekanban.com/blog/shutdown 。该公告（WebFetch 核实，公告日期 2026-04-10）要点原文：
  - "Today we're shutting down bloop, the company behind Vibe Kanban."
  - 原因："the vast majority are free users and we couldn't find a business model that we could get excited about."
  - 代码去向："The Vibe Kanban project will live on, open source and community maintained."
  - 托管服务 30 天后下线，"Vibe Kanban will transition to a fully local architecture"；local workspaces 继续可用；过去 30 天付费已退款。**没有命名任何 successor 产品**——延续者就是同一个仓库交给社区。
- **一句话定位（README 原文）**：Get 10X more out of Claude Code, Codex or any coding agent...
- **核心机制**：kanban issues 规划（可私有或团队）→ 创建 workspace，每个 workspace 给 agent 一个 branch、一个 terminal、一个 dev server → review diff 并留 inline comment 直接发回 agent → 内置浏览器预览（devtools、inspect mode、device emulation）→ 开 PR（AI 生成描述）/在 GitHub review/合并。
- **停止条件**：**人确认**（review、开 PR、merge 全由人触发）。无自动循环谓词、无预算。
- **让 agent 自己跑 vs 给人看的编排面板**：典型的**编排面板**。
- **形态**：`npx vibe-kanban` 启动的本地 web UI（Rust 后端 + node 前端）；支持自托管（docker 部署指南）。
- **依赖**：运行时用 git worktree 做隔离（"each workspace gives an agent a branch"）；开发需 Rust / Node>=20 / pnpm>=8。不需要 tmux / 容器。
- **harness 支持**：Claude Code、Codex、Gemini CLI、GitHub Copilot、Amp、Cursor、OpenCode、Droid、CCR、Qwen Code（README 称 10+）。
- **维护状态**：**混合信号**。commit 持续到 2026-09-19（最新为 `fix: Tanstack router api fix (#3464)`），但 **release 停在 v0.1.44（2026-04-24）**——即公司关闭公告发布后不久发行节奏即停摆，之后只有零散修复 commit。open issues 544。读作「社区接管中，但尚无明确的社区发行节奏」。

来源：https://github.com/BloopAI/vibe-kanban ｜ https://www.vibekanban.com/blog/shutdown

---

### 1.9 smtg-ai/claude-squad

- **仓库名核实**：`smtg-ai/claude-squad` 正确。
- **仓库**：https://github.com/smtg-ai/claude-squad
- **实时指标（2026-09-30）**：star 8550 ｜ license AGPL-3.0 ｜ Go ｜ pushed 2026-08-20 ｜ created 2025-03-09 ｜ forks 621 ｜ open issues 54 ｜ archived false
- **一句话定位（README 原文）**：Claude Squad is a terminal app that manages multiple Claude Code, Codex, Gemini (and other local agents including Aider) in separate workspaces, allowing you to work on multiple tasks simultaneously.
- **核心机制**：TUI 会话管理。按键：`n` 新建会话、`N` 带 prompt 新建、`D` 杀会话、`↑/j` `↓/k` 导航、`↵/o` 附着重发 prompt、`ctrl-q` 脱离、`s` commit 并推分支到 GitHub、`c` checkout（提交改动并暂停会话）、`r` 恢复暂停的会话、`tab` 切换 preview/diff、`q` 退出。
  - 半自动开关：`-y, --autoyes` 标注为 `[experimental]`，"If enabled, all instances will automatically accept prompts for claude code & aider"。
  - 每个任务拿到自己隔离的 git workspace，官方卖点之一是 "Review changes before applying them, checkout changes before pushing them"。
- **停止条件**：**人确认**。`--autoyes` 只是自动接受 agent 的确认弹窗，不构成终止谓词；无迭代/预算上限。
- **让 agent 自己跑 vs 给人看的编排面板**：**编排面板**（TUI），核心理念是人同时管多个后台 agent。
- **形态**：Go 编写的终端 TUI 应用，Homebrew（`brew install claude-squad`）或 curl 安装，二进制名 `cs`；有 GitHub Pages 站点。
- **依赖**：**tmux 必需**（Prerequisites 明确列出）＋ `gh` CLI。每任务独立 git workspace（worktree）。不需要容器。
- **harness 支持**：Claude Code（默认 `claude`，README 推荐用最新版）、Codex（`cs -p "codex"`）、Aider（`cs -p "aider ..."`）、Gemini（`cs -p "gemini"`），以及 OpenCode、Amp（description 与标题提及）。
- **维护状态**：pushed 2026-08-20，约 1.4 个月前，仍在稳定发版修 bug（最新版本 1.0.20，含 `fix: recover instances whose tmux session died with the server (#322)`）；open issues 54。稳定维护中。

来源：https://github.com/smtg-ai/claude-squad

---

### 1.10 dagger/container-use

- **仓库**：`dagger/container-use` — https://github.com/dagger/container-use
- **实时指标（2026-09-30）**：star 4052 ｜ license Apache-2.0 ｜ Go ｜ pushed 2026-09-21 ｜ created 2025-05-23 ｜ forks 208 ｜ open issues 62 ｜ archived false ｜ README 自标 `stability: experimental`
- **一句话定位（README 原文）**：Container Use lets coding agents do their work in parallel environments without getting in your way... It's an open-source MCP server that works as a CLI tool with Claude Code, Cursor, and other MCP-compatible agents. Powered by Dagger.
- **核心机制**：每个 agent 拿到一个全新容器，位于自己的 git branch 上；记录完整命令历史与日志（"See complete command history and logs of what agents actually did, not just what they claim"）；人可以直接 drop 进任何 agent 的终端接管；标准 git 工作流审查（`git checkout <branch_name>`）。
  - **它本身不含循环**。README 的用法是「让 agent 去用这个 MCP server」——agent 请求环境、在容器里干活。循环结构、迭代、停止全部由外层 agent/harness 决定。
- **停止条件**：**不适用**（环境供给方，不定义完成谓词）。可注意到 README 强调「所见即所做」的可观测性，这是对「模型自判」缺口的补偿手段。
- **让 agent 自己跑 vs 给人看的编排面板**：都不是。是第三类——**隔离环境供给**，为 L1/L2 提供并行不互踩的地基。
- **形态**：MCP server（`container-use stdio` / 简写 `cu stdio`）+ CLI；brew（`brew install dagger/tap/container-use`）或 curl 安装。命令别名 `cu`。
- **依赖**：**容器必需**（由 Dagger 驱动）；git branch 做隔离。不需要 tmux。
- **harness 支持**：任何 MCP 兼容 agent —— README 明确点名 Claude Code、Cursor、Goose、VSCode。
- **维护状态**：pushed 2026-09-21，活跃；但自标 experimental 且 README 明言 "This project is in early development and actively evolving"。

来源：https://github.com/dagger/container-use ｜ https://container-use.com

---

## 2. 额外发现（用户未提到，同族）

通过 `gh search repos`（关键词："autonomous coding loop"、"ralph loop"、"claude code orchestrator"、"agent orchestration claude code"、"multi-agent coding harness" 等，均加 `--stars` 阈值过滤）自主补入。按与 C 组的相关度排序。

### 2.1 umputun/ralphex（额外发现）

- **仓库**：https://github.com/umputun/ralphex
- **实时指标（2026-09-30）**：star 1487 ｜ license MIT ｜ Go ｜ pushed 2026-09-14 ｜ created 2026-01-19 ｜ forks 131 ｜ open issues 5 ｜ archived false
- **一句话定位（README 原文）**：Autonomous plan execution with Claude Code and codex —— "a standalone CLI tool that runs in your terminal from the root of a git repository. It orchestrates Claude Code or codex to execute implementation plans autonomously."
- **核心机制**：读 `docs/plans/<file>.md`，循环执行：找第一个未完成任务（`### Task N:` 配 `- [ ]` checkbox）→ 发给 Claude Code → **跑 validation commands（测试、linter）** → 勾选 checkbox 并 commit → 重复。多阶段代码 review 流水线（5 agents → codex → 2 agents）。每次任务用全新 Claude session、最小上下文，以对抗长会话上下文膨胀导致的模型退化。
- **停止条件**：README 明写 "Repeats until all tasks complete or max iterations reached"。**这是本组里机械谓词最强的一例**——验证命令（如 `go test ./...`）由人在 plan 文件里显式声明、由工具实际执行，配合 max iterations 预算上限。人可在运行中按 Ctrl+\（SIGQUIT）暂停并编辑 plan。
- **形态**：Go 单二进制 CLI；可 `--serve` 开浏览器实时 dashboard；可 `--worktree` 并行跑多个 plan；支持 Docker 隔离；支持 Telegram/Email/Slack/Webhook 完成通知。
- **依赖**：git 仓库；`--worktree` 用 git worktree；可选 Docker。不需要 tmux。
- **harness 支持**：Claude Code、codex。
- **维护状态**：pushed 2026-09-14，活跃；open issues 仅 5。
- **备注**：README 有明确告警——Anthropic 于 2026-06-15 起把 `claude -p` / Claude Agent SDK 用量移入单独的 Agent SDK 月度额度池，而 ralphex 默认模式内部走 `claude --print`，无人值守运行属于该额度池。这对所有靠 headless Claude Code 长跑的 L1 项目都是共性成本约束。

来源：https://github.com/umputun/ralphex

### 2.2 AnandChowdhary/continuous-claude（额外发现）

- **仓库**：https://github.com/AnandChowdhary/continuous-claude
- **实时指标（2026-09-30）**：star 1382 ｜ license MIT ｜ Shell ｜ pushed 2026-09-27 ｜ created 2025-11-15 ｜ forks 93 ｜ open issues 2 ｜ archived false
- **一句话定位（README 原文）**：Automated workflow that orchestrates Claude Code in a continuous loop, autonomously creating PRs, waiting for checks, and merging - so multi-step projects complete while you sleep.
- **核心机制（每轮迭代）**：新建分支并让 Claude Code 生成 commit → push 并 `gh` 开 PR → `gh pr checks` 监控 CI 与 review → 成功则 merge、失败则关闭 PR 丢弃这轮工作 → pull 最新 main、清理、重复。跨迭代记忆靠单一 `SHARED_TASK_NOTES.md`（作者的原话是让模型 "think of it as a relay race where you're passing the baton"）。作者自述设计动机是把 test coverage 从 0% 拉到 80%+。
- **停止条件**：**三重混合，且预算轴明确强制**。命令行 `-m/--max-runs`、`--max-cost`（USD）、`--max-duration`（如 `2h`/`30m`）三者**至少提供一个**。机械成分：`gh pr checks` 的 CI 与 review 门槛（"Once checks pass and reviews are approved, the PR is merged"）。模型成分："If multiple agents decide that the project is complete, the loop will stop early."
- **形态**：Shell CLI（curl 安装）。
- **依赖**：git + `gh` CLI（PR/CI 通路）；`--worktree <name>` 可选并行；不需要 tmux / 容器。
- **harness 支持**：Claude Code、Codex CLI（`--provider claude|codex`，另可 `--review-provider` 指定独立的 review 侧 provider）。
- **维护状态**：pushed 2026-09-27（调研前 3 天），活跃。

来源：https://github.com/AnandChowdhary/continuous-claude

### 2.3 Th0rgal/open-ralph-wiggum（额外发现）

- **仓库**：https://github.com/Th0rgal/open-ralph-wiggum
- **实时指标（2026-09-30）**：star 1895 ｜ license MIT ｜ TypeScript ｜ pushed 2026-06-02 ｜ created 2026-01-06 ｜ forks 144 ｜ open issues 8 ｜ archived=false
- **一句话定位（README 原文）**：Autonomous Agentic Loop for Claude Code, Codex, Copilot CLI, Cursor Agent, Qwen Code & OpenCode —— "implements the Ralph Wiggum technique — an autonomous agentic loop where an AI coding agent receives the same prompt repeatedly until it completes a task."
- **核心机制**：`ralph "prompt" --agent <x> --max-iterations N`。模型不与自己对话；每轮看到相同 prompt，变的是代码库状态。额外能力：`--tasks` 内置任务追踪、`--status` 从另一终端查进度、`--add-context` 中途注入提示而不打断循环。
- **停止条件**：prompt 里约定了 `<promise>DONE</promise>` 这类 token（README 的 while-loop 示例写作 "Output `<promise>DONE</promise>` when complete"）＋ `--max-iterations` 预算。→ **模型自判（约定 token）+ 预算上限**；README 的行文把「所有测试通过」当作 agent 自我迭代的结果，而非外部执行的谓词。**未证实有工具侧执行的机械验证**。
- **形态**：Bun + TypeScript 的 CLI；MIT。
- **依赖**：Bun；不需要 tmux / 容器。作者另有配套 `sandboxed.sh` 提供每任务独立 Linux workspace（自托管、git-backed），但那是独立项目。
- **harness 支持**：OpenCode（默认）、Claude Code、Codex、Copilot CLI、Cursor Agent、Qwen Code —— 通过 `--agent` 切换，是本组 harness 覆盖面最广的 L1 之一。
- **维护状态**：pushed 2026-06-02，约 4 个月无更新。

来源：https://github.com/Th0rgal/open-ralph-wiggum

### 2.4 vercel-labs/ralph-loop-agent（额外发现）

- **仓库**：https://github.com/vercel-labs/ralph-loop-agent
- **实时指标（2026-09-30）**：star 839 ｜ license Apache-2.0 ｜ TypeScript ｜ pushed 2026-09-16 ｜ archived=false ｜ 自标 "This package is experimental. APIs may change between versions."
- **一句话定位（README 原文）**：Continuous Autonomy for the AI SDK。
- **核心机制**：把 AI SDK 的 `generateText` 包进一个外层循环（README 的 ASCII 图：外层 Ralph Loop 套内层 AI SDK Tool Loop）。内层是 LLM ↔ tools 直到模型不再调工具；外层每轮结束时调用 **`verifyCompletion`**（用户提供的判定函数）问 "Is the TASK actually complete?"，No 则注入反馈再跑一轮，Yes 则返回结果。特性明列 "Flexible stop conditions — Limit by iterations, tokens, or cost" 与 "Context management — Built-in summarization for long-running loops"。
- **停止条件**：**用户可插拔的谓词（`verifyCompletion`）＋ 三种预算上限（iterations / tokens / cost）**。README 未规定 `verifyCompletion` 必须是机械判定，所以设计上可机械可模型——**这是一个把「停止条件是什么」显式暴露成 API 的项目**，在本组里最接近「谓词可编程」的形态。
- **形态**：npm 包（`ralph-loop-agent`），库而非应用；配套 example CLI（Vercel Sandbox + Playwright + PostgreSQL + GitHub PR 集成）。
- **依赖**：node；示例走 Vercel Sandbox（沙箱依赖）。
- **harness 支持**：AI SDK（provider 无关）。
- **维护状态**：pushed 2026-09-16，活跃。标注为 Vercel Labs **past experiments**（badge 链接指向 https://vercel.com/labs#past-experiments），即已归档的实验系列。

来源：https://github.com/vercel-labs/ralph-loop-agent

### 2.5 yohey-w/multi-agent-shogun（额外发现）

- **仓库**：https://github.com/yohey-w/multi-agent-shogun
- **实时指标（2026-09-30）**：star 1424 ｜ license MIT ｜ Shell ｜ pushed 2026-08-06 ｜ forks 未取 ｜ archived=false
- **一句话定位（README 原文）**：Command your AI army like a feudal warlord. Run 10 AI coding agents in parallel — Claude Code, OpenAI Codex, GitHub Copilot, Kimi Code, OpenCode, Cursor, Antigravity — orchestrated through a samurai-inspired hierarchy.
- **核心机制**：tmux pane 里的层级编排 —— Shogun（用户下指令）→ Karo（manager，拆解）→ 7 个 Ashigaru（worker，并行执行）+ 1 个 Gunshi（strategist）。用户在一个 pane 里自然语言下命令，其余 pane 并行跑；Memory MCP 跨会话记住偏好；有实时 dashboard。
- **停止条件**：**人确认**（人在 Shogun pane 里驱动与验收）。无自动循环谓词。
- **形态**：bash 脚本启动的 tmux 多 pane 系统（Shell 100%），有 dashboard。
- **依赖**：**tmux 必需** + bash 4+；不需要容器。
- **harness 支持**：Claude Code、Codex、Copilot、Kimi、OpenCode、Cursor、Antigravity。
- **维护状态**：pushed 2026-08-06。**README 有一条罕见的自反性说明值得记**：作者已于 2026-08 把自己 10-agent 的「军队」解散回单个 agent，后继项目是 `yohey-w/kagemusha`，形态从"agent 群"改成"判断循环"（corrections → principles → standing rules）。multi-agent-shogun 本身仍可用。这是本组内**唯一一份来自作者本人的「多 agent 并行不如单 agent + 判断纪律」的一手反悔记录**。

来源：https://github.com/yohey-w/multi-agent-shogun ｜ https://github.com/yohey-w/kagemusha

### 2.6 kingbootoshi/codex-orchestrator（额外发现）

- **仓库**：https://github.com/kingbootoshi/codex-orchestrator
- **实时指标（2026-09-30）**：star 351 ｜ license MIT ｜ TypeScript ｜ pushed 2026-05-28 ｜ archived=false
- **一句话定位（README 原文）**：Delegate tasks to OpenAI Codex agents via tmux sessions. Designed for Claude Code orchestration.
- **核心机制**：从 Claude Code（或命令行）派发任务给多个 Codex agent；spawn 并行 agent、监控进度、**任务中途追加消息**、回收结果。形态上 Claude Code 是 orchestrator，Codex 是 worker。
- **停止条件**：**人确认**（orchestrator 侧读取结果）。无自动循环谓词。
- **形态**：Claude Code 插件（`/plugin marketplace add kingbootoshi/codex-orchestrator`）＋ 独立 CLI（`codex-agent`）。
- **依赖**：**tmux 必需**（brew/apt/pacman/dnf 安装）；不需要容器。
- **harness 支持**：Claude Code（orchestrator）+ Codex（worker）；跨厂商组合。
- **维护状态**：pushed 2026-05-28，约 4 个月无更新。

来源：https://github.com/kingbootoshi/codex-orchestrator

### 2.7 gemini-cli-extensions/ralph（额外发现）

- **仓库**：https://github.com/gemini-cli-extensions/ralph
- **实时指标（2026-09-30）**：star 332 ｜ license Apache-2.0 ｜ Shell ｜ pushed 2026-02-02 ｜ archived=false
- **一句话定位（README 原文）**：Ralph is a self-referential development loop for the Gemini CLI. It allows an agent to iteratively work on a task, self-correcting and refining its output over multiple turns without manual user intervention.
- **核心机制（机制描述最精确的一例）**：循环发生在 **agent turn 之间**，由扩展的 hook 显式控制：`/ralph:loop "task" --completion-promise "DONE"` → agent 干活 → turn 结束时 `AfterAgent` hook 拦截退出 → hook 评估状态（max iterations、promises）并指示 CLI 用**原始 prompt** 开一个新 turn，同时**清空上一轮的会话上下文** → 重复。设计理由写得很直白：prompt 永不变化 + 清空上轮上下文，强制 agent 依赖文件当前状态而非可能已被压缩（"compacted"）的陈旧聊天历史。另有 "Ghost Protection"：若中断循环后开新任务，hook 检测到 prompt 不匹配会静默清理，避免劫持新对话。
- **停止条件**：**模型自判（`--completion-promise` 约定 token）＋ 预算上限（max iterations）**，由 hook 机械评估。无测试类外部谓词。
- **形态**：Gemini CLI 扩展（`gemini extensions install ...`），底层是 hook 脚本 `hooks/stop-hook.sh`。
- **依赖**：Gemini CLI（需在 `~/.gemini/settings.json` 开启 `hooksConfig.enabled` 与 preview 特性）。不需要 tmux / 容器。
- **harness 支持**：Gemini CLI 专用。
- **维护状态**：pushed 2026-02-02，约 8 个月无更新。属官方 gemini-cli-extensions org。

来源：https://github.com/gemini-cli-extensions/ralph

### 2.8 PageAI-Pro/ralph-loop（额外发现）

- **仓库**：https://github.com/PageAI-Pro/ralph-loop
- **实时指标（2026-09-30）**：star 309 ｜ license MIT ｜ Shell ｜ pushed 2026-08-31 ｜ archived=false
- **一句话定位（README 原文）**：A Ralph Wiggum Loop implementation that works™ —— "Ralph is a long-running AI agent loop. Ralph automates software development tasks by iteratively working through a task list until completion."
- **核心机制**：可 hack 的脚本，默认设置是**在 Docker Sandboxes 里跑 Claude Code**。有 promise tags 机制与 exit codes 约定；依赖 Playwright 与 Vitest 做验证；附 skills 体系。
- **停止条件**：promise tags（模型自判）＋ 退出码约定；任务列表跑完。README 的 "Promise Tags" 与 "Exit Codes" 是独立章节，提示这两者构成其停机语义。**是否有工具侧执行的测试谓词未证实**。
- **形态**：npm 包 `@pageai/ralph-loop` + Shell 脚本；有独立文档站 https://ralphloop.sh。
- **依赖**：**Docker Sandboxes 为默认运行方式（容器）**；Playwright + Vitest。
- **harness 支持**：Claude Code（默认）；README 有 "Running with a different agentic CLI" 章节支持替换。
- **维护状态**：pushed 2026-08-31，活跃。

来源：https://github.com/PageAI-Pro/ralph-loop ｜ https://ralphloop.sh

---

## 3. 关键判别轴汇总：停止条件是谁定的

这是本次调研的核心轴。把 18 个项目按「终止判定主体」排列，从最机械到最人化：

**轴 A — 工具实际执行外部谓词（机械验证）**
1. **umputun/ralphex** — plan 文件里人显式声明 validation commands（如 `go test ./...`），工具在每任务后执行；叠加 max iterations。**本组唯一「测试命令由工具执行并驱动循环」的完整实现。**
2. **vercel-labs/ralph-loop-agent** — `verifyCompletion` 是显式 API，由调用方提供；叠加 iterations/tokens/cost 三重预算。是否机械取决于调用方。
3. **AnandChowdhary/continuous-claude** — `gh pr checks` 的 CI + review 门槛驱动 merge；且 `--max-runs` / `--max-cost` / `--max-duration` 三者至少一个**强制必填**。预算轴最硬。
4. **EveryInc/compound-engineering-plugin** — `/lfg` 有 bounded repair loop 与 CI 观察，但不授权不 merge，budget 用尽允许带 leftovers 结束。

**轴 B — 模型自判（约定 token / 结构化标记）＋ 预算上限兜底**
5. **snarktank/ralph** — 源码级核实：`grep -q "<promise>COMPLETE</promise>"` 决定 `exit 0`，否则跑满 max iterations（默认 10）后 `exit 1`。**README 声称的「until all PRD items are complete」在机制上并不由脚本校验 `prd.json`**。
6. **gemini-cli-extensions/ralph** — `--completion-promise` token + max iterations，由 `AfterAgent` hook 机械评估。
7. **Th0rgal/open-ralph-wiggum** — `<promise>DONE</promise>` + `--max-iterations`。
8. **PageAI-Pro/ralph-loop** — promise tags + exit codes（细节未全证实）。
9. **eyaltoledano/claude-task-master** — 任务列表「全完成或受阻」是机械状态检查，但完成检测是 agent 输出的 structured markers；**无预算上限被文档化**。

**轴 C — 人确认（无自动循环谓词）**
10. **automazeio/ccpm** — 人下指令驱动（"merge the X epic"）；无循环。
11. **BloopAI/vibe-kanban** — review / 开 PR / merge 全由人触发。
12. **smtg-ai/claude-squad** — 人管会话；`--autoyes` 只自动确认弹窗，不停机。
13. **MrLesk/Backlog.md** — 三个 review checkpoint 全是人。
14. **yohey-w/multi-agent-shogun** — 人在 Shogun pane 驱动。
15. **kingbootoshi/codex-orchestrator** — orchestrator 侧收结果。
16. **humanlayer/advanced-context-engineering-for-coding-agents（ACE）** — 方法论层面主张「在高杠杆点插入人类 review」。

**轴 D — 不适用 / 未证实**
17. **dagger/container-use** — 环境供给方，不定义完成谓词（由外层决定）；但以「记录完整命令历史与日志，不只信 agent 自称」作为对模型自判的补偿。
18. **ruvnet/ruflo** — **未证实存在任何终止谓词**；只有 cost-tracker 插件提供预算告警（非自动停机）。

### 分布的三个结构性观察

**观察 1：「机械谓词」在本组是少数派，且集中在把验证命令写进 plan/配置的那一支。** 18 项里只有 ralphex 做到了「人在文档里声明 `go test ./...`，工具真的跑它」。绝大多数 L1 的停止判定是读 agent stdout 里的约定字符串（`<promise>COMPLETE</promise>`、`<promise>DONE</promise>`、completion-promise）。这意味着：**这些循环的终止条件是模型自报的，不是代码库状态被独立检查过的。** ralph 的案例最能说明这个落差——README 的叙事（all PRD items complete）与脚本的实际判据（grep 一个 token）并不一致，而 `passes: true` 这个"完成标记"也是 agent 自己写的。

**观察 2：预算耗尽是最普遍的第二道闸，但强制程度差异很大。** continuous-claude 要求 `--max-runs`/`--max-cost`/`--max-duration` 三者必供其一；ralphex、ralph、open-ralph-wiggum、gemini 的 ralph 都有 iterations 上限；而 task-master 的 loop **文档未列任何预算上限**，这是唯一一个「既无机械谓词又无预算兜底」的 L1。vercel-labs 版本把预算维度做成了三选（iterations/tokens/cost），是 API 层面最完整的。

**观察 3：四个层次的位置决定了「谁定停止条件」几乎是被结构性决定的，而不是设计选择。**
- L1 循环执行器必须回答停止问题，于是被迫在「模型自报 token」和「跑一条真命令」之间选 —— 多数选了前者，因为后者要求用户先把验证命令配置出来。
- L2 编排面板从不回答这个问题，因为面板的存在前提是人一直在场。
- L3 任务/规格层把问题转成「人审 checkpoint」，用人的注意力替代谓词。
- L4 环境层不回答，转而提供可观测性（container-use 的完整命令日志、ACP 的 ToolCall 记录）作为间接补偿。

### 维护状态分布（2026-09-30）

**活跃（近 1 个月内 push）**：ruflo（当天）、compound-engineering-plugin（当天）、Backlog.md（-2d）、continuous-claude（-3d）、ralphex（-16d）、vibe-kanban（-11d）、container-use（-9d）、ralph-loop-agent（-14d）、ralph-loop（PageAI，-30d）。
**低速但仍动（1-3 个月）**：claude-squad（-1.4m）、multi-agent-shogun（-1m）。
**停滞（3-8 个月）**：open-ralph-wiggum（-4m）、codex-orchestrator（-4m）、claude-task-master（-5m）、ccpm（-6.5m）、snarktank/ralph（-8m）、gemini-cli-extensions/ralph（-8m）、ACE 文档仓（-2m）。
**实质停更（>8 个月）**：humanlayer/claudelayer（-8.5m）、humanlayer/agentcontrolplane（-15m）。

**两个值得进报告的状态事实**：
- **vibe-kanban 的公司（bloop）已关闭**（公告 2026-04-10），仓库明确交给社区维护（"will live on, open source and community maintained"），并把托管服务迁回 fully local architecture。commit 到 2026-09-19，但 release 停在 2026-04-24 的 v0.1.44 —— 公告后发行节奏即停摆。
- **multi-agent-shogun 的作者本人反悔**了 10-agent 并行方案，解散回单 agent，后继 `kagemusha` 把形态从「agent 群」改成「判断循环」。这是本组内唯一一份来自作者的多 agent 并行一手法务记录。

---

## 4. 未能证实 / 疑似记错清单

| 用户给定名 | 核实结果 |
|---|---|
| `snarktank/ralph` | 存在，star 21887。Ralph 模式原始出处是 ghuntley.com/ralph 博客，非仓库。 |
| `ruvnet/claude-flow` | 存在但**已重命名为 `ruvnet/ruflo`**，claude-flow 是重定向。 |
| `eyaltoledano/claude-task-master` | 存在，但品牌与文档已外迁到 Hamster / tryhamster.com。 |
| `automazeio/ccpm` | 存在，形态已从 slash command 体系改为 Agent Skill（v1 保留在 `v1` 分支）。 |
| `everyinc/compound-engineering-plugin` | 存在，org 实际大小写为 `EveryInc`。 |
| `humanlayer/ace` | **不存在**。ACE 实际是 `humanlayer/advanced-context-engineering-for-coding-agents`，且**是文档仓不是工具**（无 README、无代码、无 license）。 |
| HumanLayer 的 "codelayer" | **未找到**。humanlayer org 内无同名仓库；名字最接近的是 `humanlayer/claudelayer`（26 star，已停更 8.5 个月，README 正文只有一行标题）。codelayer 标注为「未证实 / 疑为记错」。 |
| `MrLesk/Backlog.md` | 存在。 |
| `BloopAI/vibe-kanban` | 存在，但**正在 sunset**（公司关闭，社区接管）。 |
| `smtg-ai/claude-squad` | 存在。 |
| `dagger/container-use` | 存在。 |

其他标注为「未证实」的条目：
- ruflo 的具体终止谓词（README 未描述，仅有 cost-tracker 告警插件）。
- claudelayer 的机制细节（README 无正文）。
- claude-task-master 是否有任何迭代/token/时间预算上限（文档未列）。
- open-ralph-wiggum、PageAI ralph-loop 是否有工具侧执行的机械测试谓词。
- 各项目是否需要 tmux / 容器 / worktree 之外未在 README 声明的隐式依赖。
- ruvnet/ruflo README 中的规模宣称（8.1M 生态下载、14 天 106k git clone、314 MCP 工具等）均未独立核实。