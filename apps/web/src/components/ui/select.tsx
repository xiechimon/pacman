// 单选选择器原语（XMON-75）：锚定浮层族的一员——触发钮 + FloatingShell 弹层 +
// ClickCatcher + role=listbox 选项表。
//
// 为什么有这一件：仓内「下拉」面此前各写各的——Agent 模型面是自制组件，Agent
// 默认 skill 与排期 日期·时·分 直接摆原生 select 控件。原生控件在 macOS 上弹的是
// 系统菜单（灰底、系统蓝高亮行、原生对勾），于是同一个表单里并排两种弹窗。壳只
// 写一份，差异只剩「候选怎么投影成行文案」——那由 options 的 label/meta 两字段
// 承载，面不再各写壳。
//
// 语法沿用 family law（FloatingShell + ClickCatcher + Esc，role=listbox/option，
// 选中即关面）。定位与几何正本：触发钮的 wrap 是 containing block（FloatingShell
// 的 container 指回 wrap），菜单 absolute 贴 wrap 左缘向下展开；z 走 --z-popover
// 压 ClickCatcher 的 29。
//
// #952（select.css 退役，spec/22 §3.1）：共用外观（弹层壳 / 行 / 勾选 / 退场
// visibility 桥）全部改件上 token utility，单源在本文件的 SELECT_* 常量；各面
// 的几何差（贴哪边、封多高、触发钮皮肤）经 `triggerClassName` / `menuClassName`
// 两个 className 位注入，tailwind-merge 同组覆盖——不再靠
// `.ui-select-menu.<prefix>-menu` 复合选择器赌模块图加载顺序。`prefix` 只出
// e2e 句柄类（`${prefix}-wrap|select|shell|menu|row|row-name|row-meta|check`，
// 零规则），缺省不出。

import { cn } from 'cn';
import { useState } from 'react';
import { Check, ChevronDown } from '../../icons/index.js';
import { ClickCatcher } from '../../overlays/dismiss.js';
import { Button } from './button.js';
import { EXIT_BRIDGE_CLS, FLOATING_POP_ANIM, FloatingShell } from './floating-shell.js';

/** 弹层壳（原 .ui-select-menu，V2 弹层 #790 P3）：1px 墨线框 / 直角 / 12px
 *  内垫 / 最小宽 220 / 封顶 300 自滚 / 按内容撑开（定宽会让行内容比盒子宽，
 *  溢出往左跑）+ 上指锚边左上的描边 Arrow（12×6 外三角压 10×5 内三角，
 *  clip-path utility 承载；落进壳垫区，随内容滚动，不碰 overflow 机制）。
 *  #688 阶梯 --z-popover 压 --z-catcher 的 29（overlays/dismiss.tsx）。 */
export const SELECT_MENU_CLS =
  "absolute top-[calc(100%+8px)] left-0 z-(--z-popover) flex max-h-[300px] w-max min-w-[220px] max-w-[360px] flex-col overflow-y-auto rounded-none border border-(--border-default) bg-(--popover-bg) p-3 shadow-(--edge-shadow) before:absolute before:top-px before:left-4 before:h-1.5 before:w-3 before:bg-(--border-default) before:[clip-path:polygon(0_100%,50%_0,100%_100%)] before:content-[''] after:absolute after:top-0.5 after:left-[17px] after:h-[5px] after:w-2.5 after:bg-(--popover-bg) after:[clip-path:polygon(0_100%,50%_0,100%_100%)] after:content-['']";

/** 选项行（原 .ui-select-row）：壳垫 12px 后行内横缩清零——字墨 inset 仍是
 *  12；纵向 6px。ghost 底座按七通道律中和（spec/22 §5.0），hover 回
 *  --surface-secondary 皮肤（原行 hover 同值）。 */
