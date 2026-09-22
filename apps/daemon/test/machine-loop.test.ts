// 机器主循环（02 §5.4 上线序列 canon + claim 退避 + recover 对账 + 步执行
// 全链，fake MachineApi/fake AgentBackend 注入——pi 真执行面归 integration）。

import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  AgentBackend,
  AgentSessionHandle,
  ClaimedStep,
  MachineDoneBody,
  StepEvent,
  ToolCallRecord,
  TranscriptUpload,
} from '@pacman/shared';
import { describe, expect, test } from 'vitest';
import { PI_CAPABILITIES } from '../src/backend/pi.js';
import { loadDaemonConfig } from '../src/config.js';
import { type DaemonLogger, formatLine } from '../src/log.js';
import type { MachineApi } from '../src/machine-client.js';
import { nextBackoffMs, runMachine } from '../src/machine-loop.js';
import { statePaths } from '../src/state.js';

function tmpHome(): string {
  return mkdtempSync(join(tmpdir(), 'pacman-loop-'));
}

function captureLogger(): { logger: DaemonLogger; lines: string[] } {
  const lines: string[] = [];
  const push = (prefix: string | undefined, msg: string) =>
    lines.push(formatLine(prefix ? { prefix, msg } : { msg }));
  const logger: DaemonLogger = {
    raw: (msg) => push(undefined, msg),
    prefixed: (prefix, msg) => push(prefix, msg),
    supervisor: (msg) => push('supervisor', msg),
    machine: (msg) => push('machine', msg),
    step: (msg) => push('step', msg),
    workspace: (msg) => push('workspace', msg),
    recover: (msg) => push('recover', msg),
    wake: (msg) => push('wake', msg),
  };
  return { logger, lines };
}

const CLAIMED: ClaimedStep = {
  step: { id: 's1', buildId: 'conv-1', kind: 'plan', machineId: 'm1', createdAt: 1 },
  conversationId: 'conv-1',
  session: { action: 'new', sessionId: null },
  todo: { id: 't1', seqNum: 3, title: '探针任务', spec: '写一行探针' },
  project: { id: 'p1', name: 'demo', repo: null },
  agent: {
    id: 'a1',
    displayName: 'stub-builder',
    description: '职责说明',
    provider: 'stub-gw',
    modelId: 'stub-model',
    thinkingLevel: null,
  },
};

/** 长轮询假客户端：claim 挂起直到测试推入结果或 abort。 */
class FakeMachineApi implements MachineApi {
  claimQueue: (ClaimedStep | Error)[] = [];
  parked: ((v: ClaimedStep | null) => void) | null = null;
  calls: string[] = [];
  doneBodies: { stepId: string; body: MachineDoneBody }[] = [];
  uploads: { url: string; body: TranscriptUpload }[] = [];
  toolCalls: { stepId: string; call: ToolCallRecord }[] = [];
  recoverSteps: {
    id: string;
    buildId: string;
    kind: 'plan' | 'build' | 'merge';
    machineId: string | null;
    createdAt: number;
  }[] = [];
  failClaims = 0;

  async enroll(body: { teamId: string; apiKey: string; name?: string }) {
    this.calls.push(`enroll:${body.teamId}`);
    return {
      machineId: 'm1',
      token: 'a'.repeat(64),
      teamId: body.teamId,
      serverUrl: 'http://server',
    };
  }
  async me() {
    return {
      id: 'm1',
      name: 'n',
      teamId: 't1',
      online: true,
      maxConcurrent: 3,
      latestCliVersion: null,
    };
  }
  async presence() {
    this.calls.push('presence');
  }
  async recover() {
    this.calls.push('recover');
    return { steps: this.recoverSteps };
  }
  async claim(signal?: AbortSignal): Promise<ClaimedStep | null> {
    if (this.failClaims > 0) {
      this.failClaims -= 1;
      throw new Error('network down');
    }
    const next = this.claimQueue.shift();
    if (next instanceof Error) throw next;
    if (next) return next;
    return new Promise<ClaimedStep | null>((resolve, reject) => {
      this.parked = resolve;
      signal?.addEventListener('abort', () => {
        this.parked = null;
        reject(new Error('aborted'));
      });
    });
  }
  async heartbeat(stepId: string) {
    this.calls.push(`heartbeat:${stepId}`);
  }
  async tool(stepId: string, call: ToolCallRecord) {
    this.toolCalls.push({ stepId, call });
  }
  async token(stepId: string) {
    this.calls.push(`token:${stepId}`);
    return {
      provider: {
        kind: 'http' as const,
        providerId: 'stub-gw',
        baseUrl: 'http://127.0.0.1:9/v1',
        api: 'openai-completions' as const,
        authHeader: true,
        models: [{ id: 'stub-model', name: 'stub-model' }],
      },
      env: {},
      git: null,
    };
  }
  async uploadUrls(stepId: string) {
    this.calls.push(`upload-urls:${stepId}`);
    return {
      uploads: [
        { name: 'transcript.json', url: 'http://server/up/1', method: 'PUT' as const, headers: {} },
      ],
    };
  }
  async putUpload(url: string, _headers: Record<string, string>, body: TranscriptUpload) {
    this.uploads.push({ url, body });
  }
  async done(stepId: string, body: MachineDoneBody) {
    this.doneBodies.push({ stepId, body });
    this.calls.push(`done:${stepId}:${body.status}`);
    // done 后解除挂起 claim（模拟 server 无步可领）。
  }
  async stream(signal: AbortSignal, _onEvent: unknown, onConnected?: () => void) {
    onConnected?.();
    await new Promise<void>((resolve) => {
      signal.addEventListener('abort', () => resolve());
    });
  }
}

