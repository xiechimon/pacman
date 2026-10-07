# 14 · skills 执行面注入（daemon 接线）

> 决策来源 = 2026-09-28/29 grilling 会话 + pi v0.86.0 源码调研。spec 13 把 skills 的「来源」改为本地目录扫描；本 spec 把扫到的 skills **喂到 agent 执行面**——daemon 不再让 pi 走自己的默认目录，而是显式扫描 pacman 配置的目录、生成 catalog、注入 session。父 issue = 待开（过目后补编号）；施工票 T3 一张。
>
> 上一手 spec = #365/#367（spec 13 + T1 skills 本地面）。本 spec 在它的对面补 daemon 半边——T1 完工前不能上 T3（两票共碰 skills 身份 wire 形状）。

## Problem Statement

skills 数据源已迁移到本地目录（spec 13），但 agent 执行面零消费——daemon 完全靠 pi 的默认目录（`~/.pi/agent/skills` + `<cwd>/.pi/skills`）自发现，不读 pacman 选的 `~/.agents/skills`。结果：

1. **目录裂**：pacman 配置一个目录，pi 默认另一个目录；用户跨工具切换 skills skills 看不到。
2. **id 模型分裂**：spec 13 定 `id = 目录名`；pi 用 frontmatter `name`（`agentskills.io` 行业标准）+ 真实路径去重。SKILL.md frontmatter 与目录名一致时两者重合，不一致就静默错位。
3. **执行面契约未定**：skills 内容是 system prompt 全文塞、还是 catalog 索引 + agent 按需读，规格缺一个。这决定 token 预算和 skills 体量上限。

## Solution

daemon 在创建 agent session 前，**显式扫描** pacman 配置的 skills 目录（env `PACMAN_SKILLS_DIR`，默认 `~/.agents/skills`），调用 pi 顶层导出的 `loadSkills` 与 `formatSkillsForPrompt`：

- **`loadSkills` 模式**：不读 pi 默认目录（`includeDefaults: false`，`agentDir` 传非 pi 默认值如 `PACMAN_HOME/agent`，让 pi 跳过它的 user-level 默认扫描），仅 `skillPaths: [PACMAN_SKILLS_DIR]` 单一正本——和 spec 13 的「单一正本」对齐。
- **id 模型**：skill 身份 = frontmatter `name`（`agentskills.io` 标准）；无 frontmatter / 无 `name` 字段 = 回落到目录名。wire id 与 runtime id 同源，不分裂。
- **注入形态**：catalog 而非全文。`formatSkillsForPrompt(skills)` 生成 `<available_skills><skill><name/><description/><location/></skill></available_skills>` XML 块（`agentskills.io/integrate-skills` 标准），**追加到** `SessionOpts.systemPrompt`（不是替换）。agent 自带的 `read` 工具在 description 匹配时按需读 SKILL.md 全文——pi 已为此写好「Use the read tool to load a skill's file when the task matches its description.」+ 「references are relative to the skill directory (parent of SKILL.md)」的 system prompt 段。
- **冲突去重**：pi 已对真实路径去重 + name 碰撞检测（winnerPath/loserPath），复用不动。

## User Stories

1. 作为把 skills 都放在 `~/.agents/skills` 的用户，pacman daemon 起来后这些 skills 自动出现在 agent 的可用集里——零额外配置。
2. 作为自托管用户，我在 `PACMAN_SKILLS_DIR=/path/to/other` 启动 daemon，skills 从那处加载，不读 `~/.agents/skills`。
3. 作为 skills 作者，我写 `name: foo-deploy` 在 SKILL.md frontmatter，pacman UI 列表、agent.skills 勾选、agent session 可用集都用同一个 `foo-deploy`——目录重命名不影响。
4. 作为长 skills 作者，skills 全文不塞 system prompt；agent 看到的是 catalog（name + description + location），按 description 匹配时自己 `read` SKILL.md——token 预算线性而非指数。
5. 作为冲突处理者，我在两个目录放同名 skill（realpath 不同），pacman 走 pi 的「winner path」裁决，daemon 日志打出 collision diagnostic。
6. 作为回归测试者，daemon 单测覆盖：env 缺省、env 指向不存在目录、目录无 SKILL.md、frontmatter 缺 name 回落、目录冲突——loadSkills 的 diagnostics 全部透传。

