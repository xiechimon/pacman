// StatusChip 适配层（#942 正典表 §5.2）：老 ui/chip.tsx 的任务五态 chip 落
// 到 components/ui/badge.tsx（registry 件）上——与 TagChip（Badge 骨架 +
// token utility 皮肤）/ SeededAvatar（registry 件适配）先例同形：本地适配
// 件、零 CSS、不自建 registry 件。
//
// 为什么不走 Badge 的 registry 语义皮肤（destructive/secondary 等）：五对
// --chip-*-bg/fg 是 spec/22 §1.7/1.8 的 1:1 翻值槽（0 退，对比度实测封版），
// 且 plan/confirm 两态在 registry 档里没有语义对应——皮肤槽只借 Badge 的
// 几何骨架，色由 token utility 承载（tailwind-merge 覆盖基皮肤两槽，
// TagChip 同手法）。
//
// 几何（spec/22 §2.5 冻结件 + 正典表 §5.2）：default = Badge registry 默认
// h-5（替旧 md 18px）；sm = h-4 / px-1.5 / text-[10px]（替旧 mini 14px，
// 先例 = tag-chip 的 row-flush 16px 档）。增长是 D2 几何自由重设计的有意
// 结果，非回归。
//
// 状态载体：data-tone（#910 裁定 3——状态类断言归行为，载体改 data-*）；
// .chip/.chip--<tone> 类名 locator 随本件退役。tone 语义源 = phase.ts 的
// PHASE_UI.tone，prop 名与之对齐。

import { cn } from 'cn';
import type { ReactNode } from 'react';
import { Badge } from './badge.js';

const TONE_SKIN = {
  idle: 'bg-(--chip-idle-bg) text-(--chip-idle-fg)',
  plan: 'bg-(--chip-plan-bg) text-(--chip-plan-fg)',
  confirm: 'bg-(--chip-confirm-bg) text-(--chip-confirm-fg)',
  done: 'bg-(--chip-done-bg) text-(--chip-done-fg)',
  failed: 'bg-(--chip-failed-bg) text-(--chip-failed-fg)',
} as const;

export type StatusTone = keyof typeof TONE_SKIN;

export interface StatusChipProps {
  /** 任务五态（对齐 PHASE_UI.tone）。 */
  tone: StatusTone;
  /** sm = 密集行档（h-4）；default = Badge registry h-5。 */
  size?: 'default' | 'sm';
  /** per-face 别名/定位类透传——存活至执行域退役（正典表 §5.0 残留律）。 */
  className?: string;
  children: ReactNode;
}

export function StatusChip({ tone, size = 'default', className, children }: StatusChipProps) {
  return (
    <Badge
      data-tone={tone}
      className={cn(TONE_SKIN[tone], size === 'sm' && 'h-4 px-1.5 text-[10px]', className)}
    >
      {children}
    </Badge>
  );
}
