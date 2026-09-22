// Shared dismiss wiring for the anchored overlays (issue #67): Escape and
// outside-click close the chip popover and the 方案▾ dropdown the same way
// the ⌘K panel closes (useSearchState). The click catcher is a transparent
// fixed layer one step under the popover (z 29 vs 30) so page content stays
// clickable-through nowhere while an overlay is open. Close affordances are
// [推断] — no capture exercises them; pixels are unaffected.

import { type CSSProperties, type ReactNode, useEffect } from 'react';
import { OVERLAY_EXIT_MS, useOverlayMount } from '../overlay/use-overlay-mount.js';
import './overlays.css';

/** #73: retained-mount wrapper — children keep their fixed/absolute
 *  geometry (display:contents) while the exit transition plays. `exitMs`
 *  must match the family's exit transition (motion.css); it drives both
 *  the unmount timer and the wrapper's visibility flip via --exit-ms. */
export function OverlayMount({
  open,
  exitMs = OVERLAY_EXIT_MS,
  children,
}: {
  open: boolean;
  exitMs?: number;
  children: ReactNode;
}) {
  const { mounted, state } = useOverlayMount(open, exitMs);
  if (!mounted) return null;
  return (
    <div
      className="overlay-mount"
      data-overlay-state={state}
      style={{ '--exit-ms': `${exitMs}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}

export function useEscapeClose(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
}

export function ClickCatcher({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      className="overlay-click-catcher"
      tabIndex={-1}
      aria-hidden="true"
      onClick={onClose}
    />
  );
}
