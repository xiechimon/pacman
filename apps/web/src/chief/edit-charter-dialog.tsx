// 章程编辑 dialog (#182, #180 裁决落账: DialogShell 编辑弹窗,textarea 在
// 弹窗内;家族律 X/Esc/backdrop)。字段 canon = r5 102/110 编辑器:textarea
// 占位「长期指令：模型路由规则（何种任务使用何种模型）、优先级、偏好…」+
// 取消/保存章程。保存 → PATCH chief charter 槽(live);fixture 面 accept
// 律(#148:提交即关)。retained-mount(#73):开时以真值回填,重开不带回
// 上次未存草稿。

import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button.js';
import { DialogShell } from '../components/ui/dialog-shell.js';
import { Textarea } from '../components/ui/textarea.js';
import { useI18n } from '../i18n/provider.js';

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
        // #950 per-face 清零：.dlg-form-foot/.dlg-form-actions 容器 utility
        // 等值迁移（spec/22 §5.4）；钮 = outline/brand 件正典 + chief 内联档
        // 保留消费点既有 px-3/text-[13px]。e2e 载体 = getByRole('button')。
        <div className="flex flex-col px-4 pb-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="px-3 text-[13px]" onClick={onClose}>
              {t('取消')}
            </Button>
            <Button variant="brand" className="px-3 text-[13px]" onClick={save}>
              {t('保存章程')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3 px-4 pt-4 pb-3">
        {/* §5.3：裸 textarea → Textarea 件；charter 高字段显式 override
            min-h-[120px]（行为理由：章程全文多行编辑空间）。旧
            resize:vertical 退役——field-sizing 自增长替代手动拖拽。
            e2e 载体 = dialog scope getByRole('textbox')（唯一 textbox）。 */}
        <Textarea
          className="min-h-[120px]"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('长期指令：模型路由规则（何种任务使用何种模型）、优先级、偏好…')}
        />
      </div>
    </DialogShell>
  );
}
