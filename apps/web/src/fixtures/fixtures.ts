// Fixture data — content copied verbatim from the r7 capture session
// (docs/research/r7-rebaseline.md §5): probe #9, r3 legacy #1/#2, project
// and team identifiers, branch strings, 13:21/13:35 timestamps.

import type { FixtureSet, TodoRecord } from './records.js';

export const TEAM_ID = 'BoZYfvqKSGanlxsXVbXSa';
export const TEAM_NAME = "Xmon Dai's team";
export const PROJECT_ID = 'ZAQczKCu0MOAzC1ZqcFlX';
export const PROJECT_NAME = 'r3-lifecycle';
export const MACHINE_NAME = 'xmonsMac-3574.local';
export const MACHINE_ID = 'TlZ2sSD4EJCxjNJqVhdo_';
export const R7_BUILD_ID = '01a0c26e-23ea-734f-9847-cf9cdbce7802';
export const R7_BUILD_BRANCH = `tds/conv-${R7_BUILD_ID}`;

/** r7 capture-day timestamp: 2026-09-21, +08:00, whole minutes. */
export const at = (h: number, m: number) =>
  Date.parse(`2026-09-21T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+08:00`);

const R3_BUILDER = { id: 'r3-builder', displayName: 'r3-builder' };

// r3 legacy #1/#2 titles are pixel placeholders until #54 extracts the
// verbatim strings from captures 01/01b; all identifiers, times and the
// probe strings below are verbatim from r7.
const legacyReview: TodoRecord = {
  id: 'r3-legacy-1',
  teamId: TEAM_ID,
  projectId: PROJECT_ID,
  title: '执行 Agent 完成后任务卡片形态验证',
  spec: '验证任务执行完成后看板卡片与详情页形态。',
  phase: 'review',
  phaseAt: at(11, 42),
  seqNum: 1,
  orderIndex: 0,
  tagIds: [],
  assignment: { agentId: R3_BUILDER.id },
  agent: R3_BUILDER,
  latestBuildId: 'r3-conv-legacy-1',
  lastRunAt: at(11, 42),
  hasChanges: true,
  hasPlan: true,
  buildHistory: [{ buildId: 'r3-conv-legacy-1', createdAt: at(11, 30) }],
  sourceTodo: null,
  v: 3,
};

/** r3 legacy #2: done (r7 01/02 last column). */
const legacyDone: TodoRecord = {
  id: 'r3-legacy-2',
  teamId: TEAM_ID,
  projectId: PROJECT_ID,
  title: '生命周期全链路探针任务',
  spec: '跑通 todo → done 生命周期全链路。',
  phase: 'done',
  phaseAt: at(12, 5),
  seqNum: 2,
  orderIndex: 0,
  tagIds: [],
  assignment: { agentId: R3_BUILDER.id },
  agent: R3_BUILDER,
  latestBuildId: 'r3-conv-legacy-2',
  lastRunAt: at(11, 50),
  hasChanges: false,
  hasPlan: true,
  buildHistory: [{ buildId: 'r3-conv-legacy-2', createdAt: at(11, 48) }],
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
    lastRunAt: phase === 'todo' ? null : at(13, 21),
    hasChanges: phase === 'review' || phase === 'done',
    hasPlan: phase !== 'todo',
    buildHistory: phase === 'todo' ? [] : [{ buildId: R7_BUILD_ID, createdAt: at(13, 21) }],
    sourceTodo: null,
    v: 2,
  };
}

/** Board default: only the r3 legacy pair (r7 01/35). */
export const boardDefault: FixtureSet = { todos: [legacyReview, legacyDone] };

/** Board with the probe in the given phase (r7 02/22/21/33 …). */
export function boardWithProbe(phase: TodoRecord['phase'], phaseAt: number): FixtureSet {
  return { todos: [legacyReview, legacyDone, probeTodo(phase, phaseAt)] };
}

/** Detail page content for a single todo. */
export function detailFor(phase: TodoRecord['phase'], phaseAt: number): FixtureSet {
  return { todos: [probeTodo(phase, phaseAt)] };
}
