# R3 · todos.dev 协议面与 executor 行为观察（黑盒）

> 目的：为「设计：架构平价」（#41）提供对外协议面与 executor 行为的一手证据：API/SSE 词表、MCP 接入形态、`tds start` executor 全行为、BYOK/密钥面、通知触发、任务生命周期深处界面（r2 §9 A/B 组补拍）。
> 素材：Ego 浏览器 TaskSpace（Profile 2「mon (2)」，free 档已登录 Xmon Dai's team `BoZYfvqKSGanlxsXVbXSa`）+ 本机 `@todos-dev/cli` 0.1.52 真机接入 + CDP Network 抓包 + CLI bundle 静态提取。
> 观察时间：2026-09-19 10:35–15:10（本地 Asia/Shanghai）。
> 视口：约 1327×683 CSS px；部分截图用 CDP `Emulation.setDeviceMetricsOverride` 放宽到 1600–2400 以容纳右侧面板（面板 footer 图标在窄视口被裁，本身是响应式行为证据）。
> **事故记录**：13:49 前存于 `/tmp` 的截图与抓包缓冲被系统清理，33–75 号截图多数为 14:43–15:15 用同编号**重拍**（实体仍在，界面等价；重拍时任务 #1 已处于合并后状态，故 58/63 等图取自新建任务 #2 的同态界面）。少数过程态（40/40b/41/41b 服务商编辑弹窗、42–44 项目创建流、46/48 卡片与门控、62/64–68/75 面板过程态）未重拍，正文引用处标 **[图失]**，文案与结构证据保留在正文。抓包词表以重放会话 + CLI bundle 静态提取双源互证。
> 密钥卫生：API key（`tds_…`）、机器 token（machine.json）、BYOK 网关 key 一律**只记形态不记值**；BYOK 网关为用户本地 Tailscale 段 OpenAI/Anthropic 兼容网关（12 模型，`/v1/models` + `/v1/messages` 实测可用）。

## 0. 阅读约定

- 编号 `NN-屏名.png` 位于 `docs/research/assets/r3/`，子态 `NNb/NNc`。延续 r2 序列（r2 至 32，r3 自 33 起）。
- 断言出处三类：**截图 NN**、**API/抓包**（本会话 CDP Network 记录或 `page.fetch` 重放）、**CLI**（`~/.tds` 状态文件、daemon.log、bundle 静态 grep）。无出处由行为/命名推断的标 **[推断]**。
- 文案照抄原文（含标点），i18n 语料直接可用。

---

## 1. Executor：`tds` CLI 全行为（票 §3）

### 1.1 安装与命令面（CLI：`tds --help` 实测）

- 安装：`npm install -g @todos-dev/cli@latest` → 0.1.52；包体 275M（含平台二进制 `@todos-dev/cli-darwin-arm64` 等 6 平台 + 内嵌依赖）。
- 命令：`start`（后台上线，缺省注册）/ `stop` / `restart` / `logs [-f]` / `logout` / `status` / `version` / `provider`（提示「Providers are managed on the website」）。
- 环境变量：`TDS_SERVER`（默认 server URL）、`TDS_API_KEY`、`TDS_TEAM`、`TDS_WORKSPACES_DIR`（一次性覆盖，不持久）、`TDS_HOME`（默认 `~/.tds`）。
- `tds start` 选项：`--foreground/-f`（attached，供 pm2/systemd/容器托管）、`--api-key <k> --team <id>`（非交互注册，**覆盖既有注册以换团队**）、`--name`（默认 hostname）、`--server`、`--workspaces-dir`（持久；父目录必须已存在，防误落启动盘——原话「if that drive is unmounted tds refuses to start instead of cloning onto the boot disk」；改目录不迁移既有 clone）。
- 官方语义（help 原话）：默认 detached + supervisor 跨崩溃保活；「Once online the machine claims builds for its agents; agent shell access is managed from the machine's page in the web app — the daemon picks changes up within a few seconds, no restart needed」。

### 1.2 注册路径（两条；命令弹窗文案同 r2 11b，本会话重拍时机器位已满，弹窗为限额态 33）

- 浏览器授权：`tds start` 无参 → 打开登录页授权团队（本次未走）。
- API key 非交互（云服务器路径）：「添加机器」弹窗底部「在云服务器上运行？改用 API key 注册」展开 `tds start --api-key <key> --team <teamId>` + 「获取 API key →」跳 `/app/api-keys`（命令文案与 r2 11b 相同；本会话重拍图 [图失]）。teamId 直接内嵌在命令里。
- **free 档 1 台上限实测**：机器位满后再点「添加机器」→ 弹窗变体「当前套餐最多 1 台机器，团队已有 1 台。请移除一台，或升级套餐后再添加。」+ `升级到 Pro`（33-machine-add-limit）——r2 §7.1 套餐表 `添加自有机器 1/4` 的活体门。
- 实测：`--api-key … --team …` → `Enrolled in team BoZYfvqKSGanlxsXVbXSa (machine TlZ2sSD4EJCxjNJqVhdo_)`，后台 pid，`Started in background`。
- **logout 语义**（API+UI 实测）：`tds logout` 只 Forget 本机注册；服务端机器记录**保留**，机器页显示 `r3-mbp 离线 …NJqVhdo_ · max 3`（35c）。重新 `tds start --api-key` **复用同一 machineId**（服务端按 key/team 认机器 [推断]）。

