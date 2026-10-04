// Ordered-list auto-continuation (issue #814): the Enter-key logic shared by
// the new-task dialog textarea and the two composer faces behind
// useComposerWire (detail + chief drawer).
//
// Scope = ordered lists only (`1. ` half-width marker, ticket ruling).
// Unordered lists, quotes and headings are out of scope and fall through
// (null) to the ambient key behavior. Full-width markers (`1、`/`1．`)
// are likewise not recognized yet — ticket says half-width first.
//
// Contract: pure function over (value, caret). Returns the replacement
// value + caret, or null when the caret is not on an ordered-list item
// (the caller keeps its native behavior). No DOM, no React — both the
// textarea-direct face (new-task) and the wire face consume it the same
// way so the three inputs can never drift apart.

/** Match for one list line: indent + number + dot + at least one space. */
interface ListMarker {
  /** Offset of the line start in the whole value. */
  lineStart: number;
  /** Width of the leading indent (spaces/tabs). */
  indent: string;
  /** The parsed item number. */
  number: number;
  /** Offset just past the marker (`1. `), in whole-value coordinates. */
  markerEnd: number;
  /** Offset of the line end (exclusive, before the newline), whole-value. */
  lineEnd: number;
}

/** Parse the ordered-list marker of the line containing `caret`. */
function markerAtCaret(value: string, caret: number): ListMarker | null {
  const clamped = Math.max(0, Math.min(caret, value.length));
  const lineStart = value.lastIndexOf('\n', clamped - 1) + 1;
  const nl = value.indexOf('\n', clamped);
  const lineEnd = nl === -1 ? value.length : nl;
  const line = value.slice(lineStart, lineEnd);
  // Half-width digits + dot + space only; the line must START with the
  // marker (after indent) so `foo 1. bar` never matches. Comments near
  // this regex stay English: the i18n scanner misreads backtick/CJK
  // mixes around regex bodies (#678/#710 precedent).
  const match = /^([ \t]*)(\d+)\. +/.exec(line);
  if (match === null) return null;
  const indent = match[1] ?? '';
  const number = Number.parseInt(match[2] ?? '0', 10);
  if (!Number.isSafeInteger(number)) return null;
  const markerEnd = lineStart + (match[0]?.length ?? 0);
  // A caret inside the marker span is not typing list content — leave the
  // key to the native split instead of manufacturing `2. 1. foo` shapes.
  if (clamped < markerEnd) return null;
  return { lineStart, indent, number, markerEnd, lineEnd };
}

function sameIndentMarker(
  line: string,
  indent: string,
): { number: number; contentStart: number; markerLength: number } | null {
  const match = /^([ \t]*)(\d+)\. +(.*)$/.exec(line);
  if (match === null) return null;
  if ((match[1] ?? '') !== indent) return null;
  return {
    number: Number.parseInt(match[2] ?? '0', 10),
    contentStart: (match[1] ?? '').length + (match[2] ?? '').length + 2,
    markerLength: match[0].length - (match[3] ?? '').length,
  };
}

export interface OrderedListEnter {
  value: string;
  caret: number;
}

/** Apply one Enter keystroke on an ordered-list line. See module header. */
export function applyOrderedListEnter(value: string, caret: number): OrderedListEnter | null {
  const marker = markerAtCaret(value, caret);
  if (marker === null) return null;
  const clamped = Math.max(0, Math.min(caret, value.length));

  // Empty item (`2. ` + Enter): drop the marker and leave the list
  // (markdown同律). The indent stays so a nested level keeps its column.
  const restOfLine = value.slice(marker.markerEnd, marker.lineEnd);
  if (restOfLine.trim() === '') {
    const next =
      value.slice(0, marker.lineStart + marker.indent.length) + value.slice(marker.lineEnd);
    return { value: next, caret: marker.lineStart + marker.indent.length };
  }

  const nextNumber = marker.number + 1;
  const insert = `\n${marker.indent}${nextNumber}. `;
  const head = value.slice(0, clamped);
  let tail = value.slice(clamped);
  const nextCaret = clamped + insert.length;

  // Renumber the consecutive same-indent siblings below so the column
  // stays sequential after the insert. Stops at the first blank line,
  // non-list line or different indent (nested sub-lists keep theirs).
  const tailLines = tail.split('\n');
  let renumber = nextNumber + 1;
  for (let i = 1; i < tailLines.length; i += 1) {
    const line = tailLines[i];
    if (line === undefined || line.trim() === '') break;
    const sibling = sameIndentMarker(line, marker.indent);
    if (sibling === null || !Number.isSafeInteger(sibling.number)) break;
    tailLines[i] = `${marker.indent}${renumber}. ${line.slice(sibling.contentStart)}`;
    renumber += 1;
  }
  tail = tailLines.join('\n');

  return { value: head + insert + tail, caret: nextCaret };
}
