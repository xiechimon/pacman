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
}

/** Inline text run inside a plan-document block; `code` renders the
 *  monospace chip (r7 17: `tail -n 3 README.md` style), `link` the
 *  indigo link-styled chip (r8 63/76 first `README.md` mention). */
export interface DocSegment {
  text: string;
  code?: boolean;
  link?: boolean;
}

/** One plan-document block: free paragraph, bullet (r7 17 doc pane) or
 *  bold section head (`Context` / `改动` / `验证`, r8 63/76 plan.md). */
export interface DocBlock {
  kind: 'para' | 'bullet' | 'head';
  segments: DocSegment[];
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

/** Transcript row kinds observed in the r7 detail captures (16/17/26/27/
 *  28/36/38). CONTEXT.md canon: the message flow is `transcript`, not
 *  stream. */
export type TranscriptItem =
  /** Run stamp: time line + `运行在 <machine> 上` line, centered. The
   *  reused-plan build (r8 76) splits the two lines around the quoted
   *  plan card, so each half is optional. */
  | { kind: 'run'; at?: string; machine?: string }
  /** User bubble (`开始执行任务` / `确认`); the taskline chip + title ride
   *  along only on the task-start bubble (r7 26: the 确认 bubble renders
   *  bubble + icon pair alone). */
  | { kind: 'user'; text: string; seq?: number; title?: string }
  /** Agent prose: one or more paragraphs of inline segments; `code`
   *  segments render the mono chip (r7 36 merge row, r7 38 legacy rows).
   *  `footer` renders the message action row (copy + optional restore +
   *  optional `| 完成 Ns` + optional `›`, r8 60/65). */
  | {
      kind: 'robot';
      paragraphs: RobotPara[];
      footer?: { restore?: boolean; seconds?: number; chevron?: boolean };
    }
  /** Chief-origin marker: avatar + `由总管发起` (r8 54, chief-launched
   *  build; the schedule twin is `scheduled`). */
  | { kind: 'chief' }
  /** Failed-run message: orange title line + body line + link row
   *  (`查看原始错误` / `排查指南`, r8 54/73, r5 §7 canon). */
  | { kind: 'fail'; title: string; body: string; links: string[] }
  /** Live planning/execution row: elapsed seconds + `›` + step label
   *  (r7 16 `准备工作区...`, r7 26 `处理中...`, r7 26d `调用工具：bash …`). */
  | { kind: 'streaming'; seconds: number; label: string }
  /** Collapsed plan card: `方案 · v1` row, clamped preview, action row
   *  `完成 Ns` (r7 17). `seconds` absent renders the bare `完成`
   *  (reused-plan card, r8 76); `chevron` adds the trailing `›` of the
   *  r8 plan cards (63/68/73). */
  | { kind: 'plan'; title: string; preview: string; seconds?: number; chevron?: boolean }
  /** Tool-call group of a finished run: collapsed = action row
   *  `完成 Ns ▸` (r7 27/36); expanded = `完成 Ns ▾` + one pill per tool
   *  call + the `收起 ^` link (r7 28). */
  | { kind: 'tools'; seconds: number; expanded: boolean; pills: string[] }
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
  /** Removed-line count; absent = the row/stat shows `+N` alone (r7),
   *  present = `+A −B` pair (plan-version diffs, r8 69/71). */
  removed?: number;
  hunks: DiffHunk[];
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

/** One row of the version dropdown under the doc-pane version chip
 *  (r8 63/70): version word + relative age, newest first. */
export interface PlanVersion {
  v: string;
  rel: string;
}

/** One row of the 运行历史 dialog (r8 57/77). */
export interface RunHistoryRow {
  n: number;
  current: boolean;
  /** Sub-row lead: `6 小时前` / `刚刚`; absent = sub-row starts at tokens. */
  rel?: string;
  tokens?: string;
  /** Trailing errorMessage of the sub-row (`Machine offline`). */
  error?: string;
  /** Row state glyph: hollow circle = running/current, red × = failed. */
  state: 'open' | 'failed';
  /** Row-level 重跑 button (failed todo's current row only, r8 §3.3). */
  rerun?: boolean;
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

/** The plan-version diff surface of the doc pane (r8 65–72): range chip
 *  `v1 → v2`, file-level unified diff of plan.md. */
export interface PlanDiffContent {
  from: string;
  to: string;
  files: DiffFile[];
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
  /** Version dropdown rows under the doc-pane version chip (r8 63/70);
   *  absent = the chip renders the plain `v1` select (r7). */
  planVersions?: PlanVersion[];
  /** Capture-state open menu on the version chip (r8 63/64). */
  versionMenu?: 'versions' | 'compare';
  /** Plan-version diff surface replacing the plan markdown (r8 65–72). */
  planDiff?: PlanDiffContent;
  /** Diff the compare submenu's 上一版本 opens (r8 64 → 65, 70 → 71). */
  compareTarget?: PlanDiffContent;
  /** Open overlay: rerun = 开始任务 dialog (r8 56/74), reuse = 复用方案
   *  sub-panel (r8 75), history = 运行历史 dialog (r8 57/77). */
  dialog?: 'rerun' | 'reuse' | 'history';
  /** Rows of the 运行历史 dialog; absent = single current row. */
  runHistory?: RunHistoryRow[];
  /** Interactive reject-loop script (issue #75 AC3). */
  revision?: RevisionStep;
}
