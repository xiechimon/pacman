// 压缩模型选择器(issue #204:#182 静态化翻回交互——server #203 已落
// compactionModel 可空 JSON 槽 + PATCH 第三槽,写→GET 回显同值、null 清空)。
// 数据源(#358,spec 11 §A10——38 项 preset 方案退役,#180 裁决收敛到值回显
// 层; #770 起 providers 段已除):选项清单 = GET model-sources 非 pi 段投影,
// 投影单源在 api/mappers.ts `toModelOptions`(claude-code 段 provider 位 =
// runtime 词表值);当前值命中不了选项时(含仍引用已废 preset / 存量 provider
// 模型的旧值)裸串 `provider/modelId` 即名,不空白不崩。
// 交互 = anchored popover 家族律(#67/#127/dhead chip 先例:FloatingShell +
// ClickCatcher + Esc,role=listbox/option);选中当前值 = 空操作关面
// (chief-agent-dialog 同律)。live:选定即 PATCH chief compactionModel 槽
// (S8:mutation 后 invalidateAll 重取回显,不做本地乐观态);fixture 面
// accept 律(#148:选择即关),选项退 canon 单行(DEFAULT_AGENT 同律)。
//
// 行渲染 / 行投影 / 回显兜底 / 选中律 / pick 律单源 =
// components/model-select-core(#626 收敛);本面只留壳(ghost Button +
// FloatingShell popover)与几何钩子(chief-model-row* 类名组,正本
// chief.css)。

import type { ChiefCompactionModel } from '@pacman/shared';
import { useState } from 'react';
import {
  createModelPicker,
  ModelPickRow,
  type ModelRowSkin,
  modelEchoLabel,
  toModelRows,
} from '../components/model-select-core.js';
import { Button } from '../components/ui/button.js';
import { FLOATING_POP_ANIM, FloatingShell } from '../components/ui/floating-shell.js';
import type { ModelOption } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronDown } from '../icons/index.js';
import { ClickCatcher } from '../overlays/dismiss.js';

/** fixture 面候选兜底（#770 起 providers 段已除：canon 行取 runtime 源形——
 *  provider 位 = runtime 词表值 `claude-code`，与 live 投影同形；此前 r3-gw
 *  行随 providers 段退役）。chief-agent-dialog DEFAULT_AGENT 单默认行同律）。 */
const DEFAULT_OPTIONS: ModelOption[] = [
  {
    provider: 'claude-code',
    providerLabel: 'Claude Code',
    modelId: 'claude-sonnet-5',
    modelName: 'claude-sonnet-5',
  },
];

/** #204 popover 面的类名组:name/provider 直挂行下(无 col 列容器)。 */
const ROW_SKIN: ModelRowSkin = {
  row: 'chief-model-row',
  name: 'chief-model-row-name',
  provider: 'chief-model-row-provider',
  check: 'chief-model-check',
};

interface ChiefModelSelectProps {
  /** 当前值(live = chief 封套真值;fixture = ChiefContent 字段);null =
   *  默认(与 Chief 相同)。 */
  value: ChiefCompactionModel | null;
  /** 候选模型;缺省 = fixture canon 单行。 */
  options?: ModelOption[];
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
  // 值回显:选项命中 → 模型名;未命中(含 preset provider)→ 裸串兜底
  // (律单源 model-select-core;默认行文案 = 继承语义,本面传入)。
  const label = modelEchoLabel(value, rows, t('默认（与 Chief 相同）'));
  // 选中当前值 = 空操作关面;否则先关面再上报(律单源 model-select-core)。
  const pick = createModelPicker({ value, close: () => setOpen(false), onPick });

  return (
    <span className="chief-model-wrap" ref={setWrap}>
      {/* XMON-23 收编：ghost 原语 + chief-select per-face（30 高/描边/底/墨
          全在 unlayered per-face，恒压原语层；e2e 钉 button.chief-select）。
          中和件：font-normal（原语 medium 会改字重——per-face 不钉字重）、
          svg size-auto（ChevronDown 12px 属性尺寸）。aria-haspopup 自带
          active 位移豁免（原语 :not([aria-haspopup]) 条件），无需中和。 */}
      <Button
        variant="ghost"
        className="chief-select font-normal [&_svg:not([class*='size-'])]:size-auto"
        aria-haspopup="listbox"
        aria-expanded={open}
        // #772: 长值截断后全称走 title 悬停可达（better-typography 截断律）。
        title={label}
        onClick={() => setOpen((value) => !value)}
      >
        {/* #772: 值单行截断（chief-select-value 担 min-width:0 收缩 +
            ellipsis；裸 span 在 flex 下 min-width:auto 永不收缩，省略号
            永不触发——见 chief.css）。 */}
        <span className="chief-select-value">{label}</span>
        <ChevronDown width={12} height={12} />
      </Button>
      {/* #425 B1:chief-model-shell 类只为退场 CSS 钩子(见 chief.css 尾段)。 */}
      <FloatingShell
        open={open}
        onClose={() => setOpen(false)}
        container={wrap}
        className="chief-model-shell"
      >
        <ClickCatcher onClose={() => setOpen(false)} />
        <div
          className={`chief-model-menu ${FLOATING_POP_ANIM}`}
          role="listbox"
          aria-label={t('压缩模型')}
        >
          {/* 默认行语义 = 继承 Chief(#626 参数化:文案由本面传入)。 */}
          <ModelPickRow
            skin={ROW_SKIN}
            selected={value === null}
            label={t('默认（与 Chief 相同）')}
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
        </div>
      </FloatingShell>
    </span>
  );
}
