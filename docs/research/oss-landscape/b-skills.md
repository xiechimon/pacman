# B 组：技能/工具箱家族（skills-as-markdown 形态）全景明细

数据采集时间：2026-09-30（所有 star / push 时间均为当日 `gh` 实时取值）。
采集方式：`gh api repos/*`、`gh api repos/*/git/trees/HEAD?recursive=1`、README 原文、`gh search repos`；网页（Cursor Marketplace）经 Jina Reader 只读抓取。
凡查不到的一律写「未证实」，不做推断填充。

---

## 0. 本族的形态定义（用于判别的基线）

一个「skill」= 一个目录，内含 `SKILL.md`（YAML frontmatter + 指令正文），可选 `references/`、`scripts/`、`assets/`。
判定一个项目属于本族的依据是「内容主体是 markdown 技能目录」，而不是「有 agent 编排能力」。
由此外延三个相邻形态（本报告会标注每个项目实际落在哪个）：

- **skills 库**：主体是 SKILL.md。
- **subagent 库**：主体是 agent 定义文件（`.claude/agents/*.md` 或 TOML），无技能路由。
- **索引 / 清单**：README 为主的 awesome list，不含可安装资产。
- **分发层**：不做内容，只做安装（`npx skills`）。

---

## 1. mattpocock/skills

- 仓库：https://github.com/mattpocock/skills
- 定位（README 原文）："My agent skills that I use every day to do real engineering - not vibe coding."
- star / fork：272454 / 22925；license MIT；最后 push 2026-09-29T12:38:37Z；创建 2026-02-03；homepage https://aihero.dev/skills
- 归属：个人（User，Matt Pocock / AI Hero，配 Newsletter 商业导流）
- 内容形态：**纯 markdown 技能**，无 CLI、无 server。37 个 SKILL.md，分桶组织：
  - `skills/engineering/` 20 个（promoted）
  - `skills/productivity/` 7 个（promoted）
  - `skills/misc/` 4 个
  - `skills/in-progress/` 6 个
  - `skills/deprecated/` 0 个（仅 README.md）
  - 每个 SKILL.md 旁挂一份 `agents/openai.yaml`（Codex UI 元数据）
- 路由：两级。①`skills/engineering/ask-matt` 是显式 router skill，README 里写明「main flow: idea → ship」加两条 on-ramp，把 `/grill-with-docs → /to-spec → /to-tickets → /implement|/implement-spec → /tdd + /code-review → /pr` 串成一条主线。②`setup-matt-pocock-skills` 是每仓一次的配置（issue tracker、triage 标签词汇、GLOSSARY/ADR 落点），由人手动跑。
- **user-invoked vs model-invoked 有明文规范**：`.agents/invocation.md` 规定 user-invoked = 只由人敲名字触发（Claude Code 侧 `disable-model-invocation: true`，Codex 侧 `policy.allow_implicit_invocation: false`），model-invoked 为默认。约定 user-invoked 技能**不可能**被别的技能调用，只能由人触发；技能间依赖统一写成「Call the Skill tool with \"X\"」（点名工具而非 `/x` 斜杠语法，刻意保持 harness-neutral）。来源：https://github.com/mattpocock/skills/blob/main/.agents/invocation.md
- 方法论立场：**明确反对重型流程**。README 原文点名 GSD、BMAD、Spec-Kit：「try to help by owning the process. But while doing so, they take away your control and make bugs in the process hard to resolve.」自述技能「small, easy to adapt, and composable... work with any model」。
- 支持的 harness：Claude Code（原生 plugin，进官方 marketplace）+ Codex 及其他（经 skills.sh）。ADR `0002-ship-as-a-claude-code-plugin.md` 记录了为什么**先不做 Codex 原生 plugin**：Codex 的 `.codex-plugin/plugin.json` 的 `skills` 只接受**单个路径字符串**（数组被拒），无法在分桶布局下只暴露 promoted 桶；symlink 方案会因 Codex 安装时复制插件树并丢弃 symlink 而失败。来源：https://github.com/mattpocock/skills/blob/main/.agents/adr/0002-ship-as-a-claude-code-plugin.md
- 安装：
  - `claude plugins install mattpocock-skills`（在 Claude Code 官方 marketplace，自动更新，只读、订阅式）
  - `npx skills@latest add mattpocock/skills`（复制可编辑文件进项目，Codex/其他 agent 通用；需勾选 `setup-matt-pocock-skills`）
  - README 明说「Pick one: installing both leaves you with every skill twice」。
- 维护状态：个人高频维护（几乎每日 push）；有 `.changeset`、GitHub Actions、issue 模板。

---

## 2. obra/superpowers

- 仓库：https://github.com/obra/superpowers
- 定位（README 原文）："A complete software development methodology for your coding agents, built on top of a set of composable skills and some initial instructions that make sure your agent uses them."
- star / fork：293197 / 26238；license MIT；最后 push 2026-09-27T02:37:47Z；创建 2025-10-09；plugin 版本 6.4.2；归属：个人（Jesse Vincent），但 README 有 "Commercial Services" 段落（sales@primeradiant.com，Prime Radiant），即个人项目 + 商业支持实体
- 内容形态：**纯 markdown 技能 + hooks**。15 个技能：
  `brainstorming`、`writing-plans`、`executing-plans`、`subagent-driven-development`、`dispatching-parallel-agents`、`test-driven-development`、`systematic-debugging`、`verification-before-completion`、`diagnosing-superpowers`、`requesting-code-review`、`receiving-code-review`、`using-git-worktrees`、`finishing-a-development-branch`、`writing-skills`、`using-superpowers`
  另有 `hooks/`（`hooks.json`、`hooks-cursor.json`、`session-start`）、`scripts/`、`tests/`。