### 1.3 本地状态布局（CLI：`~/.tds` 实测）

```
~/.tds/
  machine.json    {machineId, token(64hex), teamId, serverUrl}   # 机器 bearer
  device.json     {deviceId(32hex)}                               # 跨机器实例的设备指纹
  daemon.json     {pid, startedAt, runner:"cli"}
  daemon.log      supervisor + machine + step + workspace + recover + wake 前缀日志
  outbox/         # 出站事件缓冲（离线补发 [推断]）
  chat-sessions/  # 会话持久化（pi session）
  agent-runtime/  # 运行时目录
  workspaces/     # 见 1.4
```

### 1.4 worktree 布局与 git 契约（CLI bundle 静态提取 + daemon.log 实测互证）

- 基座 clone：`<workspacesRoot>/<projectId>/repo`（`baseRepoDir`）。
- 任务 worktree：`<workspacesRoot>/<conversationId>`（**目录名=conversationId**，UUIDv7，如 `01a0b86f-04f9-72a8-bba4-75c5cfd6598f`）。
- 分支：`tds/conv-<conversationId>`（`convBranch`）；创建 `git worktree add -b <branch> <dir> <base>`，base=`origin/<convBranch>`（已 fetch 时）否则 `origin/<defaultBranch>`。
- 复用/恢复：worktree 存在→`Worktree reused`；checkpoint 恢复→`git reset --hard <commit>` + `git clean -fd`（`Worktree restored`）；陈旧→`worktree remove --force` + `worktree prune` + `branch -D`；孤儿回收 `cleanupOrphanWorktrees(ttlMs = 7*24h)`。
- 并发保护：`projectLock(projectId)` 串行化同项目工作区操作。
- 防分叉护栏：`REMOTE_BRANCH_DIVERGED = "remote branch diverged"`——`origin/<branch>` 有本机没有的提交且 worktree 不在该分支时抛错；合并用 `git merge --no-edit <ref>`。
- 托管 repo 的 git 远端：`https://git.todos.dev/<teamId>/<repoName>`（daemon.log `Cloning BoZYfvqKSGanlxsXVbXSa/r3-lifecycle (branch: main)`；手动 fetch 无凭证失败=凭证仅 per-step 注入，见 1.6）。
- push 语义（`push_branch` 工具描述原话）：「Commit all work in the worktree and push this conversation's own working branch (tds/conv-*) to the remote repo. The branch is normally pushed only when …」——每步结束自动 push（daemon.log `pushed tds/conv-…` ×3 次运行全中）。
- 网络重试预算（bundle 注释原话）：push 重试覆盖 git-host 5xx 窗口；冷 worktree 加 ls-remote+fetch「~2 min typical, ~8 min worst on /done's path」；merge 轮走 gitNetwork。

### 1.5 运行时行为（daemon.log 实测）

