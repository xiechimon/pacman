// 验收确认 dialog (issue #68, r7 34): 448×143 centered over the board (and
// the detail header 完成 button) — `完成任务` header, the merge checkbox
// checked by default (`将改动合并到默认分支`), footer 取消 + 完成. Fixture
// phase: 完成 closes the dialog, no state transition yet (M5 cuts the
// fixture cord).

import { useState } from 'react';
import { Button } from '../components/ui/button.js';
import { DialogShell } from '../components/ui/dialog-shell.js';
import { useI18n } from '../i18n/provider.js';
import { CheckWhite } from '../icons/index.js';
import './overlays.css';

interface AcceptDialogProps {
  /** #73 retained-mount open flag. */
  open?: boolean;
  onClose: () => void;
  /** M5 live 面：完成 = merge 202 delegated（r3 §3.6）；缺省 = fixture
   *  行为（关闭即止）。 */
  onConfirm?: () => void;
}

export function AcceptDialog({ open, onClose, onConfirm }: AcceptDialogProps) {
  const { t } = useI18n();
  const [merge, setMerge] = useState(true);
  return (
    <DialogShell
      title={t('完成任务')}
      open={open}
      onClose={onClose}
      footer={
        <div className="dlg-accept-footer">
          {/* XMON-24：裸钮切 shadcn ghost——皮肤全在 .dlg-accept-cancel
              per-face（unlayered 压底座），utilities 只清 h-8/text-sm/
              active 位移这些底座差额。 */}
          <Button
            variant="ghost"
            className="dlg-accept-cancel h-auto rounded-none p-0 text-[13px] font-normal hover:bg-transparent active:not-aria-[haspopup]:translate-y-0"
            onClick={onClose}
          >
            {t('取消')}
          </Button>
          <Button
            variant="brand"
            className="dlg-accept-done h-7 border-none text-[13px] font-normal cursor-pointer active:not-aria-[haspopup]:translate-y-0"
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
    </DialogShell>
  );
}
