// Shared row parts of the resource surfaces (issue #69): the icon tile
// (20px small / 28px large / 48px empty-state hero, r7 06–10 probes), the
// gray status pill (`未启用`), the row-end chevron and the empty-state
// block (hero tile + heading + description + primary action + optional
// 总管 hint, layout probed from r7 10, copy from r2 §6; the captured
// 查看文档 link is gone — #307 wontfix, local-first 无文档站).
import type { ComponentType, SVGProps } from 'react';
import { Link, useLocation } from 'react-router';
import { useI18n } from '../i18n/provider.js';
import { ChevronRight, Lock } from '../icons/index.js';

/** Icon tile: tinted rounded square carrying the row glyph. */
export function Tile({
  Icon,
  size,
  tone,
}: {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  size: 'sm' | 'lg' | 'hero';
  tone: 'orange' | 'indigo';
}) {
  const glyph = size === 'sm' ? 12 : size === 'lg' ? 16 : 26;
  return (
    <span className={`res-tile res-tile--${size} res-tile--${tone}`}>
      <Icon width={glyph} height={glyph} />
    </span>
  );
}

/** Right-side status pill (`未启用`, r7 06/07). */
export function StatusPill({ label }: { label: string }) {
  const { t } = useI18n();
  return <span className="res-pill">{t(label)}</span>;
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
 *  removed #307 — local-first 无文档站, #149 schedules 同律). */
export function EmptyState({
  Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  hint,
}: {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
  actionLabel: string;
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
    <div className="res-empty">
      <Tile Icon={Icon} size="hero" tone="orange" />
      <h2 className="res-empty-title">{t(title)}</h2>
      <p className="res-empty-desc">{t(description)}</p>
      <div className="res-empty-actions">
        {actionHref == null ? (
          <button type="button" className="res-primary" onClick={onAction}>
            {t(actionLabel)}
          </button>
        ) : (
          <Link className="res-primary" to={{ pathname: actionHref, search }}>
            {t(actionLabel)}
          </Link>
        )}
        {/* 「查看文档」钮全除（#307 wontfix）：local-first 自托管无文档站
            可链（#149 schedules 同律）——skills/secrets/mcp 空态随共享件
            一并出账，spec 08 档 4。 */}
      </div>
      {hint != null && (
        <p className="res-empty-hint">
          <Lock width={11} height={11} />
          {t(hint)}
        </p>
      )}
    </div>
  );
}