## Implementation Decisions

### 模块改动清单（决策点，不含具体文件路径）

**shared**
- 现有 `SkillRecord` wire 形状保留；`id` 字段语义 = frontmatter `name`，回落目录名（与 spec 13 「目录名 id」保持兼容：约定 SKILL.md 写 `name: <dir-name>` 时两者一致）。
- `agent.skills` slug 列表 = 同 frontmatter `name`，无 frontmatter = 目录名。
- `SessionOpts` 不加字段——daemon 不走 SDK 的「传路径让 pi 自己扫」路径，自己扫自己拼进 `systemPrompt` 字段（已有）。
- **日志前缀扩 `skills`**：`DAEMON_LOG_PREFIXES` 加 `'skills'`（与 supervisor / machine / step / workspace / recover / wake / mcp 七件并立）；`DaemonLogPrefix` union + `DaemonLogger` 接口 + `createDaemonLogger` 实现里加 `skills(msg)` 方法（与 `mcp(msg)` 同型）。这是 spec 14 诊断行形 `[skills] <type>: <msg>` 的 canon 落点。

**server**
- 无改动（spec 13 的 `GET /api/skills?teamId=` 现扫已足够供 UI；本 spec 复用其结果供 daemon 端比对即可，但 daemon 直接读本机目录，不经 server——self-host 单机模型下 server 中转无收益）。

**daemon**
- `apps/daemon/src/config.ts`：加 `skillsDir: string`（schema），default = `env.PACMAN_SKILLS_DIR ?? join(homedir(), '.agents', 'skills')`。env 优先级高于 home 默认（承现有 settings 缝纪律）。
- `apps/daemon/src/backend/pi.ts`：`createAgentSession({...})` 之前，新增步骤：
  1. `loadSkills({ cwd: config.home, agentDir: '<不存在的 pi 默认路径>', skillPaths: [skillsDir], includeDefaults: false })` → `{ skills, diagnostics }`（**`cwd` 用 daemon home 不依赖任务 worktree**——避免 worktree 切换导致 project-level skills 解析跳变）
  2. catalog size 闸：skills 总数 > 50 时只取前 50 + `[skills] cap: total=<N> truncated=50` 日志；单 description > 200 字符截断 + 末尾 `…` + `[skills] cap: description truncated for <name>` 日志（具体阈值 lane 内可微调，原则是 catalog 不能无限增长）
  3. `formatSkillsForPrompt(skills, fileReadTool)` → catalog XML 串
  4. ~~把 catalog 拼到 `SessionOpts.systemPrompt` 末尾~~ → **落点改归简报文件通道**（spec 24 / #958）：catalog 内容仍由本步骤产出，但由 runner 写进任务 worktree 的上下文文件（pi: `AGENTS.md` 系；claude-code: `CLAUDE.md`），靠 CLI 原生记忆机制加载，systemPrompt 通道对这类后端清空。拼接语义不变（`\n\n` 分隔、与 runner 给的正文拼接而非覆盖）。**注意别把这两件事读成矛盾**：上面第 1 条的「`cwd` 用 daemon home」说的是**技能目录的扫描位**（不随 worktree 切换跳变），本条的「写进 worktree」说的是**简报文件的落点**——扫描位不动，落点变了
  5. `diagnostics` 经 `logger.skills` 透传「`[skills] <type>: <msg>`」族
- `agentDir` 怎么填「非 pi 默认」：传 `join(homedir(), '.pacman-no-such', 'agent')` 之类绝对不存在的值，强制 pi 跳过 user 默认扫描；或读 pi 源码确认是否有「只关 user 默认不关 project 默认」的旗标——若没有就用不存在路径兜底。
- **read 工具可达路径集扩 skills 根目录**：`apps/daemon/src/runner.ts` 现有的 read 工具 path 白名单（per-task worktree 边界）须包含 `skillsDir`，否则 agent 在 description 匹配时调 `read SKILL.md` 会被 sandbox 拒绝——**spec 14 通路打不通的硬阻塞点，不修本 spec 不可发车**。

