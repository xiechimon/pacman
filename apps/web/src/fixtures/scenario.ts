// Scenario mechanism (issue #52): `?scenario=<研究截图编号>` query parameter
// selects a deterministic fixture set, one id per research capture so parity
// matrix rows never drift in content — r7 numbers for the board/detail
// rows, r5 numbers for the chief rows (#72; the chief surfaces have no r7
// shot). Route behaviour never branches on the parameter — it only picks
// data inside the fixture layer, which is the app's whole data source in
// this fixture-driven phase.
// #58 gate: the parameter is dev/test-only — honoured by `vite dev`
// (import.meta.env.DEV) and by the parity harness's `vite build --mode
// parity`; a plain production build ignores it and always serves the
// default board set, so the param can never leak into shipped behaviour.
// Unknown or absent ids fall back to the default board set.

import {
  apiKeysCreated,
  boardDarkFresh,
  boardDefault,
  boardWithProbe,
  chiefGated,
  chiefReady,
  chiefSettings,
  chiefThread,
  chiefThreadsOpen,
  detailBuilding,
  detailConfirm,
  detailDone,
  detailFresh,
  detailFreshDark,
  detailLegacy,
  detailPlanning,
  detailReview,
  projectFixture,
  projectTasks,
  projectTasksEmpty,
  r7,
  schedulesEmpty,
  schedulesFormDaily,
  schedulesFormOnce,
  schedulesList,
  teamGrid,
} from './fixtures.js';
import type { FixtureSet } from './records.js';

export const SCENARIO_PARAM = 'scenario';

/** r7 capture number → fixture set. Board rows bind board scenarios,
 *  detail rows bind single-todo detail scenarios. `now` inside each set
 *  is the capture instant (keeps relative labels deterministic).
 *  Detail ids follow the r7 manifest filenames: 16d is the dark confirm
 *  capture with the user-menu popover, 17/17d/17b the confirm surface
 *  with/without it. */
export const SCENARIOS: Record<string, FixtureSet> = {
  // board (r7 01–03, 21–22, 33, 35)
  '01': boardDefault,
  '01b': boardDefault,
  '02': boardWithProbe('confirm', r7(13, 26), r7(13, 35)),
  '02b': boardWithProbe('confirm', r7(13, 26), r7(13, 35)),
  '03': boardDefault,
  '21': boardWithProbe('confirm', r7(13, 26), r7(13, 35)),
  // 22: capture shows `刚刚` (21px ink) — now must sit under a minute past
  // phaseAt, so pin the same whole minute (13:22 would hit the exact
  // 60s boundary and render `1 分钟前`).
  '22': boardWithProbe('todo', r7(13, 21), r7(13, 21)),
  '22d': boardDarkFresh,
  '33': boardWithProbe('review', r7(13, 37), r7(13, 45)),
  '35': boardWithProbe('done', r7(13, 52), r7(13, 55)),
  '35d': boardWithProbe('done', r7(13, 52), r7(13, 55)),
  // detail (r7 16–17, 23, 26–28, 36, 38)
  '16': detailPlanning,
  '16d': detailConfirm(true),
  '17': detailConfirm(true),
  '17b': detailConfirm(false),
  '17d': detailConfirm(false),
  '23': detailFresh,
  '23d': detailFreshDark,
  // 26: light froze at 处理中...; 26d (dark) caught the later bash tool
  // row and has the user menu open
  '26': detailBuilding(false),
  '26d': detailBuilding(true),
  // 27d (dark) carries the user-menu popover; 27 light does not
  '27': detailReview({ userMenuOpen: false }),
  '27d': detailReview({ userMenuOpen: true }),
  '27b': detailReview({ userMenuOpen: false, changesExpanded: true }),
  '28': detailReview({ userMenuOpen: false, changesExpanded: true, toolsExpanded: true }),
  '36': detailDone(),
  '36d': detailDone(),
  '38': detailLegacy,
  // schedules (issue #71): 11 = the r7 empty-state capture; the list and
  // form states come from r3 93/92/92b, so their ids carry the source
  '11': schedulesEmpty,
  'r3-93': schedulesList,
  'r3-92': schedulesFormDaily,
  'r3-92b': schedulesFormOnce,
  // project routes (issue #71): one content set, the route + tab pick the
  // surface; the ids name the r2 capture each row binds to. prj-tasks =
  // the populated 任务 list, which r2 only ever shows beside the open todo
  // panel (26), so it carries no clean capture number of its own
  'r2-07': projectFixture,
  'r2-24': projectFixture,
  'r2-24b': projectTasksEmpty,
  'prj-tasks': projectTasks,
  'r2-24c': projectFixture,
  // secondary routes (issue #70): 12/13 are the r7 team/account captures;
  // the api-keys/feedback ids have no r7 capture (smoke matrix rows) and
  // pick their surface by name — the account/feedback pages render no
  // fixture content at all, so they ride the default set
  '12': teamGrid,
  '13': boardDefault,
  'api-keys': boardDefault,
  'api-keys-created': apiKeysCreated,
  feedback: boardDefault,
  // chief (issue #72): ids follow the r5 capture numbers — the chief
  // surfaces have no r7 shot (r7 §6 gap table), so r5 100–116 number these
  // rows. Dark rows reuse the same ids with theme: 'dark' in the matrix.
  '100': chiefGated,
  '101': chiefSettings('agent'),
  '102': chiefSettings('charter'),
  '103': chiefSettings('memory'),
  '104': chiefSettings('watches'),
  '111': chiefReady,
  '114': chiefThread,
  '116': chiefThreadsOpen,
};

/** #58 gate: scenario selection exists only in dev (`vite dev`) and in the
 *  parity harness build (`vite build --mode parity`, parity/run.mjs). A
 *  plain production build folds this to false at compile time. */
const SCENARIOS_ENABLED = import.meta.env.DEV || import.meta.env.MODE === 'parity';

/** Resolve the scenario for a URL. Signature takes URLSearchParams so
 *  callers can pass through without coupling to window.location. */
export function resolveScenario(search: URLSearchParams): FixtureSet {
  if (!SCENARIOS_ENABLED) return boardDefault;
  const id = search.get(SCENARIO_PARAM);
  return (id != null ? SCENARIOS[id] : undefined) ?? boardDefault;
}
