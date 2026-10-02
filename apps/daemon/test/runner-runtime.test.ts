// runner runtime 身份分支（spec 17 A3/A4，#622 失败方式 3/4 的 daemon 侧）：
// per-step 后端解析（唯一分叉点 backendFor(agent.provider)）+ claude-code
// 零凭据通道（provider=null 合法，不再 fabricate api_key 后在 pi 后端炸
// model not found）。
// 失败方式枚举先于实现固化（AGENTS.md 测试规则 3）：
//   1. runtime 步 + token provider null → 不 failStep；backendFor 收到
//      'claude-code'；会话创建；done success；canon `using model
//      claude-code/<modelId>`；sessionOpts.provider = inert 占位
//   2. runtime 步 + 老版本 server 伪 provider（api_key claude-code）→
//      runtime 分支权威短路（不透传伪配置语义），照常执行（mixed-version）
//   3. runtime 步 + modelId null → failStep，errorMessage 含 claude-code 字样
//   4. 非 runtime custom id + token provider null → daemon api_key 回退原语义
//      （sessionOpts.provider = {kind:'api_key', providerId}）+ canon 行不变
//   5. 非 runtime + 无 provider 无 model → 旧 failStep 文案逐字节（零回归面）
//   6. backendFor 收到 agent.provider 原值（null 步 → null）
//   7. runtime worker 步带 remoteTools/localTools（claim 恒携辅助面）→
//      sessionOpts 不含工具面 + 一条 [runtime] 降级行（显式缺席，非静默），
//      步照常跑完（T1 验收闭环；T4 接线后降级行消失）
//   8. runtime chief 步 → remoteTools 透传（后端 open() fail-closed 报
//      「不支持」——chief 链路不静默降级，spec 17 白名单行）
//   9. pi worker 步同载荷 → remoteTools/executeRemoteTool/localTools 照常
//      进 sessionOpts（工具面丢弃只分叉在 runtime 身份上，零回归）

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  AgentBackend,
  ClaimedStep,
  MachineDoneBody,
  MachineStreamEvent,
  ProviderConfig,
  RemoteToolDef,
  SessionOpts,
  ToolCallRecord,
  TranscriptUpload,
} from '@pacman/shared';
import { describe, expect, test } from 'vitest';
import { PI_CAPABILITIES } from '../src/backend/pi.js';
import { StepJournal } from '../src/journal.js';
import type { DaemonLogger } from '../src/log.js';
import type { MachineApi } from '../src/machine-client.js';
import { runStep } from '../src/runner.js';
import { statePaths } from '../src/state.js';

function captureLogger(): { logger: DaemonLogger; lines: string[] } {
  const lines: string[] = [];
  const push = (prefix: string | undefined, msg: string) =>
    lines.push(prefix ? `[${prefix}] ${msg}` : msg);
  const logger: DaemonLogger = {
    raw: (msg) => push(undefined, msg),
    prefixed: (prefix, msg) => push(prefix, msg),
    supervisor: (msg) => push('supervisor', msg),
    machine: (msg) => push('machine', msg),
    step: (msg) => push('step', msg),
    workspace: (msg) => push('workspace', msg),
    recover: (msg) => push('recover', msg),
    wake: (msg) => push('wake', msg),
    skills: (msg) => push('skills', msg),
    mcp: (msg) => push('mcp', msg),
  };
  return { logger, lines };
}

function claimedStep(opts: { provider: string | null; modelId: string | null }): ClaimedStep {
  return {
    step: { id: 's1', buildId: 'conv-1', kind: 'build', machineId: 'm1', createdAt: 1 },
    conversationId: 'conv-1',
    session: { action: 'new', sessionId: null },
    todo: { id: 't1', seqNum: 1, title: 'runtime 探针', spec: '跑一步' },
    project: { id: 'p1', name: 'demo', repo: null },
    agent: {
      id: 'a1',
      displayName: 'stub-builder',
      description: null,
      provider: opts.provider,
      modelId: opts.modelId,
      thinkingLevel: null,
    },
  };
}

