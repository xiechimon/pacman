// 创建 Agent dialog (issue #170, r2 §8.1 capture 20): rides DialogShell
// (#68 family law — X / Esc / backdrop close, no self-built overlay). The
// form is name-first: avatar row / 名称 input / provider warning row with
// the 配置服务商 link (PROVIDERS_HREF, scenario rides along — #121 Link
// family discipline) / 创建 primary. Live submit = mutations.createAgent
// (POST /api/teams/:id/agents → 201 {id}, r5 §1); fixture follows the
// accept-dialog precedent (#148: close on submit, no backend). The 更换
// ink beside the avatar is removed (#307 wontfix, spec 08 档 4): the
// avatar is the static robot asset and no upload face exists — this item's
// #148 capture-verbatim-chrome verdict is re-adjudicated 移除 (the account-
// swap twin stays with 档 3, out of this ticket).

import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useI18n } from '../i18n/provider.js';
import { PROVIDERS_HREF } from '../resources/providers-page.js';
import { Avatar } from '../ui/avatar.js';
import { DialogShell } from '../ui/dialog-shell.js';
import { Input } from '../ui/input.js';

interface CreateAgentDialogProps {
  /** #73 retained-mount open flag. */
  open?: boolean;
  onClose: () => void;
  /** M5 live 面：创建 = POST agents（词表最小形 displayName）；缺省 =
   *  fixture 律（创建即关，#148 accept-dialog 先例）。 */
  onCreate?: (displayName: string) => void;
}

export function CreateAgentDialog({ open, onClose, onCreate }: CreateAgentDialogProps) {
  const { t } = useI18n();
  // the link carries the scenario string along so dev/fixture
  // selection survives the hop (#121)
  const { search } = useLocation();
  const [name, setName] = useState('');
  const submit = () => {
    const displayName = name.trim();
    if (displayName === '') return;
    if (onCreate != null) {
      onCreate(displayName);
    } else {
      onClose();
    }
    setName('');
  };
  return (
    <DialogShell
      title={t('创建 agent')}
      open={open}
      onClose={onClose}
      footer={
        <div className="dlg-form-foot">
          <button
            type="button"
            className="dlg-agent-create"
            disabled={name.trim() === ''}
            onClick={submit}
          >
            {t('创建')}
          </button>
        </div>
      }
    >
      <div className="dlg-form">
        <div className="dlg-agent-avatar">
          {/* #387: 头像行 = 名称种子的 dicebear 预览——随输入即所得（创建后
              同名恒同像）；空名退回静态机器人资产。「更换」钮全除（#307
              wontfix）：栈内无上传面。 */}
          <Avatar name={name.trim()} fallback="/avatar-robot-1.svg" />
        </div>
        <label className="dlg-form-label" htmlFor="dlg-agent-name">
          {t('名称')}
        </label>
        <Input
          id="dlg-agent-name"
          className="dlg-form-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('输入 Agent 名称')}
        />
        <div className="dlg-agent-warn">
          <span>{t('尚未配置模型服务商')}</span>
          <Link className="dlg-agent-configure" to={{ pathname: PROVIDERS_HREF, search }}>
            {t('配置服务商')}
          </Link>
        </div>
      </div>
    </DialogShell>
  );
}