- 路由：**全自动触发型**。README：「because the skills trigger automatically, you don't need to do anything special」。`using-superpowers` 技能本身是强制的元技能，正文使用 `<EXTREMELY-IMPORTANT>` 块要求「1% 可能适用就必须调用」，并要求回复中声明 "Using [skill] to [purpose]"；技能带 checklist 时必须逐项建 todo。这不是 user-invoked 路由，而是 model-invoked 强制层。
- 方法论立场：**重方法论**，与 mattpocock 相反的一端。流程为：不直接写码 → 反问需求 → 分块出 spec 给用户签字 → 出 implementation plan（要求「clear enough for an enthusiastic junior engineer with poor taste」）→ `subagent-driven-development` 逐任务派子代理做两阶段 review（先 spec 合规、再代码质量）。Philosophy 四条：TDD 永远先写测试；Systematic over ad-hoc；Complexity reduction；Evidence over claims。
- 支持的 harness：**最广**。README 分节列出：Claude Code、Antigravity、Codex App、Codex CLI、Cursor、Devin CLI、Factory Droid、Gemini CLI、GitHub Copilot CLI、Grok Build CLI、Kimi Code、OpenCode、Pi、Qwen Code、Hermes Agent、Muse。仓库内对应存在 `.claude-plugin/`、`.cursor-plugin/`、`.codex-plugin/`、`.kimi-plugin/`、`.devin-plugin/`、`.hermes-plugin/`、`.muse-plugin/`、`.opencode/`、`.pi/`；`docs/porting-to-a-new-harness.md` 是移植指南；`tests/` 按 harness 分目录（claude-code、codex、devin、hermes、kimi、opencode、pi、antigravity 等）。
- 安装（摘要）：Claude Code `claude plugins install superpowers@claude-plugins-official`；Cursor `/add-plugin superpowers`；Codex 从 openai/plugins 市场；Grok 从 xAI 官方市场 `grok plugin install superpowers@xai-official --trust`；Gemini `gemini extensions install https://github.com/obra/superpowers`；Devin `devin plugins install obra/superpowers`。
- 维护状态：个人主导但工程化程度最高（多 harness 测试矩阵、版本号、porting 文档）。

---

## 3. pstack（Lauren Tan / @poteto 系）— 上游之谜

### 3.1 结论：上游在 Cursor 官方插件仓

`poteto/pstack` **确实不存在**（`gh api repos/poteto/pstack` → 404，实测 2026-09-30）。

**pstack 的正本发布渠道 = Cursor 官方插件仓 `cursor/plugins` 的 `pstack/` 子目录**：

- 上游路径：https://github.com/cursor/plugins/tree/main/pstack
- Marketplace 页：https://cursor.com/marketplace/pstack ，页面上标 **"Created by Cursor / Verified by Cursor / View Source → github.com/cursor/plugins"**，安装命令 `/add-plugin pstack`
- 版本 0.15.5（`pstack/.cursor-plugin/plugin.json`）；license MIT，`pstack/LICENSE` 首行 "Copyright (c) 2026 Lauren Tan"
- 作者归属实证：`gh api repos/cursor/plugins/commits?path=pstack` 全部 90 条提交中 **poteto 占 87 条**，另外 3 条是 `cursoragent`；`cursor/plugins` 全仓 contributor 列表里 poteto 排第一
- `cursor/plugins` 仓本身：9064 star / 850 fork，无仓级 license，创建 2026-01-23，最后 push 2026-09-30T00:58:41Z；README 自述 "Official Cursor plugins for popular developer tools, frameworks, and SaaS products"，每个插件一个根级目录 + 自己的 `.cursor-plugin/plugin.json`
- 同仓还发布了同族插件 `dyl-stack`（作者 Dylan Gattey，README 描述 "Dylan's agent style on top of pstack"），即**「个人风格 stack」被厂商官方仓收录**是这个仓的既有模式；另有 `orchestrate`、`thermos`、`ralph-loop`、`cursor-team-kit` 等同族

旁证：`poteto/plugins` 是 `cursor/plugins` 的 fork（76 star，最后 push 2026-06-14），说明她的工作落点就在该仓。

**所以「pstack 上游在哪」的答案是**：没有独立仓库、没有官网文档站、没有私有仓；正本就是 Cursor 官方插件仓的 `pstack/` 目录，主分发靠 Cursor 内置插件市场（`/add-plugin pstack`），上游不在 GitHub 上有任何 standalone 发布形态。这也解释了为什么会出现大量第三方移植仓——因为上游锚点是一个 monorepo 子目录 + Cursor 专有 primitives，无法直接安装到别的 harness。

### 3.2 上游 pstack 的内容与耦合（判别轴的关键样本）

- 规模：`pstack/skills/*/SKILL.md` **47 个**；另有 `pstack/agents/` 2 个 subagent 定义（`comment-sicko`、`poteto-agent`）；`pstack/automations/benny/` 下 3 个额外 SKILL.md（`reproduce-and-fix-issues`、`setup-benny`、`triage-issue-reports`）；`pstack/docs/guide/` 11 篇教程（01-setup ～ 10-recipes-and-pitfalls）
- 组织方式：入口是 `poteto-mode`（mode skill，frontmatter 带 `disable-model-invocation: true`、`mode: true`、`icon: crown`、`color: yellow`、`reminder:`——`mode/icon/color/reminder` 是 Cursor 侧扩展字段），由它按 playbook 调其它技能；`principle-*` 共 23 个叶子原则技能（`principle-laziness-protocol`、`principle-subtract-before-you-add`、`principle-prove-it-works`、`principle-guard-the-context-window` 等）；工具型技能 `how`、`why`、`unslop`、`bro`、`architect`、`blast-radius`、`arena`、`swarm`、`interrogate`、`tdd`、`teach`、`technical-writing`、`no-comments`、`show-me-your-work`、`figure-it-out`、`automate-me`、`recall`、`reflect`、`setup-pstack`、`create-verification-skill`、`maintain-verification-skill`、`make-bot-ui`、`typescript-best-practices`
- 方法论立场（README 原文）："there's a growing sense that ai writes too much slop code. i agree. i don't want to ship like a team of twenty slop artists. throughput without quality is not a goal i aspire to. **if you want to go fast, go deep first**."；"the goal is not to maximize loc, in fact it's the opposite"；主张 "fearless parallelism"（先能信任单个 agent，再并行）
- 默认模型分工（README）：code delegates 走 grok，最难改动/散文/判断走 fable 5.1，默认 panel = fable 5.1 / sol / grok / opus 5

