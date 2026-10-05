// 单选选择器原语（XMON-75）：锚定浮层族的一员——触发钮 + FloatingShell 弹层 +
// ClickCatcher + role=listbox 选项表。
//
// 为什么有这一件：仓内「下拉」面此前各写各的——Agent 模型面是自制组件，Agent
// 默认 skill 与排期 日期·时·分 直接摆原生 `<select>`。原生控件在 macOS 上弹的是
// 系统菜单（灰底、系统蓝高亮行、原生对勾），于是同一个表单里并排两种弹窗。壳只
// 写一份，差异只剩「候选怎么投影成行文案」——那由 options 的 label/meta 两字段
// 承载，面不再各写壳。
//
// 语法沿用 family law（FloatingShell + ClickCatcher + Esc，role=listbox/option，
// 选中即关面）。定位与几何正本：触发钮的 wrap 是 containing block（FloatingShell
// 的 container 指回 wrap），菜单 absolute 贴 wrap 左缘向下展开；z 30 压 ClickCatcher
// 的 29。
//
// 类名双出：`ui-select-*` 是共用外观（select.css），`${prefix}-*` 是该面的钩子
// （e2e 定位 + 面自己的几何）。面 CSS 覆盖几何一律写 `.ui-select-menu.<prefix>-menu`
// 复合选择器——域 CSS 与 select.css 同层同权重，靠加载顺序决定是赌模块图。

import { useState } from 'react';
import { Check, ChevronDown } from '../../icons/index.js';
import { ClickCatcher } from '../../overlays/dismiss.js';
import { Button } from './button.js';
import { FLOATING_POP_ANIM, FloatingShell } from './floating-shell.js';
import './select.css';

/** 一行候选。`meta` 是行右侧次级文本（模型面的 provider 位用得到），缺省不出。 */
export interface SelectOption {
  value: string;
  label: string;
  meta?: string;
}

interface SelectProps {
  /** 面钩子：输出 `${prefix}-wrap|select|shell|menu|row|row-name|row-meta|check`。 */
  prefix: string;
  /** 当前值。null = 该槽为空（配 `unsetLabel` 即出清空行）。 */
  value: string | null;
  options: SelectOption[];
  /** 触发钮上的当前值文案。值命中不了选项时的裸串兜底各面不同，故由调用面算。 */
  label: string;
  /** 首行「清空」档的文案；缺省 = 该槽不可空，不出这一行。 */
  unsetLabel?: string;
  /** 依赖门（t-0024 两级选择器的二级用）：true = 触发钮不可点、弹层不出。
   *  与「死钮不渲染」(#222) 的分界：这是时序门（上游选定后即启用），不是
   *  永久无接线的死 affordance。 */
  disabled?: boolean;
  /** listbox 的可访问名。 */
  menuLabel: string;
  /** 触发钮的可访问名。缺省不出——触发钮文案本身可读时（模型名、skill 名）
   *  再加一个名字只会盖掉它；值形如 `00` 的纯值控件才需要。 */
  triggerLabel?: string;
  onPick: (value: string | null) => void;
}

export function Select({
  prefix,
  value,
  options,
  label,
  unsetLabel,
  menuLabel,
  triggerLabel,
  disabled = false,
  onPick,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [wrap, setWrap] = useState<HTMLSpanElement | null>(null);

  const pick = (next: string | null) => {
    setOpen(false); // accept 律：选择即关；真值经 invalidateAll 重取回显
    onPick(next);
  };

  return (
    <span className={`ui-select-wrap ${prefix}-wrap`} ref={setWrap}>
      <Button
        variant="ghost"
        className={`ui-select-trigger ${prefix}-select justify-start font-normal leading-[inherit] [&_svg:not([class*='size-'])]:size-3`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={triggerLabel}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="ui-select-label">{label}</span>
        <ChevronDown width={12} height={12} />
      </Button>
      {/* disabled 态不挂弹层：触发钮已 pointer-events-none，弹层挂着只会留一个
          永远够不着的 ClickCatcher 面。 */}
      {!disabled && (
        <FloatingShell
          open={open}
          onClose={() => setOpen(false)}
          container={wrap}
          // ui-select-shell = 本原语共用的退场 visibility 桥（select.css），
          // 撑住 Base UI 卸载窗让面板的 animate-out 播完（各 prefix 共用一条）。
          className={`${prefix}-shell ui-select-shell`}
        >
          <ClickCatcher onClose={() => setOpen(false)} />
          <div
            className={`ui-select-menu ${prefix}-menu ${FLOATING_POP_ANIM}`}
            role="listbox"
            aria-label={menuLabel}
          >
            {unsetLabel !== undefined && (
              <Button
                variant="ghost"
                className={`ui-select-row ${prefix}-row justify-start h-auto font-normal leading-[inherit] [&_svg:not([class*='size-'])]:size-3.5`}
                role="option"
                aria-selected={value === null}
                onClick={() => pick(null)}
              >
                <span className={`ui-select-row-name ${prefix}-row-name`}>{unsetLabel}</span>
                {value === null && (
                  <span className={`ui-select-check ${prefix}-check`}>
                    <Check width={14} height={14} />
                  </span>
                )}
              </Button>
            )}
            {options.map((row) => (
              <Button
                key={row.value}
                variant="ghost"
                className={`ui-select-row ${prefix}-row justify-start h-auto font-normal leading-[inherit] [&_svg:not([class*='size-'])]:size-3.5`}
                role="option"
                aria-selected={row.value === value}
                onClick={() => pick(row.value)}
              >
                <span className={`ui-select-row-name ${prefix}-row-name`}>{row.label}</span>
                {row.meta !== undefined && (
                  <span className={`ui-select-row-meta ${prefix}-row-meta`}>{row.meta}</span>
                )}
                {row.value === value && (
                  <span className={`ui-select-check ${prefix}-check`}>
                    <Check width={14} height={14} />
                  </span>
                )}
              </Button>
            ))}
          </div>
        </FloatingShell>
      )}
    </span>
  );
}
