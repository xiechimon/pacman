// Fixture data — content copied verbatim from the r7 capture session
// (docs/research/r7-rebaseline.md §5): probe #9, r3 legacy #1/#2, project
// and team identifiers, branch strings, 13:21/13:35 timestamps. The #1/#2
// titles were extracted from captures 01/01b by glyph template matching
// (parity/match-text.mjs) in #54; all other strings come from the research
// records.

import { BRAND, conversationBranch, maskApiKey } from '@pacman/shared';
import { diffLines } from 'diff';
import type {
  ApiKeyRecord,
  BranchInfoContent,
  BuildOverlayContent,
  ChangesContent,
  ChiefContent,
  ChiefExample,
  ChiefSettingsTab,
  ChiefThreadRef,
  DiffHunk,
  DiffLine,
  DocBlock,
  FixtureSet,
  OverlayState,
  PlanDiffContent,
  ProjectContent,
  ResourcesContent,
  RunHistoryRow,
  ScheduleRecord,
  TeamContent,
  TodoRecord,
  TokenUsageContent,
  TranscriptItem,
} from './records.js';

export const TEAM_ID = 'BoZYfvqKSGanlxsXVbXSa';
export const TEAM_NAME = "Xmon Dai's team";
export const PROJECT_ID = 'ZAQczKCu0MOAzC1ZqcFlX';
export const PROJECT_NAME = 'r3-lifecycle';
/** Sidebar/card project avatar initial (r2 §1.1 首字母头像). */
export const PROJECT_INITIAL = 'r';
export const USER_NAME = 'Xmon Dai';
/** User-menu popover mail line (r7 17 head row). */
export const USER_MAIL = 'xiechimon@qq.com';
export const MACHINE_NAME = 'xmonsMac-3574.local';
export const MACHINE_ID = 'TlZ2sSD4EJCxjNJqVhdo_';
export const R7_BUILD_ID = '01a0c26e-23ea-734f-9847-cf9cdbce7802';
export const R7_BUILD_BRANCH = conversationBranch(R7_BUILD_ID);
/** Target commit of the probe's build branch (r7 31 分支与PR overlay). */
export const R7_TARGET_COMMIT = '2cceb9dbf7a8';

/** Token 用量 overlay of probe #9 (r7 30): cumulative-run calibre per r7
 *  §4.1.6 — the dialog totals the whole conversation, the 运行历史 row
 *  counts single runs (38.3k there vs 82.9k here). */
export const PROBE_TOKEN_USAGE: TokenUsageContent = {
  total: '82.9k',
  model: 'r3-gw/claude-sonnet-5',
  modelTotal: '82.9k',
  input: '12',
  output: '854',
  cacheRead: '54.2k',
  cacheWrite: '27.8k',
};

/** 分支与 PR overlay of probe #9 (r7 31), sync tab as captured. */
export const PROBE_BRANCH_INFO: BranchInfoContent = {
  branch: R7_BUILD_BRANCH,
  commit: R7_TARGET_COMMIT,
  machine: MACHINE_NAME,
  directory: '~/preview/project',
};

/** 运行历史 overlay of probe #9 (r7 32): single-row state, `重跑` is a
 *  hover-only control and absent from the capture (r7 §4.1.5). */
export const PROBE_RUN_HISTORY: RunHistoryRow[] = [
  { label: '第 1 次运行', meta: '12 分钟前 · 38.3k tokens', status: 'current' },
];

/** Timestamp helper: absolute date at +08:00, whole minutes. */
export const at = (date: string, h: number, m: number) =>
  Date.parse(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+08:00`);

/** r7 capture day. */
export const R7_DAY = '2026-09-21';
/** r3 session day (legacy #1/#2 live dates). */
export const R3_DAY = '2026-09-19';

/** r7 capture-day timestamp. */
export const r7 = (h: number, m: number) => at(R7_DAY, h, m);

const R3_BUILDER = { id: 'r3-builder', displayName: 'r3-builder' };

/** r3 legacy #1: review phase, waiting on the user's reply — card renders in
 *  执行中 with a transparent 回复 button (r5b §3.15, r7 01). */
const legacyReview: TodoRecord = {
  id: 'r3-legacy-1',
  teamId: TEAM_ID,
  projectId: PROJECT_ID,
  title: '在 README.md 末尾追加一行「r3 lifecycle probe」',
  spec: '在 README.md 末尾追加一行「r3 lifecycle probe」。',
  phase: 'review',
  phaseAt: at(R3_DAY, 14, 31),
  seqNum: 1,
  orderIndex: 0,
  tagIds: [],
  assignment: { agentId: R3_BUILDER.id },
  agent: R3_BUILDER,
  latestBuildId: 'r3-conv-legacy-1',
  lastRunAt: at(R3_DAY, 14, 30),
  // capture 01 shows no 方案/变更 metric icons on this card
  hasChanges: false,
  hasPlan: false,
  buildHistory: [{ buildId: 'r3-conv-legacy-1', createdAt: at(R3_DAY, 13, 5) }],
  sourceTodo: null,
  v: 3,
  awaitingReply: true,
};

/** r3 legacy #2: done (r7 01b last column, `2 天前`). */
const legacyDone: TodoRecord = {
  id: 'r3-legacy-2',
  teamId: TEAM_ID,
  projectId: PROJECT_ID,
  title: '在 README.md 末尾追加一行「r3 lifecycle probe2」',
  spec: '在 README.md 末尾追加一行「r3 lifecycle probe2」。',
  phase: 'done',
  phaseAt: at(R3_DAY, 15, 5),
  seqNum: 2,
  orderIndex: 0,
  tagIds: [],
  assignment: { agentId: R3_BUILDER.id },
  agent: R3_BUILDER,
  latestBuildId: 'r3-conv-legacy-2',
  lastRunAt: at(R3_DAY, 14, 50),
  hasChanges: true,
  hasPlan: true,
  buildHistory: [{ buildId: 'r3-conv-legacy-2', createdAt: at(R3_DAY, 14, 43) }],
  sourceTodo: null,
  v: 4,
};

/** r7 probe #9 (id 7ve0iOkQ-JBpSL98zSiGc) — phase varies per scenario. */
export const PROBE_ID = '7ve0iOkQ-JBpSL98zSiGc';

function probeTodo(phase: TodoRecord['phase'], phaseAt: number): TodoRecord {
  return {
    id: PROBE_ID,
    teamId: TEAM_ID,
    projectId: PROJECT_ID,
    title: '在 README.md 末尾追加一行「r7 rebaseline probe」',
    spec: '在 README.md 末尾追加一行「r7 rebaseline probe」',
    phase,
    phaseAt,
    seqNum: 9,
    orderIndex: 0,
    tagIds: [],
    assignment: { agentId: R3_BUILDER.id },
    agent: R3_BUILDER,
    latestBuildId: phase === 'todo' ? null : R7_BUILD_ID,
    lastRunAt: phase === 'todo' ? null : r7(13, 21),
    hasChanges: phase === 'review' || phase === 'done',
    // r7 02/21 (confirm) and 33 (review) show the 方案 icon; 35 (done) shows
    // the 变更 icon alone on #9's card — plan-icon presence is modelled per
    // phase, dropping at done. r3 #2 (01b, done) keeps both icons, so the
    // flag stays per-todo data, not a phase rule.
    hasPlan: phase === 'confirm' || phase === 'review',
    buildHistory: phase === 'todo' ? [] : [{ buildId: R7_BUILD_ID, createdAt: r7(13, 21) }],
    sourceTodo: null,
    v: 2,
  };
}

/** r7 dark fresh probe #10 — created 13:55, captured immediately, deleted
 *  right after (r7 §5). id is synthetic: the record never survived the
 *  session ([推断] identifier, content verbatim from the 22d capture). */
const darkFreshProbe: TodoRecord = {
  id: 'r7-dark-fresh-probe-10',
  teamId: TEAM_ID,
  projectId: PROJECT_ID,
  title: 'r7-dark-fresh 探针（拍完即删）',
  spec: 'r7-dark-fresh 探针（拍完即删）',
  phase: 'todo',
  phaseAt: r7(13, 55),
  seqNum: 10,
  orderIndex: 0,
  tagIds: [],
  assignment: null,
  agent: null,
  latestBuildId: null,
  lastRunAt: null,
  hasChanges: false,
  hasPlan: false,
  buildHistory: [],
  sourceTodo: null,
  v: 2,
};

/** Repo surface of the fixture project (r2 07e/24/24c read off the
 *  r3-lifecycle hosted repo): main branch, single README.md row. The
 *  历史 rows (#149, [设计] content — no capture) mirror the hosted repo
 *  lifecycle: the server seed commit (`init <repoName>`, services/git.ts)
 *  plus one merged work commit, newest first against the r7 clock. */
export const projectContent: ProjectContent = {
  name: PROJECT_NAME,
  branch: 'main',
  files: ['README.md'],
  repoName: PROJECT_NAME,
  hosted: true,
  defaultBranch: 'main',
  description: null,
  // #202 文件查看器 fixture 供肉:e2e 断言锚 = 「托管演示仓」行。
  fileContents: {
    'README.md': [
      `# ${PROJECT_NAME}`,
      '',
      '托管演示仓:任务全生命周期走查(待开始 → 规划中 → 待确认 → 执行中 → 待验收 → 已完成)。',
      '',
    ].join('\n'),
  },
  commits: [
    {
      id: 'f3d9c1b7a2e5480db6c1a9f0e2d7b4c8a1e5f903',
      shortSha: 'f3d9c1b',
      message: 'docs: README',
      authorName: 'r3-builder',
      at: r7(11, 2),
    },
    {
      id: '0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d',
      shortSha: '0a1b2c3',
      message: `init ${PROJECT_NAME}`,
      authorName: 'Pacman',
      at: r7(9, 41),
    },
  ],
}; /** Client-created todo of the fixture phase (#66 new-task dialog): lands
 *  in 待开始 with the 刚刚 label against the fixture clock (r2 §4.2/§5.2).
 *  Record shape lives here with every other TodoRecord factory. */
export function localTodo(seqNum: number, title: string, now: number): TodoRecord {
  return {
    id: `local-${seqNum}`,
    teamId: TEAM_ID,
    projectId: PROJECT_ID,
    title,
    spec: title,
    phase: 'todo',
    phaseAt: now,
    seqNum,
    orderIndex: 0,
    tagIds: [],
    assignment: null,
    agent: null,
    latestBuildId: null,
    lastRunAt: null,
    hasChanges: false,
    hasPlan: false,
    buildHistory: [],
    sourceTodo: null,
    v: 2,
  };
}
/** Board default: only the r3 legacy pair (r7 01/35). Captured before the
 *  probe existed, ~13:10–13:21. Carries the project repo surface and an
 *  empty schedule list so the #71 routes also render in scenario-blind
 *  production builds (resolveScenario falls back here). */
export const boardDefault: FixtureSet = {
  todos: [legacyReview, legacyDone],
  now: r7(13, 14),
  schedules: [],
  project: projectContent,
};

/** #176 项目选择器面(new-task dialog 项目 chip 下拉):boardDefault 面加
 *  projectNames 双项目——r3-lifecycle + r2-inventory(24b 注记的 r2 会话第
 *  二项目),给选择器多行数据位(records.ts projectNames = 卡面/搜索/新建
 *  dialog 的项目名位)。命名场景无 capture,e2e 专用,不进 parity 矩阵。 */
