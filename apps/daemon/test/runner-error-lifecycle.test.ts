// runner 终态错误生命周期（#708）：根因透传 + auto_retry 有界收尾。失败方式
// 先于实现固化（票面四条 + 两条实测事件形态坑）：
//   1. 根因被收尸文案覆盖：终态错误优先级 = 真实终态错误 > 超时文案；两者并存
//      组合成文（票面例「stream timeout；根因: 400 …」），不静默丢根因。
//   2. 无限同形重试：连续零进展 auto_retry 超过预算（默认 3 = pi 自身单错
//      预算）→ 有界收尾——停会话、failed、根因直报；重试发数钉死（1+max/轮）。
//   3. 配置不生效：物化面归 pi-config-effect.test.ts（本文件只测 runner）。
//   4. 误判根因：根因只取结构化错误面（error 事件携带的 pi 错误对象消息），
//      不做字符串猜测——断言的 errorMessage 全部来自事件载荷原文。
// 事件形态坑（真 pi 流 vs #654 脚本流的差异，实测代码路径 pi 0.86.0）：
//   - 真 400 的事件序 = message_end(assistant, stopReason=error) + error +
//     agent_end(willRetry=false) → done；#654 脚本只喂 error 时，
//     sawProgress / sawDone 两处闭锁会让回落闸在真流上永不开启——本文件
//     用真形态脚本钉住回落闸对真 400 开闸。

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  AgentBackend,
  AgentSessionHandle,
  ClaimedStep,
  MachineDoneBody,
  MachineStreamEvent,
  ProviderConfig,
  SessionOpts,
  StepEvent,
  ToolCallRecord,
  TranscriptUpload,
} from '@pacman/shared';
import { describe, expect, test } from 'vitest';
import { adaptProviderCompat, PI_CAPABILITIES } from '../src/backend/pi.js';
import { StepJournal } from '../src/journal.js';
import type { DaemonLogger } from '../src/log.js';
import type { MachineApi } from '../src/machine-client.js';
import { combineTimeoutWithRootCause, RETRY_STORM_MAX, runStep } from '../src/runner.js';
import { statePaths } from '../src/state.js';

const RELAY_400 = '400: {"message":"Model does not support this protocol.","type":"server_error"}';
const TRANSIENT_503 = '503: service unavailable';

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

function claimedBuildStep(): ClaimedStep {
  return {
    step: { id: 's1', buildId: 'conv-1', kind: 'build', machineId: 'm1', createdAt: 1 },
    conversationId: 'conv-1',
    session: { action: 'new', sessionId: null },
    todo: { id: 't1', seqNum: 3, title: '生命周期探针', spec: '写一行探针' },
    project: { id: 'p1', name: 'demo', repo: null },
    agent: {
      id: 'a1',
      displayName: 'stub-builder',
      description: null,
      provider: null,
      modelId: 'stub-model',
      thinkingLevel: null,
    },
  };
}

class FakeClient implements MachineApi {
  doneBodies: { stepId: string; body: MachineDoneBody }[] = [];
  uploadNames: string[][] = [];

  constructor(private readonly providerId: string) {}

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
    return {
      provider: {
        kind: 'http' as const,
        providerId: this.providerId,
        baseUrl: 'http://127.0.0.1:9/v1',
        api: 'openai-completions' as const,
        authHeader: true,
        models: [{ id: 'stub-model', name: 'stub-model' }],
      },
      secrets: {},
      git: null,
    };
  }
  async skills() {
    return { skills: [] };
  }
  async uploadUrls(_stepId: string, files: { name: string }[]) {
    this.uploadNames.push(files.map((f) => f.name));
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
  async syncResult() {}
  async attachment(): Promise<never> {
    throw new Error('unused');
  }
  async shellPrecheck(): Promise<never> {
    throw new Error('unused');
  }
  async shellResult(): Promise<void> {}
  async stream(_signal: AbortSignal, _onEvent: (ev: MachineStreamEvent) => void) {}
}

/** 会话脚本（StepEvent 序列；真形态 = message_end 带 stopReason）。stop() 经
 * gate 立即终止生成器（真 handle.stop() 中断事件流语义同形）；counts.autoRetries
 * = 实际送达 runner 的 auto_retry_start 事件数（发数上界的对账面；引用计数
 * 对象——生成器闭包内递增，用例收尾时读）。 */
