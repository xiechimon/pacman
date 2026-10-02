'use client';

import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';
import { createContext, useContext } from 'react';

/** 分段档的 chip 盒模型与默认/下划线档不是同一套：前者由 pages.css 的
 *  `.page-tabs-group` / `.page-tab` 定义（topbar「任务|文件」的样式正本），
 *  后者是 Tailwind 基类。两套同时挂在一个元素上会变成层叠争抢，故 variant
 *  由 TabsList 经 context 递给 TabsTrigger，各档只挂自己那一套类名。
 *  bare 档（XMON-23 总管设置 tab 收编）：零 chrome——几何/配色/选中态全部
 *  由消费点的 per-face 类（.chief-tabs/.chief-tab）承载，原语只出语义与
 *  键盘漫游（role=tablist/tab + aria-selected + roving tabindex）。 */
type TabsVariant = 'default' | 'line' | 'segmented' | 'bare';

const TabsVariantContext = createContext<TabsVariant>('default');

function Tabs({ className, orientation = 'horizontal', ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn('group/tabs flex gap-2 data-horizontal:flex-col', className)}
      {...props}
    />
  );
}

const tabsListVariants = cva('group/tabs-list inline-flex items-center justify-center', {
  variants: {
    variant: {
      default:
        'w-fit rounded-lg bg-muted p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col',
      line: 'w-fit gap-1 rounded-none bg-transparent p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col',
      /* 分段控制器：容器类名直接引 pages.css 的正本，不在本文件重述几何。 */
      segmented: 'page-tabs-group',
      /* bare：容器类名也是消费点 per-face（如 .chief-tabs），本档零附加。 */
      bare: '',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

function TabsList({
  className,
  variant = 'default',
  children,
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsVariantContext.Provider value={variant ?? 'default'}>
      <TabsPrimitive.List
        data-slot="tabs-list"
        data-variant={variant}
        className={cn(tabsListVariants({ variant }), className)}
        {...props}
      >
        {children}
      </TabsPrimitive.List>
    </TabsVariantContext.Provider>
  );
}

const tabsTriggerVariants = cva(
  'relative inline-flex items-center justify-center whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
  {
    variants: {
      variant: {
        default:
          'h-[calc(100%-1px)] flex-1 gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground data-active:bg-background data-active:text-foreground data-active:shadow-sm dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5',
        line: 'h-[calc(100%-1px)] flex-1 gap-1.5 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-medium text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground data-active:shadow-none after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 data-active:after:opacity-100',
        /* chip 类名同上：几何/配色/token 全部由 pages.css 承载，选中的
           填充由 `.page-tab[data-active]`（Base UI 的选中属性）接手。
           本档刻意不带 focus-visible:* —— chip 的焦点环走 app.css 的
           全局 :focus-visible 规则，与 topbar 的分段控制器同源。 */
        segmented: 'page-tab',
        /* bare：同 segmented 的零 chrome 律，但连正本类名都不引——chip 的
           类名由消费点经 className 传入（如 chief-tab is-active 条件态）。 */
        bare: '',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  const variant = useContext(TabsVariantContext);
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(tabsTriggerVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn('flex-1 text-sm outline-none', className)}
      {...props}
    />
  );
}

/** 滑动指示条（#644）：Base UI 把激活 tab 的几何写进元素内联的
 *  `--active-tab-left/top/width/height` 自定义属性，切换时由消费点 CSS 的
 *  transition 决定滑动形态（参考站实测：left/top/width/height 150ms ease，
 *  pill 在 tab 下层 z-index:0 位移+变宽）。本原语遵守 bare 律零 chrome——
 *  不带任何类名，几何/配色/动效全由消费点 per-face 承载。 */
function TabsIndicator({ className, ...props }: TabsPrimitive.Indicator.Props) {
  return <TabsPrimitive.Indicator data-slot="tabs-indicator" className={className} {...props} />;
}

export { Tabs, TabsContent, TabsIndicator, TabsList, TabsTrigger, tabsListVariants };
