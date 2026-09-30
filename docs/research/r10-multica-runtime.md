# R10 · Multica runtime 模型全解（定义 / 发现 / 协议族 / 运行 / 凭据 / 自定义 profile / 权限）

> 目的：票 #517——把 Multica 的 runtime 模型从「文档说了什么」推进到「代码怎么做的」。
> 七面：定义、发现、协议族、运行、任务级凭据、自定义 profile、权限。
> 素材 A（文档侧）：官方文档 41 页快照 `~/.agents/wiki/raw/sources/2026-09/2026-09-30-todos-vs-multica-docs/multica/`
> （2026-09-30 抓取，损伤清单见同级 `README.md`）。
> 素材 B（文档源码）：同一份文档的仓库内正本 `apps/docs/content/docs/*.mdx`（随源码版本走，可与快照对拍）。
> 素材 C（源码侧）：`multica-ai/multica` 浅克隆 `--depth 1`，HEAD = `43b0571f992567a919c7f1f699ff160922594b94`（2026-09-29 23:27:27 -0700），
> 落在 `/tmp/multica-src-517`（仓外，不污染 pacman）。
> 盘点时间：2026-09-30（本地 Asia/Shanghai）。票：#517。地图：#515。

## 0. 阅读约定

- 出处三类，逐条标注：
  - **D**（文档）= 快照 `.txt` 或仓内 `.mdx` 的 `路径:行号`；
  - **C**（代码）= multica 源码 `路径:行号`（相对克隆根，版本号见上）；
  - **[推断]** = 无直接出处、由代码行为或命名推断的结论。票面明令：无出处的断言不许写。
- 文档口径与源码实测**分列**：每面先给 `文档口径`，再给 `源码实测`，最后给 `差异`。
- 全篇无 emoji；数值与命令原样照抄。
- 一处命名陷阱先说清，后文不再解释：Multica 里「permission / visibility」有三个互不相干的层——
  1. CLI 层 `--permission-mode`（Claude 的 `bypassPermissions` 等，属「协议关键 flag」）；
  2. **agent 层** `agent.permission_mode`（`private` / `public_to` + 调用白名单，管「谁能触发这个 agent」）；
  3. **runtime 层** `agent_runtime.visibility`（`private` / `public`，管「谁能在谁的机器上起 agent」）。
  票面的「权限面」= 第 3 层；「协议族面的权限模式」= 第 1 层。

---

## 1. 结论先行

1. **runtime 的四元组是（workspace × daemon/机器 × provider/工具 × profile）**，不是文档写的三元。文档只说「computer + tool（× workspace）」；代码里真正的唯一键是两个**部分唯一索引**，其中一个把 `profile_id` 抬成了第四个维度，所以同一台机器可以同时存在「内置 codex」和「任意多个自定义 codex profile 实例」。（§2）
2. **「重启只更新不重复注册」是数据库层的 `ON CONFLICT ... DO UPDATE`**，不是应用层的查重。冲突键就是上面那两个索引。（§2.3）
3. **辖 25 个协议族（`SupportedTypes`），但侦测 26 个命令名**——多出来的是 `zeroclaw`，它既在协议族白名单里、也在探针清单里，却**完全不在两张文档表里**（`providers` 工具表、`install-agent-runtime` 命令表）。文档只在 `environment-variables` 页顺带提了一句 `MULTICA_ZEROCLAW_PATH`。（§3、§9 差异 D1）
4. **「至少侦测到一个内置工具才启动」的例外，文档挂错了闸。** 文档把这个例外挂在「CLI 侦测」这道门（`daemon-runtimes:51`）；代码里它挂在**注册**这道门（`errNoWorkspaceRuntimesRegistered`），触发条件是 `dshInstallInFlight`。CLI 侦测门的豁免开关 `Overrides.AllowNoAgents` 只被 `daemon probe-runtimes` 这种只读探针用。（§3、§9 差异 D2）
5. **在线判定的真实数字是「150s 陈旧阈值 + 30s 扫掠周期 ≈ 180s」**，即文档的「约 3 分钟」；但这个「陈旧」有两个数据源：Redis TTL 键是热路径，DB 的 `last_seen_at` 每 60s 才刷一次。文档只写了「心跳 15s」。（§5.2）
6. **重连宽限（reconnect grace）的默认值是 3 小时**，文档 `daemon-runtimes` 页通篇不提数字，只在 `environment-variables` 页写了 `3h`。宽限期 ≥ 150s 才允许，低于则被夹紧。（§5.3、§9 差异 D3）
7. **7 天回收的判据是三条不是一条**：`status='offline'` + `last_seen_at` 超 7 天 + **无未归档 user agent** + **无非终态 task**。文档只写了前两条；「无 agent」在文档里读起来像「含归档 agent」，代码里归档 agent 恰恰**不**阻止回收。（§5.4、§9 差异 D4）
8. **协议关键 flag 的封锁是「黑名单 + 家族表」，不是「白名单 + 固定参数」。** 每个后端自带 `*BlockedArgs`（含值/独立/可选值三种模式），`New()` 在唯一一处对前缀做一次过滤；`--model` 这类不在黑名单里的 flag 允许用户写，但 Multica 的值排在后面、last-wins 拿走。（§4.3、§7.3）
9. **任务级凭据 `mat_` 的绑定是四元组 `(task_id, agent_id, workspace_id, user_id)` 写在独立表 `task_token`**，`user_id` 取的是 **runtime owner**，TTL 硬编码 24h。`MULTICA_TOKEN` 就是认身份的凭据：伪造 `X-Agent-ID` / `X-Task-ID` 头也改不了 actor。（§6）
10. **Codex 的 shell 环境策略不是「加一条 allow」，而是把 Codex 自己的secret 过滤整个关掉**（`ignore_default_excludes = true`）再给一份精确的 `include_only`。/ 文档把这一步说轻了。（§6.4、§9 差异 D5）
11. **自定义 profile 的固定参数排在 Multica 参数之前**，且**位置一变就不能回退**——代码注释明说是 `Commander` 类解析器的子命令需求（GH #7046）；文档也承认这对「区分全局 flag 与子命令 flag」的 CLI 仍有残险。（§7.3）
12. **runtime 的分享权是 owner 独占，admin 也没有旁路**——`canUseRuntimeForAgent`（不能绑）与 `canSetRuntimeVisibility`（不能改分享）都**没有 admin 分支**；admin 只保留 `canEditRuntime` 的改名/删除。且 **无主 runtime 一律不可绑**（`OwnerID` 为空直接拒），因为任务级 token 需要 owner 才能铸造。（§8）

---

## 2. 定义面：runtime 到底是什么、重启去重怎么实现

### 2.1 文档口径（D）

- `daemon-runtimes.txt:11`：「The daemon is the Multica background process running on one computer. It connects to the server, discovers local tools, claims runs, and reports results back.」
- `daemon-runtimes.txt:13`：「A runtime represents one concrete execution environment available to a workspace. It corresponds to **one computer plus one AI coding tool** — or one custom runtime profile — on that computer.」
- `daemon-runtimes.txt:15`：一台机器装 Claude Code + Codex、连两个 workspace → 「the daemon registers Claude Code and Codex runtimes **for each workspace**」（workspace 维由这句隐含）。
- `daemon-runtimes.txt:15` 同句：「**Restarting the daemon updates the existing records; it does not keep creating new runtimes for the same combination.**」
- `concepts.txt:31-33`：「Runtime: Where execution actually happens: a computer connected to Multica and the AI coding tools on it. The agent is the identity; the runtime is the computer that executes it.」
- 仓内正本同文：`apps/docs/content/docs/daemon-runtimes.mdx:15`。

### 2.2 源码实测（C）

runtime 的行是 `agent_runtime` 表，注册走 upsert：

- `server/pkg/db/queries/runtime.sql:63`（`UpsertAgentRuntime`）：`INSERT INTO agent_runtime (workspace_id, daemon_id, name, runtime_mode, provider, status, device_info, metadata, owner_id, last_seen_at) VALUES (...)`，`ON CONFLICT (workspace_id, daemon_id, provider) WHERE profile_id IS NULL DO UPDATE SET name = EXCLUDED.name, ..., status = EXCLUDED.status, ..., last_seen_at = now(), updated_at = now() RETURNING *, (xmax = 0) AS inserted`（冲突子句在 `:83`）。
- `server/pkg/db/queries/runtime.sql:95`（`UpsertAgentRuntimeWithProfile`）：自定义 profile 实例走另一条，`ON CONFLICT (workspace_id, daemon_id, profile_id) WHERE profile_id IS NOT NULL`（`：116`）。
- 两条索引由迁移落地：`server/migrations/121_agent_runtime_provider_partial_unique.up.sql:24-27` 把旧的 `UNIQUE (workspace_id, daemon_id, provider)` 整条约束**降级为部分唯一索引** `WHERE profile_id IS NULL`；`server/migrations/120_runtime_profile.up.sql:79-83` 加 `(workspace_id, daemon_id, profile_id) WHERE profile_id IS NOT NULL`。120 的分界注释（`120_runtime_profile.up.sql:1-9` 起）明说原因：不这么拆，内置 codex 与自定义 codex profile 在同一台 daemon 上会互斥。
- `(xmax = 0) AS inserted` 的用途见 `runtime.sql:57-62` 注释：只有首次注册才触发 `runtime_registered` / `runtime_ready` 埋点。
- `custom_name` 被刻意排除在外：`runtime.sql:139-147`（`UpdateAgentRuntimeCustomName`）注释说「Kept separate from the registration upserts above (which do `name = EXCLUDED.name` on every heartbeat) so a custom name is never clobbered by the daemon.」
- workspace 维由 `agent_runtime.workspace_id` + 两条索引一起给；注册接口是 `POST /api/daemon/register`（`server/cmd/server/router.go:1558`），处理器 `server/internal/handler/daemon.go:405`；`DaemonRegister` 要求 `daemon_id` 与 `workspace_id` 均非空（`daemon.go:416-423`），且**「at least one runtime or failed profile is required」**（`daemon.go:424-427`）——即允许一趟注册只带失败 profile 而不带可用 runtime。
- owner 解析：daemon token（`mdt_`）路径下 `ownerID` 留零、靠 SQL 的 `COALESCE(EXCLUDED.owner_id, agent_runtime.owner_id)` 保住原 owner；PAT/JWT 路径下从成员取（`server/internal/handler/daemon.go:434-451`）。
- 注册承载的元数据（`daemon.go:486-491`）：`{"version": runtime.Version, "cli_version": req.CLIVersion, "launched_by": req.LaunchedBy, "capabilities": ...}`。

