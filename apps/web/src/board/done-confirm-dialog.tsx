// 已完成确认 dialog（#901，#892 §6 建议 2）：闸相位（confirm/review）且有
// 变更产物的卡拖向 已完成 = 跳过两道硬闸的全部语义（不发起合并、无机器
// 落地步），要求显式确认——复用 #755 reset 闸形态（DialogShell + 头 + 说明
// 清单 + footer 取消/确认）。取消 = 零提交（board.tsx 落位路由在 opened 前
// 不写任何乐观值）；确认 = 既有 handlePhaseDrop 提交路（fixture 本地集 /
// live 乐观 PATCH），server 侧同落审计行（todos.ts updateTodo #902，raw
// PATCH 绕弹层同样有痕）。

import { Button } from '../components/ui/button.js';
import { DialogShell } from '../components/ui/dialog-shell.js';
import { ACCEPT_CANCEL_BTN, ACCEPT_FOOTER } from '../detail/accept-dialog.js';
import { useI18n } from '../i18n/provider.js';

interface DoneConfirmDialogProps {
  /** #73 retained-mount open flag. */
  open?: boolean;
  onClose: () => void;
  /** 确认 = 既有 handlePhaseDrop 乐观提交路（同步落位 + 后台 PATCH），无
   *  在飞态可禁——与 reset 闸的异步确认面不同，不设 confirming 位。 */
  onConfirm: () => void;
}

export function DoneConfirmDialog({ open, onClose, onConfirm }: DoneConfirmDialogProps) {
  const { t } = useI18n();
  return (
    <DialogShell
      title={t('把任务标记为已完成？')}
      open={open}
      onClose={onClose}
      footer={
        <div className={ACCEPT_FOOTER}>
          <Button variant="ghost" className={ACCEPT_CANCEL_BTN} onClick={onClose}>
            {t('取消')}
          </Button>
          <Button
            variant="ghost"
            className="h-auto rounded-none p-0 text-[length:inherit] leading-[inherit] font-normal hover:bg-transparent hover:text-inherit active:not-aria-[haspopup]:translate-y-0"
            onClick={onConfirm}
          >
            {t('确认完成')}
          </Button>
        </div>
      }
    >
      {/* 几何/字档 = reset-confirm-dialog 同族（#951 overlays.css 清零后的
          utility 形态）：内容纵 stacked，13/18 primary 主句、13/20 disc
          清单、12/16 tertiary 尾注。 */}
      <div className="block px-4 pt-[17px]">
        <p className="m-0 mb-1.5 text-[13px] leading-[18px] text-(--text-primary)">
          {t('这张卡有正在验收的变更产物，直接拖到已完成会跳过合并：')}
        </p>
        <ul className="m-0 mb-1.5 list-disc pl-[18px] text-[13px] leading-5 text-(--text-primary)">
          <li>{t('变更不会合入默认分支；已开出的 PR 保持原状')}</li>
          <li>{t('任务立即进入已完成列，不再等待验收')}</li>
        </ul>
        <p className="m-0 text-xs leading-4 text-(--text-tertiary)">
          {t('本次操作会记入任务时间线。需要合入变更时，请取消并改用卡片上的 完成 按钮走合并。')}
        </p>
      </div>
    </DialogShell>
  );
}
