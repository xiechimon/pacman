// #873 chat-follow rule: the shared single source both chat surfaces (the
// detail transcript column and the chief drawer body) read. Pinned here are
// the axis conventions — the part that silently breaks one surface when the
// rule is copied per surface instead of shared.
// Failure modes:
//   F1  normal scroller: "at the newest end" computed from the wrong end
//       (the view would follow while the reader sits at the oldest row, and
//       sit still while they sit at the newest)
//   F2  reversed (column-reverse) scroller: the same mistake on the other
//       axis — the reported「不自动下滑」shape
//   F3  a transcript shorter than its viewport reports a bogus distance and
//       the reader gets dragged around a window that does not scroll
//   F4  the jump writes the wrong edge (0 into a normal scroller, or
//       scrollHeight into a reversed one) — a no-op jump

import { describe, expect, test } from 'vitest';
import { FOLLOW_THRESHOLD, newestEndDistance, scrollToNewest } from '../src/components/chat/use-chat-follow.js';

/** A normal vertical scroller showing rows 0..1000 in a 400px viewport. */
const normal = (scrollTop: number) => ({ scrollTop, scrollHeight: 1000, clientHeight: 400 });

/** The detail column: column-reverse, so the newest row is at scrollTop 0 and
 *  the browser reports negative offsets as the reader walks back. */
const reversed = (scrollTop: number) => ({ scrollTop, scrollHeight: 1000, clientHeight: 400 });

describe('newestEndDistance', () => {
  test('F1: a normal scroller measures from the far end', () => {
    expect(newestEndDistance(normal(600), false)).toBe(0); // at the newest row
    expect(newestEndDistance(normal(0), false)).toBe(600); // at the oldest
    expect(newestEndDistance(normal(580), false)).toBe(20); // inside the band
  });

  test('F2: a reversed scroller measures from its own origin', () => {
    expect(newestEndDistance(reversed(0), true)).toBe(0); // at the newest row
    expect(newestEndDistance(reversed(-600), true)).toBe(600); // at the oldest
    expect(newestEndDistance(reversed(-20), true)).toBe(20);
  });

  test('F3: a scroller that does not overflow is always at its newest end', () => {
    const short = { scrollTop: 0, scrollHeight: 400, clientHeight: 400 };
    expect(newestEndDistance(short, false)).toBe(0);
    expect(newestEndDistance(short, true)).toBe(0);
  });

  test('the follow band is the documented threshold', () => {
    expect(FOLLOW_THRESHOLD).toBe(80);
    expect(newestEndDistance(normal(600 - FOLLOW_THRESHOLD + 1), false)).toBeLessThan(FOLLOW_THRESHOLD);
    expect(newestEndDistance(normal(600 - FOLLOW_THRESHOLD), false)).toBe(FOLLOW_THRESHOLD);
  });
});

describe('scrollToNewest', () => {
  test('F4: each convention jumps to its own newest edge', () => {
    const a = normal(0);
    scrollToNewest(a as unknown as HTMLElement, false);
    expect(a.scrollTop).toBe(1000);
    const b = reversed(-600);
    scrollToNewest(b as unknown as HTMLElement, true);
    expect(b.scrollTop).toBe(0);
  });
});