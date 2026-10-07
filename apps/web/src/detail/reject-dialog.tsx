// 审核关口打回弹层（#701 B-C12）：更多菜单「请求修改」的显式打回入口——
// 审核闸的「人看」半边必须能说不。形态随 dialog 家族律（DialogShell 448 +
// footer ghost 取消 / brand 确认，AcceptDialog 同款先例）；反馈必填——它是
// 重规划轮的工作指令，空稿不放行（restart「空消息不成发送」同律）。提交走
// 服务端动作面 POST /builds/{id}/steps {action:"revision"}（review→planning
// 边与 #330 自动回流共用）；被拒（409 竞态）弹层不关、原因显在输入行下方
// （XMON-89 教训：静默关掉 = 用户看到弹层关了然后无事发生）。

import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button.js';
import { DialogShell } from '../components/ui/dialog-shell.js';
import { Textarea } from '../components/ui/textarea.js';
import { useI18n } from '../i18n/provider.js';
import { ACCEPT_NOTE_LINE } from './accept-dialog.js';
import { FOCUS_ROW, FOCUS_TEXTAREA } from './review-dialog.js';

interface RejectDialogProps {
  /** #73 retained-mount open flag。 */
  open?: boolean;
  onClose: () => void;
  /** 确认 = revision 动作面（父持有 mutation）；缺省 = 静态面（关闭即止）。 */
  onConfirm?: (feedback: string) => void;
  /** 服务端拒绝原因：非空 = 弹层不关、显在输入行下方。 */
  rejectReason?: string | null;
}

export function RejectDialog({ open, onClose, onConfirm, rejectReason }: RejectDialogProps) {
  const { t } = useI18n();
  const [feedback, setFeedback] = useState('');
  // retained-mount 重开回空稿（ReviewDialog focus 同律）。
  useEffect(() => {
    if (open) setFeedback('');
  }, [open]);
  const trimmed = feedback.trim();
  const label = t('需要修改什么？打回后任务回到规划中，按反馈重新出方案。');
  return (
    // #951：dlg-reject / reject-confirm / reject-feedback-input 类名钩退役
    // （零规则死类；review-reject.spec 载体换 role=dialog 可及名 +
    // getByRole(button/textbox)，同 PR 重钉）。
    <DialogShell
      title={t('请求修改')}
      open={open}
      onClose={onClose}
      footer={
        // #945（正典表 §5.4，ReviewDialog 同款）：foot/actions 别名退役走
        // utility；取消钮 chief-dlg-ghost → Button outline 档。
        <div className="flex flex-col px-4 pb-4">
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              className="cursor-pointer active:not-aria-[haspopup]:translate-y-0"
              onClick={onClose}
            >
              {t('取消')}
            </Button>
            <Button
              variant="brand"
              className="h-7 border-none px-3 text-[13px] font-normal cursor-pointer active:not-aria-[haspopup]:translate-y-0"
              disabled={trimmed === ''}
              onClick={() => onConfirm?.(trimmed)}
            >
              {t('请求修改')}
            </Button>
          </div>
        </div>
      }
    >
      <div className={FOCUS_ROW}>
        {/* #945（正典表 §5.4）：.dlg-form-label 别名退役——标签律 =
            --label-size/--label-spacing 定版 token utility。 */}
        <span className="mt-[9px] mb-2 text-(length:--label-size) leading-[18px] tracking-(--label-spacing) text-(--foreground)">
          {label}
        </span>
        {/* #945（#851 裸控件账）：裸 textarea 收编 components/ui Textarea；
            #951：皮肤正本随 overlays.css 清零等值迁 FOCUS_TEXTAREA（与
            ReviewDialog focus 面同一单源）。 */}
        <Textarea
          className={FOCUS_TEXTAREA}
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          rows={3}
          placeholder={label}
        />
      </div>
      {rejectReason != null && (
        <p className={`${ACCEPT_NOTE_LINE} text-(--destructive)`} role="alert">
          {rejectReason}
        </p>
      )}
    </DialogShell>
  );
}
