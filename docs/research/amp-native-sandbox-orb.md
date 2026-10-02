# Amp：原生机器执行模型、沙箱设计与 Orbs

调研日期：2026-10-02。对象：Amp（Amp Code Inc.，原 Sourcegraph 孵化的 coding agent，官网 ampcode.com）。回答三个问题：Amp 怎么对待「agent 跑在真实机器上」这件事（本地有没有沙箱、靠什么兜底）、这套选择背后的设计理念、以及「ORB」到底指什么。所有结论钉一手来源，来源清单见文末；二手与未证实项单独标注。

## TL;DR

1. **本地没有 OS 级沙箱，默认连审批都没有。**Amp CLI 在用户真机上直接执行工具与 shell 命令，官方文档原话「By default, Amp does not ask for approval before running tools」。安全兜底靠三件事：可选的权限规则系统（allow/ask/reject/delegate，可对接外部策略程序乃至 OPA）、自动密钥脱敏（secret redaction）、以及官方明示「常接触不可信来源就请用隔离开发环境」——隔离被当成用户环境的责任或 Amp 自己的云产品，不是本地进程的属性。
2. **设计理念是「反馈优先、可逆免闸、错误预期内」**：限制工具会逼 agent 绕路（禁 Read 它就 `cat`），Git 让错误编辑的代价趋近于零，所以不值得为可逆动作设闸；真正要闸的是不可逆动作（部署、动生产库）。再往上一层是「追随前沿」的产品哲学：模型已经不需要编辑器扶手，agent 想在你不盯着的时候也能跑——这直接推出了 Orbs。
3. **ORB = Amp 的产品概念「Orbs」**：每个 thread 一台一次性远程沙箱机器（Debian 12 VM，算力由 e2b 提供，六档 size，按分钟计费，闲时暂停零成本，快照加速冷启动）。它不是 OrbStack，与本地容器工具无关。官方的定位话术就是「machine as sandbox」：「People hear the term 'sandbox' and think we're talking about child's play. But Orbs range from tiny to extra extra large.」

## 0. 背景：Amp 的两个组件与三种执行面

安全参考页把系统拆成两个组件（官方声称，ampcode.com/security）：

- **Amp Client**：终端用户应用，主要是 Amp CLI。负责本地代码与上下文管理、本地设置、本地 thread 历史；按 Amp Server 的请求在本地执行工具。
- **Amp Server**：ampcode.com 上的多租户云服务（GCP）。负责认证、workspace、thread 同步与存储、用量计费；LLM 推理由 server 授权并下发 request-scoped 凭据。Amp 不提供自托管部署（可 BYOK）。

agent 的「身体」可以落在三种执行面（docs/cli「Choose Where the Thread Runs」，`amp --executor local|orb|runner:<id>`）：

| 执行面 | 机器是谁的 | 隔离形态 |
|---|---|---|
| local | 你的原生机器 | 无 OS 沙箱，权限规则 + 审批可选 |
| orb | Amp 云（e2b） | 每 thread 一台独立 VM |
| runner | 你的另一台原生机器（常驻 `amp --no-tui`） | 同 local，机器自己就是边界 |

## 1. 「原生机器当沙箱」的真实机制

用户问题里的「把原生机器当沙箱用」需要拆成两半回答，因为 Amp 的官方叙事恰好是反的：**原生机器上它不做沙箱，沙箱是它卖给你的另一台机器（orb）**；但原生机器可以被当成远程执行面（runner），这一点上「机器即边界」的说法成立。

### 1.1 本地执行面：无内核隔离、默认无审批

docs/tools 页两段原文（官方声称，2026-10-02 访问）：

> By default, Amp does not ask for approval before running tools.

> Amp acts on content in your workspace. Untrusted repositories, MCP servers, and other external inputs can influence what Amp does. If you regularly work with untrusted sources, consider creating a custom policy plugin, or using an isolated development environment.

