// Block-markdown renderer for agent chat replies (issue #469).
//
// Why a web-side lite parser instead of reusing the doc pane's DocBlock
// pipeline (`mapPlanDoc`): DocBlock is the plan.md display contract, frozen
// off the r3 §3.3 "四段卡软结构" captures — it only models head/bullet/para
// and deliberately does not force structure. Chat replies need a richer
// block grammar (ordered lists, nesting, fenced code) that DocBlock has no
// slots for; widening that shared type would force the pixel-frozen doc pane
// renderer to carry kinds plan.md never produces. So chat gets its own
// line-based parser here, reusing `inlineSegments` for the inline layer —
// the `.chat-code` chip and mention accent stay byte-identical to the rest
// of the transcript. Parsing runs at render time off the raw `markdown`
// string (the spec-block.tsx precedent), so the fixture surface exercises
// the same parse+render path as the live mapper.

import { useMemo } from 'react';
import { inlineSegments } from '../api/mappers.js';
import type { DocSegment } from '../fixtures/records.js';
import { Segments } from './segments.js';

/** One block of a parsed chat reply. Inline content rides `segments`
 *  (shared with the doc pane / spec block); fenced code keeps its raw text
 *  (no inline parsing inside a code block). */
export type ChatBlock =
  | { kind: 'para'; segments: DocSegment[] }
  | { kind: 'head'; level: number; segments: DocSegment[] }
  | { kind: 'ordered'; depth: number; ordinal: number; segments: DocSegment[] }
  | { kind: 'bullet'; depth: number; segments: DocSegment[] }
  | { kind: 'code'; lang?: string; text: string };

/** Indent width per nesting level (px). Two source spaces = one level. */
const DEPTH_PX = 18;

function depthOf(indent: string): number {
  return Math.floor(indent.replace(/\t/g, '  ').length / 2);
}

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*(\S*)\s*$/;
const HEADING = /^ {0,3}(#{1,6})\s+(.*)$/;
const ORDERED = /^(\s*)(\d+)[.)]\s+(.*)$/;
const BULLET = /^(\s*)[-*•]\s+(.*)$/;

/** Line-based block parser: headings, ordered/unordered lists (nesting by
 *  leading indent), fenced code, and soft-wrapped paragraphs. Inline code /
 *  mentions inside non-code blocks go through `inlineSegments`. */
export function parseChatMarkdown(text: string): ChatBlock[] {
  const lines = text.split('\n');
  const blocks: ChatBlock[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length > 0) {
      blocks.push({ kind: 'para', segments: inlineSegments(para.join(' ')) });
      para = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i] ?? '';
    const trimmed = raw.trim();

    // fenced code — collect verbatim until the matching close fence
    const fence = FENCE.exec(raw);
    if (fence !== null) {
      flushPara();
      const marker = fence[1] ?? '```';
      const lang = fence[2] !== undefined && fence[2] !== '' ? fence[2] : undefined;
      const buf: string[] = [];
      i += 1;
      const close = new RegExp(`^ {0,3}${marker[0] === '`' ? '`{3,}' : '~{3,}'}\\s*$`);
      while (i < lines.length && !close.test(lines[i] ?? '')) {
        buf.push(lines[i] ?? '');
        i += 1;
      }
      i += 1; // step over the closing fence (or past EOF)
      blocks.push({ kind: 'code', ...(lang !== undefined ? { lang } : {}), text: buf.join('\n') });
      continue;
    }

    if (trimmed === '') {
      flushPara();
      i += 1;
      continue;
    }

    const head = HEADING.exec(raw);
    if (head !== null) {
      flushPara();
      blocks.push({
        kind: 'head',
        level: (head[1] ?? '#').length,
        segments: inlineSegments((head[2] ?? '').trim()),
      });
      i += 1;
      continue;
    }

    const ordered = ORDERED.exec(raw);
    if (ordered !== null) {
      flushPara();
      blocks.push({
        kind: 'ordered',
        depth: depthOf(ordered[1] ?? ''),
        ordinal: Number(ordered[2]),
        segments: inlineSegments((ordered[3] ?? '').trim()),
      });
      i += 1;
      continue;
    }

    const bullet = BULLET.exec(raw);
    if (bullet !== null) {
      flushPara();
      blocks.push({
        kind: 'bullet',
        depth: depthOf(bullet[1] ?? ''),
        segments: inlineSegments((bullet[2] ?? '').trim()),
      });
      i += 1;
      continue;
    }

    para.push(trimmed);
    i += 1;
  }
  flushPara();
  return blocks;
}

function HeadingTag({ level, segments }: { level: number; segments: DocSegment[] }) {
  const clamped = Math.min(6, Math.max(1, level));
  const Tag = `h${clamped}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  return (
    <Tag className={`chat-md-head chat-md-head--${clamped}`}>
      <Segments segments={segments} codeClassName="chat-code" />
    </Tag>
  );
}

/** Renders an agent reply's block markdown. Inline code chips reuse the
 *  transcript's `.chat-code` class so the chip family stays consistent. */
export function ChatMarkdown({ text }: { text: string }) {
  const blocks = useMemo(() => parseChatMarkdown(text), [text]);
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'head':
            return (
              // block order is stable; blocks carry no ids
              <HeadingTag key={i} level={block.level} segments={block.segments} />
            );
          case 'ordered':
            return (
              <div
                key={i}
                className="chat-md-item chat-md-item--ordered"
                data-depth={block.depth}
                style={{ marginLeft: block.depth * DEPTH_PX }}
              >
                <span className="chat-md-ordinal">{block.ordinal}.</span>
                <span className="chat-md-content">
                  <Segments segments={block.segments} codeClassName="chat-code" />
                </span>
              </div>
            );
          case 'bullet':
            return (
              <div
                key={i}
                className="chat-md-item chat-md-item--bullet"
                data-depth={block.depth}
                style={{ marginLeft: block.depth * DEPTH_PX }}
              >
                <span className="chat-md-marker">•</span>
                <span className="chat-md-content">
                  <Segments segments={block.segments} codeClassName="chat-code" />
                </span>
              </div>
            );
          case 'code':
            return (
              <pre key={i} className="chat-md-code" data-lang={block.lang ?? ''}>
                {block.text}
              </pre>
            );
          case 'para':
            return (
              <p key={i} className="chat-para">
                <Segments segments={block.segments} codeClassName="chat-code" />
              </p>
            );
        }
        // ChatBlock is a closed union — every kind returns above; this is the
        // unreachable fallback biome's useIterableCallbackReturn wants.
        return null;
      })}
    </>
  );
}
