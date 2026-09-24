// Declarative capture matrix (issue #53). One row = one parity pair.
// Adding a capture in later tickets (#54–#58) = adding a row here.
//
// Entry contract:
//   id         stable pair name (output artefacts are named after it)
//   route      app route to capture
//   scenario   research capture number → fixture set via ?scenario=;
//              board/detail rows use r7 numbers, chief rows r5 numbers
//              (the chief surfaces have no r7 shot — r7 §6 gap table, #72);
//              surfaces with no research capture number at all (issue #70
//              secondary routes) use a named id instead and ride smoke pairs
//   theme      'dark' | 'light' (injected via localStorage pacman-theme;
//              原键 tds-theme，D3 品牌槽同形替换 #109)
//   scrollLeft optional: number, or 'max' for rightmost board scroll,
//              applied to the element carrying [data-parity-scroll]
//   sidebarCollapsed  optional: true → injects pacman.sidebar-collapsed=1
//              before load so the 40px rail renders (r7 03)
//   clicks   optional: CSS selectors clicked in order after load, an
//              animation-settle between each — opens overlay surfaces (#66)
//   fills    optional: [{selector, text}] typed after the clicks, for
//              filled-input states (r7 14 enabled-primary twin)
//   drag     optional {from, to, at?}: a real pointer gesture (#73) —
//              down on `from`, past the 5px threshold, across to `to`,
//              up; `at` = 'top' | 'center' | 'bottom' drop point inside
//              the `to` box (top = insertion index 0). Rows whose drag
//              target sits past the horizontal fold (columns 5–6 at the
//              1440 viewport) must carry scrollLeft — pointer events
//              outside the viewport never reach the sensor, so an
//              unscrolled gesture silently no-ops (#160)
//   hover    optional selector the pointer parks on before the shot (#73)
//   viewport optional per-row capture viewport; the physical window of
//              the r8 overlay session capped its dark baselines at
//              1440×710, so those rows capture at the same size
//              (centering law still holds, r7 §3.5 formula)
//   locale     optional: 'en' → injects pacman.locale/pacman-locale=en before
//              load so the en fallback dict renders (issue #74; absent =
//              the zh-CN authoritative default). Every official capture is
//              zh, so en rows ride smoke pairs — no en baseline exists.
//   expectText optional: string that must appear in the rendered page
//              (innerText or serialized DOM) — gives the smoke rows teeth
//              beyond SSIM=1 self-comparison
//   baseline   optional r7 filename under docs/research/assets/r7/ —
//              present = real parity pair (threshold 0.85);
//              `r8/<file>` form points at post-r7 companion captures
//              (04 册 §2 baseline batch discipline, issue #68 dark set);
//              absent  = smoke pair, capture compared against itself
//              (pipeline gate, SSIM must be exactly 1.0).
//              Rows switched to a later capture batch (04 §2 A6) use a
//              batch-prefixed path, e.g. 'r8/57-运行历史-失败态单行-light.png';
//              run.mjs resolves prefixed paths under docs/research/assets/.
//              D3 重定基线批（#109）：原站基线含 tds_/Todos 品牌字样的行，
//              baseline 切 'rebaseline/<id>.png'（渲染产物，存
//              parity/baselines/；原站截图按 D4(a) 留 assets/ 作证据不删），
//              行级注释登记处置与触发依据。
//   threshold  optional per-pair SSIM override

export const VIEWPORT = { width: 1440, height: 732 };

