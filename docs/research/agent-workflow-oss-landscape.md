# AI 编程 agent 工作流开源项目全景（2026-09-30 快照）

> 范围：「让 coding agent 干出可信的活」这件事被产品化出来的开源项目——规范流水线、技能库、自主循环、编排面板、隔离环境。
> 数据口径：所有 star / license / 最后 push 为 2026-09-30 经 `gh api` 实时取值；机制描述追到仓库 README、源码、Discussion 等一手来源，查不到的一律标「未证实」。
> 分层明细见附录：`oss-landscape/a-spec-driven.md`（spec 流水线族 21 项）、`b-skills.md`（技能工具箱族）、`c-loops.md`（循环与执行器族 18 项）。本文是三份明细的合成视图。
> 入族判据：把「规格 / 技能 / 循环 / 隔离」中的至少一件做成可复用的产品形态。只把 spec 当可选输入的通用编排框架不计入。

## 0. 全景分层

同一件事被切成六个功能位置。项目跨层常见，归层看它**主要卖点**在哪。

| 层 | 解决的问题 | 代表项目（star，2026-09-30） |
|---|---|---|
| L0 标准与格式 | 指令与技能用什么格式写 | `agentsmd/agents.md`（24,694）、Agent Skills spec（已迁 agentskills.io）、`google-labs-code/design.md`（28,174）、`microsoft/SkillOpt`（17,891，技能自动优化器） |
| L1 技能内容 | 具体该怎么做工程 | `obra/superpowers`（293,197）、`mattpocock/skills`（272,454）、`anthropics/skills`（179,076）、`addyosmani/agent-skills`（100,010）、`K-Dense-AI/scientific-agent-skills`（47,177）、`wshobson/agents`（40,101）、`VoltAgent/awesome-claude-code-subagents`（25,414）、`SuperClaude_Framework`（23,910）、pstack（无独立仓，见 §2.3） |
| L1.5 分发与索引 | 技能怎么装、去哪找 | `vercel-labs/skills`（32,811，即 `npx skills`）、`hesreallyhim/awesome-claude-code`（54,833，索引）、`VoltAgent/awesome-agent-skills`（35,052，索引）、`github/awesome-copilot`(39,527)、厂商官方仓 `cursor/plugins`(9,064) / `openai/plugins`(7,238) / `xai-org/plugin-marketplace`(271) |
| L2 规格与任务流水线 | 需求如何变成可执行的规格与工单 | `github/spec-kit`（139,484）、`Fission-AI/OpenSpec`（70,738）、`bmad-code-org/BMAD-METHOD`（53,654）、GSD 系（见 §2.2）、`eyaltoledano/claude-task-master`（28,112）、`automazeio/ccpm`（8,395）、`MrLesk/Backlog.md`（6,901）、`buildermethods/agent-os`（5,458）、`Pimzino/spec-workflow-mcp`（4,297）、`gemini-cli-extensions/conductor`（3,750）、`spec-kitty/spec-kitty`（1,653）、`maxritter/pilot-shell`（2,080，商业授权） |
| L3 循环执行 | 怎么让 agent 自己跑到完 | `snarktank/ralph`（21,887）及其变体族（ralphex 1,487 / open-ralph-wiggum 1,895 / continuous-claude 1,382 / ralph-loop-agent 839 / gemini ralph 332 / PageAI ralph-loop 309 / smart-ralph 552）、`EveryInc/compound-engineering-plugin`（25,339，`/lfg` 全自动入口） |
| L4 编排与人界面 | 人怎么同时盯 N 个 agent | `ruvnet/ruflo`（73,551，原名 claude-flow）、`BloopAI/vibe-kanban`（28,220，正在关停）、`smtg-ai/claude-squad`（8,550）、`yohey-w/multi-agent-shogun`（1,424）、`kingbootoshi/codex-orchestrator`（351） |
| L5 环境与隔离 | 并行怎么不互相踩 | `dagger/container-use`（4,052）、`humanlayer/agentcontrolplane`（490，已停更）、git worktree 用法（分散在各家文档里） |

## 1. 判别轴：真正把项目分开的三个问题

下面的分层是表象；分歧全部落在三个问题上。

### 轴 A — 谁判定「做完了」

