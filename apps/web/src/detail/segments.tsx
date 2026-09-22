// Inline segment renderer shared by the doc pane (doc-code chips) and the
// transcript (chat-code chips): one shape, the chip class is the only
// parameter (issue #57 — code review dedup).

import type { DocSegment } from '../fixtures/records.js';

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
        seg.code ? (
          // fixture order is stable; segments carry no ids
          <code key={j} className={codeClassName}>
            {seg.text}
          </code>
        ) : (
          <span key={j}>{seg.text}</span>
        ),
      )}
    </>
  );
}
