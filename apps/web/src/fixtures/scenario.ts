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
  boardChiefProbes,
  boardDarkFresh,
  boardDefault,
  boardFailed,
  boardProjectPicker,
  boardR8Overlay,
  boardWithProbe,
  chiefGated,
  chiefReady,
  chiefSettings,
  chiefThread,
  chiefThreadsOpen,
  compareMenuV2,
  detailBuilding,
  detailConfirm,
  detailDone,
  detailFailed12,
  detailFailed15Set,
  detailFailedCurrent,
  detailFresh,
  detailFreshDark,
  detailLegacy,
  detailLegacyNow,
  detailPlanning,
  detailR8Confirm,
  detailR8DeleteFresh,
  detailR8Fresh,
  detailReview,
  detailV3Collapsed,
  diffV1V2,
  diffV2V3,
  history12,
  history15,
  projectFixture,
  projectTasks,
  projectTasksEmpty,
  r7,
  rerunDialog12,
  rerunDialog15,
  resourcesDefault,
  resourcesImport,
  reusedBuilding,
  reusePanel15,
  revisionChain,
  revisionStreaming,
  schedulesEmpty,
  schedulesFormDaily,
  schedulesFormOnce,
  schedulesList,
  teamGrid,
  versionMenuV2,
  versionMenuV3,
} from './fixtures.js';
import type { FixtureSet } from './records.js';

export const SCENARIO_PARAM = 'scenario';

/** #58 gate: scenario selection exists only in dev (`vite dev`) and in the
 *  parity harness build (`vite build --mode parity`, parity/run.mjs). A
 *  plain production build folds this to false at compile time. */
const SCENARIOS_ENABLED = import.meta.env.DEV || import.meta.env.MODE === 'parity';

/** r7 capture number → fixture set. Board rows bind board scenarios,
 *  detail rows bind single-todo detail scenarios, resource rows (06–10)
 *  bind the shared resources set. `now` inside each set
 *  is the capture instant (keeps relative labels deterministic).
 *  Detail ids follow the r7 manifest filenames: 16d is the dark confirm
 *  capture with the user-menu popover, 17/17d/17b the confirm surface
 *  with/without it. */
/** W4 #289：scenario 集合构造收进启用门——生产构建折叠为 `{}`（#58 gate
 * 的补全：原顶层字面量在各 scenario 工厂即调即构，DCE 视作可达副作用，
 * 79KB 语料随主包出街）。dev/parity 两形照常构造。 */
