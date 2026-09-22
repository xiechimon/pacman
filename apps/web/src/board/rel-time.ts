// Relative time labels (r2/r5b/r7 observed strings only:
// 刚刚 / N 分钟前 / N 小时前 / 昨天 / N 天前). Thresholds beyond the
// observed pairs are [推断]: minute/hour buckets are time-based, the
// day bucket counts calendar days in the capture timezone (+08:00) so
// the fixture scenarios stay deterministic across runner locales.
// Observed anchors: 9 min → `9 分钟前` (r7 02), 46 h across two calendar
// days → `2 天前` (r7 01), 33 h within adjacent days → `昨天` (r5b 10).
// #74: labels are dict templates — zh (no t passed) renders byte-identical
// to the canon above; en rides the dict fallback ([设计] compact forms).

import type { TFunc } from '../i18n/translate.js';
import { translate } from '../i18n/translate.js';

/** zh-identity t for callers outside React (tests, formatters). */
const zhT: TFunc = (source, vars) => translate('zh', {}, source, vars);

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
/** Offset of the capture timezone (+08:00) — day buckets are computed in it. */
const TZ_OFFSET = 8 * HOUR;

function dayIndex(ts: number): number {
  return Math.floor((ts + TZ_OFFSET) / DAY);
}

export function relativeTime(ts: number, now: number, t: TFunc = zhT): string {
  const diff = now - ts;
  if (diff < MINUTE) return t('刚刚');
  const minutes = Math.floor(diff / MINUTE);
  if (minutes < 60) return t('{n} 分钟前', { n: minutes });
  const days = dayIndex(now) - dayIndex(ts);
  if (days <= 0) {
    const hours = Math.floor(diff / HOUR);
    return t('{n} 小时前', { n: hours });
  }
  if (days === 1) return t('昨天');
  return t('{n} 天前', { n: days });
}