### 2.3 差异

- **文档漏了 profile 这一维。** 文档 `daemon-runtimes.txt:13` 只说「computer + tool（或 one custom runtime profile）」，字面是**二选一**；代码里内置 runtime 与自定义 profile 实例是**并存**的两类行，各有各的唯一键（`runtime.sql:75` vs `:106`）。这也解释了 `daemon-runtimes.txt:155`「Deleting only the runtime instance on one computer does not delete the profile」的前提：实例与 profile 本来就是两张表（`runtime_profile` 建表在 `120_runtime_profile.up.sql:32`），`agent_runtime.profile_id` 只是个无外键的 UUID 列（`120_runtime_profile.up.sql:70-77`）。
- **「重启更新不重复注册」的实现位置**在文档里没写；实测是 DB 的 `ON CONFLICT ... DO UPDATE`（§2.2），因此它是**幂等**的，不依赖应用层判重。[推断] 这句话也是为什么 `last_seen_at = now()` 写在 upsert 里——一次注册等于一次心跳。
- `daemon-runtimes.txt:121` 说「Creating a profile does not install the command」；代码同：daemon 只做 `lookPath(profile.CommandName)` 与 per-machine override 解析，解析不到就 skip 该 profile 并记入 `failedProfiles`（`server/internal/daemon/daemon.go:3126-3145`）。

---

## 3. 发现面：PATH 侦测清单与启动门

### 3.1 文档口径（D）

- `install-agent-runtime.txt:13` 起一张 25 行的「detects these commands」表：`agy` / `claude` / `codebuddy` / `codearts` / `codex` / `copilot` / `cursor-agent` / `dsh` / `deveco` / `grok` / `hermes` / `kimi` / `kiro-cli` / `mcode` / `openclaw` / `opencode` / `pi` / `omp` / `qodercli` / `qoderclicn` / `qwen` / `qwenpaw` / `reasonix` / `traecli` / `dim`（仓内正本 `apps/docs/content/docs/install-agent-runtime.mdx:16-42`，同样 25 行）。
- `install-agent-runtime.txt:58` / `.mdx:63`：最低版本门槛只列 8 款——Antigravity 1.1.10、Claude Code 2.0.0、Codex 0.100.0、Copilot 1.0.0、Grok 0.2.89、Qwen Code 0.20.0、MiniMax Code 0.1.2、OpenCode 1.1.54。「Below the minimum version, the daemon does not register the corresponding runtime.」
- `daemon-runtimes.txt:46`：「On startup, the daemon detects supported AI coding tools on `PATH` and registers runtimes for the workspaces you are allowed to connect. **If a tool was just installed or signed in, restart the daemon to detect it again.**」
- `daemon-runtimes.txt:48`：「The daemon needs **at least one built-in supported AI coding tool** detected before it will start.」
- `install-agent-runtime.txt:98` / `.mdx:105`：例外——「when the daemon has just begun installing the DSH runtime profile itself (`MULTICA_DSH_PROFILE_BUNDLE`), it starts with no runtimes and registers DeepSeek Harness once that install finishes.」

### 3.2 源码实测（C）

**探针清单**（`server/internal/daemon/config.go:974-977`）：

```go
var defaultAgentCommandNames = append([]string{
    "claude", "codex", "opencode", "codearts", "deveco", "openclaw", "hermes",
    "pi", "cursor-agent", "copilot", "kimi", "reasonix", "dsh", "kiro-cli", "codebuddy", "agy", "qodercli", "qoderclicn", "traecli", "grok", "qwen", "qwenpaw", "mcode", "dim", "zeroclaw",
}, agent.BuiltinRuntimeCommands()...)
```

即 **25 个硬编码名 + 1 个来自描述符注册表**（`agent.BuiltinRuntimeCommands()` 当前只返回 `omp`，`server/pkg/agent/builtin_runtimes.go:86-128`）＝ 26 个。逐名探针体在 `server/internal/daemon/agents_probe.go:169-334`（25 个显式 `probe(...)` 调用 + `:194-202` 遍历描述符表）。

**侦测机制**（`agents_probe.go`）：

- 主路径 `exec.LookPath`；每条探针还要带上 provider 自己的 `MULTICA_<PROVIDER>_PATH` 覆盖与 `MULTICA_<PROVIDER>_MODEL` 默认模型（`agents_probe.go:111-115`）。
- **登录 shell 兜底**：GUI 启动的 daemon 不继承交互 shell 的 `PATH`（fnm/nvm/volta multishell、Anthropic 原生安装前缀、per-user npm prefix），只有在裸名 `LookPath` 真正 miss 时才去 fork 一次用户的登录 shell（`agents_probe.go:95-105`），结果进程级缓存 `shellResolveTTL = 30 * time.Minute`（`agents_probe.go:32`），缓存键含 `PATH/SHELL/HOME` 指纹（`agents_probe.go:41-47`）。
- **不可移植的兜底**：Codex Desktop 把 CLI 打进 macOS app bundle，daemon 扫 `/Applications/ChatGPT.app/Contents/Resources/codex`、`/Applications/Codex.app/...` 与对应 `~/Applications`（`config.go:979-993`，注释记 OpenAI 把 app 从 Codex.app 迁到 ChatGPT.app，#5205）；DSH Desktop 同理，且**先查生成的 shim、最后才查 app bundle 里的 Node 脚本**（`config.go:1014-1040`，理由是 shim 用绝对路径驱动 Electron 的 node，不依赖 PATH）。
- 探针**只做发现**，不查版本、不做最低版本门——那是 `detectBuiltinRuntimes` 每轮注册的事（`agents_probe.go:86-92` 注释）。
- 额外特例：CodeArts 在 `MULTICA_CODEARTS_PATH` 未设时会去 `~/.codeartsdoer/installers/{codearts.cmd,codearts}` 找稳定 launcher（`agents_probe.go:176-195`）。

**最低版本门槛**（`server/pkg/agent/version.go:18-37`，`MinVersions`）：10 条，比文档多两条——
`dim: "0.3.10"`（cross-run `session/load` 的 per-process 锁在优雅退出时释放）、`zeroclaw: "0.8.0"`（持久 ACP session 与 `session/resume` 在 0.8.0 加入）。

**启动门**（`config.go:266-269`）：

```go
agents := probeAgentCLIs()
if len(agents) == 0 && !overrides.AllowNoAgents {
    return Config{}, fmt.Errorf("no agent CLI found: install claude, ..., or zeroclaw and ensure it is on PATH")
}
```

`AllowNoAgents` 的注释（`config.go:189-191`）：「reserved for read-only local configuration probes」，唯一调用点是 `multica daemon probe-runtimes`（`server/cmd/multica/cmd_daemon.go:162-165`，该子命令还 `Hidden: true`，`cmd_daemon.go:55-58`）。

**真正的 DSH 例外在另一道门**：`server/internal/daemon/dsh_startup_bootstrap_test.go:22-68` 的 `TestStartupMayProceedWithoutRuntimes` 说明序列——探针报缺 profile 并启动安装 → 注册找不到可注册项 → `Run` 返回 `errNoWorkspaceRuntimesRegistered` → 进程退出并带走安装的进程树，每 32ms 一轮。放行条件是 `dshInstallInFlight`；且**只放行这一种失败**：401、连接拒绝、`nil` 都不放行（测试同段 `:44-58`）。

**运行期重新侦测**（`server/internal/daemon/agents_refresh.go`）：

- `agentDiscoveryInterval = 2 * time.Minute`（`agents_refresh.go:15`），`refreshAgentAvailability` 重跑 `probeAgentCLIs()`，只对**新增**的 provider 发布，已消失的**刻意保留**（理由写在 `agents_refresh.go:307-315`：一次更窄 PATH 的重启不该拆掉正在跑任务的 runtime）。相关 issue 号 `MUL-5439`。
- `refreshAgentVersions`（`agents_refresh.go:366` 起）做「CLI 原地升级后不重启也把新版本报给服务端」，同样吃最低版本门与探测重试。

### 3.3 差异