class FakeClient implements MachineApi {
  doneBodies: { stepId: string; body: MachineDoneBody }[] = [];
  constructor(private readonly tokenProvider: ProviderConfig | null) {}

  async enroll(): Promise<never> {
    throw new Error('unused');
  }
  async me(): Promise<never> {
    throw new Error('unused');
  }
  async presence() {}
  async recover() {
    return { steps: [] };
  }
  async claim() {
    return null;
  }
  async heartbeat() {}
  async tool(_stepId: string, _call: ToolCallRecord) {}
  async transcriptDelta() {}
  async relayTool() {
    return '{}';
  }
  async token() {
    return { provider: this.tokenProvider, secrets: {}, git: null };
  }
  async skills() {
    return { skills: [] };
  }
  async uploadUrls(_stepId: string, files: { name: string }[]) {
    return {
      uploads: files.map((f, i) => ({
        name: f.name,
        url: `http://server/up/${i}`,
        method: 'PUT' as const,
        headers: {},
      })),
    };
  }
  async putUpload(
    _url: string,
    _headers: Record<string, string>,
    _body: TranscriptUpload | string,
  ) {}
  async done(stepId: string, body: MachineDoneBody) {
    this.doneBodies.push({ stepId, body });
  }
  async steer() {
    return null;
  }
  async stop() {
    return null;
  }
  async syncResult(_syncId: string, _body: { status: string; errorMessage?: string }) {}
  async shellPrecheck(): Promise<never> {
    throw new Error('unused');
  }
  async shellResult(): Promise<void> {}
  async stream(_signal: AbortSignal, _onEvent: (ev: MachineStreamEvent) => void) {}
}

/** 录制 SessionOpts 的 fake backend（解析面断言缝）。 */
function recordingBackend(): {
  backend: AgentBackend;
  sessions: SessionOpts[];
  resumed: string[];
} {
  const sessions: SessionOpts[] = [];
  const resumed: string[] = [];
  const backend: AgentBackend = {
    capabilities: PI_CAPABILITIES,
    async createSession(opts) {
      sessions.push(opts);
      return {
        sessionId: 'stub-sess-1',
        events: (async function* () {
          yield { type: 'text_delta', text: 'ok' } as never;
          yield { type: 'done', usage: [] } as never;
        })(),
        async steer() {},
        async stop() {},
        usage: () => [],
      };
    },
    async continueSession(id, opts) {
      resumed.push(id);
      sessions.push(opts);
      return {
        sessionId: id,
        events: (async function* () {
          yield { type: 'done', usage: [] } as never;
        })(),
        async steer() {},
        async stop() {},
        usage: () => [],
      };
    },
  };
  return { backend, sessions, resumed };
}

async function setup(claimed: ClaimedStep, opts: { tokenProvider?: ProviderConfig | null } = {}) {
  const home = mkdtempSync(join(tmpdir(), 'pacman-runner-runtime-'));
  const paths = statePaths(home, join(home, 'workspaces'));
  const { logger, lines } = captureLogger();
  const client = new FakeClient(opts.tokenProvider ?? null);
  const journal = new StepJournal(paths.outboxDir);
  const { backend, sessions } = recordingBackend();
  const resolved: (string | null | undefined)[] = [];
  const deps = {
    client,
    journal,
    backendFor: (agentProviderId: string | null | undefined) => {
      resolved.push(agentProviderId);
      return backend;
    },
    logger,
    paths,
    workspacesDir: join(home, 'workspaces'),
    mcpConfigPath: join(home, 'claude.json'),
    heartbeatIntervalMs: 60_000,
  };
  await runStep(deps, claimed);
  return { client, lines, sessions, resolved, paths };
}