- 上线序列：`Loading pi runtime…` → `Online (machineId=…); polling https://todos.dev` → `Idle-sleep prevention active (caffeinate)` → `[recover] no pending steps found` → `maxConcurrent changed null -> 3` → `[wake] push channel connected`。
- **executor 内嵌 pi runtime**：日志直接 `Loading pi runtime…`；依赖清单 `@earendil-works/pi-ai@0.84.3` + `@earendil-works/pi-coding-agent@0.84.3`（package.json 明文）。→ 地基票 #39 关键事实：todos.dev 自家 executor 即 pi 构建。
- 领取模型：HTTP 长轮询 `claim`（实测节奏 ~75–76s 一次）+ SSE `wake` 推送通道（低延迟派发）。网络断时 claim 指数退避封顶 30s，presence 心跳并行失败，进程不退出。
- 崩溃恢复：`[recover]` 前缀 + `no pending steps found`——存在步骤 journal 恢复机制（细节未展开 [推断]）。
- 退出：SIGTERM → `[machine] Shutting down…` → `[supervisor] stopped`（实测 restart/stop 两轮）。
- 代理探测：启动打印 `[tds] Proxy: http://127.0.0.1:7890`（读系统/环境代理）；代理死时持续重试（观测 10+ 分钟不退出）。
- 步骤生命周期：`claim step=<id>` → `step <id> for conv <uuid> (n/3 running)` → `using model r3-gw/claude-sonnet-5`（provider/model 串）→ workspace 准备 → `new session <convId>`（续跑时 `continue session <convId>`——**合并轮复用执行轮的 pi session**）→ `pushed tds/conv-…` → `finished (m/3 running)`。
- 步骤类型（观测）：规划步、执行步、合并步（发起合并后机器新领一步，文案「git merge origin/main 结果为 "Already up to date"」= 合并步在机器上以 git 操作执行，非服务端代做）。
- 事件词表（bundle 静态提取，pi 流事件+机器控制）：`text_delta`、`thinking`/`thinking_delta`、`toolcall_end`、`message_update`/`message_end`/`message_stop`、`compaction`/`compaction_start`/`compaction_end`、`auto_retry_start`/`auto_retry_end`、`steer`、`done`、`error`、`wake`、`shutdown`；配置 kind：`api_key`/`oauth`/`http`/`stdio`。
- 流超时护栏（bundle）：`streamFirstEvent: 300000`、`streamIdle: 480000`、`streamBodyTimeout: 540000` ms。
- 机器侧自定义工具（bundle `name/label/description`）：`web_fetch`（URL 文本，≤8000 字符）、`remote_shell`（团队内其他已授权机器的持久交互 shell）、`push_branch`（见 1.4）。其余工具面来自 pi-coding-agent 内建（bash/edit/read…，transcript 实测 `edit`/`bash` 行）。
- MCP 运行时（daemon.log 实测）：`[mcp] r3mcp: connect failed — its tools are unavailable this turn: fetch failed…`——每回合连已授权 server，失败**降级不阻断**任务。

### 1.6 机器↔服务端 REST（bundle 静态提取，`/api/machine/*`）

`enroll`、`enroll/start`、`enroll/poll`（浏览器授权流）、`me`、`presence`、`recover`、`tasks/claim`、`stream`（wake SSE）、`heartbeat/<stepId>`、`tool/<stepId>`（工具调用回传）、`token/<stepId>`（模型凭证 per-step 下发——托管 repo git 凭证与 BYOK key 均不落盘本机常驻 [推断，据 git fetch 无凭证失败+端点名]）、`upload-urls/<stepId>`（预签名上传：transcript/产物）、`done/<stepId>`。

### 1.7 `tds-tunnel` 二进制（CLI：strings 提取）

平台包内含独立 Mach-O `tds-tunnel`：内嵌 **tsnet/Tailscale 栈**（derp/magicsock/netcheck/ts2021/tun），子命令 JSON-lines 输出（`{"event":"error",…}`），strings 含 `serve`、`:2222`、`tds-exec`、`add-key/remove-key/update-key`、`checkpoint`。用途与 `GET /api/projects/{id}/preview-token?ref=main`（web 侧实测存在）相合：**任务分支 dev-preview 端口转发** [推断]。未实跑。

---

## 2. 模型服务商 / BYOK（票 §4，r2 §6.5 缺口闭合）

- **入口门控**：free 档无机器时 providers 页**没有「新建」按钮**（r2 实测）；机器上线后同页出现 `新建`（36 vs 39 对比）。门控在入口层，不在表单层。
- 添加服务商弹窗 = 搜索框 + 预设列表 + 底部「自定义端点」（37）。预设 38 项（`GET /api/teams/{id}/providers` 的 `presets[]` 原样）：
  - `auth:"oauth"` 仅 2 项：`github-copilot`、`openai-codex`（=ChatGPT/Codex 订阅连接）。
  - `xai`：`auth:"api_key"` + `oauthLabel:"Sign in with SuperGrok or X Premium"`（双通道）。
  - 其余 `api_key`：amazon-bedrock、ant-ling、anthropic、baseten、cerebras、cloudflare-ai-gateway、cloudflare-workers-ai、deepseek、fireworks、google、google-vertex、groq、huggingface、kimi-coding、minimax(-cn)、mistral、moonshotai(-cn)、nvidia、openai、opencode、opencode-go、openrouter、qwen-token-plan(-cn/-individual)、together、vercel-ai-gateway、xiaomi、xiaomi-token-plan-ams/cn/sgp、z-ai、z-ai-coding-cn。
  - 目录与 pi-ai provider 集合同源 [推断：r4 pi 清单重合]。
