// #903 派发方式选择器（ADR 0013，settings Agent tab「派发方式」槽的交互半）：
// 值 = chief.dispatchWithPlan（true = 先规划，默认档；false = 直接执行）；
// live 选定 = PATCH /chief dispatchWithPlan 槽，mutation 后 invalidateAll
// 重取回显，无本地乐观态（S8）；fixture 面 accept 律（#148：选择即关）。
//
// 行形态沿 ChiefMachineSelect 的 listbox 族（recipes.ts 共用皮肤；壳 =
// components/ui/popover 原语，开合 / Esc / 外点关 / 焦点归还全归 Base UI）。
// 两选项固定、无搜索。派发模式是服务端强制的团队设置（chief 工具面无
// withPlan 参数，报文塞值不生效）——本槽是该选择的唯一入口：选择权归人，
// 编排者不得单方撤销 confirm 闸（#892 实证病灶）。

import { useState } from 'react';
import { Button } from '../components/ui/button.js';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover.js';
import { useI18n } from '../i18n/provider.js';
import { Check, ChevronDown } from '../icons/index.js';
import {
  HOST_ROW_BTN_CLS,
  MENU_ARROW_RIGHT_CLS,
  MENU_SHELL_CLS,
  SELECT_TRIGGER_CLS,
  SELECT_VALUE_CLS,
} from './recipes.js';

/** 两档固定选项（label = zh 源串，渲染走 t()）。 */
const DISPATCH_OPTIONS: { value: boolean; label: string }[] = [
  { value: true, label: '先规划' },
  { value: false, label: '直接执行' },
];

interface ChiefDispatchSelectProps {
  /** 当前值（live = chief 封套 chief.dispatchWithPlan；fixture = ChiefContent
   *  dispatchWithPlan）；缺省按默认档 true 读（旧响应面加法契约）。 */
  value: boolean;
  /** live 面：选定 = PATCH chief dispatchWithPlan 槽；缺省 = fixture 律
   *  （选择即关，不回显新值）。 */
  onPick?: (dispatchWithPlan: boolean) => void;
}

export function ChiefDispatchSelect({ value, onPick }: ChiefDispatchSelectProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const label = value ? t('先规划') : t('直接执行');

  const pick = (next: boolean) => {
    setOpen(false);
    onPick?.(next);
  };

  return (
    <span className="relative ml-auto flex-none">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              className={`${SELECT_TRIGGER_CLS} min-w-35`}
              // aria-label = e2e 一级载体（机器/压缩模型面同律：独立命名防撞
              // strict mode 选择器）。
              aria-label={t('派发方式')}
              title={label}
            />
          }
        >
          <span className={SELECT_VALUE_CLS}>{label}</span>
          <ChevronDown width={12} height={12} className="flex-none text-(--text-tertiary)" />
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="bottom"
          sideOffset={8}
          aria-label={t('派发方式')}
          className={`${MENU_SHELL_CLS} ${MENU_ARROW_RIGHT_CLS} min-w-[200px]`}
        >
          <div role="listbox" aria-label={t('派发方式')}>
            {/* 行钮 = Button ghost + HOST_ROW_BTN_CLS 中和（recipes.ts）；选中态
                载体 = aria-selected（#910 裁定 3，本族不出选中底色只出 Check
                勾，机器选择器同律）。 */}
            {DISPATCH_OPTIONS.map((opt) => (
              <Button
                key={String(opt.value)}
                variant="ghost"
                className={HOST_ROW_BTN_CLS}
                role="option"
                aria-selected={opt.value === value}
                data-testid="chief-dispatch-row"
                onClick={() => pick(opt.value)}
              >
                <span className="min-w-0 flex-auto truncate">{t(opt.label)}</span>
                {opt.value === value && (
                  <span className="inline-flex flex-none text-(--text-tertiary)">
                    <Check width={14} height={14} />
                  </span>
                )}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </span>
  );
}
