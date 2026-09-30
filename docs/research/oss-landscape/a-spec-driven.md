# A 组：spec-driven 文档流水线家族 — 一手事实调研

调研日期：2026-09-30。star / fork / push 时间均为当日通过 `gh api repos/<owner>/<repo>` 实时取值。
所有"定位"句为 README 原文的忠实转述，非本报告原创。凡查不到的一律写「未证实」，不做推断填充。

---

## 0. 家族骨架（先给结论，再上明细）

这一族共享同一条骨架，可以用五个槽位描述；各家的分歧全部落在槽位的**取值**和**强制程度**上，而不是骨架本身：

| 槽位 | 含义 | 家族内的常见取值 |
|---|---|---|
| 真相源 | 谁说了算 | 仓库内 Markdown 规格文档（占绝对多数）/ 工单系统 / 代码本身 |
| 阶段流水线 | spec 到 code 的分段 | constitution -> specify -> plan -> tasks -> implement -> verify |
| 上下文注入 | 规格怎么进模型 | slash command / skill / plugin marketplace / MCP prompt / 独立 CLI |
| 停止条件 | 什么时候算完 | 显式 verify/accept/merge 门（强）vs "任务勾完即结束"（弱） |
| 形态 | 交付物 | prompt 包 / CLI / MCP server / 桌面 app / 商业套件 |

**真正的分歧轴只有三条**（不是五条）：

1. **强制门 vs 流体迭代**。spec-kit、spec-kitty、gsd 走 phase gate，阶段之间有硬门；OpenSpec、spectra-app 明确主张 "fluid not rigid / iterative not waterfall"，允许随时回改任意 artifact。
2. **代码是否可自动改**。多数工具止于"生成任务清单"，由人/agent 决定怎么改；spec-kitty、gsd-pi、ospec 进一步接管 worktree、并行派发、review/merge——从"文档流水线"变成"软件工厂"。
3. **谁是 owner**。企业（GitHub、Google）做的走生态中立 + 多 harness；个人/小团队做的往往绑定单一 harness（多数是 Claude Code）起步再扩散。

---

## 1. 血脉与争议专章：GSD 家族（gsd-build vs open-gsd）

这是本次调研中**唯一一个有公开争议与组织分家**的条目，且全部证据可在 GitHub 一手取得。

### 1.1 命名与仓库迁移链（每一跳都有 commit 或 redirect 实证）

| 阶段 | GitHub | npm | 时间 |
|---|---|---|---|
| 原始 | `gsd-build/get-shit-done` | `get-shit-done-cc` | 仓库建 2025-12-14 |
| 分家后中转名 | `open-gsd/get-shit-done-redux` | `get-shit-done-redux` | 2026-05-22 |
| 现名 | `open-gsd/gsd-core` | `@opengsd/gsd-core` | 2026-05-31 (v1.2.0) |
| 另一条线 | `gsd-build/gsd-2` -> `open-gsd/gsd-pi` | `gsd-pi` -> `@opengsd/gsd-pi` | 2026-05-22 |

实证：

- `open-gsd/get-shit-done-redux` 现在是 redirect，返回 `full_name = open-gsd/gsd-core`，`created_at` 两者同为 `2026-05-22T11:36:21Z`——即同一仓库改名，非新建。
- gsd-core 里有一条 commit：`chore: migrate references from gsd-build to open-gsd/get-shit-done-redux (#120) (#121)`（2026-05-22T16:28:16Z）。
  https://github.com/open-gsd/gsd-core
- gsd-build/get-shit-done 最后一条 commit 是 jeremymcs 的 `chore: point auto-close message to open-gsd/gsd-core`（2026-05-31），即**原组织自己配合了迁移**。
- `docs/RELEASE-NOTES-LEGACY.md` 原文确认包名谱系：`get-shit-done-cc` -> `@opengsd/get-shit-done-redux`（1.0.0 -> 1.42.x），再改名到 `@opengsd/gsd-core`（版本号重置回 1.0.0）。
  https://github.com/open-gsd/gsd-core/blob/main/docs/RELEASE-NOTES-LEGACY.md
- gsd-pi 把旧历史锁进 `refs/archive/pre-initial-main/2026-05-22:CHANGELOG.md`，README 明说 "starting a new development baseline at version 1.0.0"。
  https://github.com/open-gsd/gsd-pi/blob/main/docs/archive/legacy-release-history.md

**结论**：不是"gsd-build 与 open-gsd 两个组织互不相干各做一版"，而是**同一条线在 2026-05-22 整体搬到新组织并连续改名两次**。

### 1.2 为什么分家（fork 维护者自述，一手）

出处：`open-gsd/gsd-core` Discussion #109 "Welcome to GSD-Core — why the fork, what changed, what's next"，作者 `trek-e`，2026-05-22T14:05:44Z，署名自称 "trek-e, fork maintainer (not the original author)"。
https://github.com/open-gsd/gsd-core/discussions/109

原文可确认的部分（逐字要点）：

- 自 **2026-04-01** 起与原维护者 TÂCHES 失联（写作时约 7 周）。
- TÂCHES 的社交账号"看起来已删除或无法访问"。
- 与项目关联的 `$GSD` token 被公开指认为 rug-pull。
- 上游仓库 `gsd-build/get-shit-done` 仍在，但维护者不可达。

原文明确列为**无法确认**的部分（这点很重要，报告不应替它下结论）：

- 原维护者本人是否安全。
- TÂCHES 的 GitHub 账号是否仍在其本人控制下。
- rug-pull 是维护者本人所为、联合创始人退出，还是账号被接管。

同期另一帖 Discussion #1 "Picking up the Pieces"（2026-05-22T12:05:40Z，作者显示为 `ghost`）提供现场视角：作者自述"周五 5 月 22 日醒来发现……他们 'rug pulled' 了一切"、"我本人完全没有参与那个 token——我反对那一整片世界"、"最后一次和原创作者说话是 2026 年 4 月 1 日"。

### 1.3 争议另一面（照实记录）

- gsd-build/get-shit-done Issue #3897 "Rug Pull? What is this b.s.?"，2026-06-10 提出，用户 `unstatusthequo`，正文仅列三条外链（Reddit r/ClaudeAI 帖、ourcryptotalk 报道、open-gsd discussions/1）。**0 条评论**，state=closed。
  https://github.com/gsd-build/get-shit-done/issues/3897
- 该票引用的第三方报道（Our Crypto Talk, 2026-05-22 发布 / 05-24 更新）称：GSD Cloud 是 Bags Hackathon 头奖项目，创始人 Lex Christopherson（X 账号 `@official_taches`）删除 X 账号并卖出与社区创建的 Solana `$GSD` token 相关的持仓；文章同时写明 Christopherson "曾公开表示他本人没有创建或发行该 token"，且截至发稿 Bags 方面无回应、无执法介入、部分细节仍有争议。
  https://ourcryptotalk.com/news/bags-hackathon-winner-gsd-cloud-rug-pull
  （该报道属第三方媒体，本报告只记录其主张，不为其背书；Reddit 原帖本次未能抓取，标为未证实。）
