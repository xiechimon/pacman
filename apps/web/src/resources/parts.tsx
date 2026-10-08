// Shared row parts of the resource surfaces (issue #69): the icon tile
// (20px small / 28px large / 48px empty-state hero, r7 06–10 probes), the
// gray status pill (`未启用`), the row-end chevron and the empty-state
// block (hero tile + heading + description + primary action + optional
// 总管 hint, layout probed from r7 10, copy from r2 §6; the captured
// 查看文档 link is gone — #307 wontfix, local-first 无文档站).
// #423 第一片真域收编（#422 裁决 a）：卡片系落 components/ui Card 底座 +
// 本文件的域内列表行卡组合件（RowCard / GroupCard）；StatusPill 骑 Badge；
// EmptyState 落 Empty 底座 + components/ui Button（default 档）。
// #1005 registry 对齐（#980 裁决②④、ADR 0012）：件皮肤回归 registry 默认
// ——Card 自带 rounded-xl/ring-1/bg-card（CARD_SKIN_CLS 灭皮配方退役），
// Badge/Empty 走默认档与官方 compound（EmptyHeader/Media/Title/Description/
// Content）；消费点只保留 layout（行高/间距/外边距）与 token 层墨色。

import { cn } from 'cn';
import type { ComponentProps, ComponentType, ReactNode, SVGProps } from 'react';
import { Link, useLocation } from 'react-router';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { Empty, EmptyContent, EmptyHeader, EmptyMedia } from '../components/ui/empty.js';
import { useI18n } from '../i18n/provider.js';
import type { TVars } from '../i18n/translate.js';
import { ChevronRight, Lock } from '../icons/index.js';

/* ---- 搜索 + 排序行（#306/#854 家族）----
   正本原住 resources.css（.res-searchrow / .res-search / .res-search-input /
   .res-sort 族），清零后配方以 utility 常量单源在此。#1005 registry 对齐：
   资源域消费点（skills-page 搜索/排序）已迁 registry 件默认形（InputGroup /
   DropdownMenu 官方皮肤）；下列盒形/盘形常量的唯一剩余消费面 =
   routes/agent-detail-page 记忆 tab（detail 车道 #1006 承载迁移，迁完即删）。 */

/** 搜索 + 排序的工具行容器（纯 layout，两域共用）。 */
export const RES_SEARCH_ROW_CLS = 'flex gap-2';

/** 排序钮的定位包裹（弹层锚点；纯 layout）。 */
export const RES_SORT_WRAP_CLS = 'relative flex';

/** 搜索盒（32px 高、card-border 描边、surface 底、13px 图标 + 输入位）。
 *  遗留配方：剩余消费面 = agent-detail 记忆 tab（#1006）。 */
export const RES_SEARCH_BOX_CLS =
  'flex h-8 flex-1 items-center gap-1.5 border border-(--border) bg-(--card) px-2 text-(--text-tertiary)';

/** 盒内真 Input（components/ui 底座）：盒形由 RES_SEARCH_BOX_CLS 承载，
 *  input 本体零装饰；focus 环走 #388 家族律（2px --focus-ring + offset 2，
 *  utility 层就地并掉件默认的 border-ring + 灰 ring）。
 *  遗留配方：剩余消费面 = agent-detail 记忆 tab（#1006）。 */
export const RES_SEARCH_INPUT_CLS =
  'h-full min-w-0 flex-1 rounded-none border-none bg-transparent p-0 text-sm leading-4 text-(--foreground) shadow-none placeholder:text-(--text-tertiary) focus-visible:border-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring) focus-visible:ring-0 dark:bg-transparent';

/** 排序触发钮（Button ghost 底座）：32px 高、88px 宽由消费点补
 *  （记忆 tab 是内容宽）；皮肤等值迁移，件默认档按七通道律就地并掉
 *  （本钮是带框盒形：hover/aria-expanded 回到 surface 皮肤而非透明）。
 *  遗留配方：剩余消费面 = agent-detail 记忆 tab（#1006）。 */