- **D1 · 计数对不上。** 文档两张表 25 行；代码探 26 个命令名（多 `zeroclaw`）。`zeroclaw` 在 `SupportedTypes`（`server/pkg/agent/agent.go:389`）、`launchPrefixBlockedArgs`（`server/pkg/agent/launch.go:468`）、`skillsDirPath` 的默认分支、`ModelSelectionSupported` 的 false 集（`server/pkg/agent/models.go:435`）里都在。文档侧唯一提及是 `apps/docs/content/docs/environment-variables.mdx:256` 的一句「ZeroClaw supports `MULTICA_ZEROCLAW_PATH` but has no model variable」——**工具矩阵与命令表都没收它**。
- **D2 · 例外的挂载点不同。** 文档（`daemon-runtimes.txt:48` / `install-agent-runtime.txt:98`）把 DSH 例外描述成「CLI 侦测门」的例外；代码里 CLI 侦测门的豁免是 `AllowNoAgents`（只服务只读探针），DSH 例外在**注册门**（`startupMayProceedWithoutRuntimes` + `dshInstallInFlight`）。两处都真实存在，但把哪一个叫「one exception」会让排查时找错门。文档对**现象**（无 runtime 启动、装完自动注册 DSH）的描述与代码一致。
- **D6 · 「重启才能重新侦测」已不准确。** `daemon-runtimes.txt:46` 与 `install-agent-runtime.txt:88-93` 都要求装完工具重启；代码自 `MUL-5439` 起每 2 分钟重扫一次并能免重启拾到新装的 CLI（`agents_refresh.go:15`、`agents_refresh.go:303-330`），登录-shell-only 路径最多等 `shellResolveTTL` = 30 分钟（`agents_probe.go:32`）。文档把重启写成**唯一**手段，代码实为**兜底**手段。
- **D7 · 版本门槛表缺两条**（dim 0.3.10、zeroclaw 0.8.0，`version.go:29,32`）。
- 一致项（对拍过，无需担心）：命令名映射（`cursor-agent` → provider `cursor`，`kiro-cli` → `kiro`，`agy` → `antigravity`）在探针体与文档表里一一对应。

---

## 4. 协议族面：能力矩阵与协议关键 flag

### 4.1 文档口径（D）

`providers.txt:23-48`（仓内正本 `apps/docs/content/docs/providers.mdx:21-47`）四列表：Detected command / Session resumption / Multica-managed MCP / Skill injection path。要点：

- Session resumption：除 MiniMax Code 外全为「支持」；`providers.txt:66` 解释 MCode 0.1.2「advertises no session-loading capability over ACP, so Multica starts a fresh MCode session for a later run」；`providers.txt:68` 说 Pi 存的是本地 session 文件路径，更依赖原机器与原文件。
- Multica-managed MCP：Antigravity / Copilot CLI / DevEco Code / Pi 四款为「—」；`providers.txt:74` 补一句「so the field is not shown when creating agents for them」。
- Skill injection path：逐工具一张表（`.claude/skills/`、`$CODEX_HOME/skills/`、`.dsh/skills/`、QwenPaw 写「per-run workspace `skills/`」、Dim 写「—」等）；`providers.txt:84-90` 三个例外——Codex 用 per-run `CODEX_HOME`；Hermes 用 per-run `HERMES_HOME` 且**仅在 agent 绑了 skills 时才隔离**；OpenClaw 写 `<workdir>/skills/` 并把该目录 pin 成 workspace。
- 模型来源：`providers.txt:54-60`——「the model list comes from the corresponding runtime. Some tools expose a fixed set of model names; others return available models based on local configuration, the signed-in account, and subscription entitlements.」QwenPaw 与 MiniMax Code 例外，picker 惰性、显示 "Managed by runtime"；DSH 用 `dsh --profile multica --list-models`，模型 id 是 `provider/model` 形。
- 权限模式：`providers.txt` 无此列；文档里 `--permission-mode` 只出现在两处——`daemon-runtimes.txt:142`（协议关键 flag 被丢）与 `security-model.txt:45`（Claude 以 `bypassPermissions` 跑）。

### 4.2 源码实测（C）

**协议族白名单**（`server/pkg/agent/agent.go:364-390`，`SupportedTypes`）：25 项，与 `runtime_profile.protocol_family` 的 CHECK 约束逐项一致（最新约束见 `server/migrations/441_runtime_profile_add_codearts.up.sql:6-33`；`agent.go:347-363` 的注释把每次扩容的迁移号都列了：120→134→136→175→179→202→242→253→254→313→342→370→403→441；`126_runtime_profile_drop_gemini` 曾把 `gemini` 摘掉）。

**「协议族」与「runtime 身份」是两层**（`server/pkg/agent/builtin_runtimes.go:8-70`）：`BuiltinRuntime` 描述符声明 `ID`（注册用的 provider key，如 `omp`）、`ProtocolFamily`（执行后端，如 `pi`）、`DefaultCommand`、`EnvPrefix`、`DisplayName`、`SkillsDir`、`UserSkillsDir`、`LaunchHeader`、`ModelDiscovery`。当前只注册了 `omp`（`builtin_runtimes.go:86-100`）。分派入口 `ResolveBackend`（`:153-158`）：身份走 `NewRuntime`，族走 `New`。

**模型列表来源**（`server/pkg/agent/models.go:195-245` 起）：`ListModels` 按 provider 分派，每族一套 discovery：

- Claude：**没有 `--list-models`**，走 stream-json 控制协议的 `list_models` 请求，回答由**已装二进制 + 已登录账号**算出（`server/pkg/agent/claude_models.go:15-40`，`MUL-6961`；此前的静态目录会造成「选到的模型必 400」窗口）。
- 描述符型（如 omp）：用描述符自带的 `ModelDiscovery`（omp 是 `omp models --json`，因为它拒收 pi 的 `--list-models`）；描述符没给策略时**返回空目录而不是回落到族的命令**（`models.go:199-208`、`builtin_runtimes.go:62-69`）。
- 其余按族走命令行或 ACP：`cursor-agent --list-models`（`models.go:2598`）、`agy models`（`models.go:220-226`）、traecli/hermes 等 ACP 在 `session/new` 返回目录（`models.go:227-247`）、Pi `--list-models`（`models.go:1232`）。
- **「picker 惰性」的实现**：`ModelSelectionSupported` 对 `qwenpaw` / `mcode` / `zeroclaw` 返回 false（`models.go:435-450`），注释写明三种原因——QwenPaw 的 `session/set_model` 会把模型写进共享的 `agent.json`（会改用户配置）；MCode 的 ACP 不暴露模型选项；ZeroClaw 0.8.4 对 `session/set_model` 直接答 `-32601`。UI 侧的文案键 `model_managed_by_runtime` = "Managed by runtime"（`packages/views/locales/en/agents.json:228`，渲染逻辑在 `packages/views/agents/components/inspector/model-picker.tsx:28`）。

**MCP 传递**（`opts.McpConfig` 直读的 18 个后端）：`claude`、`codearts`、`codebuddy`、`codex`、`dim`、`dsh`、`grok`、`hermes`、`kimi`、`kiro`、`mcode`、`opencode`、`qoder`、`qwen`、`qwenpaw`、`reasonix`、`traecli`、`zeroclaw`。四款「—」的后端（antigravity / copilot / deveco / pi）确实**零引用** `opts.McpConfig`。
- Cursor 与 OpenClaw 走**另一条通道**：Cursor 由 daemon 的 execenv 写项目级 `.cursor/mcp.json` + `.workspace-trusted` + `mcp-auth.json`（`server/internal/daemon/execenv/cursor_mcp.go:20-65`）；OpenClaw 由 wrapper 配置 pin `mcp.servers`，并先用一份 `{"mcp":{"servers":null}}` 的 reset 文件清掉用户全局清单（`server/internal/daemon/execenv/openclaw_config.go:25-48`、`:232-238`）。
- 三态语义：`hasManagedMcpConfig`（`server/pkg/agent/mcp_config.go:8-12`）——只有 SQL NULL / JSON null 才是「继承 runtime 配置」，**显式空对象也是受管集合**（启用严格模式）。
- OpenCode 系单独做 schema 校验（`DisallowUnknownFields`，`server/pkg/agent/opencode_mcp.go:11-27`）。

**技能注入路径**（`server/internal/daemon/execenv/context.go:328-439`，`skillsDirPath`）：`claude`→`.claude/skills`、`codebuddy`→`.codebuddy/skills`、`copilot`→`.github/skills`、`opencode`→`.opencode/skills`、`codearts`→`.codeartsdoer/skills`、`deveco`→`.deveco/skills`、`openclaw`→`skills`、`pi`→`.pi/skills`、`cursor`→`.cursor/skills`、`kimi`→`.kimi/skills`、`reasonix`→`.reasonix/skills`、`dsh`→`.dsh/skills`、`kiro`→`.kiro/skills`、`qoder`/`qoderclicn`→`.qoder/skills`、`qwen`→`.qwen/skills`、`qwenpaw`→**`skill_pool`**、`mcode`→`.minimax/skills`、`traecli`→`.traecli/skills`、`antigravity`→`.agents/skills`、`grok`→`.grok/skills`；描述符型（`omp`）走 `desc.SkillsDir`；**default 分支**→`.agent_context/skills`（`:435-438`）。Codex / Hermes 不在这张表里：eyebrow 分别在 `execenv/execenv.go:1040` 与 `execenv/hermes_home.go:17-45`（per-run home 覆盖 + `skills.external_dirs`）。
- 同名冲突处理：`allocateCollisionFreeSkillDir`（`execenv/skill_visibility.go:50`）——用 `-multica` 后缀另开目录，只清自己建的文件。
- frontmatter 归一：`ensureSkillFrontmatter`（`context.go:441` 起）强制 `name` 键 = 目录 slug，理由（`MUL-5529`）：Claude 按目录名路由、OpenCode 按 frontmatter `name` 路由，两边分叉会让同一个技能有两个可调用名。

### 4.3 协议关键 flag：为什么保留、为什么不给用户覆盖

**文档口径（D）**：`daemon-runtimes.txt:139-141` 两条后果——

