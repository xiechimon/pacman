// Inline segment renderer shared by the doc pane (doc-code chips) and the
// transcript (chat-code chips): one shape, the chip class is the only
// parameter (issue #57 — code review dedup). Mention segments (issue
// #311) render with the per-kind accent color defined in
// mention-picker.css so the chip family stays consistent with the
// composer overlay.

import { Link } from 'react-router';

import type { DocSegment } from '../fixtures/records.js';
import '../overlay/mention-picker.css';
import { AGENTS_HREF } from '../routes/agent-detail-page.js';

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

/** Mention wire kinds whose chip navigates — reference-measured behaviors
 *  (todos.dev, live-captured): todo click goes to the todo detail (#675),
 *  agent click routes same-tab to the agent settings page (#741 — the whole
 *  chip is cursor-pointer, hover changes only the cursor, no popover). A
 *  router Link (real anchor) keeps keyboard activation, middle-click and
 *  open-in-new-tab for free. skill/project/machine stay non-clickable spans
 *  until their own navigation tickets: the reference landing surfaces for
 *  those three were never captured (project has a pacman route but no
 *  captured chip behavior; skill/machine have no per-entity route at all).
 *  No mentionId, no navigation — the chip stays an inert span. */
function mentionHref(seg: DocSegment): string | null {
  if (seg.mentionId == null) return null;
  if (seg.mentionKind === 'todo') return `/app/todo/${seg.mentionId}`;
  if (seg.mentionKind === 'agent') return `${AGENTS_HREF}/${seg.mentionId}`;
  return null;
}

/** One mention segment: navigable kinds render a router Link, the rest an
 *  inert span — same chip face either way (class family above). */
function MentionChip({ seg }: { seg: DocSegment }) {
  const href = mentionHref(seg);
  const className = chipClass(seg.mentionKind);
  return href != null ? (
    <Link className={className} to={href}>
      {seg.text}
    </Link>
  ) : (
    <span className={className}>{seg.text}</span>
  );
}

export function Segments({ segments, codeClassName }: SegmentsProps) {
  return (
    <>
      {segments.map((seg, j) =>
        seg.style === 'mention' ? (
          <MentionChip key={j} seg={seg} />
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