**web**
- 无改动（spec 13 已删上传/导入页；UI 只读列表已在）。
- 后续若想加 UI 可配性（account 页一个输入框），按 spec 13 「Out of Scope」指示属后票。

**i18n**
- 无新增文案。

**verify / e2e**
- daemon 单测：loadSkills 在五种输入态（env 缺省 / env 指向不存在 / 目录无 SKILL.md / frontmatter 缺 name 回落 / 目录冲突）的输出断言。
- verify-pacman feature map 加一条「daemon session 启动后 skills catalog 注入 system prompt」断言（用 mock agent session 的 capture fixture）。
- 端到端：在 `~/.agents/skills/foo/` 下放一个含 SKILL.md 的 fixture 目录，跑一个跑通的 task，断言 transcripts 里能看到 agent 主动 `read` SKILL.md（说明 catalog 触发了按需读）。

### 数据契约

- env：`PACMAN_SKILLS_DIR` —— 单字符串，dir 路径（默认 `~/.agents/skills`）。缺省 / 不存在目录 = 空 skills 集（与 spec 13 同律）。
- daemon log：`[skills] <type>: <msg>` 族（`<type>` ∈ `loaded | collision | invalid-frontmatter | missing-skill-md`），info 级别。
- SessionOpts.systemPrompt：现有用户态拼接 `+ '\n\n' + formatSkillsForPrompt(skills, 'read')`。`fileReadTool` 传 `'read'` —— pacman daemon 默认带 `read` 工具。

## Testing Decisions

测试侧重行为契约，不校验实现细节。
- daemon 单测：env 缺省值、未配置 env、env 指向不存在目录、目录存在但空、目录含正常 skill、目录含 frontmatter 缺 name 的 skill（回落目录名）、目录冲突两个同名 skill（winner path 裁决）。
- integration：起 daemon + mock skill dir + mock agent session，断言 session.systemPrompt 含 catalog XML；agent 调 `read` 一个 SKILL.md 时 daemon 的 transcript 含 SKILL.md 全文（说明按需读通路通）。
- 回归：现有 24 / integration 测试不应因 systemPrompt 追加而失败（catalog 是尾部附加，不覆盖既有段）。

## Out of Scope

- UI 可配性（account 页输入框）——spec 13 已 defer；本 spec 不重启。
- skills 自动 follow（文件 watcher，目录变动时 reload session）——本 spec 不引入，会让 daemon 状态机复杂化；用户重启 daemon 即生效。
- 项目级 skills（`<cwd>/.pi/skills` 类似物）——本 spec 不引入；spec 13 的单一正本原则延续。
- pi 的 `disable-model-invocation` frontmatter 字段的 UI 暴露——pacman UI 不区分 catalog / skill，按 agentskills.io 标准 catalog 列出全部、skill 调用经 `/skill:<name>` 走明面触发（具体 pi 是否暴露 `/skill:` 命令不在本 spec 范围）。
- skills 与 per-agent 授权（`agent.skills` 勾选）的运行时筛选——本 spec 把 catalog 全量注入；per-agent 筛选后续票（与 MCP 「agent 编辑面候选源换」同构）。

## 团队技能物化回摆（XMON-112 S2，2026-10-01）

spec 13 定技能库 server 端写路径（XMON-109 S1：REST 写面 + machine-wire 下发端点 `GET /api/machine/skills/{stepId}`）。本节补 daemon 消费半边：团队技能的**步级物化**——没有它，agent 建的技能只在 server 投影里可见（server 目录 ≠ 各 daemon 目录），任何机器的会话都用不上。

### 数据流

步启动（runner 建会话前）按 stepId 拉技能包——server 出包规则：worker 步 = claim `agent.skills` 白名单 ∩ server 端现扫；chief 步 = 信任面全量；字节闸单文件 ≤ MAX_SKILL_FILE_BYTES、包总量 ≤ MAX_SKILL_TOTAL_BYTES，超限 400 点名（S1 面）——物化到本机缓存目录，经 `SessionOpts.teamSkillsDir` 透传 backend，`buildSkillsCatalog` 与本机 `skillsDir` 合并扫描。

### 缓存策略（内容寻址）

