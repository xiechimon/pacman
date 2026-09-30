// Fixture record contract = 02-架构平价 §6.2 + §4.1 todo field table.
// Field set copied from the r3 §3.0 observed wire shape:
// phaseAt/seqNum/orderIndex/tagIds/spec/assignment/agent/latestBuildId/
// lastRunAt/hasChanges/hasPlan/buildHistory/sourceTodo/v — plus one [推断]
// display-only extension (awaitingReply, see the field) carried for the
// observed waiting-on-user board placement.
// Timestamps are epoch milliseconds (02 §6.2 schedule record precedent).

// phase 九值枚举单源 = @pacman/shared（02 §4.1；#65 M1 收口），本地不再定义。
// GithubRepoSummary = repo picker 行封套单源（spec 12 数据契约，#359）。
import {
  type GithubRepoSummary,
  type ModelSource,
  PHASE_VALUES,
  type Phase,
  type ProjectRepoKind,
  type TagRecord,
} from '@pacman/shared';

export type { Phase };
export { PHASE_VALUES };

/** Agent reference embedded in a todo record (02 §6.2 agent shape subset). */
export interface AgentRef {
  id: string;
  displayName: string;
}

/** Agent assignment on a todo (r3 §3.0 `assignment` field). */
export interface AssignmentRecord {
  agentId: string;
}

/** Build history entry (buildId ≡ conversationId, CONTEXT.md). */
export interface BuildRef {
  buildId: string;
  createdAt: number;
}

export interface TodoRecord {
  id: string;
  teamId: string;
  projectId: string;
  title: string;
  spec: string;
  phase: Phase;
  phaseAt: number;
  seqNum: number;
  orderIndex: number;
  tagIds: string[];
  assignment: AssignmentRecord | null;
  agent: AgentRef | null;
  latestBuildId: string | null;
  lastRunAt: number | null;
  hasChanges: boolean;
  hasPlan: boolean;
  buildHistory: BuildRef[];
  sourceTodo: string | null;
  /** Record version, r3 §3.0 wire field replicated verbatim (value observed 2–4). */
  v: number;
  /** True when the latest run stopped to ask the user something (r5b §3.15
   *  #1: phase review, card sits in 执行中 with a 回复 button). [推断] wire
   *  field — not in the r3 §3.0 snapshot, needed to reproduce the observed
   *  board placement and card action for waiting-on-user todos. */
  awaitingReply?: boolean;
}

/** Token 用量 content (issue #68, r7 30): the cumulative-run figures,
 *  verbatim strings from the capture. Rendered as a static right-pane
 *  section on the detail route (issue #366). */
export interface TokenUsageContent {
  total: string;
  model: string;
  modelTotal: string;
  input: string;
  output: string;
  cacheRead: string;
  cacheWrite: string;
}

/** 分支与 PR content (issue #68, r7 31): sync-tab fields. Board cards open
 *  the dialog; the detail route renders it as a right-pane section (#366). */
export interface BranchInfoContent {
  branch: string;
  commit: string;
  machine: string;
  directory: string;
}

/** One 运行历史 row. r7 32 froze the single-row state (ring glyph);
 *  the r8 80 dark capture adds the multi-row forms: failed runs carry a
 *  stop-colored ×, succeeded ones a done-colored check (r8 80). */
export interface RunHistoryRow {
  label: string;
  meta: string;
  /** r8 57: `failed-current` = the failed run that is still the current
   *  one — carries the 当前 chip; a failed PAST run under a live current
   *  one carries none (r8 77/80). */
  status: 'current' | 'failed' | 'done' | 'failed-current';
}

/** Detail-route right-pane view (issue #366): the doc surface (DocPane
 *  plan/changes/diff) plus the three static sections that replaced the
 *  former head-icon overlays. */
export type PaneView = 'doc' | 'branch' | 'token' | 'history';

