// 验收确认 dialog (issue #68, r7 34): 448×143 centered over the board (and
// the detail header 完成 button) — `完成任务` header, the merge checkbox
// checked by default (`将改动合并到默认分支`), footer 取消 + 完成. Fixture
// phase: 完成 closes the dialog, no state transition yet (M5 cuts the
// fixture cord).

import { useState } from 'react';
import { useI18n } from '../i18n/provider.js';
import { CheckWhite } from '../icons/index.js';
import { DialogShell } from './dialog-shell.js';

interface AcceptDialogProps {
  onClose: () => void;
}

export function AcceptDialog({ onClose }: AcceptDialogProps) {
  const { t } = useI18n();
  const [merge, setMerge] = useState(true);
  return (
    <DialogShell title={t('完成任务')} onClose={onClose}>
      <div className="dlg-accept">
        <label className="dlg-accept-check" data-on={merge}>
          <input
            type="checkbox"
            checked={merge}
            onChange={(event) => setMerge(event.target.checked)}
          />
          <CheckWhite width={12} height={12} />
        </label>
        <span className="dlg-accept-label">{t('将改动合并到默认分支')}</span>
      </div>
      <div className="dlg-accept-footer">
        <button type="button" className="dlg-accept-cancel" onClick={onClose}>
          {t('取消')}
        </button>
        <button type="button" className="dlg-accept-done" onClick={onClose}>
          {t('完成')}
        </button>
      </div>
    </DialogShell>
  );
}
