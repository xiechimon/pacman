// API key 新建表单弹窗（W4 #287，05 §6-6 余项）：r3 §6 权限位表单弹窗
// [推断]（无 capture——图失）——名称（可选）+ gitAccess/mcpAccess 开关 +
// toolGrants 读写位（CHIEF_REMOTE_TOOLS 49 词表为可选集，r5 §3.1）。
// 快捷路径：全选（读+写+git+mcp，即旧「默认直发」的全权限形）/ 清空。
// 提交走页面注入的 onCreate（POST /api/teams/{id}/api-keys——server 全表单
// 在位，body schema = createApiKeyBodySchema）。live-only（fixture 面按钮
// 保持无操作）。

import { CHIEF_REMOTE_TOOLS } from '@pacman/shared';
import { useState } from 'react';
import { DialogShell } from '../detail/dialog-shell.js';
import { useI18n } from '../i18n/provider.js';

/** 权限位可选集 = remote tools 49 词表（grants 白名单消费面 =
 * services/mcp-face.ts）。 */
const TOOL_NAMES = CHIEF_REMOTE_TOOLS.map((tool) => tool.name);

export interface ApiKeyCreateBody {
  name: string | null;
  gitAccess: boolean;
  mcpAccess: boolean;
  toolGrants: { read: string[]; write: string[] };
}

interface ApiKeyCreateDialogProps {
  /** #73 retained-mount open flag. */
  open: boolean;
  onClose: () => void;
  onCreate: (body: ApiKeyCreateBody) => void;
}

export function ApiKeyCreateDialog({ open, onClose, onCreate }: ApiKeyCreateDialogProps) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [gitAccess, setGitAccess] = useState(false);
  const [mcpAccess, setMcpAccess] = useState(false);
  const [read, setRead] = useState<Set<string>>(new Set());
  const [write, setWrite] = useState<Set<string>>(new Set());

  const toggle = (set: Set<string>, tool: string): Set<string> => {
    const next = new Set(set);
    if (next.has(tool)) next.delete(tool);
    else next.add(tool);
    return next;
  };
  const grantAll = () => {
    setRead(new Set(TOOL_NAMES));
    setWrite(new Set(TOOL_NAMES));
    setGitAccess(true);
    setMcpAccess(true);
  };
  const clearAll = () => {
    setRead(new Set());
    setWrite(new Set());
    setGitAccess(false);
    setMcpAccess(false);
  };
  const submit = () => {
    onCreate({
      name: name.trim() === '' ? null : name.trim(),
      gitAccess,
      mcpAccess,
      toolGrants: { read: [...read], write: [...write] },
    });
    onClose();
  };

  return (
    <DialogShell
      title={t('新建密钥')}
      open={open}
      onClose={onClose}
      footer={
        <div className="apikey-form-footer">
          <button type="button" className="apikey-form-create" onClick={submit}>
            {t('创建')}
          </button>
          <button type="button" className="apikey-form-cancel" onClick={onClose}>
            {t('取消')}
          </button>
        </div>
      }
    >
      <div className="apikey-form">
        <label className="apikey-form-label" htmlFor="apikey-name-input">
          {t('名称（可选）')}
        </label>
        <input
          id="apikey-name-input"
          className="apikey-form-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('如：笔记本、CI 机器')}
        />
        <div className="apikey-form-toggles">
          <label className="apikey-form-toggle">
            <input
              type="checkbox"
              checked={gitAccess}
              onChange={(event) => setGitAccess(event.target.checked)}
            />
            {t('Git 读写（托管仓库 push/pull）')}
          </label>
          <label className="apikey-form-toggle">
            <input
              type="checkbox"
              checked={mcpAccess}
              onChange={(event) => setMcpAccess(event.target.checked)}
            />
            {t('MCP 访问（MCP 客户端接入）')}
          </label>
        </div>
        <div className="apikey-form-tools-head">
          <span className="apikey-form-label">{t('工具权限位')}</span>
          <span className="apikey-form-quick">
            <button type="button" className="apikey-form-quickbtn" onClick={grantAll}>
              {t('全选')}
            </button>
            <button type="button" className="apikey-form-quickbtn" onClick={clearAll}>
              {t('清空')}
            </button>
          </span>
        </div>
        <div className="apikey-form-tools">
          <div className="apikey-form-toolrow apikey-form-toolrow--head">
            <span className="apikey-form-toolname" />
            <span className="apikey-form-toolcol">{t('读')}</span>
            <span className="apikey-form-toolcol">{t('写')}</span>
          </div>
          {TOOL_NAMES.map((tool) => (
            <div key={tool} className="apikey-form-toolrow">
              <span className="apikey-form-toolname">{tool}</span>
              <span className="apikey-form-toolcol">
                <input
                  type="checkbox"
                  aria-label={`${t('读')} ${tool}`}
                  checked={read.has(tool)}
                  onChange={() => setRead((set) => toggle(set, tool))}
                />
              </span>
              <span className="apikey-form-toolcol">
                <input
                  type="checkbox"
                  aria-label={`${t('写')} ${tool}`}
                  checked={write.has(tool)}
                  onChange={() => setWrite((set) => toggle(set, tool))}
                />
              </span>
            </div>
          ))}
        </div>
      </div>
    </DialogShell>
  );
}