/** Modal surface rendered over a route (issue #68). The scenario fixture
 *  opens one for capture determinism; the header/card buttons open the same
 *  set interactively. The branch payload is build-scoped display data —
 *  outside the 02 §6.2 record contract — resolved per todo from the fixture
 *  layer; the accept dialog carries no payload. Token/history left the
 *  overlay family in #366 (static right-pane sections, PaneView). */
export type OverlayKind = 'branch' | 'accept' | 'rerun' | 'reuse' | 'review';

export interface OverlayState {
  kind: OverlayKind;
}

/** The three build-scoped payloads travelling together (issue #68): the
 *  board branch dialog and the detail right-pane sections (#366) read the
 *  same set. */
export interface BuildOverlayContent {
  token: TokenUsageContent;
  branch: BranchInfoContent;
  runs: RunHistoryRow[];
}
/** Overlay open-states a scenario freezes (issue #67): the ⌘K search
 *  panel, the detail status-chip popover and the doc-pane 方案▾ dropdown.
 *  Pure initial UI state — the overlays stay interactive afterwards. */
export interface OverlayUi {
  /** ⌘K panel open; absent query = the empty 前往 surface (r7 05). */
  searchOpen?: boolean;
  searchQuery?: string;
  /** Status-chip popover open over the detail header (r7 19 / 29). */
  chipPopoverOpen?: boolean;
  /** 方案▾ document-type dropdown open in the doc pane (r7 20). */
  planDropdownOpen?: boolean;
  /** Right-pane view frozen for the capture scenarios (issue #366 — the
   *  former `overlay: token/branch/history` freeze of r7 30/31/32, r8
   *  57/77/78–80; absent = the doc view). */
  paneView?: PaneView;
  /** Account 语言 dropdown open (issue #74; open state [设计] — the
   *  official option list was never captured, r2 §11 Q19). */
  langDropdownOpen?: boolean;
  /** 看板顶部通知引导条 (issue #114, r2 §1.3: captures 01/28/30). Freezes
   *  the Notification.permission === 'default' state for the fixture — the
   *  r7 board baselines carry no banner, so no existing scenario may grow one. */
  notificationBanner?: boolean;
}

/** Scheduled rule (02 §9.2 / r3 §8.3 wire shape, copied verbatim:
 *  `{id, teamId, projectId, todoId, kind, at, tz, machineId, nextRunAt,
 *  createdBy, todo{seqNum,title,phase,projectName,ownerId}}`). */
export interface ScheduleRecord {
  id: string;
  teamId: string;
  projectId: string;
  todoId: string;
  /** 频率 tab (02 §9.2): 每小时/每天/每周/单次. */
  kind: 'hourly' | 'daily' | 'weekly' | 'once';
  at: number;
  tz: string;
  /** null = 自动 (r3 §9 机器 row). */
  machineId: string | null;
  nextRunAt: number;
  createdBy: string;
  todo: {
    seqNum: number;
    title: string;
    phase: Phase;
    projectName: string;
    ownerId: string;
  };
}

/** Commit row of the project 文件|历史 segment's 历史 view (#149; display
 *  shape shared by the fixture and the live wire mapper — [推断] endpoint
 *  GET /api/projects/{id}/commits, row = git log minimal projection). */
export interface ProjectCommitRow {
  id: string;
  shortSha: string;
  message: string;
  authorName: string;
  /** Author instant, epoch ms (relativeTime renders against the clock). */
  at: number;
}

/** Repo surface of a project route (r2 07e/24 file tree + 24c settings
 *  rows): branch chip, file rows and the settings card values. */
export interface ProjectContent {
  /** Display name (r2 24c 名称 row); the repo slug is a separate attribute
   *  (CONTEXT.md 租户层级: repo belongs to the project, not the reverse). */
  name: string;
  branch: string;
  files: string[];
  repoName: string;
  /** True = the `Pacman 托管` chip rides beside the repo name (r2 24c). */
  hosted: boolean;
  /** repo 形态（spec 12 三形态，词表单源 = shared ProjectRepoKind；live 面
   *  = wireProject.repoKind 透传）。local = Files tab 禁用（占位 + 一行
   *  disable 文案，G2-T2 v1）。 */
  repoKind?: ProjectRepoKind;
  defaultBranch: string;
  description: string | null;
  /** 历史 segment rows (#149); fixture-frozen, newest first. */
  commits?: ProjectCommitRow[];
  /** 文件查看器 fixture 供肉(#202):文件名 → utf-8 文本。live 走
   *  GET /api/projects/{id}/file,fixture 无 server 由本映射直出;缺席
   *  的键 = 该文件不可预览(fixture 不演 base64 态)。 */
  fileContents?: Record<string, string>;
}

