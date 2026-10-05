// PROTOTYPE mock data (#909) — zh-CN (authoritative locale of the product),
// shapes mirror the real fixtures (TodoRecord / ResourcesContent / etc) but
// hand-authored and trimmed to what the five faces render.

export type Tone = 'idle' | 'plan' | 'confirm' | 'done' | 'failed';

export interface PhaseUi {
  tone: Tone;
  label: string;
}

export const PHASE_UI: Record<string, PhaseUi> = {
  todo: { tone: 'idle', label: '待开始' },
  queued: { tone: 'idle', label: '排队中' },
  planning: { tone: 'plan', label: '规划中' },
  building: { tone: 'plan', label: '构建中' },
  confirm: { tone: 'confirm', label: '待确认' },
  review: { tone: 'confirm', label: '评审中' },
  done: { tone: 'done', label: '已完成' },
  failed: { tone: 'failed', label: '失败' },
  closed: { tone: 'idle', label: '已关闭' },
};

export interface MockTag {
  id: string;
  name: string;
  color: string;
}

export interface MockTask {
  id: string;
  seq: number;
  title: string;
  phase: keyof typeof PHASE_UI;
  column: ColumnKey;
  projectName: string;
  projectInitial: string;
  tags: MockTag[];
  agentName: string | null;
  ago: string;
  awaitingReply?: boolean;
  tokenCount?: string;
  branch?: string;
}

export type ColumnKey = 'idle' | 'building' | 'confirm' | 'done';

export const COLUMNS: {
  key: ColumnKey;
  label: string;
  dotVar: string;
}[] = [
  { key: 'idle', label: '待开始', dotVar: '--col-dot-idle' },
  { key: 'building', label: '执行中', dotVar: '--col-dot-building' },
  { key: 'confirm', label: '待处理', dotVar: '--col-dot-confirm' },
  { key: 'done', label: '已完成', dotVar: '--col-dot-done' },
];

const TAG_BUG: MockTag = { id: 't-bug', name: 'bug', color: '#d94f47' };
const TAG_UI: MockTag = { id: 't-ui', name: 'UI', color: '#c98a2d' };
const TAG_BACKEND: MockTag = { id: 't-be', name: '后端', color: '#4e81ee' };
const TAG_CHORE: MockTag = { id: 't-chore', name: '杂项', color: '#71767f' };

export const TASKS: MockTask[] = [
  {
    id: 'tsk-918',
    seq: 918,
    title: 'board: 拖拽排序在折叠列上丢位',
    phase: 'failed',
    column: 'building',
    projectName: 'pacman',
    projectInitial: 'P',
    tags: [TAG_BUG],
    agentName: 'Kimi-K3',
    ago: '25 分钟前',
    branch: 'fix/board-drag-collapse',
  },
  {
    id: 'tsk-917',
    seq: 917,
    title: 'server(863): session affinity 掉线重连',
    phase: 'building',
    column: 'building',
    projectName: 'pacman',
    projectInitial: 'P',
    tags: [TAG_BACKEND],
    agentName: 'GLM-5.3',
    ago: '12 分钟前',
    tokenCount: '48.2k',
    branch: 'server/session-affinity-retry',
  },
  {
    id: 'tsk-916',
    seq: 916,
    title: 'web: 搜索面板 ⌘K 高亮错位',
    phase: 'confirm',
    column: 'confirm',
    projectName: 'pacman',
    projectInitial: 'P',
    tags: [TAG_BUG, TAG_UI],
    agentName: 'Qwen3.8',
    ago: '1 小时前',
    awaitingReply: true,
    tokenCount: '31.7k',
    branch: 'web/search-highlight',
  },
  {
    id: 'tsk-915',
    seq: 915,
    title: 'daemon: shim 转译超时重试',
    phase: 'review',
    column: 'confirm',
    projectName: 'pacman',
    projectInitial: 'P',
    tags: [TAG_BACKEND],
    agentName: 'DeepSeek-V4',
    ago: '2 小时前',
    tokenCount: '52.0k',
  },
  {
    id: 'tsk-913',
    seq: 913,
    title: 'chief: review 相位 409 提示',
    phase: 'planning',
    column: 'building',
    projectName: 'pacman',
    projectInitial: 'P',
    tags: [TAG_UI],
    agentName: 'GLM-5.3',
    ago: '3 小时前',
  },
  {
    id: 'tsk-912',
    seq: 912,
    title: 'detail: transcript 代码块横向溢出',
    phase: 'todo',
    column: 'idle',
    projectName: 'pacman',
    projectInitial: 'P',
    tags: [TAG_BUG],
    agentName: null,
    ago: '昨天',
  },
  {
    id: 'tsk-911',
    seq: 911,
    title: 'overlay: more-menu 键盘环缺失',
    phase: 'queued',
    column: 'idle',
    projectName: 'pacman',
    projectInitial: 'P',
    tags: [TAG_UI],
    agentName: 'Qwen3.8',
    ago: '昨天',
  },
  {
    id: 'tsk-909',
    seq: 909,
    title: 'styles: per-face CSS 清零第一批',
    phase: 'planning',
    column: 'idle',
    projectName: 'pacman',
    projectInitial: 'P',
    tags: [TAG_CHORE],
    agentName: 'Kimi-K3',
    ago: '2 天前',
  },
  {
    id: 'tsk-914',
    seq: 914,
    title: 'resources: secrets 空态文案',
    phase: 'done',
    column: 'done',
    projectName: 'pacman',
    projectInitial: 'P',
    tags: [TAG_UI],
    agentName: 'Kimi-K3',
    ago: '3 小时前',
    tokenCount: '12.4k',
  },
  {
    id: 'tsk-910',
    seq: 910,
    title: 'e2e: merge-reject 证据 PNG 重写噪声',
    phase: 'done',
    column: 'done',
    projectName: 'pacman',
    projectInitial: 'P',
    tags: [TAG_CHORE],
    agentName: 'GLM-5.3',
    ago: '5 小时前',
    tokenCount: '8.9k',
  },
];