export const boardProjectPicker: FixtureSet = {
  ...boardDefault,
  projectNames: {
    [PROJECT_ID]: PROJECT_NAME,
    'r2-inventory': 'r2-inventory',
  },
};

/** Board with the probe in the given phase (r7 02/22/21/33 …). The dark
 *  board pair (02/02b) shows `9 分钟前` on the confirm card → captured
 *  ~13:35 with phaseAt 13:26. Done-phase boards (35/35d) list #9 ahead of
 *  #2 in the 已完成 column (r7 35, #9 card first at y94). */
export function boardWithProbe(
  phase: TodoRecord['phase'],
  phaseAt: number,
  now: number,
): FixtureSet {
  const probe = probeTodo(phase, phaseAt);
  const todos =
    phase === 'done' ? [legacyReview, probe, legacyDone] : [legacyReview, legacyDone, probe];
  return { todos, now };
}

/** #67 results-state capture day (05b supplementary shot, 2026-09-22
 *  23:21 +08:00) — the r5 Chief observation session (#46) left probes
 *  #11–#14 on the board and the r3 legacy pair aged to `5 小时前` /
 *  `3 天前`. Titles/seqs/phases verbatim from the 05b capture. */
/** Agent model suffix on the chip popover's 执行对话 row (r7 19 verbatim:
 *  `r3-builder · claude-sonnet-5 · 默认`). */
export const AGENT_MODEL_LINE = 'claude-sonnet-5 · 默认';

const CHIEF_DAY = '2026-09-22';
const chief = (h: number, m: number) => at(CHIEF_DAY, h, m);
const CHIEF_NOW = chief(23, 21);
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function chiefProbe(
  seqNum: number,
  title: string,
  phase: TodoRecord['phase'],
  phaseAt: number,
): TodoRecord {
  return {
    id: `chief-${seqNum}`,
    teamId: TEAM_ID,
    projectId: PROJECT_ID,
    title,
    spec: title,
    phase,
    phaseAt,
    seqNum,
    orderIndex: 0,
    tagIds: [],
    assignment: { agentId: R3_BUILDER.id },
    agent: R3_BUILDER,
    latestBuildId: `chief-conv-${seqNum}`,
    lastRunAt: phaseAt,
    hasChanges: phase === 'review' || phase === 'done',
    hasPlan: phase !== 'done',
    buildHistory: [{ buildId: `chief-conv-${seqNum}`, createdAt: phaseAt }],
    sourceTodo: null,
    v: 2,
  };
}

/** Board behind the 05b search-results capture: 执行中 #12 (failed),
 *  待验收 #1 + #13, 已完成 #14/#11/#2 — column order as captured (#1
 *  above #13 despite the lower seq: card order is fixture order). */
export const boardChiefProbes: FixtureSet = {
  todos: [
    chiefProbe(
      12,
      'README 文档目录 + 新建 CHANGELOG.md + scripts/hello.js',
      'failed',
      CHIEF_NOW - 5 * HOUR_MS - 2 * 60_000,
    ),
    // #1 sits in 待验收 with a 完成 button in the 05b capture — the chief
    // session answered it, so the waiting-on-user flag is gone by then
    { ...legacyReview, phaseAt: CHIEF_NOW - 5 * HOUR_MS - 2 * 60_000, awaitingReply: false },
    chiefProbe(
      13,
      '给 README.md 增加「项目结构」一节并链接贡献指南',
      'review',
      CHIEF_NOW - 5 * HOUR_MS - 2 * 60_000,
    ),
    chiefProbe(14, '给 index.html 的页面标题加上项目名后缀', 'done', CHIEF_NOW - 5 * HOUR_MS),
    chiefProbe(11, '编写 CONTRIBUTING.md 贡献指南', 'done', CHIEF_NOW - 5 * HOUR_MS),
    { ...legacyDone, phaseAt: CHIEF_NOW - 3 * DAY_MS - 2 * 60_000 },
  ],
  now: CHIEF_NOW,
  usageNav: true,
};

/** r7 22d: board at ~13:55 — #10 fresh (刚刚), #9 already done (13:52),
 *  r3 legacy pair untouched. */
export const boardDarkFresh: FixtureSet = {
  todos: [legacyReview, legacyDone, probeTodo('done', r7(13, 52)), darkFreshProbe],
  now: r7(13, 55),
};

/** r7 probe #10 — the dark fresh capture (23d) is a separate throwaway
 *  todo: title/seq/creation time all read off that bitmap. */
const probe10: TodoRecord = {
  ...probeTodo('todo', r7(13, 40)),
  id: 'r7-probe-10',
  title: 'r7-dark-fresh 探针（拍完即删）',
  spec: 'r7-dark-fresh 探针（拍完即删）',
  seqNum: 10,
};

/** Plan document of probe #9, verbatim from the r7 17 doc pane. */
const PROBE_PLAN_DOC: DocBlock[] = [
  {
    kind: 'para',
    segments: [
      {
        text: 'Context: 仓库根目录的 README.md 当前末尾一行为 "r6 rebaseline probe"(文件以换行符结尾)。需求是在文件末尾追加新的一行 "r7 rebaseline probe"。',
      },
    ],
  },
  { kind: 'para', segments: [{ text: 'Changes:' }] },
  {
    kind: 'bullet',
    segments: [
      {
        text: 'README.md:在文件末尾追加一行新内容 "r7 rebaseline probe",保持与现有行一致的格式(纯文本行,行尾换行符),不改动文件中已有的其他内容。',
      },
    ],
  },
  { kind: 'para', segments: [{ text: 'Edge cases: 无。' }] },
  { kind: 'para', segments: [{ text: 'Verification:' }] },
  {
    kind: 'bullet',
    segments: [
      { text: '执行 ' },
      { text: 'tail -n 3 README.md', style: 'code' },
      {
        text: ' 确认最后一行为 "r7 rebaseline probe",且原有的 "r6 rebaseline probe" 一行保留在其上一行。',
      },
    ],
  },
  {
    kind: 'bullet',
    segments: [
      { text: '执行 ' },
      { text: 'git diff README.md', style: 'code' },
      { text: ' 确认改动仅为新增一行,未影响其他行。' },
    ],
  },
];

/** Probe #9 transcript while planning (r7 16): stamp, start bubble, live
 *  step row. */
const PROBE_RUN_OPEN: TranscriptItem[] = [
  { kind: 'run', at: '13:26', machine: MACHINE_NAME },
  {
    kind: 'user',
    text: '开始执行任务',
    seq: 9,
    title: '在 README.md 末尾追加一行「r7 rebaseline probe」',
  },
];

/** Probe #9 transcript while planning (r7 16): run open + live step row. */
const PROBE_PLANNING_TRANSCRIPT: TranscriptItem[] = [
  ...PROBE_RUN_OPEN,
  { kind: 'streaming', seconds: 3, label: '准备工作区...' },
];

/** Probe #9 transcript once the plan landed (r7 17/17b/17d, and 16d which
 *  the r7 manifest filed under the streaming name). */
const PROBE_CONFIRM_TRANSCRIPT: TranscriptItem[] = [
  ...PROBE_RUN_OPEN,
  {
    kind: 'robot',
    paragraphs: [
      [{ text: '任务简单明确:在 README.md 末尾追加一行新文本,文件已有末尾换行行,直接追加即可。' }],
    ],
  },
  {
    kind: 'plan',
    title: '方案 · v1',
    preview:
      'Context: 仓库根目录的 README.md 当前末尾一行为 "r6 rebaseline probe"(文件以换行符结尾)。需求是在文件末尾追加新的一行 "r7 rebaseline probe"。  Changes: README.md:在文件末尾追加一行新内容 "r7 rebaseline probe",保持与现有行一致的格式(纯文本行,行尾换行符),不改动文件中已有的其他内容。',
    seconds: 21,
  },
];

/** Execution round open, shared by the 26/26d/27/27b/28/36 surfaces: plan
 *  round + 13:35 stamp + the user's 确认 bubble (r7 §5 时序). */
const PROBE_BUILD_OPEN: TranscriptItem[] = [
  ...PROBE_CONFIRM_TRANSCRIPT,
  { kind: 'note', text: '13:35' },
  { kind: 'user', text: '确认' },
];

/** Agent result message closing the execution round (r7 26d/27/36;
 *  straight quotes + fullwidth commas per the captures). */
const PROBE_BUILD_RESULT: TranscriptItem = {
  kind: 'robot',
  paragraphs: [
    [
      {
        text: '已在 README.md 末尾追加一行"r7 rebaseline probe"，验证通过，未影响其他内容。',
      },
    ],
  ],
  footer: { restore: true },
};

/** The two tool calls of the execution round (r7 28 expanded form:
 *  `edit README.md` + the verification `bash …` pill). The bash label is
 *  also the 26d streaming row's 调用工具 text — the capture runs it to
 *  the chat edge with an ellipsis. */
export const PROBE_TOOL_PILLS = [
  'edit README.md',
  'bash cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" && tail -n 3 README.md && echo …',
];

/** Streaming-row tool label of the 26d capture — chrome carried inside the
 *  fixture (frozen capture text); the en dict keys on this exact value. */
export const PROBE_TOOL_CALL_LABEL = `调用工具：${PROBE_TOOL_PILLS[1]}`;

/** Tool-call group row of the execution round (r7 27 collapsed `完成
 *  19s ▸`; r7 28 expanded with pills + 收起). */
function probeTools(expanded: boolean): TranscriptItem {
  return { kind: 'tools', seconds: 19, expanded, pills: PROBE_TOOL_PILLS };
}

/** Merge round appended on completion (r7 36/36d): announcement stamp,
 *  merge-result message with the mono command chip, elapsed row, 🎉
 *  banner. */
const PROBE_MERGE_ROUND: TranscriptItem[] = [
  { kind: 'note', text: 'Xmon Dai 发起了合并' },
  {
    kind: 'robot',
    paragraphs: [
      [
        { text: 'git merge origin/main', style: 'code' },
        { text: ' 结果为 "Already up to date"，无需处理冲突。' },
      ],
    ],
    footer: { seconds: 17 },
  },
  { kind: 'note', text: '🎉 任务已完成' },
];

/** r3 legacy #1 transcript (r7 38): schedule-triggered run waiting on the
 *  user's reply — stamp + 由定时发起 + start bubble + the agent's
 *  no-op analysis (code chips around the probe line and the commit
 *  subject) + 完成 32s. */
const LEGACY_REVIEW_TRANSCRIPT: TranscriptItem[] = [
  { kind: 'run', at: '星期六 14:30', machine: 'r3-mbp' },
  { kind: 'scheduled' },
  {
    kind: 'user',
    text: '开始执行任务',
    seq: 1,
    title: '在 README.md 末尾追加一行「r3 lifecycle probe」',
  },
  {
    kind: 'robot',
    paragraphs: [
      [
        { text: 'README.md 中已存在这行内容（' },
        { text: 'r3 lifecycle probe', style: 'code' },
        { text: '），且历史提交记录显示已有一次' },
      ],
      [
        { text: 'docs（readme）：append lifecycle probe line', style: 'code' },
        { text: ' 的提交完成了这项任务。当前工作区无待提交更改，' },
      ],
      [{ text: '任务已满足，无需重复修改。' }],
    ],
    footer: { seconds: 32 },
  },
];

