// 选择总管 Agent dialog (#182, r5 §2 绑定流): rides DialogShell (#68 家族律
// X/Esc/backdrop)。搜索框 + Agent 列(r5 截图 106 形态,几何 [推断] 贴
// new-task popover 行语言);live 面清单 = members 读面 memberType:"agent"
// 行(r5 §1:Agent 列表实走 GET teams/{id}/members),fixture 退 canon 单
// 默认行(r3-builder,r5 捕获名)。
// 选中流(r5 §2 wire 原样 PATCH {agent:{agentId,thinkingLevel:null}}):
// 未绑定 → 直发;已绑定且选中他员 → 换绑二次确认(shared
// CHIEF_REBIND_CONFIRM_COPY canon,<agent> 占位显示层替换);选中当前绑定
// = 空操作关窗。fixture 面 accept 律(#148:选择即关)。
// #209: 组件泛化为 agent 选择家族形态——title/confirmCopy 可选入参(缺省 =
// 总管 canon,本面行为字节不变),chip-popover「编辑分配」复用(r2 C.18:
// 该弹层内容从未捕获,任务面文案 [设计])。

import { CHIEF_REBIND_CONFIRM_COPY } from '@pacman/shared';
import { useEffect, useMemo, useState } from 'react';
import { DialogShell } from '../detail/dialog-shell.js';
import { useI18n } from '../i18n/provider.js';
import { Check, Search } from '../icons/index.js';

/** 选择器行最小投影(live = members 读面投影;fixture = canon 默认行)。 */
export interface ChiefAgentOption {
  id: string;
  name: string;
}

/** fixture 面候选兜底(r5 捕获 Agent 名 canon;new-task DEFAULT_PROJECT 同律)。 */
const DEFAULT_AGENT: ChiefAgentOption = { id: 'r3-builder', name: 'r3-builder' };

interface ChiefAgentDialogProps {
  /** #73 retained-mount open flag。 */
  open?: boolean;
  onClose: () => void;
  /** 候选 Agent 集;缺省 = fixture canon 单默认行。 */
  agents?: ChiefAgentOption[];
  /** 当前绑定 Agent id(live 面真值);未绑定/缺省 = null。 */
  boundAgentId?: string | null;
  /** M5 live 面:选定 = PATCH chief agent 槽(父 onSuccess 关窗);缺省 =
   *  fixture 律(选择即关)。 */
  onBind?: (agentId: string) => void;
  /** #209: 标题(调用位预译,DialogShell 律);缺省 = 总管 canon。 */
  title?: string;
  /** #209: 换绑二次确认 copy(<agent> 占位显示层替换);缺省 = 总管记忆告示
   *  canon。 */
  confirmCopy?: string;
}

export function ChiefAgentDialog({
  open,
  onClose,
  agents,
  boundAgentId,
  onBind,
  title,
  confirmCopy,
}: ChiefAgentDialogProps) {
  const { t } = useI18n();
  const dlgTitle = title ?? t('选择总管 Agent');
  const [query, setQuery] = useState('');
  const [confirming, setConfirming] = useState<ChiefAgentOption | null>(null);
  // retained mount:重开回列表态、清搜索(不带回上次残留)。
  useEffect(() => {
    if (open) {
      setQuery('');
      setConfirming(null);
    }
  }, [open]);
  const rows = useMemo(() => {
    const source = agents ?? [DEFAULT_AGENT];
    const q = query.trim().toLowerCase();
    return q === '' ? source : source.filter((row) => row.name.toLowerCase().includes(q));
  }, [agents, query]);

  const pick = (row: ChiefAgentOption) => {
    // 选中当前绑定 = 空操作(两态同律)。
    if (row.id === boundAgentId) {
      onClose();
      return;
    }
    if (onBind == null) {
      onClose(); // fixture accept 律:选择即关
      return;
    }
    // 已绑定 → 换绑二次确认(记忆不迁移告示 canon);未绑定 → 直发,父
    // onSuccess 关窗(create-secret 同律)。
    if (boundAgentId != null) {
      setConfirming(row);
      return;
    }
    onBind(row.id);
  };

  return (
    <DialogShell
      title={dlgTitle}
      open={open}
      onClose={onClose}
      footer={
        confirming != null ? (
          <div className="dlg-form-foot">
            <div className="dlg-form-actions">
              <button type="button" className="chief-dlg-ghost" onClick={() => setConfirming(null)}>
                {t('取消')}
              </button>
              <button
                type="button"
                className="chief-dlg-primary"
                onClick={() => onBind?.(confirming.id)}
              >
                {t('更换')}
              </button>
            </div>
          </div>
        ) : undefined
      }
    >
      {confirming != null ? (
        <div className="chief-pick-confirm">
          <p className="chief-pick-confirm-copy">
            {t(confirmCopy ?? CHIEF_REBIND_CONFIRM_COPY).replaceAll('<agent>', confirming.name)}
          </p>
        </div>
      ) : (
        <div className="chief-pick">
          <div className="chief-pick-search">
            <Search width={14} height={14} />
            <input
              className="chief-pick-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('搜索 Agent…')}
            />
          </div>
          <div className="chief-pick-list" role="listbox" aria-label={dlgTitle}>
            {rows.length === 0 ? (
              <div className="chief-pick-empty">{t('没有匹配的 Agent')}</div>
            ) : (
              rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="chief-pick-row"
                  role="option"
                  aria-selected={row.id === boundAgentId}
                  onClick={() => pick(row)}
                >
                  <span className="chief-pick-avatar">{row.name.charAt(0)}</span>
                  <span className="chief-pick-name">{row.name}</span>
                  {row.id === boundAgentId && (
                    <span className="chief-pick-check">
                      <Check width={14} height={14} />
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </DialogShell>
  );
}
