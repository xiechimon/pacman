// 品牌串命名常量表——02 §5.8 收口（品牌位集中，改名统一归 #44）+
// 素材替换计划（#44）§2 替换值正典 + 同槽延伸。
// 纪律（02 §5.8 尾注）：协议路径/字段名（`/api/machine/tasks/claim` 等）
// 不改形状——改的只许是本表品牌槽。
//
// 相位语义（素材替换计划 D3）：**替换相位已触发**（2026-09-23，#109——
// 用户本机同时运行正版 todos.dev daemon，~/.tds 被正版占用、machine.json/
// token 不可覆写，复刻版默认状态目录同名冲突，提前执行）。BRAND 各槽 =
// BRAND_SLOTS[*].replacement（= 素材替换计划 §2 表），parity 同批重定基线。
// 非品牌槽（机器 token 64hex、/api/mcp 路径）保持，不进替换面。

/** 02 §5.8 十槽 + 素材替换计划 §2 同槽延伸五槽。todosDev = 原站现值（观测），
 * replacement = #44 替换值正典。 */
export const BRAND_SLOTS = {
  cliCommandName: { todosDev: 'tds', replacement: 'pacman' },
  envPrefix: { todosDev: 'TDS_', replacement: 'PACMAN_' },
  homeDir: { todosDev: '~/.tds', replacement: '~/.pacman' },
  workspacesDir: {
    todosDev: '~/.tds/workspaces/<conversationId>',
    replacement: '~/.pacman/workspaces/<conversationId>',
  },
  branchPrefix: { todosDev: 'tds/conv-', replacement: 'pacman/conv-' },
  apiKeyPrefix: { todosDev: 'tds_<48hex>', replacement: 'pacman_<48hex>' },
  // 02 §5.8 复刻处置 =「保持」：64hex 无前缀（r3 实测 machine.json），非品牌槽。
  machineToken: { todosDev: '64hex（无前缀）', replacement: '保持（非品牌槽）' },
  // 02 §5.8 复刻处置 =「本地主机名代位」：托管 repo 远端 URL 的域名段
  // （r3 §1.4 `https://git.todos.dev/<teamId>/<repoName>`），路径形状保留。
  gitHostDomain: { todosDev: 'git.todos.dev', replacement: '本地主机名代位' },
  // 02 §5.8 复刻处置 =「形状保留（无品牌），路径保留」。
  remoteMcpPath: { todosDev: '/api/mcp', replacement: '保持（形状无品牌）' },
  cliPackageName: { todosDev: '@todos-dev/cli', replacement: '@pacman/cli（私包，不发 npm）' },
  // —— 以下为素材替换计划 §2「同槽延伸」（r1/r2 盘点补录，同批改名）——
  deepLinkScheme: { todosDev: 'tds://', replacement: 'pacman://' },
  firstTouchCookie: { todosDev: 'tds_ft', replacement: 'pacman_ft' },
  localStoragePrefix: {
    todosDev: 'tds- / tds.（约 15 键，见 protocol/client-state.ts）',
    replacement: 'pacman- / pacman. 同形替换',
  },
  daemonLog: { todosDev: '~/.tds/daemon.log', replacement: '~/.pacman/daemon.log' },
  // 会话 cookie（01 §4.2 httpOnly 自设 [设计]；前缀 = 品牌位，与 firstTouchCookie
  // 同族；D3 切换 #109 补登记单源）。
  sessionCookie: { todosDev: 'tds_session', replacement: 'pacman_session' },
  manifestName: {
    todosDev: 'Todos（manifest name/short_name/apple-mobile-web-app-title）',
    replacement: 'Pacman',
  },
} as const;

/** 现行值 = 替换相位（D3 已触发 2026-09-23，#109）：BRAND_SLOTS 各槽
 * replacement 列（素材替换计划 §2 正典）；包名/git 宿主按 02 §5.8 复刻处置列。 */