- 「Multica's own values win a conflict. If your fixed arguments set a flag Multica also sets, Multica's value comes later and takes effect. Most importantly, a model chosen on the agent overrides a `--model` pinned in the profile.」
- 「Protocol-critical flags are ignored. `-p`, `--output-format`, `--input-format`, `--permission-mode`, and the equivalents for other families are dropped from your fixed arguments, because overriding them would break the daemon's connection to the tool. Subcommands and other positional arguments always pass through.」

**源码实测（C）**：

- 三种封锁模式：`blockedWithValue` / `blockedStandalone` / `blockedOptionalValue`（`server/pkg/agent/claude.go:1334-1340`）。过滤函数 `filterCustomArgs`（`claude.go:1354`）与 `filterLaunchPrefix`（`launch.go:505`）在过滤前先 `unshellQuoteArg` 去掉用户手写的 shell 引号（`launch.go:518`、`claude.go:1361`）。
- 家族→黑名单表：`launchPrefixBlockedArgs`（`launch.go:445-469`），23 个族有各自的 `*BlockedArgs`，两个族共用一份（`qoder` 与 `qoderclicn` 都指 `qoderBlockedArgs`）。**没有出现在表里的族 = 接受任何前缀**（`launch.go:443-444`、`:509-512`）。
- 抽样（每条都有原注释）：
  - Claude: `-p`、`--output-format`、`--input-format`、`--permission-mode`、`--mcp-config`、`--effort`（`claude.go:1063-1076`）。`--effort` 的理由是「由 per-agent thinking_level picker 拥有，用户 custom_arg 不得静默代言」。
  - CodeBuddy：同 Claude 五项（`codebuddy.go:27-36`）。
  - Copilot：`-p` / `--output-format` / `--allow-all(-tools/-paths/-urls)` / `--yolo` / `--no-ask-user` / `--resume` / **`--acp`**（`copilot.go:613-624`，`--acp` 注释是「prevent switching to ACP mode」）。
  - Cursor：`-p` / `--output-format` / `--yolo`（`cursor.go:1009-1013`）；同文件 `:1017-1034` 解释 prompt 为何**不走 argv**（Windows PowerShell 会把 `$args` 重新序列化，含双引号的 prompt 会被重新 token 化，#5649），因此 `cursor-agent` 的 prompt 走 stdin。
  - CodeArts：`--format` / `--auto` / `--sandbox` / `--dir` / `--variant` / `--dangerously-skip-permissions`（`codearts.go:38-45`）。
  - DevEco：`--format` / `--dir` / `--variant` / `--dangerously-skip-permissions`（`deveco.go:61-66`）。
  - Grok：最长的一份（`grok.go:22-47` 起），含 `agent` / `stdio` / `headless` / `serve` / `leader` 这些**位置式子命令**也要拦，以及 `-m` / `--model` / `--reasoning-effort` / `--resume` / `--system-prompt-override`。
  - 纯 ACP 族只拦一个子命令：`hermes` 拦 `acp`（`hermes.go:37-39`）、`kimi` 拦 `acp`（`kimi.go:21-23`）、`mcode` 拦 `acp`/`login`/`--region`（`mcode.go:21-27`）、`kiro` 拦 `acp`/`-a`/`--trust-all-tools`/`--trust-tools`（`kiro.go:26-31`）、`dim` 拦 `acp`/`--auth-setup`/`--remote`/`--help`/`-h`（`dim.go:21-27`）、`zeroclaw` 拦 `acp`（`zeroclaw.go:29` 起）。
  - Codex 只拦 `--listen`（`codex.go:32-34`，`stdio://` 传输）。
- **过滤点唯一**：`New()` 在唯一一处同时知道前缀与族的地方做 `filterLaunchPrefix`（`agent.go:466-471` 上方注释原文：「Doing it per-backend would be the same opt-in arrangement that let ExtraArgs rot: a family that forgot the call would accept a fixed_args `--output-format text` and break its own stream-json channel.」）。对外导出 `FilterLaunchPrefix` 是给 daemon 的 `--version` 探针用的（`launch.go:471-480`）。
- **冲突只记日志、不改行为**：`warnLaunchPrefixOverlap`（`launch.go:553-571`）在进程构造时比对前缀与本次 argv 的 flag 名，命中就 warn（`exec` 在 `launch.go:113` 调用它）。注释（`:543-552`）写明这是 GH #7046 的遗留：前缀曾是**排在最后**，于是 runtime 上的 `--model composer-2.5` 会**静默盖掉**用户在 UI 选的模型。
- 另外：`--version` 探针也带前缀（`agent.go:514-521` 注释：`ccms start q36 --version` 报的是它 exec 的 CLI 的版本，`ccms --version` 报的是 wrapper 自己的），否则最低版本门会拿错版本号。

### 4.4 差异

- **D8 · QwenPaw 技能路径名不符。** 文档两处都写「per-run workspace `skills/`」（`providers.txt:45`、`providers.mdx:44`）；代码写的是 `<workDir>/skill_pool`（`execenv/context.go:409-411`），注释还给了上游依据（QwenPaw `skill_system/store.py` 的 `get_workspace_skills_dir`）。
- **D9 · Dim 的「—」不精确。** 文档表给 Dim 技能路径「—」（`providers.txt:48`、`providers.mdx:47`）；代码里 `dim` 没有 case，落到 **default 分支** `.agent_context/skills/`（`context.go:435-438`）。[推断] 该目录的注释自称「referenced by meta config」，我**没有**查到 Dim 会扫这个目录的证据，所以「文档说没有、代码却往那写」是事实，「写了之后 Dim 是否消费」是未核实项（§10）。
- **D10 · 「Multica-managed MCP」的机制分布文档没写。** 文档四列表只给「支持 / 不支持」两态，读者会以为都走同一条通道；实际 18 个后端直读 `opts.McpConfig`，Cursor / OpenClaw 走**写配置文件**第二条通道（§4.2）。结论（谁能用 MCP）与文档一致，机制不同。
- 一致项：四款无 MCP 的后端名单（antigravity / copilot / deveco / pi）文档与代码逐一对上；Codex / Hermes / OpenClaw 三个技能例外、MCode 无 session resumption、QwenPaw+MCode 的 picker 惰性，均与代码一致（ZeroClaw 是文档没列的第 3 个惰性 picker）。

---

## 5. 运行面：连接、心跳、并发、回收

### 5.1 文档口径（D）

- `daemon-runtimes.txt:52`：「Once registered, a runtime keeps a persistent connection. When a new run enters the queue, the server notifies the matching daemon; the daemon also polls periodically as a backstop after connection interruptions.」
- `daemon-runtimes.txt:54`：「The daemon sends a heartbeat every 15 seconds. ... after a daemon exits unexpectedly, the runtime usually shows as offline **within about 3 minutes at the latest**.」
- `daemon-runtimes.txt:58`：排队中的 run「fail only once it has stopped heartbeating for longer than the reconnect grace **and** the run has itself been queued that long」。
- `daemon-runtimes.txt:60`：进行中的 run 失败，符合条件者自动重试。
- `daemon-runtimes.txt:62`：daemon 重启会重新注册并 reclaim 上次没干净结束的 run。
- `daemon-runtimes.txt:64`：「A runtime offline for more than 7 days with no agents bound to it (including archived ones) is cleaned up automatically.」
- `daemon-runtimes.txt:70-72`：「One daemon executes at most 20 runs at a time by default; each agent at most 6. Effective concurrency is the smaller of the two.」+ 「adjust a single agent's concurrency in the agent settings, and the machine-wide cap through `MULTICA_DAEMON_MAX_CONCURRENT_TASKS`」。
- `tasks.txt:145-147`：`dispatched` 超 5 分钟判失败；`running` 无固定时长上限；心跳 15s、约 3 分钟判离线。
- `tasks.txt:74`：普通 run 默认最多 2 次（首跑 + 1 次重试）；工具网络中断最多 3 次。
- `environment-variables.txt:214-218`：`MULTICA_DAEMON_POLL_INTERVAL` 30s、`MULTICA_DAEMON_WS_CLAIM_POLL_INTERVAL` 3m、`MULTICA_DAEMON_HEARTBEAT_INTERVAL` 15s、`MULTICA_DAEMON_MAX_CONCURRENT_TASKS` 20、`MULTICA_AGENT_TIMEOUT` 0。

### 5.2 源码实测：连接与心跳（C）

- 传输：WebSocket `GET /api/daemon/ws`（`server/cmd/server/router.go:1565`），hub 在 `server/internal/daemonws/hub.go`。
- 常量（`server/internal/daemon/config.go`）：`DefaultServerURL = "ws://localhost:8080/ws"`（:24）、`DefaultPollInterval = 30 * time.Second`（:25）、`DefaultWSClaimPollInterval = 3 * time.Minute`（:29，注释：healthy WebSocket 下漏事件的安全轮询上界，每次 sleep 前只向下抖动）、`DefaultHeartbeatInterval = 15 * time.Second`（:30）、`DefaultHealthPort = 19514`（:71）。
- 心跳生产者：`runRuntimeHeartbeat` 每个 runtime 一条 goroutine，首个 tick 带**不大于一个周期的抖动**（`server/internal/daemon/daemon.go:4479-4496`，防多 runtime 同时注册打雷群）。
- **判定离线**：`staleThresholdSeconds = service.RuntimeClaimFreshnessSeconds`（`server/cmd/server/runtime_sweeper.go:33`），而

  ```
  RuntimeClaimFreshnessSeconds = 150.0   // server/internal/service/task.go:189
  ```

  注释（`task.go:182-188`）给了推导：必须大于「60s 的 DB 心跳落库间隔 + 一次约 15s 的 daemon 心跳 + 约 30s 的批量调度 tick」= 105s 最坏年龄，150s 留 45s 余量。
