// 品牌串命名常量表——02 §5.8 收口（品牌位集中，改名统一归 #44）+
// 素材替换计划（#44）§2 替换值正典 + 同槽延伸。
// 纪律（02 §5.8 尾注）：协议路径/字段名（`/api/machine/tasks/claim` 等）
// 不改形状——改的只许是本表品牌槽。
//
// 相位语义（素材替换计划 D3）：复刻先原样（tds 族）入库，替换触发 =
// 对外推广/生产部署前，兜底 = 收到 takedown；届时 BRAND 各槽一次性切到
// BRAND_SLOTS[*].replacement（= 素材替换计划 §2 表），并同步 parity 重定基线。
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
  manifestName: {
    todosDev: 'Todos（manifest name/short_name/apple-mobile-web-app-title）',
    replacement: 'Pacman',
  },
} as const;

/** 复刻相位现行值（D3「先原样」语义；包名/git 宿主按 02 §5.8 复刻处置列）。 */
export const BRAND = {
  cliCommandName: 'tds',
  envPrefix: 'TDS_',
  /** 用户主目录名（挂 $HOME 下）。 */
  homeDirName: '.tds',
  /** 工作区目录 = <home>/workspaces/<conversationId>（02 §5.8 同槽改名）。 */
  workspacesDirName: 'workspaces',
  branchPrefix: 'tds/conv-',
  apiKeyPrefix: 'tds_',
  /** 非品牌槽保持项：远程 MCP 路径（02 §5.8）。 */
  remoteMcpPath: '/api/mcp',
  /** 自有包名（02 §5.8 复刻处置「自发包名」→ #44 定 @pacman/cli，私包不发 npm）。 */
  cliPackageName: '@pacman/cli',
  /** manifest/界面品牌词（素材替换计划 D2：产品名 Pacman——界面词槽的替换值；
   * 复刻相位产品内文案原样为 Todos，随 D3 触发替换）。 */
  manifestName: 'Todos',
} as const;

/** env 变量原名（r3 §1.1 实测 TDS_* 五件；02 §5.1 引作 SERVER_URL/API_KEY/TEAM/
 * WORKSPACES_DIR/HOME，首槽从实测原名 TDS_SERVER）。替换相位 = PACMAN_ 同形
 * （素材替换计划 §2；HOME 槽为同形延伸）。 */
export const ENV_VARS = {
  server: 'TDS_SERVER',
  apiKey: 'TDS_API_KEY',
  team: 'TDS_TEAM',
  workspacesDir: 'TDS_WORKSPACES_DIR',
  home: 'TDS_HOME',
  /** server SPA 静态同源托管根覆写（02/A1，M5；缺省 = monorepo 布局
   * apps/web/dist 存在即托管，apps/server config.ts）。 */
  webDir: 'TDS_WEB_DIR',
} as const;

/** API key 形态 `tds_<48hex>`（02 §5.8；r3 §6 掩码样例 `tds_afe07565…`）。
 * hex 大小写未单独特写，从掩码样例取小写 [推断]。 */
export const API_KEY_PATTERN = /^tds_[0-9a-f]{48}$/;

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
 * 前缀 `tds/` 为品牌位）。 */
export function conversationBranch(conversationId: string): string {
  return `${BRAND.branchPrefix}${conversationId}`;
}
