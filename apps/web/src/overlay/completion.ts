// Inline completion primitive (issue #728, canon = #727 §1, Claude Code
// v2.1.285 bundle: trigger regex `wCt`, preceding-char class `kCt`, fuzzy
// index `CBt`, cap `CN=15`).
//
// Reusable by design: the `@` mention completion (this ticket) and the `/`
// slash-command completion (#731) share the trigger detection, the keyboard
// intent mapping and the highlight cycle; only the trigger spec and the
// matcher differ (`@` = fuzzy subsequence per rule 15, `/` = separator-word
// prefix per rules 48-49 — #731 brings its own filter, this module brings
// the machinery).
//
// Scope = pure functions only. React wiring (open state, refs, listeners)
// lives in composer-wire.ts; the listbox skin in mention-picker.tsx.
//
// Comments near the regex constants are deliberately English: the
// i18n-coverage TS scanner misreads backtick/CJK mixes around regex bodies
// (#678/#710 precedent).

/** Trigger configuration for one completion family. */
export interface CompletionTriggerSpec {
  /** Character that opens the token, e.g. '@' or '/'. */
  trigger: string;
  /** Regex character-class SOURCE (no brackets) for characters that may
   *  follow the trigger while the token stays open. CC rule 5: any char
   *  outside this set ends the token and closes the popup. */
  tokenClass: string;
  /** Regex character-class SOURCE (no brackets) accepted immediately before
   *  the trigger. Default = whitespace + CJK punctuation (CC `kCt`,
   *  rules 1-3: start of input, whitespace, or one of the four CJK marks).
   *  A mid-word trigger (`foo@`, `a@b.com`) never matches. */
  boundaryClass?: string;
}

/** The active token under the caret. `start` is the offset of the trigger
 *  char, `end` is the caret offset the detection ran against, `query` is
 *  the text between them (may be empty for a bare trigger). */
export interface CompletionRange {
  start: number;
  end: number;
  query: string;
}

/** CC `kCt` verbatim: whitespace plus the four CJK punctuation marks. */
const DEFAULT_BOUNDARY_CLASS = '\\s。、？！';

const COMPILED = new WeakMap<CompletionTriggerSpec, RegExp>();

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function specRegex(spec: CompletionTriggerSpec): RegExp {
  let re = COMPILED.get(spec);
  if (re === undefined) {
    const boundary = spec.boundaryClass ?? DEFAULT_BOUNDARY_CLASS;
    // CC `wCt` shape: (^|[boundary])<trigger>(<tokenClass>*)$ anchored at
    // the caret — the quoted-mention alternative is file-path specific and
    // intentionally not ported (#727 @1: path-only rules stay out).
    re = new RegExp(
      `(^|[${boundary}])${escapeForRegex(spec.trigger)}([${spec.tokenClass}]*)$`,
      'u',
    );
    COMPILED.set(spec, re);
  }
  return re;
}

/** Detect the completion token ending at `caret`. Returns null when the
 *  caret does not sit at the end of a trigger token (never triggered,
 *  mid-word trigger, caret moved away, or a char outside the token class
 *  ended it). Pure re-evaluation — callers run it on every change AND on
 *  selection-only moves (CC has no caret-without-edit case; the web face
 *  must re-judge, ticket failure mode 3). */
export function detectCompletionToken(
  value: string,
  caret: number,
  spec: CompletionTriggerSpec,
): CompletionRange | null {
  if (caret <= 0 || caret > value.length) return null;
  const match = specRegex(spec).exec(value.slice(0, caret));
  if (match === null) return null;
  const query = match[2] ?? '';
  return { start: caret - query.length - 1, end: caret, query };
}

/** `@` mention trigger spec. Token class = CC `wCt` group 2 verbatim
 *  (letters/numbers/marks plus the path punctuation set). */
export const MENTION_COMPLETION_SPEC: CompletionTriggerSpec = {
  trigger: '@',
  tokenClass: '\\p{L}\\p{N}\\p{M}_\\-./\\\\()[\\]~:',
};

/** CC `CN=15`: at most 15 rows in the popup (rules 8 + 14). */
export const COMPLETION_CAP = 15;

/** CC `Zr()` separator set: a match right after one of these (or at index
 *  0) scores the boundary bonus `Qr=8`. */
const SEPARATORS = new Set(['/', '\\', '-', '_', '.', ' ']);

/** Run-continuation bonus (deterministic pick, keeps contiguous matches
 *  ahead of scattered ones; smaller than the separator bonus by design —
 *  see completion.test.ts magnitude pin). */
const RUN_BONUS = 2;
/** CC `Qr=8` boundary bonus. */
const SEPARATOR_BONUS = 8;
/** CC `Gu=6` camelCase-boundary bonus. */
const CAMEL_BONUS = 6;

function isCamelBoundary(raw: string, idx: number): boolean {
  if (idx <= 0) return false;
  const prev = raw[idx - 1] ?? '';
  const cur = raw[idx] ?? '';
  return prev === prev.toLowerCase() && prev !== prev.toUpperCase() && cur === cur.toUpperCase();
}