按判定主体从机械到人化排列。这是最锋利的一刀：**宣称「跑完」与实际判据经常不一致**。

| 判定主体 | 项目 | 判据细节 |
|---|---|---|
| 工具实际执行外部谓词 | `umputun/ralphex` | 人在 plan 文件里写 `go test ./...`，工具每任务后真的跑它 |
| 谓词暴露成 API | `vercel-labs/ralph-loop-agent` | `verifyCompletion` 由调用方提供 + iterations/tokens/cost 三重预算 |
| CI 门 + 授权门 | `AnandChowdhary/continuous-claude`、`EveryInc/compound-engineering-plugin` | `gh pr checks` 驱动 merge；后者「不授权不 merge」，repair budget 用尽可带 leftovers 收工 |
| 模型自报 token | `snarktank/ralph`、`open-ralph-wiggum`、`gemini-cli-extensions/ralph`、PageAI `ralph-loop`、`claude-task-master` | 读 stdout 里约定的 `<promise>COMPLETE</promise>` / `DONE` / structured markers |
| 人确认 | `ccpm`、`vibe-kanban`、`claude-squad`、`Backlog.md`、`multi-agent-shogun`、`codex-orchestrator`、spec 流水线全家 | review / accept / merge 全由人触发 |
| 不适用 / 未证实 | `container-use`（环境层）、`ruvnet/ruflo`（未证实存在终止谓词） | — |

`snarktank/ralph` 是这条轴的标本：README 写「until all PRD items are complete」，`ralph.sh` 实际判的是 `grep -q "<promise>COMPLETE</promise>"`；连 `prd.json` 里的 `passes: true` 也是 agent 自己写的。18 个项目里只有 ralphex 把「测试命令由工具执行」做完整。多数 L1 的停止条件是**模型自报完工，代码库状态从未被独立检查**。

### 轴 B — harness 耦合度

决定一个技能包能不能换宿主用。差异的权威量化材料是 `wshobson/agents` 的 `docs/harnesses.md` 能力矩阵。

| 耦合档 | 独占原语（举例） | 后果 |
|---|---|---|
| 重度（Cursor 专有） | pstack 的 `swarm`/`arena` 依赖 `Task` 的 `environment: "cloud"`、`cloud_base_branch`、`run_in_background`、`~/.cursor/rules/*.mdc`、`AskQuestion`、Cursor 模型 slug，并跨插件依赖 `cursor-team-kit` | 换宿主必须逐条翻译，这就是六个 pstack 移植仓存在的原因 |
| 中度（Claude Code 专有） | `disable-model-invocation` 的 user-invoked 语义、SessionStart hooks、`TodoWrite`、subagent markdown + `tools:` 白名单 | 移植要重写接线 |
| 中度（Codex 专有） | 技能正文 **8 KB 硬上限**、TOML agent 格式、plugin manifest 的 `skills` 只接受单路径字符串 | `mattpocock/skills` 的 ADR 0002 记录了这个限制如何逼出「先不做 Codex 原生插件」 |
| 可移植 | 只写「Call the Skill tool with X」这类中性调用，只依赖 SKILL.md + references | `anthropics/skills` 示例、`K-Dense-AI/scientific-agent-skills`（168 技能，显式按 Agent Skills 标准写） |

第三条路是 `obra/superpowers`：为 16 个 harness 分别维护 plugin manifest 与测试目录，用工程量换可移植性。

### 轴 C — 强制门 vs 流体，以及是否接管实现

- **硬阶段门**：`spec-kit`（converge 报 Converged 才收）、`spec-kitty`（review → accept → merge + retrospective gate）、GSD（verify 生成 fix plan 才 ship）、`spec-workflow-mcp`（文档必须经 dashboard 批准）。
- **明确反门**：`OpenSpec` 写明「update any artifact anytime, no rigid phase gates」；`shotgun` 止于 Export，不接管实现。
- **从文档流水线升级成软件工厂**：`spec-kitty`、`open-gsd/gsd-pi`、`clawplays/ospec` 进一步管 worktree、并行派发、review/merge。`ospec` 的失败路径设计最完整——force archive 永不自动，需 `--force-archive --confirm-force-archive <名字> --reason`，且会被标记 forced/incomplete/accepted-risk。
- **主动收缩**：`buildermethods/agent-os` v3（2026-01-20）把 spec writing 让给 Plan mode、任务拆解让给内置 todo、编排让给前沿模型，只保留「抽取并注入代码库标准」。这是全族唯一自认范围收缩的项目。