/** Team-route agent card (r7 12): avatar + name + model line + role line. */
export interface TeamAgentCard {
  id: string;
  displayName: string;
  /** #387 avatarUrl 语义：null/缺省 = dicebear 按 displayName 种子生成；
   *  非 null = 显式覆盖。 */
  avatarUrl?: string | null;
  /** Model line lead (`claude-sonnet-5 · 默认`, r7 12). */
  model: string;
  /** Model line carries the `· 默认` suffix for the team's default agent. */
  isDefault: boolean;
  /** Role line text; null renders the `未设置职责` placeholder (r7 12). */
  role: string | null;
  /** 服务商标识（r3 §4 样本 `provider:"r3-gw"`；records/agent.ts 同名栏）。
   *  null/缺省 = 未配置 → chart 节点不渲染服务商徽标。 */
  provider?: string | null;
}

/** Team-route content (r7 12): stats-bar count + the agent card grid. */
export interface TeamContent {
  /** Stats bar `N 个成员` — the member count includes agents (r3 §4). */
  members: number;
  agents: TeamAgentCard[];
}

/** API-key row (02 §6.2 apiKey shape subset + r3 §6 display rules). */
export interface ApiKeyRecord {
  id: string;
  /** Optional key name (r3 §6 `密钥名称（可选）`); null shows the mask alone. */
  name: string | null;
  /** List-row mask `pacman_afe07565…` (r3 §6 display rule; prefix 随品牌槽). */
  masked: string;
  gitAccess: boolean;
  mcpAccess: boolean;
  /** One-time plaintext right after creation (02 §8): rendered once beside
   *  the `请立即复制密钥，它仅显示一次。` canon, absent on every later view. */
  plaintext?: string;
}

/** API-keys route content; absent = the empty state (r2 19). */
export interface ApiKeysContent {
  keys: ApiKeyRecord[];
}

/** One deterministic content set behind a scenario id. `now` is the frozen
 *  reference instant for relative labels (capture time of the r7 shot), so
 *  fixture output never drifts with wall-clock time. */
