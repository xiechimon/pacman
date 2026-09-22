// Fixture data — content copied verbatim from the r7 capture session
// (docs/research/r7-rebaseline.md §5): probe #9, r3 legacy #1/#2, project
// and team identifiers, branch strings, 13:21/13:35 timestamps. The #1/#2
// titles were extracted from captures 01/01b by glyph template matching
// (parity/match-text.mjs) in #54; all other strings come from the research
// records.

import type {
  ChangesContent,
  DocBlock,
  FixtureSet,
  TodoRecord,
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
export const R7_BUILD_BRANCH = `tds/conv-${R7_BUILD_ID}`;

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

/** Client-created todo of the fixture phase (#66 new-task dialog): lands
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
 *  probe existed, ~13:10–13:21. */
export const boardDefault: FixtureSet = { todos: [legacyReview, legacyDone], now: r7(13, 14) };

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
};

/** The two tool calls of the execution round (r7 28 expanded form:
 *  `edit README.md` + the verification `bash …` pill). The bash label is
 *  also the 26d streaming row's 调用工具 text — the capture runs it to
 *  the chat edge with an ellipsis. */
const PROBE_TOOL_PILLS = [
  'edit README.md',
  'bash cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" && tail -n 3 README.md && echo …',
];

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
  },
  { kind: 'elapsed', seconds: 17 },
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
  },
  { kind: 'elapsed', seconds: 32 },
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
          label: `调用工具：${PROBE_TOOL_PILLS[1]}`,
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

/* ---- r8 overlay batch (#66): dark captures 54–57, shot 2026-09-22
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

/** Probe #16 transcript at confirm (r8 56): stamp, start bubble with the
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

/** r8 54: board at 23:41 — #15 planning (streaming card behind the
 *  dialog), #12 failed with 重试, the legacy pair in 待验收/已完成 plus
 *  the dynamic ticket's done leftovers. */
export const boardR8Overlay: FixtureSet = {
  todos: [dyn15('planning'), dyn12Failed, legacyReview, ...R8_LEFTOVERS, legacyDone],
  now: r8(23, 44),
};

/** r8 57: probe #16 fresh detail at 23:43 (#15 already confirm → badge 3). */
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
};

/** r8 58: probe #17 (created 2026-09-23 00:34, deleted 00:36 — zero
 *  residue), fresh detail under the delete confirm. Badge 2 in the
 *  capture → #15 already out of confirm by then; the fresh surface keeps
 *  this pair clear of the doc-pane/taskline drift the 55/56 pairs hit. */
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
};

/** r8 56/55: probe #16 confirm detail at 23:44 (badge 4), the surface the
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
    detail: { transcript: R8_CONFIRM_TRANSCRIPT, doc: R8_PLAN_DOC },
  };
}
