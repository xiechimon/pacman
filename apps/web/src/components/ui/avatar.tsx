// shadcn/ui base-nova registry 件 `avatar`（XMON-14 落点）。取自
// https://ui.shadcn.com/r/styles/base-nova/avatar.json ，底座 = Base UI
// (base-ui.com/react/components/avatar.md)，与仓内既有 registry 件同律：
// 文件保持 registry 原样，仓内偏离就地标注（同 button.tsx 的做法）。
//
// 仓内偏离（两处，重拉 registry 时勿丢）：
// 1) Avatar Root 去掉 `after:absolute after:inset-0 after:rounded-full after:border
//    after:border-border after:mix-blend-darken dark:after:mix-blend-lighten`。
//    这一圈 ring 是 registry 的默认皮肤（描边环），本仓 per-face 几何正本不含环，
//    且 seeded-avatar 把 Root 置成 `display:contents` 后该 `::after` 仍会生成一个
//    脱离盒（Chrome 实测：`elementFromPoint` 命中 contents 元素本身，落点覆盖整页，
//    把卡片/菜单上的点击全挡下——avatar-dicebear / user-menu-trigger 两 spec 实测
//    拦截）。去掉后 Root 无任何伪元素盒。
// 2) AvatarImage 的皮肤类去掉 `aspect-square size-full rounded-full`。尺寸与圆角
//    在本仓由 per-face 几何正本承载（各域 css 的 `.foo img{width;height;border-radius}`
//    与 Tailwind `[&_img]:size-N`），registry 的 size-full 会把 `.agent-head` 那类
//    「无 img 规则、靠 preflight max-width 兜底」的面改成满盒，属视觉变更。
//    保留 `object-cover`（两轴都被约束时才是有效声明）。
//
// 消费侧仓内语义（dicebear 种子 + 兜底换图）见 seeded-avatar.tsx。

import { Avatar as AvatarPrimitive } from '@base-ui/react/avatar';
import { cn } from 'cn';
import type * as React from 'react';

function Avatar({
  className,
  size = 'default',
  ...props
}: AvatarPrimitive.Root.Props & {
  size?: 'default' | 'sm' | 'lg';
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        'group/avatar relative flex size-8 shrink-0 rounded-full select-none data-[size=lg]:size-10 data-[size=sm]:size-6',
        className,
      )}
      {...props}
    />
  );
}

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn('object-cover', className)}
      {...props}
    />
  );
}

function AvatarFallback({ className, ...props }: AvatarPrimitive.Fallback.Props) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        'flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs',
        className,
      )}
      {...props}
    />
  );
}

function AvatarBadge({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        'absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground bg-blend-color ring-2 ring-background select-none',
        'group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden',
        'group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2',
        'group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2',
        className,
      )}
      {...props}
    />
  );
}

function AvatarGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        'group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background',
        className,
      )}
      {...props}
    />
  );
}

function AvatarGroupCount({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        'relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3',
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage };
