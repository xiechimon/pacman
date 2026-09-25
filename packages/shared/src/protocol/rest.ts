// web 协议面 REST 词表——02 §6.1（观测清单原样；`{id}` 归一；复刻全实现）+
// 02 各节回填补项（§4.3 chief、§4.4 memories、§6.3 search [设计]）+ r5 §8
// 端点补录。机器面 13 端点见 protocol/machine-api.ts；SSE 三通道见
// protocol/sse.ts。
// DELETE 面：r3 未逐一抓取——[推断] REST 同名 DELETE（02 §6.1），以 r2 §6 UI
// 删除流为准补齐，不发明新路径；M2 实现期重放补采（04 册附录 A）。

export interface RestEndpoint {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly path: string;
  /** 查询参数词表（02 §6.1 `?…=` 归一）。 */
  readonly query?: readonly string[];
  readonly note?: string;
}

export const WEB_REST_ENDPOINTS: readonly RestEndpoint[] = [
  // —— GET（02 §6.1 观测清单原样）——
  { method: 'GET', path: '/api/auth/session', note: '保形返回 seed 用户（02 §2.1）' },
  { method: 'GET', path: '/api/user/me' },
  { method: 'GET', path: '/api/teams', note: '恒 seed 一行（02 §2.2）' },
  { method: 'GET', path: '/api/teams/{id}/members', note: 'Agent 列表实际走此端点（r5 §1）' },
  { method: 'GET', path: '/api/teams/{id}/machines' },
  { method: 'GET', path: '/api/teams/{id}/providers', note: 'presets[] 38 项原样（r3 §2）' },
  { method: 'GET', path: '/api/teams/{id}/mcp-servers' },
  { method: 'GET', path: '/api/teams/{id}/models' },
  { method: 'GET', path: '/api/teams/{id}/notifications', note: '→ {unreadThreadIds}（02 §9.1）' },
  { method: 'GET', path: '/api/teams/{id}/progress' },
  { method: 'GET', path: '/api/teams/{id}/stream', note: 'SSE，见 protocol/sse.ts' },
  { method: 'GET', path: '/api/teams/{id}/skills/{sid}' },
  { method: 'GET', path: '/api/teams/{id}/skills/{sid}/file', query: ['fileName'] },
  { method: 'GET', path: '/api/teams/{id}/agents/{aid}' },
  { method: 'GET', path: '/api/teams/{id}/agents/{aid}/tasks' },
  { method: 'GET', path: '/api/teams/{id}/agents/{aid}/memories', note: '02 §4.4/r5 §6 实测' },
  { method: 'GET', path: '/api/teams/{id}/chief' },
  { method: 'GET', path: '/api/teams/{id}/chief/threads' },
  { method: 'GET', path: '/api/projects', query: ['teamId'] },
  { method: 'GET', path: '/api/projects/{id}/todos' },
  { method: 'GET', path: '/api/projects/{id}/branches' },
  { method: 'GET', path: '/api/projects/{id}/tags' },
  { method: 'GET', path: '/api/projects/{id}/builds' },
  {
    method: 'GET',
    path: '/api/projects/{id}/tree',
    query: ['ref'],
    note: '读裸库 ref 树（02 §3）',
  },
  { method: 'GET', path: '/api/projects/{id}/file', query: ['path', 'ref'] },
  {
    method: 'GET',
    path: '/api/projects/{id}/preview-token',
    query: ['ref'],
    note: '02 §9.3 在册不设计；触发条件 = 04 册附录 B',
  },
  { method: 'GET', path: '/api/todos', query: ['teamId'] },
  { method: 'GET', path: '/api/todos/{id}' },
  { method: 'GET', path: '/api/builds/{id}' },
  { method: 'GET', path: '/api/builds/{id}/steps' },
  { method: 'GET', path: '/api/conversations/{id}/messages', note: 'chief 会话同族（r5 §3.6）' },
  { method: 'GET', path: '/api/conversations/{id}/stream', note: 'SSE，见 protocol/sse.ts' },
  {
    method: 'GET',
    path: '/api/documents/{id}/diff',
    note: 'plan.md unified diff（02 §4.2/r5 §4）',
  },
  { method: 'GET', path: '/api/schedules', query: ['team'] },
  { method: 'GET', path: '/api/skills', query: ['teamId'] },
  { method: 'GET', path: '/api/whats-new', note: '形状保留、内容自选（02 §6.1）' },
  { method: 'GET', path: '/api/search', query: ['q'], note: '⌘K [设计] 自设（02 §6.3）' },
  // —— POST ——
  { method: 'POST', path: '/api/projects/{id}/todos', note: 'body {title,spec}（r3 §3.1）' },
  {
    method: 'POST',
    path: '/api/projects/{id}/builds',
    note: '开始/重跑；body {todoIds[],assignment,withPlan}（r5 §3.4）',
  },
  { method: 'POST', path: '/api/builds/{id}/merge', note: '→ 202 {delegated:true}（r3 §3.6）' },
  { method: 'POST', path: '/api/builds/{id}/steps', note: '确认/驳回回路（02 §4.2/r5 §4）' },
  { method: 'POST', path: '/api/teams/{id}/providers' },
  { method: 'POST', path: '/api/teams/{id}/mcp-servers' },
  { method: 'POST', path: '/api/teams/{id}/agents', note: '→ 201 {id}（r5 §1/§8 补录）' },
  { method: 'POST', path: '/api/schedules' },
  { method: 'POST', path: '/api/skills', note: '上传（02 §6.1）' },
  {
    method: 'POST',
    path: '/api/skills/scan',
    note: 'GitHub 扫描发现半（#223，#201 路线 A；原产品扫描钮 wire 未采——词表外 [设计] 新端点）',
  },
  { method: 'POST', path: '/api/analytics/first-touch', note: '形状保留、内容自选；可空实现' },
  {
    method: 'POST',
    path: '/_mp/api/track',
    note: '埋点端点（r3 §8.2 PostHog 风格 base64 batch）；复刻可空实现（02 §6.1）',
  },
  // —— PATCH ——
  { method: 'PATCH', path: '/api/teams/{id}/providers/{pid}' },
  { method: 'PATCH', path: '/api/teams/{id}/agents/{aid}' },
  { method: 'PATCH', path: '/api/teams/{id}/chief', note: '绑定 Agent（r5 §2 抓包）' },
  // —— OAuth 握手面（#231 [设计]：todos.dev 此面 wire 未采；形状 = 授权 URL
  // 签发 + callback 收码 302 回跳，族表 = records/provider.ts OAUTH_FAMILIES）——
  {
    method: 'POST',
    path: '/api/teams/{id}/providers/oauth/{preset}/authorize',
    note: '#231 [设计]：签发授权 URL（state 入册，TTL 10min 单次核销）',
  },
  {
    method: 'GET',
    path: '/api/oauth/callback',
    query: ['code', 'state', 'error'],
    note: '#231 [设计]：收码 → token 密封落 provider 行（02 §8）→ 302 回 providers 页',
  },
];