export const BRAND = {
  cliCommandName: 'pacman',
  envPrefix: 'PACMAN_',
  /** 用户主目录名（挂 $HOME 下）。 */
  homeDirName: '.pacman',
  /** 工作区目录 = <home>/workspaces/<conversationId>（02 §5.8 同槽改名）。 */
  workspacesDirName: 'workspaces',
  branchPrefix: 'pacman/conv-',
  apiKeyPrefix: 'pacman_',
  /** 非品牌槽保持项：远程 MCP 路径（02 §5.8）。 */
  remoteMcpPath: '/api/mcp',
  /** 自有包名（02 §5.8 复刻处置「自发包名」→ #44 定 @pacman/cli，私包不发 npm）。 */
  cliPackageName: '@pacman/cli',
  /** manifest/界面品牌词（素材替换计划 D2：产品名 Pacman；D3 已触发，
   * 界面词槽 Todos→Pacman 同批切换，#109）。 */
  manifestName: 'Pacman',
  /** 会话 cookie 名（01 §4.2 自设 [设计]；品牌前缀同槽延伸，#109 补登记）。 */
  sessionCookieName: 'pacman_session',
} as const;

/** env 变量名（替换相位 = PACMAN_ 同形，素材替换计划 §2；观测原名 TDS_* 五件
 * 登记 BRAND_SLOTS.envPrefix.todosDev，r3 §1.1；02 §5.1 引作 SERVER_URL/API_KEY/
 * TEAM/WORKSPACES_DIR/HOME；HOME/webDir 槽为同形延伸）。 */
export const ENV_VARS = {
  server: 'PACMAN_SERVER',
  apiKey: 'PACMAN_API_KEY',
  team: 'PACMAN_TEAM',
  workspacesDir: 'PACMAN_WORKSPACES_DIR',
  home: 'PACMAN_HOME',
  /** server SPA 静态同源托管根覆写（02/A1，M5；缺省 = monorepo 布局
   * apps/web/dist 存在即托管，apps/server config.ts）。 */
  webDir: 'PACMAN_WEB_DIR',
  /** OAuth 握手面 client 凭证对（#231：self-host 无中心 App，用户自注
   * GitHub OAuth App 后以 env 注入；缺 = authorize 400 未配置）。 */
  githubOauthClientId: 'PACMAN_GITHUB_OAUTH_CLIENT_ID',
  githubOauthClientSecret: 'PACMAN_GITHUB_OAUTH_CLIENT_SECRET',
  /** server 可选 token 鉴权（#251，06 册 D8）：设 = 开（Bearer 头主干道；
   * 两条 SSE stream 端点另收 ?token=——EventSource 无法设 header）；
   * 未设/空串 = 关（默认，行为与现状一致）。 */
  token: 'PACMAN_TOKEN',
} as const;

/** API key 形态 `pacman_<48hex>`（02 §5.8 前缀 = 品牌槽；r3 §6 掩码样例原形
 * `tds_afe07565…`，前缀随槽切换）。hex 大小写未单独特写，从掩码样例取小写 [推断]。 */
export const API_KEY_PATTERN = /^pacman_[0-9a-f]{48}$/;

/** 机器 token = 64hex 无前缀（r3 §1.3 machine.json 实测；02 §5.8 保持项）。 */
export const MACHINE_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

/** 设备指纹 = 32hex（r3 §1.3 device.json 实测）。 */
export const DEVICE_ID_PATTERN = /^[0-9a-f]{32}$/;

/** 托管 repo 远端 URL 路径形状（02 §3：形状对应 r3 §1.4
 * `https://git.todos.dev/<teamId>/<repoName>`，域名段 = 本地主机名代位）。 */
export function gitHostedRepoPath(teamId: string, repoName: string): string {
  return `/${teamId}/${repoName}`;
}

/** 任务分支名 = 品牌分支前缀 + conversationId（02 §5.5：`conv-<conversationId>`，
 * 前缀 `pacman/` 为品牌位；原形 `tds/` = r3 §1.4 观测，随 D3 切换 #109）。 */
export function conversationBranch(conversationId: string): string {
  return `${BRAND.branchPrefix}${conversationId}`;
}