也就是说：本地跑 = agent 以你的用户权限直接读写文件、执行 shell；对 prompt injection 与不可信仓库的风险，官方给的出口是「自己套隔离开发环境」或「写策略插件」。全部官方文档（docs、news 153 篇 slug、security 页）中检索不到 sandbox-exec / Seatbelt / bubblewrap / Landlock 等任何 OS 级本地沙箱机制（检索日 2026-10-02；「未提及」不等于「不存在于闭源代码里」，但官方从未声称过）。

对照（依据 wiki：[[Agent 沙箱与快照加速]]）：Codex 走的是另一条路——Linux 下 Bubblewrap 命名空间断网 + 只读挂载 + 系统调用过滤，macOS 下 `sandbox-exec` 加载 Seatbelt 规则，写入封闭在工程目录内。Amp 明确没有选这条路。

第三方佐证（e2b 官方文档，e2b.dev/docs/agents/amp）：e2b 提供预装 Amp 的沙箱模板，推荐用法是 `amp --dangerously-allow-all -x "..."`，并解释「Auto-approving tool calls is contained by the sandbox: the agent cannot touch your host machine, local files, or credentials」——即 **Amp 自己的全自动模式要靠外部沙箱容器化，隔离来自 e2b 而非 Amp**。这与 1.1 的官方口径互为印证。

### 1.2 权限规则系统：本地安全的正主

news/tool-level-permissions（2025-08-07）与 notes/permissions（How We Think about Permissions）给出完整模型（官方声称）：

- 每次工具调用前，Amp 按顺序匹配 `amp.permissions` 规则列表，命中即执行动作：**allow / ask / reject / delegate**；全部未命中则回落到「内置默认权限列表（sensible defaults）」（内置列表的具体内容未获取到，manual 页需 JS 渲染，见「未证实」节）。
- 规则可匹配任意工具（含 `mcp__*` 通配）及其参数，参数值支持通配符：`{ "tool": "Bash", "matches": { "cmd": "*git*push*" }, "action": "ask" }`。
- **delegate**：把裁决交给 `$PATH` 上的外部程序，stdin 收 JSON 工具参数，exit 0=allow、1=ask、2=reject（stderr 回传给模型）。官方给了两个进阶样例：一个 bash helper（有未暂存改动时拒绝 `git push`）；以及把裁决转发给 **Open Policy Agent** 服务器做集中策略管理。
- CLI 面有配套命令：`amp permissions edit/add/test`，`amp tools list/show`（看 MCP 工具的参数 schema 再写规则）。

### 1.3 其它本地防护：secret redaction

news/secret-redaction（2025-05-30）：Amp 自动识别密钥并替换为 `[REDACTED:aws-access-key-id]` 类标记，使其不进入 LLM 上下文、其它工具或 ampcode.com。security 页把这条列进 prompt injection 的 defense-in-depth 层（同层还有：只用最新前沿模型、web 检索走 Parallel 的注入防御、thread 审计留痕、企业数据管理 API、最小化数据保留）。

### 1.4 Runners：把你的原生机器变成远程执行面

docs/cli/runners（官方声称）：`amp --no-tui --runner-id <id>` 把任意一台你能跑 `amp` 的机器注册成 runner，从 ampcode.com 远程派发 thread 到它上面执行——官方例子就叫 `grandmas-garage-server`。要点：

- 一个 runner 可服务多个目录（`--dir` 重复传、`--discover-dirs` 自动扫描 Git checkout 与 worktree，深度/排除模式可配，macOS/Linux 用文件系统 watcher 实时增删）。
- `--desktop` 给 runner thread 配图形桌面：**macOS 直接捕获并控制这台 Mac 的真实屏幕**（装 `Amp Desktop Helper.app`，要 Screen Recording + Accessibility 权限）；**Linux 则起一个 1280x720 的无头 labwc compositor + Waymote 串流**（官方注明「the same stack that orb desktops use」），不碰你自己的会话。
- runner 上没有任何额外隔离——它就是那台原生机器本身。news 侧的演化线（slug 时序）：`agents-anywhere` → `the-mac-app-is-your-runner` → `one-runner-many-worktrees` → `one-runner-is-now-enough` → `shared-runners`，方向是把「你自己的机器」做成与 orb 对等的可派发算力。

