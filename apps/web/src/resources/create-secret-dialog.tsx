// 添加密钥 dialog (wayfinder #173, r2 §242 field authority): rides
// DialogShell (#68 family law — X / Esc / backdrop). Field set verbatim:
// 名称（环境变量名）/ 描述（可选）/ 值 textarea + the encrypted-storage
// note + 添加密钥 submit. Live submit = mutations.createSecret (POST
// /api/teams/:id/secrets, 02 §8 值只写不读 — the value never echoes back);
// fixture follows the accept-dialog 律 (#148: close on submit).

import { useState } from 'react';
import { useI18n } from '../i18n/provider.js';
import { DialogShell } from '../ui/dialog-shell.js';
import { Input } from '../ui/input.js';

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
        <div className="dlg-form-foot">
          <button
            type="button"
            className="dlg-secret-create"
            disabled={name.trim() === '' || value === ''}
            onClick={submit}
          >
            {t('添加密钥')}
          </button>
        </div>
      }
    >
      <div className="dlg-form">
        <label className="dlg-form-label" htmlFor="dlg-secret-name">
          {t('名称（环境变量名）')}
        </label>
        <Input
          id="dlg-secret-name"
          className="dlg-form-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="STRIPE_API_KEY"
        />
        <label className="dlg-form-label" htmlFor="dlg-secret-desc">
          {t('描述（可选）')}
        </label>
        <Input
          id="dlg-secret-desc"
          className="dlg-form-input"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t('该密钥的用途')}
        />
        <label className="dlg-form-label" htmlFor="dlg-secret-value">
          {t('值')}
        </label>
        <textarea
          id="dlg-secret-value"
          className="dlg-form-textarea"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t('粘贴密钥的值')}
        />
        <div className="dlg-secret-note">{t('值将加密存储，保存后无法再次查看。')}</div>
      </div>
    </DialogShell>
  );
}
