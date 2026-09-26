// Chip 原语（DESIGN.md 轨 A #A3）：任务状态五态（idle/plan/confirm/done/
// failed）+ neutral 元信息。色族对（tokens.css --chip-*-bg/fg）禁跨对混用。
// 18px 高 / 9999px / 11px，实测族 = detail-chip--*（#56，r7 23/16/17）。

import type { ReactNode } from 'react';
import './chip.css';

export interface ChipProps {
  variant?: 'idle' | 'plan' | 'confirm' | 'done' | 'failed' | 'neutral';
  children: ReactNode;
  className?: string;
}

export function Chip({ variant = 'neutral', children, className }: ChipProps) {
  const cls = ['chip', `chip--${variant}`, className].filter(Boolean).join(' ');
  return <span className={cls}>{children}</span>;
}