- open-gsd 侧公开了一份自查报告：Discussion #119 "Security Audit Transparency Report (2026-05-22)"，结论为 "No confirmed active exfiltration payload in tracked source"，root 与 SDK 0 known vulns，安全测试 293/293 通过；同时列出 4 项发现（markdown 链接型恶意载荷未覆盖、依赖完整性漂移、secret-scan 排除治理不足、base64 扫描对非 UTF-8 场景不硬）并开了 #113-#118 跟进票。
  https://github.com/open-gsd/gsd-core/discussions/119
- 社区疑虑没有被完全消除：Discussion #262 "How do we know that get-shit-done-redux is safe and it will not end being a security issues further on?"（2026-05-25）。
  https://github.com/open-gsd/gsd-core/discussions/262
- 改名的第二个理由（非安全）：Discussion #473 "No More Looking Back, Moving Forward"（2026-05-29）原文称，改名是因为 "get-shit-done" 在 corporate 场合会触发 HR 顾虑，故改为 "Git. Ship. Done!"，保留缩写与命令。
  https://github.com/open-gsd/gsd-core/discussions/473

### 1.4 组织与人员

- `gsd-build` org：创建 2026-02-09，公开仓库 8 个，描述为空，公开成员列表为空（未公开）。
- `open-gsd` org：创建 **2026-05-22**（与分家同日），公开仓库 14 个，描述 "Most AI coding agents setups rot as the context window fills..."，公开成员 `jeremymcs`、`Solvely-Colin`。
- 关键人：
  - TÂCHES = GitHub `glittercowboy`，原名 Lex Christopherson（第三方报道口述；GitHub profile bio 为 "Music + Code"）。在旧仓与新仓**各 945 次 commit**（历史整体搬迁的旁证）。
  - `trek-e` = Tom Boucher，fork 维护者。旧仓 1435 次 commit，新仓 3735 次。
  - `jeremymcs` = Jeremy McSpadden，bio "CEO of Flux Labs - Developer on Open GSD"。
  - `Solvely-Colin` = Colin Johnson，bio 提及 "Founder of Solvely"。
- 近期活跃度（gsd-core 最近 100 次 commit 的作者分布）：Tom Boucher 46、sim 28，其余为社区贡献者；**glittercowboy 不在其中**。

---

## 2. 必查项目明细

### 2.1 github/spec-kit

- 仓库：https://github.com/spec-kit 对应 `github/spec-kit`（owner 类型 Organization，即 GitHub 官方）
- 一句话定位（README）："an open source toolkit that gives AI coding agents structured processes, reusable templates, and documented outcomes."
- 核心机制：三条**互相独立**的入口，不是三个必经阶段——
  - Spec-Driven Development（核心内置）：`/speckit-constitution` -> `/speckit-specify` -> `/speckit-plan` -> `/speckit-tasks` -> `/speckit-implement` -> `/speckit-converge`，之后 repeat `implement -> converge`。
  - Bug fixing（opt-in 扩展 `specify extension add bug`）：`/speckit-bug-assess` -> `-fix` -> `-test`。
  - Idea assessment（opt-in 扩展 `specify extension add assess`）：`/speckit-assess-intake` -> `-research` -> `-define` -> `-shape` -> `-decide`。
- 真相源：项目内 `.specify/` 下的 Markdown artifact（bug 报告落 `.specify/bugs/<slug>/`，评估落 `.specify/assessments/<slug>/`）。
- 停止条件与验证：SDD 循环以 `/speckit-converge` 报出 **Converged** 为终止；bug 流程以 verdict `verified` / `partial` / `failed` 收尾，README 原话 "Missing verification is not a successful fix."；评估流程以 `go` / `needs-clarification` / `kill` 收尾。
- 形态：Python CLI（`uv tool install specify-cli`，入口 `specify init`）+ agent skills；提供 extensions / presets / workflows / bundles 四类扩展面。
- 支持的 harness：README 明示以 GitHub Copilot 默认 skills 模式举例，改用 `--integration <key>` 换其他 agent；文档有 integrations reference 页。具体清单本次未逐一核对（未证实完整列表）。
- 数据：star **139,484**，fork 12,505，open issues 269，license **MIT**，最后 push **2026-09-29T16:06:07Z**，创建 2025-08-21，最新 release **v1.0.13 (2026-09-29)**。
- 维护状态：组织（GitHub 官方）。贡献者 `localden`、`mnriem`、`jawwad-ali` 等。**高度活跃**（release 与 push 均为调研前一日）。
- 来源：https://github.com/github/spec-kit ; https://github.github.com/spec-kit/

### 2.2 gsd-build/get-shit-done

- 仓库：https://github.com/gsd-build/get-shit-done
- 一句话定位（原始 README 描述字段）："A light-weight and powerful meta-prompting, context engineering and spec-driven development system for Claude Code by TÂCHES."
- 当前状态：**已归档（archived=true）**。README 已被替换为迁移公告"GSD Has Moved … The project now continues as **GSD Core** in the Open GSD repository"。
- 核心机制（历史）：`/gsd-new-project`、`/gsd-onboard` 起步，discuss -> plan -> execute -> verify -> ship 的 milestone/phase 循环。
- 数据：star **64,427**，fork 5,436，license MIT，最后 push **2026-05-31T17:46:54Z**，创建 2025-12-14，最后一个 release 是 `v1.43.0-rc2` (2026-05-17)。
- 维护状态：**冻结/归档**，只保留 redirect 与 auto-close action。历史贡献者：trek-e 1435、glittercowboy 945、Tibsfox 127、jeremymcs 68。
- 来源：https://github.com/gsd-build/get-shit-done

### 2.3 gsd-build/gsd-2

- 仓库：https://github.com/gsd-build/gsd-2
- 一句话定位（README 描述）："A powerful meta-prompting, context engineering and spec-driven development system that enables agents to work for long periods of time autonomously without losing track of the big picture"。
- 当前状态：README 已是迁移公告"GSD 2 Has Moved … continues as **GSD Pi** in the Open GSD repository"。注意：GitHub `archived` 字段仍为 `false`（2026-09-30 实测），与 README 表述不一致——照实记录。
- 数据：star **7,781**，fork 760，license MIT，最后 push **2026-05-22T23:08:59Z**（即分家当天），创建 2026-03-11。最后一个 release `v3.0.0` (2026-05-14)。
- 维护状态：**停止**。最后几条 commit 均为 jeremymcs 的 redirect 收尾工作。
- 来源：https://github.com/gsd-build/gsd-2

