// Block-markdown renderer for chat text (issue #469; #612 起同时服务用户
// 话语与任务简报——描述区 SpecBlock 与用户气泡的 markdown 槽都渲染到这里，
// 全站「用户/agent 的块级文本」一套解析器，不再各写一套).
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
//
// 附件 token（#310/#612）：![name](attachment:key) 独占一行 = attachment
// 块（两个写入端——详情页 composer 与新建任务对话框——都按「每个 token 占
// 独立行」拼接，web api/attachments.ts 契约）。行中内联的 token 不在块语法
// 内（保持字面文本，与 agent 回复同律）。

import { useMemo } from 'react';
import { inlineSegments } from '../api/mappers.js';
import type { DocSegment } from '../fixtures/records.js';
import { ATTACHMENT_LINE } from '../overlay/attachment-paste.js';
import { Segments } from './segments.js';

/** One block of a parsed chat reply. Inline content rides `segments`
 *  (shared with the doc pane / spec block); fenced code keeps its raw text
 *  (no inline parsing inside a code block); attachment blocks keep the
 *  token's name + storage key (#612). */
export type ChatBlock =
  | { kind: 'para'; segments: DocSegment[] }
  | { kind: 'head'; level: number; segments: DocSegment[] }
  | { kind: 'ordered'; depth: number; ordinal: number; segments: DocSegment[] }
  | { kind: 'bullet'; depth: number; segments: DocSegment[] }
  | { kind: 'code'; lang?: string; text: string }
  | { kind: 'attachment'; name: string; key: string };

/** Indent width per nesting level (px). Two source spaces = one level. */
const DEPTH_PX = 18;

function depthOf(indent: string): number {
  return Math.floor(indent.replace(/\t/g, '  ').length / 2);
}

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*(\S*)\s*$/;
const HEADING = /^ {0,3}(#{1,6})\s+(.*)$/;
const ORDERED = /^(\s*)(\d+)[.)]\s+(.*)$/;
const BULLET = /^(\s*)[-*•]\s+(.*)$/;
/** Whole-line attachment token: single-sourced in overlay/attachment-paste.ts
 *  since #757 (composer strip parses the same shape the renderer chips). */

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

    const attachment = ATTACHMENT_LINE.exec(raw);
    if (attachment !== null) {
      flushPara();
      blocks.push({
        kind: 'attachment',
        name: attachment[1] ?? '',
        key: attachment[2] ?? '',
      });
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

/** key teamId/id.ext → id：取末段去扩展名，兼容无扩展名情形
 *  （spec-block.tsx #310 原 helper，随附件块迁到渲染单源，#612）。 */
function attachmentIdFromKey(key: string): string {
  const lastSlash = key.lastIndexOf('/');
  const tail = lastSlash >= 0 ? key.slice(lastSlash + 1) : key;
  const dot = tail.lastIndexOf('.');
  return dot > 0 ? tail.slice(0, dot) : tail;
}

/** 附件 chip（#310 契约 / #612 起有样式）：image/* → 内联缩略 <img>（src 直
 *  指 GET /api/attachments/{id}），其它类型 → 文件名链接新标签打开
 *  （content-type 由浏览器原生处理）。
 *  #757 onPreview：composer strip 面传入后 image chip 改走 <button>（同类名，
 *  点开预览浮层而非新标签）；不传 = transcript 旧链形，字节不变。 */
export function AttachmentChip({
  name,
  attachmentKey,
  onPreview,
}: {
  name: string;
  attachmentKey: string;
  onPreview?: (name: string, src: string) => void;
}) {
  const href = `/api/attachments/${encodeURIComponent(attachmentIdFromKey(attachmentKey))}`;
  const isImage = /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(attachmentKey);
  if (isImage && onPreview !== undefined) {
    return (
      <button
        type="button"
        // #948：.spec-chip--preview 的 UA chrome 清零自 attachment-strip.css
        // 迁入（该文件退役）——preview 卡是 button 不是 link，appearance 归零
        // 保住 .spec-chip 卡面，整卡可点。
        className="spec-chip spec-chip--image spec-chip--preview cursor-pointer appearance-none"
        title={name}
        onClick={() => onPreview(name, href)}
      >
        <img src={href} alt={name} className="spec-chip-img" />
      </button>
    );
  }
  if (isImage) {
    return (
      <a
        className="spec-chip spec-chip--image"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={name}
      >
        <img src={href} alt={name} className="spec-chip-img" />
      </a>
    );
  }
  return (
    <a className="spec-chip" href={href} target="_blank" rel="noopener noreferrer" title={name}>
      {name}
    </a>
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
          case 'attachment':
            return (
              <div key={i} className="chat-md-attachment">
                <AttachmentChip name={block.name} attachmentKey={block.key} />
              </div>
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
