// Shared dismiss wiring for the anchored overlays (issue #67): the click
// catcher is a transparent fixed layer one step under the popover (z 29 vs
// 30) so page content stays clickable-through nowhere while an overlay is
// open. Close affordances are [推断] — no capture exercises them; pixels are
// unaffected.
// #656：家族旧另两件（retained-mount 计时 wrapper 与手写 Esc hook）随全站
// 收敛退役——卸载窗由 FloatingShell / DialogShell 适配层的零视觉 visibility
// 桥撑住（Base UI getAnimations 不看子树），Esc 归 Base UI layer 栈（只关
// 最顶层），进出场动效归 tw-animate-css 缺省档（ADR 0009）。

import './overlays.css';

export function ClickCatcher({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      className="overlay-click-catcher"
      tabIndex={-1}
      aria-hidden="true"
      onClick={onClose}
    />
  );
}