### 2.4 open-gsd/gsd-core

- 仓库：https://github.com/open-gsd/gsd-core（由 `open-gsd/get-shit-done-redux` 改名而来）
- 一句话定位（README）："A light-weight meta-prompting, context engineering, and spec-driven development system for Claude Code, OpenCode, Antigravity CLI, Kimi CLI, Kilo, Codex, Copilot, Cursor, Windsurf, and more."
- 核心机制：每 milestone 重复五步循环，逐 phase 推进——**Discuss -> Plan -> Execute -> Verify -> Ship**。入口命令 `/gsd-new-project`（绿地）、`/gsd-onboard`（棕地），另有 `/gsd-plan-phase`、`/gsd-mvp-phase`（vertical MVP slice，`--mvp`）、`/gsd:update` 等。安装器 `npx @opengsd/gsd-core@latest`，二进制名 `gsd-core`，工具子命令 `gsd-tools`。
- 真相源：仓库内结构化 artifact——`STATE.md`、`CONTEXT.md`、`ROADMAP.md`、`PLAN.md`、`SUMMARY.md`，以及 `.gsd/` 目录。
- 停止条件与验证：verify 步骤逐条走查已构建内容、生成 fix plan，之后才 ship（开 PR、archive phase）；README 明确 "verify step walks through what was built and generates fix plans before a phase is declared done"。
- 形态：npm 包 + 安装器 CLI + 跨 runtime 的 commands/skills 生成。
- 支持的 harness：Claude Code、OpenCode、Antigravity CLI、Kimi CLI、Kilo、Codex、Copilot、Cursor、Windsurf 等（README 明列）。
- 数据：star **10,028**（另一次实测 10,029，实时值取自 2026-09-30），fork 716，open issues 188，license MIT，最后 push **2026-09-30T08:03:17Z**，创建 2026-05-22，default branch 是 **`next`**（注意不是 main），最新 release `v1.15.0` (2026-09-26)。
- 维护状态：社区组织（open-gsd）。**高活跃**（调研当日仍在 push）。
- 来源：https://github.com/open-gsd/gsd-core

### 2.5 open-gsd/gsd-pi

- 仓库：https://github.com/open-gsd/gsd-pi
- 一句话定位（README）："GSD Pi is a local-first coding agent for planning, implementing, verifying, and tracking project work from the command line."
- 注意定位差异：与 gsd-core（给 Claude Code 等宿主做 meta-prompting 层）不同，gsd-pi 是**自带 terminal agent 的独立 CLI**（`gsd` 命令），另有 `gsd --web`。
- 核心机制：`gsd` 启动交互会话；会话内 `/gsd config`、`/gsd auto`、`/gsd quick "..."`、`/gsd status`；非交互入口 `gsd quick --output-format json "..."`。把工作拆成 **milestones -> slices -> tasks**，auto 模式自动 plan/implement/verify/advance。
- 真相源：`.gsd/` 下的本地项目状态——"local database with markdown projections for review"，含 requires、decisions、runtime notes、plans、summaries、validation evidence。
- 停止条件与验证：内含 verify 与 UAT 证据链（CHANGELOG 里可见 `uat_exec` 证据校验、`gsd_exec` 证据溯源、milestone validation 等机制）。
- 形态：npm 全局 CLI（`npx @opengsd/gsd-pi@latest`）+ TUI + 可选 web UI；带 native engine 与 extension 体系。
- 支持的 harness：自身即 harness，同时支持把 Claude Code、Cursor Agent 作为外部 CLI provider 接入（README 明列 `cursor-agent` provider 默认模型 `composer-2.5`）。
- 数据：star **1,272**，fork 110，open issues 99，license MIT，最后 push **2026-09-29T15:47:58Z**，创建 2026-05-22，最新 release `v1.20.1` (2026-09-18)。CHANGELOG 显示基线版本重开为 1.0.0。
- 维护状态：社区组织。**活跃**。
- 来源：https://github.com/open-gsd/gsd-pi

### 2.6 bmad-code-org/BMAD-METHOD

- 仓库：https://github.com/bmad-code-org/BMAD-METHOD
- 一句话定位（README）："Agile Ai Driven Development — turn an idea or change request into working software without giving up the thinking."
- 核心机制：一条 delivery loop——**Clarify -> Plan -> Build and verify -> Learn and adjust（回环到 Plan）**，"start anywhere"（小改动直接进 Build）。入口是 `bmad` hub skill + `bmad-build`，setup 走 `bmad setup`。模块化：BMad Method 本体 + Builder + Creative Intelligence Suite + Test Architect + Loop + Game Dev Studio。
- 真相源：briefs / specifications / architecture 等 artifact（README 称可"carry its briefs, specifications, and architecture into your existing delivery workflow"）；另用 `bmad status` 管版本与下一步。
- 停止条件与验证：right-sized process——小改动直达 Build，复杂工作按需加深；Test Architect 提供企业级测试层；BMad Loop 可"builds, verifies, and retros a whole epic unattended"。
- 形态：skills 包（`npx skills add bmad-code-org/BMAD-METHOD`）+ Claude Code plugin marketplace + Codex plugin marketplace。
- 支持的 harness：任何支持 skills 的 AI coding tool；另有 web bundles（Gemini Gems / ChatGPT Custom GPTs）做纯规划。
- 数据：star **53,654**，fork 6,046，open issues 42，license **MIT**（`src/license.spdx_id` 返回 NOASSERTION，但 LICENSE 文件正文是 MIT License, Copyright (c) 2025 BMad Code, LLC），最后 push **2026-09-29T12:49:45Z**，创建 2025-04-13，最新 release **v6.12.0 (2026-09-04)**。
- 维护状态：组织（BMad Code, LLC，名称与 BMAD-METHOD 为商标，见 TRADEMARK.md）；有商业赞助通道但无付费门槛。主要贡献者 `alexeyv`、`bmadcode`、`muratkeremozcan` 等。**活跃**。
- 来源：https://github.com/bmad-code-org/BMAD-METHOD ; https://docs.bmad-method.org/

### 2.7 buildermethods/agent-os

