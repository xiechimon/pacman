// Shared chief wake pair (issue #129): the 总管 FAB + the drawer it opens,
// as one component every non-board surface mounts in place of its former
// inert button — pages/resources/secondary shells and the detail route all
// wake the same live surface the board FAB drives (use-chief-surface).
// The FAB keeps each family's own class (page-fab / res-fab / secondary-fab
// / detail-fab — identical 48×48 @ right/bottom 16 geometry, r7 §3.4) and
// the unread badge the captures carry; the drawer rides the shell's main
// column (position: relative), which reproduces the board's viewport-
// anchored placement exactly (top 42 / right 17 / bottom 16). The gear is
// board-only (its settings view swaps the board content area, r5 101–104),
// so it stays hidden here. #443: the detail family gates the button on
// unread (unreadOnly) — the hook and the drawer stay mounted regardless, so
// the wake hotkey path never depends on the FAB being rendered.

import type { FixtureSet } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { ChiefFab } from '../icons/index.js';
import { ChiefDrawer } from './chief-drawer.js';
import { useChiefSurface } from './use-chief-surface.js';

export function ChiefWake({
  fixture,
  fabClassName,
  unreadOnly = false,
}: {
  fixture: FixtureSet;
  /** This family's FAB class (geometry is shared, the class keeps the
   *  per-shell CSS hooks intact). */
  fabClassName: string;
  /** true = render the FAB only while chiefUnread > 0 (badge pass-through
   *  unchanged); other families default to the constant mount. 出处：#443
   *  有意背离 #129「全站各族恒挂 FAB」裁决，按 ADR 0002 D7 之律记此行。 */
  unreadOnly?: boolean;
}) {
  const { t } = useI18n();
  const { chiefView, setChiefView, chiefData, chiefUnread, onSend, onThread, onNewThread } =
    useChiefSurface(fixture);
  return (
    <>
      {(!unreadOnly || chiefUnread > 0) && (
        <button
          type="button"
          className={fabClassName}
          aria-label={t('总管')}
          onClick={() => setChiefView('drawer')}
        >
          <ChiefFab />
          {chiefUnread > 0 && <span className="fab-badge">{chiefUnread}</span>}
        </button>
      )}
      <ChiefDrawer
        open={chiefView === 'drawer'}
        chief={chiefData}
        onClose={() => setChiefView('none')}
        onSend={onSend}
        onThread={onThread}
        onNewThread={onNewThread}
      />
    </>
  );
}
