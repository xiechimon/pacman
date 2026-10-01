// 停止确认 dialog（M7 #308，r9 §2.3/§3.3）：accept dialog 同族——
// 「停止当前这一轮？」头 + 默认勾选的丢弃复选行（「丢弃本轮修改——方案和
// 代码回到上一个版本」，勾选 = daemon 侧 rewind worktree 到步起点
// checkpoint）+ footer 取消/停止。仅 live 面接线（fixture 捕获面无后端，
// 停止钮不挂 handler，DOM 字节不变）。

import { useState } from 'react';
import { Button } from '../components/ui/button.js';
import { Checkbox } from '../components/ui/checkbox.js';
import { DialogShell } from '../components/ui/dialog-shell.js';
import { useI18n } from '../i18n/provider.js';
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
          {/* XMON-24：两钮切 shadcn ghost。取消皮肤在 .dlg-accept-cancel
              per-face；停止原本就是 preflight 复位的裸钮（透明/无边框/
              font:inherit + scoped 50 宽），utilities 逐条还原该形态。 */}
          <Button
            variant="ghost"
            className="dlg-accept-cancel h-auto rounded-none p-0 text-[13px] font-normal hover:bg-transparent active:not-aria-[haspopup]:translate-y-0"
            onClick={onClose}
          >
            {t('取消')}
          </Button>
          <Button
            variant="ghost"
            className="dlg-accept-done h-auto rounded-none p-0 text-[length:inherit] leading-[inherit] font-normal hover:bg-transparent hover:text-inherit active:not-aria-[haspopup]:translate-y-0"
            onClick={() => onConfirm(discard)}
          >
            {t('停止')}
          </Button>
        </div>
      }
    >
      <div className="dlg-accept">
        {/* XMON-72：与 accept-dialog 同族同病（.dlg-accept-check 不藏 input），
            一并收口 components/ui/checkbox 原语。 */}
        <Checkbox
          checked={discard}
          onCheckedChange={setDiscard}
          label={t('丢弃本轮修改——方案和代码回到上一个版本')}
        >
          <span className="dlg-accept-label">{t('丢弃本轮修改——方案和代码回到上一个版本')}</span>
        </Checkbox>
      </div>
    </DialogShell>
  );
}
