// 分支与 PR dialog (issue #68, r7 31): 448×409 centered, header carries the
// centered 同步到机器|Git segmented control instead of a title (no divider).
// Sync tab as captured: build-branch/target-commit box with copy buttons,
// 目标机器 pill (green dot + name + chevron), 同步目录 read-only path field,
// 强制同步 label + two-line description + off toggle, and the full-width
// disabled 同步 button (#a5a1ea light). The Git tab was never captured —
// [推断] minimal PR surface reusing the same box rows.

import { useState } from 'react';
import type { BranchInfoContent } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronDown, Copy } from '../icons/index.js';
import { DialogShell } from './dialog-shell.js';

interface BranchDialogProps {
  /** #73 retained-mount open flag. */
  open?: boolean;
  info: BranchInfoContent;
  onClose: () => void;
}

function CopyButton({ value }: { value: string }) {
  const { t } = useI18n();
  const copy = () => {
    void navigator.clipboard?.writeText(value).catch(() => {
      // clipboard unavailable (headless/permissions) — copy is best-effort
    });
  };
  return (
    <button type="button" className="dlg-copy" aria-label={t('复制')} onClick={copy}>
      <Copy width={14} height={14} />
    </button>
  );
}

export function BranchDialog({ info, open, onClose }: BranchDialogProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<'sync' | 'git'>('sync');
  const [force, setForce] = useState(false);

  const box = (
    <div className="dlg-branch-box">
      <div className="dlg-branch-row">
        <span className="dlg-branch-label">{t('构建分支')}</span>
        <span className="dlg-branch-value">{info.branch}</span>
        <CopyButton value={info.branch} />
      </div>
      <div className="dlg-branch-row">
        <span className="dlg-branch-label">{t('目标提交')}</span>
        <span className="dlg-branch-value">{info.commit}</span>
        <CopyButton value={info.commit} />
      </div>
    </div>
  );

  return (
    <DialogShell
      headerCenter={
        <div className="dlg-seg" role="tablist" aria-label={t('分支与 PR')}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'sync'}
            className="dlg-seg-tab"
            data-active={tab === 'sync'}
            onClick={() => setTab('sync')}
          >
            {t('同步到机器')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'git'}
            className="dlg-seg-tab"
            data-active={tab === 'git'}
            onClick={() => setTab('git')}
          >
            Git
          </button>
        </div>
      }
      open={open}
      onClose={onClose}
      footer={
        // #193: the sync tab's 同步 button rides the pinned shell footer;
        // the git tab carries no action and no footer.
        tab === 'sync' ? (
          <div className="dlg-branch-foot">
            <button type="button" className="dlg-sync" disabled>
              {t('同步')}
            </button>
          </div>
        ) : undefined
      }
    >
      {tab === 'sync' ? (
        <div className="dlg-branch-body dlg-branch-body--foot">
          {box}
          <div className="dlg-field-label">{t('目标机器')}</div>
          <button type="button" className="dlg-machine">
            <span className="dlg-machine-dot" />
            <span className="dlg-machine-name">{info.machine}</span>
            <ChevronDown width={12} height={12} />
          </button>
          <div className="dlg-field-label">{t('同步目录')}</div>
          <div className="dlg-dir">{info.directory}</div>
          <div className="dlg-force">
            <div className="dlg-force-text">
              <div className="dlg-field-label">{t('强制同步')}</div>
              <div className="dlg-force-desc">
                {t('丢弃代码修改并删除非忽略的未跟踪文件；保留忽略内容。仅本次生效。')}
              </div>
            </div>
            <label className="dlg-toggle" data-on={force}>
              <input
                type="checkbox"
                aria-label={t('强制同步')}
                checked={force}
                onChange={(event) => setForce(event.target.checked)}
              />
              <span className="dlg-toggle-knob" />
            </label>
          </div>
        </div>
      ) : (
        <div className="dlg-branch-body">
          {box}
          <div className="dlg-field-label">Pull Request</div>
          <div className="dlg-dir">{t('未创建')}</div>
        </div>
      )}
    </DialogShell>
  );
}
