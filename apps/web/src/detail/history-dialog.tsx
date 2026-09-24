// 运行历史 dialog (issue #68, r7 32 + r8 80): 448-wide centered — header +
// divider, then one row per run: status glyph (ring / × / check),
// `第 N 次运行` + 当前 chip on the current row, dim meta line. Row height
// follows the content: single row 133 (r7 32), four rows 292 (r8 80).
// The footer 重跑 action renders only when the current run is the failed
// one (r8 57); a failed past run under a live current run carries none
// (r8 77/80). r7 32's single current row therefore stays button-free.

import type { RunHistoryRow } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { Check, X } from '../icons/index.js';
import { DialogShell } from './dialog-shell.js';

/** Row glyph per run status (r7 32 ring; r8 80 × / check). */
function RunGlyph({ status }: { status: RunHistoryRow['status'] }) {
  if (status === 'current') return <span className="dlg-history-ring" />;
  if (status === 'failed' || status === 'failed-current')
    return <X width={14} height={14} className="dlg-history-glyph dlg-history-glyph--failed" />;
  return <Check width={14} height={14} className="dlg-history-glyph dlg-history-glyph--done" />;
}

interface HistoryDialogProps {
  runs: RunHistoryRow[];
  /** #73 retained-mount open flag. */
  open?: boolean;
  onClose: () => void;
}

export function HistoryDialog({ runs, open, onClose }: HistoryDialogProps) {
  const { t } = useI18n();
  const rerunnable = runs.some((run) => run.status === 'failed-current');
  return (
    <DialogShell
      title={t('运行历史')}
      open={open}
      onClose={onClose}
      footer={
        rerunnable ? (
          <div className="dlg-history-footer">
            <button type="button" className="dlg-history-rerun" onClick={onClose}>
              {t('重跑')}
            </button>
          </div>
        ) : undefined
      }
    >
      {/* #193: rows are unbounded — they scroll in .dlg-body while a pinned
          重跑 footer stays put; --foot swaps the bottom padding so the
          spacing above the button is the same scrolled or not. */}
      <div className={`dlg-history${rerunnable ? ' dlg-history--foot' : ''}`}>
        {runs.map((run) => (
          <div key={run.label} className="dlg-history-row">
            <RunGlyph status={run.status} />
            <div className="dlg-history-text">
              <div className="dlg-history-line">
                <span className="dlg-history-label">{t(run.label)}</span>
                {(run.status === 'current' || run.status === 'failed-current') && (
                  <span className="dlg-history-chip">{t('当前')}</span>
                )}
              </div>
              <div className="dlg-history-meta">{t(run.meta)}</div>
            </div>
          </div>
        ))}
      </div>
    </DialogShell>
  );
}
