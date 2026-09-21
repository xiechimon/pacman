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
];

export const DEFAULT_BASELINE_THRESHOLD = 0.85;
export const SMOKE_THRESHOLD = 1.0;