### 1.5 Orbs：真正的沙箱是「整台机器」

当 Amp 要「无人监督地跑」时，它不在本地上锁，而是把执行面整体搬到云：**每个 orb thread 一台全新、隔离的远程机器**，预装你的代码、插件、开发工具（docs/orbs）。机制细节见第 3 节。docs/orbs 的原话：「The agent has a whole machine to itself, so it can install dependencies, run your app, spawn browsers, and test its work end to end.」

## 2. 设计理念

### 2.1 权限哲学：反馈优先、可逆免闸、错误预期内

notes/permissions（How We Think about Permissions，页面无作者署名）是本地模型的第一手论证，三个论点（官方声称，引句为原文）：

1. **反馈优先**：「agents work best when they can get feedback about the changes they are making」。模型和人一样要靠编译器报错、测试失败、红波浪线迭代收敛；「Taking tools away, like preventing the agent from reading certain files, makes the agent look for an alternative, like running a Bash command instead」——限制不消灭能力，只制造绕路。
2. **可逆的动作不配闸**：「Most people do not worry about file edits anymore, because Git makes the cost of a wrong edit negligible. Restrictions aren't necessary for tools like this with an easy undo action.」commit 可以 drop/amend，数据库事故靠备份把损失压到近零——闸只该设在真正不可逆处（触发部署、访问生产库）。
3. **承认错误的环境优于杜绝错误的环境**：「Errors occur both for models and humans, and building an environment acknowledging this produces better outcomes than trying to prevent all errors in the first place.」对「AI drop 了我的生产库」这类流行故事，官方回应是：讲这故事的人通常没做备份——安全是环境属性（版本控制、备份），不是审批弹窗属性。

同时官方承认两种操作者都合法（risk-tolerant 全天多开 vs cautious 逐步审查），权限系统对两者都支持：全自动档官方给的示例配置只剩两条规则——`ask Bash --cmd '*rm*rf*' ...` 加 `allow '*'`，即**默认放行、只对疑似大规模删文件的命令形态拦一下**。

### 2.2 产品哲学：追随前沿，随时自毁

manual 首页自我定位（官方声称）：「Opinionated: You're always using the good parts of Amp. If we don't use and love a feature, we kill it.」「On the Frontier: Amp goes where the models take it. No backward compatibility, no legacy features.」

news/the-coding-agent-is-dead（2026-02-19）是这条哲学的极端样本：宣布杀死自家 VS Code/Cursor 扩展（定时自毁），理由是「By keeping these new models in an editor sidebar, we restrict them.… They want to write code and run even when you're not sitting in front of your editor.」——模型已经不需要编辑器扶手，把它们锁在 sidebar 里是在按住前沿。CLI 被定位成「梯子」：爬到下一层后可能也不要了。**这解释了为什么本地沙箱不是他们的优先级：他们的答案是让 agent 离开你的机器（orbs），而不是把你的机器改造成监狱。**

### 2.3 Orbs 哲学：机器从宠物变牲畜，摩擦归零

