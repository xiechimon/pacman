// Mention-token wire format (issue #311, spec 08 §3 附录 A 档 2 提及行 +
// docs/research/r9-attachments-mentions.md §3.2): the textual form
// carried in the composer textarea / new-task spec textarea, plus the
// reverse parse used by the transcript + doc-pane renderers to recover
// entity chips.
//
// Agents go through the markdown link + scheme form: `@r3-builder` ↔
// `[r3-builder](agent:<agentId>)`. The chief system prompt already
// emits this exact shape for the entity references in its replies
// (services/chief.ts:570), so the round-trip stays a single canonical
// encoding.
//
// Todos stay as `#seq` plain text per r9 §3.2 ("任务提及 #1 在消息内按
// #seq 留存"). For chip rendering on the transcript side, callers pass
// the same `(seq, todoId)` pair to the renderer so it can resolve the
// chip from the seq without re-parsing the URL. The renderer's job is
// `entityLookups` lookup, not text parse.
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

/** All five schemes share the markdown link syntax. The host part is
 *  the kind name (lowercased), the path is the canonical id. `todo:`
 *  reuses the seq in the host for human-readable URLs but still
 *  resolves via the id field at parse time. */
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
 *  matches the four scheme forms; todo mentions (plain `#N`) are not
 *  recovered from text alone — the renderer needs the seq→id lookup
 *  table to know which `#N` is a real chip and which is just hash
 *  syntax in user prose. */
const SCHEME_REGEX = /\[([^\]\n]+?)\]\((agent|skill|project|machine):([A-Za-z0-9_-]+)\)/g;

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
    const kind = rawKind as Exclude<MentionKind, 'todo'>;
    segments.push({
      kind: 'mention',
      token: { kind, label: unescapeLabel(rawLabel ?? ''), id: id ?? '' },
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

/** Insert a mention token at the given caret offset in the textarea
 *  value, with one leading + one trailing space (r9 §2.2: ` @r3-builder `).
 *  Returns the new value and the caret offset that lands right after
 *  the inserted whitespace. When `at` is `null`, appends to the end. */
export function insertMentionText(
  value: string,
  token: MentionToken,
  at: number | null,
): { value: string; caret: number } {
  const piece = ` ${serializeMention(token)} `;
  if (at == null || at < 0 || at > value.length) {
    return { value: value + piece, caret: value.length + piece.length };
  }
  // Avoid doubling the leading space when the previous char is already
  // whitespace; same for the trailing side once we insert.
  const before = value.slice(0, at);
  const after = value.slice(at);
  const leadingTrimmed = before.length === 0 || /\s/.test(before[before.length - 1] ?? '');
  const trailingSpace = after.length > 0 && !/^\s/.test(after) ? '' : '';
  const head = leadingTrimmed ? '' : ' ';
  return {
    value: before + head + serializeMention(token) + trailingSpace + after,
    caret: before.length + head.length + serializeMention(token).length + trailingSpace.length,
  };
}

/** Detect the `@` prefix in the textarea value at the caret offset.
 *  Returns the partial query (text after the last `@` before the caret)
 *  when the caret sits inside a `@`-prefixed token; `null` when the
 *  caret is not in a mentionable position (composer inline @ list
 *  uses this to decide whether to open). */
export function detectInlineAgentQuery(value: string, caret: number): string | null {
  if (caret <= 0 || caret > value.length) return null;
  let i = caret - 1;
  while (i >= 0) {
    const ch = value[i];
    if (ch === '@') {
      // No whitespace allowed between `@` and the caret.
      const head = value.slice(i + 1, caret);
      if (/\s/.test(head)) return null;
      return head;
    }
    if (/\s/.test(ch ?? '')) return null;
    i -= 1;
  }
  return null;
}