## 2. 被点名的四个项目，各自的真实位置

### 2.1 github/spec-kit — L2，生态中立的重流程标杆

MIT、Python、139,484 star、v1.0.13（2026-09-29）。三条**互相独立**的入口而非必经阶段：SDD 主链 `/speckit-constitution → specify → plan → tasks → implement → converge`（之后重复 implement → converge）；bug 扩展 `-assess → -fix → -test`；idea 评估扩展 `-intake → -research → -define → -shape → -decide`。真相源是 `.specify/` 下的 Markdown。停止条件最硬：`/speckit-converge` 报 Converged；bug 流程以 `verified`/`partial`/`failed` 收尾，README 原话「Missing verification is not a successful fix」。

### 2.2 open-gsd/gsd-core — L2，一条搬迁过两次名字的线

用户给的 `open-gsd/gsd-core`（10,028 star，MIT，2026-09-30 仍在 push，默认分支是 `next` 而非 main）不是独立项目，而是同一条线在 **2026-05-22 整体搬到新组织**后的现名：

| 阶段 | GitHub | npm | 时间 |
|---|---|---|---|
| 原始 | `gsd-build/get-shit-done`（64,427 star，**已归档**） | `get-shit-done-cc` | 建仓 2025-12-14 |
| 中转 | `open-gsd/get-shit-done-redux` | `get-shit-done-redux` | 2026-05-22 |
| 现名 | `open-gsd/gsd-core` | `@opengsd/gsd-core` | 2026-05-31（v1.2.0） |
| 另一条线 | `gsd-build/gsd-2` → `open-gsd/gsd-pi`（1,272 star，自带 terminal agent 的独立 CLI） | `gsd-pi` → `@opengsd/gsd-pi` | 2026-05-22 |

分家理由（fork 维护者 `trek-e` 在 Discussion #109 自述）：自 **2026-04-01** 起与原维护者 TÂCHES（GitHub `glittercowboy`）失联，其社交账号「看起来已删除或无法访问」，关联的 Solana `$GSD` token 被公开指认为 rug-pull。**同一帖里他明确列了无法确认的部分**——原维护者本人是否安全、账号是否仍在其控制下、rug-pull 是本人所为还是账号被接管。第三方报道（Our Crypto Talk，2026-05-22）另有说法，Reddit 原帖本次未能抓取。第二次改名的理由与安全无关：Discussion #473 称「get-shit-done」在企业场合触发 HR 顾虑，改为 "Git. Ship. Done!"，缩写与命令保留。

用法上，gsd-core 是给宿主做 meta-prompting 层（Claude Code / OpenCode / Cursor / Codex / Kimi / Kilo / Windsurf 等）：每 milestone 重复 **Discuss → Plan → Execute → Verify → Ship**，真相源是仓库内 `STATE.md` / `CONTEXT.md` / `ROADMAP.md` / `PLAN.md` / `SUMMARY.md` 与 `.gsd/`。

### 2.3 pstack — L1，上游不在它自己的仓里

`poteto/pstack` **不存在**（2026-09-30 实测 404，不是改名）。正本是 **Cursor 官方插件仓 `cursor/plugins` 的 `pstack/` 子目录**：90 条提交里 Lauren Tan 占 87 条，版本 0.15.5，MIT（`pstack/LICENSE` 首行 "Copyright (c) 2026 Lauren Tan"），分发走 Cursor 内置市场 `/add-plugin pstack`，marketplace 页标 "Created by Cursor / Verified by Cursor"。没有独立仓、没有官网文档站、没有私有仓。

规模：`pstack/skills/*/SKILL.md` 47 个 + `agents/` 2 个 subagent 定义 + `docs/guide/` 11 篇教程。入口是 `poteto-mode`（`mode: true` 粘性模式，`mode`/`icon`/`color`/`reminder` 是 Cursor 侧扩展字段），另有 23 个 `principle-*` 叶子原则。方法论立场（README 原文）：反 slop、「if you want to go fast, go deep first」、「fearless parallelism」（先能信任单个 agent 再并行）。

