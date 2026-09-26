// Delete project confirm (#207 删除区复活, r2 24d): DeleteConfirm 家族同形
// — 448 居中弹层、head + divider、项目名摘要、右对齐 取消/删除(danger) —
// 加键入项目名确认行:输入与项目名精确匹配才解禁删除钮(误删闸门,票面
// 「确认输入不匹配禁用」)。级联语义不在本层——server services/projects.ts
// 单源(#189);本层只管确认形状与闸门。
// A3-overlays 收编：删除钮 = ui/Button danger（类别名/禁用形态处置同
// delete-confirm.tsx 头注）。

import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/provider.js';
import { X } from '../icons/index.js';
import { OverlayMount } from '../overlays/dismiss.js';
import { Button } from '../ui/button.js';
import { useEscClose } from './use-esc.js';
import { FADE_EXIT_MS } from './use-overlay-mount.js';
import './overlay.css';

interface DeleteProjectConfirmProps {
  /** 确认输入需精确匹配的项目名。 */
  projectName: string;
  /** #73: retained-mount open flag — the exit fade outlives the close. */
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteProjectConfirm({
  projectName,
  open,
  onClose,
  onConfirm,
}: DeleteProjectConfirmProps) {
  const { t } = useI18n();
  const [typed, setTyped] = useState('');
  useEscClose(onClose, open);
  // 每次重开回到空输入:关闭期 typed 随 retained mount 存活,不重置会让
  // 重开的弹层带着上一次的输入(闸门形同虚设)。
  useEffect(() => {
    if (open) setTyped('');
  }, [open]);
  const prompt = t('输入 {name} 以确认删除', { name: projectName });
  return (
    <OverlayMount open={open} exitMs={FADE_EXIT_MS}>
      <button
        type="button"
        className="overlay-backdrop anim-fade"
        aria-label={t('关闭')}
        onClick={onClose}
      />
      <div
        className="delete-confirm delete-confirm--project anim-fade"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('删除项目')}
      >
        <div className="delete-confirm-head">
          <div className="delete-confirm-title">{t('确定删除该项目？此操作不可撤销。')}</div>
          <button
            type="button"
            className="delete-confirm-close"
            aria-label={t('关闭')}
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        <div className="delete-confirm-summary">{projectName}</div>
        <div className="delete-confirm-prompt">{prompt}</div>
        <input
          className="delete-confirm-input"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          aria-label={prompt}
          autoComplete="off"
          spellCheck={false}
        />
        <div className="delete-confirm-actions">
          <button type="button" className="delete-confirm-cancel" onClick={onClose}>
            {t('取消')}
          </button>
          <Button
            variant="danger"
            size="standard"
            className="delete-confirm-delete"
            disabled={typed !== projectName}
            onClick={onConfirm}
          >
            {t('删除')}
          </Button>
        </div>
      </div>
    </OverlayMount>
  );
}