export interface FixtureSet {
  todos: TodoRecord[];
  now: number;
  /** Detail-route display content (issue #56): the transcript and plan
   *  document of the selected todo, verbatim from the r7 captures. Board
   *  scenarios leave it absent. */
  detail?: DetailContent;
  /** Modal overlay open over the route (issue #68): detail overlays ride
   *  the detail surface, `accept` the board surface. */
  overlay?: OverlayState;
  /** Unread chief messages — the blue count badge on the 总管 FAB
   *  (r8 78–81 dark captures; absent from the r7 light set). */
  chiefUnread?: number;
  /** Overlay open-states (issue #67); absent = all closed. */
  ui?: OverlayUi;
  /** Sidebar 用量 nav row present (issue #67): the live site grew it
   *  between the r7 captures (2026-09-21, absent) and the 05b results
   *  capture (2026-09-22, present) — nav set is per-capture content. */
  usageNav?: boolean;
  /** Schedule list of the /app/schedules route (issue #71); absent or
   *  empty = the `尚无定时。` empty state (r7 11). */
  schedules?: ScheduleRecord[];
  /** Open state of the 新建定时 dialog (r3 92/92b): the selected 频率 tab.
   *  Absent = dialog closed. */
  scheduleForm?: 'hourly' | 'daily' | 'weekly' | 'once';
  /** Project route content (issue #71); absent = the r3-lifecycle repo
   *  defaults so production builds still render the pages. */
  project?: ProjectContent;
  /** Capture-state flag for /app/project/:id (r2 24 vs 24b): which of the
   *  任务|文件 tabs the capture sits on. Absent = 文件, the route default
   *  (r2 §2 route table). */
  projectTab?: 'tasks' | 'files';
  /** Team-route content (issue #70, r7 12); absent = the r7 roster. */
  team?: TeamContent;
  /** API-keys route content (issue #70); absent = empty state (r2 19). */
  apiKeys?: ApiKeysContent;
  /** Resource-route display content (issue #69): the row sets of the six
   *  resource surfaces, verbatim from the r7 06–10 captures. Board and
   *  detail scenarios leave it absent. */
  resources?: ResourcesContent;
  /** projectId → 项目名（M5 live 面：卡面/搜索/新建 dialog 的项目 chip 走
   *  真项目名；absent = capture canon `r3-lifecycle`，fixture 面不携带）。 */
  projectNames?: Record<string, string>;
  /** Chief surface content (issue #72): the 总管 drawer overlay or the
   *  full-content 总管设置 view, verbatim from the r5 100–116 captures.
   *  Board scenarios without a chief surface leave it absent. */
  chief?: ChiefContent;
  /** 新建项目 GitHub 连接面（#361 G2-T4）：fixture 面的连接状态 + picker
   *  仓库行（live 面 = GET connection / GET /api/github/repos）。absent =
   *  未连接（认证钮面）。 */
  github?: GithubFixture;
  /** #403 看板标签筛选的 fixture 数据源：标签记录最小投影（id/name/color，
   *  TagChip 消费面同形）。absent = 筛选条不渲染（无标签数据的场景保持
   *  r7 基线零漂移）；live 面真值 = GET /api/projects/{id}/tags。 */
  tags?: Array<Pick<TagRecord, 'id' | 'name' | 'color'>>;
}

/** GitHub 连接 fixture（#361）：connected 驱动认证钮/picker 面切换；
 *  repos = picker 行（shared GithubRepoSummary 封套同形）。 */
export interface GithubFixture {
  connected: boolean;
  login?: string;
  scope?: string;
  repos?: GithubRepoSummary[];
}

/** Skill row (r7 08): name + one-line description. */
export interface SkillRow {
  name: string;
  description: string;
}

/** MCP server row (r7 09): name + type label + endpoint url + relative
 *  creation label, all verbatim from the capture. */
export interface McpRow {
  name: string;
  kind: string;
  url: string;
  ago: string;
}

/** Machine row (spec 11 A8): the local machine pinned first (kind='local',
 *  per-runtime 品牌 mark pair, undeletable) plus one row per attached LAN/VPS
 *  machine (name + online dot). */
export interface MachineRow {
  /** Machine record id — the `data-machine-id` contract handle. */
  id?: string;
  /** `local` = the server host (pinned first); absent/`remote` = attached. */
  kind?: 'local' | 'remote';
  name: string;
  online?: boolean;
  /** Right-side status pill; absent on online machines. */
  pill?: string;
  /** Per-runtime 启用态（MACHINE_RUNTIMES subset; [] = all off）——驱动 mark
   *  原色/35% 透明两态。 */
  enabledRuntimes?: string[];
}

/** The six resource surfaces' row sets (issue #69). */
export interface ResourcesContent {
  skills: SkillRow[];
  mcpServers: McpRow[];
  machines: MachineRow[];
  /** providers 页 runtime tabs 数据源（spec 11 §A1-A4，#356）：pi +
   *  claude-code 两段，形状 = shared ModelSource（数据契约单源）。 */
  providerSources: ModelSource[];
}

/** Inline text run inside a plan-document block; `code` renders the
 *  monospace chip (r7 17: `tail -n 3 README.md` style). */
