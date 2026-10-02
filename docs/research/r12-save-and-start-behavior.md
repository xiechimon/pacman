# R12 · 「保存并开始」后 agent 行为：直接执行 vs 先后台编排——对比与建议

> 票：Multica XMON-98（父票 XMON-92；快捷键关联票 XMON-91 → 实现子票 XMON-95）。
> 性质：决策材料，非实现。只读调研，无代码改动、无 PR。
> 代码基线：`origin/main` = `4647eaf`（2026-10-02 拉取）。本地 HEAD = `52ceac3`，落后一提交；`4647eaf`（XMON-117）只动 `agent-detail-page.tsx` / `profile-card.*` / `account-page.tsx` / e2e，不触本篇链路任何文件，**全部 P 侧行号对两个提交同时成立**。
> 决策基线：XMON-98 评论区 2026-10-01 已有用户裁决——拍板点 2–6 已拍（软闸直派 / Chief 任编排者 / 编排步自裁阈值 + 对话框开关 / 子任务 withPlan:false / 兜底默认化），拍板点 7 用户自做；**拍板点 1（父卡去留）未闭合**，本篇 §5.2 给出双方立场与增量事实。
> 上位研究：`r10-multica-runtime.md`（Multica runtime 层）、`r11-runtime-gap.md`（runtime 差距，基线 `c95ee5f`）、`r5-chief-behavior.md`（Chief 行为）、`herdr-multica-parity.md`（编排者对照，内容二手）。
> 前史：本文件 2026-10-01 首次产出时写坏（输出流中断，正文乱码）；本版为整篇重写，全部代码引用在 `4647eaf` 上重核（明细见 §6）。

## 0. 阅读约定

出处三类，逐条标注：

- **P**（pacman 代码）= `路径:行号`，全部在 `4647eaf` / `52ceac3` 上逐行核实（2026-10-02）。
- **M-实**（Multica 一手）= 本 workspace 票面与评论原文，2026-10-02 经 multica 只读 CLI 重拉。
- **M-转**（Multica 转引）= multica-platform skill 文档（`references/squads.md` / `issues.md`）等，转引自 XMON-98 评论 1（2026-10-01 抓取），本篇未独立核实。
- 外部产品各条附来源链接与复核状态；未经复核的转引标 `[转引]`，无证据的判断标 `[推断]`。

两条路线的定义（票面原话）：

- **A 直接执行**：点「保存并开始」后，agent 直接按用户描述的工作开干。
- **B 先后台编排**：先在后台跑一轮编排——决定要创建哪些任务、每个任务是什么——然后再执行（Multica 式：leader 读 issue → 拆子 issue → 派发 → 成员执行 → 核收）。

## 1. 现状链路（P 侧）

### 1.1 按钮与八跳链路

**按钮**：`apps/web/src/overlay/new-task-dialog.tsx:381-392`——label 在 :391（`t('保存并开始')`），唯一禁用闸 :385（`spec.trim() === ''`，正文非空），onClick :386-389 调 `onSaveAndStart(spec, selected?.id)`。只在 live 面接线（`apps/web/src/overlay/use-new-task-surface.ts:300`）；i18n `apps/web/src/i18n/en.ts:409`（'Save and start'）；e2e 锚点 `apps/web/e2e/newtask-single-field.spec.ts:36`。不提交表单——是两条链式 mutation。

**快捷键现状**：`origin/main` 上「保存并开始」**没有** ⌘↵；唯一相关热键是 `C` 开新建对话框（`apps/web/src/overlays/hotkeys.ts:82-87`）。⌘↵ 实现在 commit `eb88476`（"web(XMON-95): 保存并开始 支持 ⌘↵"），**只在未合并分支 `agent/pacman/994dc12e8830` 上**，不在 origin/main。票面关系：XMON-91 = 用户原始快捷键票（in_progress），XMON-95 = 实现子票（done，代码在分支待合并）。

**点击 → agent 开跑的八跳**：

