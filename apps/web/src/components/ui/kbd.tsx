// shadcn/ui base-nova registry 件 `kbd`（XMON-14 落点）。取自
// https://ui.shadcn.com/r/styles/base-nova/kbd.json ，无外部依赖（只用 cn）。
//
// 本文件保持 registry 原样，无仓内偏离；#468 快捷键悬浮提示 = TooltipContent
// 内放 Kbd 的官网组合（#983 判决，#1008 落地，旧 kbd-hint.tsx 适配件退役）。

import { cn } from 'cn';
import type * as React from 'react';

function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm bg-muted px-1 font-sans text-xs font-medium text-muted-foreground select-none in-data-[slot=tooltip-content]:bg-background/20 in-data-[slot=tooltip-content]:text-background dark:in-data-[slot=tooltip-content]:bg-background/10 [&_svg:not([class*='size-'])]:size-3",
        className,
      )}
      {...props}
    />
  );
}

function KbdGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn('inline-flex items-center gap-1', className)}
      {...props}
    />
  );
}

export { Kbd, KbdGroup };