/** Inline text run inside a plan-document block: plain text, the
 *  monospace chip (r7 17: `tail -n 3 README.md` style), the blue
 *  file/commit reference span (r8 56: `README.md`, `2f47b62`) or a
 *  mention chip carrying the entity kind (issue #311, spec 08 附录 A
 *  档 2: agent / todo / skill / project / machine — the picker emits
 *  `[name](<kind>:<id>)` and the renderer parses it back into a chip
 *  with the kind-driven accent color). */
export interface DocSegment {
  text: string;
  style?: 'code' | 'link' | 'mention';
  /** Mention chip kind — required when style is 'mention'. */
  mentionKind?: 'todo' | 'skill' | 'agent' | 'project' | 'machine';
}

/** One plan-document block: free paragraph, bullet (r7 17 doc pane) or
 *  markdown heading (r8 56: Context / 假设 / Changes / Verification). */
export interface DocBlock {
  kind: 'para' | 'bullet' | 'head';
  segments: DocSegment[];
}

/** Transcript row kinds observed in the r7 detail captures (16/17/26/27/
 *  28/36/38). CONTEXT.md canon: the message flow is `transcript`, not
 *  stream. */
export type TranscriptItem =
  /** Run stamp: time line + `运行在 <machine> 上` line, centered. The
   *  reused-plan build (r8 76) splits the two lines around the quoted
   *  plan card, so each half is optional. `cancelled` = 停止钮中断的运行行
   *  终态「已取消」（M7 #308，r9 §3.3；live 面 step.status 'stopped' 派生，
   *  fixture 捕获面无此态）。 */
  | { kind: 'run'; at?: string; machine?: string; cancelled?: boolean }
  /** User bubble (`开始执行任务` / `确认`); the taskline chip + title ride
   *  along only on the task-start bubble (r7 26: the 确认 bubble renders
   *  bubble + icon pair alone). */
  | { kind: 'user'; text: string; seq?: number; title?: string }
  /** Agent prose: one or more paragraphs of inline segments (r7 36 merge
   *  row, r7 38 legacy rows). `footer` renders the message action row
   *  (copy + optional restore + optional `| 完成 Ns` + optional `›`,
   *  r8 60/65); paragraph kinds carry the r8 quote/ordinal/bullet forms.
   *  #469: an agent reply may instead carry raw block markdown in
   *  `markdown` — headings / ordered+unordered lists (nested) / code
   *  fences — parsed to blocks at render time (chat-markdown.tsx). When
   *  `markdown` is present it takes precedence over `paragraphs`, so the
   *  frozen capture shapes (paragraph-only) render unchanged. */
  | {
      kind: 'robot';
      /** Object form carries the r8 quote/ordinal/bullet paragraph
       *  kinds; the plain segment-array form is the r7 prose shape.
       *  Optional — markdown replies (#469) carry `markdown` instead. */
      paragraphs?: (RobotPara | DocSegment[])[];
      /** Raw block markdown of the reply (#469). Parsed by the transcript
       *  renderer, not the mapper, so the fixture surface exercises the
       *  same parse+render path as live (spec-block.tsx precedent). */
      markdown?: string;
      footer?: RobotFooter;
    }
  /** Live planning/execution row: elapsed seconds + `›` + step label
   *  (r7 16 `准备工作区...`, r7 26 `处理中...`, r7 26d `调用工具：bash …`).
   *  #471 quiescent variant: `seconds` absent = the building gap's live
   *  cue (spinner reel + static 执行中... label, no counter — the gap has
   *  no stream events that would re-render a tick). */
  | { kind: 'streaming'; seconds?: number; label: string }
  /** Collapsed plan card: `方案 · v1` row, clamped preview, action row
   *  `完成 Ns` (r7 17). `seconds` absent renders the bare `完成`
   *  (reused-plan card, r8 76); `chevron` adds the trailing `›` of the
   *  r8 plan cards (63/68/73). */
  | { kind: 'plan'; title: string; preview: string; seconds?: number; chevron?: boolean }
  /** Tool-call group of a finished run: collapsed = `完成 Ns ▸` single row
   *  (r7 27/36); expanded = `完成 Ns ▾` + one pill per tool call + the
   *  `收起 ^` link (r7 28). #469: `outputs[i]` carries the stdout/stderr of
   *  `pills[i]` (index-aligned; null/absent = that call produced no output
   *  to show). Each non-empty output renders as its own left-aligned mono
   *  block under its pill — terminal content no longer flattens into the
   *  centered dim `.chat-note`. */
  | {
      kind: 'tools';
      seconds: number;
      expanded: boolean;
      pills: string[];
      outputs?: (string | null)[];
    }
  /** Bare elapsed row: `完成 Ns` action row (r7 36 merge round, r7 38
   *  legacy card). */
  | { kind: 'elapsed'; seconds: number }
  /** Centered dim line: a bare time stamp (`13:35`, r7 26), the merge
   *  announcement (`Xmon Dai 发起了合并`, r7 36) or the completion banner
   *  (`🎉 任务已完成`, r7 36). */
  | { kind: 'note'; text: string }
  /** Schedule-origin marker: clock glyph + `由定时发起`, left aligned
   *  (r7 38, 02 §9.2 闭环语义). */
  | { kind: 'scheduled' }
  /** Chief-origin marker: avatar + `由总管发起` (r8 54, chief-launched
   *  build; the schedule twin is `scheduled`). */
  | { kind: 'chief' }
  /** Failed-run message: orange title line + body line + link row
   *  (`查看原始错误` / `排查指南`, r8 54/73, r5 §7 canon). */
  | { kind: 'fail'; title: string; body: string; links: string[] }
  /** AI 审核消息（M7 #330，r8 §3.1 60）：结论段 + 编号 findings 列表
   * （每条 = 严重度标签 + 标题 + 描述 + 文件:行 + 可选建议）。服务侧 emit
   * 由 server applyBuildStepAction completeStep 落库（REVIEW_VERDICT_KIND
   * system message），web mapper 拆出 verdict 形状渲染。 */
  | { kind: 'review'; conclusion: string; findings: ReviewFinding[] };