1. **前端 mutation ①建卡**：`createAndStart`（`use-new-task-surface.ts:144-187`）→ `POST /api/projects/:id/todos`（`apps/web/src/api/hooks.ts:574-584`），body `{title:'', spec}`——title 恒空串，server 从 spec 首行派生占位标题（`apps/server/src/services/todos.ts:200-201`），agent 事后经 `set_task_meta` 回填。无项目时先建默认项目（`use-new-task-surface.ts:129-134, 171-175`）。
2. **前端 mutation ②起 build**：onSuccess 立刻 `POST /api/projects/:id/builds`（`hooks.ts:624-637`），body = `{todoIds:[新卡], assignment:{plan,build 同值 = firstAgentId}, withPlan:true}`——**withPlan 在此入口写死 true**（`use-new-task-surface.ts:165`）；firstAgentId = 团队第一个 agent 成员（`use-new-task-surface.ts:101-104`）。
3. **server 建卡**：`routes.ts:1040-1053` → `todos.ts:145-244`：插 todo（phase `'todo'`）、发 SSE；GitHub-backed 项目另 fire-and-forget 建镜像 issue（`todos.ts:242`）——外部镜像，不是额外卡片。
4. **server 起 build**：`routes.ts:1055-1071` → `startBuilds`（`apps/server/src/services/builds.ts:340-392`）：相位断言 → 插 build 行（buildId ≡ conversationId，UUIDv7，:361；withPlan 落库 :368；`triggerSource:'user'` :347,:352）→ **入队首步 `withPlan ? 'plan' : 'build'`（:381，本路线的分叉点）** → `setTodoPhase('queued')`（:382-386）→ publishBuild SSE（:389）。
5. **step 队列 + 唤醒**：`enqueueStep`（`builds.ts:271-307`）插 pending step，`machineHub.wake(teamId)`（:295）。注释原话：「step 队列 server 持有、机器 claim」（`builds.ts:4-6`）。
6. **daemon claim**：长轮询 `POST /api/machine/tasks/claim`（`apps/daemon/src/machine-loop.ts:348-372` → `apps/server/src/routes-machine.ts:226-233` → `machines.ts tryClaim :784-935`）：FIFO + pinnedMachineId；**chief step 与 worker step 同队列**（`machines.ts:623-631`）；`agentForStep`（:633-656）按 assignment 槽取 agent（plan 步→plan 槽，build/merge→build 槽）；claim payload = `todo{title,spec} + project{repo} + agent{model,...} + session{action}`（:884-932）。
7. **执行**：`apps/daemon/src/runner.ts:214-829` `runStep`——首轮 prompt = `title\n\nspec`（`buildTaskPrompt` :92-96, :236-242）；工作区 = 会话级 git worktree（:298-323）；引擎 = **进程内 pi 会话**（`apps/daemon/src/backend/pi.ts:530`），不是 spawn `claude` CLI；plan 步收尾上传工作区 `plan.md`（:776-790；`PLAN_FILE_NAME` 定义 `packages/shared/src/records/plan.ts:10`）；done → `completeStep`。
8. **相位漏斗 + 可见性**：`completeStep`（`builds.ts:614-713`）：plan 完成→**`confirm`（等人的硬闸）**（:627-647）；build 完成→`review`（:649-653）；review 出 blocking 发现→自动重规划（:655-708）；merge→`done`（:710-713）。用户可见面：SSE team stream（`routes.ts:401-425`；前端全局 `apps/web/src/api/provider.tsx:88`）+ 会话流（`routes.ts:639`；`todo-detail-page.tsx:297`）+ REST steps/plans/changes/usage；UI = 看板相位列 + 详情页 transcript/方案面板。

**点击与 agent 开跑之间新建的任务/卡片：零。** 恰好 1 todo + 1 build + 1 step；Chief 不参与（`triggerSource:'user'`）。

### 1.2 现状回答：既非纯 A 也非纯 B

**现状 = 第三态：「单任务先规划 + 硬确认闸 + 后执行」。**

- 与 A 的差别：不是点完就写代码——`withPlan:true` 写死，首步恒为规划步，产物 plan.md（Context / Changes / Edge cases / Verification 四段，版本化 + diff 面），然后相位停在 `confirm` **等人批准**；批准后才入队执行步（`builds.ts:477-481`），驳回则带反馈重规划（:542-553）。
- 与 B 的差别：没有任务分解层、没有子卡、没有多 agent 派发。「先想一下」的产物是**一份文档**，不是**一组任务**。
- 一句话：**B 的弱子集——有规划，无编排。**

