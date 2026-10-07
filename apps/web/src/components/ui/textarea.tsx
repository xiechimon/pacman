// Textarea（registry base-nova 件，#942 正典表 §5.3 落件）：取数
// ui.shadcn.com/r/styles/base-nova/textarea.json（2026-10-06 逐字）。原唯一
// 记录内偏离 rounded-lg → rounded-none 已按 #982 判决回零（#980 裁决④：
// 几何冲突 registry 默认赢）。几何正典 = registry 默认（rounded-lg +
// field-sizing-content 自增长 + min-h-16）；消费面高度差走显式 override
// utility 并附行为理由（如 charter 的 min-h-[120px]，正典表 §5.3）。

import { cn } from 'cn';
import type * as React from 'react';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
