// Composer mention-chip strip (issue #812): the select-time confirmation
// face for inline `@` inserts. After Tab/Enter/click lands a token, the
// draft shows raw text (a bare path, a `[label](agent:id)` link) — the
// strip renders the settled mentions back as chips in the transcript's own
// `.mention-chip` face, so the select reads as confirmed instead of dead.
//
// Data = parseDraftChips over the live draft (scheme links + roster file
// tokens, draft order); the wire is never touched. Only first-appearance
// chips pop (the tw-animate-css enter pair, same as the listbox face —
// site-wide reduced-motion reset in styles/motion.css covers it); edits
// elsewhere keep stable keys so the pop never replays (C8). The strip
// yields while any completion popup is open (C6) and unmounts on an empty
// row (C7 — the static/fixture composer never mounts it).

import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n/provider.js';
// #948：chip 家族皮肤单源迁 overlay/mention-chip.ts（原 mention-picker.css），
// 类名钩子（mention-chip--*）与 fresh 动效类原样保留。
import { mentionChipClass } from '../overlay/mention-chip.js';
import {
  type DraftChip,
  type FileMentionEntry,
  parseDraftChips,
} from '../overlay/mention-token.js';

interface ComposerChipsProps {
  draft: string;
  files?: FileMentionEntry[];
  /** A completion popup is open — the strip stays out of its way (C6). */
  suspended: boolean;
}

/** Identity-stable key: one ordinal per repeated reference so two copies of
 *  the same mention keep distinct, stable keys across unrelated edits. */
function keyChips(chips: DraftChip[]): { chip: DraftChip; key: string }[] {
  const ordinals = new Map<string, number>();
  return chips.map((chip) => {
    const base = `${chip.kind}:${chip.id}`;
    const ordinal = ordinals.get(base) ?? 0;
    ordinals.set(base, ordinal + 1);
    return { chip, key: `${base}#${ordinal}` };
  });
}

export function ComposerChips({ draft, files, suspended }: ComposerChipsProps) {
  const { t } = useI18n();
  const chips = useMemo(() => parseDraftChips(draft, files), [draft, files]);
  const keyed = useMemo(() => keyChips(chips), [chips]);
  // Committed keys (effect-committed, never render-phase: StrictMode
  // double-invokes renders and a render-phase write would swallow the fresh
  // set before paint). Fresh = in this row but not in the last commit.
  const committedRef = useRef<Set<string>>(new Set());
  const [freshKeys, setFreshKeys] = useState<Set<string>>(new Set());
  useEffect(() => {
    const next = new Set<string>();
    for (const { key } of keyed) {
      if (!committedRef.current.has(key)) next.add(key);
    }
    committedRef.current = new Set(keyed.map(({ key }) => key));
    setFreshKeys(next);
  }, [keyed]);
  if (suspended || keyed.length === 0) return null;
  return (
    <div className="composer-chips" role="status" aria-label={t('提及')}>
      {keyed.map(({ chip, key }) => (
        <span
          key={key}
          className={`${mentionChipClass(chip.kind)}${
            freshKeys.has(key)
              ? ' composer-chip--fresh animate-in fade-in-0 zoom-in-98 duration-100'
              : ''
          }`}
        >
          <span className="composer-chip-label">{chip.label}</span>
        </span>
      ))}
    </div>
  );
}
