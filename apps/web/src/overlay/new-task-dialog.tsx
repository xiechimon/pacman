// New-task dialog (issue #66, r7 04/14): 672×439 centered modal over the
// board. Head = project chip + centered 新建任务 + close; body = title
// input (placeholder 需要做什么？) over the five-line spec template;
// footer = 标签 row + composer-style toolbar + 保存 / 保存并开始.
// 04 vs 14: the primary button sits disabled (washed indigo) until the
// title carries text. Fixture phase: saving appends the todo to the
// board's client-side set (r2 §4.2 count coupling, 刚刚 label); the
// start-task overlay behind 保存并开始 is a later ticket (03 §M0+).

import { useEffect, useRef, useState } from 'react';
import { PROJECT_INITIAL, PROJECT_NAME } from '../fixtures/fixtures.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronDown, Grid2x2, Mic, Paperclip, PlusSmall, X } from '../icons/index.js';
import { OverlayMount } from '../overlays/dismiss.js';
import { useEscClose } from './use-esc.js';
import { FADE_EXIT_MS } from './use-overlay-mount.js';
import './overlay.css';

/** Spec textarea template lines, verbatim r2 §5.2 / r7 04 placeholder
 *  block — dict keys so the en fallback carries them too. */
const SPEC_TEMPLATE_LINES = [
  '我想要的结果：',
  '现在的情况：',
  '需要保留或避免：',
  '我会这样确认完成：',
  '我希望收到：',
];

interface NewTaskDialogProps {
  /** #73: retained-mount open flag — the exit fade outlives the close. */
  open: boolean;
  onClose: () => void;
  onSave: (title: string) => void;
}

export function NewTaskDialog({ open, onClose, onSave }: NewTaskDialogProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  useEscClose(onClose, open);
  // retained mount means reopen is not a remount — refocus like a fresh one
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  const save = () => onSave(title.trim());
  return (
    <OverlayMount open={open} exitMs={FADE_EXIT_MS}>
      <button
        type="button"
        className="overlay-backdrop anim-fade"
        aria-label={t('关闭')}
        onClick={onClose}
      />
      <div
        className="new-task-dialog anim-fade"
        role="dialog"
        aria-modal="true"
        aria-label={t('新建任务')}
      >
        <div className="new-task-head">
          <button type="button" className="new-task-project">
            <span className="new-task-project-avatar">{PROJECT_INITIAL}</span>
            <span className="new-task-project-name">{PROJECT_NAME}</span>
            <ChevronDown width={12} height={12} />
          </button>
          <div className="new-task-title-label">{t('新建任务')}</div>
          <button type="button" className="new-task-close" aria-label={t('关闭')} onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="new-task-body">
          <input
            ref={inputRef}
            className="new-task-input"
            placeholder={t('需要做什么？')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="new-task-spec"
            placeholder={SPEC_TEMPLATE_LINES.map((line) => t(line)).join('\n')}
          />
        </div>
        <div className="new-task-footer">
          <div className="new-task-tags">
            {t('标签')}
            <button type="button" className="new-task-tag-add" aria-label={t('添加标签')}>
              <PlusSmall />
            </button>
          </div>
          <div className="new-task-actions">
            <div className="new-task-tools">
              <button type="button" aria-label={t('语音输入')}>
                <Mic />
              </button>
              <button type="button" aria-label={t('添加附件')}>
                <Paperclip />
              </button>
              <button type="button" aria-label={t('提及')}>
                <Grid2x2 />
              </button>
            </div>
            <div className="new-task-buttons">
              <button type="button" className="new-task-save" onClick={save}>
                {t('保存')}
              </button>
              <button
                type="button"
                className="new-task-start"
                disabled={title.trim() === ''}
                onClick={save}
              >
                {t('保存并开始')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </OverlayMount>
  );
}
