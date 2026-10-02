# XMON-98 lane C：herdr / herdr-projects 父子形态取证（只读）

对象：本机 herdr（client 0.9.3 / server 0.9.1，`herdr status` 实测）+ herdr-projects 插件（0.2.34+4e4548c，二进制 `/Users/xmon/.config/herdr/plugins/github/herdr-projects-b1278ffb803c/target/release/herdr-projects`，下文简写 `hp`，均带 `--root /Users/xmon/.herdr-projects`）。取证全部只读：`--help` / `list` / `show` / `overview` / `context` / `skill` / Read / ls。取样项目 = `pacman`（本调研线程自己就是该项目 t-0033 线程，本身就是一份活样本）。

---

## 1. 「项目」和「线程」各是什么对象；父/子概念存不存在

**项目 = 磁盘上一个文件夹 + 一个常驻 coordinator agent。** [实测]

```
$ ls /Users/xmon/.herdr-projects/pacman/
AGENTS.md  CLAUDE.md->AGENTS.md  MEMORY.md  PROJECT.md  TASKS.md
inbox/  library/  memory/  routines/  scratch/  threads/  uploads/  .state/
```

`PROJECT.md` 头部是 TOML 设置（`hp --help` 的 `set` 子命令列全：name / goal / coordinator_profile / thread_profile / max_parallel_threads=6 / auto_resolve_days=7 / repos），正文是常驻指令。README「Where does my project live?」原话："a project is a plain folder of Markdown and TOML files"（`README.md:120-122`）。coordinator 的落点在 `.state/coordinator.json`：workspace `w4V`、pane `w4V:p1`、agent_name `hpc-pacman`、cwd = 项目文件夹——即 coordinator 是一个 cwd 钉在项目文件夹里的常开 agent，全项目只有一个，跟线程平级地占一个 pane。

**线程 = 一条 worker agent 记录 + 一个 herdr pane。** [实测] 记录三件套在项目 `threads/` 下：

- `threads/t-0033.toml` —— 结构化记录：id / title / status / kind（`worktree` 或 `tab`）/ repo / branch / worktree_path / thread_dir / workspace_id / tab_id / pane_id / agent / profile / agent_name / pr / state_line / percent。[实测 Read]
- `threads/t-0033.task.md` —— 任务书正文（coordinator 写给线程的 task，follow-up prompt 也追加记录在此）。
- `threads/t-0033.md` —— 线程 report 的 home 副本（`## Report` / `## Next` / `## Remember`），resolve 后保留。

`hp thread --help` 对线程的定义原文："Threads: the project's worker agents"。coordinator skill 原文："A thread is a separate agent in its own pane: on its own git worktree and branch for code tasks, in its own folder for tasks with no repository, or on the repo's main checkout when asked."

**父/子词汇不存在。** [实测] 体系里只有三个名词：project / thread / task（TASKS.md 里的任务行）。`t-0033.toml` 全部 48 个字段里**没有任何指向父任务/父请求的字段**——没有 parent、没有 task 引用、没有 request id；线程与「来源请求」的唯一连结是 title 措辞和 `.task.md` 里的任务书文本。反过来，TASKS.md 的任务行在派发后会把线程 id 追加到行尾（skill 原文："append the thread id after the owner, ` · <thread id>`"，实测 TASKS.md 多行带 `· t-0029` / `· t-0032`）——即**父子连结写在父列表行上、不写在线程记录里**，且这行是可选的（skill 原文："Threads started straight from chat get no task line"），任务做完**整行删除**（"Every task is open work: delete it when it is done or cancelled; its history stays in `threads/`"）。

## 2. 用户从什么界面看「整个项目」；线程怎么呈现

四个面，全部 [实测]：

- **herdr TUI 侧边栏（主界面）**：agents 和 spaces 按项目分组——项目名加粗做组头，项目 home space + coordinator 打头，然后是线程行（needs-you 的排最前），其它 space 排最后。README.md:39 原文："Agents and spaces are grouped by project: the project's home space and its coordinator head the group with the project's name in bold, then its threads with what needs you first"。侧栏 token 实证（`herdr agent list`）：coordinator `hp_group: pacman!0!w4V:pS`、`hp_sub: "needs you · ~95% · Waiting for you"`；各线程 `hp_group: pacman!1!4!t-0033`、`hp_sub: "~30% · Awaiting lane evidence"`、`hp_rank` 1=needs you / 2=review / 4=working。线程行 = id+标题 + 一行补充（`review · PR #618` / `~40%` / agent 自己报的 activity）。
- **projects popup**（`prefix+a`，`hp popup`）：单弹窗装 threads / tasks / inbox / routines / settings，每线程的 Next 列表一键可达（README.md:39）。`hp popup [SLUG]` 可 scope 到单项目，默认当前 workspace 的。
- **tab bar 计数**：`hp needs-you` 实测输出 `projects: 1 need you`——项目在 tab bar 上只以计数形态出现。
- **`hp overview` / `hp context`（CLI 面）**：overview 把项目打成**一行标题** `pacman (active) — <goal>`，下面线程按 `Ready for review / Working / Resolved` 三组排——resolved 的 27 条仍全列（记录不删）。`hp context` 是 coordinator 每回合读的 digest：设置、goal、memory 索引、TASKS.md、开着的线程+live state+Next、inbox。
- **TASKS.md 本身**：用户的任务表，纯 markdown checklist（`- [ ] <title> (<owner>) · t-NNNN` + 缩进 notes），coordinator 是唯一写者，用户通过跟 coordinator 说话或 popup 的 task 键管理。线程的呈现不靠它。
- **线程的物理呈现 = pane**：worktree 线程独占一个 herdr workspace（workspace label 就是线程标题，`herdr workspace list` 实测 w5Q label = "XMON-98 父卡去留：三路取证 + 出建议"）；tab 线程在项目 workspace 里占一个 tab（t-0032 在 w4V:tW，`kind = "tab"`、`branch = ""`，实测 t-0032.toml）。状态 = herdr 生命周期（idle/working/blocked）+ 线程自报的 percent/activity（progress hooks）。