- 自定义端点表单（38 实测字段；探测 12 模型回显 38b [图失]）：服务商 ID（`例如 my-relay`）、名称、Base URL（`https://api.example.com/v1`）、**API 协议** 三选一 `OpenAI Completions` / `OpenAI Responses` / `Anthropic Messages`、API 密钥（可选，`无密钥网关可留空`）+ 复选「以 Authorization: Bearer 请求头发送 API 密钥」、模型（`探测模型` 按钮 + `添加模型`）、`保存前验证` 开关。
- 探测行为：对 `/v1/models` 拉列表逐项成行（display=slug 同名），Anthropic Messages 协议下也走 `/v1/models`（本会话网关实测 12 模型全列）。
- 记录形状（`GET …/providers` 实测，key 打码）：`{kind:"custom", providerId, label, baseUrl, api:"anthropic-messages", authHeader:true, compat:{supportsDeveloperRole:false}, models:[{id,name}×12], id, createdBy, createdAt, updatedAt}`；`apiKey` 只写不读（表单注：「密钥将加密存储，保存后无法再次查看。」）。
- API：`POST /api/teams/{id}/providers`（创建）、`PATCH /api/teams/{id}/providers/{pid}`（编辑）。
- **BYOK→Agent→机器闭环**：providers 保存 12 模型 → Agent 创建弹窗「模型」下拉逐项 `r3-gw · 128k`（50b [图失]，实测文案见 §4）→ 机器日志 `using model r3-gw/claude-sonnet-5`。上下文窗口默认 128k 展示。
- 观察到的显示 bug：保存成功瞬间卡片「0 模型」，reload 后「12 模型」（39）——客户端状态未刷新，非服务端问题。

## 3. 任务生命周期全链（票扩围 A1–A8，r2 §5.1 缺口闭合）

### 3.0 状态机词表（API 实测 + UI 文案）

- 看板 6 列（r2 §4.1）：`待开始 / 规划中 / 待确认 / 执行中 / 待验收 / 已完成`。
- `GET /api/todos/{id}` 字段：`phase`（实测值 `todo`/`review`/`done`；`planning`/`exec` 等未采到 [推断同族命名]）、`phaseAt`、`seqNum`、`orderIndex`、`tagIds[]`、`spec`、`assignment`、`agent`、`latestBuildId`、`lastRunAt`、`hasChanges`、`hasPlan`、`buildHistory`、`sourceTodo`、`v`。
- **buildId ≡ conversationId**（实测：`latestBuildId=01a0b86f-…` = 机器 conv 目录名 = worktree 分支后缀）。一次运行=一个 build=一个 conversation=一个 worktree+分支。
- 卡片主按钮随状态（引导 P2 原文）：「开始、确认、完成；构建失败时显示重试，等待回复时显示回复」。

### 3.1 创建（45）

- 入口：项目任务 tab `+ 任务`（空态）/ 看板右上「任务」/ 快捷键 `N`（项目页实测有效）。
- 表单：标题（`需要做什么？`）+ 结构化描述 textarea（占位四行：`我想要的结果：/现在的情况：/需要保留或避免：/我会这样确认完成：/我希望收到：`）+ 标签 + `保存任务`。
- API：`POST /api/projects/{id}/todos` body `{title, spec}`（抓包原样）。

### 3.2 开始（56）

- 门控解除条件=「一台可运行机器 + 一个可用模型」都就位后，`开始` 直接进「开始任务」dialog（无 Pro 墙）：Agent 选择（可空=未指派）、开关「规划与执行分用不同 Agent」、两个推进按钮 `先做规划` / `立即执行`。
- 指派后文案：`运行在 r3-mbp 上`。

### 3.3 规划（57/58）

- 即时反馈：`准备工作区...`（clone/worktree 期）→ `1 <任务标题>` 消息行 → 流式探索文案（如「已确认 README.md 当前内容与结尾换行符情况,可以直接制定计划。」）→ `方案 · v1` 卡。
- plan 卡结构：`Context: / Changes: / Edge cases: / Verification:` 四段（v1 两次运行中 Edge cases 一次有「无。」一次省略——LLM 自由文本，结构非硬 schema）。耗时徽标 `完成 29s` 可折叠。
- 规划轮结束即 push 分支（daemon.log：规划步 `pushed tds/conv-…`）。

### 3.4 确认（58/59）

- `待确认` 态 header 出 `确认` + 主按钮 `确认方案`；确认后直接进 `执行中`。
- 修改回路入口=面板底部 `请求修改…` textarea（驳回+说明 → 新方案版本 [推断 v2 机制，本次未实测驳回]）。

### 3.5 执行与 transcript（59/61/63/69）

- 执行步流式：消息行 + 工具行 `> edit README.md`、`> bash <完整命令>`（bash 命令含 worktree 绝对路径 `cd ~/.tds/workspaces/<convId> && cat README.md && echo "---" …`——transcript 直露机器路径，复刻时注意隐私语义）；行组可 `收起/展开`。
- 步后总结句（如「修改已完成并验证通过:README.md 现共三行,末行为 r3 lifecycle probe2。」）+ `完成 19s`。
- 每步行 hover 出 `恢复到此处`（checkpoint 回退，58/69 可见按钮，未实测回退）。
- 实时流通道：`GET /api/conversations/{id}/stream`（SSE，抓包）+ `GET /api/conversations/{id}/messages`。

