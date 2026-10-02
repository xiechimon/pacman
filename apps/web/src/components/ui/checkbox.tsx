// 复选原语（XMON-75 建、XMON-72 收口全仓消费面）：真身是
// `<input type="checkbox">`（键盘、表单语义、屏幕阅读器都走原生），视觉骑一层
// 自制 tile——方角 18px 实底 + 白勾；关态透明底 + 1px --border-strong 内描边。
// 白勾只随 checked 渲染——未选中态不露勾是复选语义的一部分。

import { cn } from 'cn';
import type { ReactNode } from 'react';
import { CheckWhite } from '../../icons/index.js';
import './checkbox.css';

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** 可访问名。整行文字在本件 children 里时它是兜底，缺了文字就只有它。 */
  label: string;
  /** 透传真 input 的 id——外部 pin（e2e 定位 / label htmlFor）用。 */
  id?: string;
  className?: string;
  /** 行内跟进来的文字——传了就是「整行可点」的复选行。 */
  children?: ReactNode;
}

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  id,
  className,
  children,
}: CheckboxProps) {
  return (
    <label className={cn('ui-checkbox', className)} data-on={checked}>
      <input
        type="checkbox"
        className="ui-checkbox-input"
        id={id}
        checked={checked}
        aria-label={label}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
      <span className="ui-checkbox-tile">{checked && <CheckWhite width={12} height={12} />}</span>
      {children}
    </label>
  );
}
