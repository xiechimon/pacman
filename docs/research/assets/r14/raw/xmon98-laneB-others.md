# XMON-98 laneB · 同类产品「一任务拆多子任务」的父对象展示与归属取证

> 调研问题：pacman「保存并开始」走编排（一个请求 → Chief 拆 N 张子卡）后，**父任务对象存不存在、看板渲不渲染**（r12 §5.2 拍板点 1，唯一未闭合点）。本篇取证同类产品做法，供裁决对照。
> 产物性质：决策材料，只读调研，无代码改动、无 git 写操作。抓取时间 2026-10-02。
> 出处纪律：每节先列来源（URL + 抓取方式 + 复核状态）；未经复核写 `[转引]`，无证据判断写 `[推断]`。文件位置均给绝对路径。

## 0. 结论先行

三家的共同答案：**父是一张真实存在的 issue（渲染成卡/条目），子是完整 issue，归属是子票上的显式关系字段**。分歧只在两条轴：父子状态联动（无 / 无 / 可选双向）× 看板折叠方式（不折叠 / 不折叠 / 可隐藏子票）。**没有一家把「父」做成纯会话或纯记录而不渲染**；「父卡噪音」的主流解法是把父卡语义窄化（不做状态 rollup、不进核销路径、可隐藏），不是让父对象消失。

---

## 1. Multica（agent 编排平台，仓内一手归档 + 活样本）

**来源与复核状态**

| 来源 | 内容 | 抓取方式 | 复核 |
|---|---|---|---|
| `~/.agents/wiki/raw/sources/2026-09/2026-09-30-todos-vs-multica-docs/multica/`（issues.txt / squads.txt / tasks.txt / cli.txt / inbox.txt / assigning-issues.txt） | Multica 官方文档 41 页快照（原文 URL 形如 multica.ai/docs/issues、multica.ai/docs/squads） | 2026-09-30 curl 直抓 HTML + Python 剥 nav/script/style（快照 README 记录方法与保真核验：todos 侧与官方 llms-full.txt 逐段比对一致） | 本篇逐条读快照原文，**一手已复核**；live 站点未再抓（快照即正本） |
| `/Users/xmon/.herdr/worktrees/pacman/hp-pacman-t-0033-xmon-98/docs/research/r12-save-and-start-behavior.md` | §2 leader 拆子票→派发→核收；M-实 = XMON-92/98 票面与评论经 multica 只读 CLI 2026-10-02 重拉 | 仓内研究 | 已读全文；M-实 条目沿用其 CLI 重拉口径 |
| `r10-multica-runtime.md` / `r13-multica-runtime-verify.md`（同目录） | runtime 层研究 | 仓内研究 | 已读全文；**两文 squad/leader/父子编排内容零命中**（r12 §2.2 grep 核实）——编排长在平台层不在 runtime 层，本篇父子结论全部取自快照与 r12 |
| wiki：`/Users/xmon/.agents/wiki/wiki/todos.dev 与 Multica 对照.md`（依据 wiki：[[todos.dev 与 Multica 对照]]） | 两侧官方文档全量精读的逐轴对照 | wiki 页（2026-09-30 ingest） | 已读全文 |
| wiki 命中另两页：`AI Agent 编排器六款横评.md`、`pacman 的编排器坐标与借鉴清单.md` | Multica 段 = 视频口径 + 2026-09-30 一手文档补正 | wiki 页（grep 提取相关段） | 六款横评补正段确认「Multica 无编排者无硬闸、issue 状态 agent 自己写」；「结果回到共享看板 / agent 在经办人下拉里」为视频口径、已被对照页取代 |

注：任务书提到的 `herdr-multica-parity` 页**不在 wiki**（`find` 全库仅命中上页）；该文件曾为本仓 untracked 副本、现 worktree 已无（git status clean；r12 §6 记其为「源自仓外 wiki、二手、只作线索不作证据」），本篇不使用。

### 1.1 父任务渲染成什么

