import { fuzzyFilter } from './completion.js';

// Mention-token wire format (issue #311, spec 08 §3 附录 A 档 2 提及行 +
// docs/research/r9-attachments-mentions.md §3.2): the textual form// carried in the composer textarea / new-task spec textarea, plus the
// reverse parse used by the transcript + doc-pane renderers to recover
// entity chips.
//
// Agents go through the markdown link + scheme form: `@r3-builder` ↔
// `[r3-builder](agent:<agentId>)`. The chief system prompt already
// emits this exact shape for the entity references in its replies
// (services/chief.ts:570), so the round-trip stays a single canonical
// encoding.
//
// Todos have two wire forms (r9 §3.2 + #675 live captures): the composer
// picker inserts the plain `#seq` token (serializeMention below), which
// stays plain text on the wire and on screen — recovering a chip from a
// bare `#N` needs a seq→todoId lookup table that does not exist yet, and
// an unguarded `#N` scan would eat prose. The chief agent's system prompt
// (services/chief.ts) instead instructs the markdown link form
// `[#n](todo:<id>)`, the same encoding as the other four schemes;
// parseMentionSegments and the live transcript parser (api/mappers.ts
// MENTION_SCHEME) both recover that form into todo chips (#675).
//
// project / skill / machine mentions carry no pre-existing scheme in
// r9, but the picker UI exposes them as "待设计" stubs — the spec
// reserves a 5-category popover and a backend parse step. Until that
// lands, projects / skills / machines serialize as `name (label)` so
// the round-trip stays readable even without a parse pass; the chip
// renderer shows them as plain chips until 308-2 lands the scheme
// family.

/** Mention kind — the five categories the popover exposes (r9 §2.2). */
export type MentionKind = 'todo' | 'skill' | 'agent' | 'project' | 'machine';

/** File candidate from the project enumeration face (#760
 * `GET /api/projects/:id/files`). */
export interface FileMentionEntry {
  /** Repo-root-relative path (no trailing slash; the row label adds it for
   *  directories). */
  path: string;
  type: 'blob' | 'tree';
}

/** One row of the unified inline `@` listbox (#728 agents-only origin, #760
 *  + agents/files, #848 all five entity kinds + files): every non-file row
 *  carries its MentionKind and inserts through serializeMention; file rows
 *  insert as bare path text (no scheme wire). */
export interface InlineCompletionRow {
  kind: MentionKind | 'file';
  /** Entity id / file path (dirs carry the trailing `/` in the label,
   *  the id stays the bare path). */
  id: string;
  /** Display label: entity name (todo = `#seq title`) / file path
   *  (`/`-suffixed for directories). */
  label: string;
  subtitle?: string;
  fileType?: 'blob' | 'tree';
  /** Todo board number — set when kind === 'todo' so the insert side can
   *  serialize the plain `#seq` token. */
  seq?: number;
}

/** Entity groups feeding the inline `@` listbox (#848). Structural subset of
 *  the popover's MentionGroups (mention-picker.ts) — kept structural (not
 *  imported) so this pure module stays React-free. */
export type InlineRosterGroups = Record<
  MentionKind,
  { id: string; label: string; subtitle?: string; seq?: number }[]
>;

/** Unified inline `@` roster (#848: five entity kinds + files, ONE fuzzy
 *  pass — CC rules 14-18 via the shared fuzzyFilter, capped at 15).
 *  Concatenation order is the tie-break (stable sort): agents first (the
 *  #728/#760 feel — a bare `@` keeps listing agents on top), then todo /
 *  skill / project / machine in popover order, files last (enumeration =
 *  git order). An empty query lists the concatenated roster in order.
 *  files absent/empty = the pure five-kind face (chief drawer,
 *  new-task dialog). */