function scriptedStormBackend(scripts: StepEvent[][]): {
  backend: AgentBackend;
  providers: (ProviderConfig | null | undefined)[];
  counts: { autoRetries: number };
} {
  const providers: (ProviderConfig | null | undefined)[] = [];
  const counts = { autoRetries: 0 };
  const backend: AgentBackend = {
    capabilities: PI_CAPABILITIES,
    async createSession(sessionOpts: SessionOpts): Promise<AgentSessionHandle> {
      const idx = providers.length;
      providers[idx] = sessionOpts.provider;
      const script = scripts[idx] ?? [{ type: 'done', usage: [] }];
      let stopped = false;
      return {
        sessionId: `pi-sess-lc-${idx}`,
        events: (async function* () {
          for (const ev of script) {
            if (stopped) return;
            if (ev.type === 'auto_retry_start') counts.autoRetries += 1;
            yield ev;
          }
        })(),
        async steer() {},
        async stop() {
          stopped = true;
        },
        usage: () => [],
      };
    },
    async continueSession() {
      throw new Error('unused');
    },
    adaptProviderCompat: (provider: ProviderConfig, errorMessage: string) =>
      adaptProviderCompat(provider, errorMessage),
  };
  return { backend, providers, counts };
}

/** 真形态会话开面前缀（verify 栈实测事件序，#708）：pi 每会话必发
 * system prompt 回声（message_end role=system）+ 任务文本 user 回声。 */
function sessionOpenEcho(): StepEvent[] {
  return [
    { type: 'message_end', message: { role: 'system', content: 'you are a builder' } },
    { type: 'message_end', message: { role: 'user', content: '写一行探针' } },
  ];
}

/** 真形态错误循环脚本：开面回声 + n × [message_end(assistant error) + error +
 * auto_retry]。 */
function errorCycles(
  n: number,
  message: string,
  opts?: { retryable?: boolean; progress?: string; attempts?: number[] },
): StepEvent[] {
  const out: StepEvent[] = sessionOpenEcho();
  for (let i = 0; i < n; i++) {
    out.push({
      type: 'message_end',
      message: { role: 'assistant', content: '', stopReason: 'error' },
    });
    out.push({ type: 'error', error: { message, retryable: opts?.retryable ?? true } });
    out.push({
      type: 'auto_retry_start',
      attempt: opts?.attempts?.[i] ?? 1,
    });
    if (opts?.progress !== undefined) {
      out.push({ type: 'text_delta', text: opts.progress });
    }
  }
  return out;
}

async function runLifecycleCase(
  scripts: StepEvent[][],
  opts?: { providerId?: string; retryStormMax?: number },
) {
  const providerId = opts?.providerId ?? 'gw-lc';
  const home = mkdtempSync(join(tmpdir(), 'pacman-runner-lc-'));
  const paths = statePaths(home, join(home, 'workspaces'));
  const { logger, lines } = captureLogger();
  const client = new FakeClient(providerId);
  const journal = new StepJournal(paths.outboxDir);
  const { backend, providers, counts } = scriptedStormBackend(scripts);
  const deps = {
    client,
    journal,
    backendFor: () => backend,
    logger,
    paths,
    workspacesDir: join(home, 'workspaces'),
    mcpConfigPath: join(home, 'claude.json'),
    heartbeatIntervalMs: 60_000,
  };
  await runStep(deps, claimedBuildStep(), {
    ...(opts?.retryStormMax !== undefined ? { retryStormMax: opts.retryStormMax } : {}),
  });
  return { client, lines, providers, autoRetries: counts.autoRetries };
}

// —— 失败方式 1：超时文案与根因组合（纯函数；组合点 = 超时收尾行）——————

describe('combineTimeoutWithRootCause（超时收尸 + 根因组合）', () => {
  test('并存 → 组合成文（票面例「stream timeout；根因: 400 …」），不丢根因', () => {
    const out = combineTimeoutWithRootCause(
      'stream timeout (first=300000ms idle=480000ms)',
      RELAY_400,
    );
    expect(out).toBe(`stream timeout (first=300000ms idle=480000ms)；根因: ${RELAY_400}`);
  });

  test('无根因 → 纯超时文案（零回归：超时但无底层错误的旧形态）', () => {
    expect(combineTimeoutWithRootCause('stream timeout (first=1ms idle=2ms)', null)).toBe(
      'stream timeout (first=1ms idle=2ms)',
    );
  });
});

// —— 失败方式 2：auto_retry 有界生命周期（runner 集成）——————————————