**强依赖 Cursor 的原语（移植到别处会残废的部分，逐条有源码出处）**：

| 依赖点 | 证据（源码位置） |
|---|---|
| `Task` 子代理工具 + `subagent_type: generalPurpose` | `pstack/skills/swarm/SKILL.md` Phase B |
| `environment: "cloud"` / `"local"`（Cursor 云端 agent） | 同上 |
| `cloud_base_branch`（云端 worker 非默认分支起步） | 同上 |
| `run_in_background: true` 并行 spawn 语义 | `swarm/SKILL.md`、`arena/SKILL.md` Phase B |
| `~/.cursor/rules/pstack-models.mdc`（`alwaysApply: true` 的 Cursor rules 格式） | `setup-pstack/SKILL.md` 步骤 5 |
| `AskQuestion` 专用提问工具 | `poteto-mode/SKILL.md`、`setup-pstack/SKILL.md` 步骤 3 |
| Cursor 侧模型 slug：`claude-opus-5-5-max`、`gpt-5.6-sol-max`、`grok-4.7-xhigh-fast` | `arena/SKILL.md`、`swarm/SKILL.md` |
| Cursor 内置技能依赖：`create-skill`（Cursor 内置，写 SKILL.md 用）、`babysit`（PR 守夜，被显式要求**不要**用内置那个） | `poteto-mode/SKILL.md` |
| 跨插件依赖 `cursor-team-kit`：`deslop`、`control-cli`、`control-ui` | `poteto-mode/SKILL.md` |
| skill frontmatter 扩展字段 `mode` / `icon` / `color` / `reminder` | `poteto-mode/SKILL.md` |

`disable-model-invocation` 是 Cursor 与 Claude Code 共有的字段，不算独占；上表前 5 行是**真正无法平移**的部分。

### 3.3 移植/分叉谱系（各仓跟踪谁、覆盖哪些 harness）

所有移植仓的共同事实：都是社区非官方项目，都声明跟踪 `cursor/plugins/pstack`，均为 MIT 且保留 Lauren Tan 原始版权。上游 pstack 自身没有版本化 release 通道，各仓只能盯 `main` 的 commit。

| 仓库 | star | 最后 push | 声明上游锚点 | 覆盖 harness | 同步机制（README 自述） |
|---|---|---|---|---|---|
| https://github.com/backnotprop/pstack | 690 | 2026-09-14T15:57:11Z | mirror of `cursor/plugins/pstack` | Claude Code、Codex、Pi、其他 | 顶部 mirror 段 + `MIRROR.md` 同步流程；README 下半部是**未改动的上游 README 原文**；安装走 `npx skills add backnotprop/pstack`；标注了技能间的依赖分组（如 `teach` 需同时装 `how`/`why`，`poteto-mode` 需全部 `principle-*`） |
| https://github.com/michael-denyer/pstack-claude | 694 | 2026-09-29T23:21:42Z | 跟踪上游 + 自带命名策略分叉（`tools/forks.json` 逐条声明） | Claude Code、Codex、OpenCode、Gemini CLI、Prime Agent | 翻译 Cursor primitives；安装 `/plugin marketplace add michael-denyer/pstack-claude` 或 `codex plugin marketplace add ...`；`setup-pstack` 可设每角色 reasoning effort，Claude Code 侧经 `pstack:effort-<level>` / `pstack:poteto-agent-<level>` agents 分派 |
| https://github.com/ericlitman/open-pstack | 343 | 2026-09-10T23:07:10Z | pstack 0.15.1 @ Cursor commit `f8abeddd1862dc73704e3d719dd73df0d51b8c71`（自身版本 1.4.1，两套版本号分离） | Claude Code、Codex | `UPSTREAM.md` 记录同步记录与流程；明说「does not promise instant updates」；保留 `README-UPSTREAM.md` 上游原文；明文「new pstack behavior belongs in Lauren's project first」 |
| https://github.com/Aqua-123/pstack-for-codex | 78 | 2026-09-25T22:15:37Z | 不自带 upstream remote，靠 `upstream.lock.json` + `NOTICE` + `compatibility/pstack-map.json` 记录源 commit / license / 文件哈希 / 迁移状态 | Codex | `UPSTREAM.md` 说明维护者如何经临时本地 checkout 刷新证据；自称 45 个显式技能 + 23 个 Poteto Mode playbook |
| https://github.com/ScriptedAlchemy/pstack-codex | 62 | 2026-09-18T00:12:58Z | pinned 在 `UPSTREAM.json`；upstream 版本 0.15.2，源 commit `e31650eea443aaea1e84cc15d88c13f40080b275` | Codex（含 Codex marketplace 与 installer） | `scripts/check-upstream.sh` 拉上游 git objects 只打印新变更、从不自动覆盖已翻译文件；`scripts/parity.py --report` 出逐文件 retained/adapted/replaced 报告；自称 47 skills / 23 playbooks |
| https://github.com/shrimpwtf/oh-my-pstack | 28 | 2026-09-01T09:25:08Z | `upstream.lock.json` 钉上游 `main` | Pi、OMP、Claude Code、Codex 等 | GitHub Actions `upstream-sync.yml` **每日同步并开一个已验证的 PR**；自称 44 个上游技能；明示 Cursor 原始仓只被当作早期结构示例 |