/** The probe's one-file changeset (r7 27/27b/36): README.md +1 line. */
function probeChanges(expanded: boolean): ChangesContent {
  return {
    expanded,
    files: [
      {
        path: 'README.md',
        added: 1,
        hunks: [
          {
            header: '@@ -3,3 +3,4 @@ r3 lifecycle probe',
            lines: [
              { kind: 'context', text: 'r3 lifecycle probe2', oldNo: 3, newNo: 3 },
              { kind: 'context', text: 'r5b lifecycle probe', oldNo: 4, newNo: 4 },
              { kind: 'context', text: 'r6 rebaseline probe', oldNo: 5, newNo: 5 },
              { kind: 'add', text: 'r7 rebaseline probe', newNo: 6 },
            ],
          },
        ],
        // #225 全文槽:与 hunk 窗(@@ -3,3 +3,4 @@)自洽的六行——3–5 行 =
        // 窗内 context 原文,第 6 行 = +行;初渲不展示,parity 零影响。
        fullContent:
          '# r3 probe\nprobe readme\nr3 lifecycle probe2\nr5b lifecycle probe\nr6 rebaseline probe\nr7 rebaseline probe\n',
      },
    ],
  };
}

/** Detail fresh state (r7 23): no transcript, no doc pane. */
export const detailFresh: FixtureSet = {
  todos: [probeTodo('todo', r7(13, 21))],
  now: r7(13, 22),
};

/** Detail fresh state, dark capture (r7 23d = probe #10). */
export const detailFreshDark: FixtureSet = { todos: [probe10], now: r7(13, 41) };

/** Detail planning state (r7 16): live transcript, empty doc pane. */
export const detailPlanning: FixtureSet = {
  todos: [probeTodo('planning', r7(13, 26))],
  now: r7(13, 26),
  detail: { transcript: PROBE_PLANNING_TRANSCRIPT },
};

/** Detail confirm state (r7 17/17b/17d, plus 16d = same surface dark with
 *  the popover). `userMenuOpen` reproduces the popover the 17 and 16d
 *  captures include. */
export function detailConfirm(userMenuOpen: boolean): FixtureSet {
  return {
    todos: [probeTodo('confirm', r7(13, 26))],
    now: r7(13, 28),
    detail: { transcript: PROBE_CONFIRM_TRANSCRIPT, doc: PROBE_PLAN_DOC, userMenuOpen },
  };
}

/** Detail building state (r7 26/26d): execution streaming. The light
 *  capture froze at `3s › 处理中...`; the dark one (with the user menu
 *  open) caught the later `19s › 调用工具：bash …` after the result
 *  message landed. `lateCapture` selects the dark capture's later
 *  moment — the theme itself comes from the matrix row. */
export function detailBuilding(lateCapture: boolean): FixtureSet {
  const tail: TranscriptItem[] = lateCapture
    ? [
        PROBE_BUILD_RESULT,
        {
          kind: 'streaming',
          seconds: 19,
          // full command rides the label; CSS ellipsis cuts it at the
          // chat edge exactly like the capture
          label: PROBE_TOOL_CALL_LABEL,
        },
      ]
    : [{ kind: 'streaming', seconds: 3, label: '处理中...' }];
  return {
    todos: [probeTodo('building', r7(13, 35))],
    now: r7(13, 36),
    detail: {
      transcript: [...PROBE_BUILD_OPEN, ...tail],
      doc: PROBE_PLAN_DOC,
      userMenuOpen: lateCapture,
    },
  };
}

/** Detail review state (r7 27/27d collapsed, 27b diff-expanded, 28 diff +
 *  tools expanded). The dark capture carries the user-menu popover. */
export function detailReview(opts: {
  userMenuOpen: boolean;
  changesExpanded?: boolean;
  toolsExpanded?: boolean;
}): FixtureSet {
  return {
    todos: [probeTodo('review', r7(13, 37))],
    now: r7(13, 40),
    detail: {
      transcript: [
        ...PROBE_BUILD_OPEN,
        PROBE_BUILD_RESULT,
        probeTools(opts.toolsExpanded ?? false),
      ],
      changes: probeChanges(opts.changesExpanded ?? false),
      userMenuOpen: opts.userMenuOpen,
    },
  };
}

/** Detail done state (r7 36/36d): review surface + merge round. */
export function detailDone(): FixtureSet {
  return {
    todos: [probeTodo('done', r7(13, 52))],
    now: r7(13, 55),
    detail: {
      transcript: [
        ...PROBE_BUILD_OPEN,
        PROBE_BUILD_RESULT,
        probeTools(false),
        ...PROBE_MERGE_ROUND,
      ],
      changes: probeChanges(false),
    },
  };
}

/** r3 legacy #1 detail (r7 38): read-only review surface, schedule
 *  marker, no changes to show (`暂无可显示的变更`). */
export const detailLegacy: FixtureSet = {
  todos: [legacyReview, legacyDone],
  now: r7(13, 58),
  detail: { transcript: LEGACY_REVIEW_TRANSCRIPT },
};

/** Overlay payloads of the r3 legacy #1 build as the r8 78–80 dark captures
 *  froze them (issue #68): probe #9 no longer exists on the live account, so
 *  the dark overlay pairs bind to this todo's own build data. #1 re-ran on
 *  2026-09-22 18:30 (schedule trigger), which replaced the r7 38 surface:
 *  new run stamp, four-run history, a real changeset, no awaiting-reply. */
const LEGACY_TOKEN_USAGE: TokenUsageContent = {
  total: '66.1k',
  model: 'r3-gw/claude-sonnet-5',
  modelTotal: '66.1k',
  input: '10',
  output: '424',
  cacheRead: '52.3k',
  cacheWrite: '13.4k',
};

const LEGACY_BRANCH_INFO: BranchInfoContent = {
  // capture 79 truncates the branch after `2488`; the tail is unobservable
  // and only needs to keep the mono row overflowing at the same glyph
  branch: conversationBranch('01a0c8aa-9e64-742b-acbd-2488a1b2c3d4'),
  commit: 'f3ce121ba492',
  machine: MACHINE_NAME,
  directory: '~/preview/project',
};

/** r8 57 surface: #12's failed build whose single history row IS the
 *  failed current run — 当前 chip + footer 重跑 (r8 57); title/seq verbatim
 *  from the r8 54/57 captures. The failed-detail background behind the
 *  dialog is a later ticket, so the parity pair rides smoke for now. */
const FAILED_CURRENT_ID = 'r8-failed-12';
const failedCurrentTodo: TodoRecord = {
  ...probeTodo('failed', at('2026-09-22', 12, 30)),
  id: FAILED_CURRENT_ID,
  seqNum: 12,
  title: 'README 文档目录 + 新建 CHANGELOG.md + scripts/hello.js',
  spec: 'README 文档目录 + 新建 CHANGELOG.md + scripts/hello.js',
};

const FAILED_CURRENT_RUNS: RunHistoryRow[] = [
  {
    label: '第 1 次运行',
    meta: '6 小时前 · 72.1k tokens · Machine offline',
    status: 'failed-current',
  },
];

export function detailFailedCurrent(): FixtureSet {
  return {
    todos: [failedCurrentTodo],
    now: at('2026-09-22', 18, 30),
    // the failed-state transcript surface is a later ticket; the smoke
    // pair only gates the dialog over whatever the detail route renders
    detail: { transcript: [] },
  };
}

const LEGACY_RUN_HISTORY: RunHistoryRow[] = [
  { label: '第 4 次运行', meta: '6 小时前 · 66.1k tokens', status: 'current' },
  { label: '第 3 次运行', meta: '3 天前 · Cancelled', status: 'failed' },
  { label: '第 2 次运行', meta: '3 天前', status: 'done' },
  { label: '第 1 次运行', meta: '4 天前 · Machine offline', status: 'failed' },
];

/** r3 legacy #2 overlay payload — [推断]: no capture ever opened an overlay
 *  on this build; the values exist so the done card's branch icon opens a
 *  dialog instead of dead-clicking. No parity row rides them. */
const LEGACY2_OVERLAY: BuildOverlayContent = {
  token: {
    total: '41.7k',
    model: 'r3-gw/claude-sonnet-5',
    modelTotal: '41.7k',
    input: '9',
    output: '388',
    cacheRead: '31.6k',
    cacheWrite: '9.4k',
  },
  branch: {
    branch: conversationBranch('r3-legacy-2'),
    commit: 'b7e1f0a9c4d2',
    machine: MACHINE_NAME,
    directory: '~/preview/project',
  },
  runs: [{ label: '第 1 次运行', meta: '2 天前 · 41.7k tokens', status: 'done' }],
};

/** r3 legacy #1 as of the r8 dark captures (2026-09-23): review phase,
 *  schedule-triggered run of 2026-09-22 18:30, single-paragraph result. */
const legacyNow: TodoRecord = {
  ...legacyReview,
  phaseAt: at('2026-09-22', 18, 30),
  lastRunAt: at('2026-09-22', 18, 30),
  hasChanges: true,
  hasPlan: true,
  awaitingReply: false,
  buildHistory: [
    { buildId: 'r3-conv-legacy-1', createdAt: at(R3_DAY, 13, 5) },
    { buildId: 'r3-conv-legacy-1b', createdAt: at('2026-09-22', 18, 30) },
  ],
};

/** Two synthetic confirm-phase todos: the dark captures show the sidebar
 *  看板 badge at 2 (live board had two confirm cards); the detail route
 *  renders nothing of them but the badge. */
const darkBadgeFillers: TodoRecord[] = [1, 2].map((n) => ({
  ...legacyNow,
  id: `dark-badge-filler-${n}`,
  phase: 'confirm',
}));

const LEGACY_NOW_TRANSCRIPT: TranscriptItem[] = [
  { kind: 'run', at: '昨天 18:30', machine: MACHINE_NAME },
  { kind: 'scheduled' },
  {
    kind: 'user',
    text: '开始执行任务',
    seq: 1,
    title: '在 README.md 末尾追加一行「r3 lifecycle probe」',
  },
  {
    kind: 'robot',
    paragraphs: [[{ text: '已在 README.md 末尾追加了一行「r3 lifecycle probe」。' }]],
  },
  { kind: 'elapsed', seconds: 25 },
];

/** Dark capture set (r8 78–81): legacy #1's current surface with an overlay
 *  open; `chiefUnread` reproduces the FAB badge the captures carry. */
export function detailLegacyNow(overlay: OverlayState['kind']): FixtureSet {
  return {
    todos: [legacyNow, ...darkBadgeFillers],
    now: at('2026-09-23', 0, 13),
    chiefUnread: 1,
    detail: { transcript: LEGACY_NOW_TRANSCRIPT, changes: probeChanges(false) },
    overlay: { kind: overlay },
  };
}

/** Build-scoped overlay display data per todo (issue #68): the dialog
 *  payloads are not record fields (02 §6.2), so the fixture layer maps the
 *  captured builds — probe #9 (r7 30/31/32) and r3 legacy #1 (r8 78–80) —
 *  plus one [推断] set for legacy #2 so its card's branch icon is not a
 *  dead control; no parity row rides the [推断] values. */