- 扫掠周期 `sweepInterval = 30 * time.Second`（`runtime_sweeper.go:24`）→ 150s + 30s ≈ **180s**，与文档「约 3 分钟」吻合。数据库谓词：`SELECTStaleOnlineRuntimes`（`server/pkg/db/queries/runtime.sql:249-256`）。
- **热路径另有一条**：Redis TTL 键 `mul:runtime:hb:<id>`（`server/internal/handler/runtime_liveness_store.go:75-81`），心跳只写这个键而不每次重写 `last_seen_at`；`Touch`/`IsAliveBatch` 出错或未接 Redis 时**整体降级**为「每拍都写 DB + 只信 SQL 陈旧窗口」（同文件 `:11-27` 的接口注释）。扫掠时 `filterStaleRuntimesByLiveness` 用 Redis 把「DB 只是滞后」的行留下（`runtime_sweeper.go:358-390`），并在确认离线后 `Forget` 键（`:280-287`）。
- 心跳认领：`GetAgentRuntimeHeartbeatLeases`（`runtime.sql:33-40`）一次往返认证整套 runtime，之后连接租约里只留不可变归属字段与 liveness 状态。
- **运行中不被服务端墙钟杀**：`runningTimeoutSeconds = 9000.0`（2.5h）**且**要求 `last_seen_at` 已过期才生效（`runtime_sweeper.go:80-88` 注释：心跳健康的 runtime 上跑几小时的研究/训练任务永不被墙钟杀，`MUL-4107`）。
- daemon 侧自身活性网：`DefaultAgentTimeout = 0`（无绝对上限，`config.go:31-36`）、`DefaultAgentIdleWatchdog = 2 * time.Hour`（`:47-65`，注释解释了为何从 5min 一路抬到 2h）。
- `dispatched` 超时：`dispatchTimeoutSeconds = 300.0`（`runtime_sweeper.go:69-71`）。

### 5.3 源码实测：排队宽限（C）

- `defaultRuntimeReconnectGrace = 3 * time.Hour`（`runtime_sweeper.go:38-43`），env 覆盖 `MULTICA_RUNTIME_RECONNECT_GRACE`（`server/cmd/server/main.go:740`），下界 `minimumRuntimeReconnectGrace = staleThresholdSeconds` = 150s，低于即夹紧并打日志（`main.go:741-746`）。
- 语义：runtime 状态**照常**在 150s 后翻 offline（UI 如实），**只推迟任务终止**；真正重启的 daemon 走 `RecoverOrphanedTasksForRuntime` 绕开宽限（`runtime_sweeper.go:39-42`）。
- 排队 run 的两条件：`ExpireStaleQueuedTasks`（`server/pkg/db/queries/agent.sql:1414` 起）。长注释（`:1415-1442`）说清了历史：这里**曾经**是纯墙钟 TTL（默认 2h），把「没人会来取」和「前面排队长」混为一谈，`MUL-6558` 就是自托管低并发 runtime 把自己队列排过 2h 导致健康任务被 `queued_expired` 杀掉；现在改成「runtime 还能证明自己活着吗」+「这个 run 自己也排满了一个宽限」两条 AND。心跳年龄**直接读**而不 gate 在 `status='online'` 上，所以卡在 online 但心跳早已死掉的行也能释放队列（`:1443-1445`）。
- 进行中任务的终止：`FailTasksForOfflineRuntimes`（`runtime.sql:277-299`），victims 是 `dispatched`/`running`/`waiting_local_directory` 且 runtime offline 且 `COALESCE(last_seen_at, updated_at)` 超过宽限。
- 重试宽限的终局路径：`sweepExpiredRuntimeReconnectRetries`（`runtime_sweeper.go:332-354`）。
- 批大小：`offlineTaskFailBatchSize = 500`、`reconnectRetryExpireBatchSize = 500`、`queuedExpireBatchSize = 500`（`runtime_sweeper.go:48-51`、`:89-96`）。
- 自动重试上限在服务端：`tasks.txt` 的 2 次 / 3 次（D 侧）对应代码里的 retry 调度，本文未逐条追到具体常量（§10 记为未深挖）。

### 5.4 源码实测：并发上限与 7 天回收（C）

**并发**：

- daemon 侧：`DefaultMaxConcurrentTasks = 20`（`config.go:72`），env `MULTICA_DAEMON_MAX_CONCURRENT_TASKS`（`config.go:474`），CLI `--max-concurrent-tasks`（`server/cmd/multica/cmd_daemon.go:107`）；执行面是一个信号量 `newTaskSlotSemaphore(d.cfg.MaxConcurrentTasks)`（`server/internal/daemon/daemon.go:5349`），slot 号经 `MULTICA_TASK_SLOT` 暴露给任务（`daemon.go:5445`）。
- agent 侧：`agentconfig.DefaultMaxConcurrentTasks = 6`（`server/internal/agentconfig/`，迁移 `server/migrations/023_agent_concurrency_default.up.sql` 把默认从 1 改成 6 并回填），上下界 `[1, 50]`；认领时 gate（`server/internal/service/task.go:3541`：`if running >= int64(agent.MaxConcurrentTasks)` → `"task claim: no capacity"`）。
- 所以「effective = min(daemon 20, agent 6)」是两侧各自 gate 的自然结果——**没有**一处把两个数取 min 再判。文档的表述是行为总结而非实现描述。

**7 天回收**（`ListStaleOfflineRuntimeGCCandidates`，`runtime.sql:510-533`）：

```sql
SELECT id FROM agent_runtime
WHERE status = 'offline'
  AND last_seen_at < now() - make_interval(secs => @stale_seconds)
  AND NOT EXISTS (SELECT 1 FROM agent
                  WHERE agent.runtime_id = agent_runtime.id
                    AND agent.kind = 'user' AND agent.archived_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM agent_task_queue
                  WHERE agent_task_queue.runtime_id = agent_runtime.id
                    AND agent_task_queue.completed_at IS NULL)
```

- `@stale_seconds = offlineRuntimeTTLSeconds = service.OfflineRuntimeTTLSeconds = 7 * 24 * 3600.0`（`runtime_sweeper.go:52-57`、`server/internal/service/runtime_teardown.go:12-19`；同一常量被交互删除端点复用来告诉用户「你删不掉的行什么时候会自己消失」）。
- 节奏：`runtimeGCSweepInterval = time.Hour`（`:27-30`），每轮上限 `runtimeGCBatchSize = 500`、轮超时 15s、单 runtime 操作超时 5s（`:54-67`）。
- 每行在 `FOR UPDATE` 下重判（`gcRuntime`，`runtime_sweeper.go:481` 起 + `IsAgentRuntimeEligibleForGC`，`runtime.sql:535` 起）。
- 交互删除侧：profile 还活着的实例**直接 409 拒绝**（`server/internal/handler/runtime.go:1017-1026`），只有孤儿实例（profile 已不存在）才可删（`:1027-1033`）。

### 5.5 差异

- **D3 · 宽限数字不在这一页。** `daemon-runtimes.txt` 通篇只说「the reconnect grace」，数字 3h 只在 `environment-variables` 页（`environment-variables.txt:44`）。跨页引用不是错，但排查在线/离线行为时这一页读不到判据。
- **D4 · 7 天回收的判据少写了一条，且「含归档 agent」这句反了。** 文档 `daemon-runtimes.txt:64`「no agents bound to it (including archived ones)」；代码里归档 agent **不**进入阻止集合（`agent.archived_at IS NULL` 谓词），且**非终态 task 也会阻止回收**——后者文档完全没提。
- **D11 · 「心跳 15s」省略了落库节奏。** 真实链路是「15s 打一拍 → Redis TTL 键（热）→ 最多 60s 落一次 `last_seen_at`」，离线判定用的是 150s 陈旧窗口。文档的 15s/3min 两个数字都对，中间的 60s 落库间隔是文档没有的第三个数。
- 一致项：传输形态（持久连接 + 轮询兜底）、重启即重注册并 reclaim、`running` 无固定上限、`dispatched` 5 分钟，文档与代码逐条对上。

---

## 6. 凭据面：任务级 `mat_` token

### 6.1 文档口径（D）

- `auth-tokens.txt:79`：「When the daemon claims a run, the server creates a temporary token for that run, prefixed with `mat_`. It is bound to the **current user, workspace, agent, and run**, is valid for **at most 24 hours**, and is cleaned up when the run ends.」
- `auth-tokens.txt:81`：「The daemon injects this temporary token into the AI coding tool instead of handing the user's PAT to the agent. Requests made by the agent are therefore recorded as agent actions, and the token can't be used to reach sensitive operations restricted to users or owners.」
- `auth-tokens.txt:89-93`：另有 `mcn_`（Multica Cloud Node）与 `mdt_`（workspace-scoped daemon auth）两种机器凭据，普通安装永远不需要手工构造。
- `auth-tokens.txt:19`：PAT 前缀 `mul_`；`:35-42`：`multica login` 建 90 天 PAT 存 `~/.multica/config.json`（或 `~/.multica/profiles/<name>/config.json`），剩余不足 7 天自动续到 90 天。
- `daemon-runtimes.txt:88`：「an agent's custom environment cannot override any `MULTICA_` variable or the task temporary-directory variables.」
- `daemon-runtimes.txt:92-103`：任务环境变量表，其中 5 个标 **Integration contract**（`MULTICA_TOKEN` / `MULTICA_TASK_ID` / `MULTICA_AGENT_ID` / `MULTICA_WORKSPACE_ID` / `MULTICA_SERVER_URL`），其余标 Informational（`MULTICA_TASK_CONFIG_ROOT` / `MULTICA_TASK_WORKSPACES_ROOT` / `MULTICA_AGENT_NAME` / `MULTICA_DAEMON_PORT` / `MULTICA_TASK_SLOT` / `TMPDIR`（并给 `TMP`/`TEMP`））。表下明说「intentionally not exhaustive and is not a versioned API surface」。
- `daemon-runtimes.txt:105`：写操作以 **assigned agent + active task** 身份记账。
- `daemon-runtimes.txt:107`：子进程默认继承全部（含 `MULTICA_TOKEN`）；要剥离只能显式剥；**反向例外**是工具自过滤子进程环境——「Codex's shell tool drops names containing `TOKEN`, `KEY`, or `SECRET`, so the daemon installs a managed shell policy that allows the required task variables.」
- `security-model.txt:41`：「Run-scoped API tokens. The `MULTICA_TOKEN` handed to a run is bound to that agent and that run by the server, so a run cannot act as you or as another agent through the Multica API.」

