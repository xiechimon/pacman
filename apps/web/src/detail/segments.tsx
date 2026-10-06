// Inline segment renderer shared by the doc pane (doc-code chips) and the
// transcript (chat-code chips): one shape, the chip class is the only
// parameter (issue #57 — code review dedup). Mention segments (issue
// #311) render with the per-kind accent color defined in
// mention-picker.css so the chip family stays consistent with the
// composer overlay.

import { cn } from 'cn';
import { Link } from 'react-router';

import type { DocSegment } from '../fixtures/records.js';
import '../overlay/mention-picker.css';
import { AGENTS_HREF } from '../routes/agent-detail-page.js';

/** #945（detail.css 清零）：inline code chip 皮肤从 per-face 规则迁
 *  utilities，单源住在这里（两族只差行高——chat-code 11px/13px 紧排，
 *  doc-code 只钉字号、chip 不长 24px 行盒，r7 17b/26d 实测 13–15px 底矩形）。
 *  --link 变体 = plan 蓝墨 + 同色底（r8 56 文件/提交引用 chip）。类名保留
 *  作惰性别名（chief-stream-markdown 等它域 spec 与单测按它定位）。 */
const CODE_SKIN: Record<string, string> = {
  'chat-code':
    'mx-0.5 rounded-[4px] bg-(--code-bg) px-1 py-px font-mono text-[11px] leading-[13px]',
  'doc-code': 'mx-0.5 rounded-[4px] bg-(--code-bg) px-1 py-px font-mono text-[11px]',
};
const CODE_LINK_SKIN = 'bg-(--chip-plan-bg) text-(--chip-plan-fg)';

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
            className={cn(
              codeClassName,
              CODE_SKIN[codeClassName],
              seg.style === 'link' && `${codeClassName}--link`,
              seg.style === 'link' && CODE_LINK_SKIN,
            )}
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
