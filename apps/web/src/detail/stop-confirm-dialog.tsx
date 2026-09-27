// 停止确认 dialog（M7 #308，r9 §2.3/§3.3）：accept dialog 同族——
// 「停止当前这一轮？」头 + 默认勾选的丢弃复选行（「丢弃本轮修改——方案和
// 代码回到上一个版本」，勾选 = daemon 侧 rewind worktree 到步起点
// checkpoint）+ footer 取消/停止。仅 live 面接线（fixture 捕获面无后端，
// 停止钮不挂 handler，DOM 字节不变）。

import { useState } from 'react';
import { useI18n } from '../i18n/provider.js';
import { CheckWhite } from '../icons/index.js';
import { DialogShell } from '../ui/dialog-shell.js';
import './overlays.css';

interface StopConfirmDialogProps {
  /** #73 retained-mount open flag. */
  open?: boolean;
  onClose: () => void;
  /** 停止确认：discard = 复选位终值（POST /api/builds/{id}/stop body）。 */
  onConfirm: (discard: boolean) => void;
}

export function StopConfirmDialog({ open, onClose, onConfirm }: StopConfirmDialogProps) {
  const { t } = useI18n();
  // 默认勾选（r9 §2.3 实测：checkbox 选中态 = indigo 底 + 白勾）。
  const [discard, setDiscard] = useState(true);
  return (
    <DialogShell
      title={t('停止当前这一轮？')}
      open={open}
      onClose={onClose}
      footer={
        <div className="dlg-accept-footer">
          <button type="button" className="dlg-accept-cancel" onClick={onClose}>
            {t('取消')}
          </button>
          <button type="button" className="dlg-accept-done" onClick={() => onConfirm(discard)}>
            {t('停止')}
          </button>
        </div>
      }
    >
      <div className="dlg-accept">
        <label className="dlg-accept-check" data-on={discard}>
          <input
            type="checkbox"
            checked={discard}
            onChange={(event) => setDiscard(event.target.checked)}
          />
          <CheckWhite width={12} height={12} />
        </label>
        <span className="dlg-accept-label">{t('丢弃本轮修改——方案和代码回到上一个版本')}</span>
      </div>
    </DialogShell>
  );
}