### 3.6 验收（76→82）

- `审核` 态点 header `完成` → 确认弹层：「完成任务 / **将改动合并到默认分支** / 取消 / 完成」。
- API：`POST /api/builds/{buildId}/merge` → `202 {"delegated":true}`（合并委派机器异步执行，机器领合并步，复用同 session `continue session`）。
- 时间线追加：`15:06 Xmon Dai 发起了合并` + 合并步结果行（「git merge origin/main 结果为 "Already up to date",无需处理任何冲突。完成 28s」）+ `🎉 任务已完成`。
- 服务端 main 验证：`GET /api/projects/{id}/file?path=README.md&ref=main` → 三行含两 probe（83）。
- 完成后 chip 变 `已完成`，header 出 `重开`。

### 3.7 失败与重跑（77–81）

- 机器离线时发起合并 → 任务 `失败`：面板行「运行该任务的机器已离线 / 请将其重新上线，或重新运行任务以改派其他机器。」+ 链接 `查看原始错误` `排查指南` + 按钮 `重新运行`。
- `重新运行` → 重开「开始任务」dialog（带原 Agent）+ 第三按钮 `复用方案` → 子面板「选择接下来如何使用这个方案：`查看方案` / `直接执行`」。**直接执行**=新 conv/新分支/新 build，跳过规划，时间线首行标「复用了上一次运行的方案。」。
- 幂等行为：重跑时 agent 读到 main 已含目标行 →「当前工作区无待提交更改，任务已满足，无需重复修改」→ 停在 `审核`（不重复改）。

### 3.8 Token 记账（71/74）

- 运行历史行：`第 1 次运行 · 当前 · 43 分钟前 · 86.6k tokens`（列表级带 token 数）。
- Token 用量弹层（有数据态）：总 `76.1k tokens` → 按模型 `r3-gw/claude-sonnet-5 76.1k` → 分项 `输入 12 / 输出 980 / 缓存读取 49.7k / 缓存写入 25.4k`。
- 记账粒度=按运行×模型×四类。曾见空态「暂无 Token 用量」而运行历史有数（#1）——面板数据源/时序 bug 或仅统计执行步 [推断]。

### 3.9 分支与 PR（72）

- 面板 footer `分支与 PR` → 「同步到机器 / Git」两卡 + 明细：`构建分支 tds/conv-<convId>`、`目标提交 <12hex>`、`目标机器 r3-mbp`、`同步目录`、`强制同步`（注：「丢弃代码修改并删除非忽略的未跟踪文件；保留忽略内容。仅本次生效。」）+ `同步` 按钮。
- 机器离线时同屏红条「你选择的机器已离线，请启动后再次尝试同步。」（77 期）。
- 引导 P3 原文：「任务的改动保存在其专属分支上。点击看板卡片右上角的下载图标，或在任务详情页点击右上角「分支与 PR」：『同步到机器』将任务分支的提交同步到运行 tds 的本机目录，可在本地直接查看与运行。Git 复制检出命令，在任意本地克隆中切换到任务分支。」
- GitHub-backed 项目此处才出现 PR 语义（本观测项目为托管 repo，无 PR 区）[推断：r2 §7 证托管仓库 Pro 墙，GitHub 路径 free 可用但需连号]。

### 3.10 拖拽（A7，部分）

- 引导 P2 原文：「拖拽移动——在桌面端可将卡片直接拖拽至目标列。」（=手动改状态仅桌面支持，Web 拖拽存在）。
- 合成鼠标序列拖拽未触发移动（无 PATCH 抓包）——dnd 库需真实 pointer 事件序列 [推断]；**未复现**，留给 #42 原型以真实输入验证。

### 3.11 看板空态引导（87/88，三页轮播）

- P1 创建任务三入口（任务按钮/N/主题对话 C 或「总管」悬浮球——「任务将自动创建并进入「待开始」列」）。
- P2 六列=六阶段 + 卡片主按钮语义 + 详情页操作（确认方案/完成/重新运行）+ 拖拽。
- P3 本机预览（同步到机器/Git 检出）。
- 空列文案：`没有等待开始的任务 / 没有规划中的任务 / 没有等你确认的方案 / 没有执行中的任务 / 没有等你验收的任务 / 最近 7 天没有完成的任务`。

## 4. Agent 管理面（r2 路由表补充）

