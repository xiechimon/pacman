// Scenario mechanism (issue #52): `?scenario=<r7编号>` query parameter
// selects a deterministic fixture set, one id per r7 capture so parity
// matrix rows never drift in content. Route behaviour never branches on
// the parameter — it only picks data inside the fixture layer, which is
// the app's whole data source in this fixture-driven phase (the parity
// harness runs against the production build). Once a real API replaces
// the fixture loader, this param becomes dev/test-only.
// Unknown or absent ids fall back to the default board set.

import { boardDarkFresh, boardDefault, boardWithProbe, detailFor, r7 } from './fixtures.js';
import type { FixtureSet } from './records.js';

export const SCENARIO_PARAM = 'scenario';

/** r7 capture number → fixture set. Board rows bind board scenarios,
 *  detail rows bind single-todo detail scenarios. `now` inside each set
 *  is the capture instant (keeps relative labels deterministic). */
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
  // detail (r7 16–17, 23, 26–27, 36, 38)
  '16': detailFor('planning', r7(13, 23), r7(13, 24)),
  '16d': detailFor('planning', r7(13, 23), r7(13, 24)),
  '17': detailFor('confirm', r7(13, 26), r7(13, 28)),
  '17b': detailFor('confirm', r7(13, 26), r7(13, 28)),
  '17d': detailFor('confirm', r7(13, 26), r7(13, 28)),
  '23': detailFor('todo', r7(13, 21), r7(13, 22)),
  '23d': detailFor('todo', r7(13, 21), r7(13, 22)),
  '26': detailFor('building', r7(13, 35), r7(13, 36)),
  '26d': detailFor('building', r7(13, 35), r7(13, 36)),
  '27': detailFor('review', r7(13, 37), r7(13, 40)),
  '27d': detailFor('review', r7(13, 37), r7(13, 40)),
  '36': detailFor('done', r7(13, 52), r7(13, 55)),
  '36d': detailFor('done', r7(13, 52), r7(13, 55)),
  '38': boardDefault,
};

/** Resolve the scenario for a URL. Signature takes URLSearchParams so
 *  callers can pass through without coupling to window.location. */
export function resolveScenario(search: URLSearchParams): FixtureSet {
  const id = search.get(SCENARIO_PARAM);
  return (id != null ? SCENARIOS[id] : undefined) ?? boardDefault;
}
