// 压缩模型选择器(issue #204:#182 静态化翻回交互——server #203 已落
// compactionModel 可空 JSON 槽 + PATCH 第三槽,写→GET 回显同值、null 清空)。
// 数据源(#180 裁决)「自定义 providers 真值 + presets 兜底」的落账口径:
// 选项清单 = 自定义 providers 的 models[](wire 上唯一带模型目录的面,r5 §2
// 捕获原型 = 网关 r3-gw 全 12 模型);presets 38 项目录 wire 实测仅
// id/auth/oauthLabel 无模型清单(provider.ts「目录外字段未采不发明」),
// 兜底落在值回显层——当前值命中不了选项时裸串 `provider/modelId` 即名
// (preset id 自描述),不空白不崩。
// 交互 = anchored popover 家族律(#67/#127/dhead chip 先例:OverlayMount +
// ClickCatcher + Esc,role=listbox/option);选中当前值 = 空操作关面
// (chief-agent-dialog 同律)。live:选定即 PATCH chief compactionModel 槽
// (S8:mutation 后 invalidateAll 重取回显,不做本地乐观态);fixture 面
// accept 律(#148:选择即关),选项退 canon 单行(DEFAULT_AGENT 同律)。

import type { ChiefCompactionModel } from '@pacman/shared';
import { useState } from 'react';
import { useI18n } from '../i18n/provider.js';
import { Check, ChevronDown } from '../icons/index.js';
import { ClickCatcher, OverlayMount, useEscapeClose } from '../overlays/dismiss.js';

/** 选择器行最小投影(live = providers 读面投影;fixture = canon 单行)。 */
export interface ChiefModelOption {
  /** providerId(PATCH 值槽的 provider 位)。 */
  provider: string;
  /** 显示用服务商名(r5 §2 捕获行 `r3-gw · 128k` 徽标位)。 */
  providerLabel: string;
  modelId: string;
  modelName: string;
}

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
  useEscapeClose(open, () => setOpen(false));
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
    <span className="chief-model-wrap">
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
      <OverlayMount open={open}>
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
      </OverlayMount>
    </span>
  );
}
