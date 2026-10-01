// 复选原语（XMON-75）：真身是 `<input type="checkbox">`（键盘、表单语义、屏幕
// 阅读器都走原生），视觉骑一层自制 tile——方角 18px 实底 + 白勾。
//
// 为什么有这一件：API key 弹窗此前直接摆裸 `<input type="checkbox">`，画出来是
// 浏览器自带的方框（深色主题下发灰白，与仓内其它复选行不同族）；同一个仓里
// `.dlg-accept-check` / `.dlg-provider-check` 早就是这个 tile 形态，只是各写各的
// CSS。壳收成一份，形态与那两处逐值一致（18px / 4px 圆角 / --card-button 实底 /
// 关态 --border-strong 内描边）。

import { cn } from 'cn';
import type { ReactNode } from 'react';
import { CheckWhite } from '../../icons/index.js';
import './checkbox.css';

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** 可访问名。整行文字在本件 children 里时它是兜底，缺了文字就只有它。 */
  label: string;
  className?: string;
  /** 行内跟进来的文字——传了就是「整行可点」的复选行。 */
  children?: ReactNode;
}

export function Checkbox({ checked, onCheckedChange, label, className, children }: CheckboxProps) {
  return (
    <label className={cn('ui-checkbox', className)} data-on={checked}>
      <input
        type="checkbox"
        className="ui-checkbox-input"
        checked={checked}
        aria-label={label}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
      <span className="ui-checkbox-tile">{checked && <CheckWhite width={12} height={12} />}</span>
      {children}
    </label>
  );
}