function fakeBackend(events: StepEvent[], sessionId = 'pi-sess-1') {
  const created: { opts: unknown; continued: string | null }[] = [];
  const backend: AgentBackend = {
    capabilities: PI_CAPABILITIES,
    async createSession(opts) {
      created.push({ opts, continued: null });
      return handle(sessionId, events);
    },
    async continueSession(id, opts) {
      created.push({ opts, continued: id });
      return handle(id, events);
    },
  };
  return { backend, created };
}

function handle(sessionId: string, events: StepEvent[]): AgentSessionHandle {
  return {
    sessionId,
    events: (async function* gen() {
      for (const ev of events) yield ev;
    })(),
    async steer() {},
    async stop() {},
    usage: () => [],
  };
}

async function boot(opts: {
  api?: FakeMachineApi;
  backend?: AgentBackend;
  withMachineJson?: boolean;
}) {
  const home = tmpHome();
  const { logger, lines } = captureLogger();
  const config = loadDaemonConfig(
    {
      serverUrl: 'http://server',
      apiKey: 'tds_k',
      teamId: 'team-1',
      home,
      name: 'test-mbp',
    },
    {},
  );
  const paths = statePaths(home, config.workspacesDir);
  const api = opts.api ?? new FakeMachineApi();
  const handle = await runMachine({
    config,
    paths,
    logger,
    client: api,
    backend: opts.backend ?? fakeBackend([]).backend,
    idleSleepPrevention: false,
    presenceIntervalMs: 60_000,
    claimBackoffBaseMs: 10,
    proxyEnv: {},
  });
  return { handle, api, lines, paths, home };
}

async function waitFor(fn: () => boolean, timeoutMs = 3_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('waitFor timeout');
}

describe('上线序列 canon（02 §5.4/r3 §1.5）', () => {
  test('未注册 → enroll → 全序列行序', async () => {
    const { handle, api, lines, paths } = await boot({});
    await waitFor(() => lines.some((l) => l.includes('[wake] push channel connected')));
    expect(lines[0]).toBe('Loading pi runtime…');
    expect(lines).toContain('Enrolled in team team-1 (machine m1)'); // r3 §1.2 行形
    expect(lines.some((l) => l === 'Online (machineId=m1); polling http://server')).toBe(true);
    expect(lines).toContain('[recover] no pending steps found');
    expect(lines).toContain('maxConcurrent changed null -> 3');
    expect(lines).toContain('[wake] push channel connected');
    // 行序 = canon 序（recover 在 Online 后、wake 在 maxConcurrent 后）。
    const idx = (s: string) => lines.findIndex((l) => l.includes(s));
    expect(idx('Loading pi runtime')).toBeLessThan(idx('Online (machineId'));
    expect(idx('Online (machineId')).toBeLessThan(idx('[recover]'));
    expect(idx('[recover]')).toBeLessThan(idx('maxConcurrent changed'));
    expect(idx('maxConcurrent changed')).toBeLessThan(idx('[wake] push channel connected'));
    // enroll 落 machine.json（02 §5.3）。
    expect(existsSync(paths.machineJson)).toBe(true);
    expect(JSON.parse(readFileSync(paths.machineJson, 'utf8')).machineId).toBe('m1');
    expect(api.calls[0]).toBe('enroll:team-1');
    await handle.stop();
    await handle.done;
    expect(lines).toContain('[machine] Shutting down…'); // r3 §1.5 退出行
  });
});

describe('claim 循环与退避（r3 §1.5：断网指数退避封顶 30s，进程不退出）', () => {
  test('claim 网络失败 → 退避日志（基数 10ms 时标），恢复后继续挂起领取', async () => {
    const api = new FakeMachineApi();
    api.failClaims = 2;
    const { handle, lines } = await boot({ api });
    await waitFor(() => lines.filter((l) => l.includes('claim failed')).length >= 2);
    expect(lines.some((l) => l.includes('backoff 10ms'))).toBe(true);
    expect(lines.some((l) => l.includes('backoff 20ms'))).toBe(true);
    // 第三次成功挂起（长轮询 parked）——进程不退出。
    await waitFor(() => api.parked !== null);
    await handle.stop();
    await handle.done;
  });

  test('退避序列封顶 30s（CLAIM_BACKOFF_CAP_MS = r3 §1.5 实测口径）', () => {
    const seq: number[] = [];
    let b = 1_000;
    for (let i = 0; i < 8; i++) {
      seq.push(b);
      b = nextBackoffMs(b);
    }
    expect(seq).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000, 30_000]);
  });
});

