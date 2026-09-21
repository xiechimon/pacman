// Fixture data — content copied verbatim from the r7 capture session
// (docs/research/r7-rebaseline.md §5): probe #9, r3 legacy #1/#2, project
// and team identifiers, branch strings, 13:21/13:35 timestamps. The #1/#2
// titles were extracted from captures 01/01b by glyph template matching
// (parity/match-text.mjs) in #54; all other strings come from the research
// records.

import type { FixtureSet, TodoRecord } from './records.js';

export const TEAM_ID = 'BoZYfvqKSGanlxsXVbXSa';
export const TEAM_NAME = "Xmon Dai's team";
export const PROJECT_ID = 'ZAQczKCu0MOAzC1ZqcFlX';
export const PROJECT_NAME = 'r3-lifecycle';
/** Sidebar/card project avatar initial (r2 §1.1 首字母头像). */
export const PROJECT_INITIAL = 'r';
export const USER_NAME = 'Xmon Dai';
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

/** Detail page content for a single todo. */
export function detailFor(phase: TodoRecord['phase'], phaseAt: number, now: number): FixtureSet {
  return { todos: [probeTodo(phase, phaseAt)], now };
}