### 6.2 源码实测：token 的铸造与绑定（C）

- 生成：`GenerateAgentTaskToken()` = `"mat_" + 40 hex`（`server/internal/auth/jwt.go:78-89`）；同文件 `:61-75` 是 `mul_`（PAT，`GeneratePATToken`）、`:68` 起是 `mdt_`（`GenerateDaemonToken`）。全库统一 `HashToken` = SHA-256 hex（`jwt.go:92-95`）。
- 铸造点两处：单任务认领 `server/internal/handler/daemon.go:3826`，批量认领 `daemon.go:1868`。
- 绑定写入 `task_token` 表（建表 `server/migrations/108_task_token.up.sql:14-25`）：
  `(task_id → agent_task_queue.id, agent_id → agent.id, workspace_id → workspace.id, user_id → user.id, expires_at)`，四列全 `NOT NULL` + `ON DELETE CASCADE`；`108_task_token.up.sql:1-8` 的长注释说明了这张表取代的历史做法——**曾经**把 daemon owner 的 `MULTICA_TOKEN`（一个 workspace owner/admin 的 PAT）直接注进 agent 进程，等于给 agent 全套 owner 权限（`MUL-2600`）。
- 落库参数（`handler/daemon.go:3843-3853`）：`UserID: runtime.OwnerID`、`ExpiresAt: time.Now().Add(24 * time.Hour)`。**24h 是硬编码**，配套注释在 `:3810-3811`：「Token expires after the queue/runtime upper bound (24h) so it survives long-running tasks but cannot outlive a forgotten one.」
- **runtime 无 owner 就不给 token**：`if !runtime.OwnerID.Valid { ...CancelTask... }`（`:3812-3825`，`MUL-3292`），批量路径同（`:1859-1867`）。这条是 §8「无主 runtime 不可绑」的同一个根因。
- 校验：`GetTaskTokenByHash`（`server/pkg/db/queries/task_token.sql:6-8`）带 `expires_at > now()`；清理 `DeleteTaskTokensByTask`（`:10-11`）、`DeleteExpiredTaskTokens`（`:13` 起）。
- 认身份的机制（`daemon.go:3801-3806` 注释原文）：token 绑到 (agent, task, workspace, owner) 后，**即使 agent 抹掉或伪造 `X-Agent-ID` / `X-Task-ID` 头**，服务端仍按 actor=agent 记账——堵死了 human-only 端点（如 `/api/agents/{id}/env`）的横向移动路径。`108_task_token.up.sql:1-8` 同：owner-only 端点对 agent 流量一律 403。
- daemon 侧强校验：`taskScopedAuthToken` 要求 server 下发的 token 必须 `mat_` 前缀，否则报 `"server provided non-task-scoped auth token"`（`server/internal/daemon/daemon.go:167-177`）。CLI 侧还有「在 agent 执行上下文里必须拿 `mat_`」的门（`server/cmd/multica/cmd_agent.go:261-271`、`cmd_auth.go:472-473`），报错文案是 `agent execution context requires MULTICA_TOKEN to be a task-scoped mat_ token`。
- PAT 口径：`TaskTokenPrefix = "mat_"` 在 CLI 侧有常量（`server/internal/cli/client.go:77`），并有注释说明「401 on one is not the 'your login expired' case」（`:71-76`）。

### 6.3 源码实测：注入的 13 个变量（C）

`taskMulticaEnvironment`（`server/internal/daemon/daemon.go:178-194`）一次返回 13 个键：

```go
"MULTICA_TOKEN" / cli.TaskConfigRootEnv / TaskWorkspacesRootEnv / "MULTICA_SERVER_URL" /
"MULTICA_DAEMON_PORT" / "MULTICA_WORKSPACE_ID" / "MULTICA_AGENT_NAME" / "MULTICA_AGENT_ID" /
"MULTICA_TASK_ID" / "MULTICA_TASK_SLOT" / "TMPDIR" / "TMP" / "TEMP"
```

常量值：`TaskConfigRootEnv = "MULTICA_TASK_CONFIG_ROOT"`（`server/internal/cli/config.go:19`）、`TaskWorkspacesRootEnv = "MULTICA_TASK_WORKSPACES_ROOT"`（`server/internal/daemon/config.go:748`）。调用点 `daemon.go:8472`。

与之对照的**用户不可覆盖**规则（`isBlockedEnvKey`，`daemon.go:10355-10367`）：

- 前缀 `MULTICA_` **整段**封禁；
- 另加一份精确名单：`HOME`、`PATH`、`USER`、`SHELL`、`TERM`、`TMPDIR`、`TMP`、`TEMP`、`CODEX_HOME`、`REASONIX_STATE_HOME`、`CURSOR_DATA_DIR`、`execenv.CursorMcpAuthSourceEnv`、`OPENCLAW_CONFIG_PATH`、`OPENCLAW_INCLUDE_ROOTS`。
- 唯一有意的例外是 `HERMES_HOME`：`layerCustomEnvAndHermesHome` 的注释（`daemon.go:10369-10377`）说明——绑了 skills 时 per-task overlay 是**从**用户 `HERMES_HOME` 建的、必须赢；没绑 skills 时用户的 `HERMES_HOME` 原样透传。
- 与文档对拍：文档说的「任何 `MULTICA_` 变量 + 任务临时目录变量」= 前缀规则 + `TMPDIR/TMP/TEMP`，一致；代码多出的 `HOME/PATH/CODEX_HOME/...` 文档没列。

**超出文档表的环境变量**（文档自称「not exhaustive」，故非缺陷，但值得知道）：`MULTICA_DSH_SESSION_ROOT`、`DSH_TELEMETRY_DISABLED=1`（`daemon.go:8563-8564`）、以及 per-family 的 home 重定向（`HERMES_HOME`、`CODEX_HOME`、`CURSOR_DATA_DIR` 等）。

### 6.4 源码实测：Codex 的 shell 环境 allow rule（C）

- 问题（`server/internal/daemon/execenv/codex_shell_env.go:15-20`）：Codex 在执行 shell 子进程前过滤环境，默认 secret guard 丢掉含 `KEY` / `SECRET` / `TOKEN` 的名字，所以 daemon 起出来的 Codex 进程有 `MULTICA_TOKEN`，而它内部的 `multica issue ...` 没有。
- 做法：daemon 在每个任务的隔离 `CODEX_HOME` 里写一段**受管块**，用 `# BEGIN multica-managed shell-environment (do not edit; regenerated by daemon)` / `# END ...` 包住（`codex_shell_env.go:20-31`），每次运行重写（`shellEnvBlockRe` 匹配后整体替换，`:33-35`）。
- 写进去的值（`renderMulticaShellEnvBlock`，`codex_shell_env.go:112-125`）：`inherit = "all"`、**`ignore_default_excludes = true`**、`include_only = [...精确名单...]`。
- 名单算法 `CodexShellEnvAllowlist`（`codex_shell_env.go:38-100`）：继承来的变量保留 Codex 默认过滤；**显式**值里 credential-looking 的名字只在也出现在 `authorizedExplicit`（由 daemon 从当前 agent 的黑名单校验过的 `custom_env` 推出）时才进；**继承的 `MULTICA_*` 一律丢**（那属于 daemon 进程、不一定属于本任务），显式 `MULTICA_*` 可以留（因为 daemon 会 blocklist 该命名空间并从当前任务构造值）。大小写按 Codex 的 glob 语义统一大写去重。
- 与文档对拍（`daemon-runtimes.txt:107`）：文档说「installs a managed shell policy that **allows the required task variables**」——方向对，但少说了最关键的一步：它不是「在默认过滤外额外放行几个名字」，而是**把 Codex 的默认 secret 过滤整体关掉**（`ignore_default_excludes = true`）再换成一份显式白名单。行为等价性没变（白名单是精确名、非 glob），但这决定了排查时该看哪个开关。

### 6.5 差异

- **D5 · Codex shell 策略的机制被说轻**（见 §6.4）。
- **D12 · `MULTICA_TOKEN` 的 owner 语义文档没点明。** `auth-tokens.txt:79` 说 token 绑「the current user」；代码里 `user_id` 取的是 **`runtime.OwnerID`**（`handler/daemon.go:3850`），也就是**跑任务的机器的主人**，不是任务发起人。这解释了为什么无主 runtime 必须先拒任务（`:3812`）——没有 owner 就没有「current user」可绑。
- 一致项：`mat_` / `mul_` / `mdt_` / `mcn_` 四个前缀、24h 上限、五个 Integration-contract 变量、非 exhaustive 声明、子进程继承、服务端存 custom env 与 MCP（`agent.mcp_config` / `custom_env` 均在服务端、经 `Sync` 下发），与代码逐条对上。

