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
  /** XMON-89 前置检查：执行 Agent 缺这几项授权（detail/merge-gate.ts 的
   *  missingMergeTools）。非空 = 完成禁用 + 写明缺哪项——点得动才谈得上
   *  「点了没反应」，禁掉它并把原因写在旁边是同一件事的两半。 */
  missingTools?: string[];
  /** XMON-89 服务端拒绝文案：非空 = 弹层不关、把这句话显在勾选行下方。
   *  改之前两处 merge 都是裸 mutate() + 立即关弹层，403 被静默吞掉——用户
   *  看到弹层关了、然后无事发生。 */
  rejectReason?: string | null;
}

export function AcceptDialog({
  open,
  onClose,
  onConfirm,
  missingTools,
  rejectReason,
}: AcceptDialogProps) {
  const { t } = useI18n();
  const [merge, setMerge] = useState(true);
  const blocked = (missingTools?.length ?? 0) > 0;
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
            disabled={blocked}
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
      {blocked && (
        <p className="dlg-accept-block">
          {t('缺少「{tools}」授权，无法合并。请在该 Agent 的权限里开启。', {
            tools: (missingTools ?? []).join('、'),
          })}
        </p>
      )}
      {rejectReason != null && (
        <p className="dlg-accept-reject" role="alert">
          {rejectReason}
        </p>
      )}
    </DialogShell>
  );
}
