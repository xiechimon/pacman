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
  MCP_MIN_CLI_VERSION,
  MCP_MIN_CLI_VERSION_GATE_OBSERVED,
  MCP_REGISTRY_BY_NAME,
  MCP_TOOL_REGISTRY,
  MCP_TOOLS_READ,
  MCP_TOOLS_WRITE,
  MEMORY_QUOTA_PER_AGENT,
  MEMORY_TOOLS,
  maskApiKey,
  ORPHAN_WORKTREE_TTL_MS,
  PHASE_VALUES,
  PI_STREAM_EVENTS,
  RECORD_SCHEMAS,
  remoteToolDefSchema,
  SECRET_BOX_ENVELOPE_VERSION,
  SSE_CHANNELS,
  STEP_EVENT_TYPES,
  STEP_LIFECYCLE_LOG_LINES,
  STREAM_TIMEOUTS_MS,
  WEB_REST_ENDPOINTS,
  WORKER_MEMORY_REMOTE_TOOLS,
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

  it('tool registry = 24 件 grant↔name 单源，白名单标签 1:1（02/A10 保形）', () => {
    const read = MCP_TOOL_REGISTRY.filter((t) => t.kind === 'read');
    const write = MCP_TOOL_REGISTRY.filter((t) => t.kind === 'write');
    expect(read.map((t) => t.grant)).toEqual([...MCP_TOOLS_READ]);
    expect(write.map((t) => t.grant)).toEqual([...MCP_TOOLS_WRITE]);
    expect(MCP_TOOL_REGISTRY).toHaveLength(24);
    // 工具名唯一、snake_case（wire 名 [推断] = chief 词表同族投影，r5 §3.1
    // 「与 docs MCP server 面六能力组同构」）。
    const names = MCP_TOOL_REGISTRY.map((t) => t.name);
    expect(new Set(names).size).toBe(24);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
    expect(MCP_REGISTRY_BY_NAME.size).toBe(24);
  });

  it('executor 最低版本门形状（02 §7.1：数值随复刻版本线自定 [设计]）', () => {
    expect(MCP_MIN_CLI_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    // 观测值留档不改（r3 文案 0.1.45 = 官方版本线）。
    expect(MCP_MIN_CLI_VERSION_GATE_OBSERVED).toBe('0.1.45');
  });
});