export function buildInlineRows(
  query: string,
  groups: InlineRosterGroups,
  files?: readonly FileMentionEntry[],
): InlineCompletionRow[] {
  const rows: InlineCompletionRow[] = [
    ...groups.agent.map(
      (a): InlineCompletionRow => ({
        kind: 'agent',
        id: a.id,
        label: a.label,
        ...(a.subtitle !== undefined ? { subtitle: a.subtitle } : {}),
      }),
    ),
    ...groups.todo.map(
      (t): InlineCompletionRow => ({
        kind: 'todo',
        id: t.id,
        label: t.label,
        ...(t.subtitle !== undefined ? { subtitle: t.subtitle } : {}),
        ...(t.seq !== undefined ? { seq: t.seq } : {}),
      }),
    ),
    ...groups.skill.map(
      (s): InlineCompletionRow => ({
        kind: 'skill',
        id: s.id,
        label: s.label,
        ...(s.subtitle !== undefined ? { subtitle: s.subtitle } : {}),
      }),
    ),
    ...groups.project.map(
      (p): InlineCompletionRow => ({
        kind: 'project',
        id: p.id,
        label: p.label,
        ...(p.subtitle !== undefined ? { subtitle: p.subtitle } : {}),
      }),
    ),
    ...groups.machine.map(
      (m): InlineCompletionRow => ({
        kind: 'machine',
        id: m.id,
        label: m.label,
        ...(m.subtitle !== undefined ? { subtitle: m.subtitle } : {}),
      }),
    ),
    ...(files ?? []).map(
      (f): InlineCompletionRow => ({
        kind: 'file',
        id: f.path,
        label: f.type === 'tree' ? `${f.path}/` : f.path,
        fileType: f.type,
      }),
    ),
  ];
  return fuzzyFilter(query, rows, (r) => r.label);
}

/** Structured mention token emitted by the picker. `seq` is the todo
 *  number on board, used by the transcript renderer to look up the
 *  todo record for chip rendering. `id` is the canonical entity id. */
export interface MentionToken {
  kind: MentionKind;
  /** Display name the chip shows; the raw text between `[...]`. */
  label: string;
  /** Canonical entity id used to round-trip the wire URL. */
  id: string;
  /** Todo seq (`#1`, `#2`, …) when kind === 'todo'; undefined otherwise. */
  seq?: number;
}

/** All five schemes share the markdown link syntax on the parse side:
 *  `[label](kind:id)`, host = lowercased kind name, path = canonical id
 *  (#675: chief replies carry `[#n](todo:<id>)` in exactly this shape).
 *  The composer-side serializer keeps todo mentions as the plain `#seq`
 *  token — see serializeMention. */
const SCHEME_PREFIX: Record<MentionKind, string> = {
  todo: 'todo',
  skill: 'skill',
  agent: 'agent',
  project: 'project',
  machine: 'machine',
};

/** Escape characters that would break the markdown link bracket. Only
 *  `]` and `\` are required by the spec; `(` and unbalanced brackets
 *  in the label are tolerated by every markdown parser we ship (chief
 *  replies, doc pane, chat transcript). */
function escapeLabel(label: string): string {
  return label.replace(/\\/g, '\\\\').replace(/\]/g, '\\]');
}

/** Reverse of escapeLabel. The renderer only needs the displayed text;
 *  callers can pass the raw link text through unchanged. */
export function unescapeLabel(label: string): string {
  let out = '';
  for (let i = 0; i < label.length; i += 1) {
    if (label[i] === '\\' && i + 1 < label.length) {
      out += label[i + 1];
      i += 1;
    } else {
      out += label[i];
    }
  }
  return out;
}

/** Serialize a MentionToken into the wire form a textarea / message
 *  body carries. Returns plain text (no leading/trailing whitespace —
 *  the picker surrounds it with spaces to match r9 §2.2 spacing). */
export function serializeMention(token: MentionToken): string {
  const safeLabel = escapeLabel(token.label);
  if (token.kind === 'todo') {
    // Per r9 §3.2 the textual mention stays as `#seq` plain text so
    // chat lines like `#12 failed → ...` keep reading naturally. The
    // transcript renderer recovers the chip via the seq→todoId lookup
    // table attached to the message; it does not re-parse the text.
    return `#${token.seq ?? ''}`.trimEnd() || `#${token.label}`;
  }
  if (token.kind === 'agent') {
    return `[${safeLabel}](${SCHEME_PREFIX.agent}:${token.id})`;
  }
  if (token.kind === 'project') {
    return `[${safeLabel}](${SCHEME_PREFIX.project}:${token.id})`;
  }
  if (token.kind === 'skill') {
    return `[${safeLabel}](${SCHEME_PREFIX.skill}:${token.id})`;
  }
  return `[${safeLabel}](${SCHEME_PREFIX.machine}:${token.id})`;
}

/** A mention row recovered from a message / spec string. `start` /
 *  `end` are the substring offsets the renderer needs to slice the
 *  source text. `kind: 'text'` rows carry the surrounding plain text
 *  unchanged. */
