// Retained-mount lifecycle for overlay enter/exit transitions (issue #73).
// The official sheet animates overlays with manual opacity/transform state
// pairs (transition-[opacity,visibility] shape), not mount keyframes alone —
// so a closing overlay stays mounted under data-overlay-state="closed"
// until its exit transition ends, then unmounts. Reopening mid-exit cancels
// the timer and transitions back from the closed style.
import { useEffect, useRef, useState } from 'react';

/** Exit transition lengths; keep in step with motion.css (--dur-fast /
 *  --dur-overlay / --dur-drawer): the retained element unmounts when its
 *  exit transition ends, and the wrapper's visibility flip waits the same
 *  span via --exit-ms. */
export const OVERLAY_EXIT_MS = 150;
export const FADE_EXIT_MS = 200;
export const DRAWER_EXIT_MS = 300;

export interface OverlayMount {
  mounted: boolean;
  state: 'open' | 'closed';
}

export function useOverlayMount(open: boolean, exitMs = OVERLAY_EXIT_MS): OverlayMount {
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<'open' | 'closed'>(open ? 'open' : 'closed');
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (open) {
      setMounted(true);
      setState('open');
      return;
    }
    setState('closed');
    if (!mounted) return;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setMounted(false);
    }, exitMs);
  }, [open, mounted, exitMs]);

  useEffect(() => {
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    };
  }, []);

  return { mounted, state };
}