- 仓库：https://github.com/buildermethods/agent-os
- 一句话定位（README）："Agent OS helps you shape better specs, keeps agents aligned in a lightweight system that fits how you already build."（GitHub 描述字段："a system for injecting your codebase standards and writing better specs for spec-driven development"）
- 核心机制：四大能力——**Discover Standards**（从代码库抽取约定）/ **Deploy Standards**（按正在构建的内容注入相关 standards）/ **Shape Spec**（生成更好的计划）/ **Index Standards**。v3 新增命令 `/discover-standards` 等。
- 真相源：抽取出的 standards 文档 + spec 文档；v3 把 spec 目录结构拆分为 `commands/agent-os/` 下的薄入口。
- 停止条件与验证：未在 README 给出显式验收门（未证实）。
- 形态：prompt/规则包，带 shell 安装脚本（`project-install.sh`，macOS 兼容性在 CHANGELOG 有专门修复）。
- 支持的 harness：Claude Code、Cursor、Antigravity 及其他 AI 工具（README 明列）。
- **重要的自我重定位**：CHANGELOG v3.0（2026-01-20）原文说明 v3 "refocuses the framework on what it does best—establishing and injecting standards—while deferring to modern AI tools for the parts they now handle better"，明确把 spec writing 让给 Plan mode、task breakdown 让给工具内置 todo、implementation orchestration 让给前沿模型。这是本族内**唯一一个主动收缩范围**的项目。
- 数据：star **5,458**，fork 833，open issues 2，license MIT，最后 push **2026-08-29T15:11:00Z**，创建 2025-07-16，最新 release **v3.0.0 (2026-01-20)**。
- 维护状态：Brian Casel / Builder Methods（组织账号，实为个人课程品牌）。8 个月无 release，最后 push 约一个月前，**低活跃/维持态**。
- 来源：https://github.com/buildermethods/agent-os ; https://buildermethods.com/agent-os

### 2.8 Fission-AI/OpenSpec

- 仓库：https://github.com/Fission-AI/OpenSpec
- 一句话定位（README）："Spec-driven development (SDD) for AI coding assistants."；README 自陈哲学 "fluid not rigid / iterative not waterfall / easy not complex / built for brownfield not just greenfield / scalable from personal projects to enterprises"。
- 核心机制：新工作流 **`/opsx:propose "idea"` -> `/opsx:apply` -> `/opsx:archive`**；另有 `/opsx:explore`（无风险思考伙伴，先读代码再出方案）。扩展 profile 提供 `/opsx:new`、`/opsx:continue`、`/opsx:ff`、`/opsx:verify`、`/opsx:bulk-archive`、`/opsx:onboard`。
- 真相源：项目内 `openspec/` 目录——每个 change 一个文件夹，含 `proposal.md`（why/what）、`specs/`（requirements + scenarios，用 WHEN/THEN 场景描述）、`design.md`、`tasks.md`；archive 落 `openspec/changes/archive/<date>-<name>/`。另有 beta 的 **Stores**：把 `openspec/` 放到独立 repo 里，跨 repo 共享规格。
- 停止条件与验证：`/opsx:archive` 把完成的 change 归档并把 spec 变更合并回主 specs。**这是本族里门禁最弱的一家**——README 原话 "update any artifact anytime, no rigid phase gates"。
- 形态：npm 全局 CLI（`@fission-ai/openspec`，入口 `openspec init` / `openspec update` / `openspec config profile`）+ Homebrew formula + 30+ 工具的 slash command/skill 生成。README 明示 `openspec` 本身是"用 OpenSpec 构建的"，仓库内有 live specs 与 changes 作为实例。
- 支持的 harness：30+ 工具，README 给出调用语法差异——`/opsx-propose`（Cursor、GitHub Copilot）、`@opsx-propose`（Amazon Q）、`$openspec-propose`（Codex）。
- 数据：star **70,738**（另一次实测 70,739），fork 4,854，open issues 176，license MIT，最后 push **2026-09-29T21:55:39Z**，创建 2025-08-05，最新 release **v1.13.2 (2026-09-23)**。
- 维护状态：组织（Fission，作者 `TabishB` = X 上的 `@0xTab`；核心贡献者 `clay-good`）。**高活跃**。默认开启匿名遥测（只收命令名与版本），可用 `openspec config set telemetry.enabled false` 关闭。
- 横向对比（README 自述，非本报告判断）：vs spec-kit "Thorough but heavyweight. Rigid phase gates, lots of Markdown, Python setup"；vs AWS Kiro "locked into their IDE and limited to Claude models"。
- 来源：https://github.com/Fission-AI/OpenSpec ; https://openspec.dev/

### 2.9 gemini-cli-extensions/conductor

- 仓库：https://github.com/gemini-cli-extensions/conductor
- 一句话定位（README）："A plugin for AI coding agents (including Antigravity and Claude Code) that enables Spec-Driven Development. It turns your agent into a proactive project manager that follows a strict protocol to specify, plan, and implement software features and bug fixes."
- 核心机制：三段生命周期 **Context -> Spec & Plan -> Implement**，命令为 `/conductor:conductor-setup`（每项目一次）-> `/conductor:conductor-new-track` -> `/conductor:conductor-implement`，另 `/conductor:conductor-status`、`-revert`、`-review`。单位是 **track**（feature 或 bug 的高层工作单元）。
- 真相源：项目根 `conductor/` 目录——`product.md`、`product-guidelines.md`、`tech-stack.md`、`workflow.md`、`code_styleguides/`、`tracks.md`，每 track 一个 `conductor/tracks/<track_id>/{spec.md, plan.md, metadata.json}`。
- 停止条件与验证：implement 逐项勾 `plan.md` 的 task；`/conductor:conductor-review` 对照 guidelines 与 plan 审计并执行测试，把 `Review Fixes` 追加成 plan.md 的一个 phase；`/conductor:conductor-revert` 按 track/phase/task 粒度回滚 git 历史（"git-aware revert that understands logical units of work rather than just commit hashes"）。
- 形态：agent plugin（`agy plugins install <url>` for Antigravity；`/plugin marketplace add` + `/plugin install conductor` for Claude Code）。仓库结构只有 `skills/`（每个命令一份 SKILL.md）与 `rules/`（平台特定规则）。
- 支持 harness：Antigravity、Claude Code。README 提到内置 "View Layer UX Adapter"：支持可视 IDE 时走 GUI modal，纯终端时自动降级为 `[1] Option A` 式文本菜单。
- 血缘（README 自陈）："The team gratefully acknowledges Keith Ballinger's original [.conductor](https://github.com/keithballinger/.conductor) project as the groundwork for this repository."
- 数据：star **3,750**，fork 299，open issues 79，license **Apache-2.0**，最后 push **2026-09-01T22:58:24Z**，创建 2025-12-17，最新 release `conductor-v0.4.1`（GitHub releases 上日期为 2026-03-11，而 push 到 9 月——release 与 push 明显脱节）。
- 维护状态：组织（gemini-cli-extensions，Google 旗下的 Gemini CLI 扩展组织，65 个公开仓库）。贡献者含 `moisgobg`、`sherzat3`、`hminooei`、`google-conductor-bot`。**中度活跃**。
- 来源：https://github.com/gemini-cli-extensions/conductor

### 2.10 Pimzino/spec-workflow-mcp