`gh search repos pstack` 还翻出同族小仓（未逐个读 README，标注为未深查）：`adjohn/pstack`（Claude Code，自述 "ported from cursor/plugins"）、`Luks3110/pstack-zcode`（ZCode，自述 upstream: `cursor/plugins/pstack`）、`negoro26/pstack-omp`、`cang-pham-codeleap/pstack-omp`（oh-my-pi）、`kkgogogo17/pi-pstack`（Pi）、`FetchUpstream/pstack-plugin`（ChatGPT 插件）、`Cloeille/pstack`（Hermes Agent）、`dsebban/skills`（OMP）、`painhardcore/pstack`、`tommy-ca/pstack`（Grok Build/Codex/Claude Code）、`shiwenbin1617/pstack`、`HustleCoding/pstack-codex`。

**同名词干扰项（不属于本族，用于排除）**：`peadar/pstack`（进程栈回溯工具）、`bloomberg/pystack`、`z0nt/pstack`、`ice799/pstack`、`kay21s/pStack`（TCP/IP stack）、`no-session/pstack`（梵 `garrytan/gstack` 的独立谱系，与 poteto 无关）、`BhaskarManam/pstack`（产品经理技能包，借用名字）。

### 3.4 poteto 名下其它相关仓

| 仓库 | star | license | 最后 push | 定位 / 形态 |
|---|---|---|---|---|
| https://github.com/poteto/how | 825 | MIT | 2026-04-14T22:14:28Z | "skill for explaining architecture"。一个 Cursor plugin，提供 `/how` 技能：解释子系统/流程（Explain 模式）或解释后再跨多模型起独立 critic（Critique 模式）；复杂问题会拆 2–4 路 explorer 子代理并行、再合成。形态 = 单技能 + `.cursor-plugin/plugin.json` + `references/`（explainer/explorer/critic prompt 与 critique rubric）。**harness：Cursor 专有（plugin 形态 + 多模型 subagent）** |
| https://github.com/poteto/noodle | 299 | MIT | 2026-03-19T07:46:39Z | "Orchestrate agents using skills. Built in Go."。**带 CLI / 二进制**，不是纯 markdown；安装说明以「把 INSTALL.md 交给你的 agent」的方式分发；文档站 https://noodle-run.github.io/noodle/ |
| https://github.com/poteto/brainmaxxing | 297 | MIT | 2026-02-27T19:47:29Z | "stupid simple persistent memory and skill improvement"。markdown vault（同时是 Obsidian vault）+ 16 条工程原则起步内容 + 6 个技能，其中 4 个构成学习闭环（`reflect` / `ruminate` / `meditate`，`plan` / `review` 支持结构化工作），另 2 个 hook（启动注入 brain index、文件变更重建索引）。README 明说 "persistent memory for Claude Code"。**harness：Claude Code 专有（hooks + 启动注入）** |
| https://github.com/poteto/verification-skill-example | 104 | 无 license | 2026-07-30T20:07:51Z | 虚构的 Atlas / Harbor Labs 示例，演示「项目本地 verification skill + 行为级 feature map」的形状；技能落在 `.cursor/skills/verify-atlas/`，含 `references/features/*.md`（约 30 个功能文件）与 `features/README.md` 的回归 sweep 顺序。README 给了「为什么不用 wiki」的论证（wiki 给人看、agent 每次重读都要付费；feature map 可切片、可执行、可 sweep、随代码同 PR 维护）。**harness：Cursor 路径（`.cursor/skills/`）** |

### 3.5 上游之外的一条旁证

`poteto` 也发了相关社区分发物：`poteto/benny-avatars`（2 star，README 说这些 PNG 是 "the orchestrate skill Slack bot in anysphere/everysphere" 用的头像）——说明 pstack 的 `automations/benny` 对应的是 Cursor 内部的 Slack 自动化接线。

---

## 4. anthropics/skills（Anthropic 官方）

- 仓库：https://github.com/anthropics/skills
- 定位（README 原文）："Public repository for Agent Skills"；"This repository contains skills that demonstrate what's possible with Claude's skills system."
- star / fork：179076 / 21168；**仓级 license 字段为空**；最后 push 2026-09-29T02:20:07Z；创建 2025-09-22；归属：组织（Anthropic，公司官方）
- 内容形态：**纯 markdown 技能参考语料**，无 CLI、无 subagent 定义、**无路由**（没有 router skill、没有 mode）。顶层三块：`skills/`、`spec/`、`template/`。
- 技能数量与组织：`skills/` 下 19 个技能目录，彼此平级、无分层：
  `academy-guide`、`algorithmic-art`、`brand-guidelines`、`canvas-design`、`claude-api`、`discernment-nudge`、`doc-coauthoring`、`docx`、`frontend-design`、`internal-comms`、`mcp-builder`、`pdf`、`pptx`、`skill-creator`、`slack-gif-creator`、`theme-factory`、`web-artifacts-builder`、`webapp-testing`、`xlsx`
  README 自述分四类：Creative & Design / Development & Technical / Enterprise & Communication / Document Skills。`skill-creator` 是元技能（教怎么造技能并做 evals）。
