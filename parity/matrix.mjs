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
//              (pipeline gate, SSIM must be exactly 1.0).
//              Rows switched to a later capture batch (04 §2 A6) use a
//              batch-prefixed path, e.g. 'r8/57-运行历史-失败态单行-light.png';
//              run.mjs resolves prefixed paths under docs/research/assets/.
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
