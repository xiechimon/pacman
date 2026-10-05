import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';

// 仓内偏离（#414/#425/#423，三处，勿在重拉时丢）：
// 1) focus 环走仓级 #388 canon（2px 实线 --focus-ring——#435 D3 后环色由
//    --card-button 语义分离独立成名，值随品牌走），去 upstream 的
//    outline-none + 灰 ring；
// 2) 过渡显式窄写：TW 的 transition-all / transition-colors 属性表都含
//    outline-color，会把 focus 环吞进过渡初值（#15 探针实测）。
// 3) brand 档（#423 第一片真域接线）：仓内品牌实底 --card-button +
//    --text-on-accent 白字，= 轨 A3 ui/Button primary 档等价迁移位（#426
//    遗留的「brand 档裁决属铺开期」在此落地）。hover brightness(1.07)
//   （base-ui-theme §1.1 P4 #791，不降透明度——disabled 由 pointer-events-none
//    承接，hover 不命中）；disabled 换 --spot-disabled 实底不降透明度——两形
//    均逐 A3 原样，零漂移；官方 neutral default 档不动。
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,filter] duration-150 select-none focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:outline-offset-2 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/80',
        brand:
          'bg-(--card-button) text-(--text-on-accent) hover:brightness-[1.07] disabled:bg-(--spot-disabled) disabled:opacity-100',
        outline:
          'border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
        ghost:
          'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50',
        destructive:
          'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default:
          'h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        icon: 'size-8',
        'icon-xs':
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        'icon-sm':
          'size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg',
        'icon-lg': 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  type = 'button',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  // type 默认 button：防表单内隐式 submit（仓内 ui/button 同律）
  // data-variant / data-size 是 shadcn Button 的既有可观测契约（#411 别名
  // 优先：e2e 材质钉按 data-variant 断言，如 board-filter 顶栏一钮）——适配
  // 层换 Base UI 底座时须原样透出，丢属性 = 对外 API 不等价。
  return (
    <ButtonPrimitive
      type={type}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
