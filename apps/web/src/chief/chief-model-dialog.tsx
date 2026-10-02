// 主模型覆盖 dialog（#615：r5 107/108 设置 Agent tab 独立「模型」选择器的
// 抽屉侧闭环——抽屉模型行点开即本面，选定 → PATCH chief model 槽 → 回显）。
// 壳 = DialogShell 家族律（X/Esc/backdrop，chief-agent-dialog 同律）；行形 =
// 模型名 + provider 副题（r5 108 的 `r3-gw · 128k` 副题在 pacman 只投影
// providerLabel——128k 是原版内置模型目录的上下文窗口，本地 BYOK 无此数据
// 源，不编造，AgentModelSelect 标签律同）。首行「默认（与绑定 Agent 相同）」
// = null 槽回继承（压缩模型选择器默认行同律）；选中当前值 = 空操作关面；
// fixture 面 accept 律（onPick 缺省 = 选择即关）。
//
// 行渲染 / 行投影 / 选中律 / pick 律单源 = components/model-select-core
// （#626 收敛）；本面只留壳（DialogShell + 搜索 + 空态）与几何钩子
// （chief-model-pick-* 类名组，正本 chief.css）。

import type { ChiefCompactionModel } from '@pacman/shared';
import { useEffect, useMemo, useState } from 'react';
import {
  createModelPicker,
  ModelPickRow,
  type ModelRowSkin,
  toModelRows,
} from '../components/model-select-core.js';
import { DialogShell } from '../components/ui/dialog-shell.js';
import { Input } from '../components/ui/input.js';
import type { ModelOption } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { Search } from '../icons/index.js';

/** r5 108 面的类名组：比 popover 面多一层 col 列容器（名 + 副题纵排）。 */
const ROW_SKIN: ModelRowSkin = {
  row: 'chief-model-pick-row',
  col: 'chief-model-pick-col',
  name: 'chief-model-pick-name',
  provider: 'chief-model-pick-provider',
  check: 'chief-model-check',
};

interface ChiefModelDialogProps {
  /** #73 retained-mount open flag。 */
  open?: boolean;
  onClose: () => void;
  /** 当前覆盖值（live = chief 封套真值）；null = 继承绑定 Agent 模型。 */
  value: ChiefCompactionModel | null;
  /** 候选模型（live = toModelOptions 并集投影）；缺省 = 仅默认行。 */
  options?: ModelOption[];
  /** live 面：选定 = PATCH chief model 槽；缺省 = fixture 律（选择即关）。 */
  onPick?: (value: ChiefCompactionModel | null) => void;
}

export function ChiefModelDialog({ open, onClose, value, options, onPick }: ChiefModelDialogProps) {
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
    <DialogShell title={t('模型')} open={open} onClose={onClose}>
      <div className="chief-model-pick">
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
    </DialogShell>
  );
}
