// Inline segment renderer shared by the doc pane (doc-code chips) and the
// transcript (chat-code chips): one shape, the chip class is the only
// parameter (issue #57 — code review dedup). Mention segments (issue
// #311) render with the per-kind accent color defined in
// mention-picker.css so the chip family stays consistent with the
// composer overlay.

import type { DocSegment } from '../fixtures/records.js';
import '../overlay/mention-picker.css';

interface SegmentsProps {
  segments: DocSegment[];
  /** Chip class for `code` segments: `doc-code` (doc pane) or
   *  `chat-code` (transcript). */
  codeClassName: string;
}

export function Segments({ segments, codeClassName }: SegmentsProps) {
  return (
    <>
      {segments.map((seg, j) =>
        seg.style === 'mention' ? (
          // Mention chip — accent color comes from the entity kind
          // (r9 §2.4 token family). The chip class lives in
          // mention-picker.css so the picker overlay + transcript
          // chip share one rule.
          <span
            key={j}
            className={
              seg.mentionKind != null
                ? `mention-chip mention-chip--${seg.mentionKind}`
                : 'mention-chip'
            }
          >
            {seg.text}
          </span>
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