export function overlayContent(todoId: string): BuildOverlayContent | null {
  if (todoId === PROBE_ID) {
    return { token: PROBE_TOKEN_USAGE, branch: PROBE_BRANCH_INFO, runs: PROBE_RUN_HISTORY };
  }
  if (todoId === FAILED_CURRENT_ID) {
    return { token: PROBE_TOKEN_USAGE, branch: PROBE_BRANCH_INFO, runs: FAILED_CURRENT_RUNS };
  }
  if (todoId === legacyReview.id) {
    return { token: LEGACY_TOKEN_USAGE, branch: LEGACY_BRANCH_INFO, runs: LEGACY_RUN_HISTORY };
  }
  if (todoId === legacyDone.id) {
    return LEGACY2_OVERLAY;
  }
  return r8OverlayContent(todoId);
}
// ---- issue #71: schedules + project route sets ----

/** r3 93 list card: the once rule built in r3 §9 (fired 14:30, todo #1 went
 *  done, rule still listed with 下次 今天 14:30 at capture time ~13:50).
 *  Record shape verbatim from r3 §8.3; `createdBy` id is [推断] (masked in
 *  the capture, never rendered). */
const scheduleOnce: ScheduleRecord = {
  id: 'r3-schedule-1',
  teamId: TEAM_ID,
  projectId: PROJECT_ID,
  todoId: 'r3-legacy-1',
  kind: 'once',
  at: at(R3_DAY, 14, 30),
  tz: 'Asia/Shanghai',
  machineId: null,
  nextRunAt: at(R3_DAY, 14, 30),
  createdBy: 'u-xmon-dai',
  todo: {
    seqNum: 1,
    title: legacyReview.title,
    phase: 'done',
    projectName: PROJECT_NAME,
    ownerId: 'u-xmon-dai',
  },
};

/** r7 11: the schedules empty state. Dedicated set (not a boardDefault
 *  alias) so edits to the board fixture can never drift the only gated
 *  baseline row of this batch (scenario contract, scenario.ts header). */
export const schedulesEmpty: FixtureSet = {
  todos: [legacyReview, legacyDone],
  now: r7(13, 14),
  schedules: [],
  project: projectContent,
};

/** r3 93: list with the single once rule. Capture instant ~13:50 keeps
 *  `下次 今天 14:30` in the future. */
export const schedulesList: FixtureSet = {
  todos: [legacyReview, legacyDone],
  now: at(R3_DAY, 13, 50),
  schedules: [scheduleOnce],
  project: projectContent,
};

/** r3 92: 新建定时 dialog open on the 每天 tab (the default frequency). */
export const schedulesFormDaily: FixtureSet = {
  todos: [legacyReview, legacyDone],
  now: at(R3_DAY, 13, 50),
  schedules: [],
  scheduleForm: 'daily',
  project: projectContent,
};

/** r3 92b: same dialog on 单次 — the 日期 row appears above 时间. */
export const schedulesFormOnce: FixtureSet = {
  ...schedulesFormDaily,
  scheduleForm: 'once',
};

/** The project routes share one content set; the route picks the page and
 *  `projectTab` picks the 任务|文件 surface (r2 07 / 07e·24 / 24b·26 / 24c).
 *  Default tab = 文件 (r2 §2 route table). */
export const projectFixture: FixtureSet = {
  todos: [legacyReview, legacyDone],
  now: r7(13, 14),
  project: projectContent,
};

/** r2 26: 任务 tab with the two legacy rows (checkbox + title + rel time
 *  + owner avatar). */
export const projectTasks: FixtureSet = { ...projectFixture, projectTab: 'tasks' };

/** r2 24b: 任务 tab of a project without todos — the 暂无内容 empty state
 *  with the `+ 任务` entry (the r2 session's r2-inventory project). */
export const projectTasksEmpty: FixtureSet = {
  todos: [],
  now: r7(13, 14),
  project: projectContent,
  projectTab: 'tasks',
}; /** Resource surfaces (r7 06–10, issue #69): the r3 session left one skill,
 *  one MCP server, the online r3 machine and a custom gateway on the free
 *  team, so the captures show populated rows rather than empty states
 *  (secrets excepted — its empty state is the capture). Row content is
 *  verbatim from the bitmaps; `2 天前` on the MCP row is the capture's own
 *  relative label (created on the r3 day), carried verbatim like the
 *  board's relative labels. */
const RESOURCES: ResourcesContent = {
  skills: [{ name: 'r3-probe-skill', description: 'R3 盘点测试技能' }],
  mcpServers: [
    {
      name: 'r3-mcp',
      kind: '远程（HTTP）',
      url: 'https://example.invalid/mcp',
      ago: '2 天前',
    },
  ],
  machines: [
    {
      hosted: true,
      name: 'Pacman 托管机器',
      description: '随时在线，构建速度快。空闲自动休眠，仅在运行时消耗积分。',
      pill: '未启用',
    },
    {
      name: MACHINE_NAME,
      sub: `…${MACHINE_ID.slice(-8)} · max 3`,
      online: true,
    },
  ],
  providers: [
    { name: 'Pacman（内置）', models: '8 模型', pill: '未启用' },
    { name: 'R3 网关', models: '12 模型', custom: true },
  ],
};

// ── Chief surfaces (issue #72, r5 100–116) ───────────────────────────────
// Copy verbatim from the r5 captures: 100 gate bar + hero + draft, 101–104
// settings tabs, 111 bound hero, 114 dispatch-report stream, 116 switcher.
// The r5 batch is 1438×730 (off the r7 baseline batch), so these sets back
// smoke rows only — see parity/matrix.mjs and docs/research/r8-chief-
// panel-adhoc.md for the baseline gap registration.

/** r5 100/111 hero grid, card order = capture order. */
const CHIEF_EXAMPLES: ChiefExample[] = [
  { icon: 'user-plus', text: '帮我组建 Agent 团队' },
  { icon: 'folder', text: '帮我创建一个新项目' },
  { icon: 'grid', text: '总结一下我所有项目现在的进展' },
  { icon: 'bars', text: '查一下这个月的 token 用量' },
];

/** r5 100/111 composer draft (localStorage pacman.cache.chief-draft-v1, the
 *  capture shows it restored into the textarea). */
const CHIEF_DRAFT =
  '我想做一个能在浏览器里直接玩的网页小游戏 （比如贪吃蛇或打砖块）： 单文件 HTML + Canvas， 不用任何构建工具，做完能在项目的文件页直接试玩。请在现有的入门项目里做， 组建 Agent 团队把游戏逻辑、 画面手感、 难度调优拆成并行任务， 然后向我汇报方案， 等我确认后再开始动工。';

/** r5 116 switcher rows: the two threads of the r5 session, active first. */
const CHIEF_THREADS: ChiefThreadRef[] = [
  { title: '给 r3-lifecycle 做三件小事…', active: true },
  { title: '帮 r3-lifecycle 写一份…' },
];

/** r5 100: drawer on a fresh thread, no agent bound — gate bar + hero. */
export const chiefGated: FixtureSet = {
  todos: [legacyReview, legacyDone],
  now: r7(13, 14),
  chief: {
    view: 'drawer',
    bound: false,
    threadTitle: '新主题',
    examples: CHIEF_EXAMPLES,
    draft: CHIEF_DRAFT,
  },
};

/** r5 111: same fresh-thread drawer once an agent is bound — model slot
 *  filled, gate bar gone. */
export const chiefReady: FixtureSet = {
  todos: [legacyReview, legacyDone],
  now: r7(13, 14),
  chief: {
    view: 'drawer',
    bound: true,
    modelSlot: 'claude-sonnet-5 · 默认',
    threadTitle: '新主题',
    examples: CHIEF_EXAMPLES,
    draft: CHIEF_DRAFT,
  },
};

/** r5 114: thread view with the dispatch report of todo #11 — user bubble,
 *  chief report paragraphs with the #11 / r5-scribe chips, 完成 44s footer. */
export const chiefThread: FixtureSet = {
  todos: [legacyReview, legacyDone],
  now: r7(13, 14),
  chief: {
    view: 'drawer',
    bound: true,
    modelSlot: 'claude-sonnet-5 · 默认',
    threadTitle: '帮 r3-lifecycle 写一份…',
    stream: [
      { kind: 'note', text: '17:26' },
      { kind: 'note', text: '运行在 ', machineName: MACHINE_NAME },
      {
        kind: 'user',
        text: '帮 r3-lifecycle 写一份 CONTRIBUTING.md 贡献指南，说明怎么给 Agent 提任务、怎么验收改动，写完放到项目根目录。',
      },
      {
        kind: 'robot',
        paragraphs: [
          [
            { text: '已创建并派工 ' },
            { text: '', todo: 11 },
            { text: ' 「编写 CONTRIBUTING.md 贡献指南」， 由文档专职 Agent ' },
            { text: '', agent: 'r5-scribe' },
            { text: ' 承接，正在编写中。' },
          ],
          [
            {
              text: '要求内容涵盖：如何给 Agent 提任务、如何验收改动，文件写入项目根目录 CONTRIBUTING.md。完成或需要确认时我会跟进汇报。',
            },
          ],
        ],
        seconds: '44s',
      },
    ],
  },
};

/** r5 116: the 三件小事 thread with the header switcher popover open —
 *  the visible stream tail is the merge-check report (bullets + #12 ask). */
export const chiefThreadsOpen: FixtureSet = {
  todos: [legacyReview, legacyDone],
  now: r7(13, 14),
  chief: {
    view: 'drawer',
    bound: true,
    modelSlot: 'claude-sonnet-5 · 默认',
    threadTitle: '给 r3-lifecycle 做三件小事…',
    threadsOpen: true,
    threads: CHIEF_THREADS,
    stream: [
      {
        kind: 'robot',
        paragraphs: [
          [
            { text: '顺带说明： CONTRIBUTING.md 本身由 ' },
            { text: '', todo: 11 },
            {
              text: ' 负责编写，目前在 review 阶段尚未合并进 main，我在新任务里已注明"只需在 README 里列出该条目，不必等它合并"。',
            },
          ],
          [{ text: '等它落到 review/完成时我会来汇报，到时候也会补上记忆总结。' }],
        ],
        seconds: '1m 4s',
      },
      {
        kind: 'robot',
        paragraphs: [[{ text: '三项改动都已核对，符合要求：' }]],
        bullets: [
          [
            { text: 'README.md:', strong: true },
            { text: '新增 「文档目录」 节，列出 ' },
            { text: 'CONTRIBUTING.md', code: true },
            { text: ' 链接。' },
          ],
          [
            { text: 'CHANGELOG.md:', strong: true },
            { text: '新建,含 「未发布」 初始条目，列出本次三项变更。' },
          ],
          [
            { text: 'scripts/hello.js:', strong: true },
            { text: 'node scripts/hello.js', code: true },
            { text: ' 打印 ' },
            { text: 'hello', code: true },
            { text: '，构建里已本地验证过。' },
          ],
        ],
        seconds: '31s',
      },
      {
        kind: 'robot',
        paragraphs: [
          [
            { text: '', todo: 12 },
            { text: ' 现在停在 review 阶段等你确认合并。要我现在 merge 吗?' },
          ],
        ],
        seconds: '31s',
      },
    ],
  },
};

/** r5 101–104: the 总管设置 view, one set per tab (unbound agent). */
export function chiefSettings(tab: ChiefSettingsTab): FixtureSet {
  return {
    todos: [legacyReview, legacyDone],
    now: r7(13, 14),
    chief: { view: 'settings', tab, bound: false, threadTitle: '新主题' },
  };
}

