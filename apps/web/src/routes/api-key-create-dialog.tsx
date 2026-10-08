// API key 新建表单弹窗（W4 #287，05 §6-6 余项）：r3 §6 权限位表单弹窗
// [推断]（无 capture——图失）——名称（可选）+ gitAccess/mcpAccess 开关 +
// toolGrants 读写位（CHIEF_REMOTE_TOOLS 51 词表为可选集，r5 §3.1）。
// 快捷路径：授予全部（读+写+git+mcp，即旧「默认直发」的全权限形）/ 清空。
// zh 源串即 i18n key：「全选」二字自 #636 起归筛选面板的全选行，本面用
// 「授予全部」避开同形碰撞（en 同为 'Grant all'，语义不变）。
// 提交走页面注入的 onCreate（POST /api/teams/{id}/api-keys——server 全表单
// 在位，body schema = createApiKeyBodySchema）。live-only（fixture 面按钮
// 保持无操作）。
// #947 per-face 清零：secondary.css 退役，表单族几何改挂 token utility
// （min-w 320 / 工具盘 max-h 264 是 [推断] 面的既有实测值，§3.1(a)）。
// #1005 registry 对齐：名称行走 Field 官方组合；底部双钮与两枚快捷钮走
// Button default/ghost 默认档（七通道中和与 border-0/px 覆写退役，hover/
// 按下态由件承载）；工具盘盒圆角随 registry 基（rounded-lg）。

import { CHIEF_REMOTE_TOOLS } from '@pacman/shared';
import { useState } from 'react';
import { Button } from '../components/ui/button.js';
import { Checkbox } from '../components/ui/checkbox.js';
import { DialogShell } from '../components/ui/dialog-shell.js';
import { Field, FieldGroup, FieldLabel } from '../components/ui/field.js';
import { Input } from '../components/ui/input.js';
import { useI18n } from '../i18n/provider.js';

/** 权限位可选集 = remote tools 51 词表（grants 白名单消费面 =
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
        <div className="flex gap-2 px-4 py-3">
          <Button onClick={submit}>{t('创建')}</Button>
          <Button variant="ghost" onClick={onClose}>
            {t('取消')}
          </Button>
        </div>
      }
    >
      <FieldGroup className="min-w-[320px] gap-2.5">
        <Field>
          <FieldLabel htmlFor="apikey-name-input">{t('名称（可选）')}</FieldLabel>
          {/* id/htmlFor 配对是语义资产（getByLabel 一级载体），保留不动；
              Input 走件默认档（#1003 起 rounded-lg / border-input / 官方
              focus 环）。 */}
          <Input
            id="apikey-name-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('如：笔记本、CI 机器')}
          />
        </Field>
        {/* XMON-75：这两行与下面的读写位此前是裸 checkbox 原生控件，画出来
            是浏览器自带的方框，跟仓内 .dlg-accept-check 那一族的复选 tile
            不同形。改用 components/ui/checkbox.tsx 统一形态（#1003 起件为
            registry 同源；行盒布局由消费点 label 承载，此处只并字体档）。 */}
        <div className="flex flex-col gap-1.5">
          {/* biome-ignore lint/a11y/noLabelWithoutControl: Base UI Checkbox.Root renders its hidden native input inside this label at runtime; the static check cannot see through the component. */}
          <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-(--text-secondary)">
            <Checkbox
              checked={gitAccess}
              onCheckedChange={setGitAccess}
              aria-label={t('Git 读写（托管仓库 push/pull）')}
            />
            {t('Git 读写（托管仓库 push/pull）')}
          </label>
          {/* biome-ignore lint/a11y/noLabelWithoutControl: Base UI Checkbox.Root renders its hidden native input inside this label at runtime; the static check cannot see through the component. */}
          <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-(--text-secondary)">
            <Checkbox
              checked={mcpAccess}
              onCheckedChange={setMcpAccess}
              aria-label={t('MCP 访问（MCP 客户端接入）')}
            />
            {t('MCP 访问（MCP 客户端接入）')}
          </label>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-(--text-tertiary)">{t('工具权限位')}</span>
          <span className="flex gap-2">
            <Button variant="ghost" size="xs" onClick={grantAll}>
              {t('授予全部')}
            </Button>
            <Button variant="ghost" size="xs" onClick={clearAll}>
              {t('清空')}
            </Button>
          </span>
        </div>
        <div className="max-h-[264px] overflow-y-auto rounded-lg border border-(--border) px-2 py-1">
          <div className="flex items-center gap-2 py-[3px] text-xs text-(--text-tertiary)">
            <span className="flex-1" />
            <span className="w-8 text-center">{t('读')}</span>
            <span className="w-8 text-center">{t('写')}</span>
          </div>
          {TOOL_NAMES.map((tool) => (
            <div key={tool} className="flex items-center gap-2 py-[3px] text-xs">
              <span className="flex-1 text-(--text-secondary)">{tool}</span>
              <span className="w-8 text-center text-(--text-tertiary)">
                <Checkbox
                  checked={read.has(tool)}
                  onCheckedChange={() => setRead((set) => toggle(set, tool))}
                  aria-label={`${t('读')} ${tool}`}
                />
              </span>
              <span className="w-8 text-center text-(--text-tertiary)">
                <Checkbox
                  checked={write.has(tool)}
                  onCheckedChange={() => setWrite((set) => toggle(set, tool))}
                  aria-label={`${t('写')} ${tool}`}
                />
              </span>
            </div>
          ))}
        </div>
      </FieldGroup>
    </DialogShell>
  );
}
