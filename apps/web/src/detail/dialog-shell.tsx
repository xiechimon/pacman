// Centered modal dialog shell (issue #68, r7 §3.5): 448-wide panel centered
// on both axes over a 60% black backdrop (sampled r7 30: #faf7f3 → #646361).
// Default header: 48px, left title + 16px close glyph, 1px divider. The
// 分支与PR dialog passes `headerCenter` (centered segmented tab row) and
// drops title + divider (r7 31). Esc and backdrop click close; only hits
// landing on the backdrop itself dismiss.

import { type ReactNode, useEffect } from 'react';
import { useI18n } from '../i18n/provider.js';
import { X } from '../icons/index.js';
import { FADE_EXIT_MS } from '../overlay/use-overlay-mount.js';
import { OverlayMount } from '../overlays/dismiss.js';
import './overlays.css';

interface DialogShellProps {
  /** Left header title; absent when `headerCenter` renders instead. */
  title?: string;
  /** Centered header content (segmented tabs, r7 31). */
  headerCenter?: ReactNode;
  /** #73 retained-mount open flag; the exit fade outlives the close. */
  open?: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function DialogShell({
  title,
  headerCenter,
  open = true,
  onClose,
  children,
}: DialogShellProps) {
  const { t } = useI18n();
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  // backdrop click closes; Esc is the keyboard path (handler above), so
  // the click surface carries no key handler of its own; titles arrive
  // pre-translated from the call sites (#74), so the shell renders them raw
  return (
    <OverlayMount open={open} exitMs={FADE_EXIT_MS}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Esc closes — see comment */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop is a click-to-dismiss surface */}
      <div
        className="dlg-backdrop anim-fade"
        onClick={(event) => {
          // only the backdrop itself dismisses; panel clicks bubble harmlessly
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div className="dlg" role="dialog" aria-modal="true" aria-label={title}>
          <div className={`dlg-head${headerCenter != null ? ' dlg-head--plain' : ''}`}>
            {title != null && <span className="dlg-title">{title}</span>}
            {headerCenter}
            <button type="button" className="dlg-close" aria-label={t('关闭')} onClick={onClose}>
              <X width={16} height={16} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </OverlayMount>
  );
}
