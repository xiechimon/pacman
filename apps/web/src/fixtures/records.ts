// Fixture record contract = 02-架构平价 §6.2 + §4.1 todo field table.
// Field set copied from the r3 §3.0 observed wire shape:
// phaseAt/seqNum/orderIndex/tagIds/spec/assignment/agent/latestBuildId/
// lastRunAt/hasChanges/hasPlan/buildHistory/sourceTodo/v — plus one [推断]
// display-only extension (awaitingReply, see the field) carried for the
// observed waiting-on-user board placement.
// Timestamps are epoch milliseconds (02 §6.2 schedule record precedent).

// phase 九值枚举单源 = @pacman/shared（02 §4.1；#65 M1 收口），本地不再定义。
import { PHASE_VALUES, type Phase } from '@pacman/shared';

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

/** Token 用量 overlay content (issue #68, r7 30): the cumulative-run
 *  figures of the dialog, verbatim strings from the capture. */
export interface TokenUsageContent {
  total: string;
  model: string;
  modelTotal: string;
  input: string;
  output: string;
  cacheRead: string;
  cacheWrite: string;
}

/** 分支与 PR overlay content (issue #68, r7 31): sync-tab fields. */
export interface BranchInfoContent {
  branch: string;
  commit: string;
  machine: string;
  directory: string;
}

/** One 运行历史 overlay row. r7 32 froze the single-row state (ring glyph);
 *  the r8 80 dark capture adds the multi-row forms: failed runs carry a
 *  stop-colored ×, succeeded ones a done-colored check (r8 80). */
export interface RunHistoryRow {
  label: string;
  meta: string;
  status: 'current' | 'failed' | 'done';
}

/** Modal surface rendered over a route (issue #68). The scenario fixture
 *  opens one for capture determinism; the header/card buttons open the same
 *  set interactively. Token/branch/history payloads are build-scoped
 *  display data — outside the 02 §6.2 record contract — resolved per todo
 *  from the fixture layer; the accept dialog carries no payload. */
export type OverlayKind = 'token' | 'branch' | 'history' | 'accept';

export interface OverlayState {
  kind: OverlayKind;
}

/** The three build-scoped overlay payloads travelling together (issue #68). */
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

/** Repo surface of a project route (r2 07e/24 file tree + 24c settings
 *  rows): branch chip, file rows and the settings card values. */
export interface ProjectContent {
  /** Display name (r2 24c 名称 row); the repo slug is a separate attribute
   *  (CONTEXT.md 租户层级: repo belongs to the project, not the reverse). */
  name: string;
  branch: string;
  files: string[];
  repoName: string;
  /** True = the `Todos 托管` chip rides beside the repo name (r2 24c). */
  hosted: boolean;
  defaultBranch: string;
  description: string | null;
}