- news/agents-in-orbs（2026-06-30）：以前多开 agent 要 worktree、要 SSH 上远程机、要抢本地资源；orb 把这件事变成「在同一个界面里、紧挨着本地 agent、用同一套控制」一键生成，于是「you tend to do it a lot more」——bug report 直接变成 agent 与调查而非工单。
- what-are-orbs：「Orbs are infinite. You can spawn as many as you want without running into any resource issues. No port conflicts, no disk space shortage, no memory pressure.」并点名范式转变：「instead of treating machines on which your agents run as pets… you just stop thinking of the machine altogether. You go from 'is this worktree dirty?' to 'what do I want to get done?'」——**机器本身从心智模型里消失，只剩任务**。这正是「原生机器当沙箱」的反命题：沙箱不该是你保养的那台机器，而是用完即弃、无限供应的一次性机器。
- notes/what-i-want-to-tell-you-about-orbs（Thorsten Ball，2026-08-04）：零摩擦带来的第二层变化是 agent 跑得更远——「wait, it's in an orb, I don't give a damn how long this runs」。于是工作流变成向 agent 索要证明：「I want you to give me 100% proof that what you did works. Test this end to end.… Show me a screenshot, a video, anything that's solid proof!」agent 真的会跑 8-30 分钟自证，review 负担从「读 800 行 diff」变成「看一沓证据」。他列的 orb 配料表第一项就是「secure sandbox」，随后是 scale to zero、ephemeral、durable agent loop、多端可控、portals、multiplayer、automations。
- notes/orbs-explained（Thorsten Ball，2026-08-25）回应命名争议：「Yes, they are VMs, or sandboxes, or whatever you want to call them. Remote machines that we spin up for you, put your code into, and start the Amp agent on.」之所以不叫 remote agents/cloud agents，是因为 portals、可分享 thread URL、multiplayer、定时唤醒、agent 生 agent 这些围绕机器的产品面让「它比 VM 多出一整个东西」。

### 2.4 安全与能力的平衡点

把三层拼起来，Amp 的取舍清晰（综合官方各页的归纳，非单页原文）：

- **能力面**：本地零隔离、默认零审批，保证反馈回路完整（跑测试、装依赖、起服务都不打折扣）；
- **责任面**：可逆动作交给 Git，不可逆动作交给用户配置的规则/审批/delegate 策略（企业可上 OPA 集中管理）；密钥靠 redaction 在源头掐断；
- **隔离面**：需要真隔离（不可信输入、无人监督、大规模并行）时，不改造本地，而是整体切换到 orb——隔离作为产品卖，而不是作为限制强加。security 页对 prompt injection 的总纲即 defense in depth：「no single control is perfect, so we layer multiple mechanisms to reduce likelihood, blast radius, and detection time.」

## 3. ORB 是什么

### 3.1 定论

**Amp 语境下的 ORB/Orb = Amp 为每个 thread 创建的一次性远程沙箱机器**，是 Amp 的一等产品概念（有独立文档区 docs/orbs、独立营销页 what-are-orbs、专属命名文化「it's orbin' time」）。安全参考页定义：「An orb is a sandboxed cloud machine that runs the agent for a thread.」

### 3.2 机制事实（均为官方声称，源见文末）

- **算力底座**：e2b。「e2b provides ephemeral compute instances for Amp orbs」（security 页基础设施清单）。e2b 官方对自家沙箱的定义是「A fast, secure Linux VM created on demand… which you can pause and resume as needed」（e2b.dev/docs）。
- **操作系统与环境**：Debian 12，预装 `amp`（激活后已认证）、`gh`、Git/SSH/tmux、Bun/Node/npm/pnpm/Yarn、Python/pip/uv、`agent-browser`、ffmpeg/ImageMagick/jq/fzf/ripgrep 等；Docker 默认不装，可在 setup 脚本里装并以受管服务运行（docs/orbs/customizing）。
- **规格与计费**：六档 size，从 a1.tiny（1 CPU/2GB/60GB，$0.08/h）到 a1.3xlarge（16 CPU/44GB/60GB，$2.13/h），按分钟计费；agent 空闲几分钟后自动暂停，暂停零成本，可睡数周，再发消息即唤醒（对话、文件、服务原地恢复）（what-are-orbs、docs/orbs）。
- **冷启动加速：快照**。每个项目×size 维护一份 prepared orb 快照（含仓库 clone + setup 脚本产物），最长复用 72 小时后强制重制；生命周期由仓库内两个可执行文件驱动：`.agents/setup`（装机，20 分钟超时，必须幂等，退出时杀掉一切遗留进程）与 `.agents/resume`（每次唤醒后 10 秒内的认证/修复钩子）；另有项目设置里的 pre-clone/pre-setup 脚本（docs/orbs/customizing）。
- **机器面产品**：Terminal 面板（与 agent 共享同一 tmux 会话与文件系统）、Files 面板与 512MB 上传、diff review、Portals（任何监听端口的 HTTP 服务获得一个可分享的公网 URL）、multiplayer（多人共享同一 orb thread）、Automations（定时唤醒）、Webhooks（CI/GitHub/Linear 事件直接生成 orb thread）、Agent-to-Agent（agent 配置 orb 内软件、生成新 orb 里的其它 agent、互传消息与文件）（what-are-orbs、docs/orbs）。
- **与本地打通**：`amp sync <thread>` 把 orb 里的改动镜像回本地 checkout；CLI 里 `amp -ox "..."` 直接在 orb 起 execute-mode thread；TUI 命令面板 `thread: new in orb`（docs/orbs、news/agents-in-orbs）。
- **安全与凭据**：orb 文件系统与快照静态加密（AES-256 卷级）；orb 生命周期与 thread 绑定，删 thread 秒级删 orb；密钥管理首选 **OIDC workload identity**（issuer `https://ampcode.com/api/workload-identity`，setup/resume 阶段分别授予项目级/线程级短期凭据，避免长效 secret 落盘），workspace/个人环境变量与 `amp secrets` CLI 为辅，orb shell 输出中的 secret 值自动遮蔽（security 页、docs/orbs/handling-secrets）。
- **配额**：每用户 20 台计量 orb 的突发额度，之后每 5 分钟放行一台新 orb（排队不失败）；企业可提额（docs/orbs）。