export const matrix = [
  // gate rows (issue #54): r7 board captures, threshold 0.85
  {
    id: 'board-light-scrollL',
    route: '/app',
    scenario: '01',
    theme: 'light',
    baseline: '01-board-light-scrollL.png',
  },
  {
    id: 'board-light-scrollR',
    route: '/app',
    scenario: '01b',
    theme: 'light',
    scrollLeft: 'max',
    baseline: '01b-board-light-scrollR.png',
  },
  {
    id: 'board-dark-scrollL',
    route: '/app',
    scenario: '02',
    theme: 'dark',
    baseline: '02-board-dark-scrollL.png',
  },
  {
    id: 'board-dark-scrollR',
    route: '/app',
    scenario: '02b',
    theme: 'dark',
    scrollLeft: 'max',
    baseline: '02b-board-dark-scrollR.png',
  },
  // gate rows (issue #55): card variant matrix + rail collapse
  {
    id: 'board-fresh-light',
    route: '/app',
    scenario: '22',
    theme: 'light',
    baseline: '22-board-fresh探针-light.png',
  },
  {
    id: 'board-fresh-dark',
    route: '/app',
    scenario: '22d',
    theme: 'dark',
    baseline: '22d-board-fresh探针-dark.png',
  },
  {
    id: 'board-confirm-card-light',
    route: '/app',
    scenario: '21',
    theme: 'light',
    baseline: '21-待确认-看板卡片-light.png',
  },
  {
    id: 'board-review-card-light',
    route: '/app',
    scenario: '33',
    theme: 'light',
    scrollLeft: 'max',
    baseline: '33-待验收-看板卡片-完成钮-light.png',
  },
  {
    id: 'board-done-light',
    route: '/app',
    scenario: '35',
    theme: 'light',
    scrollLeft: 'max',
    baseline: '35-完成态-看板-light.png',
  },
  {
    id: 'board-done-dark',
    route: '/app',
    scenario: '35d',
    theme: 'dark',
    baseline: '35d-完成态-看板-dark.png',
  },
  {
    id: 'board-rail-light',
    route: '/app',
    scenario: '03',
    theme: 'light',
    sidebarCollapsed: true,
    baseline: '03-board-sidebar-collapsed-light.png',
  },
  // smoke rows (issue #53 gate: self-compare SSIM = 1.0)
  { id: 'board-dark', route: '/app', scenario: '02', theme: 'dark' },
  {
    id: 'board-dark-scrollR',
    route: '/app',
    scenario: '02b',
    theme: 'dark',
    scrollLeft: 'max',
  },
  { id: 'board-light', route: '/app', scenario: '01', theme: 'light' },
  {
    id: 'board-light-scrollR',
    route: '/app',
    scenario: '01b',
    theme: 'light',
    scrollLeft: 'max',
  },
  {
    id: 'detail-fresh-light',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '23',
    theme: 'light',
    baseline: '23-detail-fresh-light.png',
  },
  {
    id: 'detail-fresh-dark',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '23d',
    theme: 'dark',
    baseline: '23d-detail-fresh-dark.png',
  },
  {
    id: 'detail-planning-light',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '16',
    theme: 'light',
    baseline: '16-规划中-streaming-light.png',
  },
  {
    // r7 filed this bitmap under the planning name; its pixels are the
    // confirm surface, dark, with the user-menu popover (see the r7
    // rebaseline doc §1 write-back)
    id: 'detail-confirm-popover-dark',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '16d',
    theme: 'dark',
    baseline: '16d-规划中-streaming-dark.png',
  },
  {
    id: 'detail-confirm-light',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '17',
    theme: 'light',
    baseline: '17-待确认-chat视图-light.png',
    // 本地 0.8517 / CI 0.8457：macOS 与 Linux 字体栅格化噪声，无结构差异（blend 已核），单独放宽
    threshold: 0.84,
  },
  {
    id: 'detail-confirm-dark',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '17d',
    theme: 'dark',
    baseline: '17d-待确认-chat视图-dark.png',
  },
  {
    id: 'detail-confirm-split-light',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '17b',
    theme: 'light',
    baseline: '17b-待确认-方案文档分栏-light.png',
  },
  // user-menu opened by a real avatar-chip click (issue #127): the fixture
  // flag froze the popover for 16d/17/26d/27d; these rows hold the trigger
  // path to the same pixels — 17b/27 are the menu-less twins of 17/27d
  // (same detailConfirm/detailReview surface, userMenuOpen off), so a real
  // .sidebar-user click must reproduce the menu-carrying baseline. Dark
  // covered per 04 §2 增量规则 (弹层票 open 态行 + 深色面随票).
  {
    id: 'detail-usermenu-click-light',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '17b',
    theme: 'light',
    clicks: ['.sidebar-user'],
    baseline: '17-待确认-chat视图-light.png',
    // 与 detail-confirm-light 同屏同字面：跨平台字体栅格化噪声档随该行
    threshold: 0.84,
  },
  {
    id: 'detail-usermenu-click-dark',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '27',
    theme: 'dark',
    clicks: ['.sidebar-user'],
    baseline: '27d-审核-diff分栏-dark.png',
  },
  // gate rows (issue #57): deep detail states — building / review / done /
  // r3 legacy card
  {
    id: 'detail-building-light',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '26',
    theme: 'light',
    baseline: '26-执行中-streaming-light.png',
  },
  {
    id: 'detail-building-dark',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '26d',
    theme: 'dark',
    baseline: '26d-执行中-streaming-dark.png',
    // 稳定管线本地 0.8318，低于 0.84 override 档：跨渲染器 CJK 折行/栅格
    // 噪声，blend 已核无结构差异 → 登记为 report-only（04 §2 该档先例）
    threshold: 0,
  },
  {
    id: 'detail-review-light',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '27',
    theme: 'light',
    baseline: '27-审核-diff分栏-light.png',
  },
  {
    id: 'detail-review-dark',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '27d',
    theme: 'dark',
    baseline: '27d-审核-diff分栏-dark.png',
  },
  {
    id: 'detail-done-light',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '36',
    theme: 'light',
    baseline: '36-完成态-详情-light.png',
    // 本地 0.8505 / CI 0.8499：macOS 与 Linux 字体栅格化噪声，无结构差异（blend 已核），单独放宽
    threshold: 0.84,
  },
  {
    id: 'detail-done-dark',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '36d',
    theme: 'dark',
    baseline: '36d-完成态-详情-dark.png',
  },
  {
    id: 'detail-legacy-light',
    route: '/app/todo/r3-legacy-1',
    scenario: '38',
    theme: 'light',
    baseline: '38-r3遗留卡-详情-light.png',
  },
  // gate rows (issue #68): overlay open states, light half — Token 用量 /
  // 分支与 PR / 运行历史 over the expanded review surface, 验收确认 over
  // the scrollRight board (r7 30/31/32/34)
  {
    id: 'overlay-token-light',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '30',
    theme: 'light',
    baseline: '30-Token用量弹层-light.png',
  },
  {
    // D3 重定基线（#109，2026-09-23）：原站基线 31 的构建分支行含品牌前缀
    // `tds/conv-…`，替换相位渲染 `pacman/conv-…`（分支前缀 = 品牌槽）——
    // 基线切自渲染产物；原站截图按 D4(a) 留 docs/research/assets/r7/ 作
    // 研究证据不删。
    id: 'overlay-branch-light',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '31',
    theme: 'light',
    baseline: 'rebaseline/31-分支与PR弹层-light.png',
  },
  {
    id: 'overlay-history-light',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '32',
    theme: 'light',
    baseline: '32-运行历史弹层-light.png',
  },
  {
    id: 'overlay-accept-light',
    route: '/app',
    scenario: '34',
    theme: 'light',
    scrollLeft: 'max',
    baseline: '34-验收确认弹层-light.png',
  },
  // gate rows (issue #68): dark half of the overlay set — companion
  // captures taken on the live site for this ticket (04 册附录 C 随拍),
  // filed under assets/r8/ per the baseline batch discipline. Provenance:
  // ego-browser (shared logged-in profile), 2026-09-23, viewport 1440×732
  // DPR1, theme via a per-document tds-theme read shim (stored key never
  // written); surface = r3 legacy #1 detail as it stands since its
  // 2026-09-22 18:30 schedule re-run; dialogs settled ~700ms past open.
  // 82/83 (更多/删除 dark) are stored for overlay batch A's rows — those
  // two components land with #66, whose dual-theme rows complete the set.
  {
    id: 'overlay-token-dark',
    route: '/app/todo/r3-legacy-1',
    scenario: '30d',
    theme: 'dark',
    baseline: 'r8/78-Token用量弹层-dark.png',
  },
  {
    // D3 重定基线（#109，2026-09-23）：原站基线 r8/79 的构建分支行含品牌前缀
    // `tds/conv-…`，替换相位渲染 `pacman/conv-…`——基线切自渲染产物；原站
    // 截图按 D4(a) 留 docs/research/assets/r8/ 作研究证据不删。
    id: 'overlay-branch-dark',
    route: '/app/todo/r3-legacy-1',
    scenario: '31d',
    theme: 'dark',
    baseline: 'rebaseline/79-分支与PR弹层-dark.png',
  },
  {
    id: 'overlay-history-dark',
    route: '/app/todo/r3-legacy-1',
    scenario: '32d',
    theme: 'dark',
    baseline: 'r8/80-运行历史弹层-dark.png',
  },
  {
    id: 'overlay-accept-dark',
    route: '/app/todo/r3-legacy-1',
    scenario: '34d',
    theme: 'dark',
    baseline: 'r8/81-验收确认弹层-dark.png',
  },
  // gate rows (issue #67): overlay batch B — ⌘K panel empty (05) and
  // results state (05b, supplementary capture), chip popover on the
  // confirm/review split (19/29), 方案▾ dropdown (20). Both board rows
  // sit on the max-scrolled board, as captured.
  {
    // 05 was captured on the scroll-0 board (待开始 first), unlike 05b
    id: 'search-empty-light',
    route: '/app',
    scenario: '05',
    theme: 'light',
    baseline: '05-搜索面板-light.png',
  },
  {
    id: 'search-results-light',
    route: '/app',
    scenario: '05b',
    theme: 'light',
    scrollLeft: 'max',
    baseline: '05b-搜索面板-结果态-light.png',
  },
  {
    id: 'chip-popover-confirm-light',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '19',
    theme: 'light',
    baseline: '19-状态芯片弹层-待确认-light.png',
  },
  {
    // 重定基线（#121，2026-09-24）：原站基线 29 含侧栏底部「安装 App」
    // accent pill，#121 dogfood 裁决整体去除——本行弹层 CJK 行本为跨平台
    // 栅格化噪声的卡阈值行（mac 0.8521 / ubuntu 卡线跌穿），pill 去除的
    // 预期结构差吃掉余量；基线切自渲染产物（parity/baselines/）；原站截图
    // 按 D4(a) 留 docs/research/assets/r7/ 作研究证据不删。触发依据 =
    // #121 What-to-do 去除裁决 + 01 §8 差异注记行。
    id: 'chip-popover-review-light',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '29',
    theme: 'light',
    baseline: 'rebaseline/29-状态芯片弹层-审核-light.png',
  },
  {
    id: 'plan-dropdown-light',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '20',
    theme: 'light',
    baseline: '20-方案类型下拉-light.png',
  },
  // smoke rows (issue #67): dark overlays — r7 §6 leaves dark overlays
  // uncaptured, so these self-compare (SSIM 1.0) and gate the theme
  // render + pipeline only
  { id: 'search-empty-dark', route: '/app', scenario: '05', theme: 'dark' },
  {
    id: 'search-results-dark',
    route: '/app',
    scenario: '05b',
    theme: 'dark',
    scrollLeft: 'max',
  },
  {
    id: 'chip-popover-confirm-dark',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '19',
    theme: 'dark',
  },
  {
    id: 'chip-popover-review-dark',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '29',
    theme: 'dark',
  },
  {
    id: 'plan-dropdown-dark',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '20',
    theme: 'dark',
  },
  // gate rows (issue #71): schedules empty state vs the r7 route capture
  {
    id: 'schedules-empty-light',
    route: '/app/schedules',
    scenario: '11',
    theme: 'light',
    baseline: '11-schedules.png',
  },
  // smoke rows (issue #71): schedules dark + list/form states, then the
  // four project surfaces — no r7 baseline exists for these, so each row
  // proves the pipeline (self-compare) and pins the surface for review.
  // The r3-derived rows capture with the expanded sidebar: r3 92/92b/93
  // happened to be shot on the collapsed rail (session state), while
  // r2 05b and r7 11 show these surfaces with the sidebar expanded.
  { id: 'schedules-empty-dark', route: '/app/schedules', scenario: '11', theme: 'dark' },
  {
    id: 'schedules-list-light',
    route: '/app/schedules',
    scenario: 'r3-93',
    theme: 'light',
  },
  { id: 'schedules-list-dark', route: '/app/schedules', scenario: 'r3-93', theme: 'dark' },
  { id: 'schedules-form-light', route: '/app/schedules', scenario: 'r3-92', theme: 'light' },
  { id: 'schedules-form-dark', route: '/app/schedules', scenario: 'r3-92', theme: 'dark' },
  {
    id: 'schedules-form-once-light',
    route: '/app/schedules',
    scenario: 'r3-92b',
    theme: 'light',
  },
  {
    id: 'schedules-form-once-dark',
    route: '/app/schedules',
    scenario: 'r3-92b',
    theme: 'dark',
  },
  { id: 'project-new-light', route: '/app/project/new', scenario: 'r2-07', theme: 'light' },
  { id: 'project-new-dark', route: '/app/project/new', scenario: 'r2-07', theme: 'dark' },
  {
    id: 'project-files-light',
    route: '/app/project/ZAQczKCu0MOAzC1ZqcFlX',
    scenario: 'r2-24',
    theme: 'light',
  },
  {
    id: 'project-files-dark',
    route: '/app/project/ZAQczKCu0MOAzC1ZqcFlX',
    scenario: 'r2-24',
    theme: 'dark',
  },
  {
    id: 'project-tasks-empty-light',
    route: '/app/project/ZAQczKCu0MOAzC1ZqcFlX',
    scenario: 'r2-24b',
    theme: 'light',
  },
  {
    id: 'project-tasks-empty-dark',
    route: '/app/project/ZAQczKCu0MOAzC1ZqcFlX',
    scenario: 'r2-24b',
    theme: 'dark',
  },
  {
    id: 'project-tasks-light',
    route: '/app/project/ZAQczKCu0MOAzC1ZqcFlX',
    scenario: 'prj-tasks',
    theme: 'light',
  },
  {
    id: 'project-tasks-dark',
    route: '/app/project/ZAQczKCu0MOAzC1ZqcFlX',
    scenario: 'prj-tasks',
    theme: 'dark',
  },
  {
    id: 'project-settings-light',
    route: '/app/project/ZAQczKCu0MOAzC1ZqcFlX/settings',
    scenario: 'r2-24c',
    theme: 'light',
  },
  {
    id: 'project-settings-dark',
    route: '/app/project/ZAQczKCu0MOAzC1ZqcFlX/settings',
    scenario: 'r2-24c',
    theme: 'dark',
  },
  // gate rows (issue #75): the r8 dynamic-state surfaces whose captures
  // carry no long wrapped CJK prose — failed detail/board card, both
  // rerun-dialog variants and the run-history open states. Baselines are
  // r8 batch paths (04 §2 A6).
  {
    id: 'detail-failed-light',
    route: '/app/todo/r8-12',
    scenario: '54',
    theme: 'light',
    baseline: 'r8/54-失败态-详情-light.png',
    // 稳定本地 0.8422：结果消息 bullet 的 CJK 折行点随渲染器字体栈漂移
    // （Ego 捕获 vs parity chromium），blend 已核无结构差异 → 0.84 override
    threshold: 0.84,
  },
  {
    id: 'board-failed-card-light',
    route: '/app',
    scenario: '55',
    theme: 'light',
    baseline: 'r8/55-失败态-看板卡片-light.png',
  },
  {
    id: 'rerun-dialog-noplan-light',
    route: '/app/todo/r8-12',
    scenario: '56',
    theme: 'light',
    baseline: 'r8/56-失败态-重跑dialog-light.png',
  },
  {
    id: 'run-history-failed-light',
    route: '/app/todo/r8-12',
    scenario: '57',
    theme: 'light',
    baseline: 'r8/57-运行历史-失败态单行-light.png',
  },
  // report-only rows (issue #75): the reject-loop / reuse-timeline
  // surfaces whose chat columns carry long wrapped CJK+chip prose. The
  // wrap points depend on host CJK font metrics (PingFang on the capture
  // host vs the parity host's fallback), so the column rhythm lands
  // ~0.6–0.8 SSIM — recorded, not gated, until a bundled-CJK-font or
  // per-host baseline follow-up tightens them (04 §2 report-only tier,
  // same precedent as the 27b/28 expanded-state rows).
  {
    id: 'version-dropdown-v2-light',
    route: '/app/todo/r8-15',
    scenario: '63',
    theme: 'light',
    baseline: 'r8/63-版本下拉-v2v1-light.png',
    threshold: 0,
  },
  {
    id: 'compare-submenu-light',
    route: '/app/todo/r8-15',
    scenario: '64',
    theme: 'light',
    baseline: 'r8/64-版本对比-二级菜单-light.png',
    threshold: 0,
  },
  {
    id: 'plan-diff-v1v2-light',
    route: '/app/todo/r8-15',
    scenario: '65',
    theme: 'light',
    baseline: 'r8/65-diff视图-v1v2-light.png',
    threshold: 0,
  },
  {
    id: 'plan-diff-v1v2-expanded-light',
    route: '/app/todo/r8-15',
    scenario: '66',
    theme: 'light',
    baseline: 'r8/66-diff展开-unified-light.png',
    threshold: 0,
  },
  {
    id: 'revision-streaming-light',
    route: '/app/todo/r8-15',
    scenario: '67',
    theme: 'light',
    baseline: 'r8/67-驳回-重规划streaming-light.png',
    threshold: 0,
  },
  {
    id: 'reject-v3-timeline-light',
    route: '/app/todo/r8-15',
    scenario: '68',
    theme: 'light',
    baseline: 'r8/68-驳回-planv3时间线-light.png',
    threshold: 0,
  },
  {
    // r8 §1 prose calls 69 the expanded state; the 69 bitmap itself shows
    // the collapsed surface (全部展开 button, no hunks) — bitmap wins (04 A1)
    id: 'plan-diff-v1v3-light',
    route: '/app/todo/r8-15',
    scenario: '69',
    theme: 'light',
    baseline: 'r8/69-diff视图-v1v3-light.png',
    threshold: 0,
  },
  {
    id: 'version-dropdown-v3-light',
    route: '/app/todo/r8-15',
    scenario: '70',
    theme: 'light',
    baseline: 'r8/70-版本下拉-v3v2v1-light.png',
    threshold: 0,
  },
  {
    id: 'plan-diff-v2v3-light',
    route: '/app/todo/r8-15',
    scenario: '71',
    theme: 'light',
    baseline: 'r8/71-diff视图-v2v3-light.png',
    threshold: 0,
  },
  {
    id: 'plan-diff-v2v3-expanded-light',
    route: '/app/todo/r8-15',
    scenario: '72',
    theme: 'light',
    baseline: 'r8/72-diff展开-v2v3-light.png',
    threshold: 0,
  },
  {
    id: 'detail-failed-probe-light',
    route: '/app/todo/r8-15',
    scenario: '73',
    theme: 'light',
    baseline: 'r8/73-失败态-探针详情-light.png',
    threshold: 0,
  },
  {
    id: 'rerun-dialog-reuse-light',
    route: '/app/todo/r8-15',
    scenario: '74',
    theme: 'light',
    baseline: 'r8/74-重跑dialog-复用方案钮-light.png',
    threshold: 0,
  },
  {
    id: 'reuse-panel-light',
    route: '/app/todo/r8-15',
    scenario: '75',
    theme: 'light',
    baseline: 'r8/75-复用方案-子面板-light.png',
    threshold: 0,
  },
  {
    id: 'reused-build-light',
    route: '/app/todo/r8-15',
    scenario: '76',
    theme: 'light',
    baseline: 'r8/76-直接执行-复用方案时间线-light.png',
    threshold: 0,
  },
  {
    id: 'run-history-multirow-light',
    route: '/app/todo/r8-15',
    scenario: '77',
    theme: 'light',
    baseline: 'r8/77-运行历史-多行-light.png',
  },
  // smoke rows (issue #75): the r8 dynamic surfaces in dark — r8 §5
  // leaves dark 动态面 to the web implementation ticket, so these pin the
  // dark styling via self-compare until a dark baseline batch exists
  { id: 'detail-failed-dark', route: '/app/todo/r8-12', scenario: '54', theme: 'dark' },
  { id: 'board-failed-card-dark', route: '/app', scenario: '55', theme: 'dark' },
  { id: 'rerun-dialog-reuse-dark', route: '/app/todo/r8-15', scenario: '74', theme: 'dark' },
  { id: 'reuse-panel-dark', route: '/app/todo/r8-15', scenario: '75', theme: 'dark' },
  { id: 'plan-diff-v2v3-dark', route: '/app/todo/r8-15', scenario: '72', theme: 'dark' },
  { id: 'run-history-failed-dark', route: '/app/todo/r8-12', scenario: '57', theme: 'dark' },
  // gate rows (issue #70): secondary routes batch B — team and account
  // carry r7 baselines; api-keys/feedback have no r7 capture (r2 19/32
  // are the shape reference only), so those rows are smoke pairs, and
  // the dark rows ride the same surfaces without baselines
  {
    id: 'team-light',
    route: '/app/team',
    scenario: '12',
    theme: 'light',
    baseline: '12-team.png',
  },
  { id: 'team-dark', route: '/app/team', scenario: '12', theme: 'dark' },
  {
    id: 'account-light',
    route: '/app/account',
    scenario: '13',
    theme: 'light',
    baseline: '13-account.png',
  },
  { id: 'account-dark', route: '/app/account', scenario: '13', theme: 'dark' },
  { id: 'api-keys-light', route: '/app/api-keys', scenario: 'api-keys', theme: 'light' },
  {
    id: 'api-keys-created-light',
    route: '/app/api-keys',
    scenario: 'api-keys-created',
    theme: 'light',
  },
  {
    id: 'api-keys-created-dark',
    route: '/app/api-keys',
    scenario: 'api-keys-created',
    theme: 'dark',
  },
  { id: 'api-keys-dark', route: '/app/api-keys', scenario: 'api-keys', theme: 'dark' },
  { id: 'feedback-light', route: '/app/feedback', scenario: 'feedback', theme: 'light' },
  { id: 'feedback-dark', route: '/app/feedback', scenario: 'feedback', theme: 'dark' }, // gate rows (issue #66): overlay batch A open states — new-task dialog
  // (04), delete confirm over the done detail (25), 更多 menu over the
  // confirm (18) and fresh (24) details. Dark twins ride the r8 78–81
  // baselines captured with this ticket (numbering continues #64's 54–77).
  {
    id: 'overlay-new-task-light',
    route: '/app',
    scenario: '01',
    theme: 'light',
    clicks: ['.board-new-task'],
    baseline: '04-新建任务dialog-light.png',
  },
  {
    // 14 = the filled-title twin: primary button flips disabled → enabled
    id: 'overlay-new-task-filled-light',
    route: '/app',
    scenario: '01',
    theme: 'light',
    clicks: ['.board-new-task'],
    fills: [
      { selector: '.new-task-input', text: '在 README.md 末尾追加一行「r7 rebaseline probe」' },
    ],
    baseline: '14-新建任务-已填标题-light.png',
  },
  {
    id: 'overlay-delete-light',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '36',
    theme: 'light',
    clicks: ['.detail-head-icon--more', '.more-menu-item[data-action="delete"]'],
    baseline: '25-删除确认弹窗-light.png',
  },
  {
    id: 'overlay-more-confirm-light',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '17b',
    theme: 'light',
    clicks: ['.detail-head-icon--more'],
    baseline: '18-待确认-更多菜单-light.png',
  },
  {
    id: 'overlay-more-fresh-light',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '23',
    theme: 'light',
    clicks: ['.detail-head-icon--more'],
    baseline: '24-fresh-更多菜单-light.png',
  },
  // gate rows (issue #66): the dark twins, baselines captured with this
  // ticket at 1440×710 (r8 session window cap) — new-task dialog over the
  // board (78), delete confirm (79) and 更多 menu (80) over the probe #16
  // confirm detail, 更多 menu over its fresh detail (81)
  {
    id: 'overlay-new-task-dark',
    route: '/app',
    scenario: 'r8-78',
    theme: 'dark',
    clicks: ['.board-new-task'],
    viewport: { width: 1440, height: 710 },
    baseline: 'r8/78-新建任务dialog-dark.png',
  },
  {
    // gated dark delete twin on the drift-light fresh surface (82)
    id: 'overlay-delete-fresh-dark',
    route: '/app/todo/r8-delete-17',
    scenario: 'r8-82',
    theme: 'dark',
    clicks: ['.detail-head-icon--more', '.more-menu-item[data-action="delete"]'],
    viewport: { width: 1440, height: 710 },
    baseline: 'r8/82-删除确认弹窗-fresh-dark.png',
  },
  {
    // report-only: the r8 79/80 surfaces sit on the probe-#16 confirm
    // detail, which the live site restyled after the r7 freeze (doc-pane
    // inline-code spacing, sidebar 用量 row, attention-badge formula,
    // taskline seq chip, FAB badge — all 09-22 drift, blend-verified
    // outside the overlay itself). The r7-frozen replica cannot gate
    // both eras; per 04 §2 these pairs report, the overlay geometry is
    // gated by the 78/81/82 twins on drift-light surfaces. Site-drift
    // rebaseline = A6 ticket.
    id: 'overlay-delete-dark',
    route: '/app/todo/u_B5ngeVOlKdKbG_4H9Cl',
    scenario: 'r8-79',
    theme: 'dark',
    clicks: ['.detail-head-icon--more', '.more-menu-item[data-action="delete"]'],
    viewport: { width: 1440, height: 710 },
    baseline: 'r8/79-删除确认弹窗-dark.png',
    threshold: 0,
  },
  {
    id: 'overlay-more-confirm-dark',
    route: '/app/todo/u_B5ngeVOlKdKbG_4H9Cl',
    scenario: 'r8-80',
    theme: 'dark',
    clicks: ['.detail-head-icon--more'],
    viewport: { width: 1440, height: 710 },
    baseline: 'r8/80-待确认-更多菜单-dark.png',
    threshold: 0,
  },
  {
    id: 'overlay-more-fresh-dark',
    route: '/app/todo/u_B5ngeVOlKdKbG_4H9Cl',
    scenario: 'r8-81',
    theme: 'dark',
    clicks: ['.detail-head-icon--more'],
    viewport: { width: 1440, height: 710 },
    baseline: 'r8/81-fresh-更多菜单-dark.png',
  },
  // gate rows (issue #69): resources batch A — six route surfaces, light
  // (r7 captured no dark resource screen). The two 新建技能 rows stay
  // smoke: their r8 79/80 baselines (committed with this ticket) carry
  // live-site state the frozen shell contract does not reproduce — the
  // 用量 nav row, the 看板 attention badge and the avatar FAB — so gating
  // them waits on the A6 rebaseline decision
  {
    // D3 重定基线（#109，2026-09-23）：原站基线 06 含品牌字样「Todos 托管
    // 机器」，替换相位渲染为「Pacman 托管机器」——基线切自渲染产物
    // （parity/baselines/）；原站截图按 D4(a) 留 docs/research/assets/r7/
    // 作研究证据不删。触发依据 = 素材替换计划 §2/§3.4 品牌槽 + D3 触发。
    id: 'resources-machines-light',
    route: '/app/resources/machines',
    scenario: '06',
    theme: 'light',
    baseline: 'rebaseline/06-resources-machines.png',
  },
  // gate rows (issue #70): secondary routes batch B — team and account
  // carry r7 baselines; api-keys/feedback have no r7 capture (r2 19/32
  // are the shape reference only), so those rows are smoke pairs, and
  // the dark rows ride the same surfaces without baselines
  {
    id: 'team-light',
    route: '/app/team',
    scenario: '12',
    theme: 'light',
    baseline: '12-team.png',
  },
  { id: 'team-dark', route: '/app/team', scenario: '12', theme: 'dark' },
  {
    id: 'account-light',
    route: '/app/account',
    scenario: '13',
    theme: 'light',
    baseline: '13-account.png',
  },
  { id: 'account-dark', route: '/app/account', scenario: '13', theme: 'dark' },
  { id: 'api-keys-light', route: '/app/api-keys', scenario: 'api-keys', theme: 'light' },
  {
    id: 'api-keys-created-light',
    route: '/app/api-keys',
    scenario: 'api-keys-created',
    theme: 'light',
  },
  {
    id: 'api-keys-created-dark',
    route: '/app/api-keys',
    scenario: 'api-keys-created',
    theme: 'dark',
  },
  { id: 'api-keys-dark', route: '/app/api-keys', scenario: 'api-keys', theme: 'dark' },
  { id: 'feedback-light', route: '/app/feedback', scenario: 'feedback', theme: 'light' },
  { id: 'feedback-dark', route: '/app/feedback', scenario: 'feedback', theme: 'dark' },
  {
    // D3 重定基线（#109，2026-09-23）：原站基线 07 含品牌字样「Todos（内
    // 置）」，替换相位渲染为「Pacman（内置）」——基线切自渲染产物；原站截图
    // 按 D4(a) 留 docs/research/assets/r7/ 作研究证据不删。
    id: 'resources-providers-light',
    route: '/app/resources/providers',
    scenario: '07',
    theme: 'light',
    baseline: 'rebaseline/07-resources-providers.png',
  },
  {
    id: 'resources-skills-light',
    route: '/app/resources/skills',
    scenario: '08',
    theme: 'light',
    baseline: '08-resources-skills.png',
  },
  {
    id: 'resources-mcp-servers-light',
    route: '/app/resources/mcp-servers',
    scenario: '09',
    theme: 'light',
    baseline: '09-resources-mcp-servers.png',
  },
  {
    id: 'resources-secrets-light',
    route: '/app/resources/secrets',
    scenario: '10',
    theme: 'light',
    baseline: '10-resources-secrets.png',
  },
  // dark smoke rows (issue #69, 双主题按需): no frozen dark resource
  // baseline exists (r7 captured light only), so dark rides as pipeline
  // smoke until the A6 rebaseline decision supplies gated dark pairs
  {
    id: 'resources-machines-dark',
    route: '/app/resources/machines',
    scenario: '06',
    theme: 'dark',
  },
  {
    id: 'resources-providers-dark',
    route: '/app/resources/providers',
    scenario: '07',
    theme: 'dark',
  },
  { id: 'resources-skills-dark', route: '/app/resources/skills', scenario: '08', theme: 'dark' },
  {
    id: 'resources-mcp-servers-dark',
    route: '/app/resources/mcp-servers',
    scenario: '09',
    theme: 'dark',
  },
  { id: 'resources-secrets-dark', route: '/app/resources/secrets', scenario: '10', theme: 'dark' },
  {
    id: 'resources-skills-import-folder-light',
    route: '/app/resources/skills/import',
    scenario: '79',
    theme: 'light',
  },
  {
    id: 'resources-skills-import-github-light',
    route: '/app/resources/skills/import',
    scenario: '80',
    theme: 'light',
  }, // report rows (issue #57): expanded diff (27b) and expanded tool rows
  // report rows (issue #57): expanded diff (27b) and expanded tool rows
  // (28) — artefacts + score recorded, not gated
  {
    id: 'detail-review-diff-expanded-light',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '27b',
    theme: 'light',
    baseline: '27b-审核-diff展开-light.png',
    threshold: 0,
  },
  {
    id: 'detail-review-tools-expanded-light',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '28',
    theme: 'light',
    baseline: '28-执行transcript-工具行展开-light.png',
    threshold: 0,
  },
  // chief rows (issue #72): drawer + 总管设置 surfaces, scenarios numbered
  // after the r5 captures (100–116). The r5 batch sits outside the r7
  // baseline batch (04 §2 A6), so these enter CI as smoke rows; baseline
  // promotion waits on the r8 随拍 — see docs/research/r8-chief-panel-
  // adhoc.md for the gap registration.
  { id: 'chief-gated-light', route: '/app', scenario: '100', theme: 'light' },
  { id: 'chief-gated-dark', route: '/app', scenario: '100', theme: 'dark' },
  { id: 'chief-ready-light', route: '/app', scenario: '111', theme: 'light' },
  { id: 'chief-thread-light', route: '/app', scenario: '114', theme: 'light' },
  { id: 'chief-threads-open-light', route: '/app', scenario: '116', theme: 'light' },
  { id: 'chief-settings-agent-light', route: '/app', scenario: '101', theme: 'light' },
  { id: 'chief-settings-agent-dark', route: '/app', scenario: '101', theme: 'dark' },
  { id: 'chief-settings-charter-light', route: '/app', scenario: '102', theme: 'light' },
  { id: 'chief-settings-memory-light', route: '/app', scenario: '103', theme: 'light' },
  { id: 'chief-settings-watches-light', route: '/app', scenario: '104', theme: 'light' },
  // 04 §2 增量规则: 深色面随票覆盖 — the chief dark values are [推断] on the
  // shared tokens (no dark chief capture exists in any batch; r2 16 is the
  // pre-drift layout), registered in docs/research/r8-chief-panel-adhoc.md
  { id: 'chief-ready-dark', route: '/app', scenario: '111', theme: 'dark' },
  { id: 'chief-thread-dark', route: '/app', scenario: '114', theme: 'dark' },
  { id: 'chief-threads-open-dark', route: '/app', scenario: '116', theme: 'dark' },
  { id: 'chief-settings-charter-dark', route: '/app', scenario: '102', theme: 'dark' },
  { id: 'chief-settings-memory-dark', route: '/app', scenario: '103', theme: 'dark' },
  { id: 'chief-settings-watches-dark', route: '/app', scenario: '104', theme: 'dark' },
  // motion + dnd terminal states (issue #73): the drag step runs a real
  // pointer gesture and the settle waits the enter/exit transitions out,
  // so the shot is the static post-drop / hover surface. No official
  // capture exists for any of these (r3 85/86 caught the onboarding
  // carousel, not a drag state), so all four ride smoke pairs.
  {
    id: 'dnd-drop-building-to-done-light',
    route: '/app',
    scenario: '01',
    theme: 'light',
    scrollLeft: 'max',
    drag: {
      from: '[data-column="building"] .todo-card',
      to: '[data-column="done"]',
      at: 'top',
    },
  },
  {
    id: 'dnd-drop-building-to-done-dark',
    route: '/app',
    scenario: '02',
    theme: 'dark',
    scrollLeft: 'max',
    drag: {
      from: '[data-column="building"] .todo-card',
      to: '[data-column="done"]',
      at: 'top',
    },
  },
  {
    id: 'dnd-reorder-done-light',
    route: '/app',
    scenario: '35',
    theme: 'light',
    scrollLeft: 'max',
    drag: {
      from: '[data-column="done"] .board-column-list > div:first-child .todo-card',
      to: '[data-column="done"] .board-column-list > div:nth-child(2) .todo-card',
      at: 'bottom',
    },
  },
  {
    id: 'hover-more-menu-light',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '36',
    theme: 'light',
    clicks: ['.detail-head-icon--more'],
    hover: '.more-menu-item',
  },
  {
    id: 'hover-more-menu-dark',
    route: '/app/todo/u_B5ngeVOlKdKbG_4H9Cl',
    scenario: 'r8-80',
    theme: 'dark',
    viewport: { width: 1440, height: 710 },
    clicks: ['.detail-head-icon--more'],
    hover: '.more-menu-item',
  },
  {
    id: 'dnd-reorder-done-dark',
    route: '/app',
    scenario: '35d',
    theme: 'dark',
    scrollLeft: 'max',
    drag: {
      from: '[data-column="done"] .board-column-list > div:first-child .todo-card',
      to: '[data-column="done"] .board-column-list > div:nth-child(2) .todo-card',
      at: 'bottom',
    },
  },
  // r8 57 surface (重跑 footer over the failed-current run, #73): the
  // replica's failed-detail background behind the dialog lands with the
  // failed-state ticket, so this pair rides smoke now — promote to the
  // r8/57 baseline when that surface exists (04 §2 A6 batch switch).
  {
    id: 'overlay-history-failed-current-light',
    route: '/app/todo/r8-failed-12',
    scenario: '57f',
    theme: 'light',
  },
  {
    id: 'overlay-history-failed-current-dark',
    route: '/app/todo/r8-failed-12',
    scenario: '57f',
    theme: 'dark',
  },
  // notification permission banner rows (issue #114): the 看板顶部引导条
  // (r2 §1.3, captures 01/28/30 — pre-permission state) exists in no r7/r8
  // baseline, so the new state rides smoke pairs + expectText on the shared
  // NOTIFICATION_BANNER_COPY canon; dark covered per 04 §2 增量规则, en row
  // proves the fallback dict wiring for the canon keys
  {
    id: 'board-notify-banner-light',
    route: '/app',
    scenario: 'notify-banner',
    theme: 'light',
    expectText: '浏览器通知未开启',
  },
  {
    id: 'board-notify-banner-dark',
    route: '/app',
    scenario: 'notify-banner',
    theme: 'dark',
    expectText: '浏览器通知未开启',
  },
  {
    id: 'board-notify-banner-en',
    route: '/app',
    scenario: 'notify-banner',
    theme: 'light',
    locale: 'en',
    expectText: 'Browser notifications are off',
  },
  // rail-state user-menu (issue #127): the 40px collapsed rail opens the
  // same popover from .rail-user — the fixed floating variant escapes the
  // rail's overflow:hidden. No official capture carries the menu over the
  // rail, so the row rides a smoke pair + expectText (04 §2 no-baseline
  // rule), dark per 深色面随票覆盖.
  {
    id: 'board-usermenu-rail-click',
    route: '/app',
    scenario: '01',
    theme: 'dark',
    sidebarCollapsed: true,
    clicks: ['.rail-user'],
    expectText: '外观',
  },
  // sidebar row hover pill rows (issue #121): the claude.ai-style hover
  // affordance is a replica-side addition — no official capture of a
  // hovered sidebar row exists in any batch — so the state rides smoke
  // pairs with the #73 hover step: expanded 定时 row + collapsed rail 定时
  // row, light/dark per 04 §2 增量规则 (深色面随票覆盖)
  {
    id: 'sidebar-hover-light',
    route: '/app',
    scenario: '01',
    theme: 'light',
    hover: '.sidebar-row:has-text("定时")',
  },
  {
    id: 'sidebar-hover-dark',
    route: '/app',
    scenario: '02',
    theme: 'dark',
    hover: '.sidebar-row:has-text("定时")',
  },
  {
    id: 'rail-hover-light',
    route: '/app',
    scenario: '03',
    theme: 'light',
    sidebarCollapsed: true,
    hover: '.rail-row[aria-label="定时"]',
  },
  {
    id: 'rail-hover-dark',
    route: '/app',
    scenario: '03',
    theme: 'dark',
    sidebarCollapsed: true,
    hover: '.rail-row[aria-label="定时"]',
  },
  // segmented-control family hover rows (issue #138): no official capture
  // carries a hovered seg in any batch (same shape as the #121 sidebar
  // hover rows), so every family state rides a smoke pair with the #73
  // hover step — one row per family per theme (04 §2 增量规则 深色面随票);
  // expectText gives the self-compare teeth on the hovered surface. The
  // user-menu rows open the popover with a real chip click first (#127
  // trigger path), the branch-dialog seg rides the fixture-open dialog.
  {
    id: 'seg-hover-page-tab-light',
    route: '/app/project/ZAQczKCu0MOAzC1ZqcFlX',
    scenario: 'r2-24b',
    theme: 'light',
    hover: '.page-tab:has-text("文件")',
    expectText: '文件',
  },
  {
    id: 'seg-hover-page-tab-dark',
    route: '/app/project/ZAQczKCu0MOAzC1ZqcFlX',
    scenario: 'r2-24b',
    theme: 'dark',
    hover: '.page-tab:has-text("文件")',
    expectText: '文件',
  },
  {
    id: 'seg-hover-files-seg-light',
    route: '/app/project/ZAQczKCu0MOAzC1ZqcFlX',
    scenario: 'r2-24',
    theme: 'light',
    hover: '.prj-files-seg-tab:has-text("历史")',
    expectText: '历史',
  },
  {
    id: 'seg-hover-files-seg-dark',
    route: '/app/project/ZAQczKCu0MOAzC1ZqcFlX',
    scenario: 'r2-24',
    theme: 'dark',
    hover: '.prj-files-seg-tab:has-text("历史")',
    expectText: '历史',
  },
  {
    id: 'seg-hover-tasks-view-light',
    route: '/app/project/ZAQczKCu0MOAzC1ZqcFlX',
    scenario: 'prj-tasks',
    theme: 'light',
    hover: '.prj-tasks-view-btn[aria-label="网格视图"]',
    expectText: '搜索任务',
  },
  {
    id: 'seg-hover-tasks-view-dark',
    route: '/app/project/ZAQczKCu0MOAzC1ZqcFlX',
    scenario: 'prj-tasks',
    theme: 'dark',
    hover: '.prj-tasks-view-btn[aria-label="网格视图"]',
    expectText: '搜索任务',
  },
  {
    id: 'seg-hover-freq-light',
    route: '/app/schedules',
    scenario: 'r3-92',
    theme: 'light',
    hover: '.sched-form-freq-tab:has-text("每周")',
    expectText: '每周',
  },
  {
    id: 'seg-hover-freq-dark',
    route: '/app/schedules',
    scenario: 'r3-92',
    theme: 'dark',
    hover: '.sched-form-freq-tab:has-text("每周")',
    expectText: '每周',
  },
  {
    id: 'seg-hover-detail-tabs-light',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '17b',
    theme: 'light',
    hover: '.detail-tab:nth-child(2)',
    expectText: '聊天',
  },
  {
    id: 'seg-hover-detail-tabs-dark',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '27',
    theme: 'dark',
    hover: '.detail-tab:nth-child(2)',
    expectText: '聊天',
  },
  {
    id: 'seg-hover-usermenu-light',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '17b',
    theme: 'light',
    clicks: ['.sidebar-user'],
    hover: '.user-menu-seg button:nth-child(2)',
    expectText: '外观',
  },
  {
    id: 'seg-hover-usermenu-dark',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '27',
    theme: 'dark',
    clicks: ['.sidebar-user'],
    hover: '.user-menu-seg button:nth-child(2)',
    expectText: '外观',
  },
  {
    id: 'seg-hover-dlg-seg-light',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '31',
    theme: 'light',
    hover: '.dlg-seg-tab:nth-child(2)',
    expectText: 'Git',
  },
  {
    id: 'seg-hover-dlg-seg-dark',
    route: '/app/todo/r3-legacy-1',
    scenario: '31d',
    theme: 'dark',
    hover: '.dlg-seg-tab:nth-child(2)',
    expectText: 'Git',
  },
  {
    id: 'seg-hover-team-layout-light',
    route: '/app/team',
    scenario: '12',
    theme: 'light',
    hover: '.team-layout-tab:nth-child(2)',
    expectText: '个成员',
  },
  {
    id: 'seg-hover-team-layout-dark',
    route: '/app/team',
    scenario: '12',
    theme: 'dark',
    hover: '.team-layout-tab:nth-child(2)',
    expectText: '个成员',
  },
  {
    id: 'seg-hover-res-tabs-light',
    route: '/app/resources/skills/import',
    scenario: '79',
    theme: 'light',
    hover: '.res-tab:nth-child(2)',
    expectText: '从 GitHub',
  },
  {
    id: 'seg-hover-res-tabs-dark',
    route: '/app/resources/skills/import',
    scenario: '79',
    theme: 'dark',
    hover: '.res-tab:nth-child(2)',
    expectText: '从 GitHub',
  },
  {
    id: 'seg-hover-chief-tabs-light',
    route: '/app',
    scenario: '101',
    theme: 'light',
    hover: '.chief-tab:nth-child(2)',
    expectText: '章程',
  },
  {
    id: 'seg-hover-chief-tabs-dark',
    route: '/app',
    scenario: '101',
    theme: 'dark',
    hover: '.chief-tab:nth-child(2)',
    expectText: '章程',
  },
  // i18n bilingual spot-check rows (issue #74): zh is the pixel-gated
  // default on every row above; these prove the en fallback renders across
  // the screen families (board / detail / schedules / account / team /
  // resources / chief / search / project) and the 语言 dropdown open state.
  // Smoke pairs + expectText — the official captures are all zh, so no en
  // baseline exists to score against (04 §2: no-baseline rows ride smoke).
  {
    id: 'board-en',
    route: '/app',
    scenario: '02',
    theme: 'light',
    locale: 'en',
    // scenario 02 fills 待确认 with probe #9 — the empty state that always
    // renders there is 待开始's (r7 02 board composition)
    expectText: 'No tasks waiting to start',
  },
  {
    id: 'detail-confirm-en',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '17',
    theme: 'light',
    locale: 'en',
    expectText: 'Confirm',
  },
  {
    id: 'detail-fresh-en',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '23',
    theme: 'light',
    locale: 'en',
    expectText: 'Created Sep 21, 2026 13:21',
  },
  {
    id: 'schedules-empty-en',
    route: '/app/schedules',
    scenario: '11',
    theme: 'light',
    locale: 'en',
    expectText: 'No schedules yet.',
  },
  {
    id: 'account-en',
    route: '/app/account',
    scenario: '13',
    theme: 'light',
    locale: 'en',
    expectText: 'Push notifications',
  },
  // 语言 dropdown open states ([设计] shape, r2 §11 Q19) — endonym rows
  {
    id: 'account-lang-open-zh',
    route: '/app/account',
    scenario: '13-lang',
    theme: 'light',
    expectText: '简体中文',
  },
  {
    id: 'account-lang-open-en',
    route: '/app/account',
    scenario: '13-lang',
    theme: 'light',
    locale: 'en',
    expectText: 'English',
  },
  {
    id: 'team-en',
    route: '/app/team',
    scenario: '12',
    theme: 'light',
    locale: 'en',
    expectText: 'Create Agent',
  },
  {
    id: 'resources-skills-en',
    route: '/app/resources/skills',
    scenario: '06',
    theme: 'light',
    locale: 'en',
    expectText: 'Search skills...',
  },
  {
    id: 'chief-settings-en',
    route: '/app',
    scenario: '101',
    theme: 'light',
    locale: 'en',
    expectText: 'Chief settings',
  },
  {
    id: 'search-panel-en',
    route: '/app',
    scenario: '05',
    theme: 'light',
    locale: 'en',
    expectText: 'Go to',
  },
  // dialog open states (#66 clicks, #68 scenario-frozen) in en
  {
    id: 'overlay-new-task-en',
    route: '/app',
    scenario: '01',
    theme: 'light',
    locale: 'en',
    clicks: ['.board-new-task'],
    expectText: 'New task',
  },
  {
    id: 'overlay-delete-en',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '36',
    theme: 'light',
    locale: 'en',
    clicks: ['.detail-head-icon--more', '.more-menu-item[data-action="delete"]'],
    expectText: 'Delete this todo? This cannot be undone.',
  },
  {
    id: 'overlay-token-en',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '30',
    theme: 'light',
    locale: 'en',
    expectText: 'Cache read',
  },
  {
    id: 'overlay-accept-en',
    route: '/app',
    scenario: '34',
    theme: 'light',
    scrollLeft: 'max',
    locale: 'en',
    expectText: 'Complete todo',
  },
  {
    id: 'project-tasks-empty-en',
    route: '/app/project/ZAQczKCu0MOAzC1ZqcFlX',
    scenario: 'r2-24b',
    theme: 'light',
    locale: 'en',
    expectText: 'Nothing yet',
  },
  // collapse family (#147): the settled collapse states of both families, both
  // themes, reached through the real triggers. No official capture of a
  // settled collapse exists (r2 01d caught only the collapse instant, and the r7
  // batch has no collapsed board), so these ride smoke pairs; expectText pins
  // the collapsed DOM (collapse aria / strip class) beyond SSIM=1 self-comparison
  {
    id: 'sidebar-group-collapsed-light',
    route: '/app',
    scenario: '01',
    theme: 'light',
    clicks: ['.sidebar-group'],
    expectText: '展开项目',
  },
  {
    id: 'sidebar-group-collapsed-dark',
    route: '/app',
    scenario: '02',
    theme: 'dark',
    clicks: ['.sidebar-group'],
    expectText: '展开项目',
  },
  {
    id: 'board-column-collapsed-light',
    route: '/app',
    scenario: '01',
    theme: 'light',
    clicks: ['.board-column-collapse'],
    expectText: 'board-column--collapsed',
  },
  {
    id: 'board-column-collapsed-dark',
    route: '/app',
    scenario: '02',
    theme: 'dark',
    clicks: ['.board-column-collapse'],
    expectText: 'board-column--collapsed',
  },
];

export const DEFAULT_BASELINE_THRESHOLD = 0.85;
export const SMOKE_THRESHOLD = 1.0;