export const RES_SORT_TRIGGER_CLS =
  "h-8 flex-none cursor-pointer justify-start gap-0 rounded-none border border-(--border) bg-(--card) px-[11px] text-[13px] font-normal leading-4 text-(--text-secondary) hover:bg-(--card) hover:text-(--text-secondary) aria-expanded:bg-(--card) aria-expanded:text-(--text-secondary) active:not-aria-[haspopup]:translate-y-0 [&>span]:ml-2 [&>span]:flex-none [&>span]:whitespace-nowrap [&_svg:last-of-type]:ml-1 [&_svg:not([class*='size-'])]:size-auto";

/** 排序盘（DropdownMenuContent）：V2 弹层壳（#790 P3——最小宽 220 / 12px
 *  内边距 / 1px 墨线框 / 直角 / plate-shadow）+ 上指锚边右上的描边 Arrow
 *  （12×6 外三角压 10×5 内三角，clip-path utility 承载）。
 *  遗留配方：剩余消费面 = agent-detail 记忆 tab（#1006）。 */
export const RES_SORT_MENU_CLS =
  "relative flex min-w-[220px] flex-col rounded-none border border-(--border) bg-(--popover) p-3 shadow-(--plate-shadow) ring-0 before:absolute before:top-px before:right-4 before:h-1.5 before:w-3 before:bg-(--border) before:[clip-path:polygon(0_100%,50%_0,100%_100%)] before:content-[''] after:absolute after:top-0.5 after:right-[17px] after:h-[5px] after:w-2.5 after:bg-(--popover) after:[clip-path:polygon(0_100%,50%_0,100%_100%)] after:content-['']";

/** 盘内单选行（DropdownMenuRadioItem）：32px 行、12px 字、选中 --spot-soft
 *  （plan-dropdown 同族）；行是 div[role=menuitemradio]，不在 #388 全局环
 *  名单，键盘 roving focus 的可见环按同配方就地补钉；勾色 --card-button 走
 *  indicator 槽选择器。遗留配方：剩余消费面 = agent-detail 记忆 tab（#1006）。 */
export const RES_SORT_ROW_CLS =
  "h-8 w-full cursor-pointer rounded-none px-1 py-0 text-left text-xs leading-4 text-(--foreground) data-checked:bg-(--spot-soft) focus:bg-transparent focus:data-checked:bg-(--spot-soft) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring) [&_[data-slot=dropdown-menu-radio-item-indicator]]:text-(--card-button) [&_svg:not([class*='size-'])]:size-auto";

/* ---- 行卡与行内文字族 ---- */

/** Icon tile: tinted rounded square carrying the row glyph. 几何 = r7
 *  06–10 实测（20/28/48px，圆角 6/8/12px——阶梯外一次性尺寸，§3.1(a)）。
 *  tone 只有一个值（orange——原 .res-tile--orange 唯一族），皮肤直接内联，
 *  prop 保留是 API 形状不动（消费点仍显式声明色调）。 */
export function Tile({
  Icon,
  size,
}: {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  size: 'sm' | 'lg' | 'hero';
  tone: 'orange';
}) {
  const glyph = size === 'sm' ? 12 : size === 'lg' ? 16 : 26;
  return (
    <span
      className={cn(
        'flex flex-none items-center justify-center rounded-[6px] bg-(--tile-orange-bg) text-(--tile-orange-fg)',
        size === 'sm' && 'size-5',
        size === 'lg' && 'size-7 rounded-[8px]',
        size === 'hero' && 'size-12 rounded-[12px] bg-(--tile-hero-bg)',
      )}
    >
      <Icon width={glyph} height={glyph} />
    </span>
  );
}

/** 域内列表行卡组合件：单行卡（skills / secrets / mcp 行，64/62px）。
 *  皮肤 = Card 件 registry 默认（rounded-xl / ring-1 / bg-card，#1005 裁决④
 *  官方几何赢）；本件只补 layout（行高、行内 gap、横垫）。
 *  onOpen（XMON-114 技能行开编辑弹窗）：整行可点——role=button + 键盘
 *  Enter/Space 同律；focus 环由 app.css 的 #388 全局 :where([role=button])
 *  规则承载，无需就地补钉。
 *  data-testid="resource-row"（+ mcp 档 data-mcp）= #910 二级结构载体：
 *  行卡无 role（静态行），计数/文本断言的锚。 */
