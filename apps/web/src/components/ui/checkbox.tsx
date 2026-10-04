// 复选原语（XMON-75 建、XMON-72 收口、#690 迁 Base UI 官方件、#789 P2 落 V2
// 骨架与手作动效）：Root 渲染 span[role=checkbox] + 官方隐藏原生 input（键盘、
// 表单语义、屏幕阅读器都由官方件承载，indeterminate 成为一等 prop），视觉
// tile 就骑在 Root 本体上——16px 方角、圆角 0、开态 --card-button 实底 +
// 主题色勾（Check 走 currentColor，tile 的 --text-on-accent 进勾：亮底白勾 /
// 暗底深勾，硬编码白勾在暗紫底上只有约 1.7:1）；关态透明底 + 1px
// --border-strong 内描边，状态钩子走官方 data-checked / data-unchecked。
// 勾只随 checked 渲染——未选中态不露勾是复选语义的一部分（Indicator 默认不
// 挂载，进退场动效见 checkbox.css）。整行可点靠 label 包裹：点文字走 label
// 激活行为转发到隐藏 input；点 tile 由 Root 接管（preventDefault 后自行派发，
// 不会经 label 二次翻转）。id 落在隐藏 input 上（官方契约），e2e 定位与
// checked 断言照旧可用。

import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { cn } from 'cn';
import type { ReactNode } from 'react';
import { Check } from '../../icons/index.js';
import './checkbox.css';

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** 可访问名。整行文字在本件 children 里时它是兜底，缺了文字就只有它。 */
  label: string;
  /** 透传隐藏原生 input 的 id——外部 pin（e2e 定位 / label htmlFor）用。 */
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
    // biome-ignore lint/a11y/noLabelWithoutControl: Base UI Checkbox.Root renders its hidden native input inside this label at runtime (official composition); the static check cannot see through the component.
    <label className={cn('ui-checkbox', className)}>
      <CheckboxPrimitive.Root
        className="ui-checkbox-tile"
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      >
        <CheckboxPrimitive.Indicator className="ui-checkbox-indicator">
          <Check width={12} height={12} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {children}
    </label>
  );
}