- 父子关系是 issue 对象的一等部件。issue 组成表六行之一：「Project and parent-child relationships | Fits into a larger body of work, or splits into sub-issues」（issues.txt:16）。
- **父卡在看板上就是一张普通卡**：Issues 页五视图 list / board / table / Gantt / swimlane「They all show the same issues.」（issues.txt:107）。没有「父记录不渲染」形态，也没有把父换成会话的形态。
- 活样本（r12 §2.1，M-实）：XMON-92 父票收 leader 派发回执评论（拆出 XMON-98 按属地派「Pacman 后端」、挂 run 失败唤醒 + 30 分钟定时兜底）——**父票线程就是编排会话的载体**，人随时在父票评论区干预。

### 1.2 子任务怎么归属

- 归属 = 子票上的显式 `--parent` 字段 + 可选 `--stage` 字段：`multica issue create --title ... --parent <父> --stage <n>`（cli.txt:248 子命令表）；`multica issue children` =「List sub-issues grouped by stage」（cli.txt:254）。
- 子票是完整 issue：自己的编号（`MUL-123` 形态，workspace 内递增，issues.txt:23）、自己的 assignee（member / agent / squad 三类，issues.txt:27-31）、自己的状态与执行历史；stage 只有 1/2/3 三档批次（issues.txt:103），文档未见递归父子/层级上限。
- 通知冒泡边界（inbox.txt:45）：「When a sub-issue's status changes, subscribers of the parent issue are notified as well. Sub-issue comments, priority, and date changes do not bubble up to the parent.」——**只有状态变更冒泡**。

### 1.3 状态与核销怎么走

- **父子状态零联动**（本篇最重要的一句，issues.txt:101）：「Larger work can be split into sub-issues: the parent issue keeps the overall goal while sub-issues progress independently. **Parent and child statuses do not affect each other.**」
- 平台不自动翻票：状态由 agent 经 CLI 显式写，「the server does not flip issue status when a run starts or completes」，仅两个系统例外（run 失败且无其他 run 时 `in_progress` 退回 `todo`；关联 PR 全部合并时按 workspace 设置迁移，issues.txt:59-65）。
- 父票状态语义 = squad leader 协议（squads.txt，Squad Operating Protocol 硬编码、不可编辑）：
  - 派发回合把父留在 `in_progress`——「coordinating the squad is working the parent's ask … dispatching members is not delivery, so it stays there while the squad works」（squads.txt:39；assigning-issues.txt:43 同义）。
  - 「only move the parent to `in_review` once the overall goal is met」（squads.txt:49）；「`done` is left to a human reviewer or existing integrations (for example a PR with close intent that merges)」（squads.txt:41）。
  - leader 被唤醒的时机含子票屏障：「When the delegated member posts back — or when a **sub-issue / stage barrier** closes — the leader is re-triggered」（squads.txt:41）。
- stage 屏障 = 核销的批次语义（issues.txt:103）：最早未完成 stage 的全部子票到 `done`/`cancelled` 时，父票收「sub-issues completed」通知；父票 assignee 是 agent 则被唤醒决定是否开下一 stage；无 stage 的子票算一批、全完时通知一次。
- 核收权在 leader/人（r12 §2.1 M-实，XMON-92 回执原话）：「报告回来后我逐条核验收标准，达标再翻 in_review 并把结论汇报到本线程」。

### 1.4 对父卡去留问题的启示

- Multica 保留父卡，但把父卡**语义窄化**成三件事：总目标正本（"the parent issue keeps the overall goal"）、leader 核收线程、stage 屏障的唤醒锚点。父卡不聚合进度、不联动状态、不进逐张核销路径——「噪音」由窄化消解，而非删除对象。
- 若 pacman 拍「不要父卡」，Multica 侧对应三个缺口需有承接物：原话锚点、批次/核收事件锚点、编排者汇报线程——r12 §5.2 评论 3 反提案正是用「编排会话 + 子卡 sourceKind 来源字段」承接这三件事（本篇不裁决，只指出 Multica 把它们全放在父卡上）。
- 依据 wiki：[[todos.dev 与 Multica 对照]]——Multica 的「子 issue 阶段」属其对象面「宽而松」一侧（对照 todos 少而硬）；pacman 定位 = todos 的语义 + Multica 的开放式骨架，Multica 的 Squad / 子 issue 阶段是 pacman 尚无的对象，可作为可直接读源码的参考（multica-ai/multica 开源）。

