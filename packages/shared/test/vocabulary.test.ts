// Vocabulary invariants: counts and exact sets pinned against the canonical
// tables (02 §4.1/§5/§6/§7, r3, r5, 素材替换计划 §2). These assertions are
// the human-readable half of the CI gate; the snapshot test freezes the full
// surface (01 §7.4 协议对拍: shared 词表 schema 快照 vs 02 §5/§6 表).

import { describe, expect, it } from 'vitest';
import {
  API_KEY_PATTERN,
  BOARD_COLUMNS,
  BRAND,
  BRAND_SLOTS,
  boardColumnFor,
  CLAIM_BACKOFF_CAP_MS,
  CLAIM_POLL_INTERVAL_MS,
  CLI_COMMANDS,
  CONFIG_KINDS,
  DB_TABLES,
  DEVICE_ID_PATTERN,
  ENV_VARS,
  MACHINE_CUSTOM_TOOLS,
  MACHINE_ENDPOINTS,
  MACHINE_TOKEN_PATTERN,
  MACHINE_WIRE,
  MAX_CONCURRENT_DEFAULT,
  MCP_CAPABILITY_GROUPS,
  MCP_TOOLS_READ,
  MCP_TOOLS_WRITE,
  MEMORY_QUOTA_PER_AGENT,
  maskApiKey,
  ORPHAN_WORKTREE_TTL_MS,
  PHASE_VALUES,
  PI_STREAM_EVENTS,
  RECORD_SCHEMAS,
  SECRET_BOX_ENVELOPE_VERSION,
  SSE_CHANNELS,
  STEP_EVENT_TYPES,
  STEP_LIFECYCLE_LOG_LINES,
  STREAM_TIMEOUTS_MS,
  WEB_REST_ENDPOINTS,
} from '../src/index.js';

describe('phase 九值权威单源 (02 §4.1, 锁定)', () => {
  it('is exactly the nine docs-ordered values', () => {
    expect(PHASE_VALUES).toEqual([
      'todo',
      'queued',
      'planning',
      'confirm',
      'building',
      'review',
      'done',
      'failed',
      'closed',
    ]);
  });

  it('board columns are the six r2 §4.1 names', () => {
    expect(BOARD_COLUMNS).toEqual(['待开始', '规划中', '待确认', '执行中', '待验收', '已完成']);
  });

  it('column mapping follows the phase × hasChanges dual key (02 §4.1 + r5 §8)', () => {
    expect(boardColumnFor('todo')).toBe('待开始');
    expect(boardColumnFor('queued')).toBe('待开始'); // 折叠 [推断]
    expect(boardColumnFor('planning')).toBe('规划中');
    expect(boardColumnFor('confirm', true)).toBe('待确认');
    expect(boardColumnFor('confirm', false)).toBe('执行中'); // gate 无改动留执行中 (r5 §8)
    expect(boardColumnFor('building')).toBe('执行中');
    expect(boardColumnFor('review', true)).toBe('待验收');
    expect(boardColumnFor('review', false)).toBe('执行中');
    expect(boardColumnFor('done')).toBe('已完成');
    expect(boardColumnFor('failed')).toBe('执行中'); // 钉执行中列顶 (r1 §7.4)
    expect(boardColumnFor('closed')).toBeNull(); // 不占列 [推断]
  });
});