### 1.3 设计时要一起看的三个补充事实

1. **同一产品两个入口语义不一致**：卡片级「开始任务」对话框是双分支——主按钮「立即执行」（withPlan:false）、次按钮「先做规划」（withPlan:true），规划/执行可指派不同 agent（`apps/web/src/detail/overlays.tsx:243-250, 322, 329`；消费方 `board-page.tsx:377-392`、`todo-detail-page.tsx:446-455`）；新建对话框的「保存并开始」却把 true 写死、无开关（`use-new-task-surface.ts:165`）。
2. **Chief 通道 = 现成的 B 式编排器，但被「保存并开始」绕过**：一 user×team 一 Chief，回合 = 机器 step（kind `'chief'`）+ pi 会话（`apps/server/src/services/chief.ts:1-13`）；49 词工具表含 `create_todo`（`chief-tools.ts:357-372`，带 `createdBy`/`sourceBuildId` 溯源）、`run_builds`（:604-651，`triggerSource:'chief'`、**默认 withPlan:false 直接执行**、派工即自动 watch）、confirm/cancel/merge_builds、ask_user/notify_user、set_wake/clear_wake；watch/wake 对 gate/settle/failed 自动反应（`chief.ts:429-456` `triggerChiefWakes`、`wakeFacts` :461-476、定时 `fireDueChiefWakes` :512+）；入口 = ⌘J 抽屉（`hotkeys.ts:89-94`）。worker 侧无建卡工具（`WORKER_REMOTE_TOOLS`，`chief-tools.ts:693-711`）——建卡/派发词汇表是 chief 专属。
3. **领域模型给 B 留了「半个位子」**：`todo.sourceTodo` 列存在（`apps/server/src/db/schema.ts:81`；`packages/shared/src/records/todo.ts:86`）但**恒写 null**（`todos.ts:224`）——休眠字段，从未有代码置值；todo 的 source 概念现只有 `github-issue` 一种（`sourceKind`/`sourceRef`）；相位九值无「编排中」（`apps/web/src/phase.ts`）；CONTEXT.md 现裁决「无 Goal/父子概念——工作单元只有一个，即 todo」。

## 2. Multica 的做法（M 侧）

### 2.1 编排层：leader 拆子票 → 派发 → 成员执行 → 核收

**一手证据（M-实）——本票就是该流程的活样本**，XMON-92 父票 2026-10-01 09:36 派发回执评论原文要点（2026-10-02 重拉核对）：

- 调研任务拆为子 issue XMON-98，按属地派给「Pacman 后端」（理由：涉及 server 侧链路 + 需读 pacman 仓代码）；
- 同时挂**两个兜底唤醒**：run 失败/取消事件唤醒 + 30 分钟定时检查（防静默挂死），均 72h 有效；
- 「报告回来后我逐条核验收标准，达标再翻 in_review 并把结论汇报到本线程」——**核收权在 leader，人工把关后移**。

**转引证据（M-转，multica-platform skill `references/squads.md` / `issues.md`，经 XMON-98 评论 1）**：

- issue 指派给 squad 只唤醒 leader，不扇出成员；leader briefing 含 Squad Operating Protocol + 成员名册（附技能清单，供按能力派活）；
- 子票 `--status todo` = 立即起跑、`backlog` = 停车场；串行链不一把全 todo——后续 stage 先 backlog，前一 stage 闭合才唤醒 leader 晋级；
- 父票状态归 leader 管（成员干活期间保持 in_progress，确认整体达成才翻 in_review），平台不自动翻父票。

### 2.2 runtime 层：编排不在 runtime 里

r10（Multica runtime 模型全解）**全文无 squad/leader 内容**（grep 零命中）——runtime 层只有：WS `/api/daemon/ws` + 30s poll 兜底、心跳 15s、离线判定 ≈180s、queue = server 通知 daemon、并发 daemon 20 / agent 6、dispatched >5min 判 fail（r10 §5 运行面）。r11 §9 反过来指出 pacman 的 step 队列 / claim / 会话级 worktree / plan.md 上传 / 九相位硬闸是 Multica runtime **没有**的东西。