---

## 2. GitHub sub-issues（Copilot coding agent 跑在 issue 上，派发直接相关）

**来源与复核状态**：docs.github.com 五页，2026-10-02 经 agent-reach web 通道（Jina Reader，`curl r.jina.ai/<URL>`；页面 URL 由 agent-reach Exa 搜索定位）live 抓取全文，留档 `/tmp/xmon98-gh-browse.md`、`/tmp/xmon98-gh-add.md`、`/tmp/xmon98-gh-proj.md`、`/tmp/xmon98-gh-api.md`、`/tmp/xmon98-gh-copilot-assign.md`，**五页全部 live 已复核**：

- Browsing sub-issues — https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/browsing-sub-issues
- Adding sub-issues — https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues
- About parent issue and sub-issue progress fields — https://docs.github.com/en/issues/planning-and-tracking-with-projects/understanding-fields/about-parent-issue-and-sub-issue-progress-fields
- REST API endpoints for sub-issues — https://docs.github.com/en/rest/issues/sub-issues
- Using Copilot cloud agent on GitHub（Assigning an issue to Copilot 节）— https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-on-github

口径注：任务书提的「tracked-issues API」在当前 docs 的正式数据面即上述 REST sub-issues 端点（未再见独立的 tracked-issues 端点页）。

### 2.1 父任务渲染成什么

- 父 issue = 普通 issue；**子票列表嵌在父 issue 描述底部**的 Sub-issues 区（「At the bottom of the issue description, click Create sub-issue」，adding-sub-issues）；多级子票在父票上用 expand toggle 逐级展开，可浏览全部层级（browsing-sub-issues）。
- **进度聚合显示**：`gh issue view` 输出示例带「Sub-issues · 1/3 (33%)」行 + 逐条子票状态（browsing-sub-issues）；Projects 里可启用 "Sub-issue progress" 字段「to see how many sub-issues have been completed」（progress-fields 页）。
- 子票头部固定渲染回链：「you can always find a link back to the parent issue in the header below the issue title」（browsing-sub-issues）——**从子票回父是常驻导航**。
- 规模上限：「You can add up to 100 sub-issues per parent issue and create up to eight levels of nested sub-issues.」（adding-sub-issues）。

### 2.2 子任务怎么归属（数据面三层）

- 子票是完整 issue：创建对话框可独立设 type / assignees / labels / projects / milestones（adding-sub-issues）；谁可挂子票 = 至少 triage 权限。
- **REST**（docs.github.com/en/rest/issues/sub-issues）：Get parent issue / List sub-issues / Add sub-issue / Remove sub-issue / Reprioritize sub-issue（端点页首句「Use the REST API to view, add, remove, and reprioritize sub-issues」；fine-grained token 需 Issues 仓库权限）。
- **gh CLI**：`gh issue create --parent`、`gh issue edit --add-sub-issue / --remove-sub-issue / --remove-parent`（adding-sub-issues）；`gh issue view --json parent,subIssues,subIssuesSummary`（browsing-sub-issues）。
- **Projects 字段**："Parent issue" 字段（可 group、可 filter `parent-issue:"<OWNER>/<REPO>#<N>"`）与 "Sub-issue progress" 字段（progress-fields 页）。

### 2.3 状态与核销怎么走

- 各票独立 state；所抓 sub-issues 相关四页（browse / add / progress-fields / REST）**未见任何父票状态随子票联动 / 自动关闭机制**（无 rollup 记载）。核销 = 子票逐张 close；父票上的「1/3 (33%)」与 progress 字段是**只读聚合显示**。
- 口径诚实：这是「所抓四页无记载」，非穷尽证明。[推断] progress 字段的措辞（"see how many have been completed"）表明父子状态机独立是设计意图而非文档遗漏。

