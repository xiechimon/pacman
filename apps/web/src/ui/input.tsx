// Input 原语（DESIGN.md 轨 A #A3）：36px 高（dlg-form-input 实测族，#221）/
// 8px 圆角 / card-border 描边 / surface 底；focus = 1px primary 描边 + 发丝
// 环，禁外发光 halo。DESIGN.md 的 32px 与实测 36px 分歧见
// docs/a3/diff-audit.md，原语跟实测族。
// variant palette（A5）：行内裸输入——⌘K 搜索行（r7 05 实测 canon）的
// 无框透明形态（flex 伸展 + 13px 字 + primary 墨 / placeholder tertiary），
// 行容器几何（40px 行高 / padding / 图标）由消费点 per-face 承载。

import type { InputHTMLAttributes, Ref } from 'react';
import './input.css';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  variant?: 'boxed' | 'palette';
  /** React 19 ref-as-prop：@types 19 的 HTMLAttributes 系不再自带 ref 位，
   * 函数组件显式声明后在 ...rest 中透传给 input 元素（search-panel 的
   * mount-focus ref 走此路）。 */
  ref?: Ref<HTMLInputElement>;
};

export function Input({ variant = 'boxed', className, ...rest }: InputProps) {
  const cls = ['input', variant !== 'boxed' && `input--${variant}`, className]
    .filter(Boolean)
    .join(' ');
  return <input className={cls} {...rest} />;
}