- **license 分层（实测逐个 LICENSE.txt）**：大部分技能 Apache-2.0（如 `algorithmic-art`、`mcp-builder`）；`docx` / `pdf` / `pptx` / `xlsx` 是 **source-available 而非开源**，`skills/docx/LICENSE.txt` 首行即 "© 2025 Anthropic, PBC. All rights reserved."；README 明说这四个是「power Claude's document capabilities under the hood」的生产技能，只作为参考分享。
- spec：`spec/agent-skills-spec.md` 内容已改为一行指针 —— "The spec is now located at <https://agentskills.io/specification>"。即 **Agent Skills 标准已迁出该仓，独立到 agentskills.io**（本族的关键基础设施事实）。
- 安装：Claude Code `claude plugin marketplace add anthropics/skills` → 选 `document-skills` 或 `example-skills`；Claude.ai 付费档已内置；API 走 Skills API。`template/` 提供技能脚手架。
- 免责声明（README 原文）："These skills are provided for demonstration and educational purposes only." 并提示实际行为可能与技能实现不同。
- 维护状态：公司官方，持续维护（几乎每日 push）。

---

## 5. wshobson/agents

- 仓库：https://github.com/wshobson/agents
- 定位（README 原文）："Production-ready agentic workflow building blocks: **94 plugins**, **202 agents**, **184 skills**, **105 commands** — built for Claude Code and consumed natively by OpenAI Codex CLI, Cursor, OpenCode, the Antigravity CLI, GitHub Copilot, and Pi from a single Markdown source."（仓库 description 另写作 "Multi-harness agentic plugin marketplace for Claude Code, Codex, Cursor, OpenCode, GitHub Copilot, Google Antigravity, and Pi"）
- star / fork：40101 / 4278；MIT；最后 push 2026-09-29T00:45:29Z；创建 2025-07-24；homepage sethhobson.com；归属：个人（User，Seth Hobson）
- 内容形态：**plugin marketplace + 多 harness 生成器**。`plugins/` 是 source-of-truth（Claude Code markdown），`tools/adapters/` 是各 harness 的 adapter，`docs/harnesses.md` 是能力矩阵，另有 `evals/`、`.cursor/rules/`、`.agents/plugins/`。**带真实 CLI 工具链**（`make generate HARNESS=...`、`make install-opencode`）。
- 计数核对（2026-09-30 实测 tree）：`plugins/` 下 **92** 个目录、`plugins/*/agents/*.md` **202** 个、`plugins/*/skills/*/SKILL.md` **184** 个、`plugins/*/commands/*.md` **105** 个。README 自称 94 plugins 与实测 92 的差额**未证实**（可能是 marketplace 条目数计法不同）。
- 组织方式：按领域分 plugin（`api-scaffolding`、`backend-development`、`c4-architecture`、`cloud-infrastructure`、`code-refactoring`、`agent-orchestration`、`agent-teams`、`block-no-verify`、`avoid-ai-writing` 等）；每个 plugin 内含 skills + agents + commands 三件套，有 marketplace 清单。**无统一「mode」入口，路由粒度在 plugin 层**。
- 方法论立场：偏「production-ready building blocks」而不是单一强方法论；但含立场明确的插件（如 `block-no-verify`、`avoid-ai-writing`、`before-you-build`）。
- 支持的 harness（README 与 `docs/harnesses.md`）：Claude Code（source-of-truth）、OpenAI Codex CLI（committed `.codex-plugin/plugin.json` + `.agents/plugins/marketplace.json`）、Cursor 2.5+（committed `.cursor-plugin/` + `.cursor/rules/`）、OpenCode（gitignored `.opencode/`）、Google Antigravity CLI（gitignored `.antigravity/`）、Pi（gitignored `.pi/`），外加只装技能的 `gh skill`（2.90+）与 `npx skills`。README 正文写 "six target harnesses" 但同时列了 7 个 —— 表述不一致，以 capability matrix 的 7 行为准。
- **`docs/harnesses.md` 的能力矩阵是本报告最有价值的 harness 差异一手材料**（来源：https://github.com/wshobson/agents/blob/main/docs/harnesses.md），要点：
  - Skills：Claude Code/Codex 原生；Cursor 经 `.claude/`；OpenCode 经 `.opencode/skills/`；Antigravity 原生自包含；Pi 递归发现
  - Subagents：Claude Code markdown 原生；**Codex 是 TOML 格式**；OpenCode frontmatter 不同；Antigravity 用 `invoke_subagent`/`define_subagent`；Pi 靠 `subagent` extension
  - 生命周期 hooks：**仅 Claude Code / OpenCode / Antigravity / Pi**
  - `TodoWrite`：**仅 Claude Code 与 OpenCode**
  - **技能正文硬上限：Codex 为 8 KB，其余为无限制**
  - 上下文文件：Claude Code 用 `CLAUDE.md`（指向 `AGENTS.md` 的 symlink），其余用 `AGENTS.md`（Codex 32 KiB 上限）
  - 工具名大小写：Claude Code CamelCase（`Read`），Codex 用动作动词无工具词汇，其余小写
  - 模型别名：Claude Code 有裸别名（`fable`/`opus`/`sonnet`/`haiku`），Codex 映射到 GPT-5.x，Cursor 用 `inherit`
- 安装：`/plugin marketplace add wshobson/agents` → `/plugin install <name>`；`npx codex-marketplace add wshobson/agents`；Cursor 加 marketplace 后 `/plugin install <name>`；Antigravity/OpenCode/Pi 走 clone + `make generate`；只装技能用 `gh skill install wshobson/agents` 或 `npx skills add wshobson/agents --skill <name>`。
- 维护状态：个人高频维护，带 evals 与 CI。

---

## 6. SuperClaude-Org/SuperClaude_Framework