- **新路由**：`/app/resources/agents/<id>?name=<名>`（r2 未记）。团队页点 Agent 卡进入。
- 三 tab：`概览 / 记忆 / 权限`（53/54/55/90）。
- 概览：头像（更换）、名称（行内编辑）、`职责`（注：「用一两句话说明该 Agent 的职责。该说明会注入它执行的每个任务，也会提供给总管用于分派。」）、`默认 skill`（「该 Agent 执行任何任务时自动携带的团队技能，无需在消息中 @ 引用。」）、模型、`思考强度`（默认）、状态行 `active · 创建于 …`、`进行中`（当前运行列表）、`删除 Agent`。
- 记忆：空态「尚无记忆。Agent 会在工作中将值得沉淀的经验存入此处。」（记忆写入路径本次未观测到内容 [未覆盖]）。
- 权限（90 实测全 list）：工具 6 开关——`远程 shell`（「允许该 Agent 在团队中已开启 shell 访问的机器上执行命令。」）、`合并分支`、`创建标签`、`推送分支`、`创建技能`、`更新技能`；`密钥`——`团队密钥`（「任务执行时将团队密钥以环境变量注入该 Agent 的 shell。所在机器需要 tds CLI 0.1.28 及以上。」）；`MCP 服务器`——「该 Agent 执行任务时可使用的团队 MCP 服务器，其工具以 `mcp__<服务器>__<工具>` 的形式出现。」+ picker 逐个勾选（B14 闭合）。
- Agent 记录形状（`GET /api/teams/{id}/agents/{aid}`）：`{id, displayName, description, status:"active", avatarUrl, provider:"r3-gw", modelId, thinkingLevel:null, tools:[], secrets:[], skills:[], mcpServers:[]}`；编辑走 `PATCH` 同路径。
- 团队页卡：`r3-builder / claude-sonnet-5 · 默认 / 未设置职责`；成员计数把 Agent 计入（建后 `0 个成员`→`1 个成员` [观察]）。
- 机器详情「构建」tab 文案：「领取构建、规划与审核任务并运行 Agent。并发上限 3」——executor 领三类步（构建/规划/审核）与此观测吻合。

## 5. MCP 面（票 §2）

### 5.1 团队 MCP server（外部工具进 Agent）

- 列表页空态文案：「MCP 服务器为 Agent 提供额外工具，例如工单系统、浏览器、内部 API。**授权在每个 Agent 的页面上单独进行。**」
- 添加表单：类型（`远程（HTTP）` / 本地 stdio 见 r2 09d）、名称、**标识符**（「小写字母标识符，将作为工具名前缀（mcp__<标识符>__<工具>），创建后不可修改。」）、URL、请求头（键值对）。顶部版本墙：「机器上的 tds CLI 需升级至 v0.1.45 及以上才能使用 MCP 工具（npm install -g @todos-dev/cli@latest）。」
- 记录形状（`GET /api/teams/{id}/mcp-servers`）：`{teamId, label, slug, transport:"http", url, hasCredential:false, credentialKeys:[], createdBy, id, createdAt, updatedAt}`；创建 `POST` 同路径。卡片 `更多` 菜单（编辑/删除）。
- 运行时行为见 1.5（per-turn connect + 失败降级）。

### 5.2 外部 MCP client 连 todos.dev（todos.dev 自身是 MCP server）

- 端点：`https://todos.dev/api/mcp`（docs/mcp 原文）；配置格式（原文照抄）：

```json
{"mcpServers":{"todos":{"url":"https://todos.dev/api/mcp","headers":{"Authorization":"Bearer tds_your_key"}}}}
```

- VS Code 差异（原文）：「VS Code uses a servers key instead of mcpServers, with the same url and headers fields. Browser connectors that only support OAuth cannot use a key.」
- 能力分组（docs 原文六组）：Read the workspace / Read the repo（仅 GitHub-backed 项目：issues、PR+merge state、CI workflow runs）/ Read progress（最新构建完整对话，含流式中）/ Organize work / Run work（start/cancel builds、请求独立 review）/ Manage lifecycle（done/close/reopen）。
- 权限模型：key 级工具白名单（见 §6），「The key's tool selection limits every call: a client cannot invoke a tool it was not granted.」「Removing every MCP tool disables MCP for that key, and does not affect machines that hold their own machine token.」MCP 调用以 key 属主身份执行。

## 6. API 密钥（票 §4 密钥面，B12）

- 页文案：「API 密钥用于从命令行接入机器，也让 MCP 客户端能访问你的看板。」（前置页文案实测；密钥展示图 34 [图失]，值仅本会话转写）
- 新建弹窗：`密钥名称（可选）` + 开关 `Git 访问` + 开关 `MCP 访问`；开 MCP 访问后展开**工具勾选矩阵**（读/写两组，逐工具复选）：
  - 读（11）：`Todos / Projects / Conversation / Agents / Schedules / Attachment / Skills / Machines / Issues / Pull Requests / Workflow Runs`
  - 写（13）：`Create Todo / Update Todo / Message Todo / Run Builds / Run Review / Confirm Builds / Merge Builds / Cancel Builds / Complete Todos / Close Todos / Reopen Todos / Schedule Todo / Unschedule Todo`
  - （91 截图为矩阵全貌）
