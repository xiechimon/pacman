// Shared chat-follow rule (#873): one source for how every chat scroller
// tracks new rows — the detail transcript column (`.chat-col`, a
// `column-reverse` scroller) and the chief drawer body (`.chief-body`, a
// normal one). Before this, the chief had a bespoke effect and the detail
// relied on the reversed layout alone, so the two surfaces answered "does
// the view follow?" differently.
//
// The rule, in one place:
//   - growth drags the view only while the reader is already at the newest
//     end (never yank someone reading history back down);
//   - the reader's OWN send always wins: it jumps to the newest, because the
//     message they just wrote is the one thing they must see.
//
// Failure ways enumerated before the code:
//   F1 the reader scrolls up to read history and every new row yanks them
//      down (the reason a threshold exists at all);
//   F2 the reader sends a message while scrolled up and never sees it — the
//      reported「点击之后需要有那种自动往下的操作」;
//   F3 the threshold is computed with the wrong axis on a reversed scroller,
//      so "at the newest end" is always false and the view never follows.

import { type RefObject, useCallback, useEffect, useRef } from 'react';

/** How close to the newest end still counts as "following". */
export const FOLLOW_THRESHOLD = 80;

/** Distance in px from the newest row, in either scroll convention.
 *  A `column-reverse` scroller anchors its scroll origin at the newest row
 *  (scrollTop 0 there, negative as the reader walks back), so |scrollTop| is
 *  that distance; a normal scroller measures it from the far end. */
export function newestEndDistance(
  el: { scrollTop: number; scrollHeight: number; clientHeight: number },
  reversed: boolean,
): number {
  const span = Math.max(0, el.scrollHeight - el.clientHeight);
  const offset = reversed ? Math.min(Math.abs(el.scrollTop), span) : el.scrollTop;
  return reversed ? offset : Math.max(0, span - offset);
}

export function scrollToNewest(el: HTMLElement, reversed: boolean): void {
  el.scrollTop = reversed ? 0 : el.scrollHeight;
}

export interface ChatFollowOptions {
  ref: RefObject<HTMLElement | null>;
  /** Changes whenever the stream grows (row count, live text, …). */
  dep: unknown;
  /** True for a `column-reverse` scroller (the detail transcript column). */
  reversed: boolean;
  /** False while the surface is closed (chief drawer shut): no scrolling. */
  active?: boolean;
  /** Change of this value always snaps to the newest (drawer opened, thread
   *  switched) — a conversation opens on its latest row. */
  resetDep?: unknown;
}

export function useChatFollow({ ref, dep, reversed, active = true, resetDep }: ChatFollowOptions): {
  requestFollow: () => void;
} {
  const stick = useRef(true);
  const forced = useRef(false);
  const bound = useRef<{ el: HTMLElement; onScroll: () => void } | null>(null);

  // The scroller mounts late on both surfaces (the detail column only exists
  // once the transcript does; the chief body lives in a retained-mount drawer
  // that renders first). So the listener is bound lazily, from whichever
  // effect runs after the node exists, and re-bound if the node is replaced —
  // an unbound listener leaves `stick` stuck at its initial true and every
  // growth yanks a reader who had scrolled away.
  const bind = useCallback((): HTMLElement | null => {
    const el = ref.current;
    if (el == null) return null;
    if (bound.current?.el !== el) {
      if (bound.current != null) {
        bound.current.el.removeEventListener('scroll', bound.current.onScroll);
      }
      const onScroll = () => {
        stick.current = newestEndDistance(el, reversed) < FOLLOW_THRESHOLD;
      };
      el.addEventListener('scroll', onScroll, { passive: true });
      bound.current = { el, onScroll };
      onScroll();
    }
    return el;
  }, [ref, reversed]);

  useEffect(
    () => () => {
      if (bound.current != null) {
        bound.current.el.removeEventListener('scroll', bound.current.onScroll);
        bound.current = null;
      }
    },
    [],
  );

  // `resetDep` rides the dependency array deliberately: the effect body does
  // not read it, the change of it IS the action (open, thread switch).
  useEffect(() => {
    if (!active) return;
    const el = bind();
    if (el == null) return;
    stick.current = true;
    scrollToNewest(el, reversed);
  }, [reversed, active, resetDep, bind]);

  // Same shape for `dep`: growth is what the effect is about, and the reader's
  // position (`stick`) is read from a ref so it never re-triggers the scroll.
  useEffect(() => {
    if (!active) return;
    const el = bind();
    if (el == null) return;
    if (!stick.current && !forced.current) return;
    forced.current = false;
    scrollToNewest(el, reversed);
  }, [reversed, active, dep, bind]);

  const requestFollow = () => {
    forced.current = true;
    const el = bind();
    if (el != null) scrollToNewest(el, reversed);
  };
  return { requestFollow };
}