/** AI 审核 finding 显示形态（M7 #330，r8 §3.1）：严重度 + 标题 + 描述 +
 * 引用位（文件:行）+ 可选建议。dataSource = server verdict message 解出
 * 的 reviewVerdictSchema.findings。 */
export interface ReviewFinding {
  id: string;
  severity: 'blocking' | 'suggestion' | 'info';
  summary: string;
  description?: string;
  file?: string;
  line?: number;
  suggestion?: string;
}

/** One paragraph of a robot message (r7 prose; r8 adds the AI-review
 *  quote block and numbered finding rows, r8 60/65). */
export interface RobotPara {
  segments: DocSegment[];
  /** Indented tinted block with a left border (r8 65 review quote). */
  quote?: boolean;
  /** Numbered-list ordinal rendered as a hanging `N.` (r8 65 findings). */
  ordinal?: number;
  /** `• ` bullet marker (r8 54 result message). */
  bullet?: boolean;
}

/** Message action row payload (r8 60/65): copy + optional restore +
 *  optional `| 完成 Ns` + optional trailing chevron. */
export interface RobotFooter {
  restore?: boolean;
  seconds?: number;
  chevron?: boolean;
}

/** One changed file in the diff pane (r7 27/27b): collapsed = file row
 *  only; expanded = unified-diff hunks below it. */
export interface DiffFile {
  path: string;
  /** Added-line count shown right-aligned on the file row (`+1`). */
  added: number;
  /** Removed-line count; absent = the row/stat shows `+N` alone (r7),
   *  present = `+A −B` pair (plan-version diffs, r8 69/71). */
  removed?: number;
  hunks: DiffHunk[];
  /** 全文槽（#225「显示完整文件」）：fixture 面数据源；live 面走
   *  GET /api/builds/{id}/changes/file 按需取（#224），不经本槽。 */
  fullContent?: string;
}

/** Unified-diff hunk: header row (`@@ -3,3 +3,4 @@` + trailing section
 *  text, r7 27b) plus numbered lines. */