/** Default drawer content for a FAB-opened drawer on a scenario without a
 *  chief surface (dev interactivity; parity rows always carry a set). */
export const chiefDefault: ChiefContent = {
  view: 'drawer',
  bound: false,
  threadTitle: '新主题',
  examples: CHIEF_EXAMPLES,
};

/** Team route roster (r7 12): `1 个成员` stats bar + the single agent card
 *  (`claude-sonnet-5 · 默认`, role unset) beside the dashed 创建 Agent slot. */
export const TEAM_R7: TeamContent = {
  members: 1,
  agents: [
    {
      id: R3_BUILDER.id,
      displayName: R3_BUILDER.displayName,
      model: 'claude-sonnet-5',
      isDefault: true,
      role: null,
    },
  ],
};

/** Team route fixture (r7 12): the board todos never render here, the
 *  roster is the whole surface. */
export const teamGrid: FixtureSet = {
  todos: boardDefault.todos,
  now: boardDefault.now,
  team: TEAM_R7,
};

/** One created API key exercising both r3 §6 display rules: the list row
 *  mask and the one-time plaintext (02 §8 canon copy rides along in the
 *  page). Mask rule = 品牌前缀 + 前 8 hex + 省略号（r3 §6 observed sample
 *  `tds_afe07565…`；前缀随 BRAND.apiKeyPrefix 槽，#109）。 */
const API_KEY_PLAINTEXT = `${BRAND.apiKeyPrefix}afe07565b3c9d2e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0`;
const API_KEY_CREATED: ApiKeyRecord = {
  id: 'apikey-r7-1',
  name: null,
  masked: maskApiKey(API_KEY_PLAINTEXT),
  gitAccess: true,
  mcpAccess: true,
  plaintext: API_KEY_PLAINTEXT,
};

/** API-keys route fixture with the created key; the empty state (r2 19)
 *  is the fixture-less fallback. */
export const apiKeysCreated: FixtureSet = {
  todos: boardDefault.todos,
  now: boardDefault.now,
  apiKeys: { keys: [API_KEY_CREATED] },
}; /* ---- r8 overlay batch (#66): dark captures 78–81, shot 2026-09-22
   23:41–23:45 on the live space. The board behind them carries the
   session's own probe #16 plus the concurrent r8-dynamic ticket's #15
   and its #11–#14 leftovers; all transcribed off the captures, never
   touched on the live space. ---- */

/** r8 capture day. */
export const R8_DAY = '2026-09-22';
/** r8 capture-day timestamp. */
export const r8 = (h: number, m: number) => at(R8_DAY, h, m);

/** r8-dynamic ticket probe #15 (concurrent session, left untouched):
 *  planning while 54 shot, confirm by 57. */
function dyn15(phase: TodoRecord['phase']): TodoRecord {
  return {
    id: 'r8-dynamic-15',
    teamId: TEAM_ID,
    projectId: PROJECT_ID,
    title: '在 README.md 末尾追加一行「r8 dynamic probe」',
    spec: '在 README.md 末尾追加一行「r8 dynamic probe」',
    phase,
    phaseAt: r8(23, 39),
    seqNum: 15,
    orderIndex: 0,
    tagIds: [],
    assignment: { agentId: R3_BUILDER.id },
    agent: R3_BUILDER,
    latestBuildId: 'r8-dynamic-conv-15',
    lastRunAt: r8(23, 39),
    hasChanges: false,
    hasPlan: false,
    buildHistory: [{ buildId: 'r8-dynamic-conv-15', createdAt: r8(23, 39) }],
    sourceTodo: null,
    v: 2,
  };
}

/** r8-dynamic ticket's failed #12 (执行中 column, 重试 button, 5 小时前). */
const dyn12Failed: TodoRecord = {
  id: 'r8-dynamic-12',
  teamId: TEAM_ID,
  projectId: PROJECT_ID,
  title: 'README 文档目录 + 新建 CHANGELOG.md + scripts/hello.js',
  spec: 'README 文档目录 + 新建 CHANGELOG.md + scripts/hello.js',
  phase: 'failed',
  phaseAt: r8(18, 44),
  seqNum: 12,
  orderIndex: 0,
  tagIds: [],
  assignment: { agentId: R3_BUILDER.id },
  agent: R3_BUILDER,
  latestBuildId: 'r8-dynamic-conv-12',
  lastRunAt: r8(18, 44),
  hasChanges: false,
  hasPlan: false,
  buildHistory: [{ buildId: 'r8-dynamic-conv-12', createdAt: r8(18, 40) }],
  sourceTodo: null,
  v: 3,
};

/** r8-dynamic ticket's review/done leftovers (#13 待验收, #14/#11 已完成;
 *  #1/#2 are the r3 legacy pair, still on the board). */
function dynLeftover(
  seq: number,
  title: string,
  phase: TodoRecord['phase'],
  hoursAgo: number,
): TodoRecord {
  return {
    id: `r8-dynamic-${seq}`,
    teamId: TEAM_ID,
    projectId: PROJECT_ID,
    title,
    spec: title,
    phase,
    phaseAt: r8(23 - hoursAgo, 44),
    seqNum: seq,
    orderIndex: 0,
    tagIds: [],
    assignment: { agentId: R3_BUILDER.id },
    agent: R3_BUILDER,
    latestBuildId: `r8-dynamic-conv-${seq}`,
    lastRunAt: r8(23 - hoursAgo, 44),
    hasChanges: phase === 'review' || phase === 'done',
    hasPlan: phase === 'review',
    buildHistory: [{ buildId: `r8-dynamic-conv-${seq}`, createdAt: r8(23 - hoursAgo, 40) }],
    sourceTodo: null,
    v: 3,
  };
}

const R8_LEFTOVERS = [
  dynLeftover(13, '给 README.md 增加「项目结构」一节并链接贡献指南', 'review', 6),
  dynLeftover(14, '给 index.html 的页面标题加上项目名后缀', 'done', 6),
  dynLeftover(11, '编写 CONTRIBUTING.md 贡献指南', 'done', 6),
];

/** This ticket's probe #16 (created 23:42, deleted 23:45 — zero residue). */
function probe16(phase: TodoRecord['phase'], phaseAt: number): TodoRecord {
  return {
    id: 'u_B5ngeVOlKdKbG_4H9Cl',
    teamId: TEAM_ID,
    projectId: PROJECT_ID,
    title: 'r8-overlay-dark 探针',
    spec: 'r8-overlay-dark 探针',
    phase,
    phaseAt,
    seqNum: 16,
    orderIndex: 0,
    tagIds: [],
    assignment: phase === 'todo' ? null : { agentId: R3_BUILDER.id },
    agent: phase === 'todo' ? null : R3_BUILDER,
    latestBuildId: phase === 'todo' ? null : R8_BUILD_ID,
    lastRunAt: phase === 'todo' ? null : r8(23, 43),
    hasChanges: false,
    hasPlan: phase === 'confirm',
    buildHistory: phase === 'todo' ? [] : [{ buildId: R8_BUILD_ID, createdAt: r8(23, 43) }],
    sourceTodo: null,
    v: 2,
  };
}

/** r8 build id of probe #16 (synthetic: the record never survived the
 *  session, same precedent as r7 probe #10). */
const R8_BUILD_ID = 'r8-conv-overlay-16';

/** Probe #16 plan document, verbatim from the 56 doc pane: markdown
 *  headings + file/commit reference spans (blue mono chips). */
const R8_PLAN_DOC: DocBlock[] = [
  { kind: 'head', segments: [{ text: 'Context' }] },
  {
    kind: 'para',
    segments: [
      { text: 'r3-lifecycle 是一个纯静态单页仓库（' },
      { text: 'index.html', style: 'link' },
      { text: ' + ' },
      { text: 'README.md', style: 'link' },
      { text: '，无构建/测试/CI）。历史上每一轮 rN 探针任务（r3、r5b、r6、r7，见 ' },
      { text: 'README.md', style: 'link' },
      { text: ' 现有内容及对应 commit ' },
      { text: '2f47b62', style: 'link' },
      { text: '、' },
      { text: '386b8e4', style: 'link' },
      { text: '、' },
      { text: '1cecf83', style: 'link' },
      { text: '、' },
      { text: '2cceb9d', style: 'link' },
      { text: '）都遵循同一套路：在 ' },
      { text: 'README.md', style: 'link' },
      { text: ' 末尾追加一行 "' },
      { text: '<探针名> probe', style: 'link' },
      { text: '" 文本，作为该轮次生命周期/rebaseline 探针的可验证产物，commit message 统一为 ' },
      { text: 'docs(readme): append <探针名> probe line', style: 'link' },
      { text: '。本次任务 ' },
      { text: 'r8-overlay-dark 探针', style: 'link' },
      {
        text: ' 的 Spec 未给出具体文案，按同一约定执行：追加对应的第 r8 轮探针行，保持仓库内探针记录的连续性。',
      },
    ],
  },
  { kind: 'head', segments: [{ text: '假设' }] },
  {
    kind: 'bullet',
    segments: [
      { text: 'Spec 为空，按仓库既有 r3/r5b/r6/r7 探针的命名与格式惯例，在 ' },
      { text: 'README.md', style: 'link' },
      { text: ' 末尾新增一行：' },
      { text: 'r8 overlay-dark probe', style: 'link' },
      { text: '（对应标题中的 ' },
      { text: 'r8-overlay-dark', style: 'link' },
      { text: '，与既有行如 ' },
      { text: 'r7 rebaseline probe', style: 'link' },
      { text: ' 的措辞风格一致）。' },
    ],
  },
  {
    kind: 'bullet',
    segments: [
      { text: '不改动 ' },
      { text: 'index.html', style: 'link' },
      { text: '、' },
      { text: 'CONTRIBUTING.md', style: 'link' },
      { text: '，本轮探针只涉及 ' },
      { text: 'README.md', style: 'link' },
      { text: '。' },
    ],
  },
  { kind: 'head', segments: [{ text: 'Changes' }] },
  {
    kind: 'bullet',
    segments: [
      { text: 'README.md', style: 'link' },
      { text: '：在文件末尾追加一行 ' },
      { text: 'r8 overlay-dark probe', style: 'link' },
      { text: '，与现有 5 行探针记录（' },
      { text: 'r3 lifecycle probe', style: 'link' },
      { text: ' 等）保持相同的纯文本追加方式，不改动已有内容、不加空行。' },
    ],
  },
  { kind: 'head', segments: [{ text: 'Verification' }] },
  {
    kind: 'bullet',
    segments: [
      { text: 'git diff README.md', style: 'code' },
      { text: ' 确认只新增一行 ' },
      { text: 'r8 overlay-dark probe', style: 'link' },
      { text: '，无其他改动。' },
    ],
  },
  {
    kind: 'bullet',
    segments: [
      { text: 'git log --oneline -1', style: 'code' },
      { text: ' 确认提交信息符合约定：' },
      { text: 'docs(readme): append r8 overlay-dark probe line', style: 'link' },
      { text: '。' },
    ],
  },
  {
    kind: 'bullet',
    segments: [
      {
        text: '用变更审阅（change review）里 README.md 的预览按钮确认渲染正常、新行显示在列表末尾。',
      },
    ],
  },
];

/** Probe #16 transcript at confirm (r8 80): stamp, start bubble with the
 *  taskline, the agent's spec-empty note, plan card `完成 2m 41s`. */