// ---- detail face (task 917) ----

export interface TranscriptMsg {
  kind: 'user' | 'agent' | 'activity' | 'diff';
  author?: string;
  ago?: string;
  text?: string;
  activity?: { tool: string; summary: string }[];
  diff?: { file: string; add: number; del: number };
}

export const DETAIL_TASK = TASKS[1]; // seq 917 building

export const TRANSCRIPT: TranscriptMsg[] = [
  {
    kind: 'user',
    author: 'xmon',
    ago: '42 分钟前',
    text: '把 session affinity 的掉线重连补上：pinned machine 离线时按 #878 的有界等待走，超时后回落任意在线机器并留痕。',
  },
  {
    kind: 'agent',
    author: 'GLM-5.3',
    ago: '40 分钟前',
    text: '先复现：在双机拓扑下把持有会话的机器下线，观察下一步请求的落点与等待时长。当前行为是无界等待，540s 后被 streamBodyTimeout 掐断。',
  },
  {
    kind: 'activity',
    ago: '38 分钟前',
    activity: [
      { tool: 'read', summary: 'apps/server/src/routes/builds.ts' },
      { tool: 'edit', summary: 'affinity.ts — 加有界等待 + 回落分支' },
      { tool: 'bash', summary: 'pnpm exec vitest related affinity — 14 通过' },
    ],
  },
  {
    kind: 'diff',
    diff: { file: 'apps/server/src/affinity.ts', add: 46, del: 12 },
  },
  {
    kind: 'agent',
    author: 'GLM-5.3',
    ago: '12 分钟前',
    text: '有界等待落在 90s（与 #878 同值），回落时把「pinned 机器离线」写进 run history。e2e 受影响面 6 条全绿，准备进入确认。',
  },
];

export const TOKEN_USAGE = {
  input: '182,431',
  output: '48,207',
  cacheRead: '1,204,882',
  cost: '$2.31',
};

export const BRANCH_INFO = {
  branch: 'server/session-affinity-retry',
  commit: 'b16e6e2c',
  machine: 'xmonsMac-3574',
  directory: '~/Code/AgentProjects/pacman',
};

export const RUN_HISTORY = [
  { label: 'run #4', meta: '12 分钟前 · 46 步', status: 'current' as const },
  { label: 'run #3', meta: '26 分钟前 · 失败于 streamBodyTimeout', status: 'failed' as const },
  { label: 'run #2', meta: '38 分钟前 · 51 步', status: 'done' as const },
  { label: 'run #1', meta: '42 分钟前 · 12 步', status: 'done' as const },
];

// ---- resources face ----

