// Shared chief wake pair (issue #129): the 总管 FAB + the docked panel it
// opens, as one component every non-board surface mounts in place of its
// former inert button — pages/resources/secondary shells and the detail
// route all wake the same live surface the board FAB drives
// (use-chief-surface). The FAB keeps each family's own class (page-fab /
// res-fab / secondary-fab / detail-fab — identical 48×48 @ right/bottom 16
// geometry, r7 §3.4) and the unread badge the captures carry. The gear rides
// every surface (#615：设置可达性是四连报的一半); off-board it navigates to
// the board settings view (`?chief=settings` deep link) since the settings
// content swap only exists on the board route (r5 101–104). #443: the detail family gates the button on
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

import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button.js';
import { KbdHint } from '../components/ui/kbd-hint.js';
import type { FixtureSet } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
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
    // XMON-23 收编：ghost/icon 原语 + per-face 几何类（各族 *-fab：48×48 圆、
    // surface 底、fab-shadow——unlayered per-face 恒压原语层）。中和件：
    // font-normal（badge 10px 字不吃原语 medium）、active 位移、svg size-auto
    // （ChiefFab 字形带 30.8 尺寸属性，不能被原语 size-4 压成 16）。
    <Button
      variant="ghost"
      size="icon"
      className={`${fabClassName} font-normal active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto`}
      aria-label={t('总管')}
      onClick={() => setChiefView('drawer')}
    >
      <ChiefFabIcon chief={chiefData} />
      {/* #468: ⌘J 悬浮提示（四族共用消费点；点击维持 open-only）。 */}
      <KbdHint label="⌘J" />
      {chiefUnread > 0 && <span className="fab-badge">{chiefUnread}</span>}
    </Button>
  );
}

/** The docked panel for one surface — the last flex item of the docking
 *  row. `onSettings` = board 的内容交换（r5 101–104）；缺省不再等于「齿轮
 *  消失」——#615 返工兜底落 board 设置视图深链，齿轮结构上恒在（挂载点漏传
 *  回调不再复死入口）。 */
export function ChiefWakePanel({
  surface,
  onSettings,
}: {
  surface: ChiefSurface;
  onSettings?: () => void;
}) {
  const settingsNavFallback = useChiefSettingsNav();
  const {
    chiefView,
    setChiefView,
    chiefData,
    onSend,
    onThread,
    onNewThread,
    modelValue,
    modelOptions,
    onPickModel,
  } = surface;
  return (
    <ChiefDrawer
      open={chiefView === 'drawer'}
      chief={chiefData}
      onClose={() => setChiefView('none')}
      onSettings={onSettings ?? settingsNavFallback}
      onSend={onSend}
      onThread={onThread}
      onNewThread={onNewThread}
      modelValue={modelValue}
      modelOptions={modelOptions}
      onPickModel={onPickModel}
    />
  );
}

/** #615: gear 各族可达——非 board 面没有设置视图的内容区位（r5 101–104 是
 *  board 的内容交换），落 board 设置视图深链 `?chief=settings`（XMON-106
 *  深链参的同参位扩展）。board 自己仍走内容交换，不经路由。 */
export function useChiefSettingsNav(): () => void {
  const navigate = useNavigate();
  return useCallback(() => navigate('/app?chief=settings'), [navigate]);
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
  const onSettings = useChiefSettingsNav();
  return (
    <>
      <ChiefWakeFab surface={surface} fabClassName={fabClassName} unreadOnly={unreadOnly} />
      <ChiefWakePanel surface={surface} onSettings={onSettings} />
    </>
  );
}