- 缓存根 = `<PACMAN_HOME>/team-skills/`；条目 = `<sha256(包确定性序列化)>/`，其下每技能一个 `dirName/` 子目录（文件逐字节落盘，含嵌套相对路径）。
- 命中即复用：同包跨步零重写，目录 mtime 触摸（LRU 视为最新使用）；内容变化 = 新 hash 目录。取内容寻址而非 mtime 失效的原因：daemon 无从得知 server 侧目录 mtime，而包内容 hash 天然覆盖「server 改了任何文件」的全部情形，且并发步命中同一目录时天然幂等。
- 写入原子性：`.tmp-*` 目录 + rename 落位——半写目录永不以 hash 名可见；并发竞争 rename 失败且目标已在位 = 内容相同，直接复用。
- 生命周期：mtime LRU pruning，保留上限 `TEAM_SKILLS_CACHE_MAX_ENTRIES = 16`（包总量 ≤ 2MB，磁盘上界 ≈ 32MB）；崩溃残留的 `.tmp-*` 一并回收。pruning best-effort，失败只记日志不影响本步。
- 路径安全（纵深防御）：server 写面已有目录安全正则与相对路径守卫（S1）；daemon 独立复核每条 `dirName`（单段、非 `.`/`..`、不含分隔符）与文件 `path`（相对 posix、无空段 / `.` / `..` / 反斜杠 / 绝对路径）——任一非法 = **整包拒绝**（`team-invalid` 行），绝不部分写入。

### 合并与冲突裁决（团队胜）

- `skillPaths` 顺序 = `[teamSkillsDir, skillsDir]`：pi `loadSkills` first-wins（先进 Map 者为 winner），同名冲突**团队条目胜**、本机影子落 collision 诊断行（winner=团队路径，loser=本机路径）——白名单授予是权威信号，本地同名影子即失效。
- cap 50 闸对合并后序列生效：团队条目在扫描序前端，优先占据 cap 名额；allowlist 过滤仍先于 cap（#372 语义不变，名单外团队条目同样被裁，`[]` = 零注入纪律不变）。
- loaded 行：团队目录在位 = `loaded: N skills from <teamDir> + <localDir>`；纯本机 = 原行形不变。

### 降级（spec 14 MCP 降级同律，会话不阻断）

- 拉取失败（server 不可达 / 4xx / 5xx；老 server 无端点 404 同形 = 版本墙 fail-open）→ `[skills] team-fetch-failed: <原因> — continuing with local skills only`，仅本机技能。
- 非法包 / 写入失败 → `[skills] team-invalid: <原因> — continuing with local skills only`。
- 空包 `{skills:[]}`（白名单空）→ 零物化（缓存根不创建），catalog 走纯本机路径。
- **零回归判据**：无 `teamSkillsDir`（白名单空或拉取失败）时 `buildSkillsCatalog` 输出与改动前**逐字节等价**——金样对照测试固化（期望字节 = 改动前实现的实际输出冻结）。

### 契约与日志族增补

- `SessionOpts` 增可选 `teamSkillsDir?: string`（packages/shared，纯加法：旧 backend / 旧调用面零感知；消费落点 = backend catalog 构建）。
- machine-wire 响应单源 = `machineSkillsResponseSchema`（客户端 zod parse 对拍，`MachineApi.skills(stepId)`）。
- `[skills]` 日志族增四行形：`team: N skill(s) materialized → <dir>` / `team: N skill(s) cache hit → <dir>`、`team-invalid: …`、`team-fetch-failed: …`、`team-prune: failed …`。

## 清单 + 按需拉回摆（#920，2026-10-07）

S2 的「一次 GET 塞全量全文」分发形态对真实技能库从未成功过：两道字节闸（单文件 512,000 / 整包 2,000,000）对着实测数据（全库 104 技能 / 1353 文件 / 18.40MB；单个 archify 资产 727,976 字节超单文件闸）必超，daemon 的 fail-open 降级把 400 吞掉后，远端机器技能面恒空且无告警（本机 daemon 日志同一文本 43 次连续失败）。本节替换 S2 节的分发形态、缓存拓扑与失败语义三面；出包选择规则（worker = 白名单 ∩ 现扫、chief = 信任面全量）、合并与冲突裁决、`SessionOpts.teamSkillsDir` 契约、路径安全守卫与零回归判据不变。

