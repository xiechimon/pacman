// Word-level highlight for the review pane's diff view (issue #1101).
//
// Problem: a changed line only ever showed the whole-line add/del bg — in a
// pair where one word moved, the reader had to scan the full line to find
// it. The data for pairing is already on the wire-mapped DiffLine[]
// (mappers.ts mapDiffFiles): a hunk's del lines and add lines sit in
// adjacent change groups, so pairing is a pure render-layer computation —
// server/daemon/wire untouched.
//
// Pairing heuristic (deliberately simple, pinned by diff-word-highlight.spec):
//   - a change group = a maximal run of non-context lines; marker rows
//     (the r8 72 "No newline at end of file" splice) are transparent to
//     adjacency, matching the plan-diff face's real shape;
//   - within a group, del[i] pairs with add[i] for i < min(delCount,
//     addCount); surplus lines keep the whole-line bg alone (unpaired =
//     nothing to compare against);
//   - each pair goes through diffWordsWithSpace (diff v9, the same pin the
//     fixture plan hunks ride); changed tokens render under a deeper bg.
//
// Caps (Multica MAX_DIFF_CELLS lineage): word diffing is quadratic-ish on
// pathological lines, so an oversized pair is skipped — loudly: the lines
// carry the capped marker (data attribute + tooltip) instead of silently
// looking unpaired.

import { diffWordsWithSpace } from 'diff';
import type { DiffLine } from '../fixtures/records.js';

/** Either side of a pair longer than this skips word diffing. */
export const MAX_WORD_LINE_CHARS = 1000;
/** Cumulative diff parts budget per hunk; exhausting it caps later pairs. */
export const MAX_WORD_DIFF_CELLS = 4000;

/** One rendered fragment of a line's text. */
export interface WordSegment {
  text: string;
  changed: boolean;
}

/** Per-hunk result, keyed by the line's index within hunk.lines. */
export interface HunkWordDiff {
  /** Lines of a word-diffed pair → their segments (both sides present). */
  segments: Map<number, WordSegment[]>;
  /** Lines of pairs skipped by a cap — render the loud fallback. */
  capped: Set<number>;
}

interface DiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}

/** One side's view of a pair's parts: keep this side's changed tokens
 *  (changed=true) plus the unchanged ones, drop the other side's. */
function sideSegments(parts: DiffPart[], side: 'del' | 'add'): WordSegment[] {
  const out: WordSegment[] = [];
  for (const part of parts) {
    const own = side === 'del' ? part.removed === true : part.added === true;
    const other = side === 'del' ? part.added === true : part.removed === true;
    if (other) continue;
    const last = out[out.length - 1];
    if (last !== undefined && last.changed === own) last.text += part.value;
    else out.push({ text: part.value, changed: own });
  }
  return out;
}

export function computeHunkWordDiff(lines: DiffLine[]): HunkWordDiff {
  const segments = new Map<number, WordSegment[]>();
  const capped = new Set<number>();
  let cells = 0;
  let i = 0;
  while (i < lines.length) {
    const head = lines[i];
    if (head === undefined || head.kind === 'context') {
      i += 1;
      continue;
    }
    // Collect one change group (del/add runs, markers transparent).
    const dels: number[] = [];
    const adds: number[] = [];
    let j = i;
    while (j < lines.length) {
      const row = lines[j];
      if (row === undefined || row.kind === 'context') break;
      if (row.kind === 'del') dels.push(j);
      else if (row.kind === 'add') adds.push(j);
      j += 1;
    }
    const pairs = Math.min(dels.length, adds.length);
    for (let p = 0; p < pairs; p += 1) {
      const dIdx = dels[p];
      const aIdx = adds[p];
      const dLine = dIdx === undefined ? undefined : lines[dIdx];
      const aLine = aIdx === undefined ? undefined : lines[aIdx];
      if (dIdx === undefined || aIdx === undefined || !dLine || !aLine) break;
      if (
        dLine.text.length > MAX_WORD_LINE_CHARS ||
        aLine.text.length > MAX_WORD_LINE_CHARS ||
        cells >= MAX_WORD_DIFF_CELLS
      ) {
        capped.add(dIdx);
        capped.add(aIdx);
        continue;
      }
      const parts = diffWordsWithSpace(dLine.text, aLine.text) as DiffPart[];
      cells += parts.length;
      segments.set(dIdx, sideSegments(parts, 'del'));
      segments.set(aIdx, sideSegments(parts, 'add'));
    }
    i = j;
  }
  return { segments, capped };
}