- 仓库：https://github.com/SuperClaude-Org/SuperClaude_Framework
- 定位（README 原文）："A configuration framework that enhances Claude Code with specialized commands, cognitive personas, and development methodologies."；正文 slogan "Transform Claude Code into a Structured Development Platform"
- star / fork：23910 / 2001；MIT；最后 push 2026-09-27T12:50:32Z；创建 2025-06-22；homepage https://superclaude.netlify.app/ ；版本 v4.3.0；归属：组织（SuperClaude-Org）
- **内容形态不是纯 markdown 技能**：主体是一个 **Python CLI**（`pipx install superclaude` → `superclaude install` 装上 30 个 slash commands；另有 npm 包 `@bifrost_inc/superclaude`）。仓库结构：`src/superclaude/`（30 个 py 文件）、`plugins/superclaude/`（`commands/` 30 个 md、`agents/` 20 个 md、`modes/` 7 个 md、`skills/`、`mcp/`、`hooks/`、`core/`）、`skills/confidence-check`、`.claude/skills/`、`docs/`（含中/日/韩/英多语文档）。
- 技能数量：SKILL.md 实测 **9 个**，md 文件 304 个 —— 即**技能只占很小一部分，主体是「commands + personas/modes + MCP 配置」**。这是本族里唯一「配置框架」形态的项目。
- 路由：无 router skill；入口是斜杠命令（`/sc` 系列、`/brainstorm`、`/implement`、`/spec-panel`、`/business-panel`、`/task`、`/workflow`、`/troubleshoot` 等 30 个）+ 7 个 cognitive modes（personas）叠加。
- 方法论立场：结构化开发流程 + 认知 persona 叠加（`docs/architecture`、`docs/mistakes`、`docs/research` 等大量方法论文档）。
- 支持的 harness：**仅 Claude Code**。另有兄弟仓 `SuperGemini_Framework`、`SuperQwen_Framework` 走同一思路服务别的模型（README 顶部两个 badge 直链），即**按模型分仓而非单仓多 harness**。
- 维护状态：组织维护，版本化发布（PyPI + npm），多语言文档，有测试 workflow。

---

## 7. VoltAgent/awesome-claude-code-subagents

- 仓库：https://github.com/VoltAgent/awesome-claude-code-subagents
- 定位（README 原文）："The awesome collection of 161+ Claude Code subagents across 10 categories."（仓库 description 写 "A collection of 100+ specialized Claude Code subagents..."）
- star / fork：25414 / 2935；MIT；最后 push 2026-09-21T08:24:27Z；创建 2025-07-30；归属：组织（VoltAgent）；homepage 指向 getdesign.md（赞助方之一）
- 内容形态：**subagent 定义库，不是 skills 库**。`categories/NN-xxx/*.md`（实测 171 个 md，其中 161 个 agent 文件 + 10 个分类 README）、`.claude/settings.local.json`、`.claude-plugin/`、`tools/`。
- 组织：10 个分类 —— `01-core-development`、`02-language-specialists`、`03-infrastructure`、`04-quality-security`、`05-data-ai`、`06-developer-experience`、`07-specialized-domains`、`08-business-product`、`09-meta-orchestration`、`10-research-analysis`。无路由、无分层调用，按需拷贝。
- 方法论立场：无强立场，定位为「definitive collection」。有明确治理规则：**不接受以推广产品/公司/个人项目为主要目的的 PR，要求 vendor-neutral，想曝光请走赞助**。
- 支持的 harness：Claude Code subagent 格式（`.claude/`）为主，README 未声明其它 harness 支持。
- 维护状态：组织维护 + 赞助驱动（Crawlbase、SerpApi 等在 README 顶部），是三方项目的分发渠道。

---

## 8. hesreallyhim/awesome-claude-code

- 仓库：https://github.com/hesreallyhim/awesome-claude-code
- 定位（README 原文）："A hand-picked collection of the finest of resources for the most awesome of agents, Claude Code... A delectable showcase of top tier skills, ambidextrous agents, scintillating status lines, top notch developer tooling, and also we have plugins"
- star / fork：54833 / 4776；**license = CC BY-NC-ND 4.0**（`gh` 报 NOASSERTION，`LICENSE` 首行实测为 "Awesome Claude Code © 2026 by hesreallyhim is licensed under Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International"）；最后 push 2026-09-30T09:11:04Z（本组最活跃）；创建 2025-04-19；归属：个人（User）
- **它是索引，不是工具**——本报告明确标注。仓库结构无技能、无 agent、无 CLI：`README.md` + 程序生成资产（`assets/repo-ticker.svg`、`assets/recently-added.svg`）+ `resources/`（Python 脚本：`add_resource.py`、`parse_issue_form.py`、`submit_resource_issue.py`、`update_resource.py`、`move_resource.py`、`categories.py`、`ids.py`）+ `data/` + `templates/` + `tests/` + `ticker/` + `README_ALTERNATIVES/`（旧版条目归档）。
- 目录结构（README）：Start Here / From Anthropic / Documentation, Knowledge & Learning / Open Source Software / Research & Scientific Inquiry / Providers, Runtime & Integration Infrastructure / Remote Control, Notifications & Voice I/O / Alternative Clients / Status Lines / Design & UI/UX / Writing & Prose Quality / Creative Media / Infrastructure & DevOps / Security / Agent Orchestration（含 Ralph Wiggum、Dynamic Workflows）/ …
- 贡献机制：不是裸 PR，而是经 `resources/submit_resource_issue.py` 走 issue 表单 → `parse_issue_form.py` 解析。即**索引本身被工具化维护**。
- license 含义（原文）：采用 NC-ND 是为了「prevent appropriation of the labor of myself and the developers whose work is featured on this list」，即禁止商用与改作衍生分发 —— 对「拿它的清单再发布」这类用法是硬约束。
- 维护状态：个人高频维护（本组最高 push 频率），但对标 SuperClaude 之类项目有 "Mentioned in Awesome Claude Code" 徽章背书效应。