describe('runner auto_retry 生命周期（#708）', () => {
  // 学习面是模块级 Map：每个用例独立 providerId 隔离（pi-protocol-fallback 同律）。

  test('storm：非签名可重试错 → 连续零进展超预算即收，发数 = 1+max，根因直报', async () => {
    const { client, lines, providers, autoRetries } = await runLifecycleCase(
      [errorCycles(10, TRANSIENT_503)],
      { providerId: 'gw-lc-storm' },
    );
    expect(providers).toHaveLength(1); // 非签名错：无回落轮
    expect(autoRetries).toBe(RETRY_STORM_MAX + 1); // 发数钉死：预算内 3 发 + 触发即停
    expect(client.doneBodies[0]?.body.status).toBe('failed');
    expect(client.doneBodies[0]?.body.errorMessage).toBe(TRANSIENT_503);
    expect(lines.some((l) => l.includes('retry storm'))).toBe(true);
  });

  test('storm：签名错 → 回落轮翻旋钮，二度 storm → failed 根因（两会话，每轮发数 1+max）', async () => {
    const { client, providers, autoRetries } = await runLifecycleCase(
      [errorCycles(10, RELAY_400), errorCycles(10, RELAY_400)],
      { providerId: 'gw-lc-sig' },
    );
    expect(providers).toHaveLength(2); // #654 回落闸在 storm 收尾后仍开
    expect(providers[1]?.compat).toEqual({
      maxTokensField: 'max_tokens',
      supportsStore: false,
    });
    expect(autoRetries).toBe((RETRY_STORM_MAX + 1) * 2);
    expect(client.doneBodies[0]?.body.status).toBe('failed');
    expect(client.doneBodies[0]?.body.errorMessage).toBe(RELAY_400);
  });

  test('storm 边界：pi 自身预算 3 次退场（run8 连接错形）→ 不触发 storm，failed 根因', async () => {
    const script: StepEvent[] = [
      ...errorCycles(3, 'connection error', { attempts: [1, 2, 3] }),
      { type: 'message_end', message: { role: 'assistant', content: '', stopReason: 'error' } },
      { type: 'error', error: { message: 'connection error', retryable: true } },
      { type: 'done', usage: [] },
    ];
    const { client, lines, autoRetries } = await runLifecycleCase([script], {
      providerId: 'gw-lc-budget',
    });
    expect(autoRetries).toBe(3);
    expect(lines.some((l) => l.includes('retry storm'))).toBe(false);
    expect(client.doneBodies[0]?.body.status).toBe('failed');
    expect(client.doneBodies[0]?.body.errorMessage).toBe('connection error');
  });

  test('progress 重置计数：错误与进展交替 → 不触发 storm，步 success', async () => {
    const script: StepEvent[] = [
      ...errorCycles(6, TRANSIENT_503, { progress: '写了一行' }),
      { type: 'done', usage: [] },
    ];
    const { client, lines } = await runLifecycleCase([script], {
      providerId: 'gw-lc-progress',
    });
    expect(lines.some((l) => l.includes('retry storm'))).toBe(false);
    expect(client.doneBodies[0]?.body.status).toBe('success');
  });

  test('预算可注入：retryStormMax=1 → 第 2 发即收（发数 = 1+1）', async () => {
    const { client, autoRetries } = await runLifecycleCase([errorCycles(10, TRANSIENT_503)], {
      providerId: 'gw-lc-tight',
      retryStormMax: 1,
    });
    expect(autoRetries).toBe(2);
    expect(client.doneBodies[0]?.body.status).toBe('failed');
    expect(client.doneBodies[0]?.body.errorMessage).toBe(TRANSIENT_503);
  });
});

// —— 真形态 400 事件序（#654 回落闸对真流开闸）———————————————————

describe('真 pi 事件形态：message_end(stopReason=error) + error + done', () => {
  test('run9 形（非重试 400 带 body）：回落闸开——message_end(error) 不算进展，done 不闭锁', async () => {
    const script: StepEvent[] = [
      ...sessionOpenEcho(),
      { type: 'message_end', message: { role: 'assistant', content: '', stopReason: 'error' } },
      { type: 'error', error: { message: RELAY_400, retryable: false } },
      { type: 'done', usage: [] },
    ];
    const pass2: StepEvent[] = [
      ...sessionOpenEcho(),
      { type: 'text_delta', text: 'ok' },
      { type: 'done', usage: [] },
    ];
    const { client, providers } = await runLifecycleCase([script, pass2], {
      providerId: 'gw-lc-realshape',
    });
    expect(providers).toHaveLength(2);
    expect(providers[1]?.compat).toEqual({
      maxTokensField: 'max_tokens',
      supportsStore: false,
    });
    expect(client.doneBodies[0]?.body.status).toBe('success');
  });
});