### 分发形态（清单 + 按需拉）

- `GET /api/machine/skills/{stepId}` → 分发清单（响应单源 = `machineSkillsManifestResponseSchema`，客户端 `MachineApi.skillsManifest(stepId)` zod parse 对拍）：`selection`（`all` = chief 信任面全量 / `whitelist` = agent.skills 白名单交集）+ 每技能 record 三字段 + dirName + 文件清单（path / sizeBytes / sha256）。分发面不设字节闸——按需拉后单请求预算 = 单文件，库总量不再是约束；写面闸（REST/relay 的 MAX_SKILL_FILE_BYTES / MAX_SKILL_TOTAL_BYTES）不变。
- `GET /api/machine/skills/{stepId}/file?dirName=&path=`（MACHINE_WIRE_EXTENSIONS 新登记位，客户端 `MachineApi.skillFile`）→ 清单内单文件原始字节（application/octet-stream，二进制诚实——旧 utf8 文本投影会损坏非文本资产）。选择面与清单端点同源（skillsSelection 重算，含 realpath/id 去重）：白名单外技能、清单外路径（未知文件 / 目录 / 符号链接 / 逃逸形）一律 404 不泄存在性。

### daemon 缓存拓扑（双层内容寻址）

- 缓存根 `<PACMAN_HOME>/team-skills/` 分两层：`blobs/<sha256>` 单文件内容库（一次写入、tmp+rename 原子落位、mtime LRU 上限 `TEAM_SKILLS_BLOB_MAX_ENTRIES = 4096`）+ `views/<sha256(清单确定性序列化)>` 运行时读取目录树（每技能一个 dirName/ 子目录，由 blobs hardlink 装配、跨设备回落 copy；mtime LRU 上限 `TEAM_SKILLS_CACHE_MAX_ENTRIES = 16`）。
- 增量面（#920 验收）：只拉本地缺失或 hash 不同的文件——改一个文件只传一个文件；清单不变 = 视图命中、零请求。hardlink 使视图与 blob 生命周期解耦：blob 路径被 LRU 回收不损已装配视图，视图重建时缺失 blob 重新拉取。
- 完整性：逐文件 sizeBytes + sha256 双校验后才落 blob，不符 = 显式报错（绝不带病物化）。
- 写入原子性延续：视图 `.tmp-*` + rename，失败路径无半写视图；#920 前的旧形态残骸（缓存根顶层内容寻址目录）由 prune 一并回收。

### 失败语义（显式报错，不许静默降级跑空）

- 通道失败（server 不可达 / 4xx / 5xx / 非法清单 / 路径逃逸 / 完整性校验不符 / 文件按需拉取失败）→ 抛 `TeamSkillsError`，runner 按 failed 收尾：`done.errorMessage` 点名 `team skills distribution failed: <根因>`，零会话创建。S2 节的 fail-open 降级（含版本墙 404 形态）退役——静默降级正是 #920 要消灭的形态。
- 空清单（200，`skills: []`）= 服务端无可分发技能的配置事实（白名单空 / server skillsDir 空），非通道故障：`team-manifest-empty` 显式行（点名 selection 语境）+ 零物化，会话以本机技能照常。
- `[skills]` 日志族行形（替换 S2 节的 `team-invalid` / `team-fetch-failed` 两形）：`team: N skill(s), M file(s) materialized → <dir> (fetched K file(s) / B byte(s), reused R)` / `team: N skill(s) cache hit → <dir>` / `team-manifest-empty: … (selection=…) — running with local skills only` / `team-skills-failed: …` / `team-prune: failed …`。

## Further Notes

### Premortem（三大死因 + 护栏）