---

## 9. 额外发现（用户未提及、同族，自主补齐）

按对本报告判别轴的价值排序。

### 9.1 vercel-labs/skills — 本族的「分发层」
- https://github.com/vercel-labs/skills
- 定位（description 原文）："The open agent skills tool - npx skills"；homepage https://skills.sh
- star 32811 / fork 2791；MIT；最后 push 2026-09-28T20:20:57Z；创建 2026-01-14；归属：组织（Vercel）
- 为什么重要：**它不是技能集合，是跨 harness 的安装器**。本报告中 mattpocock/skills、backnotprop/pstack、wshobson/agents 等多个上游都把它写作「Codex 与其他 agent 的通用安装路径」（`npx skills add <owner>/<repo>`，交互式选技能 + 选目标 agent；`npx skills update` 更新）。
- 判别价值：说明本族已经出现**内容与分发解耦**——上游不必自己做多 harness 适配，交给 CLI 复制文件即可。vscode 类生态里这是 npm 的位置。

### 9.2 addyosmani/agent-skills — 与 mattpocock 同形态的头部个人作品
- https://github.com/addyosmani/agent-skills
- 定位（description）："Production-grade engineering skills for AI coding agents."；homepage https://skills.addy.ie
- star 100010 / fork 10506；MIT；最后 push 2026-09-26T04:19:38Z；创建 2026-02-15；归属：个人（User，Addy Osmani）
- 判别价值：与 mattpocock/skills 直接同型（个人品牌 + 纯 markdown + skills.sh 分发），是本族「个人权威输出的技能库」这一支的另一个标杆；本报告将其列为对照项。

### 9.3 github/awesome-copilot — 厂商官方策展
- https://github.com/github/awesome-copilot
- 定位（description）："Community-contributed instructions, agents, skills, and configurations to help you make the most of GitHub Copilot."；homepage https://awesome-copilot.github.com/
- star 39527 / fork 5033；MIT；最后 push 2026-09-30T06:20:27Z；创建 2025-06-11；归属：组织（GitHub）
- 判别价值：harness 厂商自己做官方策展仓（对比 Cursor 走 `cursor/plugins` 官方插件仓、OpenAI 走 `openai/plugins`、xAI 走 `xai-org/plugin-marketplace`），说明「官方仓 + marketplace 清单」已成为 2026 年的标准分发形态。

### 9.4 vercel-labs/agent-skills — 厂商官方技能集合
- https://github.com/vercel-labs/agent-skills
- 定位（description）："Vercel's official collection of agent skills"；homepage https://skills.sh/vercel-labs/agent-skills
- star 31744 / fork 2777；**仓级 license 字段为空（未证实具体条款）**；最后 push 2026-08-28T13:36:31Z；创建 2025-12-08；归属：组织（Vercel）

### 9.5 VoltAgent/awesome-agent-skills — 跨 harness 索引
- https://github.com/VoltAgent/awesome-agent-skills
- 定位（description）："A curated collection of 1000+ agent skills from official dev teams and the community, compatible with Claude Code, Codex, Gemini CLI, Cursor, and more."；homepage https://officialskills.sh/
- star 35052 / fork 3758；MIT；最后 push 2026-09-29T15:33:15Z；创建 2025-10-28；归属：组织（VoltAgent）
- 判别价值：与 §8 同类（索引），但**以技能而非 Claude Code 单 harness 为轴**，且自带 skills.sh 形态的站点。

### 9.6 trailofbits/skills — 领域垂直（安全）
- https://github.com/trailofbits/skills
- 定位（description）："Trail of Bits Claude Code skills for security research, vulnerability detection, and audit workflows"
- star 7301 / fork 624；**CC-BY-SA-4.0**；最后 push 2026-09-28T18:06:38Z；创建 2026-01-14；归属：组织（Trail of Bits，安全公司）
- 判别价值：证明本族已从「通用工程方法论」分化出**机构背书的垂直技能集**（安全审计 / 漏洞检测），且用 CC-BY-SA 而非 MIT（与 §8 的 NC-ND 形成许可谱系）。

### 9.7 K-Dense-AI/scientific-agent-skills — 领域垂直（科研）+ 明确多 harness
- https://github.com/K-Dense-AI/scientific-agent-skills
- 定位（description）："Turn any AI agent into an AI Scientist... 168 ready-to-use validated skills plus 100+ scientific databases... Compatible with Cursor, Claude Code, Codex, Pi, Antigravity, and the open Agent Skills standard."
- star 47177 / fork 4264；MIT；最后 push 2026-09-29T23:34:26Z；创建 2025-10-19；homepage 指向 arXiv 论文 https://arxiv.org/abs/2609.00065 ；归属：组织
- 判别价值：规模最大的垂直技能库之一（168 技能），且**显式按「Agent Skills 标准」写、不用 harness 专有原语**——与本报告判别轴的「可移植档」正面对照。

### 9.8 openai/plugins 与 xai-org/plugin-marketplace — 厂商官方 marketplace 双子
- https://github.com/openai/plugins —— star 7238 / fork 936；仓级 license 字段为空；最后 push 2026-09-28T17:08:10Z；创建 2026-03-04；组织（OpenAI）。Superpowers README 点名它是 Codex App / Codex CLI 的官方安装通道。
- https://github.com/xai-org/plugin-marketplace —— star 271 / fork 634；license 字段为空；最后 push 2026-09-29T17:33:56Z；创建 2026-05-15；组织（xAI）。Superpowers 经它分发 `superpowers@xai-official`。
- 判别价值：**谱系关键**。把 pstack 的「上游 = 厂商官方插件仓子目录」从孤例还原成模式：Anthropic / Cursor / OpenAI / xAI 都有自己的官方插件仓，名家技能包被收编进厂商市场是本族的主要分发路径之一。

