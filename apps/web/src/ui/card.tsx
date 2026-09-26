// Card 原语（DESIGN.md 轨 A #A3）：edge 家族配方（tokens.css #139/#161
// 单源）——inset 发丝环（分数缩放不花）+ 12px 圆角 + card 级微影。
// tone：card=任务卡（--card-bg）/ inset=看板列容器（--col-bg）/
// elevated=浮面卡片（--surface-secondary，如通知条）。

import type { HTMLAttributes, ReactNode } from 'react';
import './card.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: 'card' | 'inset' | 'elevated';
  children: ReactNode;
}

export function Card({ tone = 'card', className, children, ...rest }: CardProps) {
  const cls = ['card', tone !== 'card' && `card--${tone}`, className].filter(Boolean).join(' ');
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}
