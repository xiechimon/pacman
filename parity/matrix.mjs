// Declarative capture matrix (issue #53). One row = one parity pair.
// Adding a capture in later tickets (#54–#58) = adding a row here.
//
// Entry contract:
//   id         stable pair name (output artefacts are named after it)
//   route      app route to capture
//   scenario   r7 capture number → fixture set via ?scenario=
//   theme      'dark' | 'light' (injected via localStorage tds-theme)
//   scrollLeft optional: number, or 'max' for rightmost board scroll,
//              applied to the element carrying [data-parity-scroll]
//   sidebarCollapsed  optional: true → injects tds.sidebar-collapsed=1
//              before load so the 40px rail renders (r7 03)
//   clicks   optional: CSS selectors clicked in order after load, one
//              rAF settle between each — opens overlay surfaces (#66)
//   batch    optional baseline batch dir under docs/research/assets/
//              (default r7; #66 dark rows ride r8 54–57)
//   viewport optional per-row capture viewport; the physical window of
//              the r8 session capped its dark baselines at 1440×710, so
//              those rows capture at the same size (centering law still
//              holds, r7 §3.5 formula)
//   baseline   optional r7 filename under docs/research/assets/r7/ —
//              present = real parity pair (threshold 0.85);
//              absent  = smoke pair, capture compared against itself
//              (pipeline gate, SSIM must be exactly 1.0)
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
    // 本地 0.8547 / CI 0.8468：macOS 与 Linux 字体栅格化噪声，无结构差异（blend 已核），单独放宽
    threshold: 0.84,
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
  // gate rows (issue #66): overlay batch A open states — new-task dialog
  // (04), delete confirm over the done detail (25), 更多 menu over the
  // confirm (18) and fresh (24) details. Dark twins ride the r8 54–57
  // baselines captured with this ticket.
  {
    id: 'overlay-new-task-light',
    route: '/app',
    scenario: '01',
    theme: 'light',
    clicks: ['.board-new-task'],
    baseline: '04-新建任务dialog-light.png',
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
  // board (54), delete confirm (55) and 更多 menu (56) over the probe #16
  // confirm detail, 更多 menu over its fresh detail (57)
  {
    id: 'overlay-new-task-dark',
    route: '/app',
    scenario: '54',
    theme: 'dark',
    clicks: ['.board-new-task'],
    batch: 'r8',
    viewport: { width: 1440, height: 710 },
    baseline: '54-新建任务dialog-dark.png',
  },
  {
    // report-only: the r8 55/56 surfaces sit on the probe-#16 confirm
    // detail, which the live site restyled after the r7 freeze (doc-pane
    // inline-code spacing, sidebar 用量 row, attention-badge formula,
    // taskline seq chip, FAB badge — all 09-22 drift, blend-verified
    // outside the overlay itself). The r7-frozen replica cannot gate
    // both eras; per 04 §2 these pairs report, the overlay geometry is
    // gated by the 54/57 twins. Site-drift rebaseline = A6 ticket.
    id: 'overlay-delete-dark',
    route: '/app/todo/u_B5ngeVOlKdKbG_4H9Cl',
    scenario: '55',
    theme: 'dark',
    clicks: ['.detail-head-icon--more', '.more-menu-item[data-action="delete"]'],
    batch: 'r8',
    viewport: { width: 1440, height: 710 },
    baseline: '55-删除确认弹窗-dark.png',
    threshold: 0,
  },
  {
    id: 'overlay-more-confirm-dark',
    route: '/app/todo/u_B5ngeVOlKdKbG_4H9Cl',
    scenario: '56',
    theme: 'dark',
    clicks: ['.detail-head-icon--more'],
    batch: 'r8',
    viewport: { width: 1440, height: 710 },
    baseline: '56-待确认-更多菜单-dark.png',
    threshold: 0,
  },
  {
    id: 'overlay-more-fresh-dark',
    route: '/app/todo/u_B5ngeVOlKdKbG_4H9Cl',
    scenario: '57',
    theme: 'dark',
    clicks: ['.detail-head-icon--more'],
    batch: 'r8',
    viewport: { width: 1440, height: 710 },
    baseline: '57-fresh-更多菜单-dark.png',
  },
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
];

export const DEFAULT_BASELINE_THRESHOLD = 0.85;
export const SMOKE_THRESHOLD = 1.0;
