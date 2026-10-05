// Secondary-route shell (issue #70): sidebar + 44px head with the back
// chevron, a centered title slot and an optional right slot (r2 §1.2
// 二级页 geometry, r7 12/13 probes: back 28×28 at main-left 12, title
// centered on the content area, right slot at right-20 per the r7 12
// 设置 ink), wrapping the
// centered 766px content column shared by the team/account/resources/
// api-keys surfaces (r7 08/12/13: column x457..1223 @1440).
// #947 per-face 清零：secondary.css 退役，壳几何改挂 token utility（原值
// 等值迁移；head 44px = h-11、back 钮 28px = size-7、右槽 20px = right-5
// 均在 §2 阶梯上；766px 版心与 back 钮 6px 圆角是阶梯外一次性实测值，
// §3.1(a) arbitrary 形态）。标题带 pointer-events-none 是 #133 的
// pure-label hit-test 律：band 不许吞掉 back / 右槽动作的点击。
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { AppSidebar } from '../board/app-sidebar.js';
import type { SidebarSelected } from '../board/sidebar.js';
import { ChiefWake } from '../chief/chief-wake.js';
import type { FixtureSet } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronLeft } from '../icons/index.js';

/** 总管 FAB（ChiefWake fabClassName 入参）：48px 圆、surface 底、
 *  border-default 描边、fab-shadow、tertiary 墨——各族 *-fab 同几何
 *  （chief-wake 头注），secondary 族的 per-face 正本随 secondary.css 退役，
 *  配方在此。ghost 件默认的 hover/aria-expanded 底色与墨色就地并掉（原形
 *  无 hover 态；七通道律 #908 comment-6001887439 裁决 3，含 dark: 变体）。 */
const SEC_FAB_CLS =
  'absolute right-4 bottom-4 flex size-12 cursor-pointer items-center justify-center rounded-full border border-(--border-default) bg-(--surface) text-(--text-tertiary) shadow-(--fab-shadow) hover:bg-(--surface) hover:text-(--text-tertiary) dark:hover:bg-(--surface) aria-expanded:bg-(--surface) aria-expanded:text-(--text-tertiary)';

interface SecondaryShellProps {
  /** data-route value, keeps debug selectors per page. */
  route: string;
  fixture: FixtureSet;
  /** Centered head content — plain text or a dropdown trigger (team). */
  title: ReactNode;
  /** Head right slot (team `设置` link); absent on the other pages. */
  right?: ReactNode;
  /** Sidebar pill owner: team/account = team row, the rest none. */
  sidebarSelected?: SidebarSelected;
  children: ReactNode;
}

export function SecondaryShell({
  route,
  fixture,
  title,
  right,
  sidebarSelected = 'none',
  children,
}: SecondaryShellProps) {
  const { t } = useI18n();
  // the back chevron carries the scenario string home like dhead (#58)
  const { search } = useLocation();
  return (
    <div className="flex h-full overflow-hidden" data-route={route}>
      <AppSidebar fixture={fixture} selected={sidebarSelected} />
      {/* #447 (ADR 0004 D2/D6): secondary-main is the docking row — head +
          body live in .secondary-main-col (flex:1, yields) and the chief
          panel rides as the last flex item; the wake FAB keeps the
          secondary-main absolute anchor.
          `secondary-main`/`secondary-main-col` 类名 = 跨域句柄残留（spec/22
          §5.0 残留律，res-main 同款）：chief-drawer 的 DOCK_ROWS 走
          classList.contains 找 dock 行、chief.css 有
          `.secondary-main > [data-base-ui-portal]` 布局规则、chief-panel.spec
          钉 .secondary-main-col 的 docking 几何——三处消费点都住 chief 域
          （#950/#952 面），本票不动共享 JS/CSS，类名以零规则钩子形态存活，
          摘除归 chief 域票统一裁。 */}
      <div className="secondary-main relative flex min-w-0 flex-1 bg-(--surface)">
        <div className="secondary-main-col flex min-w-0 flex-1 flex-col">
          <header className="relative h-11 flex-none border-b border-(--border-default)">
            <Link
              className="absolute left-3 top-2 flex size-7 items-center justify-center rounded-[6px] text-(--text-tertiary)"
              to={{ pathname: '/app', search }}
              aria-label={t('返回')}
            >
              <ChevronLeft width={16} height={16} />
            </Link>
            {/* centers on the content area like the board topbar title — and
                carries the same pure-label law (#133, the #66 board
                precedent): the band spans the whole head, so it must not own
                the hit-test over the back chevron / right slot. The title is
                a ReactNode slot (a future dropdown trigger rides it) —
                interactive children opt back in, the detail.css none+auto
                pattern. */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 text-sm font-medium text-(--text-primary) [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_svg]:text-(--text-dim)">
              {title}
            </div>
            {right != null && (
              <div className="absolute right-5 top-0 flex h-11 items-center">{right}</div>
            )}
          </header>
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-[766px]">{children}</div>
          </div>
        </div>
        {/* 总管 FAB rides every surface (r7 12/13 bottom-right circle) and
            wakes the shared chief drawer (#129) */}
        <ChiefWake fixture={fixture} fabClassName={SEC_FAB_CLS} />
      </div>
    </div>
  );
}
