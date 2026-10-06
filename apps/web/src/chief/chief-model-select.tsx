// 压缩模型选择器(issue #204:#182 静态化翻回交互——server #203 已落
// compactionModel 可空 JSON 槽 + PATCH 第三槽,写→GET 回显同值、null 清空)。
// 数据源(#358,spec 11 §A10——38 项 preset 方案退役,#180 裁决收敛到值回显
// 层; #770 起 providers 段已除):选项清单 = GET model-sources 非 pi 段投影,
// 投影单源在 api/mappers.ts `toModelOptions`(claude-code 段 provider 位 =
// runtime 词表值);当前值命中不了选项时(含仍引用已废 preset / 存量 provider
// 模型的旧值)裸串 `provider/modelId` 即名,不空白不崩。
//
// 交互 = 锚定 popover 律：开合 / Esc / 外点关 / 焦点归还全归 Base UI Popover
// 原语；选中当前值 = 空操作关面 (chief-agent-dialog 同律)。live:选定即 PATCH
// chief compactionModel 槽 (S8:mutation 后 invalidateAll 重取回显,不做本地
// 乐观态);fixture 面 accept 律(#148:选择即关),选项退 canon 单行
// (DEFAULT_AGENT 同律)。
//
// 行渲染 / 行投影 / 回显兜底 / 选中律 / pick 律单源 =
// components/model-select-core(#626 收敛);本面只留壳(ghost Button +
// Popover 原语)与皮肤 utility(#950 清零后正本 = recipes.ts + ROW_SKIN)。

import type { ChiefCompactionModel } from '@pacman/shared';
import { useState } from 'react';
import {
  createModelPicker,
  ModelPickList,
  type ModelRowSkin,
  modelEchoLabel,
} from '../components/model-select-core.js';
import { Button } from '../components/ui/button.js';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover.js';
import type { ModelOption } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronDown } from '../icons/index.js';
import {
  MENU_ARROW_RIGHT_CLS,
  MENU_SHELL_CLS,
  SELECT_TRIGGER_CLS,
  SELECT_VALUE_CLS,
} from './recipes.js';

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

/** #204 popover 面的皮肤组（#950 清零后 = token utility，旧 .chief-model-row
 *  族等值：32 行 / 12px 字 16 行盒 / px-12 / name 弹性截断 / provider 与
 *  check 钉右缘）。name/provider 直挂行下(无 col 列容器)。 */
const ROW_SKIN: ModelRowSkin = {
  row: 'h-8 gap-2 px-3 text-xs leading-4 text-(--text-primary)',
  name: 'min-w-0 flex-auto truncate',
  provider: 'flex-none text-(--text-tertiary)',
  check: 'inline-flex flex-none text-(--text-tertiary)',
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
  const rows = options ?? DEFAULT_OPTIONS;
  // 值回显:选项命中 → 模型名;未命中(含 preset provider)→ 裸串兜底
  // (律单源 model-select-core;默认行文案 = 继承语义,本面传入)。
  const label = modelEchoLabel(value, rows, t('默认（与 Chief 相同）'));
  // 选中当前值 = 空操作关面;否则先关面再上报(律单源 model-select-core)。
  const pick = createModelPicker({ value, close: () => setOpen(false), onPick });

  return (
    <span className="relative ml-auto flex-none">
      {/* #854 收编 components/ui/popover（Base UI Popover + Positioner）：
          开合 / Esc / 外点关 / 焦点归还全归原语；ModelPickList（含 typeahead
          搜索 + 选中律）原样做面板内容。定位正本迁 Positioner 参数
          （side=bottom align=end sideOffset=8 = 原 top:calc(100%+8px)
          right:0）。#950 清零：触发钮/弹层壳皮肤改挂 token utility
          （recipes.ts 单源）；面板宽正本 = shrink-to-fit ≥ 220。 */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              className={`${SELECT_TRIGGER_CLS} min-w-40`}
              // #950: aria-label = e2e 一级载体（旧 button.chief-select 类
              // locator 退役；与弹层/listbox 同词，role 区分）。#772: 长值
              // 截断后全称走 title 悬停可达（better-typography 截断律）。
              aria-label={t('压缩模型')}
              title={label}
            />
          }
        >
          {/* #772: 值单行截断（SELECT_VALUE_CLS 担 min-width:0 收缩 +
              ellipsis；裸 span 在 flex 下 min-width:auto 永不收缩，省略号
              永不触发）。 */}
          <span className={SELECT_VALUE_CLS}>{label}</span>
          <ChevronDown width={12} height={12} className="flex-none text-(--text-tertiary)" />
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="bottom"
          sideOffset={8}
          aria-label={t('压缩模型')}
          className={`${MENU_SHELL_CLS} ${MENU_ARROW_RIGHT_CLS} min-w-[220px]`}
        >
          {/* #756 续:行清单 + typeahead 搜索单源归 ModelPickList(与抽屉头
              picker 同形:开面零搜索占位、打字现形吃字、清空收回);listbox
              语义随共享层的清单容器,菜单壳只承几何。 */}
          <ModelPickList
            skin={ROW_SKIN}
            options={rows}
            value={value}
            defaultLabel={t('默认（与 Chief 相同）')}
            listLabel={t('压缩模型')}
            searchPlaceholder={t('搜索模型…')}
            emptyLabel={t('没有匹配的模型')}
            onPick={pick}
          />
        </PopoverContent>
      </Popover>
    </span>
  );
}