- 展示规则：创建后一次性明文 `tds_<48hex>` +「请立即复制密钥，它仅显示一次。」列表行掩码 `tds_afe07565…`。
- 双用途实测：同一把 key 走 `tds start --api-key`（机器注册）与 MCP Bearer 两路。

## 7. 通知（票 §5）

- 看板顶部横幅：「浏览器通知未开启 / 标签页切换到后台时，通过桌面通知提醒你。`开启`」（35 期前已见；96 前横幅在）。
- 点 `开启` → **OS 级权限弹窗**（ego-browser 报「A browser permission prompt for notifications has appeared. The user now controls this task space.」——自动化不可代点，复刻验收口径需人工一步）。用户允许后 `Notification.permission=granted`，横幅消失（96）。
- 触发场景证据：本轮观测到任务转 `审核`/`失败` 时页面内计数徽标（看板「待验收 1」+ 侧栏红点 `1`）；桌面通知实际弹出**未捕获**（页签保持前台，通知按文案仅后台触发）。触发矩阵完整化留给 #41（通知平价归架构票，地图已记）。

## 8. Web↔服务端协议词表（CDP 抓包归纳）

### 8.1 推送通道：**全 SSE，无 WebSocket**

- 整场会话 Network 事件 0 条 `webSocket*`（实测 [观察]）。
- 团队通道：`GET /api/teams/{teamId}/stream`（SSE）。实测事件：`{"type":"ping","seq":16}`（~15s 心跳）、`{"type":"machine_presence","machineId":…,"online":true|false}`。任务/构建类事件在观测窗口未出现（看板更新疑走 React Query 轮询/失效重取 [推断]）。
- 会话通道：`GET /api/conversations/{convId}/stream`（transcript 实时流，抓包见请求）。
- 机器通道：`GET /api/machine/stream`（wake，CLI bundle）。

### 8.2 REST 端点清单（观测方法+路径，`{id}` 归一）

GET：`/api/auth/session`、`/api/user/me`、`/api/teams`、`/api/teams/{id}/members`、`/api/teams/{id}/machines`、`/api/teams/{id}/providers`、`/api/teams/{id}/mcp-servers`、`/api/teams/{id}/models`、`/api/teams/{id}/notifications`、`/api/teams/{id}/progress`、`/api/teams/{id}/skills/{sid}`(+`/file?fileName=`)、`/api/teams/{id}/agents/{aid}`(+`/tasks`)、`/api/teams/{id}/chief`、`/api/teams/{id}/chief/threads`、`/api/teams/{id}/stream`、`/api/projects?teamId=`、`/api/projects/{id}/todos|branches|tags|builds|tree?ref=|file?path=&ref=|preview-token?ref=`、`/api/todos?teamId=`、`/api/todos/{id}`、`/api/builds/{id}`(+`/steps`)、`/api/conversations/{id}/messages|stream`、`/api/documents/{id}/diff`、`/api/schedules?team=`、`/api/skills?teamId=`、`/api/whats-new`。
POST：`/api/projects/{id}/todos`、`/api/projects/{id}/builds`（开始/重跑）、`/api/builds/{id}/merge`（202 delegated）、`/api/builds/{id}/steps`、`/api/teams/{id}/providers`、`/api/teams/{id}/mcp-servers`、`/api/schedules`、`/api/skills`（上传）、`/api/analytics/first-touch`、`/_mp/api/track`（PostHog 风格埋点，base64 batch）。
PATCH：`/api/teams/{id}/providers/{pid}`、`/api/teams/{id}/agents/{aid}`。
机器面：见 1.6。

### 8.3 关键记录形状（实测原样，凭证打码）

- todo：见 3.0 字段表。
- schedule：`{id, teamId, projectId, todoId, kind:"once", at:<ms>, tz:"Asia/Shanghai", machineId:null, nextRunAt:<ms>, createdBy, todo:{seqNum,title,phase,projectName,ownerId}}`。
- provider/preset/mcp-server/agent：见 §2/§4/§5。
- machine.json：`{machineId, token, teamId, serverUrl}`。

## 9. 定时闭环（B11）

- 新建表单：项目、任务（选已有 todo）、频率 tab `每小时/每天/每周/单次`、单次=日期（今天…）+时间（时 00–23、分 **00/15/30/45** 四档）、时区注「按你的本地时区运行（Asia/Shanghai）」、机器（自动）、保存（92/92b）。
- 列表卡（93）：`#1 <标题> / 已完成 / 9月19日 14:30 运行一次 / 下次 今天 14:30 · 自动 · r3-lifecycle`。
- 页文案（闭环语义原文）：「按周期或在指定时间自动重新运行任务。每一轮都会依据任务描述从头开始一次全新运行，到达确认或审核关口时暂停，交由负责人接手。」+「也可以直接告诉总管某个任务要多久重跑一次，它会替你写好规则。」
- **实测闭环**：14:30 触发 → 机器 `claim step=3iE_…`、新 conv `01a0b85b-…`、新 worktree/分支、32s 完成、面板时间线标「**由定时发起**」、agent 幂等判定（内容已在 main→「无需重复修改」）→ 停 `审核`；看板 #1 从 `已完成` 回到 `执行中→待验收` 语义（列=待验收，phase=review）。`once` 触发后自动出队（`GET /api/schedules?team=` → `[]`）。