- **`PACMAN_SKILLS_DIR` 指向无权限/无读权限的目录** → 护栏：daemon `loadSkills` 抛错时降级为空集 + `[skills] invalid: <msg>` 日志，不炸 daemon 启动。
- **frontmatter `name` 与目录名不一致** → 护栏：pi 的 `loadSkills` 已用 frontmatter name 作主键、目录名仅在 frontmatter 缺时回落；本 spec 把这个语义明示，UI 显示「目录名（name））」歧义时双标。
- **大 skills 内容触发 prompt 膨胀** → 护栏：catalog 是索引不全文（`formatSkillsForPrompt` 默认不展开）；agent 按需 read 全文。token 预算只与 catalog 长度线性相关，与 skill 总长度弱相关。

### 与 spec 13 的对位

spec 13 锁 skills 「**来源**」（server live-scan、`GET /api/skills?teamId=`）。本 spec 锁 skills 「**执行面**」（daemon loadSkills + catalog 注入 + agent 按需读）。两张 spec 互为半边，落地顺序：先 spec 13 / T1，再本 spec / T3——T1 的 server live-scan 是 T3 的可借鉴参照（同一份 scan 逻辑可作为 daemon load 的备选实现，但 daemon 当前直接从本机目录读更轻）。

### 节奏

