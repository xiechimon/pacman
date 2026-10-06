// 主模型覆盖 picker（#615 闭环：抽屉模型行点开即本面，选定 → PATCH chief
// model 槽 → 回显）。#751 壳换锚定弹层家族律（贴行底下，家族律见本面）——
// #615 的居中 DialogShell 在抽屉头触发位旁读作「在中间出现」，用户对照
// .chief-switcher 的贴底锚定报 bug；壳换机制不换内容 + live PATCH loop
// 全部保留。
// #756 续（用户裁决）：搜索框不常驻——行清单 + typeahead 搜索单源归
// components/model-select-core 的 ModelPickList（开面零占位、打字现形吃字、
// 清空收回），本面只留壳与皮肤 utility（#950 清零后正本 = recipes.ts +
// ROW_SKIN）。选中行可见态单源在 PICK_ROW_BTN_CLS 基底（model-select-core，
// --pick-selected-bg/-fg 令牌对，#751 律随迁）。

import type { ChiefCompactionModel } from '@pacman/shared';
import type { ReactElement } from 'react';
import {
  createModelPicker,
  ModelPickList,
  type ModelRowSkin,
} from '../components/model-select-core.js';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover.js';
import type { ModelOption } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { MENU_ARROW_LEFT_CLS, MENU_SHELL_CLS } from './recipes.js';

/** r5 108 行形的皮肤组（#950 清零后 = token utility，旧 .chief-model-pick-*
 *  族等值：纵向 7px + 横向 20px（#872 壳垫 12 + 本面墨衬 8）/ gap 8 /
 *  name 13px 截断 / provider 11px tertiary）；比压缩弹层面多一层 col 列
 *  容器（名 + 副题纵排）。 */
const ROW_SKIN: ModelRowSkin = {
  row: 'h-auto gap-2 px-5 py-[7px]',
  col: 'flex min-w-0 flex-auto flex-col',
  name: 'truncate text-[13px] text-(--text-primary)',
  provider: 'text-[11px] text-(--text-tertiary)',
  check: 'inline-flex flex-none text-(--text-tertiary)',
};

interface ChiefModelPopoverProps {
  /** #73 retained-mount open flag。 */
  open?: boolean;
  /** 开合双向都归调用面（原语 onOpenChange 直通）：只接关闭会让触发钮点不
   *  开——Base UI Trigger 不再自带 onClick，开面必须由这里落 open=true。 */
  onOpenChange: (open: boolean) => void;
  /** 当前覆盖值（live = chief 封套真值）；null = 继承绑定 Agent 模型。 */
  value: ChiefCompactionModel | null;
  /** 候选模型（live = toModelOptions 投影，非 pi runtime 段）；缺省 = 仅默认行。 */
  options?: ModelOption[];
  /** live 面：选定 = PATCH chief model 槽；缺省 = fixture 律（选择即关）。 */
  onPick?: (value: ChiefCompactionModel | null) => void;
  /** 触发钮（调用面渲染，本面经 PopoverTrigger render 合成——Positioner 锚
   *  定触发钮本体，FloatingShell 时代的 wrap container 律就此退役）。 */
  trigger: ReactElement;
}

export function ChiefModelPopover({
  open,
  onOpenChange,
  value,
  options,
  onPick,
  trigger,
}: ChiefModelPopoverProps) {
  const { t } = useI18n();
  // 选中当前值 = 空操作关面；否则先关面再上报（律单源 model-select-core）。
  const pick = createModelPicker({ value, close: () => onOpenChange(false), onPick });

  return (
    <Popover open={open ?? false} onOpenChange={onOpenChange}>
      {/* #854 收编 components/ui/popover（Base UI Popover + Positioner）：
          开合 / Esc / 外点关 / 焦点归还全归原语；ModelPickList 原样做面板
          内容。定位正本迁 Positioner 参数（side=bottom align=start
          sideOffset=8 = 原 left:0 top:calc(100%+8px) 贴 wrap）。 */}
      <PopoverTrigger render={trigger} />
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={8}
        aria-label={t('模型')}
        className={`${MENU_SHELL_CLS} ${MENU_ARROW_LEFT_CLS} w-[280px]`}
      >
        <ModelPickList
          skin={ROW_SKIN}
          options={options ?? []}
          value={value}
          defaultLabel={t('默认（与绑定 Agent 相同）')}
          listLabel={t('模型')}
          searchPlaceholder={t('搜索模型…')}
          emptyLabel={t('没有匹配的模型')}
          onPick={pick}
        />
      </PopoverContent>
    </Popover>
  );
}