const R8_CONFIRM_TRANSCRIPT: TranscriptItem[] = [
  { kind: 'run', at: '23:43', machine: MACHINE_NAME },
  { kind: 'user', text: '开始执行任务', seq: 16, title: 'r8-overlay-dark 探针' },
  {
    kind: 'robot',
    paragraphs: [
      [
        {
          text: '该任务的 Spec 为空，只有标题「r8-overlay-dark 探针」。参照仓库里 r3~r7 同类型探针 commit（如 ',
        },
        { text: 'docs(readme): append r7 rebaseline probe line', style: 'code' },
        {
          text: '）的固定套路——在 README.md 末尾追加一行与探针名对应的文本——我按同一约定生成本次改动的具体文案，并在计划中的「假设」里写明。',
        },
      ],
    ],
  },
  {
    kind: 'plan',
    title: '方案 · v1',
    preview:
      'Context r3-lifecycle 是一个纯静态单页仓库（index.html + README.md，无构建/测试/CI）。历史上每一轮 rN 探针任务（r3、r5b、r6、r7，见 README.md 现有内容及对应 commit 2f47b62、386b8e4、1cecf83、2cceb9d）都遵循…',
    seconds: 161,
  },
];

/** r8 78: board at 23:41 — #15 planning (streaming card behind the
 *  dialog), #12 failed with 重试, the legacy pair in 待验收/已完成 plus
 *  the dynamic ticket's done leftovers. */
export const boardR8Overlay: FixtureSet = {
  todos: [dyn15('planning'), dyn12Failed, legacyReview, ...R8_LEFTOVERS, legacyDone],
  now: r8(23, 44),
  usageNav: true,
};

/** r8 81: probe #16 fresh detail at 23:43 (#15 already confirm → badge 3). */
export const detailR8Fresh: FixtureSet = {
  todos: [
    probe16('todo', r8(23, 42)),
    dyn15('confirm'),
    dyn12Failed,
    legacyReview,
    ...R8_LEFTOVERS,
    legacyDone,
  ],
  now: r8(23, 43),
  usageNav: true,
};

/** r8 82: probe #17 (created 2026-09-23 00:34, deleted 00:36 — zero
 *  residue), fresh detail under the delete confirm. Badge 2 in the
 *  capture → #15 already out of confirm by then; the fresh surface keeps
 *  this pair clear of the doc-pane/taskline drift the 79/80 pairs hit. */
const probe17Fresh: TodoRecord = {
  id: 'r8-delete-17',
  teamId: TEAM_ID,
  projectId: PROJECT_ID,
  title: 'r8-delete-dark 探针',
  spec: 'r8-delete-dark 探针',
  phase: 'todo',
  phaseAt: at('2026-09-23', 0, 34),
  seqNum: 17,
  orderIndex: 0,
  tagIds: [],
  assignment: null,
  agent: null,
  latestBuildId: null,
  lastRunAt: null,
  hasChanges: false,
  hasPlan: false,
  buildHistory: [],
  sourceTodo: null,
  v: 2,
};

export const detailR8DeleteFresh: FixtureSet = {
  todos: [probe17Fresh, dyn15('done'), dyn12Failed, legacyReview, ...R8_LEFTOVERS, legacyDone],
  now: at('2026-09-23', 0, 35),
  usageNav: true,
};

/** r8 80/79: probe #16 confirm detail at 23:44 (badge 4), the surface the
 *  更多 menu and the delete confirm sit over. */
export function detailR8Confirm(): FixtureSet {
  return {
    todos: [
      probe16('confirm', r8(23, 43)),
      dyn15('confirm'),
      dyn12Failed,
      legacyReview,
      ...R8_LEFTOVERS,
      legacyDone,
    ],
    now: r8(23, 44),
    usageNav: true,
    detail: { transcript: R8_CONFIRM_TRANSCRIPT, doc: R8_PLAN_DOC },
  };
}

export const resourcesDefault: FixtureSet = {
  todos: [legacyReview, legacyDone],
  now: r7(13, 14),
  resources: RESOURCES,
};

/** 新建技能 route (r8 79/80, issue #69): same team state as the resource
 *  rows, with the import tab the capture sits on. */
export function resourcesImport(tab: 'folder' | 'github'): FixtureSet {
  return {
    ...resourcesDefault,
    resources: { ...RESOURCES, importTab: tab },
  };
}

// ---- issue #75: r8 dynamic-state sets (reject loop / failed / reuse) ----
// Content verbatim from the r8 captures 54–77 (docs/research/r8-dynamic-
// states.md §1–§3) plus the raw geometry dumps. Two session days: the
// evening of 2026-09-22 (23:1x–23:5x) and the minutes past midnight
// (00:0x, 2026-09-23) — the `昨天 17:38` stamp flip in 57 pins the split.

/** r8 past-midnight (2026-09-23). */
const r8n = (h: number, m: number) => at('2026-09-23', h, m);

/** #12: r5-leftover failed todo, chief-launched, no plan document
 *  (r8 §3.4: hence no 复用方案 button on its rerun dialog). */
const failed12: TodoRecord = {
  id: 'r8-12',
  teamId: TEAM_ID,
  projectId: PROJECT_ID,
  title: 'README 文档目录 + 新建 CHANGELOG.md + scripts/hello.js',
  spec: 'README 文档目录 + 新建 CHANGELOG.md + scripts/hello.js',
  phase: 'failed',
  phaseAt: r8(17, 38),
  seqNum: 12,
  orderIndex: 0,
  tagIds: [],
  assignment: { agentId: R3_BUILDER.id },
  agent: R3_BUILDER,
  latestBuildId: 'r8-conv-12',
  lastRunAt: r8(17, 38),
  hasChanges: true,
  hasPlan: false,
  buildHistory: [{ buildId: 'r8-conv-12', createdAt: r8(17, 38) }],
  sourceTodo: null,
  v: 3,
};

/** #13: review todo of the r8 session — only ever off-screen (board
 *  column 5 sliver) but counted by the 看板 badge (r8 55/57). */
const review13: TodoRecord = {
  id: 'r8-13',
  teamId: TEAM_ID,
  projectId: PROJECT_ID,
  title: 'r8 session review probe',
  spec: 'r8 session review probe',
  phase: 'review',
  phaseAt: r8(22, 50),
  seqNum: 13,
  orderIndex: 0,
  tagIds: [],
  assignment: { agentId: R3_BUILDER.id },
  agent: R3_BUILDER,
  latestBuildId: 'r8-conv-13',
  lastRunAt: r8(22, 40),
  hasChanges: true,
  hasPlan: true,
  buildHistory: [{ buildId: 'r8-conv-13', createdAt: r8(22, 40) }],
  sourceTodo: null,
  v: 2,
};

const R8_TITLE = '在 README.md 末尾追加一行「r8 dynamic probe」';

/** #15 in the given phase (probe of the r8 session). */
function probe15(phase: TodoRecord['phase'], phaseAt: number): TodoRecord {
  return {
    id: 'r8-15',
    teamId: TEAM_ID,
    projectId: PROJECT_ID,
    title: R8_TITLE,
    spec: R8_TITLE,
    phase,
    phaseAt,
    seqNum: 15,
    orderIndex: 0,
    tagIds: [],
    assignment: { agentId: R3_BUILDER.id },
    agent: R3_BUILDER,
    latestBuildId: 'r8-conv-15',
    lastRunAt: r8(23, 40),
    hasChanges: phase === 'failed' || phase === 'review' || phase === 'done',
    hasPlan: phase !== 'todo',
    buildHistory: [
      { buildId: 'r8-conv-15', createdAt: r8(23, 40) },
      ...(phase === 'review' || phase === 'building'
        ? [{ buildId: 'r8-conv-15b', createdAt: r8n(0, 2) }]
        : []),
    ],
    sourceTodo: null,
    v: 4,
  };
}

/** #12 changeset (r8 54): three files, +15. */
const CHANGES_12: ChangesContent = {
  expanded: false,
  files: [
    { path: 'CHANGELOG.md', added: 9, hunks: [] },
    { path: 'README.md', added: 4, hunks: [] },
    { path: 'scripts/hello.js', added: 2, hunks: [] },
  ],
};

/** #15 changeset (r8 73/77): README.md +1. */
const CHANGES_15: ChangesContent = {
  expanded: false,
  files: [{ path: 'README.md', added: 1, hunks: [] }],
};

/** #12 transcript (r8 54): chief-launched run, result message, failed
 *  merge round. `stamp` flips to `昨天 17:38` past midnight (57). */
function transcript12(stamp: string): TranscriptItem[] {
  return [
    { kind: 'run', at: stamp, machine: MACHINE_NAME },
    { kind: 'chief' },
    { kind: 'user', text: '开始执行任务', seq: 12, title: failed12.title },
    {
      kind: 'robot',
      paragraphs: [
        {
          segments: [
            { text: '验证通过，输出为 ' },
            { text: 'hello', style: 'code' },
            { text: '。' },
          ],
        },
        { segments: [{ text: '三项改动均已完成：' }] },
        {
          bullet: true,
          segments: [
            { text: 'README.md', style: 'code' },
            { text: ': 新增「文档目录」章节，列出 ' },
            { text: 'CONTRIBUTING.md', style: 'code' },
            { text: ' 链接（该文件由 ' },
            { text: '#11', style: 'code' },
            { text: ' 负责，尚未合并，链接暂时指向不存在的文件属预期）。' },
          ],
        },
        {
          bullet: true,
          segments: [
            { text: 'CHANGELOG.md', style: 'code' },
            { text: ': 新建文件，写入初始条目。' },
          ],
        },
        {
          bullet: true,
          segments: [
            { text: 'scripts/hello.js', style: 'code' },
            { text: ': 新增脚本，' },
            { text: 'node scripts/hello.js', style: 'code' },
            { text: ' 运行打印 ' },
            { text: 'hello', style: 'code' },
            { text: '（已本地验证）。' },
          ],
        },
      ],
      footer: { seconds: 28 },
    },
    { kind: 'note', text: '18:18' },
    { kind: 'note', text: 'Xmon Dai 发起了合并' },
    {
      kind: 'fail',
      title: '运行该任务的机器已离线',
      body: '请将其重新上线，或重新运行任务以改派其他机器。',
      links: ['查看原始错误', '排查指南'],
    },
  ];
}

/** plan.md section paragraph per version wording (`w` = the appended
 *  line; r8 63/76 doc panes). The first README.md chip is link-styled. */