---

## 7. 自定义 profile 面：约束与参数排序

### 7.1 文档口径（D）

- `daemon-runtimes.txt:82-84`：内部 wrapper、版本锁定的可执行、需要固定附加参数时用自定义 profile；「A custom profile does not add a new communication protocol. You still pick one of the protocol families Multica already supports ... and the command itself must be compatible with that family.」
- `daemon-runtimes.txt:111`：「Only workspace owners and admins can create, edit, or delete custom runtime profiles.」
- `daemon-runtimes.txt:121`：profile 是 workspace 级共享；每台机器各自在 `PATH` 上找命令；只有能找到的机器才注册对应 runtime；创建 profile **不装命令、也不给别人登录**。
- `daemon-runtimes.txt:123`：命令字段是「可执行 + 参数」不是 shell script——引号与反斜杠转义可用；管道、重定向、`&&`、`;`、反引号、变量展开不可用；需要它们就写 wrapper 脚本再用脚本当命令。
- `daemon-runtimes.txt:127-135`：**参数排序**——「Everything you type in the command field stays directly after the executable, ahead of the arguments Multica adds」，为什么这样：`ccms start q36` 这类子命令式 wrapper 必须先把 `start q36` 吃掉才能接受 `-p`；并且明确承认「Your arguments used to be appended last instead」，flag 式命令两种排法通常等价、但**区分全局 flag 与子命令 flag 的 CLI 仍会关心 flag 的位置**，所以升级后先跑一次确认。
- `daemon-runtimes.txt:143-153`：Desktop 启动的 daemon 找不到命令时用 `multica runtime profile set-path <profile-id> --path /abs/path`，撤销用 `unset-path`（快照的快照损伤：左尖括号被吃成 `profile-id>`，见同级 `README.md:14-16`）。
- `daemon-runtimes.txt:155`：「Editing a profile only affects runs claimed afterwards. Before deleting a profile, deal with the active agents still bound to its runtimes. Deleting only the runtime instance on one computer does not delete the profile — a running daemon will re-register it.」

### 7.2 源码实测：约束链（C）

daemon 每轮 workspace 同步取 profile 列表（`GET /api/daemon/workspaces/{id}/runtime-profiles`，`router.go:1568`），逐条：

1. `runtimeType := agent.ProfileRuntimeType(profile.RuntimeType, profile.ProtocolFamily)`——为兼容 `runtime_type` 列出现之前的旧 profile（`builtin_runtimes.go:188-194`）。
2. `if profile.CommandName == "" || profile.ProtocolFamily == ""` → skip + warn（`server/internal/daemon/daemon.go:3084-3087`）。
3. `if _, supported := agent.RuntimeProtocolFamily(runtimeType); !supported` → skip，并记进 `failedProfiles`，reason = `unsupported runtime_type: <x>`（`daemon.go:3088-3098`）。`RuntimeProtocolFamily` 先查 builtin-runtime 描述符、再查 `IsSupportedType`（`builtin_runtimes.go:196-203`）。
4. 解析命令，三档优先：per-machine override（`ProfileCommandOverrides[profile.ID]`，来自 CLI config 的 `runtime profile set-path`）→ `lookPath(command_name)` → 该 provider 启动时已发现的路径（仅当命令名与已发现的一致且路径非空）。三档都不中 → skip 并把 reason 写进 `failedProfiles`（`daemon.go:3109-3147`）。注释（`:3117-3126`）解释了为什么要有第三档：GUI 启动的 daemon 环境解析不到 CLI，但启动时的 provider 发现（登录 shell / 安装路径）已经找到过。
5. 版本探测**带固定参数**：`detectAgentVersion(ctx, agent.NewCommand(resolved, agent.FilterLaunchPrefix(runtimeType, profile.FixedArgs, d.logger)))`（`daemon.go:3161-3163`）。注释（`:3154-3160`）原文：`ccms start q36 --version` 报的是它 exec 的那个 CLI 的版本，`ccms --version` 报的是 wrapper 自己的，只有前者对最低版本门有意义（GH #7046）。解析失败只 debug + 空版本，不阻断注册（`:3164-3170`）。
6. profile 集合的特征哈希 `profileSetSignature`（`daemon.go:3198` 起）覆盖 `ID/Enabled/runtime identity/CommandName/FixedArgs/Visibility`，按 ID 排序；服务端报「create/edit/disable/delete」后 diff 这个值来决定是否重注册（`MUL-3332`，注释 `:3190-3197`）。

DB 侧约束：`runtime_profile.protocol_family` 有 `CHECK (... IN (25 个族))`（最新 `server/migrations/441_...up.sql:6-33`，`NOT VALID` 兼顾历史行）；`(workspace_id, display_name)` 唯一（`120_runtime_profile.up.sql:64`）；`fixed_args JSONB NOT NULL DEFAULT '[]'`（`:61`）；注释（`:28-30`）点明**唯一的参数列是 `fixed_args`**——「the fixed arguments that EVERY agent on this runtime must inherit to enter a compatible mode」。

### 7.3 源码实测：参数排序为什么不能反（C）

`Command` 的文档注释（`server/pkg/agent/launch.go:36-68`）是整件事的正本，逐句翻译：

- 位置：`<Path> <Prefix...> <protocol args...> <ExtraArgs...> <CustomArgs...>`。
- 理由引用的实际例子里，wrapper 只有先吃掉 `start` 子命令才能到真正的 Claude 二进制，所以 `-p` 与其余 stream-json 协议 flag 在 prefix 被消费前**无意义、且会被 Commander 式解析器直接拒绝**（GH #7046）。
- 「Subcommand-style prefixes work only in this position. Flag-style prefixes generally parse the same either way ... so prefix-first is the broader of the two orders, not a universally safe one: a CLI that separates global flags from subcommand flags can still care where a flag lands.」——与文档 `daemon-runtimes.txt:135` 的免责声明同源。
- `Argv()` 把 prefix 复制后放在 args 之前（`launch.go:99-104`），且注释明确「Never mutate a Command's Prefix in place」；`exec()` 是**全包唯一**构造 runtime 进程的地方（`launch.go:107-115`），并用一个名为 `TestOnlyLaunchGoSpawnsRuntimeProcesses` 的测试守着——「a new backend cannot forget the launch prefix and silently reintroduce GH #7046」。
- daemon 侧为什么不用 `ExtraArgs` 承载 fixed_args（`daemon.go:8635-8640` 注释）：`ExtraArgs` 只有 6 个后端读、且在读它的那些后端里排在协议 flag **之后**，所以 wrapper 的子命令要么被丢掉要么被塞到 `-p` 后面（GH #7046）。
- 回退行为：prefix 里的协议关键 flag 被丢时打 warn 并**继续**（`launch.go:531`），不是报错；重叠但未被拦的 flag（如 `--model`）由 `warnLaunchPrefixOverlap` 记一条 warn，最终值由 last-wins 决定（`:568-570`）。

### 7.4 差异

- **无实质差异**；文档对排序理由的描述（子命令式 wrapper）与代码注释同源同因，连「仍有残险」的免责都一样。
- 补两点文档没写的：
  - **profile 集合的变更检测是哈希 diff**（`profileSetSignature`），不是逐个比对——所以「编辑 profile 只影响之后认领的 run」（`daemon-runtimes.txt:155`）在实现上多一层含义：daemon 会因为哈希变化**重注册**，新实例出现在 UI 上（`MUL-3332`）。
  - **删除实例与删除 profile 是两件事，且实例删除被主动拒绝**：profile 还活着时删实例返回 409 + 指引（`server/internal/handler/runtime.go:1017-1026`，`profileInstanceDeleteRefusal`），只有 profile 已消失的孤儿实例可直接删（`:1027-1033`，`MUL-4158`）。文档「Deleting only the runtime instance ... does not delete the profile」的说法偏软。

---

## 8. 权限面：private / public runtime

### 8.1 文档口径（D）

- `daemon-runtimes.txt:76`：本地 runtime 默认 private，只有 runtime owner 能在上面建 agent；「**Workspace owners and admins are no exception** — the runtime is someone else's computer, and running an agent there spends their machine and their tool credentials.」
- `daemon-runtimes.txt:78`：只有 owner 能改成 public；「workspace admins can **rename or delete** a runtime, but sharing one is the owner's decision.」其他成员选中这个 runtime **不会**分享底层工具的登录凭据，只是允许把自己的 agent 的 run 路由到这台机器。
- `cli.txt:172`：删除仍有 active agent 绑定的 runtime 默认被拒；`multica runtime delete --cascade` 解绑那些 agent、保留其配置与历史、取消其活跃 run。

### 8.2 源码实测（C）

- 列定义与默认值：`agent_runtime.visibility` 默认 `'private'`（`AgentRuntimeResponse` 注释 `server/internal/handler/runtime.go:41-44` 指向迁移 083）。
- **能不能绑**（`canUseRuntimeForAgent`，`runtime.go:870-889`）：

  ```go
  if !rt.OwnerID.Valid { return false }        // 无主一律拒
  if rt.Visibility == "public" { return true }
  return uuidToString(rt.OwnerID) == uuidToString(member.UserID)
  ```

  长注释（`:870-880`）逐句对应文档：「a `private` one is usable only by its owner, with **NO workspace owner/admin override** (MUL-6126): a private runtime is someone's own machine, and running an agent on it spends their credentials and their local files, which is not an administrative decision.」并点明「An ownerless runtime is refused whatever its visibility: task claim needs an owner to mint the agent's task token and cancels the task without one (MUL-3292)」——与 §6.2 的 `runtime.OwnerID` 检查同一根因。