describe('worker memory tools (02 §4.4/r5 §6：worker 步 remoteTools 记忆三件套)', () => {
  it('三件 = MEMORY_TOOLS 同族，形状过 remoteToolDefSchema', () => {
    expect(WORKER_MEMORY_REMOTE_TOOLS.map((t) => t.name)).toEqual([...MEMORY_TOOLS]);
    for (const def of WORKER_MEMORY_REMOTE_TOOLS) {
      expect(remoteToolDefSchema.safeParse(def).success).toBe(true);
    }
    // 读工具幂等可重放；写工具单发（r5 §3.1 retry 预算纪律同族）。
    expect(WORKER_MEMORY_REMOTE_TOOLS.find((t) => t.name === 'memories')?.replaySafe).toBe(true);
    expect(WORKER_MEMORY_REMOTE_TOOLS.find((t) => t.name === 'save_memory')?.replaySafe).toBe(
      undefined,
    );
    // save_memory 带 sourceTodoId 可选溯源位（缺省 = server 从步上下文补齐）。
    const save = WORKER_MEMORY_REMOTE_TOOLS.find((t) => t.name === 'save_memory');
    expect(save).toBeDefined();
    const props = (save!.parameters as { properties: Record<string, unknown> }).properties;
    expect(Object.keys(props).sort()).toEqual(['content', 'projectId', 'sourceTodoId', 'title']);
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
      'sessionCookie',
      'manifestName',
    ]);
  });

  it('live values are the replacement pacman family (D3 已触发 2026-09-23, #109)', () => {
    expect(BRAND.cliCommandName).toBe('pacman');
    expect(BRAND.envPrefix).toBe('PACMAN_');
    expect(BRAND.homeDirName).toBe('.pacman');
    expect(BRAND.branchPrefix).toBe('pacman/conv-');
    expect(BRAND.apiKeyPrefix).toBe('pacman_');
    expect(BRAND.manifestName).toBe('Pacman');
    // 非品牌槽保持项:
    expect(BRAND.remoteMcpPath).toBe('/api/mcp');
    // 自有包名 (02 §5.8 复刻处置: 自发包名; 06 册 W2-D1: npm 公发改名):
    expect(BRAND.cliPackageName).toBe('@xiechimon/pacman-cli');
  });

  it('BRAND live values = BRAND_SLOTS replacement column (单源纪律, 素材替换计划 §2)', () => {
    expect(BRAND.cliCommandName).toBe(BRAND_SLOTS.cliCommandName.replacement);
    expect(BRAND.envPrefix).toBe(BRAND_SLOTS.envPrefix.replacement);
    expect(BRAND.branchPrefix).toBe(BRAND_SLOTS.branchPrefix.replacement);
    expect(BRAND.manifestName).toBe(BRAND_SLOTS.manifestName.replacement);
    expect(BRAND.sessionCookieName).toBe(BRAND_SLOTS.sessionCookie.replacement);
  });

  it('env vars are the PACMAN_ same-shape replacement (素材替换计划 §2; r3 §1.1 观测原名 TDS_*)', () => {
    // 替换相位 = PACMAN_ 同形（观测五件原名 r3 §1.1 = TDS_*，登记在
    // BRAND_SLOTS.envPrefix.todosDev）；复刻增量位（webDir = M5 SPA 静态托管
    // 覆写 [设计]；githubOauth 两件 = #231 握手面 client 凭证 [设计]；
    // token = #251 可选鉴权自有面 [设计]，非观测 canon）单独断言，两组不混判。
    const { webDir, githubOauthClientId, githubOauthClientSecret, token, ...observed } = ENV_VARS;
    expect(observed).toEqual({
      server: 'PACMAN_SERVER',
      apiKey: 'PACMAN_API_KEY',
      team: 'PACMAN_TEAM',
      workspacesDir: 'PACMAN_WORKSPACES_DIR',
      home: 'PACMAN_HOME',
    });
    expect(webDir).toBe('PACMAN_WEB_DIR');
    expect(githubOauthClientId).toBe('PACMAN_GITHUB_OAUTH_CLIENT_ID');
    expect(githubOauthClientSecret).toBe('PACMAN_GITHUB_OAUTH_CLIENT_SECRET');
    expect(token).toBe('PACMAN_TOKEN');
  });

  it('credential formats match the observed shapes (key prefix 随 BRAND 槽)', () => {
    expect(API_KEY_PATTERN.test('pacman_0123456789abcdef0123456789abcdef0123456789abcdef')).toBe(
      true,
    );
    expect(API_KEY_PATTERN.test('pacman_short')).toBe(false);
    // 复刻相位前缀已切换——原站前缀 key 不再匹配（D3 已触发，#109）。
    expect(API_KEY_PATTERN.test('tds_0123456789abcdef0123456789abcdef0123456789abcdef')).toBe(
      false,
    );
    expect(MACHINE_TOKEN_PATTERN.test('a'.repeat(64))).toBe(true);
    expect(DEVICE_ID_PATTERN.test('b'.repeat(32))).toBe(true);
  });

  it('API-key list-row mask follows the r3 §6 display rule', () => {
    // 展示规则原形（r3 §6 样例 `tds_afe07565…`）：品牌前缀 + 前 8 hex +
    // 省略号；前缀随 BRAND.apiKeyPrefix 槽（替换相位 = pacman_）。
    const plaintext = `pacman_afe07565${'0'.repeat(40)}`;
    expect(API_KEY_PATTERN.test(plaintext)).toBe(true);
    expect(maskApiKey(plaintext)).toBe('pacman_afe07565…');
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