- 仓库：https://github.com/Pimzino/spec-workflow-mcp
- 一句话定位（README）："A Model Context Protocol (MCP) server for structured spec-driven development with real-time dashboard and VSCode extension."
- **README 顶部有一条维护者公告**（逐字）："I HAVE TAKEN A SMALL BREAK FROM THIS REPO FOR PERSONAL REASONS BUT I WILL BE BACK WITH SOME UPDATES IN THE NEAR FUTURE"。
- 核心机制：顺序化 spec 创建 **Requirements -> Design -> Tasks**，再用 "Execute task 1.2 in spec user-auth" 这类自然语言驱动任务执行；配套 MCP **approval workflow**（创建文档 -> 经 dashboard 请求批准 -> 反馈 -> 跟踪 revision）。
- 真相源：项目内 `.spec-workflow/` 目录——`approvals/`、`archive/`、`specs/`、`steering/`、`templates/`、`user-templates/`、`config.example.toml`。
- 停止条件与验证：内置 approval 门（文档必须经 dashboard 批准才能进入下一步）+ task progress tracking + implementation logs。
- 形态：**MCP server**（`npx @pimzino/spec-workflow-mcp@latest <project-path>`），是本族里最纯粹的 MCP 形态；另配 web dashboard（默认 5000 端口）+ VSCode 扩展（marketplace 上架）+ Docker 部署。
- 支持的 harness：任何 MCP client——Claude Code、Claude Desktop、Cursor、Cline/Claude Dev、Continue、Windsurf、Codex（`~/.codex/config.toml`）、OpenCode、Augment Code；VSCode 用户走扩展。README 给出 11 种语言的文档与界面。
- 安全设计：默认绑 `127.0.0.1`、限流 120 req/min、结构化 JSON 审计日志、安全响应头、CORS 限制、Docker 非 root + 只读文件系统；明确列出未实现项（HTTPS/TLS、用户认证），建议反代。
- 数据：star **4,297**，fork 357，open issues 11，license **GPL-3.0**，最后 push **2026-07-03T19:19:12Z**，创建 2025-08-07，**GitHub 上无 release**（npm 上另有版本，本次未单独核实）。
- 维护状态：个人（User `Pimzino`，30 个公开仓库）。**低活跃且维护者自述暂停**。
- 同作者前作：`Pimzino/claude-code-spec-workflow`（见 §3.1）。
- 来源：https://github.com/Pimzino/spec-workflow-mcp

### 2.11 spec-kitty/spec-kitty

- 仓库：https://github.com/spec-kitty/spec-kitty
- 一句话定位（README）："Spec-driven development for AI coding agents, multi-agent workflows, and governed software factories."；副标 "Specs tell AI agents what to build; Charter governs how they build it."
- 核心机制：`spec -> plan -> tasks -> next -> review -> accept -> merge`，命令 `/spec-kitty.charter`、`/spec-kitty.specify`、`/spec-kitty.plan`、`/spec-kitty.tasks`，然后 `spec-kitty next --agent <agent> --mission <slug>` 由 runtime 决定下一步；收尾 `/spec-kitty.review` -> `/spec-kitty.accept` -> `/spec-kitty.merge --push`。工作单元叫 **mission**，内部拆 **work package**，生命周期 lane 为 `planned` / `in_progress` / `for_review` / `approved` / `done`。治理入口 `spec-kitty dispatch "<request>"`。
- 真相源：仓库内 `kitty-specs/` 下的 mission artifact + `.kittify/config.yaml` 的 charter。README 原话："the repository remains the source of truth"。执行隔离用 `.worktrees/` 下的 git worktree。
- 停止条件与验证：显式门链——**review -> accept -> merge**，加 retrospective gate（每次完成的 mission 默认生成 `retrospective.yaml`）。README 明确反对默认黑盒："deliberately not a lights-out black box by default"。
- 形态：Python CLI（PyPI `spec-kitty-cli`，`pipx install spec-kitty-cli` 为首选安装方式）+ slash command/skill 生成 + 可选本地 kanban dashboard（`spec-kitty dashboard`）+ 可选 hosted sync/tracker（未上线的 opt-in 能力，README 里有 launch-readiness 与 hosted-readiness 文档）。
- 支持的 harness：Claude Code、Codex、Cursor、Gemini、GitHub Copilot、OpenCode、Qwen、Windsurf、Kiro、Vibe、Pi、Letta、llxprt（README 明列，另有 `docs/api/supported-agents.md`）。
- 版本状态：`main` 分支承载 **4.x RC 线**，最新 release 为 `v4.0.0rc4`；README 明确 "This prerelease is for qualification; stable launch acceptance remains pending."
- 数据：star **1,653**，fork 177，license **MIT**（LICENSE 正文 "Copyright (c) 2026 Spec Kitty, Inc."），最后 push **2026-09-30T09:36:43Z**，创建 2025-10-09，`fork=false`。
- **open issues 高达 913**，且 issue 时间戳密集在调研当日（2026-09-30 09:15–09:37 之间多条）——典型的高吞吐开发 + 大量由 agent 自动开票的仓库形态，不代表项目停摆，但需在报告中区别标注。
- 血缘：README 只说 "inspired by spec-driven development workflows"，**未声称**是 spec-kit 的 fork 或衍生；GitHub 层面对 `spec-kitty/spec-kitty` 的 `fork` 字段为 false。因此与 GitHub spec-kit 的具体血缘关系**未证实**。（注：贡献者列表中出现 `localden`，与 spec-kit 维护者 handle 相同，但仅凭此不足以断言关系，不做推断。）
- 维护状态：组织（Spec Kitty, Inc.）。主要贡献者 `robertDouglass`、`stijn-dejongh`。**高活跃**。
- 来源：https://github.com/spec-kitty/spec-kitty ; https://spec-kitty.ai

### 2.12 maxritter/pilot-shell