export function RowCard({
  mcp = false,
  className,
  onOpen,
  children,
}: {
  /** mcp 行 62px 高变体（r7 09 实测）。 */
  mcp?: boolean;
  className?: string;
  /** 整行点击（打开编辑面）；缺省 = 静态行（secrets/mcp 现状）。 */
  onOpen?: () => void;
  children: ReactNode;
}) {
  return (
    <Card
      data-testid="resource-row"
      {...(mcp ? { 'data-mcp': '' } : {})}
      className={cn(
        'mt-4 h-16 flex-row items-center gap-3 px-4 py-0',
        mcp && 'h-[62px]',
        onOpen !== undefined && 'cursor-pointer',
        className,
      )}
      role={onOpen !== undefined ? 'button' : undefined}
      tabIndex={onOpen !== undefined ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={
        onOpen !== undefined
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
    >
      {children}
    </Card>
  );
}

/** 域内列表行卡组合件：分组卡（machines / providers 模型行容器）；行本体
 *  是卡内结构 div，分隔线走 RowGrow 的 divided 档。皮肤 = Card 件 registry
 *  默认；行满幅贴边，件默认纵向垫/gap 归零（layout）。data-testid =
 *  #910 二级结构载体（分组卡无 role，几何/计数断言的锚）。 */
export function GroupCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <Card data-testid="resource-group" className={cn('gap-0 py-0', className)}>
      {children}
    </Card>
  );
}

/** 分组卡内行（原 .res-grow，60px；divided = 59px + 上分隔线，行高补偿
 *  1px 边框，卡总高不漂）。data-divided = 分隔行的状态载体（#910 裁定 3：
 *  状态断言载体走 data-*，原 --divided 修饰类退役）。 */
