// Delete confirm (issue #66, r7 25): 448×142 centered modal. Head row
// 确定删除…？此操作不可撤销。 + close over a divider; summary row (the
// doomed entity's label); right-aligned 取消 / 删除 (danger). Copy verbatim
// r2 §5.4 / r6 §4.2 — unchanged across r5b→r7.
// #306 generalization: title/summary/ariaLabel are caller-supplied — the
// schedule card menu rides the same family shape (确定删除该定时…) while
// the todo caller keeps the r7 25 canon word for word.
// A4-deep 收编：删除钮 = ui/Button danger（.delete-confirm-delete 类名
// 保留为 e2e 定位别名，project-settings-delete.spec.ts；禁用降透明度由
// 原语 danger:disabled 承载）。取消钮 = ui/Button quiet（r7 25 canon 的
// 无框弱文字形态即该变体实测源；类名保留为 e2e 定位别名）。

import type { ReactNode } from 'react';
import { useI18n } from '../i18n/provider.js';
import { X } from '../icons/index.js';
import { OverlayMount } from '../overlays/dismiss.js';
import { Button } from '../ui/button.js';
import { useEscClose } from './use-esc.js';
import { FADE_EXIT_MS } from './use-overlay-mount.js';
import './overlay.css';

interface DeleteConfirmProps {
  /** Head title — the caller's canon copy (task: 确定删除该任务…). */
  title: string;
  /** Summary row: the doomed entity's label (task: #seq + title). */
  summary: ReactNode;
  /** Dialog aria-label (task: 删除任务). */
  ariaLabel: string;
  /** #73: retained-mount open flag — the exit fade outlives the close. */
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteConfirm({
  title,
  summary,
  ariaLabel,
  open,
  onClose,
  onConfirm,
}: DeleteConfirmProps) {
  const { t } = useI18n();
  useEscClose(onClose, open);
  return (
    <OverlayMount open={open} exitMs={FADE_EXIT_MS}>
      <button
        type="button"
        className="overlay-backdrop anim-fade"
        aria-label={t('关闭')}
        onClick={onClose}
      />
      <div
        className="delete-confirm anim-fade"
        role="alertdialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        <div className="delete-confirm-head">
          <div className="delete-confirm-title">{title}</div>
          <button
            type="button"
            className="delete-confirm-close"
            aria-label={t('关闭')}
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        <div className="delete-confirm-summary">{summary}</div>
        <div className="delete-confirm-actions">
          <Button variant="quiet" className="delete-confirm-cancel" onClick={onClose}>
            {t('取消')}
          </Button>
          <Button
            variant="danger"
            size="standard"
            className="delete-confirm-delete"
            onClick={onConfirm}
          >
            {t('删除')}
          </Button>
        </div>
      </div>
    </OverlayMount>
  );
}