describe('machine protocol (02 §5, r3 §1.6)', () => {
  it('has the 13 machine-face endpoints', () => {
    expect(MACHINE_ENDPOINTS).toHaveLength(13);
    expect(MACHINE_ENDPOINTS.map((e) => e.path)).toEqual([
      '/api/machine/enroll',
      '/api/machine/enroll/start',
      '/api/machine/enroll/poll',
      '/api/machine/me',
      '/api/machine/presence',
      '/api/machine/recover',
      '/api/machine/tasks/claim',
      '/api/machine/stream',
      '/api/machine/heartbeat/{stepId}',
      '/api/machine/tool/{stepId}',
      '/api/machine/token/{stepId}',
      '/api/machine/upload-urls/{stepId}',
      '/api/machine/done/{stepId}',
    ]);
  });

  it('pins the observed cadence and retry budgets', () => {
    expect(CLAIM_POLL_INTERVAL_MS).toBe(75_000); // ~75–76s (r3 §1.5)
    expect(CLAIM_BACKOFF_CAP_MS).toBe(30_000); // 指数退避封顶 (r3 §1.5)
    expect(STREAM_TIMEOUTS_MS).toEqual({
      streamFirstEvent: 300_000,
      streamIdle: 480_000,
      streamBodyTimeout: 540_000,
    }); // r3 bundle 原文
    expect(ORPHAN_WORKTREE_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000); // r3 §1.4
    expect(MAX_CONCURRENT_DEFAULT).toBe(3); // 02 §2.5
    expect(MEMORY_QUOTA_PER_AGENT).toBe(100); // 02 §4.4/r5 §6
  });

  it('pi stream event vocabulary is the 17-item bundle extraction (02 §5.6)', () => {
    expect(PI_STREAM_EVENTS).toHaveLength(17);
    expect(PI_STREAM_EVENTS).toEqual([
      'text_delta',
      'thinking',
      'thinking_delta',
      'toolcall_end',
      'message_update',
      'message_end',
      'message_stop',
      'compaction',
      'compaction_start',
      'compaction_end',
      'auto_retry_start',
      'auto_retry_end',
      'steer',
      'done',
      'error',
      'wake',
      'shutdown',
    ]);
  });

  it('config kinds and machine custom tools (02 §5.6)', () => {
    expect(CONFIG_KINDS).toEqual(['api_key', 'oauth', 'http', 'stdio']);
    expect(MACHINE_CUSTOM_TOOLS).toEqual(['web_fetch', 'remote_shell', 'push_branch']);
  });

  it('CLI command face照抄 (02 §5.1)', () => {
    expect(CLI_COMMANDS).toEqual([
      'start',
      'stop',
      'restart',
      'logs',
      'logout',
      'status',
      'version',
      'provider',
    ]);
  });

  it('step lifecycle log line templates (02 §5.7)', () => {
    expect(STEP_LIFECYCLE_LOG_LINES).toHaveLength(7);
  });
});