export function RowGrow({
  divided = false,
  className,
  children,
  ...rest
}: {
  divided?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<ComponentProps<'div'>, 'className' | 'children'>) {
  return (
    <div
      {...(divided ? { 'data-divided': '' } : {})}
      className={cn(
        'flex items-center gap-3 px-4',
        divided ? 'h-[59px] border-t border-(--border)' : 'h-[60px]',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** 行文字列（与 tile 的间距由行容器的 gap-3 承载；模型行等零间距面由
 *  消费点经 className 调档，tailwind-merge 收口）。 */
export function RowText({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn('flex min-w-0 flex-col', className)}>{children}</span>;
}

/** 行内标题线（标题 + dot/tag 的横排）。 */
export function RowLine({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn('flex items-center gap-2', className)}>{children}</span>;
}

/** 行标题（14/20，primary 墨，不换行）。 */
export function RowTitle({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cn('whitespace-nowrap text-sm leading-5 text-(--foreground)', className)}>
      {children}
    </span>
  );
}

/** 12px dim 副行（machine/mcp/provider 行，r7 ink bands 实测 16px 行盒）；
 *  strong 档 = 技能/密钥卡描述的 13px 次级墨（20px 行盒）。 */
export function RowDesc({
  strong = false,
  className,
  children,
}: {
  strong?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'truncate text-xs leading-4 text-(--text-tertiary)',
        strong && 'text-[13px] leading-5 text-(--text-secondary)',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** 行内 kind 注记（mcp 行类型标签，12px tertiary——原 dim 档实测不过
 *  4.5，#908 裁决 2 授权消费面换槽）。 */
export function RowKind({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cn('text-xs leading-4 text-(--text-tertiary)', className)}>{children}</span>
  );
}

/** 行右缘相对时间（mcp 行，12px dim，margin-left auto 撑到行尾）。 */
export function RowAgo({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cn('ml-auto text-xs leading-4 text-(--text-tertiary)', className)}>
      {children}
    </span>
  );
}

/** Right-side status pill (`未启用`, r7 06/07)。Badge 底座（#422）；
 *  #1005 registry 对齐：皮肤 = Badge secondary 默认档（h-5 圆角 pill /
 *  text-xs / secondary 墨对），只保留 ml-auto 行末 layout。 */
export function StatusPill({ label }: { label: string }) {
  const { t } = useI18n();
  return (
    <Badge variant="secondary" className="ml-auto">
      {t(label)}
    </Badge>
  );
}

/** Row-end `>` chevron (r7 06–10 row right edge). */
export function RowChevron() {
  return (
    <span className="ml-auto flex text-(--text-tertiary)">
      <ChevronRight width={13} height={13} />
    </span>
  );
}

/** 在线状态点（machine 行 r7 06）：在线 --col-dot-done / 离线
 *  --col-dot-idle（与 overlay 的 new-task-machine-dot 同族同值；灰点只表示
 *  状态，不禁用该行——步可钉离线机器等它上线）。data-on 是状态载体
 *  （#910 裁定 3：状态断言载体走 data-*）。 */
export function OnlineDot({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        'size-2 shrink-0 rounded-full',
        on ? 'bg-(--col-dot-done)' : 'bg-(--col-dot-idle)',
      )}
      data-on={on}
    />
  );
}

/** Empty-state block：48px hero tile + 标题 + 两行描述 + 主钮 + 可选总管
 *  hint 行（查看文档 link removed #307 — local-first 无文档站, #149
 *  schedules 同律）。spec 13（#367/#368）：actionLabel 可选——只读资源面
 *  （技能 / MCP）无主钮；description 经 descriptionVars 走 {vars} 插值
 *  （空态指路配置目录 / ~/.claude.json，单点 t()）。
 *  #1005 registry 对齐：走 Empty 官方 compound（EmptyHeader/Media/Content），
 *  居中列 + 默认间隙即 registry 形态（#980 裁决④），r7 10 的左对齐实测形由
 *  原型实审复核。标题/描述保留 h2/p 语义标签（不用 EmptyTitle/Description 的
 *  div——heading 语义是 a11y 资产，skills-page/dead-buttons spec 以
 *  getByRole('heading') 与 locator('p') 钉描述），只把 registry 件的文字档
 *  （text-sm font-medium / text-sm/relaxed muted）挂上去取齐观感。 */
export function EmptyState({
  Icon,
  title,
  description,
  descriptionVars,
  actionLabel,
  actionHref,
  onAction,
  hint,
}: {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
  /** description 模板 {vars} 插值位（i18n translate 机制，issue #74）。 */
  descriptionVars?: TVars;
  /** Primary action 文案；缺省 = 无主钮（只读面，spec 13 #367/#368）。 */
  actionLabel?: string;
  /** SPA target for the primary action (issue #153); absent keeps the
   *  inert button (dialog-opening actions land in a later ticket). */
  actionHref?: string;
  /** Dialog-opening primary action (wayfinder #173): renders when
   *  `actionHref` is absent, giving the bare button its handler. */
  onAction?: () => void;
  hint?: string;
}) {
  const { t } = useI18n();
  const { search } = useLocation();
  return (
    <Empty data-testid="resource-empty" className="mt-4">
      <EmptyHeader>
        <EmptyMedia>
          <Tile Icon={Icon} size="hero" tone="orange" />
        </EmptyMedia>
        <h2 className="text-sm font-medium tracking-tight text-balance text-foreground">
          {t(title)}
        </h2>
        <p className="text-sm/relaxed text-muted-foreground text-balance">
          {t(description, descriptionVars)}
        </p>
      </EmptyHeader>
      {(actionLabel != null || hint != null) && (
        <EmptyContent>
          {actionLabel != null &&
            (actionHref == null ? (
              <Button size="sm" onClick={onAction}>
                {t(actionLabel)}
              </Button>
            ) : (
              <Link to={{ pathname: actionHref, search }}>{t(actionLabel)}</Link>
            ))}
          {/* 「查看文档」钮全除（#307 wontfix）：local-first 自托管无文档站
              可链（#149 schedules 同律）——skills/secrets/mcp 空态随共享件
              一并出账，spec 08 档 4。 */}
          {hint != null && (
            <p className="flex items-center gap-[7px] text-[13px] leading-[18px] text-(--text-tertiary)">
              <Lock width={11} height={11} />
              {t(hint)}
            </p>
          )}
        </EmptyContent>
      )}
    </Empty>
  );
}