- 仓库：https://github.com/maxritter/pilot-shell
- 一句话定位（README）："Professional context and harness engineering around the coding agents you already use. Persistent knowledge. Enforced quality. Runtime proof."
- 核心机制：自定位为 "harness engineering system—not a collection of rules and skills"。三条**平权路径**：直接请求 / agent 原生 Plan/Goal 工具 / Pilot workflows。结构化工作流四个：`/spec`（先批任务再实现）、`/build`（定义 acceptance criteria，分轮构建，独立 judge 把 gap 变成下一轮）、`/fix`（复现缺陷 -> 写 RED 测试 -> 修根因 -> 跑质量门 -> 审计）、`/prd`。另有 `/investigate`、`/cleanup`、`/setup-rules`、`/create-skill`、`/benchmark`。
- 真相源：项目 `docs/` 下的 durable 文件——requirements、plans、buildouts、tasks、criteria、verification evidence。
- 停止条件与验证：**stop guards**——"keep the workflow open until the obligations pass or are reported unresolved"；另有 hooks、独立 review、全量 test/build gate、浏览器与设备级 runtime verification 组成证据链。
- 形态：shell 安装脚本（`curl … install.sh | bash`）+ 本地 Console（`localhost:41777`）+ 状态栏 + hooks + managed skills/rules/agents + MCP 集成。**带商业授权**。
- 支持的 harness：**Claude Code（primary，full feature coverage）** 与 **Codex**（Codex CLI 或 ChatGPT 桌面版捆绑的 Codex 二进制；"all workflows, fewer platform features"）。
- **License 是本次调研中最需要注意的一条**：`src/license.spdx_id` 返回 NOASSERTION，LICENSE 正文是自订的 **"PILOT SHELL SOFTWARE LICENSE AGREEMENT"**——"Copyright (C) 2026 Max Ritter (@maxritter). All rights reserved."，授权**以 active paid Subscription 为前提**（"License Key"、"Subscription"、"revocable license"），并限制 Derivative Work。README 也出现 `pilot activate <license-key>` 与 Polar 会员区链接。**因此它是 source-available 商业软件，不是 open source。**
- 数据：star **2,080**，fork 179，open issues 0，最后 push **2026-09-29T12:17:10Z**，创建 2025-10-18，最新 release **v11.0.6 (2026-09-29)**。
- 维护状态：个人（Max Ritter，德国资深 IT freelance，51 个公开仓库），有付费支持渠道。**高活跃**（release 与 push 均在调研前一日）。
- 来源：https://github.com/maxritter/pilot-shell ; https://pilot-shell.com

---

## 3. 额外发现（本次搜索自主补充，非用户点名）

搜索口径：`gh search repos` 跑 "spec-driven development"、"spec driven development"、"spec-driven agents"、"SDD agent"、"spec driven ai coding" 五组关键词按 star 排序取前 25，人工剔除不同族者（见 §4）。以下 8 个被判定为同族且值得单列。

### 3.1 Pimzino/claude-code-spec-workflow（额外发现）

- https://github.com/Pimzino/claude-code-spec-workflow
- 定位："Automated workflows for Claude Code. Features spec-driven development for new features (Requirements -> Design -> Tasks -> Implementation) and streamlined bug fix workflow (Report -> Analyze -> Fix -> Verify)."
- 与 §2.10 的关系：README 顶部横幅指向其继任者——"View the new Spec Workflow MCP"，即同作者的 claude-code-spec-workflow 是 spec-workflow-mcp 的前身。
- 机制：10 条 slash command（5 spec + 5 bug fix），核心 `/spec-create <feature-name> "desc"` 一条命令跑完整流程，另有 `/spec-steering-setup`（生成 product.md / tech.md / structure.md）、`/spec-execute <task-id>`、`/spec-status`、`/spec-list`，并自动为每个 task 生成 `/task-<id>` 式命令。
- 数据：star **3,860**，fork 280，license MIT，最后 push **2025-09-07T14:14:52Z**，创建 2025-07-18。**已停止维护**（约一年前）。
- 维护状态：个人。**冻结**。

### 3.2 Gentleman-Programming/gentle-ai（额外发现）

- https://github.com/Gentleman-Programming/gentle-ai
- 定位（README 描述字段）："Gentle-AI configures the AI coding agents you already use: Claude Code, Cursor, OpenCode, Codex, Pi, and more. Choose persistent memory, Organic-Driven Development, curated skills, MCP servers, personas, and optional bounded review. Open source, no agent lock-in."
- 机制：安装器 `gentle-ai install` 检测已装工具、安装全部 skills、配置 MCP servers、注入 **SDD orchestrator**，并搭建 Engram 持久记忆。继承自 agent-teams-lite 的 "SDD orchestration (9 phases + judgment-day)" 与 skill registry + compact rules。
- 数据：star **7,408**，license MIT，最后 push **2026-09-30T08:12:00Z**，创建 2026-02-27，最新 release **v3.7.0 (2026-09-23)**。
- 维护状态：组织（Gentleman Programming）。**高活跃**。
- 相关（次要）：前身 `Gentleman-Programming/agent-teams-lite`（star 1,244，Apache-2.0，**已归档**，README 完整写明 "deprecated in favor of gentle-ai"，理由是"维护 shell 脚本与 Go 二进制两条分发通道做不到 feature parity"）。

### 3.3 kaochenlong/spectra-app（额外发现）

- https://github.com/kaochenlong/spectra-app
- 定位："Spec-driven development for coding agents — a desktop app, a CLI, and skills for Codex, Claude Code, Cursor, Copilot, Antigravity and Junie."
- 血缘（README 自陈，重要）："Spectra was inspired by [OpenSpec]. It started as a GUI frontend for OpenSpec, but after using it for a while, I found that OpenSpec's workflow didn't quite match my own development habits. So I decided to rewrite the entire workflow"——即**从 OpenSpec 的 GUI 前端演化为一套重写的工作流**。
- 机制：skill 集按阶段分组——Plan：`/spectra-discuss`、`/spectra-propose`；Implement：`/spectra-apply`、`/spectra-ingest`；Quality gate：`/spectra-verify`、`/spectra-review`、`/spectra-analyze`、`/spectra-audit`、`/spectra-drift`、`/spectra-debug`；Finish：`/spectra-archive`、`/spectra-commit`。Codex 用 `$` 前缀。另有 `spectra park <name>` / `spectra unpark <name>`（把进行中的 change 暂存而不污染 git working tree），以及 `/spectra-propose` 用 `[after: ...]` 记录任务依赖、`/spectra-apply` 把依赖已满足的任务交给 subagent 并行跑。
- 真相源：仓库内 change 目录（proposal / specs / design / tasks），app 侧解析 Markdown checklist 的 `- [ ]` / `- [x]` 做进度。
- 形态：**桌面 app**（Homebrew + 直接下载）+ CLI（npm）+ skills——本族里少见的桌面形态。
- 数据：star **747**，fork 32，license 为混合（LICENSE 正文："Spectra — Licensing / Copyright (c) 2026 5xCampus. All rights reserved. / This repository contains parts under different licenses."；spdx_id = NOASSERTION），最后 push **2026-09-13T05:40:13Z**，创建 2026-02-04，最新 release **v3.0.0 (2026-09-11)**。
- 维护状态：个人（`kaochenlong` = Eddie Kao 高見龍，五倍學院負責人，236 个公开仓库）。**中度活跃**。

### 3.4 shotgun-sh/shotgun（额外发现）

