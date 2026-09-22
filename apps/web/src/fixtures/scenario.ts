// Scenario mechanism (issue #52): `?scenario=<r7编号>` query parameter
// selects a deterministic fixture set, one id per r7 capture so parity
// matrix rows never drift in content. Route behaviour never branches on
// the parameter — it only picks data inside the fixture layer, which is
// the app's whole data source in this fixture-driven phase.
// #58 gate: the parameter is dev/test-only — honoured by `vite dev`
// (import.meta.env.DEV) and by the parity harness's `vite build --mode
// parity`; a plain production build ignores it and always serves the
// default board set, so the param can never leak into shipped behaviour.
// Unknown or absent ids fall back to the default board set.

import {
  boardChiefProbes,
  boardDarkFresh,
  boardDefault,
  boardWithProbe,
  detailBuilding,
  detailConfirm,
  detailDone,
  detailFresh,
  detailFreshDark,
  detailLegacy,
  detailPlanning,
  detailReview,
  r7,
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
