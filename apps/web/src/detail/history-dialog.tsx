// 运行历史 dialog (issue #68, r7 32 + r8 80): 448-wide centered — header +
// divider, then one row per run: status glyph (ring / × / check),
// `第 N 次运行` + 当前 chip on the current row, dim meta line. Row height
// follows the content: single row 133 (r7 32), four rows 292 (r8 80).
// `重跑` stays hover-only and uncaptured (r7 §4.1.5).

import type { RunHistoryRow } from '../fixtures/records.js';
import { Check, X } from '../icons/index.js';
import { DialogShell } from './dialog-shell.js';

/** Row glyph per run status (r7 32 ring; r8 80 × / check). */
function RunGlyph({ status }: { status: RunHistoryRow['status'] }) {
  if (status === 'current') return <span className="dlg-history-ring" />;
  if (status === 'failed')
    return <X width={14} height={14} className="dlg-history-glyph dlg-history-glyph--failed" />;
  return <Check width={14} height={14} className="dlg-history-glyph dlg-history-glyph--done" />;
}

interface HistoryDialogProps {
  runs: RunHistoryRow[];
  onClose: () => void;
}

export function HistoryDialog({ runs, onClose }: HistoryDialogProps) {
  return (
    <DialogShell title="运行历史" onClose={onClose}>
      <div className="dlg-history">
        {runs.map((run) => (
          <div key={run.label} className="dlg-history-row">
            <RunGlyph status={run.status} />
            <div className="dlg-history-text">
              <div className="dlg-history-line">
                <span className="dlg-history-label">{run.label}</span>
                {run.status === 'current' && <span className="dlg-history-chip">当前</span>}
              </div>
              <div className="dlg-history-meta">{run.meta}</div>
            </div>
          </div>
        ))}
      </div>
    </DialogShell>
  );
}
