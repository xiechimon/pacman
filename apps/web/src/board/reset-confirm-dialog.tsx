// 任务重置确认 dialog（#755，todos.dev 看板指南「已开始的卡片拖回待开始会
// 重置任务：中断构建并清空对话、方案和改动记录」）：accept/stop-confirm
// 同族——头 + 清空清单 + 保留清单 + footer 取消/确认重置。取消 = 零提交
// （board.tsx 落位路由在 opened 前不写任何乐观值）；stale = 构建在 dialog
// 打开后推进了，弹层不关、清单按现记录刷新、顶部显变化提示重新确认。

import { Button } from '../components/ui/button.js';
import { DialogShell } from '../components/ui/dialog-shell.js';
import { ACCEPT_CANCEL_BTN, ACCEPT_FOOTER } from '../detail/accept-dialog.js';
import { useI18n } from '../i18n/provider.js';

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
      // 挂账（#1004 PR body / thread report task #5）：等 #1006 的 registry
      // dialog-shell 进 main 并合入本分支后，剥本消费点自携垫（body
      // px-4 pt-[17px]、footer ACCEPT_FOOTER 的 px/py）改裸内容进
      // DialogFooter 防双垫，并撤 ACCEPT_FOOTER / ACCEPT_CANCEL_BTN 的
      // import。此刻不做：L3 的 registry 壳尚未进 main，现在剥会指向不存在
      // 的形态。
      footer={
        <div className={ACCEPT_FOOTER}>
          <Button variant="ghost" className={ACCEPT_CANCEL_BTN} onClick={onClose}>
            {t('取消')}
          </Button>
          <Button
            variant="ghost"
            className="h-auto rounded-none p-0 text-[length:inherit] leading-[inherit] font-normal hover:bg-transparent hover:text-inherit active:not-aria-[haspopup]:translate-y-0"
            onClick={onConfirm}
            disabled={confirming === true}
          >
            {t('确认重置')}
          </Button>
        </div>
      }
    >
      {/* #951（overlays.css 清零）：#755 重置面律等值迁 utility——accept 同族
          行容器是横向 flex（checkbox 行形态），重置面内容纵 stacked：block +
          17/16 垫（原 .dlg-reset .dlg-accept 覆写）；文字四档 12/16 tertiary
          （stale/kept）、13/18 primary（lead）、13/20 disc 清单。dlg-reset /
          dlg-reset-confirm 类名钩退役（board-dnd 载体换 role=dialog 可及名，
          同 PR 重钉；confirm 钩全仓零规则零 pin）。 */}
      <div className="block px-4 pt-[17px]">
        {stale === true && (
          <p className="m-0 mb-2 text-xs leading-4 text-(--text-tertiary)">
            {t('任务在你打开确认框后发生了变化，下面是最新状态，请重新确认。')}
          </p>
        )}
        <p className="m-0 mb-1.5 text-[13px] leading-[18px] text-(--foreground)">
          {t('以下内容将被清空，无法恢复：')}
        </p>
        <ul className="m-0 mb-1.5 list-disc pl-[18px] text-[13px] leading-5 text-(--foreground)">
          <li>{t('中断运行中的构建（在线的执行机即时中断；离线机器的残留进程够不着）')}</li>
          <li>{t('清空对话记录')}</li>
          <li>{t('清空方案版本')}</li>
          <li>{t('清空改动记录')}</li>
        </ul>
        <p className="m-0 text-xs leading-4 text-(--text-tertiary)">
          {t(
            '保留：标题、需求说明、标签与人员指派。运行历史保留，可供审计。执行机工作区文件不受影响。',
          )}
        </p>
      </div>
    </DialogShell>
  );
}