export const PROVIDERS = [
  { name: 'relay-186（GLM 通道池）', kind: 'anthropic-compatible', ago: '3 分钟前', ok: true, pill: '默认' },
  { name: 'OpenRouter', kind: 'openai-compatible', ago: '1 小时前', ok: true, pill: '' },
  { name: 'Anthropic 官方', kind: 'anthropic', ago: '昨天', ok: false, pill: '密钥过期' },
  { name: '本地 Ollama', kind: 'ollama', ago: '2 天前', ok: true, pill: '' },
];

export const MACHINES = [
  {
    name: 'xmonsMac-3574',
    kind: 'local' as const,
    online: true,
    runtimes: ['pi', 'claude-code'],
    shellEnabled: true,
  },
  {
    name: 'mea（WSL2 远端）',
    kind: 'remote' as const,
    online: true,
    runtimes: ['pi'],
    shellEnabled: false,
  },
];

export const MCP_SERVERS = [
  { name: 'codegraph', kind: 'stdio', url: 'codegraph-mcp', ago: '常驻' },
  { name: 'context7', kind: 'http', url: 'https://mcp.context7.com/mcp', ago: '2 小时前' },
];

export const SKILLS = [
  { name: 'verify-pacman', description: '隔离 live 栈 + Playwright 真用户路径取证' },
  { name: 'agent-reach', description: '多平台内容抓取路由（doctor 判通道）' },
  { name: 'serve-live', description: '本机服务开到对端可访问的常驻地址' },
];

export const SECRETS = [
  { name: 'NPM_TOKEN', ago: '3 天前' },
  { name: 'TWITTER_AUTH_TOKEN', ago: '上周' },
  { name: 'RELAY_186_KEY', ago: '昨天' },
];

// ---- sidebar ----

export const SIDEBAR_PROJECTS = [
  { id: 'prj-pacman', name: 'pacman', initial: 'P', active: true },
  { id: 'prj-craft', name: 'craft-agents', initial: 'C', active: false },
];

export const USER = { name: 'xmon', machine: 'xmonsMac-3574' };

// ---- overlay faces ----

export const SEARCH_RESULTS = [
  { kind: '任务', title: 'server(863): session affinity 掉线重连', meta: '#917 · 构建中', phase: 'building' },
  { kind: '任务', title: 'server(864): 钉住机器离线时的有界等待', meta: '#878 · 已完成', phase: 'done' },
  { kind: '资源', title: 'mea（WSL2 远端）', meta: '机器 · 在线', phase: null },
  { kind: '任务', title: 'web: 搜索面板 ⌘K 高亮错位', meta: '#916 · 待确认', phase: 'confirm' },
];

// ---- worst-case dataset (break-ui stress): unbreakable strings, missing
// fields, extreme counts, empty column, single-char names ----

const LONG_UNBREAKABLE =
  'board-drag-collapse-repro@very-long-subdomain.example-pacman-domain.cn';

export const WORST_TASKS: MockTask[] = [
  {
    id: 'w-1',
    seq: 999999,
    title: `board: 拖拽排序在折叠列上丢位——复现串 ${LONG_UNBREAKABLE} 与连续英文 sessionAffinityReconnectWithBoundedWaitAndFallbackTelemetryProbe`,
    phase: 'building',
    column: 'building',
    projectName: '长项目名称测试用超长项目名字没有空格无法换行',
    projectInitial: '长',
    tags: [TAG_BUG, TAG_UI, TAG_BACKEND, TAG_CHORE, TAG_BUG, TAG_UI],
    agentName: 'G',
    ago: '9999 年前',
    tokenCount: '9,999,999k',
    branch: 'fix/very-long-branch-name-with-no-break-opportunity-at-all-really-long',
  },
  {
    id: 'w-2',
    seq: 1,
    title: '',
    phase: 'todo',
    column: 'idle',
    projectName: '',
    projectInitial: '',
    tags: [],
    agentName: null,
    ago: '',
  },
  {
    id: 'w-3',
    seq: 42,
    title: 'A',
    phase: 'failed',
    column: 'building',
    projectName: 'P',
    projectInitial: 'P',
    tags: [TAG_BUG],
    agentName: 'Qwen3.8-Max-Ultra-Preview-With-Very-Long-Display-Name',
    ago: '刚刚',
    awaitingReply: true,
  },
];

export const WORST_PROVIDERS = [
  {
    name: `relay-186（GLM 通道池）· ${LONG_UNBREAKABLE}`,
    kind: 'anthropic-compatible-with-an-extremely-long-kind-label-for-stress',
    ago: '9999 年前',
    ok: false,
    pill: '密钥过期且原因描述非常长需要截断处理',
  },
];