- https://github.com/shotgun-sh/shotgun
- 定位："Write codebase-aware specs for AI coding agents so they don't derail."
- 机制：一个 **TUI + Router**，用户只控制两种执行模式（`Shift+Tab` 切换）——**Planning**（默认，逐步展示计划并在跑改文件 agent 前要确认）与 **Drafting**（一口气跑完）。Router 内部固定走 **Research -> Specify -> Plan -> Tasks -> Export** 五段，由自带的 specialized sub-agents 执行，用户不手动选。
- 真相源：导出给 AI 的 spec 文档（可团队共享，"Share Specs with Your Team"一节），另有 codebase indexing 供 codebase-aware 规划。
- 停止条件与验证：无显式 accept/merge 门；末端是 **Export**（"Format for AI"）——即**止于交付 artifact，不接管实现**。
- 形态：Python CLI/TUI（`uvx shotgun-sh@latest`，Homebrew 亦可），是**交互式 TUI** 而非 slash command 包。
- 支持 harness：与工具无关——产出规格给"your AI coding agent"用。
- 数据：star **687**，fork 38，license MIT，最后 push **2026-06-02T01:07:26Z**，创建 2025-08-05，最新 release **0.13.0 (2026-04-14)**。
- 维护状态：组织（shotgun-sh）。**已明显降速**（3 个月无 push，5 个月无 release）。

### 3.5 tzachbon/smart-ralph（额外发现）

- https://github.com/tzachbon/smart-ralph
- 定位："Spec-driven development with smart compaction. Claude Code plugin combining Ralph Wiggum loop with structured specification workflow."
- 机制：把 **Ralph loop**（反复重跑直至完成）与结构化 spec 阶段缝合。命令 `/ralph-specum:start [name] [goal]`（可 `--quick` 一次生成全部 spec 阶段并开跑）、`/ralph-specum:new`、`:triage`（把大目标拆 epic）、`:research`、`:requirements` 等；Codex 侧用 `$ralph-specum-<name>`。
- 真相源：项目内 spec 文件，README 强调 "The spec files stay in the project, so you can review or edit each phase before..." 外加 **smart compaction**（上下文压缩）保活。
- 形态：Claude Code plugin（另有 `plugins/ralph-specum-codex` 子目录做 Codex 安装）。
- 支持 harness：Claude Code、Codex。
- 数据：star **552**，fork 49，license MIT，最后 push **2026-09-16T12:59:08Z**，创建 2026-01-11，最新 release **v4.0.0 (2026-02-20)**（release 与 push 脱节）。
- 维护状态：个人（`tzachbon`）。**中度活跃**。

### 3.6 zhu1090093659/spec_driven_develop（额外发现，中文生态）

- https://github.com/zhu1090093659/spec_driven_develop
- 定位："Spec-driven development workflow for AI coding agents: architecture-first planning, task decomposition, GitHub Issue/PR tracking, Deep Discuss, and adaptive control for Claude Code, Codex, Cursor, and other Markdown-capable agents."
- 机制：自称 **Orchestrator-Centric Execution / Skills-Only Surface**（v1.15 起），架构骨架叫 **S.U.P.E.R**；内置 **Deep Discuss**（结构化深聊）与 **Review SPD**（findings-first 代码审查）；v1.14 起有 **GitHub-Native Task Tracking and Batch PRs**（把 spec 映射到 GitHub issue/PR）；v1.10 起 **Adaptive Control**。
- 形态：skills 包（单 `SKILL.md` 可下载，跨 agent 通用）。
- 数据：star **979**，fork 101，license MIT，最后 push **2026-07-26T11:21:17Z**，创建 2026-03-21。
- 维护状态：个人。**中度活跃**（约 2 个月无 push）。

### 3.7 aiblueprinthq/ai-blueprint（额外发现）

- https://github.com/aiblueprinthq/ai-blueprint
- 定位："A file-backed, spec-driven AI coding workflow framework for building real software while staying in control."
- 机制：五条主命令 **`/feature -> /implement -> /check -> /audit current -> /complete`**，语义分别为选一个 build-plan 条目并写 spec（需人工批准）/ 小步实现 / 用运行中的应用证明 acceptance criteria / 审计整条分支 delta 并记录 findings / 跑最终 gate、归档、merge 前询问。另有 `/explore`、`/brief`、`fix`、`debug`、`rollback`、`check guide`。
- 真相源：仓库内 `blueprint/` 目录——用户自己拥有的 `project-plan.md` 与 `build-plan.md` 是规划输入，工具生成 `blueprint/context/{project-overview,current-feature,findings,review}.md`、`blueprint/history/`、`blueprint/config.json`；README 原话 "This state stays tool-independent."
- 停止条件与验证：区分三类证明——**Verify command**（项目自有 typecheck/test/build）、**Check**（可观测证据）、**Audit**（分支 delta 的 findings，带持久 ID、severity、status）。gate 策略默认 `manual`，独立 review 默认 `when-sensitive`。
- 形态：npm（`npx create-ai-blueprint@latest`）+ 可选全局 CLI（`blueprint dashboard`，本地只读 dashboard 绑 `127.0.0.1`）+ 多 agent adapter。README 提到会接入 GitHub checks 自动化。
- 数据：star **447**，fork 113，license MIT，最后 push **2026-09-24T12:15:31Z**，创建 2026-06-19，最新 release **v1.10.0 (2026-09-24)**。
- 维护状态：组织（aiblueprinthq）。**活跃**（新项目，三个月内到 v1.10）。

### 3.8 clawplays/ospec（额外发现）

- https://github.com/clawplays/ospec
- 定位："Spec-driven, agentic workflow framework for AI coding agents. Turn a request into a verifiable goal loop — plan, act, verify — with durable specs and evidence in your repo."
- 机制：三步——`ospec init .` -> create and advance a change -> archive after acceptance。经典 change 流程为 `proposal.md -> tasks.md -> implement -> verification.md -> review.md`，"with no controller layer"。需要更强控制时升级到 **goal workflow**（`ospec goal`），带 agent controller：`ospec execute dispatch/launch/complete/verify`、`ospec loop tick`（原子绑定 reviewer executor 发 task/final review）。
- 真相源：仓库内 `.ospec/changes/active/<name>/`（archive 落 `.ospec/changes/archived/YYYY-MM/YYYY-MM-DD/`），项目文档语言持久化在 `.skillrc`。
- 停止条件与验证：`ospec verify` -> `ospec finalize`；**force archive 永不自动**——需要 `--force-archive --confirm-force-archive <exact-change-name> --reason`，且归档会被标记为 `forced` / `incomplete` / `accepted-risk`，任何 issued/running 的 Loop item 都会让它拒绝执行。这是本族里**显式失败路径设计最完整**的一家。
- 形态：npm CLI（`ospec`）+ Claude/Codex skill 模式（`/ospec`、`/ospec-change`、`/ospec-goal`）+ MCP。
- 支持 harness：Claude Code、Codex、Gemini（`@generalist`）、OpenCode（`@mention`）；README 明说 "OSpec never starts Orca, Codex, Claude, or another agent CLI as a fallback. If the current model harness cannot provide native subagents, executable dispatch blocks until a supported harness reports a fresh capability."（宁阻塞不降级）
- 数据：star **453**，fork 25，license MIT，最后 push **2026-08-26T08:12:13Z**，创建 2026-03-31，最新 release **2.1.0 (2026-08-26)**。
- 维护状态：个人（`clawplays`）。**中度活跃**。

