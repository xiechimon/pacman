// Panel —— 贴在页面里的静息内容容器（非弹层、非交互卡）。
//
// 为什么不改造 components/ui/card.tsx：shadcn Card 的皮肤
// （ring-1 ring-foreground/10 + rounded-xl + py-(--card-spacing) + bg-card）
// 与仓内实际需求错配——它的 4 个消费点全都用 ring-0 / py-0 / 显式圆角把皮肤
// 覆盖掉，只借它的 flex flex-col 布局壳。往 card.tsx 里塞第二套皮肤，会把上游
// 重拉纪律要守的那几处仓内偏离（#414 / #423 / #425）的冲突面翻倍。
// 分工：Card = 布局容器（皮肤由消费点自带）；Panel = 静息容器（自带皮肤档）。
//
// 皮肤档 variant 的取色正本见 DESIGN.md：
//   quiet    = --surface-secondary 底、无描边 —— 页面内嵌块
//   outlined = 1px --border-default 描边 + --surface 底 —— 页面级外框容器
// 尚未收编的两档（等第一个消费点迁过来时再落成 variant / rounded，先不留空档位）：
//   ringed   = 通知条的 inset 发丝环配方（--edge-ring + --card-shadow）
//   10px 圆角族（--radius-popover）—— .team-agent-card / .res-card 一批
//
// #411 别名优先：消费点的 domain 类名（.account-card / .prj-set-card …）是 e2e
// 定位锚，className 原样透传到根元素，类名不动、只把皮肤与结构收进本文件。

import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';
import type * as React from 'react';

const panelVariants = cva('rounded-[12px]', {
  variants: {
    variant: {
      quiet: 'bg-secondary',
      outlined: 'border border-border bg-card',
    },
  },
  defaultVariants: {
    variant: 'quiet',
  },
});

function Panel({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof panelVariants>) {
  return <div data-slot="panel" className={cn(panelVariants({ variant }), className)} {...props} />;
}

/** 头区：居中一列。高度 / 内边距 / 内圆角是 per-face 的，留在属地 css。 */
function PanelHead({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="panel-head"
      className={cn('flex flex-col items-center', className)}
      {...props}
    />
  );
}

/** 行：两端对齐 + 顶部分隔线（--border-default，全仓面板分隔线的唯一写法）。 */
function PanelRow({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="panel-row"
      className={cn('flex items-center justify-between border-t border-border', className)}
      {...props}
    />
  );
}

/** 行左：13px 次要色。字重 / 行高是 per-face 的，留在属地 css。 */
function PanelLabel({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="panel-label"
      className={cn('text-[13px] text-content-secondary', className)}
      {...props}
    />
  );
}

/** 行右：主色横排。间距与字号是 per-face 的，留在属地 css。 */
function PanelValue({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="panel-value"
      className={cn('flex items-center text-foreground', className)}
      {...props}
    />
  );
}

export { Panel, PanelHead, PanelLabel, PanelRow, PanelValue };