describe('web REST vocabulary (02 §6.1 canonical)', () => {
  const has = (method: string, path: string) =>
    WEB_REST_ENDPOINTS.some((e) => e.method === method && e.path === path);

  it('covers the observed GET list', () => {
    for (const [method, path] of [
      ['GET', '/api/auth/session'],
      ['GET', '/api/user/me'],
      ['GET', '/api/teams'],
      ['GET', '/api/teams/{id}/members'],
      ['GET', '/api/teams/{id}/machines'],
      ['GET', '/api/teams/{id}/providers'],
      ['GET', '/api/teams/{id}/mcp-servers'],
      ['GET', '/api/teams/{id}/models'],
      ['GET', '/api/teams/{id}/notifications'],
      ['GET', '/api/teams/{id}/progress'],
      ['GET', '/api/teams/{id}/stream'],
      ['GET', '/api/teams/{id}/skills/{sid}'],
      ['GET', '/api/teams/{id}/skills/{sid}/file'],
      ['GET', '/api/teams/{id}/agents/{aid}'],
      ['GET', '/api/teams/{id}/agents/{aid}/tasks'],
      ['GET', '/api/teams/{id}/agents/{aid}/memories'],
      ['GET', '/api/teams/{id}/chief'],
      ['GET', '/api/teams/{id}/chief/threads'],
      ['GET', '/api/projects'],
      ['GET', '/api/projects/{id}/todos'],
      ['GET', '/api/projects/{id}/branches'],
      ['GET', '/api/projects/{id}/tags'],
      ['GET', '/api/projects/{id}/builds'],
      ['GET', '/api/projects/{id}/tree'],
      ['GET', '/api/projects/{id}/file'],
      ['GET', '/api/projects/{id}/preview-token'],
      ['GET', '/api/todos'],
      ['GET', '/api/todos/{id}'],
      ['GET', '/api/builds/{id}'],
      ['GET', '/api/builds/{id}/steps'],
      ['GET', '/api/conversations/{id}/messages'],
      ['GET', '/api/conversations/{id}/stream'],
      ['GET', '/api/documents/{id}/diff'],
      ['GET', '/api/schedules'],
      ['GET', '/api/skills'],
      ['GET', '/api/whats-new'],
      ['GET', '/api/search'],
    ] as const) {
      expect(has(method, path), `${method} ${path}`).toBe(true);
    }
  });

  it('covers the observed POST/PATCH list', () => {
    for (const [method, path] of [
      ['POST', '/api/projects/{id}/todos'],
      ['POST', '/api/projects/{id}/builds'],
      ['POST', '/api/builds/{id}/merge'],
      ['POST', '/api/builds/{id}/steps'],
      ['POST', '/api/teams/{id}/providers'],
      ['POST', '/api/teams/{id}/mcp-servers'],
      ['POST', '/api/teams/{id}/agents'],
      ['POST', '/api/schedules'],
      ['POST', '/api/skills'],
      ['POST', '/api/analytics/first-touch'],
      ['PATCH', '/api/teams/{id}/providers/{pid}'],
      ['PATCH', '/api/teams/{id}/agents/{aid}'],
      ['PATCH', '/api/teams/{id}/chief'],
    ] as const) {
      expect(has(method, path), `${method} ${path}`).toBe(true);
    }
  });

  it('carries query vocabularies for the parameterized GETs', () => {
    const q = (path: string) => WEB_REST_ENDPOINTS.find((e) => e.path === path)?.query ?? [];
    expect(q('/api/projects')).toEqual(['teamId']);
    expect(q('/api/projects/{id}/tree')).toEqual(['ref']);
    expect(q('/api/projects/{id}/file')).toEqual(['path', 'ref']);
    expect(q('/api/projects/{id}/preview-token')).toEqual(['ref']);
    expect(q('/api/todos')).toEqual(['teamId']);
    expect(q('/api/schedules')).toEqual(['team']);
    expect(q('/api/skills')).toEqual(['teamId']);
    expect(q('/api/teams/{id}/skills/{sid}/file')).toEqual(['fileName']);
    expect(q('/api/search')).toEqual(['q']);
  });

  it('excludes /api/push — Web Push 不进 spec (R1 终裁, 02 §9.1/04 §5)', () => {
    expect(has('POST', '/api/push')).toBe(false);
  });
});

describe('SSE channels (02 §1.2, 全 SSE 无 WS)', () => {
  it('has exactly the three channels', () => {
    expect(SSE_CHANNELS.map((c) => c.endpoint)).toEqual([
      '/api/teams/{id}/stream',
      '/api/conversations/{id}/stream',
      '/api/machine/stream',
    ]);
  });
});

describe('MCP vocabulary (02 §7.2, r3 §6 matrix 1:1)', () => {
  it('server-face whitelist = 11 read groups + 13 write tools = 24', () => {
    expect(MCP_TOOLS_READ).toHaveLength(11);
    expect(MCP_TOOLS_WRITE).toHaveLength(13);
    expect(MCP_TOOLS_READ).toEqual([
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
    ]);
    expect(MCP_TOOLS_WRITE).toEqual([
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
    ]);
  });

  it('capability groups are the six docs原文 (02 §7.2)', () => {
    expect(MCP_CAPABILITY_GROUPS).toEqual([
      'Read the workspace',
      'Read the repo',
      'Read progress',
      'Organize work',
      'Run work',
      'Manage lifecycle',
    ]);
  });
});