describe('步执行全链（02 §5.7 生命周期行 + journal 端点词表）', () => {
  test('claim → token → session → events → tool relay → upload → done', async () => {
    const api = new FakeMachineApi();
    const toolCall: ToolCallRecord = {
      id: 'call-1',
      name: 'edit',
      arguments: { path: 'README.md' },
      result: { ok: true },
      isError: false,
    };
    const { backend, created } = fakeBackend([
      { type: 'text_delta', text: '方案' },
      { type: 'toolcall_end', call: toolCall },
      {
        type: 'message_end',
        message: { role: 'assistant', content: [{ type: 'text', text: '方案' }] },
      },
      {
        type: 'done',
        usage: [
          { model: 'stub-gw/stub-model', input: 12, output: 980, cacheRead: 0, cacheWrite: 0 },
        ],
      },
    ]);
    const { handle, lines, paths } = await boot({ api, backend });
    await waitFor(() => api.parked !== null);
    api.parked?.(CLAIMED);
    await waitFor(() => api.doneBodies.length === 1);

    // 生命周期行序 canon（02 §5.7）。
    expect(lines).toContain('claim step=s1');
    expect(lines).toContain('step s1 for conv conv-1 (1/3 running)');
    expect(lines).toContain('using model stub-gw/stub-model');
    expect(lines).toContain('[workspace] 准备工作区...');
    expect(lines).toContain('new session conv-1');
    expect(lines).toContain('finished (0/3 running)');

    // backend 收到 SessionOpts（provider 凭证内存态 + prompt + cwd + systemPrompt）。
    const opts = created[0]?.opts as {
      prompt?: string;
      cwd: string;
      systemPrompt?: string;
      provider: { providerId: string };
      modelId: string;
    };
    expect(opts.prompt).toBe('探针任务\n\n写一行探针');
    expect(opts.systemPrompt).toBe('职责说明'); // agent.description 注入（02 §4.4 同缝）
    expect(opts.provider.providerId).toBe('stub-gw');
    expect(opts.modelId).toBe('stub-model');
    expect(opts.cwd).toBe(join(paths.workspacesDir, 'conv-1'));

    // tool live 回传 + transcript 终稿（upload-urls → PUT）+ done body。
    expect(api.toolCalls.map((t) => t.call.id)).toEqual(['call-1']);
    const upload = api.uploads[0];
    expect(upload?.url).toBe('http://server/up/1');
    const ids = upload?.body.messages.map((m) => m.id);
    expect(ids).toEqual(['user-s1', 'call-1', 'msg-s1-1']);
    expect(api.doneBodies[0]?.body).toMatchObject({
      status: 'success',
      sessionId: 'pi-sess-1',
      hasChanges: true, // edit 工具行（[推断] 骨架判定）
    });
    // journal 收尾清空。
    expect(existsSync(join(paths.outboxDir, 'step-s1.json'))).toBe(false);
    await handle.stop();
    await handle.done;
  });

  test('backend error 事件 → done failed（步级失败无自动重跑，02 §4.2）', async () => {
    const api = new FakeMachineApi();
    const { backend } = fakeBackend([
      { type: 'error', error: { message: 'invalid prompt', retryable: false } },
      { type: 'done', usage: [] },
    ]);
    const { handle } = await boot({ api, backend });
    await waitFor(() => api.parked !== null);
    api.parked?.(CLAIMED);
    await waitFor(() => api.doneBodies.length === 1);
    expect(api.doneBodies[0]?.body).toMatchObject({
      status: 'failed',
      errorMessage: 'invalid prompt',
    });
    await handle.stop();
    await handle.done;
  });
});

describe('recover 对账（02 §5.4 步 journal 恢复）', () => {
  test('server 有 claimed 步而本地无 journal → done failed（journal lost）', async () => {
    const api = new FakeMachineApi();
    api.recoverSteps = [{ id: 'ghost', buildId: 'b', kind: 'plan', machineId: 'm1', createdAt: 1 }];
    const { handle, lines } = await boot({ api });
    await waitFor(() => api.doneBodies.length === 1);
    expect(api.doneBodies[0]).toMatchObject({
      stepId: 'ghost',
      body: { status: 'failed', errorMessage: 'daemon journal lost across restart' },
    });
    expect(lines.some((l) => l.includes('[recover] 1 pending step(s) found'))).toBe(true);
    await handle.stop();
    await handle.done;
  });
});
