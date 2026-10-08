// StatusChip 零皮肤适配层（#983 判决：保留，票面例「任务五态→Badge 的状态
// 属性」即本件现状；地图 #980 前提②）：registry Badge 骨架 + data-tone 状态
// 载体 + 五对 --chip-* token utility——只做语义映射，不带自有几何。
//
// sm 几何档已按 #983 判决删除（base-nova Badge 无 size 档，h-4/10px 超出
// 官网形态）——全部消费面收敛 registry h-5 默认几何（前提④：几何冲突
// registry 默认赢；密集行回流由各自域重钉）。
//
// 为什么不走 Badge 的 registry 语义皮肤（destructive/secondary 等）：
// plan/confirm 两态在 registry variant 无语义对应，且五对 --chip-*-bg/fg
// 是 spec/22 §1.7/1.8 的 1:1 翻值槽（暗/亮双模对比度实测 PASS 封版）——
// 色由 token 层承载，恰合前提④「用户自行决定只经 token 层生效」。
//
// 状态载体：data-tone（#910 裁定 3——状态类断言归行为，载体改 data-*）；
// tone 语义源 = phase.ts 的 PHASE_UI.tone，prop 名与之对齐。

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
  /** per-face 别名/定位类透传——存活至执行域退役（正典表 §5.0 残留律）。 */
  className?: string;
  children: ReactNode;
}

export function StatusChip({ tone, className, children }: StatusChipProps) {
  return (
    <Badge data-tone={tone} className={cn(TONE_SKIN[tone], className)}>
      {children}
    </Badge>
  );
}