### 3.9 次要发现（一句话各记）

- `formulahendry/mcp-server-spec-driven-development`（star 438，MIT，最后 push 2025-09-26，**已停更**）：纯 MCP prompt server，三段 `generate-requirements`（EARS 格式）-> `generate-design-from-requirements` -> `generate-code-from-design`，真相源是 `specs/{requirements,design}.md`。是本族里最小、最"教科书式"的实现。https://github.com/formulahendry/mcp-server-spec-driven-development
- `Gentleman-Programming/agent-teams-lite`：见 §3.2，已归档。

---

## 4. 边界排除（明显不属于本族者，各一句理由）

| 项目 | star | 排除理由 |
|---|---|---|
| `cabloy/cabloy` | 977 | 是 Node.js fullstack 框架（2018 年建仓），SDD 只是它的附带叙事，本体不是 spec-driven 工作流工具。 |
| `dsifry/metaswarm` | 421 | 定位为 multi-agent orchestration framework（18 agents / 13 skills / 15 commands），spec-driven 只是其中一个卖点；主轴是多 agent 平台。 |
| `mouredev/hello-sdd` | 651 | 是西班牙语 SDD 教学课程，不是工具。 |
| `https-deeplearning-ai/sc-spec-driven-development-files` | 302 | DeepLearning.AI 课程配套材料，非工具。 |
| `loulanyue/spec-kit-zh` | 338 | spec-kit 的中文本地化衍生版，无独立机制创新，归入 spec-kit 条目影响面。 |
| `ThibautBaissac/rails_ai_agents` | 665 | Rails 专用 skills/agents 包，是栈特定的 prompt 集，不是通用 spec 流水线。 |
| `devoxx/DevoxxGenieIDEAPlugin` | 683 | IntelliJ IDEA 插件，属 IDE 集成层，本族边界外。 |
| `athola/claude-night-market` | 341 | 23 个杂类 Claude Code 插件集合，SDD 只是其中一项。 |
| `JuliusBrussee/cavekit` | 1151 | 已自陈 "Frozen"，且开发已迁往别处，作为独立项目已终止。 |
| `Zacalot/openspec.el` | 9 | OpenSpec 的 Emacs 前端，属消费者而非同族项目。 |

关于"纯多 agent 平台"与"纯 SDD 工具"的分界线，本报告采用的可操作判据是：**仓库是否把"规格 artifact 是真相源、且流水线围绕该 artifact 组织"作为主要卖点**。只把 spec 当可选输入的编排框架（metaswarm 类）不计入。

---

## 5. 未证实清单（不猜）

1. **GSD rug-pull 的最终事实归属**：是维护者本人、联合创始人退出还是账号接管——fork 维护者在 Discussion #109 中自己列明"无法确认"，本报告同样不下结论。
2. **Reddit 原帖内容**：`r/ClaudeAI` 那条帖（1tktl4w）本次未能抓取（Reddit 抓取通道当前不可用），仅由 Issue #3897 引用；其正文、票数、评论数均未核实。
3. **spec-kitty 与 github/spec-kit 的具体血缘**：仅确认 `fork=false` 且 README 未声称衍生；贡献者 handle 重合不足以作为证据。
4. **github/spec-kit 支持的 harness 完整清单**：README 只给示例与 integration reference 链接，未列出全部 key。
5. **buildermethods/agent-os 的停止条件/验证门**：README 与 CHANGELOG v3 均未给出显式验收机制。
6. **Pimzino/spec-workflow-mcp 的 npm 最新版本号**：GitHub 无 release，npm 侧本次未单独访问 registry 核实。
7. **各项目的 harness 支持深度**（"支持"与"全功能支持"的区别）：除 pilot-shell 明确区分 primary/secondary 外，其余仅记录 README 的列举，不推断成熟度。

---

## 6. 数据速查表（2026-09-30 实时取值）

| 项目 | star | license | 最后 push | 形态 | 停止条件强度 |
|---|---:|---|---|---|---|
| github/spec-kit | 139,484 | MIT | 2026-09-29 | CLI + skills | 强（converge 判据） |
| Fission-AI/OpenSpec | 70,738 | MIT | 2026-09-29 | CLI + skills | 弱（无硬门） |
| gsd-build/get-shit-done | 64,427 | MIT | 2026-05-31 | 已归档 | — |
| bmad-code-org/BMAD-METHOD | 53,654 | MIT | 2026-09-29 | skills + plugin | 中（右尺寸） |
| open-gsd/gsd-core | 10,028 | MIT | 2026-09-30 | npm + skills | 强（verify/ship） |
| gsd-build/gsd-2 | 7,781 | MIT | 2026-05-22 | 已迁移 | — |
| buildermethods/agent-os | 5,458 | MIT | 2026-08-29 | 规则包 | 未证实 |
| Pimzino/spec-workflow-mcp | 4,297 | GPL-3.0 | 2026-07-03 | MCP server | 强（approval 门） |
| gemini-cli-extensions/conductor | 3,750 | Apache-2.0 | 2026-09-01 | plugin | 中 |
| maxritter/pilot-shell | 2,080 | 商业自订 | 2026-09-29 | 商业套件 | 强（stop guards） |
| spec-kitty/spec-kitty | 1,653 | MIT | 2026-09-30 | Python CLI | 强（review/accept/merge） |
| open-gsd/gsd-pi | 1,272 | MIT | 2026-09-29 | 独立 CLI/TUI | 强 |
| Gentleman-Programming/gentle-ai | 7,408 | MIT | 2026-09-30 | CLI + skills | 中 |
| Pimzino/claude-code-spec-workflow | 3,860 | MIT | 2025-09-07 | 已冻结 | — |
| zhu1090093659/spec_driven_develop | 979 | MIT | 2026-07-26 | skills 包 | 中 |
| kaochenlong/spectra-app | 747 | 混合 | 2026-09-13 | 桌面 app + CLI | 中（verify 门） |
| shotgun-sh/shotgun | 687 | MIT | 2026-06-02 | TUI | 弱（止于 export） |
| tzachbon/smart-ralph | 552 | MIT | 2026-09-16 | CC plugin | 中 |
| clawplays/ospec | 453 | MIT | 2026-08-26 | CLI + MCP | 强（显式失败路径） |
| aiblueprinthq/ai-blueprint | 447 | MIT | 2026-09-24 | npm + adapter | 中（check/audit） |
| formulahendry/mcp-server-sdd | 438 | MIT | 2025-09-26 | MCP server | 弱 |
| Gentleman-Programming/agent-teams-lite | 1,244 | Apache-2.0 | 2026-03-26 | 已归档 | — |