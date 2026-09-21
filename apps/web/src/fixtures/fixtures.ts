// Fixture data — content copied verbatim from the r7 capture session
// (docs/research/r7-rebaseline.md §5): probe #9, r3 legacy #1/#2, project
// and team identifiers, branch strings, 13:21/13:35 timestamps. The #1/#2
// titles were extracted from captures 01/01b by glyph template matching
// (parity/match-text.mjs) in #54; all other strings come from the research
// records.

import type { DetailContent, DocBlock, FixtureSet, TodoRecord, TranscriptItem } from './records.js';

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
      { text: 'tail -n 3 README.md', code: true },
      {
        text: ' 确认最后一行为 "r7 rebaseline probe",且原有的 "r6 rebaseline probe" 一行保留在其上一行。',
      },
    ],
  },
  {
    kind: 'bullet',
    segments: [
      { text: '执行 ' },
      { text: 'git diff README.md', code: true },
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
    text: '任务简单明确:在 README.md 末尾追加一行新文本,文件已有末尾换行行,直接追加即可。',
  },
  {
    kind: 'plan',
    title: '方案 · v1',
    preview:
      'Context: 仓库根目录的 README.md 当前末尾一行为 "r6 rebaseline probe"(文件以换行符结尾)。需求是在文件末尾追加新的一行 "r7 rebaseline probe"。  Changes: README.md:在文件末尾追加一行新内容 "r7 rebaseline probe",保持与现有行一致的格式(纯文本行,行尾换行符),不改动文件中已有的其他内容。',
    seconds: 21,
  },
];

/** Detail page content for a single todo. */
export function detailFor(
  phase: TodoRecord['phase'],
  phaseAt: number,
  now: number,
  detail?: DetailContent,
): FixtureSet {
  return { todos: [probeTodo(phase, phaseAt)], now, detail };
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
