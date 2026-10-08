// 添加密钥 dialog (wayfinder #173, r2 §242 field authority): rides
// DialogShell (#68 family law — X / Esc / backdrop). Field set verbatim:
// 名称（环境变量名）/ 描述（可选）/ 值 textarea + the encrypted-storage
// note + 添加密钥 submit. Live submit = mutations.createSecret (POST
// /api/teams/:id/secrets, 02 §8 值只写不读 — the value never echoes back);
// fixture follows the accept-dialog 律 (#148: close on submit).
//
// #942 正典表抽查实装点：老 ui/ 原语消费清零——Input 换 components/ui 件
// （36px→h-8 32px，§2.6-1）、裸 textarea → Textarea 件、裸 button
// .dlg-secret-create → Button default（§2.6-3 迁移位）、.dlg-form* 族类 →
// utility 等值迁移（spec/22 §5.4）。label 的 htmlFor/id 配对保留：它是
// getByLabel 一级载体依赖的语义资产，不是类名别名。

import { useState } from 'react';
import { Button } from '../components/ui/button.js';
import { DialogShell } from '../components/ui/dialog-shell.js';
import { Input } from '../components/ui/input.js';
import { Textarea } from '../components/ui/textarea.js';
import { useI18n } from '../i18n/provider.js';

/** .dlg-form-label 退役后的等值 rhythm（正典表 §5.4）：9/8 外距 + 18 行盒；
 *  字号/字距 = c.css 定版 --label-size 12px / --label-spacing 0.01em——#915
 *  落 token 后改 text-(--label-size) tracking-(--label-spacing)（§4-4）。 */
const LABEL_CLS = 'mt-[9px] mb-2 text-[12px] leading-[18px] tracking-[0.01em] text-(--foreground)';

interface CreateSecretDialogProps {
  /** #73 retained-mount open flag. */
  open?: boolean;
  onClose: () => void;
  /** M5 live 面：添加 = POST secrets；缺省 = fixture 律（提交即关）。 */
  onCreate?: (input: { name: string; description?: string; value: string }) => void;
}

export function CreateSecretDialog({ open, onClose, onCreate }: CreateSecretDialogProps) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const submit = () => {
    const trimmed = name.trim();
    if (trimmed === '' || value === '') return;
    if (onCreate != null) {
      onCreate({ name: trimmed, description: description.trim() || undefined, value });
    } else {
      onClose();
    }
    setName('');
    setDescription('');
    setValue('');
  };
  return (
    <DialogShell
      title={t('添加密钥')}
      open={open}
      onClose={onClose}
      footer={
        <div className="flex flex-col px-4 pb-4">
          <Button className="w-full" disabled={name.trim() === '' || value === ''} onClick={submit}>
            {t('添加密钥')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 px-4 pt-4 pb-3">
        <label className={LABEL_CLS} htmlFor="dlg-secret-name">
          {t('名称（环境变量名）')}
        </label>
        <Input
          id="dlg-secret-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="STRIPE_API_KEY"
        />
        <label className={LABEL_CLS} htmlFor="dlg-secret-desc">
          {t('描述（可选）')}
        </label>
        <Input
          id="dlg-secret-desc"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t('该密钥的用途')}
        />
        <label className={LABEL_CLS} htmlFor="dlg-secret-value">
          {t('值')}
        </label>
        <Textarea
          id="dlg-secret-value"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t('粘贴密钥的值')}
        />
        <p className="text-xs leading-4 text-(--text-tertiary)">
          {t('值将加密存储，保存后无法再次查看。')}
        </p>
      </div>
    </DialogShell>
  );
}
