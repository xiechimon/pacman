// Fixture record contract = 02-架构平价 §6.2 + §4.1 todo field table.
// Field set copied from the r3 §3.0 observed wire shape:
// phaseAt/seqNum/orderIndex/tagIds/spec/assignment/agent/latestBuildId/
// lastRunAt/hasChanges/hasPlan/buildHistory/sourceTodo/v — plus one [推断]
// display-only extension (awaitingReply, see the field) carried for the
// observed waiting-on-user board placement.
// Timestamps are epoch milliseconds (02 §6.2 schedule record precedent).

export const PHASE_VALUES = [
  'todo',
  'queued',
  'planning',
  'confirm',
  'building',
  'review',
  'done',
  'failed',
  'closed',
] as const;

export type Phase = (typeof PHASE_VALUES)[number];

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

/** One deterministic content set behind a scenario id. `now` inside each set
 *  is the frozen reference instant for relative labels (capture time of the
 *  r7 shot), so parity output never drifts with wall-clock time. */
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
