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
    id: 'chip-popover-review-light',
    route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc',
    scenario: '29',
    theme: 'light',
    baseline: '29-状态芯片弹层-审核-light.png',
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
  // gate rows (issue #69): resources batch A — six route surfaces, light
  // (r7 captured no dark resource screen). The two 新建技能 rows stay
  // smoke: their r8 79/80 baselines (committed with this ticket) carry
  // live-site state the frozen shell contract does not reproduce — the
  // 用量 nav row, the 看板 attention badge and the avatar FAB — so gating
  // them waits on the A6 rebaseline decision
  {
    id: 'resources-machines-light',
    route: '/app/resources/machines',
    scenario: '06',
    theme: 'light',
    baseline: '06-resources-machines.png',
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
    id: 'resources-providers-light',
    route: '/app/resources/providers',
    scenario: '07',
    theme: 'light',
    baseline: '07-resources-providers.png',
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
];

export const DEFAULT_BASELINE_THRESHOLD = 0.85;
export const SMOKE_THRESHOLD = 1.0;