（另见 `sickn33/agentic-awesome-skills`，47097 star，自称 2400+ 技能并带 CLI + 本地 MCP + catalog；未深读，标注为未证实细节。）

---

## 10. 谱系与判别轴（本组的高层结论）

### 10.1 谱系三层

1. **厂商标准层**：`anthropics/skills` 定义形态与 spec（已迁至 agentskills.io），各 harness 厂商自建官方插件仓/marketplace（`cursor/plugins`、`openai/plugins`、`xai-org/plugin-marketplace`、`github/awesome-copilot`）。
2. **名家「风格 stack」层**：以个人工程判断为卖点的技能集——`pstack`（Lauren Tan，被 Cursor 收编进官方仓）、`mattpocock/skills`、`obra/superpowers`、`addyosmani/agent-skills`、`poteto/how`。这一层是**方法论立场的战场**：pstack 与 mattpocock 都反对「流程取代判断」，superpowers 则反过来把流程本身做成产品。
3. **分发与索引层**：`vercel-labs/skills`（npx skills，装文件）、`hesreallyhim/awesome-claude-code` 与 `VoltAgent/awesome-agent-skills`（人读索引）、`wshobson/agents` 与 `SuperClaude_Framework`（自带生成器/CLI 的 marketplace）。

### 10.2 pstack 上游之谜的结论

- 上游 = **`cursor/plugins` 的 `pstack/` 子目录**（作者 Lauren Tan，87/90 提交），分发 = **Cursor 内置插件市场 `/add-plugin pstack`**（marketplace 页标注 "Created by Cursor / Verified by Cursor"）。没有独立仓、没有官网文档站、没有私有仓。`poteto/pstack` 404 是事实而非改名。
- 六个已知移植仓各自锚定方式不同，但**全部锚在同一个上游 commit 粒度**（`cursor/plugins`），互相之间无依赖：mirror 型（backnotprop）、策略分叉型（michael-denyer，用 `forks.json` 声明分歧）、严格跟随型（ericlitman，钉 commit 且声明"不承诺即时更新"）、哈希见证型（Aqua-123、ScriptedAlchemy，用 `upstream.lock.json`/`UPSTREAM.json` + parity 报告）、自动同步型（shrimpwtf，每日 workflow 开 PR）。
- 上游版本 0.15.5（2026-09-30 实测），移植仓分别钉在 0.15.1 / 0.15.2 —— **滞后约 2 个 patch 是常态**，因为上游不发 release，只能盯 monorepo 的 main。

### 10.3 判别轴（harness 耦合度）

移植会残废的，是**点名了 harness 原语**的那一层；纯 markdown + references 层是可移植的。

- **重度耦合（Cursor 专有）**：pstack 的 `swarm` / `arena` / `setup-pstack` / `poteto-mode`。它依赖 `Task` 子代理参数（`subagent_type: generalPurpose`、`environment: "cloud"`、`cloud_base_branch`、`run_in_background`）、`~/.cursor/rules/*.mdc` 的 `alwaysApply` 规则文件、`AskQuestion` 工具、Cursor 模型 slug，并跨插件依赖 `cursor-team-kit`（`deslop`/`control-cli`/`control-ui`）与 Cursor 内置技能（`create-skill`、`babysit`）。移植者必须逐条翻译，这就是六个移植仓存在的原因。
- **中度耦合（Claude Code 专有）**：`disable-model-invocation` 的 user-invoked 语义、Skill tool 调用约定、SessionStart hooks（`brainmaxxing`）、`TodoWrite`、`.claude-plugin` marketplace、subagent markdown + `tools:` allowlist。
- **中度耦合（Codex 专有）**：`policy.allow_implicit_invocation`（`agents/openai.yaml`）、**技能正文 8 KB 硬上限**、TOML agent 格式、plugin manifest 的 `skills` 只接受单路径字符串（mattpocock ADR 0002 记录了这一点如何逼出「先不做 Codex 原生 plugin」的决策）。
- **可移植档**：只写「Call the Skill tool with X」这类中性调用（mattpocock 明文规范）、只依赖 SKILL.md + references（`anthropics/skills` 示例技能、`K-Dense-AI/scientific-agent-skills`、`vercel-labs/agent-skills`）；`obra/superpowers` 走第三条路——**为每个 harness 分别维护 plugin manifest 与测试目录**，用工程量换可移植性。
- **跨 harness 差异的权威量化材料**：`wshobson/agents` 的 `docs/harnesses.md` 能力矩阵（hooks / TodoWrite / 子代理工具 / 技能正文上限 / 工具名大小写 / 模型别名逐项对照）。

### 10.4 其他可复用的判别事实

- **内容与分发已解耦**：`npx skills`（skills.sh）成了本族的通用安装器，多份 README 把它当作 Codex/其他 harness 的正式安装路径。
- **许可谱系**：MIT（pstack 及其全部移植仓、mattpocock、superpowers、wshobson、VoltAgent、K-Dense、addyosmani、vercel-labs/skills）→ Apache-2.0（anthropics/skills 多数技能）→ 源可见非开源（anthropics 的 docx/pdf/pptx/xlsx）→ CC-BY-SA-4.0（trailofbits）→ CC BY-NC-ND 4.0（hesreallyhim，禁止商用与改作分发）→ 仓级 license 字段为空（anthropics/skills 仓级、vercel-labs/agent-skills、openai/plugins、xai-org/plugin-marketplace、poteto/verification-skill-example）。
- **索引类项目已工具化**：`hesreallyhim/awesome-claude-code` 用 Python 脚本 + issue 表单做条目治理，`VoltAgent/awesome-claude-code-subagents` 用赞助而非 PR 承接曝光。