export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface DiffLine {
  /** context/add = r7 27b; del = the `−` row of plan-version diffs
   *  (r8 72); marker = the gutter-less `\ No newline at end of file`. */
  kind: 'context' | 'add' | 'del' | 'marker';
  text: string;
  /** Line numbers per side; the add row leaves `oldNo` blank (r7 27b
   *  gutter). */
  oldNo?: number;
  newNo?: number;
}

/** The 变更 document set behind the diff pane (r7 27/27b/36): header
 *  `变更▾ v1▾ · N 个文件改动 +N` (counts derived from `files`), one row
 *  per file, hunks rendered when `expanded`. */
export interface ChangesContent {
  files: DiffFile[];
  /** Capture-state flag: 27/36 collapsed, 27b/28 expanded. */
  expanded: boolean;
}

/** Detail-route content of a scenario (issue #56, extended in #57). */
export interface DetailContent {
  /** Transcript rows, top to bottom. */
  transcript: TranscriptItem[];
  /** Plan document for the left pane; absent = `暂无方案` placeholder. */
  doc?: DocBlock[];
  /** 变更 pane data; absent = the centered `暂无可显示的变更` placeholder
   *  (r7 38 legacy card). Only consulted in changes mode. */
  changes?: ChangesContent;
  /** User-menu popover rendered over the sidebar (r7 17 / 16d / 26d /
   *  27d captures). */
  userMenuOpen?: boolean;
  /** Version dropdown rows under the doc-pane version chip, newest
   *  first (r8 63/70); absent = the chip renders the plain v1 select. */
  planVersions?: PlanVersion[];
  /** Capture-state open menu on the version chip (r8 63/64). */
  versionMenu?: 'versions' | 'compare';
  /** Plan-version diff surface replacing the plan markdown (r8 65–72). */
  planDiff?: PlanDiffContent;
  /** Diff the compare submenu's 上一版本 opens (r8 64 → 65, 70 → 71). */
  compareTarget?: PlanDiffContent;
  /** Agent row of the rerun dialog (r8 56/74): the previous run's agent. */
  rerunAgent?: { name: string; model: string };
  /** Interactive reject-loop script (issue #75 AC3). */
  revision?: RevisionStep;
}

/** One row of the version dropdown under the doc-pane version chip
 *  (r8 63/70): version word + relative age from the fixture instant. */
export interface PlanVersion {
  v: string;
  /** Version landing instant; the label is `relativeTime(at, now)`. */
  at: number;
}

/** The plan-version diff surface of the doc pane (r8 65–72): range chip
 *  `v1 → v2`, file-level unified diff of plan.md. */
export interface PlanDiffContent {
  from: string;
  to: string;
  files: DiffFile[];
  expanded: boolean;
}

/** Client-side reject-loop script (issue #75 AC3): what the composer send
 *  walks through on a confirm surface — revision streaming (r8 67), then
 *  the next plan version landing (r8 68 family). */
export interface RevisionStep {
  /** User bubble text the send produces. */
  feedback: string;
  /** Streaming row while the replan runs (r8 67). */
  streaming: { seconds: number; label: string };
  /** Doc-pane diff left open during the replan (r8 67 keeps v1→v2 up). */
  planDiff?: PlanDiffContent;
  /** State once the new version lands: chip back to 确认. */
  landed: {
    planVersions: PlanVersion[];
    doc: DocBlock[];
    transcriptTail: TranscriptItem[];
    /** Diff the 上一版本 submenu entry resolves to (r8 65). */
    planDiff: PlanDiffContent;
  };
}

// ── Chief surface (issue #72) ────────────────────────────────────────────
// r5 §2/§3.6 canon: the 总管 panel is a right-anchored drawer over the
// board; the 设置 gear swaps the whole content area to the 总管设置 view
// (4 tabs). Captures 100–104 (unbound) + 111/114/116 (bound) supply the
// static copy below.

/** Hero example card of a fresh thread (r5 100/111 2×2 grid). */
export interface ChiefExample {
  /** Traced glyph per card position (r5 100 crops). */
  icon: 'user-plus' | 'folder' | 'grid' | 'bars';
  text: string;
}