GitHub 上的六个移植仓全部锚同一上游、互相无依赖，锚定策略各异：镜像（`backnotprop/pstack`）、策略分叉声明（`michael-denyer/pstack-claude`，用 `forks.json` 逐条声明分歧）、钉 commit（`ericlitman/open-pstack`，明文「new pstack behavior belongs in Lauren's project first」）、哈希见证（`Aqua-123/pstack-for-codex`、`ScriptedAlchemy/pstack-codex` 用 `upstream.lock.json` / `UPSTREAM.json` + parity 报告）、每日 workflow 开 PR（`shrimpwtf/oh-my-pstack`）。**普遍滞后两个 patch**——因为上游不发 release，只能盯 monorepo 的 main。

同族模式旁证：同一 Cursor 官方仓里还发布 `dyl-stack`（Dylan Gattey）等个人风格 stack，「名家技能包被厂商官方仓收编」是这个仓的既有模式。`poteto` 名下另有 `how`（825，Cursor 专有单技能）、`noodle`（299，Go 编排 CLI）、`brainmaxxing`（297，Claude Code 专有持久记忆）、`verification-skill-example`（104，feature map 形状示例）。

### 2.4 mattpocock/skills — L1，反重流程的一端

MIT、272,454 star、几乎每日 push。37 个 SKILL.md，分 `engineering/`（20）、`productivity/`（7）、`misc/`（4）、`in-progress/`（6）四桶。两级路由：`ask-matt` 是显式地图（主线 idea → ship + 两条 on-ramp），`setup-matt-pocock-skills` 是每仓一次的配置。`.agents/invocation.md` 明文规定 user-invoked（只人敲，`disable-model-invocation: true`）与 model-invoked 的分工，且技能间调用统一写「Call the Skill tool with "X"」而非斜杠语法——**刻意保持 harness-neutral**。README 点名 GSD、BMAD、Spec-Kit：「try to help by owning the process. But while doing so, they take away your control and make bugs in the process hard to resolve.」

## 3. 生态事实（跨族）

- **厂商官方插件仓已成标准分发形态**：Anthropic / Cursor / OpenAI（`openai/plugins`）/ xAI（`xai-org/plugin-marketplace`）/ GitHub（`awesome-copilot`）各有一个；`obra/superpowers` 一份代码同时进 Claude Code、Cursor、Codex、Grok、Gemini、Devin 六个官方市场。
- **内容与分发已解耦**：`vercel-labs/skills`（`npx skills`，32,811）是跨 harness 通用安装器，多份上游 README 把它当作 Codex/其他 harness 的正式安装路径。
- **Agent Skills 标准已独立**：`anthropics/skills` 的 `spec/agent-skills-spec.md` 现在只有一行指针，指向 agentskills.io。
- **许可谱系**：MIT（多数）→ Apache-2.0（`anthropics/skills` 部分技能、`conductor`、`claude-squad` 是 AGPL-3.0）→ 源可见非开源（`anthropics/skills` 的 docx/pdf/pptx/xlsx）→ CC-BY-SA-4.0（`trailofbits/skills`）→ CC BY-NC-ND 4.0（`awesome-claude-code`，禁商用与改作分发）→ 自订商业协议（`pilot-shell`，需付费 Subscription + license key）→ 仓级 license 字段为空（`anthropics/skills` 仓级、`openai/plugins`、`xai-org/plugin-marketplace`）。
- **长尾是分形的**：头部之外，`gh search` 每组关键词都能翻出一批 star 数 0–155 的个人 harness。选型时看头部即可，长尾的价值是证明模式已扩散。

## 4. 失效与告警台账

这类项目的死亡率高，且死法有模式：