### 3.3 候选排除

- **OrbStack（macOS 容器/Linux VM 工具，CLI 名 `orb`）**：排除。Amp 全部官方文档、news、security 页无一处提及 OrbStack；orbs 跑在 e2b 云端算力上，与本地容器运行时无关。名字撞车纯属巧合。
- **CORBA ORB（Object Request Broker）**：排除。与 Amp 语境无交集，本次检索的一手来源中零出现。
- 若用户听到的「ORB」来自 Amp 的播客/X 宣传（如「it's orbin' time」梗，notes/orbs-explained 开篇引用的用户来信），指的也是同一个 Orbs。

## 4. 对 pacman 的关联（一段话）

依据 wiki：[[todos.dev 与 Multica 对照]]、[[pacman 的编排器坐标与借鉴清单]]：Amp 的位置是「执行面产品化」的极端样本——todos 把托管 runtime 沙箱做进产品但外部 runtime 明说 unsandboxed，Multica 干脆声明不做文件系统沙箱并把边界推给 daemon 之外，而 Amp 把「每台机器用完即弃 + 快照预热 + OIDC 短期凭据 + portal 暴露服务」打包成计费产品，同时本地面坚持零隔离零审批、把闸做成可编程规则（直至 delegate 给 OPA）。对 pacman 最有直接借鉴价值的是两点：`.agents/setup`/`.agents/resume` 这对「仓库内声明环境生命周期」的钩子形态（与 pacman 的 daemon enroll / runtime 发现同构），以及「不可逆动作才设闸、可逆动作靠版本控制兜底」的闸门分配原则（与 pacman 两闸语义兼容，可用于校准哪些步骤值得卡）。

## 5. 未证实 / 检索边界

- **内置默认权限列表**的具体内容（「sensible defaults」长什么样、哪些命令形态默认 ask）：news/tool-level-permissions 提到其存在，但正本在 ampcode.com/manual#permissions——该页为需 JS 渲染的 SPA，Jina Reader 只取到目录壳，本次未能读取原文。
- **notes/permissions 的作者**：页面无署名（示例输出里出现 `/Users/dhamidi/`，不据此猜测作者）。
- **e2b 的虚拟化底层**（业界通识为 Firecracker microVM）：e2b 本次读到的页面只自称「secure Linux VM」，未复核 Firecracker 表述，不作为本文结论使用。
- github.com/sourcegraph/amp 仓库已 404（改名或转私有，2026-10-02 实测），故无源码级验证，全部机制描述的证据强度上限为「官方声称」。
- 播客（Raising an Agent）与 Chronicle 未逐集检索；文中哲学引语全部来自文字版 notes/news。