describe('brand slots (02 §5.8 收口 + 素材替换计划 §2 替换值正典)', () => {
  it('covers every 02 §5.8 slot row', () => {
    expect(Object.keys(BRAND_SLOTS)).toEqual([
      'cliCommandName',
      'envPrefix',
      'homeDir',
      'workspacesDir',
      'branchPrefix',
      'apiKeyPrefix',
      'machineToken',
      'gitHostDomain',
      'remoteMcpPath',
      'cliPackageName',
      'deepLinkScheme',
      'firstTouchCookie',
      'localStoragePrefix',
      'daemonLog',
      'manifestName',
    ]);
  });

  it('live复刻-phase values are the as-is tds family (D3: 先原样、触发时替换)', () => {
    expect(BRAND.cliCommandName).toBe('tds');
    expect(BRAND.envPrefix).toBe('TDS_');
    expect(BRAND.branchPrefix).toBe('tds/conv-');
    expect(BRAND.apiKeyPrefix).toBe('tds_');
    // 非品牌槽保持项:
    expect(BRAND.remoteMcpPath).toBe('/api/mcp');
    // 自有包名 (02 §5.8 复刻处置: 自发包名; 素材替换计划 §2: @pacman/cli 私包):
    expect(BRAND.cliPackageName).toBe('@pacman/cli');
  });

  it('env vars are the five observed originals (r3 §1.1)', () => {
    expect(ENV_VARS).toEqual({
      server: 'TDS_SERVER',
      apiKey: 'TDS_API_KEY',
      team: 'TDS_TEAM',
      workspacesDir: 'TDS_WORKSPACES_DIR',
      home: 'TDS_HOME',
    });
  });

  it('credential formats match the observed shapes', () => {
    expect(API_KEY_PATTERN.test('tds_0123456789abcdef0123456789abcdef0123456789abcdef')).toBe(true);
    expect(API_KEY_PATTERN.test('tds_short')).toBe(false);
    expect(MACHINE_TOKEN_PATTERN.test('a'.repeat(64))).toBe(true);
    expect(DEVICE_ID_PATTERN.test('b'.repeat(32))).toBe(true);
  });

  it('API-key list-row mask follows the r3 §6 display rule', () => {
    // 明文 tds_<48hex> → 行掩码 `tds_afe07565…`（r3 §6 样例原形）。
    const plaintext = `tds_afe07565${'0'.repeat(40)}`;
    expect(API_KEY_PATTERN.test(plaintext)).toBe(true);
    expect(maskApiKey(plaintext)).toBe('tds_afe07565…');
  });

  it('SecretBox envelope version word is v1 (01 §4.2)', () => {
    expect(SECRET_BOX_ENVELOPE_VERSION).toBe('v1');
  });
});

describe('record projection (01 §6 / 03 M1; M4a +chief)', () => {
  it('DB table registry is the 01 §6 list + chief (26 incl. the todo_tag join)', () => {
    expect(DB_TABLES).toHaveLength(26);
    expect(DB_TABLES).toContain('todo_tag');
    expect(DB_TABLES).toContain('chief');
  });

  it('record shapes cover exactly the 25 wire tables (todo_tag join has none)', () => {
    expect(Object.keys(RECORD_SCHEMAS)).toHaveLength(25);
    expect(Object.keys(RECORD_SCHEMAS)).toEqual(DB_TABLES.filter((t) => t !== 'todo_tag'));
  });
});

describe('AgentBackend seam (01 §5, 00/D1 缝)', () => {
  it('StepEvent types = 02 §5.6 pi vocabulary session-facing 15 items, 1:1 no rename', () => {
    // PI_STREAM_EVENTS 17 件 = 会话内 15 件 + 机器控制 wake/shutdown（走机器
    // stream 通道，protocol/sse.ts）；缝事件面锁定前 15 件（01 §5）。
    expect(STEP_EVENT_TYPES).toHaveLength(15);
    expect(STEP_EVENT_TYPES).toEqual(PI_STREAM_EVENTS.slice(0, 15));
  });
});

describe('machine wire (02 §5 canonical, wire 层进 CI)', () => {
  it('MACHINE_WIRE covers exactly the 13 endpoint paths (single source)', () => {
    expect(MACHINE_WIRE).toHaveLength(13);
    expect(MACHINE_WIRE.map((w) => w.path)).toEqual(MACHINE_ENDPOINTS.map((e) => e.path));
  });

  it('claim/stream verbs match observed evidence (long-poll claim + SSE stream)', () => {
    const byPath = Object.fromEntries(MACHINE_WIRE.map((w) => [w.path, w.method]));
    expect(byPath['/api/machine/tasks/claim']).toBe('POST'); // 长轮询（r3 §1.5）
    expect(byPath['/api/machine/stream']).toBe('GET'); // SSE wake（02 §1.2）
    expect(byPath['/api/machine/me']).toBe('GET');
    expect(byPath['/api/machine/token/{stepId}']).toBe('GET');
  });
});