export const SELECT_ROW_CLS =
  'h-auto w-full cursor-pointer justify-start gap-2 rounded-[6px] border-none bg-transparent px-0 py-1.5 text-left text-[13px] font-normal leading-[inherit] text-(--text-primary) hover:bg-(--surface-secondary) hover:text-(--text-primary) dark:hover:bg-(--surface-secondary) aria-expanded:bg-transparent aria-expanded:text-(--text-primary) active:not-aria-[haspopup]:translate-y-0';

/** 一行候选。`meta` 是行右侧次级文本（模型面的 provider 位用得到），缺省不出。 */
export interface SelectOption {
  value: string;
  label: string;
  meta?: string;
}

interface SelectProps {
  /** 面钩子（可选）：输出 `${prefix}-wrap|select|shell|menu|row|row-name|row-meta|check`
   *  零规则句柄类。e2e 定位用；不传则不出。 */
  prefix?: string;
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
  /** 触发钮皮肤/几何位（ghost 底座上的面配方；tailwind-merge 同组覆盖）。 */
  triggerClassName?: string;
  /** 弹层几何位（锚边 / 封顶 / 最小宽等面差；同组覆盖 SELECT_MENU_CLS）。 */
  menuClassName?: string;
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
  triggerClassName,
  menuClassName,
  disabled = false,
  onPick,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [wrap, setWrap] = useState<HTMLSpanElement | null>(null);
  // 句柄类（prefix 缺省不出）：wrap/select/shell/menu/row/row-name/row-meta/check。
  const hook = (part: string) => (prefix == null ? '' : ` ${prefix}-${part}`);

  const pick = (next: string | null) => {
    setOpen(false); // accept 律：选择即关；真值经 invalidateAll 重取回显
    onPick(next);
  };

  return (
    <span className={`relative inline-flex${hook('wrap')}`} ref={setWrap}>
      <Button
        variant="ghost"
        className={cn(
          `justify-start font-normal leading-[inherit] [&_svg:not([class*='size-'])]:size-3${hook('select')}`,
          triggerClassName,
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={triggerLabel}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown width={12} height={12} />
      </Button>
      {/* disabled 态不挂弹层：触发钮已 pointer-events-none，弹层挂着只会留一个
          永远够不着的 ClickCatcher 面。 */}
      {!disabled && (
        <FloatingShell
          open={open}
          onClose={() => setOpen(false)}
          container={wrap}
          // 退场 visibility 桥（EXIT_BRIDGE_CLS）撑住 Base UI 卸载窗，让面板的
          // animate-out 播完（各 prefix 共用一条）。
          className={`${EXIT_BRIDGE_CLS}${hook('shell')}`}
        >
          <ClickCatcher onClose={() => setOpen(false)} />
          <div
            className={cn(`${SELECT_MENU_CLS}${hook('menu')} ${FLOATING_POP_ANIM}`, menuClassName)}
            role="listbox"
            aria-label={menuLabel}
          >
            {unsetLabel !== undefined && (
              <Button
                variant="ghost"
                className={`${SELECT_ROW_CLS}${hook('row')} [&_svg:not([class*='size-'])]:size-3.5`}
                role="option"
                aria-selected={value === null}
                onClick={() => pick(null)}
              >
                <span className={`min-w-0 flex-1 truncate${hook('row-name')}`}>{unsetLabel}</span>
                {value === null && (
                  <span className={`inline-flex${hook('check')}`}>
                    <Check width={14} height={14} />
                  </span>
                )}
              </Button>
            )}
            {options.map((row) => (
              <Button
                key={row.value}
                variant="ghost"
                className={`${SELECT_ROW_CLS}${hook('row')} [&_svg:not([class*='size-'])]:size-3.5`}
                role="option"
                aria-selected={row.value === value}
                onClick={() => pick(row.value)}
              >
                <span className={`min-w-0 flex-1 truncate${hook('row-name')}`}>{row.label}</span>
                {row.meta !== undefined && (
                  <span
                    className={`flex-none whitespace-nowrap text-[12px] text-(--text-tertiary)${hook('row-meta')}`}
                  >
                    {row.meta}
                  </span>
                )}
                {row.value === value && (
                  <span className={`inline-flex${hook('check')}`}>
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