describe('runner runtime 身份分支（spec 17 A3/A4）', () => {
  test('失败方式 1：runtime 步 + token provider null → claude 后端执行 + inert provider + canon 行', async () => {
    const { client, lines, sessions, resolved } = await setup(
      claimedStep({ provider: 'claude-code', modelId: 'claude-sonnet-4-5' }),
    );
    expect(resolved).toEqual(['claude-code']);
    expect(sessions).toHaveLength(1);
    // A4：零凭据步 provider 形状 = inert 占位（claude-code 后端不消费）。
    expect(sessions[0]?.provider).toEqual({ kind: 'api_key', providerId: 'claude-code' });
    expect(sessions[0]?.modelId).toBe('claude-sonnet-4-5');
    expect(lines).toContain('using model claude-code/claude-sonnet-4-5');
    expect(client.doneBodies[0]?.body.status).toBe('success');
  });

  test('失败方式 2：runtime 步 + 老版本 server 伪 provider → runtime 分支权威短路，照常执行', async () => {
    // mixed-version 窗口：未升级 server 仍 fabricate api_key claude-code——
    // daemon 侧 runtime 分支不看 creds.provider，一律 inert 占位照跑。
    const { client, sessions } = await setup(
      claimedStep({ provider: 'claude-code', modelId: 'claude-sonnet-4-5' }),
      {
        tokenProvider: {
          kind: 'api_key',
          providerId: 'claude-code',
        },
      },
    );
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.provider).toEqual({ kind: 'api_key', providerId: 'claude-code' });
    expect(client.doneBodies[0]?.body.status).toBe('success');
  });

  test('失败方式 3：runtime 步 modelId 缺 → failStep，errorMessage 含 claude-code 字样', async () => {
    const { client, sessions } = await setup(
      claimedStep({ provider: 'claude-code', modelId: null }),
    );
    expect(client.doneBodies[0]?.body.status).toBe('failed');
    expect(client.doneBodies[0]?.body.errorMessage).toContain('claude-code');
    expect(sessions).toHaveLength(0); // 闸在会话之前
  });

  test('失败方式 4：非 runtime custom id + token provider null → api_key 回退原语义 + canon 行不变', async () => {
    const { client, lines, sessions, resolved } = await setup(
      claimedStep({ provider: 'stub-gw', modelId: 'stub-model' }),
    );
    expect(resolved).toEqual(['stub-gw']);
    // daemon 侧回退（runner.ts:261 原行为）逐字节保持。
    expect(sessions[0]?.provider).toEqual({ kind: 'api_key', providerId: 'stub-gw' });
    expect(lines).toContain('using model stub-gw/stub-model');
    expect(client.doneBodies[0]?.body.status).toBe('success');
  });

  test('失败方式 5：非 runtime + 无 provider 无 model → 旧 failStep 文案逐字节', async () => {
    const { client, sessions } = await setup(claimedStep({ provider: null, modelId: null }));
    expect(client.doneBodies[0]?.body.status).toBe('failed');
    expect(client.doneBodies[0]?.body.errorMessage).toBe('no agent/model on claimed step');
    expect(sessions).toHaveLength(0);
  });

  test('失败方式 6：backendFor 收到 agent.provider 原值（null 步 → null）', async () => {
    const { resolved } = await setup(
      claimedStep({ provider: null, modelId: 'stub-model' }),
      // token 给足 provider，步能跑完（此处只钉解析入参）。
      {
        tokenProvider: {
          kind: 'http',
          providerId: 'stub-gw',
          baseUrl: 'http://127.0.0.1:9/v1',
          api: 'openai-completions',
          authHeader: true,
          models: [{ id: 'stub-model', name: 'stub-model' }],
        },
      },
    );
    expect(resolved).toEqual([null]);
  });
});

describe('runner runtime 步续会话（spec 17 A7）', () => {
  test('session.action=continue → backendFor 解析后走 continueSession', async () => {
    const claimed = {
      ...claimedStep({ provider: 'claude-code', modelId: 'claude-sonnet-4-5' }),
      session: { action: 'continue' as const, sessionId: 'sdk-session-uuid' },
    };
    const home = mkdtempSync(join(tmpdir(), 'pacman-runner-runtime-'));
    const paths = statePaths(home, join(home, 'workspaces'));
    const { logger } = captureLogger();
    const client = new FakeClient(null);
    const journal = new StepJournal(paths.outboxDir);
    const { backend, sessions, resumed } = recordingBackend();
    await runStep(
      {
        client,
        journal,
        backendFor: () => backend,
        logger,
        paths,
        workspacesDir: join(home, 'workspaces'),
        mcpConfigPath: join(home, 'claude.json'),
        heartbeatIntervalMs: 60_000,
      },
      claimed,
    );
    expect(resumed).toEqual(['sdk-session-uuid']); // SDK resume 通道（A7）
    expect(sessions[0]?.provider).toEqual({ kind: 'api_key', providerId: 'claude-code' });
  });
});

