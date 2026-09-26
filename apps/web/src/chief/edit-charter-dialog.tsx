// 章程编辑 dialog (#182, #180 裁决落账: DialogShell 编辑弹窗,textarea 在
// 弹窗内;家族律 X/Esc/backdrop)。字段 canon = r5 102/110 编辑器:textarea
// 占位「长期指令：模型路由规则（何种任务使用何种模型）、优先级、偏好…」+
// 取消/保存章程。保存 → PATCH chief charter 槽(live);fixture 面 accept
// 律(#148:提交即关)。retained-mount(#73):开时以真值回填,重开不带回
// 上次未存草稿。

import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/provider.js';
import { DialogShell } from '../ui/dialog-shell.js';

interface EditCharterDialogProps {
  /** #73 retained-mount open flag。 */
  open?: boolean;
  onClose: () => void;
  /** 既有章程文本(live 面真值);未设置/fixture = 空串。 */
  charter?: string;
  /** M5 live 面:保存 = PATCH chief charter 槽(父 onSuccess 关窗);缺省 =
   *  fixture 律(保存即关)。空串 = 清空章程(server charter 槽接受)。 */
  onSave?: (charter: string) => void;
}

export function EditCharterDialog({ open, onClose, charter, onSave }: EditCharterDialogProps) {
  const { t } = useI18n();
  const [text, setText] = useState(charter ?? '');
  useEffect(() => {
    if (open) setText(charter ?? '');
  }, [open, charter]);
  const save = () => {
    if (onSave != null) onSave(text);
    else onClose();
  };
  return (
    <DialogShell
      title={t('编辑章程')}
      open={open}
      onClose={onClose}
      footer={
        <div className="dlg-form-foot">
          <div className="dlg-form-actions">
            <button type="button" className="chief-dlg-ghost" onClick={onClose}>
              {t('取消')}
            </button>
            <button type="button" className="chief-dlg-primary" onClick={save}>
              {t('保存章程')}
            </button>
          </div>
        </div>
      }
    >
      <div className="dlg-form">
        <textarea
          className="chief-dlg-charter-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('长期指令：模型路由规则（何种任务使用何种模型）、优先级、偏好…')}
        />
      </div>
    </DialogShell>
  );
}