/** Team-route agent card (r7 12): avatar + name + model line + role line. */
export interface TeamAgentCard {
  id: string;
  displayName: string;
  /** Model line lead (`claude-sonnet-5 · 默认`, r7 12). */
  model: string;
  /** Model line carries the `· 默认` suffix for the team's default agent. */
  isDefault: boolean;
  /** Role line text; null renders the `未设置职责` placeholder (r7 12). */
  role: string | null;
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
  /** List-row mask `tds_afe07565…` (r3 §6); the value is never readable again. */
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
 *  parity output never drifts with wall-clock time. */
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
  /** Chief surface content (issue #72): the 总管 drawer overlay or the
   *  full-content 总管设置 view, verbatim from the r5 100–116 captures.
   *  Board scenarios without a chief surface leave it absent. */
  chief?: ChiefContent;
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

/** Machine row (r7 06): the hosted-machine card row plus one row per
 *  claimed machine (name + online dot + id-tail subline). */
export interface MachineRow {
  /** The `Todos 托管机器` row (indigo tile); claimed machines omit it. */
  hosted?: boolean;
  name: string;
  /** Subline under the name (`…NJqVhdo_ · max 3`); absent on the hosted row. */
  sub?: string;
  online?: boolean;
  /** Right-side status pill (`未启用`); absent on online machines. */
  pill?: string;
  /** Row description line (hosted row only). */
  description?: string;
}

/** Model-provider row (r7 07): built-in card plus custom gateways. */
export interface ProviderRow {
  name: string;
  /** `N 模型` subline. */
  models: string;
  /** Orange `自定义` tag beside the name; absent on the built-in row. */
  custom?: boolean;
  /** Right-side status pill (`未启用`); absent on custom rows. */
  pill?: string;
}

/** The six resource surfaces' row sets (issue #69). */
export interface ResourcesContent {
  skills: SkillRow[];
  mcpServers: McpRow[];
  machines: MachineRow[];
  providers: ProviderRow[];
  /** 新建技能 tab selected on capture (r8 79/80); absent = 从文件夹. */
  importTab?: 'folder' | 'github';
}

/** Inline text run inside a plan-document block; `code` renders the
 *  monospace chip (r7 17: `tail -n 3 README.md` style). */
export interface DocSegment {
  text: string;
  code?: boolean;
}

/** One plan-document block: free paragraph or bullet (r7 17 doc pane). */
export interface DocBlock {
  kind: 'para' | 'bullet';
  segments: DocSegment[];
}

/** Transcript row kinds observed in the r7 detail captures (16/17/26/27/
 *  28/36/38). CONTEXT.md canon: the message flow is `transcript`, not
 *  stream. */
export type TranscriptItem =
  /** Run stamp: time line + `运行在 <machine> 上` line, centered. */
  | { kind: 'run'; at: string; machine: string }
  /** User bubble (`开始执行任务` / `确认`); the taskline chip + title ride
   *  along only on the task-start bubble (r7 26: the 确认 bubble renders
   *  bubble + icon pair alone). */
  | { kind: 'user'; text: string; seq?: number; title?: string }
  /** Agent prose: one or more paragraphs of inline segments; `code`
   *  segments render the mono chip (r7 36 merge row, r7 38 legacy rows). */
  | { kind: 'robot'; paragraphs: DocSegment[][] }
  /** Live planning/execution row: elapsed seconds + `›` + step label
   *  (r7 16 `准备工作区...`, r7 26 `处理中...`, r7 26d `调用工具：bash …`). */
  | { kind: 'streaming'; seconds: number; label: string }
  /** Collapsed plan card: `方案 · v1` row, clamped preview, `完成 Ns` row. */
  | { kind: 'plan'; title: string; preview: string; seconds: number }
  /** Tool-call group of a finished run: collapsed = `完成 Ns ▸` single row
   *  (r7 27/36); expanded = `完成 Ns ▾` + one pill per tool call + the
   *  `收起 ^` link (r7 28). */
  | { kind: 'tools'; seconds: number; expanded: boolean; pills: string[] }
  /** Bare elapsed row: `完成 Ns` with the history glyph (r7 36 merge
   *  round, r7 38 legacy card). */
  | { kind: 'elapsed'; seconds: number }
  /** Centered dim line: a bare time stamp (`13:35`, r7 26), the merge
   *  announcement (`Xmon Dai 发起了合并`, r7 36) or the completion banner
   *  (`🎉 任务已完成`, r7 36). */
  | { kind: 'note'; text: string }
  /** Schedule-origin marker: clock glyph + `由定时发起`, left aligned
   *  (r7 38, 02 §9.2 闭环语义). */
  | { kind: 'scheduled' };

/** One changed file in the diff pane (r7 27/27b): collapsed = file row
 *  only; expanded = unified-diff hunks below it. */
export interface DiffFile {
  path: string;
  /** Added-line count shown right-aligned on the file row (`+1`). */
  added: number;
  hunks: DiffHunk[];
}

/** Unified-diff hunk: header row (`@@ -3,3 +3,4 @@` + trailing section
 *  text, r7 27b) plus numbered lines. */
export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface DiffLine {
  kind: 'context' | 'add';
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

/** The chief surface a scenario renders. `view: 'drawer'` overlays the
 *  board; `view: 'settings'` replaces the content area (r5 101–104). */
export interface ChiefContent {
  view: 'drawer' | 'settings';
  /** Settings tab rendered when `view: 'settings'`. */
  tab?: ChiefSettingsTab;
  /** Agent bound to the chief: hides the gate bar, fills the model slot
   *  and swaps the header icon set (r5 100 vs 111/114). */
  bound: boolean;
  /** Model slot line when bound (`claude-sonnet-5 · 默认`); `n/a` else. */
  modelSlot?: string;
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