/** DELETE 面规则（02 §6.1 [推断]）：同名 REST DELETE；资源面 = r2 §6 UI 删除流
 * + chief 组织工具词（r5 §3.1 delete_todos/delete_secrets/delete_agents/
 * unschedule_todo）。不发明新路径；M2 重放补采后收紧。 */
export const DELETE_FACE = {
  status: '[推断]',
  rule: 'REST 同名 DELETE（02 §6.1）',
  resources: [
    'teams/{id}/machines', // 移除机器（r3 §1.2 限额弹窗「请移除一台」）
    'teams/{id}/agents', // 删除 Agent（r3 §4 概览按钮）
    'teams/{id}/skills', // 技能删除流（r2 §6.1）
    'teams/{id}/mcp-servers', // 卡片更多菜单 编辑/删除（r3 §5.1）
    'teams/{id}/agents/{aid}/memories', // 记忆条目卡删除图标（r5 §6 UI 实测；02 §4.4「列表/删除 API 保形」）
    'teams/{id}/providers', // 「可以替换或删除」（r2 §6.5）
    'teams/{id}/secrets', // 「保存后只能覆盖或删除」（r2 §6.3）
    'todos', // delete_todos（r5 §3.1）
    'schedules', // unschedule_todo（r5 §3.1）；once 触发后自动出队（r3 §9）
  ],
} as const;

/** 复刻不实现的观测端点（divergence 登记，wire diff 白名单化用，04 §1/§3）。
 * /api/push = todos.dev Web Push 订阅上传（r5 §1 实测 400）；R1 终裁：
 * Web Push/VAPID 不进 spec，sw.js push handler 保留文件形状、服务端不投
 * push（02 §9.1、04 §5）。 */
export const NON_REPLICATED_ENDPOINTS = [
  {
    method: 'POST',
    path: '/api/push',
    reason: 'Web Push 订阅上传——R1 已裁决有意 divergence（02 §9.1 终裁、04 §5）',
  },
] as const;
