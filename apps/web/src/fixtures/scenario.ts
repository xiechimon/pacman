// Scenario mechanism (issue #52): `?scenario=<r7编号>` query parameter
// selects a deterministic fixture set, one id per r7 capture so parity
// matrix rows never drift in content. Route behaviour never branches on
// the parameter — it only picks data inside the fixture layer, which is
// the app's whole data source in this fixture-driven phase (the parity
// harness runs against the production build). Once a real API replaces
// the fixture loader, this param becomes dev/test-only.
// Unknown or absent ids fall back to the default board set.

import { at, boardDefault, boardWithProbe, detailFor } from './fixtures.js';
import type { FixtureSet } from './records.js';

export const SCENARIO_PARAM = 'scenario';

/** r7 capture number → fixture set. Board rows bind board scenarios,
 *  detail rows bind single-todo detail scenarios. */
export const SCENARIOS: Record<string, FixtureSet> = {
  // board (r7 01–03, 21–22, 33, 35)
  '01': boardDefault,
  '01b': boardDefault,
  '02': boardWithProbe('confirm', at(13, 26)),
  '02b': boardWithProbe('confirm', at(13, 26)),
  '03': boardDefault,
  '21': boardWithProbe('confirm', at(13, 26)),
  '22': boardWithProbe('todo', at(13, 21)),
  '22d': boardWithProbe('todo', at(13, 21)),
  '33': boardWithProbe('review', at(13, 37)),
  '35': boardDefault,
  '35d': boardDefault,
  // detail (r7 16–17, 23, 26–27, 36, 38)
  '16': detailFor('planning', at(13, 23)),
  '16d': detailFor('planning', at(13, 23)),
  '17': detailFor('confirm', at(13, 26)),
  '17b': detailFor('confirm', at(13, 26)),
  '17d': detailFor('confirm', at(13, 26)),
  '23': detailFor('todo', at(13, 21)),
  '23d': detailFor('todo', at(13, 21)),
  '26': detailFor('building', at(13, 35)),
  '26d': detailFor('building', at(13, 35)),
  '27': detailFor('review', at(13, 37)),
  '27d': detailFor('review', at(13, 37)),
  '36': detailFor('done', at(13, 52)),
  '36d': detailFor('done', at(13, 52)),
  '38': boardDefault,
};

/** Resolve the scenario for a URL. Signature takes URLSearchParams so
 *  callers can pass through without coupling to window.location. */
export function resolveScenario(search: URLSearchParams): FixtureSet {
  const id = search.get(SCENARIO_PARAM);
  return (id != null ? SCENARIOS[id] : undefined) ?? boardDefault;
}
