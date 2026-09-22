// Token 用量 dialog (issue #68, r7 30): 448×256 centered — total row
// (24px figure + dim `tokens`), model row in mono, then the four
// input/output/cache stat rows. Dividers under the header, the total row
// and the model row (r7 30 scan: y 285/346/385).

import type { TokenUsageContent } from '../fixtures/records.js';
import { DialogShell } from './dialog-shell.js';

interface TokenDialogProps {
  /** #73 retained-mount open flag. */
  open?: boolean;
  stats: TokenUsageContent;
  onClose: () => void;
}

export function TokenDialog({ stats, open, onClose }: TokenDialogProps) {
  const rows: Array<[string, string]> = [
    ['输入', stats.input],
    ['输出', stats.output],
    ['缓存读取', stats.cacheRead],
    ['缓存写入', stats.cacheWrite],
  ];
  return (
    <DialogShell title="Token 用量" open={open} onClose={onClose}>
      <div className="dlg-token-total">
        <span className="dlg-token-num">{stats.total}</span>
        <span className="dlg-token-unit">tokens</span>
      </div>
      <div className="dlg-token-model">
        <span className="dlg-token-model-name">{stats.model}</span>
        <span className="dlg-token-model-total">{stats.modelTotal}</span>
      </div>
      <div className="dlg-token-rows">
        {rows.map(([label, value]) => (
          <div key={label} className="dlg-token-row">
            <span className="dlg-token-label">{label}</span>
            <span className="dlg-token-value">{value}</span>
          </div>
        ))}
      </div>
    </DialogShell>
  );
}
