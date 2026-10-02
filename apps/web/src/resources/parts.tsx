// Shared row parts of the resource surfaces (issue #69): the icon tile
// (20px small / 28px large / 48px empty-state hero, r7 06–10 probes), the
// gray status pill (`未启用`), the row-end chevron and the empty-state
// block (hero tile + heading + description + primary action + optional
// 总管 hint, layout probed from r7 10, copy from r2 §6; the captured
// 查看文档 link is gone — #307 wontfix, local-first 无文档站).
// #423 第一片真域收编（#422 裁决 a）：卡片系（res-card / res-rowcard /
// res-tile 系 / res-model-row）落 components/ui Card 底座 + 本文件的域内
// 列表行卡组合件（RowCard / GroupCard）；StatusPill 由轨 A3 Chip 换
// Badge；EmptyState 落 Empty 底座 + components/ui Button（brand 档）。
// 像素零漂移纪律（#411：#435 后逐域迁移纯结构）：几何/配色正本仍是
// resources.css 的 per-face 规则（unlayered 恒压 utility），className 里
// 的 gap-0 / py-0 / ring-0 / flex-row 只负责把 Card 默认档中 CSS 没有
// 对应声明的溢出项并掉（tailwind-merge 冲突组合并，事实档见
// docs/verify/426/README.md）。

import { cn } from 'cn';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { Link, useLocation } from 'react-router';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { Empty } from '../components/ui/empty.js';
import { useI18n } from '../i18n/provider.js';
import type { TVars } from '../i18n/translate.js';
import { ChevronRight, Lock } from '../icons/index.js';

/** Icon tile: tinted rounded square carrying the row glyph. */
export function Tile({
  Icon,
  size,
  tone,
}: {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  size: 'sm' | 'lg' | 'hero';
  tone: 'orange';
}) {
  const glyph = size === 'sm' ? 12 : size === 'lg' ? 16 : 26;
  return (
    <span className={`res-tile res-tile--${size} res-tile--${tone}`}>
      <Icon width={glyph} height={glyph} />
    </span>
  );
}

/** 域内列表行卡组合件（#422 组件层收编）：单行卡（skills / secrets /
 *  mcp 行，64/62px）= Card 底座 + res-rowcard 别名与 per-face 几何。
 *  onOpen（XMON-114 技能行开编辑弹窗）：整行可点——role=button + 键盘
 *  Enter/Space 同律，样式挂 res-rowcard--openable（cursor + focus 环）。 */
export function RowCard({
  mcp = false,
  className,
  onOpen,
  children,
}: {
  /** mcp 行 62px 高变体（res-rowcard--mcp）。 */
  mcp?: boolean;
  className?: string;
  /** 整行点击（打开编辑面）；缺省 = 静态行（secrets/mcp 现状）。 */
  onOpen?: () => void;
  children: ReactNode;
}) {
  return (
    <Card
      className={cn(
        'res-card res-rowcard flex-row gap-0 py-0 ring-0',
        mcp && 'res-rowcard--mcp',
        onOpen !== undefined && 'res-rowcard--openable',
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

/** 域内列表行卡组合件：分组卡（machines / providers 模型行容器）=
 *  Card 底座 + res-group 别名；行本体（res-grow / res-model-row）仍是
 *  卡内结构 div，分隔线走 --divided 修饰类。 */
export function GroupCard({ className, children }: { className?: string; children: ReactNode }) {
  return <Card className={cn('res-card res-group gap-0 py-0 ring-0', className)}>{children}</Card>;
}

/** Right-side status pill (`未启用`, r7 06/07). Badge 收编（#422）：
 *  r7 实测形（20px 高/4px 圆角/text-dim 字/pill-idle-bg 底）作为 per-face
 *  差异规则留在 resources.css 的 .res-pill——06/07 baseline 零像素。 */
export function StatusPill({ label }: { label: string }) {
  const { t } = useI18n();
  return (
    <Badge variant="secondary" className="res-pill">
      {t(label)}
    </Badge>
  );
}

/** Row-end `>` chevron (r7 06–10 row right edge). */
export function RowChevron() {
  return (
    <span className="res-row-chev">
      <ChevronRight width={13} height={13} />
    </span>
  );
}

/** Empty-state block (r7 10 geometry): 48px hero tile, heading, two-line
 *  description, primary button, optional 总管 hint row (查看文档 link
 *  removed #307 — local-first 无文档站, #149 schedules 同律).
 *  spec 13（#367/#368）：actionLabel 可选——只读资源面（技能 / MCP）无主钮；
 *  description 经 descriptionVars 走 {vars} 插值（空态指路配置目录 /
 *  ~/.claude.json，单点 t()）。
 *  #423：底座 = components/ui Empty（左对齐/无框的 r7 10 形态由 .res-empty
 *  per-face 规则承载）；标题/描述保持 h2/p 语义标签（Empty 子件是 div，
 *  换用即降级标题语义，不取）。 */
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
    <Empty className="res-empty">
      <Tile Icon={Icon} size="hero" tone="orange" />
      <h2 className="res-empty-title">{t(title)}</h2>
      <p className="res-empty-desc">{t(description, descriptionVars)}</p>
      {actionLabel != null && (
        <div className="res-empty-actions">
          {actionHref == null ? (
            <Button variant="brand" size="sm" className="res-primary" onClick={onAction}>
              {t(actionLabel)}
            </Button>
          ) : (
            <Link className="res-primary" to={{ pathname: actionHref, search }}>
              {t(actionLabel)}
            </Link>
          )}
          {/* 「查看文档」钮全除（#307 wontfix）：local-first 自托管无文档站
              可链（#149 schedules 同律）——skills/secrets/mcp 空态随共享件
              一并出账，spec 08 档 4。 */}
        </div>
      )}
      {hint != null && (
        <p className="res-empty-hint">
          <Lock width={11} height={11} />
          {t(hint)}
        </p>
      )}
    </Empty>
  );
}