export const SCENARIOS: Record<string, FixtureSet> = SCENARIOS_ENABLED
  ? ({
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
      // notification permission banner (issue #114): the r2 01/28/30 board
      // state — r7 baselines carry no banner, so the strip gets a named id
      // and rides smoke rows (04 §2: no-baseline rows self-compare)
      'notify-banner': { ...boardDefault, ui: { notificationBanner: true } },
      // #176 new-task dialog 项目选择器:命名场景(无 capture)——boardDefault
      // 面加 projectNames 双项目,e2e 钉选择器行为;无 parity 行。
      'newtask-projects': boardProjectPicker,
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
      // overlay open states (issue #68): 30/31/32 sit on the review surface
      // with diff + tool rows expanded, exactly as the captures froze them
      '30': {
        ...detailReview({ userMenuOpen: false, changesExpanded: true, toolsExpanded: true }),
        overlay: { kind: 'token' },
      },
      '31': {
        ...detailReview({ userMenuOpen: false, changesExpanded: true, toolsExpanded: true }),
        overlay: { kind: 'branch' },
      },
      // r8 57: history dialog over the failed-current run (footer 重跑 surface)
      '57f': { ...detailFailedCurrent(), overlay: { kind: 'history' } },
      '32': {
        ...detailReview({ userMenuOpen: false, changesExpanded: true, toolsExpanded: true }),
        overlay: { kind: 'history' },
      },
      // 34: board scrollRight, probe #9 in 待验收 (`4 分钟前` → now 13:41)
      '34': { ...boardWithProbe('review', r7(13, 37), r7(13, 41)), overlay: { kind: 'accept' } },
      // dark overlay pairs (r8 78–81): probe #9 is gone from the live account,
      // so the dark captures ride the r3 legacy #1 surface as it stands now
      // (re-run 2026-09-22 18:30); the accept dialog opens from the header
      // 完成 button on the same detail surface
      '30d': detailLegacyNow('token'),
      '31d': detailLegacyNow('branch'),
      '32d': detailLegacyNow('history'),
      '34d': detailLegacyNow('accept'),
      // overlays (issue #67): frozen open-states on top of the surface each
      // r7 capture sits on — 05 the empty ⌘K panel over the default board,
      // 05b the results state over the #46-session board, 19/29 the chip
      // popover on the confirm/review split, 20 the 方案▾ dropdown.
      '05': { ...boardDefault, ui: { searchOpen: true } },
      '05b': {
        ...boardChiefProbes,
        ui: { searchOpen: true, searchQuery: 'r3 lifecycle probe' },
      },
      '19': { ...detailConfirm(false), ui: { chipPopoverOpen: true } },
      '20': { ...detailConfirm(false), ui: { planDropdownOpen: true } },
      '29': { ...detailReview({ userMenuOpen: false }), ui: { chipPopoverOpen: true } },
      // schedules (issue #71): 11 = the r7 empty-state capture; the list and
      // form states come from r3 93/92/92b, so their ids carry the source
      '11': schedulesEmpty,
      'r3-93': schedulesList,
      'r3-92': schedulesFormDaily,
      'r3-92b': schedulesFormOnce,
      // r8 dynamic states (issue #75): ids = the r8 capture numbers. 54/73
      // are the two failed-detail subjects, 55 the failed board card, 56/74
      // the rerun dialog without/with 复用方案, 57/77 the run-history open
      // states, 63–72 the reject loop (dropdown / compare submenu / diff
      // surfaces / replan streaming), 75 the reuse sub-panel, 76 the reused
      // build. 68 and 69 are the same surface (r8 pixel-audit note).
      '54': detailFailed12,
      '55': boardFailed,
      '56': rerunDialog12,
      '57': history12,
      '63': versionMenuV2,
      '64': compareMenuV2,
      '65': diffV1V2(false),
      '66': diffV1V2(true),
      '67': revisionStreaming,
      '68': detailV3Collapsed,
      '69': detailV3Collapsed,
      '70': versionMenuV3,
      '71': diffV2V3(false),
      '72': diffV2V3(true),
      '73': detailFailed15Set,
      '74': rerunDialog15,
      '75': reusePanel15,
      '76': reusedBuilding,
      '77': history15,
      // interactive reject chain (AC3): confirm v1 + revision script
      chain: revisionChain,
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
      // the api-keys id has no r7 capture (smoke matrix rows) and picks its
      // surface by name — the account page renders no fixture content at all,
      // so it rides the default set
      '12': teamGrid,
      '13': boardDefault,
      // account 语言 dropdown open state (issue #74; shape [设计], r2 §11 Q19)
      '13-lang': { ...boardDefault, ui: { langDropdownOpen: true } },
      'api-keys': boardDefault,
      'api-keys-created': apiKeysCreated,
      // resources (r7 06–10, issue #69): one shared row set — the captures
      // differ per route, not per content state
      '06': resourcesDefault,
      '07': resourcesDefault,
      '08': resourcesDefault,
      '09': resourcesDefault,
      '10': resourcesDefault,
      // 新建技能 (r8 78/79, captured with this ticket): tab per scenario
      '79': resourcesImport('folder'),
      '80': resourcesImport('github'),
      // r8 overlay batch (#66): the dark capture set; ids carry the r8 batch
      // prefix like the r2/r3 rows (numbering continues after #64's 54–77)
      'r8-78': boardR8Overlay,
      'r8-79': detailR8Confirm(),
      'r8-80': detailR8Confirm(),
      'r8-81': detailR8Fresh,
      'r8-82': detailR8DeleteFresh,
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
    } as Record<string, FixtureSet>)
  : {};

/** Resolve the scenario for a URL. Signature takes URLSearchParams so
 *  callers can pass through without coupling to window.location. */
export function resolveScenario(search: URLSearchParams): FixtureSet {
  if (!SCENARIOS_ENABLED) return boardDefault;
  const id = search.get(SCENARIO_PARAM);
  return (id != null ? SCENARIOS[id] : undefined) ?? boardDefault;
}
