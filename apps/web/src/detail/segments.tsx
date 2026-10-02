// Inline segment renderer shared by the doc pane (doc-code chips) and the
// transcript (chat-code chips): one shape, the chip class is the only
// parameter (issue #57 — code review dedup). Mention segments (issue
// #311) render with the per-kind accent color defined in
// mention-picker.css so the chip family stays consistent with the
// composer overlay.

import { Link } from 'react-router';

import type { DocSegment } from '../fixtures/records.js';
import '../overlay/mention-picker.css';

interface SegmentsProps {
  segments: DocSegment[];
  /** Chip class for `code` segments: `doc-code` (doc pane) or
   *  `chat-code` (transcript). */
  codeClassName: string;
}

/** Mention chip — accent color comes from the entity kind (r9 §2.4 token
 *  family). The chip class lives in mention-picker.css so the picker overlay
 *  + transcript chip share one rule. */
function chipClass(kind: DocSegment['mentionKind']): string {
  return kind != null ? `mention-chip mention-chip--${kind}` : 'mention-chip';
}

export function Segments({ segments, codeClassName }: SegmentsProps) {
  return (
    <>
      {segments.map((seg, j) =>
        seg.style === 'mention' ? (
          seg.mentionKind === 'todo' && seg.mentionId != null ? (
            // #675: todo chip click → todo detail. Reference-measured
            // behavior (todos.dev, live-captured 2026-10-03): the chip is
            // cursor-pointer, hover shows no popover, and click navigates to
            // the mentioned todo. A router Link (real anchor) keeps keyboard
            // activation, middle-click and open-in-new-tab for free. The
            // other four kinds stay non-clickable spans until their own
            // navigation ticket.
            <Link key={j} className={chipClass(seg.mentionKind)} to={`/app/todo/${seg.mentionId}`}>
              {seg.text}
            </Link>
          ) : (
            <span key={j} className={chipClass(seg.mentionKind)}>
              {seg.text}
            </span>
          )
        ) : seg.style === 'strong' ? (
          // #650: `**bold**` run — a real <strong>, not the old strip-to-
          // plain. Must precede the generic styled-chip branch below
          // (that one turns any unknown style into a mono chip).
          <strong key={j}>{seg.text}</strong>
        ) : seg.style != null ? (
          // fixture order is stable; segments carry no ids
          <code
            key={j}
            className={
              seg.style === 'link' ? `${codeClassName} ${codeClassName}--link` : codeClassName
            }
          >
            {seg.text}
          </code>
        ) : (
          <span key={j}>{seg.text}</span>
        ),
      )}
    </>
  );
}