## 10. r2 §9 缺口对账

| r2 §9 项 | 状态 | 证据 |
|---|---|---|
| A1 规划中卡片/transcript 结构 | ✓ | 57/58/63 |
| A2 待确认 plan 卡/确认/驳回/逐条 diff | ✓（驳回回路未实走） | 58/59 + 请求修改 textarea |
| A3 执行中实时流 | ✓（停止按钮未见） | 59/61/63 |
| A4 Token 用量有数据态 | ✓ | 71/74 |
| A5 运行历史多条+回放 | ✓（多条未测） | 74/75 |
| A6 验收界面/已完成列 | ✓ | 76–84 |
| A7 卡片跨列拖拽 | ◐ 文案证实，合成拖拽未复现 | 87(P2) |
| A8 分支与 PR 有分支态 | ✓ | 72 |
| B9 机器在线态+API key 注册分支 | ✓ | 33/35/35b/35c |
| B10 BYOK 添加服务商表单 | ✓ | 36–39 |
| B11 定时列表卡+单次选择器 | ✓ | 92/92b/93 + 触发实测 |
| B12 API 密钥弹窗+展示规则 | ✓ | 34/91 |
| B13 技能上传后列表卡 | ✓（授予 Agent UI=概览默认 skill；开关未细拍） | 94/95 |
| B14 MCP 逐 Agent 授权界面 | ✓ | 90 |
| C17 Agent 详情页 | ✓ | 52–55/90 |
| D21 浏览器通知 OS 弹窗 | ✓（真实弹出+人工允许） | 96 |
| D23 看板 `?` 指南 | ✗ 未做 | — |

## 11. 未覆盖 / 移交清单

- **Chief（总管）黑盒**：`/api/teams/{id}/chief`、`chief/threads`、悬浮球/主题对话（C 快捷键）界面与 prompt 行为未展开——归地图雾「Chief 编排行为复刻的黑盒实验设计」。
- 驳回回路（请求修改→方案 v2→再确认）未实走；双 Agent（规划/执行分派）未实走。
- 记忆沉淀（agent 自动写记忆）未观测到实例。
- 技能「授予 Agent」开关细态、GitHub 导入路径未拍（r2 08c 已有入口态）。
- 通知触发矩阵（后台页签→桌面通知实际弹出）未捕获。
- 拖拽真实输入验证 → #42 原型票顺带。
- 列折叠持久化/窄视口/深色主题 → 仍在 r2 §9 D 组。

## 12. 截图索引（`docs/research/assets/r3/`，52 张）

33 添加机器弹窗（限额态）· 33-machine-add-limit 同态 · 35 机器在线 · 35b 机器详情(信息) · 35c 机器离线态 · 36 有机器时 providers（新建入口出现）· 37 服务商选择器 · 38 自定义端点表单 · 39 providers 保存后 · 45 任务 composer · 47 任务面板初始 · 49 团队页 · 53 Agent 概览 · 54 Agent 记忆 tab · 56 开始 dialog(指派) · 57 规划中 · 58 方案卡 · 59 执行中 · 61 执行完成 · 63 transcript · 69 全链时间线 · 70 diff 展开 · 71 Token 用量 · 72 分支与 PR · 74 运行历史 · 76 验收确认弹层 · 77–79 合并失败与重跑 · 80/81 复用方案与直接执行 · 82 已完成 · 83 main README · 84 看板（含终态）· 85/86 拖拽尝试 · 87/88 引导轮播 P2/P3 · 88-mcp-page MCP 列表 · 89 MCP 建成 · 90 Agent MCP 授权 · 91 密钥工具矩阵 · 92/92b 定时表单 · 93 定时卡 · 94/95 技能上传 · 96 通知允许 · 97/98 定时触发后看板/面板。
**[图失]（13:49 /tmp 清理，未重拍）**：33b 命令弹窗 · 34 密钥展示 · 35d · 38b 探测回显 · 40/40b/41/41b 服务商编辑弹窗 · 42/42b/43/44 项目创建流 · 46/48 卡片与门控 · 50/50b/50c/51/52/55 Agent 表单与权限初拍 · 62/64–68/75 面板过程态。对应断言以正文文案 + API/CLI/转写记录为据。
