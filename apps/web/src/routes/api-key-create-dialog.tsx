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
// 名称输入落 components/ui/Input 正典默认档（spec/22 §5.3：h-8 32px /
// rounded-none / border-input / 件自带 focus 环——旧 36px 盒与 2px outline
// 环覆写按 §2.6-1 退役，36px 不以别名/utility/size 档任何形式存续）。
// 底部双钮走 Button brand/ghost 件档（旧 py-8 散写高吸附 h-8 控件高正本），
// ghost 取消钮与两枚快捷钮按七通道律归零（#908 comment-6001887439 裁决 3）。

import { CHIEF_REMOTE_TOOLS } from '@pacman/shared';
import { useState } from 'react';
import { Button } from '../components/ui/button.js';
import { Checkbox } from '../components/ui/checkbox.js';
import { DialogShell } from '../components/ui/dialog-shell.js';
import { Input } from '../components/ui/input.js';
import { useI18n } from '../i18n/provider.js';

/** 权限位可选集 = remote tools 51 词表（grants 白名单消费面 =
 * services/mcp-face.ts）。 */
const TOOL_NAMES = CHIEF_REMOTE_TOOLS.map((tool) => tool.name);

/** 快捷钮（授予全部/清空）：text 档实测形（无框 / 0 内垫 / tertiary 墨 /
 *  12px 字 / 字重 400 / 无 hover 变化）——ghost 件配方按七通道律逐位归零，
 *  border-0 压掉底座 1px 透明边（有边即宽 2px，右对齐排会位移）。 */
const QUICK_BTN_CLS =
  'border-0 cursor-pointer px-0 text-xs leading-[inherit] font-normal bg-transparent text-(--text-tertiary) hover:bg-transparent hover:text-(--text-tertiary) dark:hover:bg-transparent aria-expanded:bg-transparent aria-expanded:text-(--text-tertiary) active:not-aria-[haspopup]:translate-y-0';

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
          <Button
            variant="brand"
            className="border-0 px-4 text-[13px] leading-[inherit] active:not-aria-[haspopup]:translate-y-0"
            onClick={submit}
          >
            {t('创建')}
          </Button>
          <Button
            variant="ghost"
            className="border-0 px-4 text-[13px] leading-[inherit] font-normal text-(--text-secondary) hover:bg-transparent hover:text-(--text-secondary) dark:hover:bg-transparent aria-expanded:bg-transparent aria-expanded:text-(--text-secondary) active:not-aria-[haspopup]:translate-y-0"
            onClick={onClose}
          >
            {t('取消')}
          </Button>
        </div>
      }
    >
      <div className="flex min-w-[320px] flex-col gap-2.5">
        <label className="text-xs text-(--text-tertiary)" htmlFor="apikey-name-input">
          {t('名称（可选）')}
        </label>
        {/* #947：Input 正典默认档（§5.3）——h-8 / rounded-none / border-input，
            focus 环走件自带 border-ring + ring 档；旧 36px 盒、card-border
            描边与 2px outline 环覆写全部退役。id/htmlFor 配对是语义资产
            （getByLabel 一级载体），保留不动。 */}
        <Input
          id="apikey-name-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('如：笔记本、CI 机器')}
        />
        {/* XMON-75：这两行与下面的读写位此前是裸 checkbox 原生控件，画出来
            是浏览器自带的方框，跟仓内 .dlg-accept-check 那一族的复选 tile
            不同形。改用 components/ui/checkbox.tsx 统一形态（行盒布局由
            件内 .ui-checkbox 承载，此处只并字体档）。 */}
        <div className="flex flex-col gap-1.5">
          <Checkbox
            className="text-[13px] text-(--text-secondary)"
            checked={gitAccess}
            onCheckedChange={setGitAccess}
            label={t('Git 读写（托管仓库 push/pull）')}
          >
            {t('Git 读写（托管仓库 push/pull）')}
          </Checkbox>
          <Checkbox
            className="text-[13px] text-(--text-secondary)"
            checked={mcpAccess}
            onCheckedChange={setMcpAccess}
            label={t('MCP 访问（MCP 客户端接入）')}
          >
            {t('MCP 访问（MCP 客户端接入）')}
          </Checkbox>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-(--text-tertiary)">{t('工具权限位')}</span>
          <span className="flex gap-2">
            <Button variant="ghost" className={QUICK_BTN_CLS} onClick={grantAll}>
              {t('授予全部')}
            </Button>
            <Button variant="ghost" className={QUICK_BTN_CLS} onClick={clearAll}>
              {t('清空')}
            </Button>
          </span>
        </div>
        <div className="max-h-[264px] overflow-y-auto rounded-none border border-(--border) px-2 py-1">
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
                  label={`${t('读')} ${tool}`}
                />
              </span>
              <span className="w-8 text-center text-(--text-tertiary)">
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
