// Shared chief wake pair (issue #129): the 总管 FAB + the docked panel it
// opens, as one component every non-board surface mounts in place of its
// former inert button — pages/resources/secondary shells and the detail
// route all wake the same live surface the board FAB drives
// (use-chief-surface). The FAB keeps each family's own class (page-fab /
// res-fab / secondary-fab / detail-fab — identical 48×48 @ right/bottom 16
// geometry, r7 §3.4) and the unread badge the captures carry. The gear is
// board-only (its settings view swaps the board content area, r5 101–104),
// so it stays hidden here. #443: the detail family gates the button on
// unread (unreadOnly) — the hook and the panel stay mounted regardless, so
// the wake hotkey path never depends on the FAB being rendered.
//
// #447 (ADR 0004): the panel is a docked right-hand column, not an overlay —
// it must ride the docking flex row of each surface as its last item. For
// the three wake shells that row is the *-main column re-laid as
// [content-col, panel] (pages.css / resources.css / secondary.css), so the
// bundled ChiefWake stays a direct child of *-main. The detail route docks
// the panel into the .detail-body right-pane slot instead (D7), which splits
// the pair: the page lifts the hook itself and mounts ChiefWakeFab + ChiefWakePanel
// at the two slots — both parts consume ONE surface instance so the FAB,
// the ⌘J hotkey and the panel share a single state.

import type { FixtureSet } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { KbdHint } from '../ui/kbd-hint.js';
import { ChiefDrawer } from './chief-drawer.js';
import { ChiefFabIcon } from './chief-fab-icon.js';
import type { ChiefSurface } from './use-chief-surface.js';
import { useChiefSurface } from './use-chief-surface.js';

/** The wake FAB for one family (shared geometry, per-shell class). */
export function ChiefWakeFab({
  surface,
  fabClassName,
  unreadOnly = false,
}: {
  surface: ChiefSurface;
  /** This family's FAB class (geometry is shared, the class keeps the
   *  per-shell CSS hooks intact). */
  fabClassName: string;
  /** true = render the FAB only while chiefUnread > 0 (badge pass-through
   *  unchanged); other families default to the constant mount. 出处：#443
   *  有意背离 #129「全站各族恒挂 FAB」裁决，按 ADR 0002 D7 之律记此行。 */
  unreadOnly?: boolean;
}) {
  const { t } = useI18n();
  const { setChiefView, chiefData, chiefUnread } = surface;
  if (unreadOnly && chiefUnread <= 0) return null;
  return (
    <button
      type="button"
      className={fabClassName}
      aria-label={t('总管')}
      onClick={() => setChiefView('drawer')}
    >
      <ChiefFabIcon chief={chiefData} />
      {/* #468: ⌘J 悬浮提示（四族共用消费点；点击维持 open-only）。 */}
      <KbdHint label="⌘J" />
      {chiefUnread > 0 && <span className="fab-badge">{chiefUnread}</span>}
    </button>
  );
}

/** The docked panel for one surface — the last flex item of the docking
 *  row; `onSettings` stays board-only (r5 101–104 content swap). */
export function ChiefWakePanel({
  surface,
  onSettings,
}: {
  surface: ChiefSurface;
  onSettings?: () => void;
}) {
  const { chiefView, setChiefView, chiefData, onSend, onThread, onNewThread } = surface;
  return (
    <ChiefDrawer
      open={chiefView === 'drawer'}
      chief={chiefData}
      onClose={() => setChiefView('none')}
      onSettings={onSettings}
      onSend={onSend}
      onThread={onThread}
      onNewThread={onNewThread}
    />
  );
}

export function ChiefWake({
  fixture,
  fabClassName,
  unreadOnly = false,
}: {
  fixture: FixtureSet;
  fabClassName: string;
  unreadOnly?: boolean;
}) {
  const surface = useChiefSurface(fixture);
  return (
    <>
      <ChiefWakeFab surface={surface} fabClassName={fabClassName} unreadOnly={unreadOnly} />
      <ChiefWakePanel surface={surface} />
    </>
  );
}
