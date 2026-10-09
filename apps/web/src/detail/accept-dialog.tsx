// 验收确认 dialog (issue #68, r7 34): 448×143 centered over the board (and
// the detail header 完成 button) — `完成任务` header, the merge checkbox
// checked by default (`将改动合并到默认分支`), footer 取消 + 完成. Fixture
// phase: 完成 closes the dialog, no state transition yet (M5 cuts the
// fixture cord).

import { useState } from 'react';
import { Button } from '../components/ui/button.js';
import { Checkbox } from '../components/ui/checkbox.js';
import { DialogShell } from '../components/ui/dialog-shell.js';
import { useI18n } from '../i18n/provider.js';

// #1006 段 2（迁完即删）：#951 时代的 ACCEPT_* 同族律常量六枚随最后两个
// 消费点（board done-confirm / reset-confirm 的 #1004 挂账）清账退役——
// 全族皮肤收敛 registry DialogFooter band + Button outline/default/
// destructive 档（#980 前提②④）。

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
        // #1006 原型（#980 前提④）：footer = registry DialogFooter band
        // （件自带 border-t bg-muted/50 右对齐 gap-2），钮走 Button 默认档
        // ——取消 outline / 完成 default（家族律 #945 §5.4 的 registry 形态），
        // 冻结几何（50×28）与 ghost 中和皮肤退役。
        <>
          <Button variant="outline" onClick={onClose}>
            {t('取消')}
          </Button>
          <Button
            disabled={blocked}
            onClick={() => {
              if (onConfirm) onConfirm();
              else onClose();
            }}
          >
            {t('完成')}
          </Button>
        </>
      }
    >
      {/* XMON-72：复选行收口 components/ui/checkbox 原语（registry 同源件，
          行盒由消费点 label 承载——整行可点走 label 激活转发）。行垫随
          DialogContent p-4，行内 8 gap 是 layout 位。 */}
      <div className="flex items-center gap-2">
        {/* biome-ignore lint/a11y/noLabelWithoutControl: Base UI Checkbox.Root renders its hidden native input inside this label at runtime; the static check cannot see through the component. */}
        <label className="inline-flex cursor-pointer items-center gap-2">
          <Checkbox
            checked={merge}
            onCheckedChange={setMerge}
            aria-label={t('将改动合并到默认分支')}
          />
          <span>{t('将改动合并到默认分支')}</span>
        </label>
      </div>
      {blocked && (
        // XMON-89 缺项行：禁用态由 default disabled 档承载，本行只说「缺什么」。
        <p className="mt-2 text-xs leading-4 text-(--text-tertiary)">
          {t('缺少「{tools}」授权，无法合并。请在该 Agent 的权限里开启。', {
            tools: (missingTools ?? []).join('、'),
          })}
        </p>
      )}
      {rejectReason != null && (
        // XMON-89 server 拒绝行：destructive 与其余面级错误文案同色；
        // role=alert 是 e2e/读屏一级载体（#910 裁定 1）。
        <p className="mt-2 text-xs leading-4 text-(--destructive)" role="alert">
          {rejectReason}
        </p>
      )}
    </DialogShell>
  );
}