function planDoc(w: string, withCommit: boolean, msg: string): DocBlock[] {
  const blocks: DocBlock[] = [
    { kind: 'head', segments: [{ text: 'Context' }] },
    {
      kind: 'para',
      segments: [
        { text: '仓库根目录的 ' },
        { text: 'README.md', style: 'link' },
        { text: ' 目前内容为逐行累积的"探针记录"（' },
        { text: 'r3 lifecycle probe', style: 'code' },
        { text: '、' },
        { text: 'r6 rebaseline probe', style: 'code' },
        { text: '、' },
        { text: 'r7 rebaseline probe', style: 'code' },
        {
          text: ' 等），每次任务在文件末尾新增一行文字，文件以换行符结尾。本次任务按同样的惯例，在文件末尾追加一行 ',
        },
        { text: w, style: 'code' },
        { text: '。' },
      ],
    },
    { kind: 'head', segments: [{ text: '改动' }] },
    {
      kind: 'bullet',
      segments: [
        { text: 'README.md', style: 'link' },
        { text: ': 在文件末尾追加新的一行 ' },
        { text: w, style: 'code' },
        { text: '，保持文件以换行符结尾（与现有各行格式一致），不修改任何已有内容。' },
      ],
    },
  ];
  if (withCommit) {
    blocks.push({
      kind: 'bullet',
      segments: [
        { text: '提交：改动完成后需创建一次 commit，遵循仓库历史惯例（如 ' },
        { text: 'docs(readme): append r7 rebaseline probe line', style: 'code' },
        { text: '），本次 commit message 使用 ' },
        { text: msg, style: 'code' },
        { text: '。' },
      ],
    });
  }
  blocks.push(
    { kind: 'head', segments: [{ text: '验证' }] },
    {
      kind: 'bullet',
      segments: [
        { text: '执行 ' },
        { text: 'cat README.md', style: 'code' },
        { text: ' 或 ' },
        { text: 'tail -1 README.md', style: 'code' },
        { text: '，确认最后一行为 ' },
        { text: w, style: 'code' },
        { text: '。' },
      ],
    },
    {
      kind: 'bullet',
      segments: [
        { text: '执行 ' },
        { text: 'git diff README.md', style: 'code' },
        { text: '，确认只新增了一行 ' },
        { text: `+${w}`, style: 'code' },
        { text: '，没有改动其他内容。' },
      ],
    },
  );
  return blocks;
}

const DYNAMIC = 'r8 dynamic probe';
const MANUAL = 'r8 probe manual-revision';
const MSG_DYNAMIC = 'docs(readme): append r8 dynamic probe line';
const MSG_MANUAL = 'docs(readme): append r8 probe manual-revision line';

const DOC_V1 = planDoc(DYNAMIC, false, MSG_DYNAMIC);
const DOC_V2 = planDoc(DYNAMIC, true, MSG_DYNAMIC);
const DOC_V3 = planDoc(MANUAL, true, MSG_MANUAL);

/** Plan-card preview line of the #15 plan cards (r8 63/68/73/76): the
 *  two-line clamp cut lands before the version wording, so every version
 *  shares this truncation, ellipsis included. */
const R8_PLAN_PREVIEW =
  'Context 仓库根目录的 README.md 目前内容为逐行累积的"探针记录"（r3 lifecycle probe、r6 rebaseline probe、r7 rebaseline probe 等），每次任务在文件末尾新增一行文字，文件以换行符结尾。本次任务按同样的惯例，在文件末尾…';

/** plan.md line list per version (diff source of truth). */
function planLines(w: string, msg: string | null): string[] {
  return [
    '## Context',
    `仓库根目录的 README.md 目前内容为逐行累积的"探针记录"（r3 lifecycle probe、r6 rebaseline probe、r7 rebaseline probe 等），每次任务在文件末尾新增一行文字，文件以换行符结尾。本次任务按同样的惯例，在文件末尾追加一行 ${w}。`,
    '',
    '## 改动',
    `- README.md: 在文件末尾追加新的一行 ${w}，保持文件以换行符结尾（与现有各行格式一致），不修改任何已有内容。`,
    ...(msg != null
      ? [
          `- 提交：改动完成后需创建一次 commit，遵循仓库历史惯例（如 docs(readme): append r7 rebaseline probe line），本次 commit message 使用 ${msg}。`,
        ]
      : []),
    '',
    '## 验证',
    `- 执行 cat README.md 或 tail -1 README.md，确认最后一行为 ${w}。`,
    `- 执行 git diff README.md，确认只新增了一行 +${w}，没有改动其他内容。`,
  ];
}

const NO_NEWLINE = '\\ No newline at end of file';

/** Unified hunk between two plan.md line lists (single hunk, full file).
 *  The trailing no-newline marker rides per side when both sides change
 *  at EOF (r8 72: del marker between the last del and the first add). */
function planHunk(from: string[], to: string[]): DiffHunk {
  // 01-stack-v2 §4.1 pins the diff data layer to npm `diff` 9.0.0 (render
  // stays hand-rolled); the fixture hunks go through the same pin.
  const lines: DiffLine[] = [];
  let oldNo = 0;
  let newNo = 0;
  for (const part of diffLines(from.join('\n'), to.join('\n'))) {
    const rows = part.value.split('\n');
    if (rows[rows.length - 1] === '') rows.pop(); // trailing join separator
    for (const text of rows) {
      if (part.added === true) {
        newNo++;
        lines.push({ kind: 'add', text, newNo });
      } else if (part.removed === true) {
        oldNo++;
        lines.push({ kind: 'del', text, oldNo });
      } else {
        oldNo++;
        newNo++;
        lines.push({ kind: 'context', text, oldNo, newNo });
      }
    }
  }
  // r8 72 renders the no-newline marker per side when both sides change
  // at EOF; add-only diffs (r8 66) carry the single trailing marker
  const lastDel = lines.findLastIndex((l) => l.kind === 'del');
  const firstAdd = lines.findIndex((l) => l.kind === 'add');
  if (lastDel !== -1 && lastDel > firstAdd) {
    lines.splice(lastDel + 1, 0, { kind: 'marker', text: NO_NEWLINE });
  }
  return {
    header: `@@ -1,${from.length} +1,${to.length} @@`,
    lines: [...lines, { kind: 'marker', text: NO_NEWLINE }],
  };
}

/** plan-version diff surface (r8 65–72): one plan.md file, stats derived
 *  from the hunk. */
function planDiff(
  fromV: string,
  toV: string,
  from: string[],
  to: string[],
  expanded: boolean,
): PlanDiffContent {
  const hunk = planHunk(from, to);
  const added = hunk.lines.filter((l) => l.kind === 'add').length;
  const removed = hunk.lines.filter((l) => l.kind === 'del').length;
  return {
    from: fromV,
    to: toV,
    expanded,
    files: [{ path: 'plan.md', added, removed, hunks: [hunk] }],
  };
}

const LINES_V1 = planLines(DYNAMIC, null);
const LINES_V2 = planLines(DYNAMIC, MSG_DYNAMIC);
const LINES_V3 = planLines(MANUAL, MSG_MANUAL);

/** AI-review message of run 1 (r8 60/65): conclusion-first prose, one
 *  numbered blocking finding, the quoted plan line, closing paragraph. */
const REVIEW_MESSAGE: TranscriptItem = {
  kind: 'robot',
  paragraphs: [
    { segments: [{ text: '看好还是坏，直接给结论：' }] },
    { segments: [{ text: 'Please address the points below before coding.' }] },
    {
      ordinal: 1,
      segments: [
        {
          text: '计划完全没有提到提交(commit)这一步。仓库历史显示每次追加探针行都伴随一次格式统一的 commit(如 ',
        },
        { text: 'docs(readme): append r7 rebaseline probe line', style: 'code' },
        {
          text: ')，但计划的"改动"和"验证"部分只字未提是否要创建对应的 commit、以及 commit message 应遵循什么格式。请在计划中补充：追加该行后是否需要提交，若需要，commit message 按照惯例应为类似 ',
        },
        { text: 'docs(readme): append r8 dynamic probe line', style: 'code' },
        { text: ' 的格式。(blocking)' },
      ],
    },
    {
      quote: true,
      segments: [
        { text: 'README.md', style: 'code' },
        { text: '：在文件末尾追加新的一行 ' },
        { text: DYNAMIC, style: 'code' },
        { text: '，保持文件以换行符结尾（与现有各行格式一致），不修改任何已有内容。' },
      ],
    },
    {
      segments: [
        {
          text: '除此之外，计划本身与现有文件内容、格式惯例(每行探针记录、文件以换行符结尾)完全吻合，没有其他问题。',
        },
      ],
    },
  ],
  footer: { restore: true, seconds: 53, chevron: true },
};

/** Auto-revision summary after the blocking finding (r8 61/65). */
const ADJUST_V2_MESSAGE: TranscriptItem = {
  kind: 'robot',
  paragraphs: [
    {
      segments: [
        { text: '确认历史提交惯例后，补充 commit 相关说明到计划中。已按反馈补充：查看 ' },
        { text: 'git log --oneline -- README.md', style: 'code' },
        { text: ' 确认历史上每次追加探针行都有对应 commit（如 ' },
        { text: 'docs(readme): append r7 rebaseline probe line', style: 'code' },
        { text: '），在「改动」部分新增一条，明确本次需提交一次 commit，message 为 ' },
        { text: MSG_DYNAMIC, style: 'code' },
        { text: '。' },
      ],
    },
  ],
};

/** Manual-reject revision summary (r8 68). */
const ADJUST_V3_MESSAGE: TranscriptItem = {
  kind: 'robot',
  paragraphs: [
    {
      segments: [
        {
          text: '用户明确要求把追加行文案改为「r8 probe manual-revision」，需要同步更新计划中所有引用该文案的地方（Context、改动、验证），以保持一致；commit message 中的描述性文字也随之同步（因为它直接引用了追加内容，若不改会与实际内容不符），其余结构和逻辑不变。已按用户要求将追加行文案统一改为「r8 probe manual-revision」，同步更新了 Context、改动（含 commit message）和验证三处，其余结构不变。',
        },
      ],
    },
  ],
};

const REJECT_FEEDBACK = '请把追加行的文案改为「r8 probe manual-revision」，其余不变';

/** Run-1 transcript of #15 up to the v2 plan card (r8 62/63). */
const RUN1_TO_V2: TranscriptItem[] = [
  { kind: 'run', at: '23:40', machine: MACHINE_NAME },
  { kind: 'user', text: '开始执行任务', seq: 15, title: R8_TITLE },
  {
    kind: 'robot',
    paragraphs: [
      {
        segments: [{ text: '任务明确：在 README.md 末尾追加探针行，直接规划。' }],
      },
    ],
  },
  { kind: 'plan', title: '方案 · v1', preview: R8_PLAN_PREVIEW, seconds: 31, chevron: true },
  { kind: 'note', text: 'Xmon Dai 发起了 AI 审核' },
  REVIEW_MESSAGE,
  ADJUST_V2_MESSAGE,
  { kind: 'plan', title: '方案 · v2', preview: R8_PLAN_PREVIEW, seconds: 29, chevron: true },
];

/** v2 landed (r8 63–66): run-1 transcript, version dropdown rows. */
function detailV2(now: number): FixtureSet {
  return {
    todos: [failed12, review13, probe15('confirm', r8(23, 53))],
    now,
    detail: {
      transcript: RUN1_TO_V2,
      doc: DOC_V2,
      planVersions: [
        { v: 'v2', at: r8(23, 53) },
        { v: 'v1', at: r8(23, 44) },
      ],
    },
  };
}

/** v3 landed (r8 68–72): reject bubble + v3 summary + v3 card; the open
 *  diff auto-rebased to v1 → v3 (r8 §2.7). */
const RUN1_TO_V3: TranscriptItem[] = [
  ...RUN1_TO_V2,
  { kind: 'user', text: REJECT_FEEDBACK },
  ADJUST_V3_MESSAGE,
  { kind: 'plan', title: '方案 · v3', preview: R8_PLAN_PREVIEW, seconds: 49, chevron: true },
];

