// API key 新建表单弹窗（W4 #287，05 §6-6 余项）：r3 §6 权限位表单弹窗
// [推断]（无 capture——图失）——名称（可选）+ gitAccess/mcpAccess 开关 +
// toolGrants 读写位（CHIEF_REMOTE_TOOLS 50 词表为可选集，r5 §3.1）。
// 快捷路径：全选（读+写+git+mcp，即旧「默认直发」的全权限形）/ 清空。
// 提交走页面注入的 onCreate（POST /api/teams/{id}/api-keys——server 全表单
// 在位，body schema = createApiKeyBodySchema）。live-only（fixture 面按钮
// 保持无操作）。

import { CHIEF_REMOTE_TOOLS } from '@pacman/shared';
import { useState } from 'react';
import { Button } from '../components/ui/button.js';
import { Checkbox } from '../components/ui/checkbox.js';
import { DialogShell } from '../components/ui/dialog-shell.js';
import { Input } from '../components/ui/input.js';
import { useI18n } from '../i18n/provider.js';

/** 权限位可选集 = remote tools 50 词表（grants 白名单消费面 =
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
      // B2 · secondary 面（XMON-20）：底座 = components/ui/Button（创建 brand 档 /
      // 取消 ghost 档）。per-face 值（8 16 内垫 / 13px 字 / 8px 圆角 / 实底色）
      // 仍住 secondary.css；差额并项——h-auto 保散写形的内垫撑高（底座 h-8
      // 是定高 32）、取消字重 400、两者均无按下位移。
      footer={
        <div className="apikey-form-footer">
          <Button
            variant="brand"
            className="apikey-form-create h-auto leading-[inherit] active:not-aria-[haspopup]:translate-y-0"
            onClick={submit}
          >
            {t('创建')}
          </Button>
          <Button
            variant="ghost"
            className="apikey-form-cancel h-auto font-normal leading-[inherit] active:not-aria-[haspopup]:translate-y-0"
            onClick={onClose}
          >
            {t('取消')}
          </Button>
        </div>
      }
    >
      <div className="apikey-form">
        <label className="apikey-form-label" htmlFor="apikey-name-input">
          {t('名称（可选）')}
        </label>
        {/* a3-pages 收编 → B2 · secondary 面（XMON-20）：Input 走 components/ui
            件，per-face 值（36px 盒 / 8px 圆角 / card-border 描边 / surface 底 /
            0 12 内垫 / 14px 字）以工具类钉回，不取底座默认档。聚焦环按仓级 #388
            canon（2px --focus-ring + offset 2，与 B2 门页输入同配方）；过渡窄写
            压掉 TW 的 transition-colors（属性表含 outline-color，会吞掉环的初值）。
            类名留作 e2e/语义定位别名。 */}
        <Input
          id="apikey-name-input"
          className="apikey-form-input h-9 rounded-md border-(--card-border) bg-(--surface) px-3 py-0 text-sm text-foreground placeholder:text-current/50 transition-[color,background-color,border-color] focus-visible:border-(--card-border) focus-visible:ring-0 focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:outline-offset-2 dark:bg-(--surface)"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('如：笔记本、CI 机器')}
        />
        {/* XMON-75：这两行与下面的读写位此前是裸 `<input type="checkbox">`，
            画出来是浏览器自带的方框，跟仓内 .dlg-accept-check 那一族的复选
            tile 不同形。改用 components/ui/checkbox.tsx 统一形态。 */}
        <div className="apikey-form-toggles">
          <Checkbox
            className="apikey-form-toggle"
            checked={gitAccess}
            onCheckedChange={setGitAccess}
            label={t('Git 读写（托管仓库 push/pull）')}
          >
            {t('Git 读写（托管仓库 push/pull）')}
          </Checkbox>
          <Checkbox
            className="apikey-form-toggle"
            checked={mcpAccess}
            onCheckedChange={setMcpAccess}
            label={t('MCP 访问（MCP 客户端接入）')}
          >
            {t('MCP 访问（MCP 客户端接入）')}
          </Checkbox>
        </div>
        <div className="apikey-form-tools-head">
          <span className="apikey-form-label">{t('工具权限位')}</span>
          <span className="apikey-form-quick">
            {/* a3-pages 收编 → B2 · secondary 面（XMON-20）：Button ghost 档 + per-face
                工具类钉回 A3 text 档的实测形（无框 / 0 内垫 / tertiary 墨 / 12px 字 /
                字重 400），并把 ghost 的 hover 档一并顶回原值——散写形无 hover 变化。
                border-0 压掉底座 1px 透明边（有边即宽 2px，右对齐排会位移）。 */}
            <Button
              variant="ghost"
              className="apikey-form-quickbtn border-0 cursor-pointer px-0 text-xs font-normal leading-[inherit] bg-transparent text-(--text-tertiary) hover:bg-transparent hover:text-(--text-tertiary) active:not-aria-[haspopup]:translate-y-0"
              onClick={grantAll}
            >
              {t('全选')}
            </Button>
            <Button
              variant="ghost"
              className="apikey-form-quickbtn border-0 cursor-pointer px-0 text-xs font-normal leading-[inherit] bg-transparent text-(--text-tertiary) hover:bg-transparent hover:text-(--text-tertiary) active:not-aria-[haspopup]:translate-y-0"
              onClick={clearAll}
            >
              {t('清空')}
            </Button>
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
                <Checkbox
                  checked={read.has(tool)}
                  onCheckedChange={() => setRead((set) => toggle(set, tool))}
                  label={`${t('读')} ${tool}`}
                />
              </span>
              <span className="apikey-form-toolcol">
                <Checkbox
                  checked={write.has(tool)}
                  onCheckedChange={() => setWrite((set) => toggle(set, tool))}
                  label={`${t('写')} ${tool}`}
                />
              </span>
            </div>
          ))}
        </div>
      </div>
    </DialogShell>
  );
}
