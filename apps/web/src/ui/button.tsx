// Button 原语（DESIGN.md 轨 A #A3）：variant × size 收敛全站按钮散写。
// variant 语义：primary=主操作（--card-button 实底 + --text-on-accent），
// ghost=次操作（描边 + secondary 墨），danger=破坏性（--danger 实底，
// 禁用降透明度不换底色），text=无框链接式（--indigo-500 字，如 +任务），
// quiet=弱文字钮（text-dim，r7 25 delete-confirm-cancel canon），
// icon=纯图标钮（皮肤层：居中 + tertiary 墨 + hover 增亮；盒尺寸由消费点
// per-face 叠加——board-guide 28 / dlg-copy 24 / branch 13×16 实测差异大，
// 原语不锁几何）。icon/quiet/text 不吃 size。
// size = 实测三档：card 26（看板卡内）/ compact 28（顶栏·通知条）/
// standard 32（表单·弹窗，#221 族实测）。
// 圆角统一 8px（DEFAULT）；board 域 6px 差异在 docs/a3/diff-audit.md 待
// 裁决——收编该域时若裁决保留差异再加 radius prop，不提前抽象。
// type 默认 button：防表单内隐式 submit；要提交语义显式传 type="submit"。

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './button.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'text' | 'icon' | 'quiet';
  size?: 'card' | 'compact' | 'standard';
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'standard',
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const cls = ['btn', `btn--${variant}`, `btn--${size}`, className].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  );
}