/** Greedy leftmost subsequence scan (CC `CBt.search` is a per-char indexOf
 *  walk with a bitmask prefilter; at listbox scale the plain walk is the
 *  same result). Returns the score, or null when the query is not a
 *  subsequence of the folded label. */
function subsequenceScore(query: string, folded: string, raw: string): number | null {
  let score = 0;
  let from = 0;
  let prevIdx = -2;
  for (let i = 0; i < query.length; i += 1) {
    const idx = folded.indexOf(query[i] ?? '', from);
    if (idx === -1) return null;
    score += 1;
    if (idx === 0 || SEPARATORS.has(raw[idx - 1] ?? '')) score += SEPARATOR_BONUS;
    else if (isCamelBoundary(raw, idx)) score += CAMEL_BONUS;
    if (idx === prevIdx + 1) score += RUN_BONUS;
    prevIdx = idx;
    from = idx + 1;
  }
  return score;
}

/** Fuzzy filter for the `@` family (CC rules 14-18): subsequence match,
 *  smart case (all-lowercase query = case-insensitive, any uppercase =
 *  case-sensitive), separator/camelCase boundary bonus scoring, stable
 *  best-first sort (ties keep roster order), capped at `cap` rows.
 *  Empty query = no filtering, caller order, still capped (rule 8).
 *  NOT used by `/` (#731 rules 48-49 need a word-prefix matcher). */
export function fuzzyFilter<T>(
  query: string,
  items: readonly T[],
  labelOf: (item: T) => string,
  cap: number = COMPLETION_CAP,
): T[] {
  if (query === '') return items.slice(0, cap);
  const caseSensitive = query !== query.toLowerCase();
  const q = caseSensitive ? query : query.toLowerCase();
  const scored: { item: T; score: number }[] = [];
  for (const item of items) {
    const raw = labelOf(item);
    const folded = caseSensitive ? raw : raw.toLowerCase();
    const score = subsequenceScore(q, folded, raw);
    if (score !== null) scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, cap).map((entry) => entry.item);
}

/** Highlight cycling for ↑↓ (rule 20 + ticket "循环移动"): null starts at
 *  the first row going down / last row going up; both ends wrap; a stale
 *  out-of-range index (candidates shrank) restarts like null. */
export function cycleHighlight(current: number | null, delta: 1 | -1, count: number): number {
  if (count <= 0) return 0;
  if (current === null || current < 0 || current >= count) return delta === 1 ? 0 : count - 1;
  return (current + delta + count) % count;
}

/** What the completion popup does with a key. `ignore` = not ours; the
 *  caller's own semantics run (Enter sends the message, Tab moves focus,
 *  arrows move the caret). */
export type CompletionKeyIntent =
  | { kind: 'navigate'; index: number }
  | { kind: 'accept'; index: number }
  | { kind: 'dismiss' }
  | { kind: 'ignore' };

export interface CompletionKeyEvent {
  key: string;
  shiftKey?: boolean;
  /** IME composition guard (ticket failure mode 8): while composing,
   *  Enter/arrows/Tab belong to the IME, never to the popup. */
  isComposing?: boolean;
}

export interface CompletionNavState {
  open: boolean;
  /** null = nothing highlighted. CC keeps the top row UNhighlighted until
   *  the user navigates (rule 56: Enter with no highlight sends as typed),
   *  so opening the popup must not pre-select. */
  highlight: number | null;
  matchCount: number;
}

/** Keyboard mapping shared by `@` and `/` (rules 20-23 + 32, and the
 *  slash-menu isomorphs 53-56):
 *  - ↑↓ move the highlight cyclically (only while there are matches);
 *  - Tab accepts the highlighted row, or the top match when none is
 *    highlighted (rule 56 "Tab inserts the top match");
 *  - Enter accepts ONLY with a highlight — with none it stays `ignore` so
 *    the composer's own Enter-to-send survives (rules 55/56; this is the
 *    r9 §5 "Enter 语义混入发送" conflict resolved: first Enter inserts,
 *    the popup closes, the second Enter sends);
 *  - Esc dismisses;
 *  - anything else (or any key while composing) is ignored. */
export function completionKeyIntent(
  event: CompletionKeyEvent,
  state: CompletionNavState,
): CompletionKeyIntent {
  if (event.isComposing === true) return { kind: 'ignore' };
  if (!state.open) return { kind: 'ignore' };
  switch (event.key) {
    case 'Escape':
      return { kind: 'dismiss' };
    case 'ArrowDown':
      return state.matchCount === 0
        ? { kind: 'ignore' }
        : { kind: 'navigate', index: cycleHighlight(state.highlight, 1, state.matchCount) };
    case 'ArrowUp':
      return state.matchCount === 0
        ? { kind: 'ignore' }
        : { kind: 'navigate', index: cycleHighlight(state.highlight, -1, state.matchCount) };
    case 'Tab':
      return state.matchCount === 0
        ? { kind: 'ignore' }
        : { kind: 'accept', index: state.highlight ?? 0 };
    case 'Enter':
      if (event.shiftKey === true) return { kind: 'ignore' };
      return state.highlight !== null && state.highlight < state.matchCount
        ? { kind: 'accept', index: state.highlight }
        : { kind: 'ignore' };
    default:
      return { kind: 'ignore' };
  }
}
