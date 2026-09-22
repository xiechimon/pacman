// Delete confirm (issue #66, r7 25): 448×142 centered modal. Head row
// 确定删除该任务？此操作不可撤销。 + close over a divider; summary row
// #seq + title; right-aligned 取消 / 删除 (danger). Copy verbatim r2
// §5.4 / r6 §4.2 — unchanged across r5b→r7.

import type { TodoRecord } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { X } from '../icons/index.js';
import { useEscClose } from './use-esc.js';
import './overlay.css';

interface DeleteConfirmProps {
  todo: TodoRecord;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteConfirm({ todo, onClose, onConfirm }: DeleteConfirmProps) {
  const { t } = useI18n();
  useEscClose(onClose);
  return (
    <>
      <button type="button" className="overlay-backdrop" aria-label={t('关闭')} onClick={onClose} />
      <div
        className="delete-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('删除任务')}
      >
        <div className="delete-confirm-head">
          <div className="delete-confirm-title">{t('确定删除该任务？此操作不可撤销。')}</div>
          <button
            type="button"
            className="delete-confirm-close"
            aria-label={t('关闭')}
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        <div className="delete-confirm-summary">
          <span className="delete-confirm-seq">#{todo.seqNum}</span>
          {todo.title}
        </div>
        <div className="delete-confirm-actions">
          <button type="button" className="delete-confirm-cancel" onClick={onClose}>
            {t('取消')}
          </button>
          <button type="button" className="delete-confirm-delete" onClick={onConfirm}>
            {t('删除')}
          </button>
        </div>
      </div>
    </>
  );
}