## 3. 线程怎么归属到项目；「父记录」等价物是什么

**归属全靠磁盘布局与命名，没有外键。** [实测]

- 线程记录放项目文件夹 `~/.herdr-projects/pacman/threads/` 下；
- worktree 路径嵌项目名：`/Users/xmon/.herdr/worktrees/pacman/hp-pacman-t-0033-xmon-98`；
- thread_dir 再嵌一次：`<worktree>/.herdr-project/pacman-t-0033`（项目 slug + 线程 id 拼名；tab 线程则在 `~/.herdr-projects/pacman/threads/t-0032/.herdr-project/pacman-t-0032`，实测两处 toml 的 thread_dir 字段）；
- herdr 侧边栏 token 再钉一次：`hp_project: pacman`。
- 也就是同一归属写了四遍（记录目录 / worktree 名 / thread_dir 名 / sidebar token），零处是数据结构里的引用字段。

**「父记录」等价物有三件半**（对应用户一次请求 → N 线程）：[实测]

1. **线程自己的 `.task.md`**：coordinator 按线程写的任务书全文 + 每次 follow-up prompt（skill 原文："Every prompt is recorded in the thread's task file, so a restarted thread sees it"）。这是最接近 r12 §5.2 说的「原文锚点」的东西——但它是 per-thread 的，不是 per-request 的。
2. **组装出的 `brief.md`**（thread_dir 内，实测 46.3K）：项目头（goal/repos/uploads/library/report 路径）+ "You are one thread of a Herdr project" + 项目指令 + 全部 memory + 任务书，一次 Write 落盘给线程。
3. **TASKS.md 任务行**（半件，因为可选且易逝）：派发时行尾缀 `· t-NNNN`，做完整行删，历史靠 `threads/` 的记录。
4. **coordinator 会话本身**：用户的原话落在 coordinator pane 的对话里；需要用户拍板的活可以开「决策线程」让用户直接在 pane 里谈（项目 memory/preferences.md 明文此模式，t-0018 即实例：任务书写明「用户会直接在这个 pane 里跟你对话」）。r12 §5.2 的「容器是会话」在 herdr 是字面成立的——只是这个会话是**每项目一个**的 coordinator 常驻会话，不是每请求一个。

生命周期收口 [实测]：`thread resolve` = "final copy home, then its worktree, merged branch and tab are cleaned up (reports and library are kept)"；ticker 跟 PR，merged 即自动 resolve（inbox done 实例：t-0025 resolved 事件，"worktree removed and its workspace closed; branch kept: it has commits that are not in the merged pull request"）；报告 home 副本 `threads/<id>.md` 与 `library/<id>/` 永久保留。

## 4. 项目有没有被当成一张卡/一行渲染

**没有。项目是容器，线程才是工作单元——这正是 pacman 要裁决的形态，herdr 是它的一个活实现。** [实测] 项目在四个界面里的全部形态：侧边栏**分组头**（粗体名 + coordinator 打头）、overview **标题行**、popup **scope 参数**、tab bar **计数**。没有任何界面把项目本身做成可拖/可勾/可开详情的卡或行；状态（idle/working/blocked、review、percent）全部长在线程上。任务行（TASKS.md）虽是逐条渲染的行，但它是**指针不是父卡**：可选、无状态机、做完即删，历史沉淀在 `threads/` 的线程记录里。

与 pacman 情形的两点结构差 [推断]：
- herdr 的「父」是**每项目一个**的常驻 coordinator 会话；pacman「保存并开始」的编排是**每请求一个**。herdr 没有提供 per-request 容器的现成答案，它靠 per-thread 的 `.task.md` + 可选任务行把溯源做掉了——即 r12 §5.2 反提案的「会话 + 子卡带来源字段」路线，herdr 在数据面走的是「任务书文件 + 命名嵌slug」，没有一个 sourceKind 字段。
- herdr 把「完成判定」外包给了人和 ticker：任务行由用户口述/coordinator 删，PR merged 由 ticker 自动 resolve——没有「全子卡绿 = 父解决」的自动聚合语义。

---

## 四问速答

1. 对象 = 项目（文件夹 + 常驻 coordinator agent）与线程（`threads/t-NNNN.toml` + `.task.md` + report `.md` + 一个 pane）；父/子词汇不存在，线程记录里零个父引用字段，连结只写在 TASKS.md 任务行的行尾 `· t-NNNN` 上。
2. 看项目 = herdr 侧边栏分组（粗体项目名打头）+ `prefix+a` popup + tab bar 计数 + `overview`/`context` CLI；线程 = pane/workspace，行上带 id、标题、状态、百分比。
3. 归属 = 纯磁盘（记录在项目 `threads/` 下、worktree 与 thread_dir 名嵌项目 slug、sidebar token 钉项目名）；父记录等价物 = 线程 `.task.md` 任务书 + 组装 brief.md + 可选易逝的 TASKS.md 行 + coordinator 常驻会话。
4. 项目从不渲染成卡/行：它是分组头/标题行/scope/计数；工作单元永远是线程；任务行是做完即删的指针，线程记录才是耐久物——「父是容器与会话，子才是可见工作对象」。