## 6. 来源清单

全部访问日期 2026-10-02，抓取通道 agent-reach web（Jina Reader）/ exa 语义搜索 / gh CLI。「官方声称」= Amp 第一方文档；「第三方官方」= e2b 第一方文档。

| # | 来源 | URL | 日期 | 证据强度 |
|---|---|---|---|---|
| 1 | Amp Docs 首页（Introduction） | https://ampcode.com/manual | 访问 2026-10-02 | 官方声称 |
| 2 | Amp Security Reference | https://ampcode.com/security | 访问 2026-10-02 | 官方声称 |
| 3 | Orbs Overview | https://ampcode.com/docs/orbs | 访问 2026-10-02 | 官方声称 |
| 4 | What Are Orbs? | https://ampcode.com/what-are-orbs | 访问 2026-10-02 | 官方声称 |
| 5 | Customizing Orbs（生命周期/快照/setup/resume） | https://ampcode.com/docs/orbs/customizing | 访问 2026-10-02 | 官方声称 |
| 6 | Handling Secrets（OIDC workload identity） | https://ampcode.com/docs/orbs/handling-secrets | 访问 2026-10-02 | 官方声称 |
| 7 | Getting Started With the CLI（executor 三面） | https://ampcode.com/docs/cli | 访问 2026-10-02 | 官方声称 |
| 8 | Runners（含 desktop/labwc+Waymote） | https://ampcode.com/docs/cli/runners | 访问 2026-10-02 | 官方声称 |
| 9 | Tools（默认无审批 + 隔离环境建议 + Permissions 节） | https://ampcode.com/docs/tools | 访问 2026-10-02 | 官方声称 |
| 10 | How We Think about Permissions | https://ampcode.com/notes/permissions | 访问 2026-10-02 | 官方声称（理念一手） |
| 11 | News: Tool-Level Permissions | https://ampcode.com/news/tool-level-permissions | 发布 2025-08-07 | 官方声称 |
| 12 | News: Secret Redaction | https://ampcode.com/news/secret-redaction | 发布 2025-05-30 | 官方声称 |
| 13 | News: Agents in Orbs | https://ampcode.com/news/agents-in-orbs | 发布 2026-06-30 | 官方声称 |
| 14 | News: The Coding Agent Is Dead | https://ampcode.com/news/the-coding-agent-is-dead | 发布 2026-02-19 | 官方声称（理念一手） |
| 15 | Notes: Orbs, Explained（Thorsten Ball） | https://ampcode.com/notes/orbs-explained | 发布 2026-08-25 | 官方声称 |
| 16 | Notes: What I Want to Tell You About Orbs（Thorsten Ball） | https://ampcode.com/notes/what-i-want-to-tell-you-about-orbs | 发布 2026-08-04 | 官方声称 |
| 17 | e2b Docs: Run Amp in a secure E2B sandbox | https://e2b.dev/docs/agents/amp | 访问 2026-10-02 | 第三方官方 |
| 18 | e2b Docs 首页（sandbox = on-demand Linux VM） | https://e2b.dev/docs | 访问 2026-10-02 | 第三方官方 |
| 19 | Amp sitemap（news 153 条 slug 全量扫过，无本地 OS 沙箱相关条目） | https://ampcode.com/sitemap.xml | 访问 2026-10-02 | 官方声称（结构性证据） |
| 20 | wiki [[Agent 沙箱与快照加速]]（Codex sandbox-exec/bubblewrap 对照、E2B 生态位） | 本地 `~/.agents/wiki/wiki/` | 2026-09-29 ingest | 二手（本机沉淀） |
| 21 | wiki [[todos.dev 与 Multica 对照]]、[[pacman 的编排器坐标与借鉴清单]] | 本地 `~/.agents/wiki/wiki/` | 2026-09-30/10-01 | 二手（本机沉淀） |