- **能不能改分享**（`canSetRuntimeVisibility`，`runtime.go:891-900`）：`rt.OwnerID.Valid && owner == member`。注释：「Owner-only, and deliberately narrower than `canEditRuntime`: visibility is the owner's consent to lend their machine to the workspace, so an admin who could flip it would still hold the override `canUseRuntimeForAgent` removed. Admins keep `canEditRuntime` for the organisational actions — rename, delete.」
- 三档编辑器：`canEditRuntime`（改名/删除，owner 或 admin）、`canSetRuntimeVisibility`（分享，仅 owner）、`canUseRuntimeForAgent`（绑 agent，public 或 owner）。PATCH `/api/runtimes/:id` 先过 `canEditRuntime`（`runtime.go:510-514`）再过 `canSetRuntimeVisibility`（`runtime.go:535`）。
- 列表可见性：`ListVisibleAgentRuntimes`（`runtime.sql:11-19`）——`owner_id = $2 OR visibility = 'public'`；owner/admin 走 `ListAgentRuntimes`（能看见别人的 private runtime 以便改名/删除），普通成员走可见集（`runtime.go:916-935`，注释：「Governance visibility preserves the existing owner/admin contract: admins can find a private runtime to rename or delete it, but the per-runtime read gate still denies data and machine access.」）。
- 客户端同规则：`packages/core/runtimes/access.ts`（`isRuntimeUsableForUser`）——注释 `runtime.go:882` 明说「This is the same rule the clients enforce ... so UI, API and CLI agree」。
- 删除拒绝：`DeleteAgentRuntime` 先 `canEditRuntime`（`:1010-1014`），再查 active agents，有则 409 + cascade 计划（`:1035-1051`），确认路径 `POST /runtimes/:id/unbind-agents-and-delete`（`:1044-1047` 注释）。成员吊销另有 `ForceOfflineRuntimesByIDs` + `DeleteDaemonTokensByWorkspaceAndDaemons` + `CancelAgentTasksByRuntimeOrAgent` 一套（`runtime.sql:301-325`、`:351-371`、`daemon_token.sql:13-24`）。
- 公开 runtime 不分享凭据这一点在代码里体现为「runtime 的可达性」与「CLI 的登录态」完全解耦：登录态由各 CLI 自己存在本机（`install-agent-runtime.txt:56`「Those login credentials are stored locally by the tool itself. Multica never receives login tokens from Claude, Codex, Cursor, or any other CLI.」），daemon 侧不读、不上传。

### 8.3 差异

- **一致**，且代码比文档说得更硬（文档说「admin 也绕不过」，代码连「visibility 的修改口」都不给 admin）。
- 补一条文档只在 `cli.txt` 出现的细节：**无主 runtime 不可绑**是为 token 铸造服务的（§6.2），文档的 runtime 页没写这条，但它会在 UI 上表现为「这个 runtime 选不了」。

---

## 9. 差异清单（汇总）

| # | 位置 | 文档说 | 代码做 | 出处 |
|---|---|---|---|---|
| D1 | `providers` 工具表 + `install-agent-runtime` 命令表 | 25 款工具 | 25 个协议族、26 个侦测命令名（多 `zeroclaw`） | `config.go:974`、`agent.go:389`、`models.go:435`、`environment-variables.mdx:256` |
| D2 | DSH 启动例外 | 「CLI 侦测门」的例外 | 例外在**注册门**（`dshInstallInFlight`）；CLI 门的豁免是 `AllowNoAgents`，只给只读探针 | `daemon-runtimes.txt:48` vs `dsh_startup_bootstrap_test.go:22-68`、`config.go:189-191` |
| D3 | 重连宽限 | 只提概念不给数 | 默认 3h，下界 150s，env `MULTICA_RUNTIME_RECONNECT_GRACE` | `daemon-runtimes.txt:58` vs `runtime_sweeper.go:38-47`、`environment-variables.txt:44` |
| D4 | 7 天回收判据 | offline + 7 天 + 无 agent（含归档） | 另加「无非终态 task」；归档 agent **不**阻止回收 | `daemon-runtimes.txt:64` vs `runtime.sql:510-533` |
| D5 | Codex shell 策略 | 「installs a managed shell policy that allows the required task variables」 | 关掉 Codex 默认 secret 过滤（`ignore_default_excludes = true`）+ 精确 `include_only` | `daemon-runtimes.txt:107` vs `codex_shell_env.go:112-125` |
| D6 | 装完工具 | 「restart the daemon to detect it again」 | 每 2 分钟自动重扫（`MUL-5439`），登录-shell 路径最多 30 分钟 | `daemon-runtimes.txt:46` vs `agents_refresh.go:15`、`agents_probe.go:32` |
| D7 | 最低版本门槛 | 8 款 | 10 条（多 `dim 0.3.10`、`zeroclaw 0.8.0`） | `install-agent-runtime.mdx:63` vs `version.go:18-37` |
| D8 | QwenPaw 技能路径 | `per-run workspace skills/` | `<workDir>/skill_pool` | `providers.mdx:44` vs `execenv/context.go:409-411` |
| D9 | Dim 技能路径 | `—` | 落 default 分支 `.agent_context/skills/`（是否被 Dim 消费未核实） | `providers.mdx:47` vs `execenv/context.go:435-438` |
| D10 | Multica-managed MCP | 单一「支持 / 不支持」列 | 18 个后端走 `opts.McpConfig`；Cursor / OpenClaw 走写配置文件 | `providers.mdx:50` vs `cursor_mcp.go`、`openclaw_config.go:232-238` |
| D11 | 心跳 | 15s / 约 3 分钟 | 中间还有一层：Redis TTL 热路径 + 最多 60s 才落一次 `last_seen_at` | `daemon-runtimes.txt:54` vs `runtime_liveness_store.go:11-27`、`task.go:182-189` |
| D12 | `mat_` 绑的「current user」 | the current user | `runtime.OwnerID`（机器主人），不是任务发起人 | `auth-tokens.txt:79` vs `handler/daemon.go:3850` |
| D13 | runtime 维度 | computer + tool（× workspace） | + profile（两个部分唯一索引，内置与自定义并存） | `daemon-runtimes.txt:13` vs `runtime.sql:83/116`、迁移 120/121 |
| D14 | profile 实例删除 | 「does not delete the profile」 | profile 活着时**直接 409 拒绝**删除实例 | `daemon-runtimes.txt:155` vs `handler/runtime.go:1017-1026` |

---

## 10. 未查到 / 只到 [推断] 的部分

按票面纪律，这一节只写**没查实**的东西，不用想象补全：

1. **Dim 是否消费 `.agent_context/skills/`**——代码往那里写（default 分支），文档表给 Dim 画「—」。是否真被 Dim 扫描到，未核实（无上游依据、无测试断言）。[未核实]
2. **自动重试的具体次数常量**——`tasks.txt:151-157` 给了 2 次 / 3 次的表，我核到了 `expiredRuntimeReconnectRetries` 与 queued expiry 的 sweep 路径，但**没有**逐条追到「首跑 + 1 次重试」和「工具网络中断 3 次、末次延迟约 5s」的实现常量与判定点。[未深挖]
3. **`mat_` token 是否真的 `24h` 之外还有服务端时钟约束**——代码写死 `time.Now().Add(24*time.Hour)`，我没有再查是否有后台任务提前撤销（`DeleteTaskTokensByTask` 在任务结束路径上被调用的确切位置未逐处核对）。[未深挖]
4. **`mcn_`（Multica Cloud Node）的服务端实现**——`jwt.go` 里只有 `mul_` / `mdt_` / `mat_` 三个生成器，`mcn_` 未在本次克隆中找到对应生成代码。文档说它由 Multica Cloud Fleet 管理（`auth-tokens.txt:90`），可能不在开源仓内。[未查到]
5. **`launched_by` 与 `capabilities` 的取值全集**——注册元数据里有这两个字段（`handler/daemon.go:486-491`），本次未展开它们的枚举。与服务端能力协商（`protocol.DaemonCapability*`）相关，属另一条纵深。[未深挖]
6. **`omp` 之外的 builtin-runtime 身份**——描述符机制已通用（`BuiltinRuntimes` 是列表），但当前**只有 `omp` 一条**（`builtin_runtimes.go:86-100`）。是否有计划中的第二条未在代码中体现。[事实陈述，非缺口]
7. **快照损伤对本文的影响**：`daemon-runtimes.txt` 的「参数排序」代码块在快照里是空的（同级 `README.md:17`），本文的排序结论全部取自**仓内正本** `apps/docs/content/docs/daemon-runtimes.mdx:129` 与源码注释，不依赖那个空块。其余引用若来自快照，均已用仓内 `.mdx` 对拍过行号归属。

---

## 附：一句话版（给地图用）

Multica 的 runtime = `(workspace, daemon, provider, profile)` 四元组上的 `agent_runtime` 行，注册靠两条**部分唯一索引上的 upsert** 实现重启幂等；25 个协议族 / 26 个命令探针（`zeroclaw` 未进任何文档表）；任务级 `mat_` token 绑 `(task, agent, workspace, runtime owner)`、硬编 24h；在线判定 = 150s 陈旧 + 30s 扫掠，重连宽限默认 3h，7 天回收还要额外满足「无未归档 user agent + 无非终态 task」；runtime 分享权 owner 独占、连 admin 都无旁路，且**无主 runtime 一律不可绑**（因为铸不出 token）。