### 2.4 看板（Projects）里父子怎么摆

- 父与子**各自是 Project 的独立 item**（「You can add sub-issues to your projects and make use of the hierarchy data for building views, grouping items, and filtering your views」，browsing-sub-issues）；默认不折叠进父卡。
- 层级靠视图表达：group by "Parent issue"（按父分组的看板分组）、filter `parent-issue:` 只看某父的子票、Sub-issue progress 字段作列显示完成数（progress-fields 页）。

### 2.5 对父卡去留问题的启示

- GitHub 把父子做成**纯数据关系 + 只读聚合显示**：状态零联动、看板不折叠、父票上的子票区与进度是显示面不是控制面。父票不挡任何核销路径——「父卡存在但永远安静」的量产样本。
- Copilot coding agent 跑在 issue 上（一手补证，2026-10-02 Jina Reader live 抓取并复核，留档 `/tmp/xmon98-gh-copilot-assign.md`）：https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-on-github ——「You can ask Copilot to start working on an issue by assigning the issue to Copilot. Copilot will start working on the task, raise a pull request, then request a review from you when it's finished.」「When you assign an issue to Copilot, it gets sent the issue title, description, any comments that currently exist, and any additional instructions you provide.」（该功能 public preview；还可在 GitHub Projects 里看 issue 时直接 assign。）
- 含义：**子票是完整 issue ⇒ 可逐张派给 Copilot 或人**，派发语义就是 assignee 字段（与 Multica 的 assignee = agent/squad 同构）；「leader 拆票 → 逐张派 agent」在 GitHub 语义里天然成立，父票只做导航与聚合。

---

## 3. Linear（加分项）

**来源与复核状态**：

- https://linear.app/docs/parent-and-sub-issues —— 2026-10-02 agent-reach Jina Reader live 抓取全文（留档 `/tmp/xmon98-linear.md`），**已复核**。
- https://linear.app/docs/display-options —— 2026-10-02 同通道 live 抓取（留档 `/tmp/xmon98-linear-display.md`；抓取期间本机代理瞬断数分钟，恢复后补抓成功），**已复核**。

### 3.1 父任务渲染成什么

- 父 issue = 普通 issue；子票区在**描述下方**（「opening the parent issue and clicking the `+ Add sub-issues` button below the issue description」，parent-and-sub-issues）。
- 列表/看板有子票开关：Display Options 的 Sub-issues「Toggle this setting on to show sub-issues in the list or off to only show parent issues and issues without sub-issues」；分组维度含 parent issue（「Group issues by properties such as status, assignee, project, priority, cycle, label, parent issue, team, …」，display-options）；Filter 可只看顶层（父）票 / 带子票的票 / 只看子票（parent-and-sub-issues Filter 节）；父票 `…` 菜单「Always hide completed sub-issues」。
- 拆票是父票详情页的一等动作：保存一张子票自动开下一张编辑器（「When you save a sub-issue, it will automatically launch the editor to create a new one」）；可从评论、选中文本、checklist 直接转子票（Cmd/Ctrl Shift O）。

### 3.2 子任务怎么归属

- 归属 = 子票 parent 关系 + **属性继承**：「Sub-issues inherit the parent issue's team, priority, and project. They may also inherit its cycle when created in an active status. Labels are not inherited.」assignee 继承有条件（你被指到父，或现有子票 assignee 一致）（parent-and-sub-issues Copy properties 节）。
- 关系可逆可编辑：已有 issue 设父/换父（Cmd Shift P）、子票「Remove parent」变回普通 issue、多选批量挂父（converting issues 节）。
- 容器升级路径：父 issue 太大时「Convert to project」——原 issue 与全部子票变成 project 里的独立 issue、**子关系解除**、原 issue 改名标记转换（converting issues 节）。

### 3.3 状态与核销怎么走

- 三家里**唯一有父子状态联动**的，且是团队级可选项（Settings > Team > Workflow）：
  - Parent auto-close：所有子票 done → 父自动 done；
  - Sub-issue auto-close：父 done → 剩余子票全 done；
  - 「Status changes triggered by Git integrations will also respect these automations.」（status automation 节）
