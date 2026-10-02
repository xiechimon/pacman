// Button 原语（DESIGN.md 轨 A #A3）：variant × size 收敛全站按钮散写。
// variant 语义：primary=主操作（--card-button 实底 + --text-on-accent），
// danger=破坏性（--danger 实底，禁用降透明度不换底色），
// quiet=弱文字钮（text-dim，r7 25 delete-confirm-cancel canon），
// icon=纯图标钮（皮肤层：居中 + tertiary 墨 + hover 增亮；盒尺寸由消费点
// per-face 叠加——dlg-copy 24 / branch 13×16 实测差异大，
// 原语不锁几何）。icon/quiet 不吃 size。
// size = compact 28（顶栏·通知条实测档）；ghost/text 变体与 card/
// standard/overlay 档已随各自消费面退役（#658）。
// 圆角统一 8px（DEFAULT）；board 域 6px 差异在 docs/a3/diff-audit.md 待
// 裁决——收编该域时若裁决保留差异再加 radius prop，不提前抽象。
// type 默认 button：防表单内隐式 submit；要提交语义显式传 type="submit"。

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './button.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'icon' | 'quiet';
  size?: 'compact';
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  // icon/quiet 不渲染 size 类（A4-deep 上游观察修正）：几何纯 per-face，
  // size 档的 height/padding 不再泄漏进这两面。
  const sizeless = variant === 'icon' || variant === 'quiet';
  const cls = ['btn', `btn--${variant}`, !sizeless && size && `btn--${size}`, className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  );
}
