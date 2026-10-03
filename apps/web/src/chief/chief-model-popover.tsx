// 主模型覆盖 picker（#615 闭环：抽屉模型行点开即本面，选定 → PATCH chief
// model 槽 → 回显）。#751 壳换锚定弹层家族律（#67/#127：FloatingShell
// container=wrap + ClickCatcher + Esc，role=listbox/option）——#615 的居中
// DialogShell 在抽屉头触发位旁读作「在中间出现」，用户对照 .chief-switcher
// 的贴底锚定报 bug；壳换机制不换内容：搜索 + 行清单 + accept 律（选中即关）
// + live PATCH  loop 全部保留。
// 行渲染 / 行投影 / 选中律 / pick 律单源 = components/model-select-core
// （#626 收敛）；本面只留壳与几何钩子（chief-model-pop* / chief-model-pick-*
// 类名组，正本 chief.css）。选中行可见态（底色 + 墨 + check）单源在
// model-pick-* 基类（chief.css #751 段），两 picker 面共享。

import type { ChiefCompactionModel } from '@pacman/shared';
import { useEffect, useMemo, useState } from 'react';
import {
  createModelPicker,
  ModelPickRow,
  type ModelRowSkin,
  toModelRows,
} from '../components/model-select-core.js';
import { FLOATING_POP_ANIM, FloatingShell } from '../components/ui/floating-shell.js';
import { Input } from '../components/ui/input.js';
import type { ModelOption } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { Search } from '../icons/index.js';
import { ClickCatcher } from '../overlays/dismiss.js';

/** r5 108 行形的类名组：比压缩弹层面多一层 col 列容器（名 + 副题纵排）。 */
const ROW_SKIN: ModelRowSkin = {
  row: 'chief-model-pick-row',
  col: 'chief-model-pick-col',
  name: 'chief-model-pick-name',
  provider: 'chief-model-pick-provider',
  check: 'chief-model-check',
};

interface ChiefModelPopoverProps {
  /** #73 retained-mount open flag。 */
  open?: boolean;
  onClose: () => void;
  /** 当前覆盖值（live = chief 封套真值）；null = 继承绑定 Agent 模型。 */
  value: ChiefCompactionModel | null;
  /** 候选模型（live = toModelOptions 投影，非 pi runtime 段）；缺省 = 仅默认行。 */
  options?: ModelOption[];
  /** live 面：选定 = PATCH chief model 槽；缺省 = fixture 律（选择即关）。 */
  onPick?: (value: ChiefCompactionModel | null) => void;
  /** 锚定包含块 = 触发行 wrap（FloatingShell container 律：portal 挂回 wrap
   *  保绝对定位几何，chief-model-select 同律）。 */
  container: HTMLElement | null;
}

export function ChiefModelPopover({
  open,
  onClose,
  value,
  options,
  onPick,
  container,
}: ChiefModelPopoverProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  // retained mount：重开回全清单态、清搜索（chief-agent-dialog 同律）。
  useEffect(() => {
    if (open) setQuery('');
  }, [open]);
  const rows = useMemo(() => {
    const source = options ?? [];
    const q = query.trim().toLowerCase();
    if (q === '') return source;
    return source.filter(
      (row) =>
        row.modelName.toLowerCase().includes(q) || row.providerLabel.toLowerCase().includes(q),
    );
  }, [options, query]);
  // 选中当前值 = 空操作关面；否则先关面再上报（律单源 model-select-core）。
  const pick = createModelPicker({ value, close: onClose, onPick });

  return (
    <FloatingShell
      open={open ?? false}
      onClose={onClose}
      container={container}
      className="chief-model-pop-shell"
      // 触发钮是 toggle（开态再点关）：Base UI 原生 outside-press 会先关、
      // 钮自身 onClick 再翻回开（#666 双写竞态）——外点关面归 ClickCatcher。
      disablePointerDismissal
    >
      <ClickCatcher onClose={onClose} />
      <div className={`chief-model-pop ${FLOATING_POP_ANIM}`}>
        <div className="chief-pick-search">
          <Search width={14} height={14} />
          {/* chief-pick-input per-face 复用（agent dialog 同款的搜索框皮肤）。 */}
          <Input
            className="chief-pick-input h-auto rounded-none border-none bg-transparent p-0 leading-5 placeholder:text-current/50 focus-visible:ring-0 focus-visible:outline-none dark:bg-transparent"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('搜索模型…')}
          />
        </div>
        <div className="chief-model-pick-list" role="listbox" aria-label={t('模型')}>
          {/* 默认行语义 = 继承绑定 Agent（#626 参数化：文案由本面传入）。 */}
          <ModelPickRow
            skin={ROW_SKIN}
            selected={value === null}
            label={t('默认（与绑定 Agent 相同）')}
            onPick={() => pick(null)}
          />
          {toModelRows(rows, value).map((row) => (
            <ModelPickRow
              key={row.key}
              skin={ROW_SKIN}
              selected={row.selected}
              label={row.label}
              providerLabel={row.providerLabel}
              onPick={() => pick(row.value)}
            />
          ))}
          {query.trim() !== '' && rows.length === 0 && (
            <div className="chief-pick-empty">{t('没有匹配的模型')}</div>
          )}
        </div>
      </div>
    </FloatingShell>
  );
}