- 默认核销仍逐张；rollup 是 opt-in 开关、可只开单向。

### 3.4 对父卡去留问题的启示

- Linear 证明「父卡保留」与「父卡不挡道」并存：子票显示/隐藏是视图层开关，rollup 是团队级开关——父卡的噪音被处理成**用户可调的显示问题**，不动对象模型。
- 「父转 project」是「容器不是卡片」的官方先例：拆分大到不该是一张卡时，Linear 换容器类型并解除父子关系，而不是让父卡膨胀。pacman 反提案的「编排会话」在坐标上接近这个容器位，但它不是 issue 系统内的父对象先例。
- 属性继承是 pacman「子卡带来源字段」的对照物：Linear 继承组织属性（team/priority/project），关系本身存在子票 parent 字段上。

---

## 4. 各产品速答

- Multica：父卡=普通 issue 留看板；父子状态零联动；stage 屏障关闭时事件唤醒父票 assignee；父翻 in_review 归 leader、done 归人/PR。
- GitHub：父=普通 issue，子票区嵌描述底部 + 只读进度（1/3, 33%）；REST/CLI/Projects 字段三层数据面；文档面无状态联动；看板各是各的卡靠 group/filter。
- Linear：父=普通 issue，子票区在描述下方；团队级可选双向状态联动（子全 done→父 done，父 done→子全 done）；视图一键隐藏子票；父大可转 project。
- 共同点：父都是真实 issue 对象、子都是完整 issue、归属是子票上的显式关系字段；无一家把父做成纯会话/纯记录。
- 分歧轴只有两条：状态联动（无/无/可选）× 看板折叠（不折叠/不折叠/可隐藏子票）。
- 对 pacman 拍板点 1：同类产品无「父记录=会话」先例；主流是父卡保留 + 语义窄化。反提案（来源字段 + 会话容器）= 把 Multica 父卡三职能（原话锚点/核收线程/唤醒锚点）拆出去另设容器，属无人走过的形态，落地时三承接点需自证。

---

## 附：证据文件与复核附记

- Multica 一手归档：`/Users/xmon/.agents/wiki/raw/sources/2026-09/2026-09-30-todos-vs-multica-docs/multica/`（issues.txt / squads.txt / tasks.txt / cli.txt / inbox.txt / assigning-issues.txt；保真核验见同级 `/Users/xmon/.agents/wiki/raw/sources/2026-09/2026-09-30-todos-vs-multica-docs/README.md`）。
- 仓内研究：`/Users/xmon/.herdr/worktrees/pacman/hp-pacman-t-0033-xmon-98/docs/research/r12-save-and-start-behavior.md`、`r10-multica-runtime.md`、`r13-multica-runtime-verify.md`。
- wiki 页：`/Users/xmon/.agents/wiki/wiki/todos.dev 与 Multica 对照.md`（依据 wiki：[[todos.dev 与 Multica 对照]]）。
- 抓取留档（/tmp）：`xmon98-gh-browse.md`、`xmon98-gh-add.md`、`xmon98-gh-proj.md`、`xmon98-gh-api.md`、`xmon98-gh-copilot-assign.md`、`xmon98-linear.md`、`xmon98-linear-display.md`；通道 = agent-reach web（Jina Reader `r.jina.ai`），URL 定位 = agent-reach Exa 搜索（mcporter exa）。
- 复核状态汇总：Multica 快照六页（一手归档，逐行读原文）、GitHub 五页（live 抓取复核）、Linear 两页（live 抓取复核）全部闭环；无 `[转引]` 残留项。抓取期间本机代理瞬断数分钟（curl exit 35），恢复后全部页面补抓成功——已核内容不受影响。
- 口径诚实项（非缺口重申）：GitHub「父子状态零联动」的依据 = sub-issues 相关四页无 rollup 机制记载，非穷尽证明（§2.3 `[推断]` 标注）；r12 侧 M-实 票面条目沿用其 2026-10-02 multica CLI 重拉口径，本篇未重拉票面。
