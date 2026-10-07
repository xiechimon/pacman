// KbdHint 适配层（XMON-14）：落在 components/ui/kbd.tsx（registry 件）上，
// 输出 #468 的快捷键悬浮提示 chip——承载控件 hover/focus-visible 时浮出，
// 静息隐藏。
//
// registry Kbd 的默认皮肤是「文档正文里的按键角标」（h-5 灰底圆角 + 12px 字），
// 本仓的 chip 是「悬浮于内容之上的提示」（11px 字、3px 圆角、--surface 底 + 轻
// 投影、绝对定位）。故本层用 cn 把 registry 的尺寸/配色档逐项改写到仓内值
// （tailwind-merge 按同一属性组后者胜，覆盖是确定的，不依赖样式表顺序）。
//
// label 沿用 sidebar badge 的字面量先例（⌘K / N 不做平台探测、不进 i18n 词典；
// 非 mac 实际绑定 Ctrl+ 同族，hotkeys 注册处双平台收）。
// aria-hidden：chip 是视觉提示，读屏语义由控件自身的 aria-label 承载。
// 静息隐藏走 visibility（不是只靠 opacity）——Playwright 的可见性判定不把
// opacity:0 当 hidden，e2e 的 toBeHidden 探针（hotkeys.spec）依赖这一点。

import { cn } from 'cn';
import { Kbd } from './kbd.js';

/** 落位变体 → 几何类。 */
const PLACEMENT: Record<'above' | 'right' | 'below', string> = {
  // 右下角 FAB 族：chip 浮在钮正上方、右对齐
  above: 'bottom-[calc(100%+8px)] right-0',
  // 收起态 rail 行：chip 弹在图标右侧、垂直居中
  right: 'top-1/2 left-[calc(100%+8px)] -translate-y-1/2',
  // 抽屉头部行（#645 新主题钮）：chip 浮在钮正下方、右对齐——头部贴视口顶，
  // above 会落到屏外
  below: 'top-[calc(100%+8px)] right-0',
};

export function KbdHint({
  label,
  placement = 'above',
}: {
  label: string;
  /** above = 右下角 FAB 族（浮在钮上方）；right = rail 行（弹在图标右侧）；
   *  below = 抽屉头部行（浮在钮下方，#645）。 */
  placement?: 'above' | 'right' | 'below';
}) {
  return (
    <Kbd
      aria-hidden="true"
      className={cn(
        'kbd-hint',
        PLACEMENT[placement],
        // registry 档 → 仓内 chip 档（tailwind-merge 逐组覆盖）
        'absolute invisible z-(--z-hint) h-auto min-w-0 gap-0 rounded-[3px] border border-border bg-(--card) px-[3px] py-px text-[11px] leading-4 whitespace-nowrap opacity-0 shadow-[0_1px_4px_rgb(0_0_0_/_0.12)] transition-[opacity,visibility] duration-[120ms] ease-[ease]',
        // 显示律 = 直接父级（承载快捷键的控件本身）hover 或 focus-visible
        '[:is(:hover,:focus-visible)>&]:visible [:is(:hover,:focus-visible)>&]:opacity-100',
      )}
    >
      {label}
    </Kbd>
  );
}