施工票 T3 一张，无 lane 阻塞：
- **T3 skills 执行面注入**（daemon）：env 配置 + loadSkills 接线 + systemPrompt 拼接 + 日志 + 单测 + integration。
T1 (#367) 不阻塞 T3 但共享 wire 形状；T1 完工后开 T3 让 lane367 自审「frontmatter name 回落」契约被两 spec 一致表达。

## Acceptance Criteria

- [ ] `apps/daemon/src/config.ts` 增 `skillsDir` 字段，env `PACMAN_SKILLS_DIR` 覆盖默认 `~/.agents/skills`；缺省 / 不存在 = 空 skills 集不报错
- [ ] `apps/daemon/src/backend/pi.ts` 的 `createAgentSession` 调用前注入 catalog：`loadSkills`（`cwd: config.home`、`includeDefaults: false`、`skillPaths: [skillsDir]`）+ `formatSkillsForPrompt(skills, 'read')` 拼到 systemPrompt 末尾
- [ ] **read 工具可达路径集含 skills 根目录**——这是本 spec 通路连通性的硬验收；端到端测试断言 agent `read SKILL.md` 不被 sandbox 拒
- [ ] catalog size 闸生效：skills > 50 → 截顶 + 日志；description > 200 字符 → 截断 + 日志
- [ ] `DAEMON_LOG_PREFIXES` 增 `'skills'` 词表项；`DaemonLogger.skills(msg)` 方法实现；`isLogPrefix` 校验通过；formatLine 输出 `[skills] msg`
- [ ] daemon 日志族「[skills] <type>: <msg>」输出 loaded / collision / invalid-frontmatter / missing-skill-md / cap 四态各一例（fixture 验证）
- [ ] daemon 单测覆盖五种输入态 + 截顶 + 截断 + read 工具可达
- [ ] integration：daemon + mock skill dir + mock agent session 验证 session.systemPrompt 含 catalog XML，agent 调 `read SKILL.md` 时 transcript 含 SKILL.md 全文
- [ ] `pnpm lint` + `pnpm typecheck` + 相关 e2e 与 integration 测试全绿
- [ ] 现有 24 / integration 不回归

## Out of Scope（重复声明）

- 项目级 skills（`<cwd>/...` 形式）
- file watcher / 自动 reload
- UI 可配
- per-agent 运行时筛选（已被 #372 白名单与下方 #917 硬挡两度修订，此条不再成立）
- pi 的 `/skill:<name>` 命令的明面暴露（按 pi 自身节奏）

## 技能可见面收归（#917，2026-10-07）

#958 / spec 24 把简报（含本 spec 的 skills catalog）搬进 worktree 上下文文件通道后，对 #917 的四条口径做了交叉裁决（正本 = issue #917 内同名评论）：口径 1（pacman 目录注入成唯一来源、取消 `SKILLS_CATALOG_CAP`）与口径 2（关掉 Claude Code 原生 Skill 工具面）**搁置**——简报现在依赖原生上下文文件通道，「关原生面」的方向不再成立，cap 50 闸与 description 200 字符截断**照旧不动**；口径 3（显式 `settingSources`）与口径 4（白名单硬挡）升为简报通道的**落地前提**，随本票落地。另有一项 #958 接线期实锤的发现折回本票：pi 的 resource loader 自注入一份 `<available_skills>` 段（重复清单问题先于 pacman 的目录注入存在），收口归本节。本节是裁决后的落地正本；与前文冲突处以本节为准。

### 裁决后的范围（逐条实现）

1. **显式 settingSources（口径 3）**：claude-code 后端组装 SDK Options 时钉 `settingSources: ['user', 'project', 'local']`——把「依赖 SDK 缺省（omitted = 全部加载）」改成「依赖产品声明」。`'project'` 是 CLAUDE.md 简报的承重位（spec 24 §通道漂移：这一档被关掉或缺失，简报**零报错地消失**）；后续任何改动要动这个列表，先重验简报存活。
2. **白名单硬挡（口径 4）**：`agent.skills` 之外技能的**文件读取必须被拒**，不只是不出现在目录里。落后端各表：
   - **claude-code**：SDK `settings.permissions.deny`（flag settings 层，用户可控设置里最高优先级）按扫描出的每个未授权技能下三条规则：
     ① `Read(//<baseDir>/**)`——文件工具面。`//` 前缀 = 文件系统根锚定的 gitignore 形（Claude Code permissions 正典），路径里的 gitignore 元字符（`\ * ? [ ]`）反斜杠转义。deny 规则在**包括 `bypassPermissions` 在内的每个 permission mode 都生效**（官方文档明示 + `docs/verify/917/` 实物对照：无规则时 bypass 下读成功、有规则时同一读取被拒），且 Read 面 deny 同路径连带挡 Edit/Write（≥2.1.208 语义；bundled CLI 2.1.278）。
     ② `Skill(<name>)` + ③ `Skill(skill:<name>)`——Skill 工具面。**实测两条机制事实决定了这一层必须独立存在**：Read deny **不**连带挡 Skill 工具的内容加载（Skill 调用读 SKILL.md 不走 Read 权限检查——`docs/verify/917/` B4：仅 Read deny 时未授权技能内容仍进模型上下文）；而 `Skill(<name>)` deny 在 bypassPermissions 下拒绝调用并落 `result.permission_denials`（B5 实物）。`skill:` 前缀形按官方文档匹配该技能的任一名字（alias / display name），与精确形并发双保险。
     **不采 SDK `skills` 选项**：d.ts 宣称「unlisted skills are hidden from the model's listing and rejected by the Skill tool」，实测（`docs/verify/917/` run1 B2）它只被 SDK 翻译成 `Skill(<name>)` **allow** 规则——allow 规则在 bypassPermissions 下无效果，且原生清单条数分毫未动（122 → 122）。宣称与实现不符，弃用。
     chief 步（allowlist 缺省）不发任何 deny 规则（CLI 默认行为零回归）。空白名单（`[]`）= 全部扫得技能进拒绝集（目录零注入纪律的对应面）。
     **已知残差**：deny 规则只覆盖 pacman 扫描面（`PACMAN_SKILLS_DIR` + 团队目录）里点得出名字的技能；机器上原生目录（`~/.claude/skills`、插件）里 pacman 不知道的条目仍对模型可见、可调用——那是被搁置的口径 2（关整个原生面）的领域，本节不越权。实物基线：本机原生清单 122 条（B1）。
   - **pi**：内建 `read` 以同名 customTool 覆盖成门控版（#866 T5 gated bash 同形，pi 注册表按名后写胜出）。门控落在 `ReadOperations.readFile/access`：命中未授权技能 `baseDir` 前缀的路径抛拒绝——比较前**两侧都过 realpath 归一**（macOS `/tmp` → `/private/tmp` 符号漂移不得放行），拒绝进 tool error 结果（agent 可见改道文案）+ `[skills] denied-read:` 行。pi 的 `operations` 是**整体替换**（read.js `options.operations ?? defaultReadOperations`），故 `readFile/access/detectImageMimeType` 三件必须齐——最后一件透传 pi 根导出的 `detectSupportedImageMimeTypeFromFile`，图片读取面零扰动。
   - **未授权集的单源**：`collectDeniedSkillDirs`（backend/pi.ts 导出，claude-code.ts 经 backend 缝内既有通道消费）——与 `buildSkillsCatalog` 同参扫描（teamSkillsDir 在前 first-wins），allowlist 缺省 → 空集；名单外条目的 `baseDir` 即拒绝目标。目录里未被扫成技能的散文件不属本节授权面。
   - **已知边界（如实登记）**：bash 绕行（`cat <未授权 SKILL.md>`）两后端都不挡——本节硬挡的覆盖面 = 文件工具面，与口径 4「permission deny 路径规则」的字面一致；沙箱级收敛不在本票。
3. **pi 原生发现关断（#958 折回）**：pi 的 `DefaultResourceLoader` 传 `noSkills: true`，消除 pi 自注入的 `<available_skills>` 段（发现面 = agentDir/skills 与 `.pi/skills` 系默认目录）。关断后 pi 侧技能目录**只剩简报文件通道一份**（AGENTS.md，经 `buildSkillsCatalog` 产出）。`noContextFiles` / `agentsFilesOverride` **一概不动**——那是 AGENTS.md 简报的承重位（spec 24 同律）。
4. **pi 保留 catalog（口径 5）**：两后端的技能可见面差异以本条为正本——pi = 简报文件通道唯一（原生发现已关断）；claude-code = 简报文件通道 + 原生清单（清单本身按搁置的口径 2 保留，其中 pacman 扫得的未授权条目被 deny 规则硬挡——文件读取与 Skill 调用两侧，见第 2 条）。
5. **观测**：`[skills]` 日志族增三行形——`catalog: entries=<N> chars=<C>`（**每次**目录构造都落，entries=0 也落：技能目录条数的明确信号）、`deny: <N> skill dir(s) hard-blocked`（会话建立时硬挡集非空才落）、`denied-read: <path> (skill <name> not in allowlist)`（pi 门控每次拒绝落一行）。claude-code 侧的逐次拒绝发生在 CLI 进程内，daemon 日志无逐次行——观测面 = transcript 里的 tool result（isError）与 `result.permission_denials`。

### 版本兼容

本节 wire/schema **零变更**（`SessionOpts.skillsAllowlist` / `teamSkillsDir` / machine skills 端点全是 #372 / XMON-112 既有面，本节只改 daemon 进程内的消费方式）——新 daemon × 旧 server、旧 daemon × 新 server 构造性兼容。验收 = shared 快照面不动 + integration 全绿，不另造版本歪斜 fixture。

### 验收（seam，双向）

- **单测**：claude-code sdkOptions 组装面（settingSources 钉值；deny 规则三条形 `Read(//…/**)` / `Skill(<name>)` / `Skill(skill:<name>)` 与元字符转义；chief 不发 settings、`skills` 键恒不发）；`collectDeniedSkillDirs` 四态（缺省 / 部分授权 / 空名单 / 未知 slug 容忍）；pi 门控 read ops（未授权拒绝且带技能名、授权放行、realpath 归一生效、图片 mime 面在位）；`catalog:` / `deny:` 日志行形。
- **integration（skills-inject-e2e 扩展）**：同一次运行取两侧证据——worker 步 read **授权** SKILL.md = 正文 marker 落库（既有条），read **未授权** SKILL.md = tool 结果带拒绝文案、其正文 marker **不**落库；pi agentDir 种一个原生技能后，stub 请求面**不出现**该技能段（noSkills 实证，before = 关掉 noSkills 的同 harness 红跑 + #958 期两份清单并存的接线实录）；`[skills] catalog: entries=` 行落盘。
- **实物取证（docs/verify/917/，已归档）**：真 SDK/CLI（bundled 2.1.278 + 真模型）before/after 对照六件——A1/A2：deny 规则在 `bypassPermissions` 下挡 Read（无规则读成功 / 有规则被拒，init.permissionMode 两侧均 bypass 实证）；B1：原生清单实数基线；B3/B4/B5：Skill 工具面三态（无规则可调用 / 仅 Read deny 不连带挡 / `Skill(<name>)` deny 拒绝并落 permission_denials）；C1：显式 settingSources 下 CLAUDE.md 简报通道存活。机制声称一律取运行时真值，读源码/看配置不算验收。