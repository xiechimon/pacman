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

/** #951（detail/overlays.css 清零）：accept 同族（accept / stop-confirm /
 *  reset-confirm）的行容器、footer 与文字钮律等值迁 utility，三消费面共用
 *  单源（原 .dlg-accept / .dlg-accept-footer / .dlg-accept-cancel 族，r7 34
 *  实测值）。 */

/** 勾选行容器：17px 顶垫 + 16 横垫，行内 8 gap。 */
export const ACCEPT_ROW = 'flex items-center gap-2 px-4 pt-[17px]';

/** footer 动作行：右对齐 8 gap，17/16/14 垫。 */
export const ACCEPT_FOOTER = 'flex items-center justify-end gap-2 px-4 pt-[17px] pb-[14px]';

/** 取消/文字钮皮肤（ghost 底座中和，XMON-24 律 + 原 .dlg-accept-cancel
 *  的透明底/tertiary 墨/13px）：hover 底与墨双钉回（漆面恒压，含 dark 档）。 */
export const ACCEPT_CANCEL_BTN =
  'h-auto cursor-pointer rounded-none border-none bg-transparent p-0 text-[13px] font-normal text-(--text-tertiary) hover:bg-transparent hover:text-(--text-tertiary) dark:hover:bg-transparent dark:hover:text-(--text-tertiary) active:not-aria-[haspopup]:translate-y-0';

/** 50×28 冻结几何（XMON-24 scoped 钉，原 `.dlg-accept-footer .dlg-accept-done`
 *  (0,2,0) 选择器的 utility 等价形）。 */
export const ACCEPT_DONE_SIZE = 'w-[50px] p-0';

/** 勾选行文字：13px primary（原 .dlg-accept-label）。 */
export const ACCEPT_LABEL = 'text-[13px] text-(--foreground)';

/** 勾选行下方说明行（XMON-89 缺项/拒绝行共用形：10px 顶距 + 16 横缩、
 *  12/16；墨色由消费面给——缺项 tertiary、server 拒绝 --danger）。 */
export const ACCEPT_NOTE_LINE = 'mx-4 mt-[10px] text-xs leading-4';

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
        <div className={ACCEPT_FOOTER}>
          {/* XMON-24：裸钮切 shadcn ghost；#951：.dlg-accept-cancel per-face
              律等值迁 ACCEPT_CANCEL_BTN（unlayered 压底座 → 同层中和串）。 */}
          <Button variant="ghost" className={ACCEPT_CANCEL_BTN} onClick={onClose}>
            {t('取消')}
          </Button>
          <Button
            variant="brand"
            className={`${ACCEPT_DONE_SIZE} h-7 border-none text-[13px] font-normal cursor-pointer active:not-aria-[haspopup]:translate-y-0`}
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
      <div className={ACCEPT_ROW}>
        {/* XMON-72：复选行收口 components/ui/checkbox 原语。改之前 .dlg-accept-check
            从无隐藏 input 的规则，18px tile 里骑着 Mac 原生复选框、白勾被挤成 0 宽。 */}
        <Checkbox checked={merge} onCheckedChange={setMerge} label={t('将改动合并到默认分支')}>
          <span className={ACCEPT_LABEL}>{t('将改动合并到默认分支')}</span>
        </Checkbox>
      </div>
      {blocked && (
        // XMON-89 缺项行：禁用态由 brand disabled 档承载，本行只说「缺什么」。
        <p className={`${ACCEPT_NOTE_LINE} text-(--text-tertiary)`}>
          {t('缺少「{tools}」授权，无法合并。请在该 Agent 的权限里开启。', {
            tools: (missingTools ?? []).join('、'),
          })}
        </p>
      )}
      {rejectReason != null && (
        // XMON-89 server 拒绝行：--danger 与其余面级错误文案同色；role=alert
        // 是 e2e/读屏一级载体（#910 裁定 1）。
        <p className={`${ACCEPT_NOTE_LINE} text-(--destructive)`} role="alert">
          {rejectReason}
        </p>
      )}
    </DialogShell>
  );
}
