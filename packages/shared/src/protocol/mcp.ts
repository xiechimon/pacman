// MCP 双面词表——02 §7（A10 锁定：server 面 24 工具白名单保形 + client 面
// 薄桥 per-Agent 授权 per-turn 降级）。
// client 面（外部 MCP → Agent）：管理页/授权/运行时行为 canon；
// server 面（外部 MCP 客户端 ← 复刻）：/api/mcp 端点 + key 级工具白名单
// （r3 §6 实测矩阵 1:1 收录）。

import { BRAND } from '../brand.js';

/** server 面端点（02 §5.8：形状保留（无品牌），路径保留）。 */
export const MCP_ENDPOINT_PATH = BRAND.remoteMcpPath;

/** 认证：Authorization: Bearer <apiKey>（02 §7.2；key 双用途见
 * records/api-key.ts）。 */
export const MCP_AUTH_HEADER_FORMAT = 'Authorization: Bearer <apiKey>';

/** 配置示例文案（02 §7.2：照 r3 §5.2 原文收录，品牌名素材化归 #44——
 * 替换值 = 本地主机名 + `pacman` server 名 + `pacman_<key>`，素材替换计划
 * §3.1）。 */
export const MCP_CONFIG_EXAMPLE_CANON = {
  json: '{"mcpServers":{"todos":{"url":"https://todos.dev/api/mcp","headers":{"Authorization":"Bearer tds_your_key"}}}}',
  vsCodeNote:
    'VS Code uses a servers key instead of mcpServers, with the same url and headers fields. Browser connectors that only support OAuth cannot use a key.',
} as const;

/** key 级工具白名单 = 24 件（02 §7.2，r3 §6 实测矩阵 1:1）：读 11 组 + 写 13 项。
 * 语义 canon 两句见 records/api-key.ts API_KEY_GRANT_SEMANTICS_COPY。 */
export const MCP_TOOLS_READ = [
  'Todos',
  'Projects',
  'Conversation',
  'Agents',
  'Schedules',
  'Attachment',
  'Skills',
  'Machines',
  'Issues',
  'Pull Requests',
  'Workflow Runs',
] as const;

export const MCP_TOOLS_WRITE = [
  'Create Todo',
  'Update Todo',
  'Message Todo',
  'Run Builds',
  'Run Review',
  'Confirm Builds',
  'Merge Builds',
  'Cancel Builds',
  'Complete Todos',
  'Close Todos',
  'Reopen Todos',
  'Schedule Todo',
  'Unschedule Todo',
] as const;

/** 能力六组（docs 原文，02 §7.2）：Read the repo 的 issues/PR+merge state/CI
 * workflow runs 仅 GitHub-backed 项目（依赖 02 §3/A4 GitHub 形态）。 */
export const MCP_CAPABILITY_GROUPS = [
  'Read the workspace',
  'Read the repo',
  'Read progress',
  'Organize work',
  'Run work',
  'Manage lifecycle',
] as const;

/** client 面 transport 两形态（02 §7.1 添加表单：远程 HTTP / 本地 stdio；
 * record 词表见 records/mcp-server.ts）。 */
export const MCP_TRANSPORT_LABELS = {
  http: '远程（HTTP）',
  stdio: '本地命令（stdio）',
} as const;

/** client 面空态与降级 canon（02 §7.1/r3 §1.5 原文）：每回合连接已授权
 * server；连接失败降级不阻断。 */
export const MCP_LIST_EMPTY_COPY =
  'MCP 服务器为 Agent 提供额外工具，例如工单系统、浏览器、内部 API。授权在每个 Agent 的页面上单独进行。';
export const MCP_CONNECT_FAILED_CANON = 'connect failed — its tools are unavailable this turn';

/** 版本墙形状（02 §7.1）：todos.dev 按机器 CLI 版本门控（r2 §6.2 文案
 * 「机器上的 tds CLI 需升级至 v0.1.45 及以上才能使用 MCP 工具…」）——复刻保留
 * 「executor 最低版本检查」形状，数值随复刻版本线自定（素材归 #44）。 */
export const MCP_MIN_CLI_VERSION_GATE_OBSERVED = '0.1.45';