describe('runner runtime 步工具面（spec 17 A10：T4 前 SDK 通道缺位）', () => {
  /** worker 步 claim 恒携的辅助 remoteTools（machines.ts WORKER_REMOTE_TOOLS
   * 记忆三件套形状——两件够钉语义）。 */
  const workerRemoteTools: RemoteToolDef[] = [
    { name: 'save_memory', description: '存记忆' },
    { name: 'search_memory', description: '搜记忆', replaySafe: true },
  ];

  test('失败方式 7：runtime worker 步 → 工具面显式缺席 + 降级行，步照常跑完', async () => {
    const claimed = {
      ...claimedStep({ provider: 'claude-code', modelId: 'claude-sonnet-4-5' }),
      remoteTools: workerRemoteTools,
      localTools: ['remote_shell'],
    };
    const { client, lines, sessions } = await setup(claimed);
    expect(sessions).toHaveLength(1);
    // 三面全缺席：remoteTools + relay 回调 + localTools（build 步的 secret
    // 工具同批丢弃——claude-code 后端 open() 对非空 localTools fail-closed）。
    expect(sessions[0]?.remoteTools).toBeUndefined();
    expect(sessions[0]?.executeRemoteTool).toBeUndefined();
    expect(sessions[0]?.localTools).toBeUndefined();
    // 显式缺席 ≠ 静默丢弃：降级行点名被丢工具（A10「明确报」口径）。
    expect(
      lines.some((l) => l.includes('remoteTools') && l.includes('save_memory') && l.includes('T4')),
    ).toBe(true);
    expect(
      lines.some((l) => l.includes('localTools') && l.includes('remote_shell') && l.includes('T4')),
    ).toBe(true);
    expect(client.doneBodies[0]?.body.status).toBe('success');
  });

  test('失败方式 8：runtime chief 步 → remoteTools 透传（后端 fail-closed，chief 链路不静默降级）', async () => {
    const claimed: ClaimedStep = {
      ...claimedStep({ provider: 'claude-code', modelId: 'claude-sonnet-4-5' }),
      step: { id: 's1', buildId: 'chief-t1', kind: 'chief', machineId: 'm1', createdAt: 1 },
      conversationId: 'chief-t1',
      instruction: '探索团队资源现状',
      chief: { threadId: 't1', systemPrompt: '总管 charter', trigger: 'user' },
      remoteTools: [
        { name: 'create_todo', description: '建待办' },
        { name: 'create_agent', description: '建 agent' },
      ],
    };
    const { sessions } = await setup(claimed);
    // chief 词表是职责本体：透传给后端 → 真后端 open() 抛「not supported yet
    // (T4)」→ failStep（spec 17 白名单「chief 链路 remoteTools 面 fail-closed」）。
    expect(sessions[0]?.remoteTools).toHaveLength(2);
    expect(typeof sessions[0]?.executeRemoteTool).toBe('function');
  });

  test('失败方式 9：pi worker 步同载荷 → 工具面照常进 sessionOpts（零回归）', async () => {
    const claimed = {
      ...claimedStep({ provider: 'stub-gw', modelId: 'stub-model' }),
      remoteTools: workerRemoteTools,
      localTools: ['remote_shell'],
    };
    const { lines, sessions } = await setup(claimed);
    expect(sessions[0]?.remoteTools).toHaveLength(2);
    expect(typeof sessions[0]?.executeRemoteTool).toBe('function');
    // build 步 secret 工具 + remote_shell 都注册（现行为逐字节）。
    expect((sessions[0]?.localTools ?? []).map((t) => t.name)).toContain('remote_shell');
    expect((sessions[0]?.localTools ?? []).length).toBeGreaterThanOrEqual(2);
    expect(lines.some((l) => l.includes('T4'))).toBe(false);
  });
});
