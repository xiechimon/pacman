// DialogShell 原语（DESIGN.md 轨 A #A3）：自 detail/dialog-shell.tsx 提升，
// 行为不变——#68 居中弹窗壳（448 宽、60% 黑幕、48px 头 + 1px 分隔、Esc/背板
// 点击关闭）+ #193 viewport law（panel 为 head / 滚动 body / 钉底 foot 三段
// flex 列，高表单挤不出提交钮）。样式随 ./dialog.css 携带。
// 分支与PR dialog 传 headerCenter（居中分段 tab）并弃 title + 分隔线（r7 31）。

import { type ReactNode, useEffect } from 'react';
import { useI18n } from '../i18n/provider.js';
import { X } from '../icons/index.js';
import { FADE_EXIT_MS } from '../overlay/use-overlay-mount.js';
import { OverlayMount } from '../overlays/dismiss.js';
import './dialog.css';

interface DialogShellProps {
  /** Left header title; absent when `headerCenter` renders instead. */
  title?: string;
  /** Centered header content (segmented tabs, r7 31). */
  headerCenter?: ReactNode;
  /** #73 retained-mount open flag; the exit fade outlives the close. */
  open?: boolean;
  onClose: () => void;
  children: ReactNode;
  /** #193: pinned below the .dlg-body scroll region — submit/cancel rides
   *  here so a tall form scrolls the fields, never the buttons. The fragment
   *  keeps its own padding (family spacing stays per-face canon). */
  footer?: ReactNode;
  /** #309: face class on the .dlg panel — per-face geometry/CSS and the
   *  class-locator discipline (e2e pins) without touching the family base. */
  className?: string;
}

export function DialogShell({
  title,
  headerCenter,
  open = true,
  onClose,
  children,
  footer,
  className,
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
        <div
          className={className != null ? `dlg ${className}` : 'dlg'}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className={`dlg-head${headerCenter != null ? ' dlg-head--plain' : ''}`}>
            {title != null && <span className="dlg-title">{title}</span>}
            {headerCenter}
            <button type="button" className="dlg-close" aria-label={t('关闭')} onClick={onClose}>
              <X width={16} height={16} />
            </button>
          </div>
          <div className="dlg-body">{children}</div>
          {footer != null && <div className="dlg-foot">{footer}</div>}
        </div>
      </div>
    </OverlayMount>
  );
}
