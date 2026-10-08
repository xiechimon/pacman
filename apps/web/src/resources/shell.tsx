// Resource route shell (issue #69): the二级页 topbar of r2 §1.2 — back
// chevron at content-left+12, centered page title (16px), right `+ 新建`
// brand link — over a 768px centered content column (probed from r7 06–10),
// with the sidebar's matching 资源 subrow selected and the 总管 FAB pinned
// like on the detail route — waking the shared chief drawer (#129) over the
// shared AppSidebar (identical geometry on every route).
// #944 per-face 清零：resources.css 退役，壳几何改挂 token utility（原值
// 等值迁移；topbar 44px = h-11、back 钮 28px = size-7 均在 §2 阶梯上）。
// 标题带 pointer-events-none 是 #133 的 pure-label hit-test 律：band 不许
// 吞掉 back / 新建 的点击。
import { cn } from 'cn';
import type { ReactNode } from 'react';
import { AppSidebar } from '../board/app-sidebar.js';
import type { SidebarSelected } from '../board/sidebar.js';
import { ChiefWake } from '../chief/chief-wake.js';
import { Button, buttonVariants } from '../components/ui/button.js';
import type { FixtureSet } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronLeft, Plus } from '../icons/index.js';

/** topbar `+ 新建`（Button link 档）：#1005 registry 对齐——形态走件默认
 *  （text-sm / hover underline / svg 16px），品牌墨保留 --card-button 槽
 *  （#991 Q10：品牌色只经 token 层强调面生效）；右墨缘 21px 是 r7 实测
 *  layout，归消费点。 */
const RES_NEW_CLS = 'ml-auto mr-[21px] text-(--card-button) hover:text-(--card-button)';

/** `+ 新建` 的 SPA 链接形态（newHref 分支）：link 档同配方经 buttonVariants
 *  复用（cn 收口墨色冲突），裸 <a>（链接不在 #851 裸控件账内；focus 环走
 *  #388 全局 :where(a) 律）。 */
const RES_NEW_ANCHOR_CLS = cn(buttonVariants({ variant: 'link' }), RES_NEW_CLS);

/** 总管 FAB（ChiefWake fabClassName 入参）：48px 圆、surface 底、
 *  border-default 描边、fab-shadow——各族 *-fab 同几何（chief-wake 头注），
 *  resources 族的 per-face 正本随 resources.css 退役，配方在此。ghost 件
 *  默认的 hover/aria-expanded 底色就地并掉（原形无 hover 态）。 */
const RES_FAB_CLS =
  'absolute right-4 bottom-4 flex size-12 cursor-pointer items-center justify-center rounded-full border border-(--border) bg-(--card) shadow-(--fab-shadow) hover:bg-(--card) aria-expanded:bg-(--card)';

interface ResourceShellProps {
  /** Centered topbar title (`技能` / `MCP 服务器` / …). */
  title: string;
  /** This route's href (data-route). */
  href: string;
  /** Sidebar selected pill: resource hrefs. Absent = 看板. */
  selected?: SidebarSelected;
  /** Back-chevron target: the board. */
  backHref: string;
  /** Href for the right `+ 新建` action; absent renders a bare button
   *  (dialog-opening actions land in a later ticket). */
  newHref?: string;
  /** Dialog-opening 新建 action (wayfinder #173: the secrets page is first);
   *  renders when `newHref` is absent, so the bare button gains a handler. */
  onNew?: () => void;
  /** Read-only surfaces carry no `+ 新建` action (skills, spec 13 #367：
   *  技能 = 本地目录现扫只读投影，无新建/导入面). */
  hideNew?: boolean;
  fixture: FixtureSet;
  children: ReactNode;
}

export function ResourceShell({
  title,
  href,
  selected,
  backHref,
  newHref,
  onNew,
  hideNew = false,
  fixture,
  children,
}: ResourceShellProps) {
  const { t } = useI18n();
  // data-testid="resource-new" = #910 二级载体：title-band hit-test 律
  // （#133）的探针要在 elementFromPoint 后按 CSS 选择器认领元素，role 定位
  // 表达不了；行为面（点击开弹窗）一律走 getByRole('button', {name:'新建'})。
  const newAction = hideNew ? null : newHref != null ? (
    <a className={RES_NEW_ANCHOR_CLS} href={newHref} data-testid="resource-new">
      <Plus width={13} height={13} />
      {t('新建')}
    </a>
  ) : (
    <Button variant="link" className={RES_NEW_CLS} onClick={onNew} data-testid="resource-new">
      <Plus width={13} height={13} />
      {t('新建')}
    </Button>
  );

  return (
    <div className="flex h-full" data-route={href}>
      <AppSidebar fixture={fixture} selected={selected} />
      {/* #447 (ADR 0004 D2/D6): 主列是 docking row — topbar + 内容列住在
          flex:1 的纵向列里，chief 面板作为最后一个 flex item 骑在同排；
          本容器保持 relative 锚（FAB 与绝对定位子级的 containing block）。
          `res-main`/`res-main-col` 类名 = 跨域句柄残留（spec/22 §5.0 残留
          律）：chief-drawer 的 DOCK_ROWS 走 classList.contains 找 dock 行、
          chief-panel.spec 钉 .res-main-col 的 docking 几何——消费点住 chief
          域（#952 终账面），类名以零规则钩子形态存活（#950 已裁：原
          chief.css 的 Portal 包装层 display:contents 规则收归 chief-drawer
          自己的 Portal className，不再借宿本行选择器），摘除归终账统一裁。 */}
      <div className="res-main relative flex min-w-0 flex-1">
        <div className="res-main-col flex min-w-0 flex-1 flex-col">
          <header
            data-testid="resource-topbar"
            className="relative flex h-11 flex-none items-center border-b border-(--border)"
          >
            <a
              className="absolute top-2 left-3 flex size-7 items-center justify-center text-(--text-tertiary)"
              href={backHref}
              aria-label={t('返回')}
            >
              <ChevronLeft width={16} height={16} />
            </a>
            <h1 className="pointer-events-none absolute inset-x-0 text-center text-base leading-[22px] font-medium text-(--foreground)">
              {t(title)}
            </h1>
            {newAction}
          </header>
          {/* #486/#494：面板体自持滚动——全宽滚动层承接 overflow（滚动条贴
             面板右缘，与 secondary 同形），768px 窄列只在里面居中、不自滚
             （窄列自滚会让滚动条悬在版心右缘并再啃掉 ~15px 版心）。
             overflow-x 保持裁切：窄列内容不该横向溢出。 */}
          <div className="flex-1 overflow-x-hidden overflow-y-auto">
            <div data-testid="resource-col" className="mx-auto w-192 pt-4">
              {children}
            </div>
          </div>
        </div>
        <ChiefWake fixture={fixture} fabClassName={RES_FAB_CLS} />
      </div>
    </div>
  );
}
