// 验收确认 dialog (issue #68, r7 34): 448×143 centered over the board (and
// the detail header 完成 button) — `完成任务` header, the merge checkbox
// checked by default (`将改动合并到默认分支`), footer 取消 + 完成. Fixture
// phase: 完成 closes the dialog, no state transition yet (M5 cuts the
// fixture cord).

import { useState } from 'react';
import { DialogShell } from '../components/ui/dialog-shell.js';
import { useI18n } from '../i18n/provider.js';
import { CheckWhite } from '../icons/index.js';
import { Button } from '../ui/button.js';
import './overlays.css';

interface AcceptDialogProps {
  /** #73 retained-mount open flag. */
  open?: boolean;
  onClose: () => void;
  /** M5 live 面：完成 = merge 202 delegated（r3 §3.6）；缺省 = fixture
   *  行为（关闭即止）。 */
  onConfirm?: () => void;
  /** XMON-26：merge 被拒（403 权限闸等）的行内错误文案——非空才显示，
   *  dialog 留开可重试；缺省 = 无错误面（fixture 字节形不变）。 */
  error?: string | null;
}

export function AcceptDialog({ open, onClose, onConfirm, error }: AcceptDialogProps) {
  const { t } = useI18n();
  const [merge, setMerge] = useState(true);
  return (
    <DialogShell
      title={t('完成任务')}
      open={open}
      onClose={onClose}
      footer={
        <div className="dlg-accept-footer">
          <button type="button" className="dlg-accept-cancel" onClick={onClose}>
            {t('取消')}
          </button>
          <Button
            variant="primary"
            size="compact"
            className="dlg-accept-done"
            onClick={() => {
              if (onConfirm) onConfirm();
              else onClose();
            }}
          >
            {t('完成')}
          </Button>
        </div>
      }
    >
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
      {error != null && error !== '' && (
        <div className="dlg-accept-error" role="alert">
          {error}
        </div>
      )}
    </DialogShell>
  );
}
