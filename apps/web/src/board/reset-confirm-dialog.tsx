// 任务重置确认 dialog（#755，todos.dev 看板指南「已开始的卡片拖回待开始会
// 重置任务：中断构建并清空对话、方案和改动记录」）：accept/stop-confirm
// 同族——头 + 清空清单 + 保留清单 + footer 取消/确认重置。取消 = 零提交
// （board.tsx 落位路由在 opened 前不写任何乐观值）；stale = 构建在 dialog
// 打开后推进了，弹层不关、清单按现记录刷新、顶部显变化提示重新确认。

import { Button } from '../components/ui/button.js';
import { DialogShell } from '../components/ui/dialog-shell.js';
import { useI18n } from '../i18n/provider.js';
import '../detail/overlays.css';

interface ResetConfirmDialogProps {
  /** #73 retained-mount open flag. */
  open?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** 确认在飞（重置请求已发出）：确认钮禁用，弹层不关。 */
  confirming?: boolean;
  /** 构建在 dialog 打开后推进了：清单已按现记录刷新，顶部显变化提示。 */
  stale?: boolean;
}

export function ResetConfirmDialog({
  open,
  onClose,
  onConfirm,
  confirming,
  stale,
}: ResetConfirmDialogProps) {
  const { t } = useI18n();
  return (
    <DialogShell
      title={t('把任务重置回待开始？')}
      open={open}
      onClose={onClose}
      className="dlg-reset"
      footer={
        <div className="dlg-accept-footer">
          <Button
            variant="ghost"
            className="dlg-accept-cancel h-auto rounded-none p-0 text-[13px] font-normal hover:bg-transparent active:not-aria-[haspopup]:translate-y-0"
            onClick={onClose}
          >
            {t('取消')}
          </Button>
          <Button
            variant="ghost"
            className="dlg-reset-confirm h-auto rounded-none p-0 text-[length:inherit] leading-[inherit] font-normal hover:bg-transparent hover:text-inherit active:not-aria-[haspopup]:translate-y-0"
            onClick={onConfirm}
            disabled={confirming === true}
          >
            {t('确认重置')}
          </Button>
        </div>
      }
    >
      <div className="dlg-accept">
        {stale === true && (
          <p className="dlg-reset-stale">
            {t('任务在你打开确认框后发生了变化，下面是最新状态，请重新确认。')}
          </p>
        )}
        <p className="dlg-reset-lead">{t('以下内容将被清空，无法恢复：')}</p>
        <ul className="dlg-reset-list">
          <li>{t('中断运行中的构建（在线的执行机即时中断；离线机器的残留进程够不着）')}</li>
          <li>{t('清空对话记录')}</li>
          <li>{t('清空方案版本')}</li>
          <li>{t('清空改动记录')}</li>
        </ul>
        <p className="dlg-reset-kept">
          {t(
            '保留：标题、需求说明、标签与人员指派。运行历史保留，可供审计。执行机工作区文件不受影响。',
          )}
        </p>
      </div>
    </DialogShell>
  );
}