**含义**：Multica 的「先编排」长在**平台层**（squad/leader 协议），不在执行层。pacman 学 B 不需要动 runtime——daemon/claim/step 队列原样复用，编排只是队列里多一种 step。

### 2.3 对 pacman 有用的两个要点

1. **编排产物 = 看板实体**：拆分结果是子 issue 本身，不是附件文档——用户零成本看见 agent 的决定，随时评论、改派、关停。
2. **派发不等用户确认**：leader 自主派发；「可干预」来自产物可见 + 全程可评论，不是来自执行前的批准闸。

## 3. 外部产品对比（5 家，票面要求 ≥2）

### 3.1 对比表

| 产品 | 直接执行 or 先计划/编排 | 计划/编排产物可见性 | 执行前用户确认 | 来源与复核状态 |
|---|---|---|---|---|
| Devin (Cognition) | 默认先计划：Initial Assessment（相关文件/关键发现/实现问题）→ Detailed Plan | 计划带代码引用，点 citation 深链进 Devin IDE 核查 | **软闸**：默认等 30 秒反馈后自动继续（Settings > Customization 可调）；复杂任务可点「Wait for my approval」变硬等待 | [docs.devin.ai/work-with-devin/interactive-planning](https://docs.devin.ai/work-with-devin/interactive-planning)。2026-10-02 复核：原链已从官方 docs 索引消失，内容经 Exa 缓存逐字核实（"By default, Devin will wait thirty seconds…"） |
| OpenAI Codex（CLI/IDE） | 计划为 opt-in：Plan mode（/plan 或 Shift+Tab）、PLANS.md 模板；官方 best practices「Plan first for difficult tasks」 | 计划在会话里可见可迭代 | Plan mode 批准后才动手（研究面只读）；默认模式直接干 | [developers.openai.com/codex/learn/best-practices](https://developers.openai.com/codex/learn/best-practices) `[转引]` |
| OpenAI Codex（cloud） | 直接执行：@codex 提及 → webhook → 云环境 clone → harness 直跑；「本地先计划再 delegate 到云」是官方推荐组合 | 无中间计划闸；产物 = diff/PR | 无；把关在 PR review | [developers.openai.com/codex/cloud](https://developers.openai.com/codex/cloud)、[openai/codex#11442](https://github.com/openai/codex/issues/11442) `[转引]` |
| Claude Code | 默认直接执行（todo 清单可见）；Plan mode = 只读研究 + 计划（Shift+Tab）；Task/subagents、agent teams 由 agent 自主裁量，不经用户逐个批准 | todo/计划可见；subagent 只回摘要；teams 的 lead 协调可见 | Plan mode = **硬闸**；默认模式是逐动作权限确认，非计划闸 | [permission-modes](https://code.claude.com/docs/en/permission-modes)、[sub-agents](https://code.claude.com/docs/en/sub-agents)、[agent-teams](https://code.claude.com/docs/en/agent-teams) `[转引]` |
| Cursor | Agent mode 默认直接执行；Plan mode opt-in（Shift+Tab，复杂任务自动建议）；Cloud agents 云 VM 直跑到 merge-ready PR | 计划可 review/编辑（chat 或 markdown），可存 workspace 共享 | Plan mode 里点 build 才执行 | [cursor.com/docs/agent/plan-mode](https://cursor.com/docs/agent/plan-mode)。2026-10-02 live 复核成功（"Plan Mode creates detailed implementation plans before writing any code… Click to build the plan when ready"） |
| GitHub Copilot cloud agent | 会话流「研究 → 计划 → 迭代」三段式；issue/集成入口派发时自动跑全程 | 计划在会话里可见可迭代（对话驱动，非批准闸） | 无硬闸；session 不自动建 PR，把关在 diff/PR | [coding-agent](https://docs.github.com/en/copilot/concepts/agents/coding-agent)、[research-plan-iterate](https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/research-plan-iterate) `[转引]` |

`[转引]` = 2026-10-01 经 agent-reach Exa 通道抓取（XMON-98 评论 1），本篇未重新逐条核；两条关键行（Devin 软闸、Cursor Plan mode）已于 2026-10-02 独立复核。

### 3.2 三条启示

1. **闸的位置跟「人在不在场」走**：同步、人在场的产品才敢把确认闸放执行前（且多为 opt-in 或软化——Devin 只等 30 秒）；异步/云端/issue 驱动一律直接执行，把关后移到 PR。**pacman「保存并开始」是异步入口（点了人就走了），却挂着全场最硬的闸（confirm 相位无限期等人）——与业界基线正好相反**，是现状最值得重设计的一点。
2. **没有一家把「任务拆分」做成执行前的硬确认闸**。拆分可见性两种形态：Multica = 拆成看板实体；Claude Code / Cursor = 计划文档/清单在会话里可见。B 的核心价值（把 agent 的决定摊开、可干预）两种形态都满足，差别在干预粒度。
3. **拆分要有阈值**：Claude Code agent teams 文档自警「协调开销大、token 显著增加，顺序任务/同文件改动用单会话更好」；Codex/Cursor 都是「困难任务才计划」。恒编排会把简单任务拆碎。

## 4. 两路线对比表（票面核心交付）

| 轴 | A 直接执行 | B 先后台编排 |
|---|---|---|
| pacman 现状 | 现状是 A 的变体：单卡直达 + plan 硬闸（§1.2 第三态） | 零件已在（Chief lane，§1.3b），但与「保存并开始」无连线 |
| 点击后流程 | 1 todo + 1 build + 1 step；首步 plan（写死）→ confirm 等人 → build | 1 todo + 1 编排步（kind chief/新 kind，**与 worker step 同队列**，P:`machines.ts:623-631`）→ 裁定：单任务直跑 or 拆 N 子卡派发 |
| 首个结果时延 | 快；省一轮 LLM | 慢一个编排回合（分钟级） |
| 用户干预点 | plan confirm 硬闸 + steer + 驳回/停止 | 软闸：子卡落看板全程可见可干预（拖拽/评论/停止/cancel_builds），把关后移 review/merge |
| 编排产物形态 | plan.md 四段文档（版本化 + diff 面） | 子卡 = 看板实体（Multica 形态）或 会话 + 子卡（§5.2 折中形态） |
| 成本 | token 最低；**但 confirm 闸 = 异步入口上的人工等待成本**（§3.2 启示 1） | 每任务多一轮编排 token；拆分粒度失控 → 核销点击负担（「拆分粒度 = 核销次数」，§5.2） |
| 与既有机制契合 | 零改动 | 高：step 队列/claim/wake/watch/49 词表全现成；需新增 = 建卡→编排步连线、相位语义（复用 planning 或加「编排中」）、子卡溯源字段（sourceKind 或激活 sourceTodo，§5.2） |
| 外部基线佐证 | 异步/云端产品全 A（Codex cloud、Cursor cloud、Copilot） | 无一家做「B + 硬闸」；Multica 是「B + 软闸」唯一活样本 |
| 典型失败模式 | plan 空跑——已有 `PLAN_REWRITE_PROMPT` 有界补写兜底（P:`builds.ts:599-601, 627-641`） | 编排步静默挂死（需事件+定时兜底——Multica leader 目前手工挂，M-实）；**错拆/漏拆是静默的**（需最终核收对冲，§5.2） |

**结论**：走 B 的软闸版。理由三条：① 用户已明确倾向 B 且拍板点 2–6 已按 B 拍定（§5.1）；② pacman 的 B 零件（Chief）成熟度远高于要补的连线——49 词表、watch/wake、run_builds 自动 watch 全是现成的（§1.3b）；③ 现状 A 变体的主病灶（异步入口挂最硬闸）恰好被 B 的软闸设计切掉（§3.2 启示 1 + §2.3 要点 2）。

## 5. 建议方案

### 5.1 已拍裁决（XMON-98 评论 2/3，2026-10-01，M-实）

| # | 拍板点 | 裁决 |
|---|---|---|
| 2 | 编排确认 | **软闸直接派发**——拆分结果不停 confirm，看板/线程随手驳回改派 |
| 3 | 编排者 | **Chief 任编排者**（复用 49 词表 + 分派策略 + watch/wake） |
| 4 | 拆分阈值 | **编排步自裁**单任务直跑 vs 拆分 + 新建对话框加用户开关 |
| 5 | 子任务 withPlan | **false 直接执行**，核销统一在 review/merge |
| 6 | 编排兜底 | **默认化**：run 失败事件唤醒 + 定时检查，平台内建，不靠编排者手工挂 |
| 7 | Command+Enter / 界面标识 | **用户自做**（XMON-91 → XMON-95，代码在未合并分支 `agent/pacman/994dc12e8830`）；状态标识文案跟新行为走 |

### 5.2 唯一未闭合点：父卡去留（拍板点 1）

**用户立场**（评论 2 原话大意）：只要子卡、不要父卡——问题自动解析为多张子卡逐张核销，父卡是噪音。

**评论 3 反提案**（agent 侧，用户未确认）：看板**不渲染父卡**（采纳用户直觉），但「父记录」不能为零，否则丢三样——原文锚点（重拆/驳回要回到用户原话）、完成判定（「全绿 = 解决」依赖拆分完整，漏拆是静默的）、溯源（agent 拆的卡与人手建的卡在看板上无法区分）。落地形态：**容器不是卡片，是会话**（chief thread 形态）——原话 = 会话第一条消息，拆分推理/指派/总结都在会话里；子卡挂来源沿用 source 同族字段（现只有 `github-issue` 一种），加 `sourceKind='orchestration'` + 会话 id，**不违反 CONTEXT.md「无 Goal/父子概念」裁决**（会话不是 todo）；单任务裁定不拆 = 就 1 张卡、无容器，体验与现状一致；最终核收做成可选（最后一张子卡闭合时编排者对照原话自检覆盖度、会话里发总结）。

**本篇增量事实**（评论 3 之后新核出，P 侧）：`todo.sourceTodo` 休眠列已存在（`schema.ts:81`，恒 null，`todos.ts:224`）——若要「父记录」，技术上还有第三条路：激活 sourceTodo 指向编排会话首卡或父 todo。但激活它 = 把父子关系正式抬进领域模型，正面撞 CONTEXT.md 现裁决，且与用户「不要父卡」直觉张力最大。**故本篇支持评论 3 的 sourceKind 路线**，sourceTodo 留作已知的休眠备选记录在案。`[推断]`

**实操护栏**（评论 3 原话，进编排 prompt）：**拆分粒度 = 核销次数**——按可独立验收的成果拆，不按执行步骤拆；否则一次提问拆 8 张卡，父卡的噪音以点击次数形式回来。

### 5.3 行为设计（按已拍裁决版）

**用户视角时序**：

1. **T0 点击「保存并开始」**：对话框关、卡上看板。看板路由下卡片落列即可见反馈；非看板路由（对话框全路由可开）补一条短命可点击 toast「已保存并开始 → #N」跳卡——**toast 只回答「我的东西去哪了」，不回答「它现在怎么样」**（后续状态归看板相位列 + 通知面；失败路径的反馈优先于成功路径落）。⌘↵ 触发同一链路（XMON-95 分支合并后）。
2. **T0–T1 编排回合（后台）**：编排步跑起来；产物两种——裁定不拆：该卡直接进执行（withPlan 按对话框开关，默认沿用裁决 4）；裁定拆：N 张子卡带指派落看板，**不等批准**（裁决 2），父卡不在看板渲染（§5.2 折中），原话与拆分推理在编排会话里可查。用户随时可干预：拖拽、评论、停止、改派。
3. **T2 执行中**：看板相位列 = 各子卡进度；编排会话聚合子任务事件（watch/wake 现成）。
4. **T3 核收**：子卡逐张停在待验收，用户逐个 review/merge（裁决 5 的核销点）；可选最终核收总结（§5.2）。

**系统视角时序**（新增面最小化，全复用现零件）：

1. `POST /api/todos` 不变。
2. `startBuilds` 的 withPlan 分叉（`builds.ts:381`）处接线：开关=编排时，首步入队 **kind 'chief'（或新 kind 'orchestrate'）step**——复用 enqueueStep/claim/wake，chief step 本就同队列（`machines.ts:623-631`）；prompt = 父任务 title+spec + 拆分纪律（§5.2 护栏）。
3. 编排步产物 = `create_todo` 批量建子卡（带 `sourceKind='orchestration'` + 会话 id）+ assignment（按 agent 职责文本，策略段已在 chief system prompt，`chief.ts:586`）+ `run_builds`（withPlan:false，裁决 5）+ 自动 watch（现成，`chief-tools.ts:604-651`）。
4. 子任务管线 = 现有 plan/build/review/merge 全复用，零改动。
5. 兜底默认化（裁决 6）：编排步失败 → 父记录红 + 通知（沿用失败重跑面）；run 失败/取消事件唤醒 + 定时检查进平台默认，不再靠编排者手工挂。

### 5.4 风险与护栏（premortem：假设上线三个月后失败了，最可能的死因）

1. **恒拆分把简单任务拆碎**（协调开销 + token 成本，Claude Code 文档自警）→ 护栏：裁决 4 的编排步自裁 + 对话框开关 + 「单任务直跑」出路。
2. **编排步静默挂死，用户以为在跑**（Multica 侧真实痛点，leader 手工挂兜底为证）→ 护栏：裁决 6 兜底默认化（事件唤醒 + 定时检查）+ 失败相位红卡。
3. **父子/溯源动 shared 契约砸前端与 CLI**（`packages/shared` 是契约层）→ 护栏：§5.2 sourceKind 同族字段路线，零领域模型变更起步；sourceTodo 休眠列不动。
4. **错拆/漏拆静默通过**（全绿 ≠ 解决了原问题）→ 护栏：原文锚点保留在编排会话 + 可选最终核收总结（§5.2）。

## 6. 证据核对明细

- **P 侧**：全部 file:line 于 2026-10-02 在 `4647eaf`（origin/main）/`52ceac3`（HEAD）逐条重核；两基线间唯一提交 `4647eaf`（XMON-117）不触本篇任何链路文件。前版报告（XMON-98 评论 1）行号基于更早基线（`c95ee5f` 前后），本篇行号以本文件为准。
- **M-实**：XMON-92 派发回执评论、XMON-98 三条评论（调研报告 / 用户裁决 / agent 收拢）、XMON-91 与 XMON-95 票面——2026-10-02 经 multica 只读 CLI 重拉全文核对。
- **M-转**：multica-platform skill `references/squads.md` / `issues.md` 的 squad 机制细节，转引自 XMON-98 评论 1，本篇未独立核实。
- **外部产品**：Devin（Exa 缓存逐字核实，原链已失效于官方索引）、Cursor（Jina Reader live 核实）两条 2026-10-02 独立复核；其余四条 `[转引]` 自评论 1（2026-10-01 经 agent-reach Exa 通道抓取），链接原样保留。抓取通道均属 agent-reach 家族。
- **r10 / r11 前提更正**：任务书原话「Multica 实际怎么做的（本仓有 r10、r11 两份现成研究）」不精确——两份都是 **runtime 层**研究，squad/leader 编排内容零命中（grep 核实）。本篇 §2.2 反而以此为证：编排不在 Multica runtime 里。squad 对照内容在 `herdr-multica-parity.md`（untracked，源自仓外 wiki，`[二手]`，只作线索不作证据）。
- **快捷键事实更正**：⌘↵ 不在 origin/main——commit `eb88476`（XMON-95）只在未合并分支 `agent/pacman/994dc12e8830` 上（`git merge-base --is-ancestor` 核实非祖先）。引用「保存并开始 + ⌘↵」行为时以该分支状态为准。
- 未查到/未核实事项均已就地标注（`[转引]` / `[二手]` / `[推断]`）。

## 7. 相关文档

- `r5-chief-behavior.md` — Chief 行为研究（B 路线编排者的仓内正本）
- `r10-multica-runtime.md` / `r11-runtime-gap.md` — runtime 层对照（§2.2 依据）
- `herdr-multica-parity.md` — 编排者对照（S3/S6/S8，二手线索）
- `CONTEXT.md` — 「无 Goal/父子概念」现裁决（§5.2 的约束面）
- Multica XMON-92 / XMON-98 / XMON-91 / XMON-95 — 票面与评论区（决策正本）
