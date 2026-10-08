// 添加密钥 dialog (wayfinder #173, r2 §242 field authority): rides
// DialogShell (#68 family law — X / Esc / backdrop). Field set verbatim:
// 名称（环境变量名）/ 描述（可选）/ 值 textarea + the encrypted-storage
// note + 添加密钥 submit. Live submit = mutations.createSecret (POST
// /api/teams/:id/secrets, 02 §8 值只写不读 — the value never echoes back);
// fixture follows the accept-dialog 律 (#148: close on submit).
//
// #942 正典表抽查实装点：老 ui/ 原语消费清零——Input 换 components/ui 件
// （36px→h-8 32px，§2.6-1）、裸 textarea → Textarea 件、裸 button
// .dlg-secret-create → Button default（§2.6-3 迁移位）。
// #1005 registry 对齐：表单行改 Field 官方组合（FieldGroup/Field/FieldLabel/
// FieldDescription），LABEL_CLS 手排 rhythm 退役；label 的 htmlFor/id 配对
// 保留：它是 getByLabel 一级载体依赖的语义资产，不是类名别名。

import { useState } from 'react';
import { Button } from '../components/ui/button.js';
import { DialogShell } from '../components/ui/dialog-shell.js';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '../components/ui/field.js';
import { Input } from '../components/ui/input.js';
import { Textarea } from '../components/ui/textarea.js';
import { useI18n } from '../i18n/provider.js';

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
      <FieldGroup className="px-4 pt-4 pb-3">
        <Field>
          <FieldLabel htmlFor="dlg-secret-name">{t('名称（环境变量名）')}</FieldLabel>
          <Input
            id="dlg-secret-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="STRIPE_API_KEY"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="dlg-secret-desc">{t('描述（可选）')}</FieldLabel>
          <Input
            id="dlg-secret-desc"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t('该密钥的用途')}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="dlg-secret-value">{t('值')}</FieldLabel>
          <Textarea
            id="dlg-secret-value"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={t('粘贴密钥的值')}
          />
        </Field>
        <FieldDescription>{t('值将加密存储，保存后无法再次查看。')}</FieldDescription>
      </FieldGroup>
    </DialogShell>
  );
}
