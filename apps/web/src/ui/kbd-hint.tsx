// KbdHint 原语（#468）：快捷键悬浮提示 chip——hover/focus-visible 承载
// 控件时浮出，静息隐藏（样式 = ui/kbd-hint.css，视觉语言复用 sidebar-kbd
// 角标）。label 沿用 sidebar badge 的字面量先例（⌘K / N 不做平台探测、
// 不进 i18n 词典；非 mac 实际绑定 Ctrl+ 同族，hotkeys 注册处双平台收）。
// aria-hidden：chip 是视觉提示，读屏语义由控件自身的 aria-label 承载。

import './kbd-hint.css';

export function KbdHint({
  label,
  placement = 'above',
}: {
  label: string;
  /** above = 右下角 FAB 族（浮在钮上方）；right = rail 行（弹在图标右侧）。 */
  placement?: 'above' | 'right';
}) {
  return (
    <span aria-hidden="true" className={`kbd-hint kbd-hint--${placement}`}>
      {label}
    </span>
  );
}