export type MentionSegment =
  | { kind: 'text'; text: string }
  | { kind: 'mention'; token: MentionToken; start: number; end: number };

/** Single-pass scan that emits text + mention segments. The regex
 *  matches all five scheme link forms (#675: `todo:` included — chief
 *  replies carry `[#n](todo:<id>)`). Bare `#N` prose is still not
 *  recovered from text alone — the renderer would need the seq→id
 *  lookup table to know which `#N` is a real chip and which is just
 *  hash syntax in user prose (header comment). */
const SCHEME_REGEX = /\[([^\]\n]+?)\]\((agent|skill|project|machine|todo):([A-Za-z0-9_-]+)\)/g;

export function parseMentionSegments(text: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let cursor = 0;
  SCHEME_REGEX.lastIndex = 0;
  for (;;) {
    const match = SCHEME_REGEX.exec(text) as RegExpExecArray | null;
    if (match === null) break;
    const [full, rawLabel, rawKind, id] = match;
    if (match.index > cursor) {
      segments.push({ kind: 'text', text: text.slice(cursor, match.index) });
    }
    const kind = rawKind as MentionKind;
    const label = unescapeLabel(rawLabel ?? '');
    // A todo link label carries the seq marker (the shape the chief prompt
    // instructs); recover the board number so parsed tokens honor the
    // MentionToken contract (seq set when kind === 'todo'). The hash is
    // matched via startsWith instead of a regex literal: the i18n-coverage
    // gate walks this file with the raw TS token scanner, and a bare hash
    // inside a regex body wedges it into a zero-advance spin (#681).
    const seqDigits = kind === 'todo' && label.startsWith('#') ? label.slice(1) : '';
    const seq = /^\d+$/.test(seqDigits) ? Number(seqDigits) : undefined;
    segments.push({
      kind: 'mention',
      token: {
        kind,
        label,
        id: id ?? '',
        ...(seq !== undefined ? { seq } : {}),
      },
      start: match.index,
      end: match.index + full.length,
    });
    cursor = match.index + full.length;
  }
  if (cursor < text.length) {
    segments.push({ kind: 'text', text: text.slice(cursor) });
  }
  return segments;
}

/** 文件插入形（#760，CC rules 26-29 同构）：裸路径文本（不走 scheme wire——
 * agent 在项目 worktree 对相对路径原生可读，见票面裁决）。含空白路径引号
 * 包裹（rule 27）；目录调用方已带尾随 `/`（rule 28/29）。 */
export function formatFileInsert(path: string): string {
  return /\s/.test(path) ? `"${path}"` : path;
}

/** 文件 token 插入（#760）：与 insertMentionText 同一空格纪律——前导空格防
 * 粘连（已是空白邻位则免）、尾随空格恒落地（rule 26：插入后紧跟的按键不能
 * 粘到 token 上）。`at/replaceEnd` 语义与 insertMentionText 同（消费 STORED
 * 检测区间，`@query` 不留残）。 */
export function insertFileText(
  value: string,
  path: string,
  at: number | null,
  replaceEnd?: number,
): { value: string; caret: number } {
  const serialized = formatFileInsert(path);
  if (at == null || at < 0 || at > value.length) {
    const piece = ` ${serialized} `;
    return { value: value + piece, caret: value.length + piece.length };
  }
  const end = replaceEnd != null && replaceEnd > at ? Math.min(replaceEnd, value.length) : at;
  const before = value.slice(0, at);
  const after = value.slice(end);
  const head = before.length === 0 || /\s/.test(before[before.length - 1] ?? '') ? '' : ' ';
  const tail = after.length > 0 && /^\s/.test(after) ? '' : ' ';
  return {
    value: before + head + serialized + tail + after,
    caret: before.length + head.length + serialized.length + tail.length,
  };
}
/** Insert a mention token at the given caret offset in the textarea
 *  value, with one leading + one trailing space (r9 §2.2: ` @r3-builder `;
 *  CC rule 26: acceptance always lands a trailing space so the next
 *  keystroke cannot glue onto the token). A space side is skipped when the
 *  neighbour is already whitespace — never double spaces.
 *
 *  Returns the new value and the caret offset that lands right after the
 *  inserted trailing space (ticket #728 failure mode 6: a caret inside or
 *  directly behind the token would let continued typing break the
 *  markdown link).
 *
 *  `replaceEnd` (inline `@` path, #728): when set, the span `[at,
 *  replaceEnd)` — the detected `@query` token — is consumed by the insert
 *  instead of staying behind as residue. Callers pass the STORED detection
 *  range, not a recomputed one (failure mode 5: a caret that drifted after
 *  detection would otherwise eat neighbouring text). Out-of-range values
 *  are clamped. When `at` is `null`, appends to the end. */