/** Inline run inside a chief stream paragraph; `todo`/`agent` render the
 *  entity chips (r5 114: `#11` indigo chip, `r5-scribe` gray chip). */
export interface ChiefSegment {
  text: string;
  code?: boolean;
  todo?: number;
  agent?: string;
  /** Bold lead-in of a bullet (r5 116 `README.md:` row heads). */
  strong?: boolean;
}

/** One row of the chief message flow (r5 114/116, r3 §3.6 roles). */
export type ChiefStreamItem =
  /** Centered dim stamp (`17:26`) or machine line (`运行在 … 上`, the
   *  machine name underlined per r5 114 — `machineName` carries it). */
  | { kind: 'note'; text: string; machineName?: string }
  /** User bubble with avatar + the copy/restore icon pair below it. */
  | { kind: 'user'; text: string }
  /** Chief prose paragraphs + optional bullets + the `完成 Ns ›` footer
   *  row (r5 116 verification report). */
  | { kind: 'robot'; paragraphs: ChiefSegment[][]; bullets?: ChiefSegment[][]; seconds: string };

/** Thread row of the header switcher popover (r5 116). */
export interface ChiefThreadRef {
  title: string;
  /** True on the row the drawer currently shows. */
  active?: boolean;
}

export type ChiefSettingsTab = 'agent' | 'charter' | 'memory' | 'watches';

/** 压缩模型选择器行最小投影（#358，spec 11 §A10；live = model-sources ∪
 *  custom providers 并集，api/mappers.ts `toChiefModelOptions` 单源；
 *  fixture = canon 单行）。`provider` 位 = PATCH 值槽的 provider 归属
 *  （custom providerId 或 runtime 词表值 `claude-code`）。 */
export interface ChiefModelOption {
  provider: string;
  /** 显示用来源名（r5 §2 捕获行 `r3-gw · 128k` 徽标位；runtime 段 =
   *  品牌名 `Claude Code`，不译）。 */
  providerLabel: string;
  modelId: string;
  modelName: string;
}

/** The chief surface a scenario renders. `view: 'drawer'` docks the panel
 *  as the right-hand column (#447 / ADR 0004); `view: 'settings'` replaces
 *  the content area (r5 101–104). */
export interface ChiefContent {
  view: 'drawer' | 'settings';
  /** Settings tab rendered when `view: 'settings'`. */
  tab?: ChiefSettingsTab;
  /** Agent bound to the chief: hides the gate bar, fills the model slot
   *  and swaps the header icon set (r5 100 vs 111/114). */
  bound: boolean;
  /** #204 压缩模型槽值(settings Agent tab 选择器回显位,wire 形随 server
   *  #203);缺省/null = 默认（与 Chief 相同）。 */
  compactionModel?: { provider: string; modelId: string } | null;
  /** Model slot line when bound (`claude-sonnet-5 · 默认`); `n/a` else. */
  modelSlot?: string;
  /** #444 绑定 Agent 的头像位（总管 FAB 图标源）：语义走 Avatar 原语
   *  （avatarUrl 非空覆盖优先，null = dicebear 按 displayName 种子生成）。
   *  absent = 未绑定（或数据未到位），FAB 保持静态字形。live 面由 mapChief
   *  从 GET chief 封套的 agentActor 投影，不新增请求。 */
  agent?: { id?: string; displayName: string; avatarUrl: string | null };
  /** Header thread-chip label (`新主题` on a fresh thread). */
  threadTitle: string;
  /** Switcher popover open over the drawer (r5 116). */
  threadsOpen?: boolean;
  threads?: ChiefThreadRef[];
  /** Hero grid of a fresh thread; absent on a thread view. */
  examples?: ChiefExample[];
  /** Composer draft text (r5 100/111 persisted draft). */
  draft?: string;
  /** Message flow of an existing thread (r5 114/116). */
  stream?: ChiefStreamItem[];
}
