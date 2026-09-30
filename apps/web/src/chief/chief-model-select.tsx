// 压缩模型选择器(issue #204:#182 静态化翻回交互——server #203 已落
// compactionModel 可空 JSON 槽 + PATCH 第三槽,写→GET 回显同值、null 清空)。
// 数据源(#358,spec 11 §A10——38 项 preset 方案退役,#180 裁决收敛到值回显
// 层):选项清单 = GET model-sources 封套投影 ∪ custom providers models[]
// 并集,投影单源在 api/mappers.ts `toChiefModelOptions`(pi 段归属走
// providers 面,claude-code 段 provider 位 = runtime 词表值);当前值命中
// 不了选项时(含仍引用已废 preset 的旧值)裸串 `provider/modelId` 即名,
// 不空白不崩。
// 交互 = anchored popover 家族律(#67/#127/dhead chip 先例:FloatingShell +
// ClickCatcher + Esc,role=listbox/option);选中当前值 = 空操作关面
// (chief-agent-dialog 同律)。live:选定即 PATCH chief compactionModel 槽
// (S8:mutation 后 invalidateAll 重取回显,不做本地乐观态);fixture 面
// accept 律(#148:选择即关),选项退 canon 单行(DEFAULT_AGENT 同律)。

import type { ChiefCompactionModel } from '@pacman/shared';
import { useState } from 'react';
import { FloatingShell } from '../components/ui/floating-shell.js';
import type { ChiefModelOption } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { Check, ChevronDown } from '../icons/index.js';
import { ClickCatcher } from '../overlays/dismiss.js';

/** fixture 面候选兜底(r5 §2 捕获网关 r3-gw——捕获徽标位原文即 id 本身
 *  `r3-gw · 128k`——+ fixture canon 模型 claude-sonnet-5;chief-agent-dialog
 *  DEFAULT_AGENT 单默认行同律)。 */
const DEFAULT_OPTIONS: ChiefModelOption[] = [
  {
    provider: 'r3-gw',
    providerLabel: 'r3-gw',
    modelId: 'claude-sonnet-5',
    modelName: 'claude-sonnet-5',
  },
];

interface ChiefModelSelectProps {
  /** 当前值(live = chief 封套真值;fixture = ChiefContent 字段);null =
   *  默认(与 Chief 相同)。 */
  value: ChiefCompactionModel | null;
  /** 候选模型;缺省 = fixture canon 单行。 */
  options?: ChiefModelOption[];
  /** live 面:选定 = PATCH chief compactionModel 槽;缺省 = fixture 律
   *  (选择即关)。 */
  onPick?: (value: ChiefCompactionModel | null) => void;
}

export function ChiefModelSelect({ value, options, onPick }: ChiefModelSelectProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  // #425 B1:wrap 锚定面——portal 挂进 wrap 保绝对定位几何;Esc 走 FloatingShell。
  const [wrap, setWrap] = useState<HTMLSpanElement | null>(null);
  const rows = options ?? DEFAULT_OPTIONS;
  const current =
    value == null
      ? null
      : (rows.find((row) => row.provider === value.provider && row.modelId === value.modelId) ??
        null);
  // 值回显:选项命中 → 模型名;未命中(含 preset provider)→ 裸串兜底。
  const label =
    value == null
      ? t('默认（与 Chief 相同）')
      : (current?.modelName ?? `${value.provider}/${value.modelId}`);

  const pick = (next: ChiefCompactionModel | null) => {
    // 选中当前值 = 空操作关面(两态同律)。
    if (
      next === null
        ? value === null
        : value?.provider === next.provider && value?.modelId === next.modelId
    ) {
      setOpen(false);
      return;
    }
    setOpen(false); // accept 律:选择即关;live 真值经 invalidateAll 重取回显
    onPick?.(next);
  };

  return (
    <span className="chief-model-wrap" ref={setWrap}>
      <button
        type="button"
        className="chief-select"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{label}</span>
        <ChevronDown width={12} height={12} />
      </button>
      {/* #425 B1:chief-model-shell 类只为退场 CSS 钩子(见 chief.css 尾段)。 */}
      <FloatingShell
        open={open}
        onClose={() => setOpen(false)}
        container={wrap}
        className="chief-model-shell"
      >
        <ClickCatcher onClose={() => setOpen(false)} />
        <div className="chief-model-menu anim-pop" role="listbox" aria-label={t('压缩模型')}>
          <button
            type="button"
            className="chief-model-row"
            role="option"
            aria-selected={value === null}
            onClick={() => pick(null)}
          >
            <span className="chief-model-row-name">{t('默认（与 Chief 相同）')}</span>
            {value === null && (
              <span className="chief-model-check">
                <Check width={14} height={14} />
              </span>
            )}
          </button>
          {rows.map((row) => {
            const selected = current?.provider === row.provider && current?.modelId === row.modelId;
            return (
              <button
                key={`${row.provider}/${row.modelId}`}
                type="button"
                className="chief-model-row"
                role="option"
                aria-selected={selected}
                onClick={() => pick({ provider: row.provider, modelId: row.modelId })}
              >
                <span className="chief-model-row-name">{row.modelName}</span>
                <span className="chief-model-row-provider">{row.providerLabel}</span>
                {selected && (
                  <span className="chief-model-check">
                    <Check width={14} height={14} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </FloatingShell>
    </span>
  );
}