function detailV3(now: number): FixtureSet {
  return {
    todos: [failed12, review13, probe15('confirm', r8(23, 56))],
    now,
    detail: {
      transcript: RUN1_TO_V3,
      doc: DOC_V3,
      planVersions: [
        { v: 'v3', at: r8(23, 56) },
        { v: 'v2', at: r8(23, 53) },
        { v: 'v1', at: r8(23, 44) },
      ],
      planDiff: planDiff('v1', 'v3', LINES_V1, LINES_V3, false),
    },
  };
}

/** #15 failed (r8 73–75): v3 round confirmed, execution merged-failed. */
const RUN1_FAILED: TranscriptItem[] = [
  ...RUN1_TO_V3,
  { kind: 'user', text: '确认' },
  {
    kind: 'robot',
    paragraphs: [
      {
        segments: [
          { text: '已在 ' },
          { text: 'README.md', style: 'code' },
          { text: ' 末尾追加一行 ' },
          { text: MANUAL, style: 'code' },
          { text: '，验证通过：' },
          { text: 'tail -1', style: 'code' },
          { text: ' 与 ' },
          { text: 'git diff', style: 'code' },
          { text: ' 均确认仅新增该行，其余内容未改动。' },
        ],
      },
    ],
    footer: { seconds: 29, chevron: true },
  },
  { kind: 'note', text: 'Xmon Dai 发起了合并' },
  {
    kind: 'fail',
    title: '运行该任务的机器已离线',
    body: '请将其重新上线，或重新运行任务以改派其他机器。',
    links: ['查看原始错误', '排查指南'],
  },
];

function detailFailed15(now: number): FixtureSet {
  return {
    todos: [failed12, probe15('failed', r8n(0, 0))],
    now,
    detail: { transcript: RUN1_FAILED, changes: CHANGES_15 },
  };
}

/** Reused build (r8 76): skipped planning, quoted plan card, second run
 *  stamp split around it, 确认 round streaming. */
const REUSED_TRANSCRIPT: TranscriptItem[] = [
  { kind: 'run', at: '00:02' },
  { kind: 'user', text: '开始执行任务', seq: 15, title: R8_TITLE },
  { kind: 'robot', paragraphs: [{ segments: [{ text: '复用了上一次运行的方案。' }] }] },
  { kind: 'plan', title: '方案 · v1', preview: R8_PLAN_PREVIEW },
  { kind: 'run', machine: MACHINE_NAME },
  { kind: 'user', text: '确认' },
  { kind: 'streaming', seconds: 1, label: '连接机器...' },
];

/** Reused build once it reached review (r8 77 background). */
const REUSED_REVIEW_TRANSCRIPT: TranscriptItem[] = [
  ...REUSED_TRANSCRIPT.slice(0, 5),
  {
    kind: 'robot',
    paragraphs: [
      {
        segments: [
          {
            text: '已在 README.md 末尾追加一行 r8 dynamic probe（任务标题要求的具体文字，与之前计划中占位的 ',
          },
          { text: MANUAL, style: 'code' },
          { text: ' 不同，故以任务标题为准），' },
          { text: 'git diff', style: 'code' },
          { text: ' 确认仅新增了这一行，未改动其他内容。' },
        ],
      },
    ],
    footer: { seconds: 49, chevron: true },
  },
];

// ---- scenario sets ----

/** Detail-content patch helper: keeps the r8 scenario sets free of
 *  non-null assertions on the optional `detail` field. */
function withDetail(
  base: FixtureSet,
  patch: Partial<NonNullable<FixtureSet['detail']>>,
): FixtureSet {
  const detail = base.detail;
  if (detail == null) return base;
  return { ...base, detail: { ...detail, ...patch } };
}

/** r8 54/56: #12 failed detail, evening now. */
export const detailFailed12: FixtureSet = {
  todos: [failed12, review13],
  now: r8(23, 14),
  detail: { transcript: transcript12('17:38'), changes: CHANGES_12 },
};

/** r8 55: board with the failed #12 card in 执行中. */
export const boardFailed: FixtureSet = {
  todos: [failed12, review13],
  now: r8(23, 14),
  schedules: [],
  project: projectContent,
};

/** r8 56: rerun dialog over #12 (no plan doc → no 复用方案 button). */
export const rerunDialog12: FixtureSet = {
  ...withDetail(detailFailed12, {
    rerunAgent: { name: R3_BUILDER.displayName, model: 'claude-sonnet-5' },
  }),
  overlay: { kind: 'rerun' },
};

/** r8 57: run history of #12 past midnight (昨天 stamp, 6 小时前 row).
 *  Rows ride the upstream overlayContent mechanism (#68). */
export const history12: FixtureSet = {
  ...detailFailed12,
  overlay: { kind: 'history' },
};

/** r8 63: version dropdown open on the v2 surface. */
export const versionMenuV2: FixtureSet = withDetail(detailV2(r8(23, 54)), {
  versionMenu: 'versions',
  compareTarget: planDiff('v1', 'v2', LINES_V1, LINES_V2, false),
});

/** r8 64: compare submenu open (single 上一版本 row). */
export const compareMenuV2: FixtureSet = withDetail(detailV2(r8(23, 54)), {
  versionMenu: 'compare',
  compareTarget: planDiff('v1', 'v2', LINES_V1, LINES_V2, false),
});

/** r8 65/66: plan-version diff v1 → v2, collapsed / expanded. */
export function diffV1V2(expanded: boolean): FixtureSet {
  return withDetail(detailV2(r8(23, 55)), {
    planDiff: planDiff('v1', 'v2', LINES_V1, LINES_V2, expanded),
  });
}

/** r8 67: reject sent — replan streaming with the v1 → v2 diff still open. */
export const revisionStreaming: FixtureSet = {
  todos: [failed12, review13, probe15('planning', r8(23, 55))],
  now: r8(23, 55),
  detail: {
    transcript: [
      ...RUN1_TO_V2,
      { kind: 'user', text: REJECT_FEEDBACK },
      { kind: 'streaming', seconds: 1, label: '处理中...' },
    ],
    doc: DOC_V2,
    planVersions: [
      { v: 'v2', at: r8(23, 53) },
      { v: 'v1', at: r8(23, 44) },
    ],
    planDiff: planDiff('v1', 'v2', LINES_V1, LINES_V2, true),
  },
};

/** r8 68/69: v3 landed, auto-rebased v1 → v3 diff collapsed. */
export const detailV3Collapsed: FixtureSet = detailV3(r8(23, 58));

/** r8 70: version dropdown open over the v3 diff surface (5 rows: the
 *  open diff adds the compare row's `v1` label + 回到与 base 对比). */
export const versionMenuV3: FixtureSet = withDetail(detailV3(r8(23, 58)), {
  versionMenu: 'versions',
  compareTarget: planDiff('v2', 'v3', LINES_V2, LINES_V3, false),
});

/** r8 71/72: manual-reject diff v2 → v3, collapsed / expanded. */
export function diffV2V3(expanded: boolean): FixtureSet {
  return withDetail(detailV3(r8(23, 58)), {
    planDiff: planDiff('v2', 'v3', LINES_V2, LINES_V3, expanded),
  });
}

/** r8 73: #15 failed detail. */
export const detailFailed15Set: FixtureSet = detailFailed15(r8n(0, 1));

/** r8 74: rerun dialog with the 复用方案 button (#15 has a plan doc). */
export const rerunDialog15: FixtureSet = {
  ...withDetail(detailFailed15(r8n(0, 1)), {
    rerunAgent: { name: R3_BUILDER.displayName, model: 'claude-sonnet-5' },
  }),
  overlay: { kind: 'rerun' },
};

/** r8 75: 复用方案 sub-panel. */
export const reusePanel15: FixtureSet = {
  ...detailFailed15(r8n(0, 1)),
  overlay: { kind: 'reuse' },
};

/** r8 76: reused build streaming (执行中, plan pane on the reused v1). */
export const reusedBuilding: FixtureSet = {
  todos: [failed12, review13, probe15('building', r8n(0, 2))],
  now: r8n(0, 2),
  detail: { transcript: REUSED_TRANSCRIPT, doc: DOC_V3 },
};

/** r8 77: run history of the reused build, two rows, review phase. */
export const history15: FixtureSet = {
  todos: [failed12, review13, probe15('review', r8n(0, 2))],
  now: r8n(0, 3),
  detail: { transcript: REUSED_REVIEW_TRANSCRIPT, changes: CHANGES_15 },
  overlay: { kind: 'history' },
};

/** Interactive reject chain (issue #75 AC3): confirm v1 with a revision
 *  script — send walks 请求修改 → streaming → v2 → diff → 确认. */
export const revisionChain: FixtureSet = {
  todos: [failed12, review13, probe15('confirm', r8(23, 44))],
  now: r8(23, 45),
  detail: {
    transcript: RUN1_TO_V2.slice(0, 4),
    doc: DOC_V1,
    planVersions: [{ v: 'v1', at: r8(23, 44) }],
    revision: {
      feedback: REJECT_FEEDBACK,
      streaming: { seconds: 1, label: '处理中...' },
      landed: {
        planVersions: [
          { v: 'v2', at: r8(23, 45) },
          { v: 'v1', at: r8(23, 44) },
        ],
        doc: DOC_V2,
        transcriptTail: [
          ADJUST_V2_MESSAGE,
          {
            kind: 'plan',
            title: '方案 · v2',
            preview: R8_PLAN_PREVIEW,
            seconds: 29,
            chevron: true,
          },
        ],
        planDiff: planDiff('v1', 'v2', LINES_V1, LINES_V2, false),
      },
    },
  },
};

/** r8 57/77 run-history rows (upstream #68 shape): the failed current row
 *  carries the 当前 chip and the state-gated 重跑 button (r8 §3.3). */
const RUNS_12: RunHistoryRow[] = [
  {
    label: '第 1 次运行',
    meta: '6 小时前 · 72.1k tokens · Machine offline',
    status: 'failed-current',
  },
];

const RUNS_15: RunHistoryRow[] = [
  { label: '第 2 次运行', meta: '刚刚', status: 'current' },
  {
    label: '第 1 次运行',
    meta: '22 分钟前 · 435.5k tokens · Machine offline',
    status: 'failed',
  },
];

/** [推断] token/branch payloads for the r8 todos — the r8 captures only
 *  exercised the history face; no parity row rides these values. */
const R8_OVERLAY_TOKEN: TokenUsageContent = {
  total: '72.1k',
  model: 'r3-gw/claude-sonnet-5',
  modelTotal: '72.1k',
  input: '12',
  output: '980',
  cacheRead: '49.7k',
  cacheWrite: '25.4k',
};
const R8_OVERLAY_BRANCH: BranchInfoContent = {
  branch: conversationBranch('r8-12'),
  commit: '386b8e4af054',
  machine: MACHINE_NAME,
  directory: `~/${BRAND.homeDirName}/workspaces/r8-12`,
};

export function r8OverlayContent(todoId: string): BuildOverlayContent | null {
  if (todoId === 'r8-12')
    return { token: R8_OVERLAY_TOKEN, branch: R8_OVERLAY_BRANCH, runs: RUNS_12 };
  if (todoId === 'r8-15')
    return {
      token: R8_OVERLAY_TOKEN,
      branch: { ...R8_OVERLAY_BRANCH, branch: conversationBranch('r8-15') },
      runs: RUNS_15,
    };
  return null;
}
