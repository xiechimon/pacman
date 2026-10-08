// Shared dismiss wiring for the anchored overlays (issue #67): the click
// catcher is a transparent fixed layer one step under the popover (z 29 vs
// 30) so page content stays clickable-through nowhere while an overlay is
// open.
// #1008（#983 判决：floating-shell 族拆退役）：族内消费点已全部迁 registry
// 件（外点关归 Base UI 原生 outside-press / modal 背板）——本件唯一存量
// 消费 = components/ui/select.tsx（#1010 波 2 重建后随 floating-shell.tsx
// 一并删除）。「外点只关不穿透」vs 原生 outside-press 穿透的 UX 取舍 =
// #1008 原型实审裁决项。
// #949：裸 button 收编 components/ui Button（ghost 档全通道中和——捕点击
// 层无视觉，只留 fixed inset-0 + --z-catcher 档位，#688 阶梯单源在
// tokens.css）。

import { Button } from '../components/ui/button.js';

export function ClickCatcher({ onClose }: { onClose: () => void }) {
  return (
    <Button
      variant="ghost"
      className="fixed inset-0 z-(--z-catcher) h-auto w-auto cursor-default rounded-none border-none bg-transparent p-0 hover:bg-transparent hover:text-inherit dark:hover:bg-transparent active:not-aria-[haspopup]:translate-y-0"
      tabIndex={-1}
      aria-hidden="true"
      onClick={onClose}
    />
  );
}