export function insertMentionText(
  value: string,
  token: MentionToken,
  at: number | null,
  replaceEnd?: number,
): { value: string; caret: number } {
  const piece = ` ${serializeMention(token)} `;
  if (at == null || at < 0 || at > value.length) {
    return { value: value + piece, caret: value.length + piece.length };
  }
  const end = replaceEnd != null && replaceEnd > at ? Math.min(replaceEnd, value.length) : at;
  const before = value.slice(0, at);
  const after = value.slice(end);
  const serialized = serializeMention(token);
  const head = before.length === 0 || /\s/.test(before[before.length - 1] ?? '') ? '' : ' ';
  const tail = after.length > 0 && /^\s/.test(after) ? '' : ' ';
  return {
    value: before + head + serialized + tail + after,
    caret: before.length + head.length + serialized.length + tail.length,
  };
}

/** Composer chip strip 的一行（#812）：draft 文本里已落定的提及。scheme
 * 五类复用 parseMentionSegments（transcript chip 同一解析面）；文件走名单
 * 精确匹配——#760 插入纪律恒落空白垫（前后空格），散文里的子串因边界不合
 * 格也不会误认。wire 本体不动，strip 只读。 */
export interface DraftChip {
  kind: MentionKind | 'file';
  /** scheme 实体 id / 名单路径（目录为去尾斜杠的裸 path）。 */
  id: string;
  /** chip 文案：scheme label / 文件 label（目录带尾随斜杠，引号包裹形去引号）。 */
  label: string;
  start: number;
  end: number;
}

/** 名单文件 token 扫描：每个序列化形（空白即引号包裹、目录带尾随斜杠——
 * 与插入侧 formatFileInsert 同形）在空白或串边界处命中才算；重叠命中只留
 * 最长（目录与其子项同现时不双 chip）。indexOf 直扫，无正则回溯面。 */
function scanFileChips(draft: string, files: readonly FileMentionEntry[]): DraftChip[] {
  const hits: DraftChip[] = [];
  for (const f of files) {
    const label = f.type === 'tree' ? `${f.path}/` : f.path;
    const serialized = formatFileInsert(label);
    let from = 0;
    for (;;) {
      const at = draft.indexOf(serialized, from);
      if (at === -1) break;
      from = at + serialized.length;
      const before = at === 0 ? '' : (draft[at - 1] ?? '');
      const after =
        at + serialized.length >= draft.length ? '' : (draft[at + serialized.length] ?? '');
      const bounded = (before === '' || /\s/.test(before)) && (after === '' || /\s/.test(after));
      if (bounded) {
        hits.push({ kind: 'file', id: f.path, label, start: at, end: at + serialized.length });
      }
    }
  }
  // 起点同、留长者；跨类重叠（scheme 链恰落路径内之类病态）先到先得——
  // scheme 先入，同起点时 scheme 胜。
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: DraftChip[] = [];
  for (const h of hits) {
    if (!kept.some((k) => h.start < k.end && k.start < h.end)) kept.push(h);
  }
  kept.sort((a, b) => a.start - b.start);
  return kept;
}

/** draft 全文 → 有序 chip 行（#812 strip 数据源）。scheme 链与文件 token
 * 合并后按出现序排；任一跨类重叠以前者为准（上式先到先得）。 */
export function parseDraftChips(draft: string, files?: readonly FileMentionEntry[]): DraftChip[] {
  const chips: DraftChip[] = [];
  for (const seg of parseMentionSegments(draft)) {
    if (seg.kind !== 'mention') continue;
    chips.push({
      kind: seg.token.kind,
      id: seg.token.id,
      label: seg.token.label,
      start: seg.start,
      end: seg.end,
    });
  }
  if (files !== undefined) chips.push(...scanFileChips(draft, files));
  chips.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: DraftChip[] = [];
  for (const c of chips) {
    if (!kept.some((k) => c.start < k.end && k.start < c.end)) kept.push(c);
  }
  kept.sort((a, b) => a.start - b.start);
  return kept;
}
