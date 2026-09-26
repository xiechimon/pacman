// Input 原语（DESIGN.md 轨 A #A3）：36px 高（dlg-form-input 实测族，#221）/
// 8px 圆角 / card-border 描边 / surface 底；focus = 1px primary 描边 + 发丝
// 环，禁外发光 halo。DESIGN.md 的 32px 与实测 36px 分歧见
// docs/a3/diff-audit.md，原语跟实测族。

import type { InputHTMLAttributes } from 'react';
import './input.css';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...rest }: InputProps) {
  const cls = ['input', className].filter(Boolean).join(' ');
  return <input className={cls} {...rest} />;
}