| 项目 | 状态 |
|---|---|
| `gsd-build/get-shit-done` | 已归档（archived=true），README 换成迁移公告；原维护者失联 + token 争议未定论 |
| `BloopAI/vibe-kanban` | 母公司 bloop 2026-04-10 公告关闭，「代码交给社区维护」；commit 到 2026-09-19，但 release 停在 2026-04-24 的 v0.1.44 |
| `yohey-w/multi-agent-shogun` | 作者本人反悔：2026-08 解散 10-agent 并行回单 agent，后继 `kagemusha` 改成「判断循环」 |
| `eyaltoledano/claude-task-master` | 品牌与文档整体外迁到商业站 tryhamster.com，仓库 5 个月无 push |
| `maxritter/pilot-shell` | 不是开源：自订协议要求 active paid Subscription |
| `Pimzino/spec-workflow-mcp` | README 顶部维护者公告「因个人原因暂停」 |
| `buildermethods/agent-os` | 主动收缩范围，8 个月无 release |
| `ruvnet/claude-flow` | 已改名 `ruvnet/ruflo`；README 的规模自宣（8.1M 下载、314 MCP 工具等）未独立核实 |
| `snarktank/ralph` | 8 个月无更新、75 个未处理 issue；但变体族持续活跃，模式已扩散出原仓 |
| `humanlayer/agentcontrolplane`、`humanlayer/claudelayer` | 分别 15 / 8.5 个月无更新，实质停更 |

## 5. 边界与未证实清单

未证实（不在报告里下结论）：

1. **GSD token 争议的最终归属**——fork 维护者自己列明「无法确认」，本报告同样不判。
2. Reddit `r/ClaudeAI` 原帖（1tktl4w）本次未能抓取（Reddit 通道当前不可用），仅由 `gsd-build/get-shit-done` Issue #3897 引用。
3. `spec-kitty/spec-kit` 与 `github/spec-kit` 的血缘：仅确认 `fork=false` 且 README 未声称衍生；贡献者 handle 重合不构成证据。
4. `github/spec-kit` 支持的 harness 完整清单（README 只给示例 + integration reference 链接）。
5. `buildermethods/agent-os` 的验收门机制。
6. `claude-task-master` 的 `tm loop` 是否有任何迭代/token/时间预算（文档未列，是该组唯一既无机械谓词又无预算兜底的 L1）。
7. `open-ralph-wiggum`、PageAI `ralph-loop` 是否有工具侧执行的机械测试谓词。
8. `ruvnet/ruflo` 的终止谓词（README 只描述「Learning Loop」回填记忆，不是终止条件；仅有 cost-tracker 插件做预算告警）。

边界排除（看起来像但不算）：`cabloy`（fullstack 框架，SDD 是附带叙事）、`dsifry/metaswarm`（主轴是多 agent 平台）、`mouredev/hello-sdd` 与 DeepLearning.AI 的 `sc-spec-driven-development-files`（课程材料，非工具）、`loulanyue/spec-kit-zh`（本地化衍生，归入 spec-kit 影响面）、AWS Kiro（闭源 IDE，README 被 OpenSpec 拿来当对照）。

## 6. 与本机既有结论的关系

wiki 页 [[Pstack vs mattpocock skills]]（2026-09-24）已把 mattpocock / Pstack / autoresearch / Spec-Kit·BMAD 四套按「核心单位 / 规划立场 / 停止条件」三轴对过。本文相对它的增量是四条：

1. **pstack 的上游定位**（§2.3）——该页只知道存在移植仓与 Cursor 绑定，不知道正本在 `cursor/plugins/pstack`。
2. **GSD 作为项目被正名**（§2.2）——该页只在 mattpocock README 的批评语境里提到「GSD」，没有把它当一个可评估的项目。
3. **harness 耦合度成了可量化的判别轴**（轴 B），量化材料在 `wshobson/agents` 的 `docs/harnesses.md`。
4. **停止条件轴的实证**（轴 A）——该页对 autoresearch 的判断（「有机械验证谓词」）在这里得到对照：同类循环族 18 项里只有 1 项做到同等强度，说明机械谓词是稀缺品而非默认。

## 附录

- `oss-landscape/a-spec-driven.md` — spec-driven 文档流水线族 21 项逐条明细（含 GSD 血脉专章）
- `oss-landscape/b-skills.md` — 技能/工具箱族明细（含 pstack 上游取证与六个移植仓的锚定策略对照）
- `oss-landscape/c-loops.md` — 循环/执行器/编排族明细（含停止条件四轴分类与 18 项逐条源码级核实）