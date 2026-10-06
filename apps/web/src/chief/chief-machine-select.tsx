// #895 主力机选择器（spec 21 A6，settings Agent tab「机器」槽的交互半）：
// 值 = chief.machineId（null = 自动）；live 选定 = PATCH /chief machineId 槽
// （null 清回自动），mutation 后 invalidateAll 重取回显，无本地乐观态（S8）；
// fixture 面 accept 律（#148：选择即关）。
//
// 行形态沿 new-task machine chip 的 listbox 族（new-task-dialog.tsx ——
// 首行「自动」+ 机器行带 online dot + 选中 Check）；壳用 components/ui/
// popover 原语（本面 #854 后的正典：开合 / Esc / 外点关 / 焦点归还全归
// Base UI Popover）。离线机器行照常可选——钉选语义 = 步只投给该机并等它
// 上线（server claim 过滤面），UI 不替用户挡（new-task chip 同律）。

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

/** online dot（#950 清零，旧 .chief-host-dot 等值：new-task-machine-dot 同族
 *  同值——6px / 在线绿 --col-dot-done / 离线灰 --col-dot-idle；灰点只表状态
 *  不禁用，钉离线机器 = 等它上线的合法语义）。 */
const HOST_DOT_CLS =
  'size-1.5 flex-none rounded-full bg-(--col-dot-done) data-[on=false]:bg-(--col-dot-idle)';

/** 机器行最小投影（new-task-dialog MachineOption 同形；live = useMachines
 *  行投影，fixture = resources machines 行集）。 */
export interface ChiefMachineOption {
  id: string;
  name: string;
  online?: boolean;
}

interface ChiefMachineSelectProps {
  /** 当前值（live = chief 封套 chief.machineId；fixture = ChiefContent
   *  machineId）；null = 自动。 */
  value: string | null;
  /** 候选机器行；缺省 = 空清单（fixture 无 resources 的面：仅「自动」行）。 */
  machines?: ChiefMachineOption[];
  /** live 面：选定 = PATCH chief machineId 槽（null = 清回自动）；缺省 =
   *  fixture 律（选择即关，不回显新值）。 */
  onPick?: (machineId: string | null) => void;
}

export function ChiefMachineSelect({ value, machines, onPick }: ChiefMachineSelectProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rows = machines ?? [];
  // 回显：值命中行集 → 机器名（离线机器如实显示离线 dot）；悬空（机器被删/
  // 行集未决）→ 裸串兜底（模型选择器同律，不空白不崩）；null = 自动。
  const selected = rows.find((row) => row.id === value) ?? null;
  const label = selected?.name ?? (value !== null ? value : t('自动'));

  const pick = (machineId: string | null) => {
    setOpen(false);
    onPick?.(machineId);
  };

  return (
    <span className="relative ml-auto flex-none">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              className={`${SELECT_TRIGGER_CLS} min-w-35`}
              // #950: aria-label = e2e 一级载体（旧 button.chief-host-select
              // 类 locator 退役；独立命名防撞压缩模型面，strict-mode 律随迁）。
              // #772 同律：长机器名截断后全称走 title 悬停可达。
              aria-label={t('机器')}
              title={label}
            />
          }
        >
          <span className={HOST_DOT_CLS} data-on={selected?.online ?? true} aria-hidden="true" />
          <span className={SELECT_VALUE_CLS}>{label}</span>
          <ChevronDown width={12} height={12} className="flex-none text-(--text-tertiary)" />
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="bottom"
          sideOffset={8}
          aria-label={t('机器')}
          className={`${MENU_SHELL_CLS} ${MENU_ARROW_RIGHT_CLS} min-w-[200px]`}
        >
          <div role="listbox" aria-label={t('机器')}>
            {/* #950 裸控件收编：行钮 = Button ghost + HOST_ROW_BTN_CLS 七通道
                中和（recipes.ts）；选中态载体 = aria-selected（#910 裁定 3，
                本族不出选中底色只出 Check 勾，new-task chip 同律）。 */}
            <Button
              variant="ghost"
              className={HOST_ROW_BTN_CLS}
              role="option"
              aria-selected={value === null}
              data-testid="chief-host-auto"
              onClick={() => pick(null)}
            >
              <span className={HOST_DOT_CLS} data-on={true} aria-hidden="true" />
              <span className="min-w-0 flex-auto truncate">{t('自动')}</span>
              {value === null && (
                <span className="inline-flex flex-none text-(--text-tertiary)">
                  <Check width={14} height={14} />
                </span>
              )}
            </Button>
            {rows.map((row) => (
              <Button
                key={row.id}
                variant="ghost"
                className={HOST_ROW_BTN_CLS}
                role="option"
                aria-selected={row.id === value}
                data-testid="chief-host-row"
                onClick={() => pick(row.id)}
              >
                <span className={HOST_DOT_CLS} data-on={row.online ?? true} aria-hidden="true" />
                <span className="min-w-0 flex-auto truncate">{row.name}</span>
                {row.id === value && (
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
