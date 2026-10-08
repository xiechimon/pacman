// 机器主循环（02 §5.4 上线序列 canon + claim 退避 + recover 对账 + 步执行
// 全链，fake MachineApi/fake AgentBackend 注入——pi 真执行面归 integration）。

import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  AgentBackend,
  AgentSessionHandle,
  ClaimedStep,
  DeliveredImage,
  MachineAttachmentResponse,
  MachineDoneBody,
  MachineStreamEvent,
  StepEvent,
  ToolCallRecord,
  TranscriptUpload,
} from '@pacman/shared';
import { formatAttachmentToken } from '@pacman/shared';
import { describe, expect, test } from 'vitest';
import { PI_CAPABILITIES } from '../src/backend/pi.js';
import type { ClaudeCodeAuthProbe } from '../src/claude-code-auth.js';
import { loadDaemonConfig } from '../src/config.js';
import { type DaemonLogger, formatLine } from '../src/log.js';
import type { MachineApi } from '../src/machine-client.js';
import { nextBackoffMs, runMachine } from '../src/machine-loop.js';
import { ensureStateDirs, saveMachineJson, statePaths } from '../src/state.js';

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
    mcp: (msg) => push('mcp', msg),
    skills: (msg) => push('skills', msg),
    gate: (msg) => push('gate', msg),
    trust: (msg) => push('trust', msg),
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
  /** W3 steer 拉取-确认的 fake 面：可设的拉取响应 + 事件发射口（stream
   * 回调被记录，测试直接注入 steer 事件模拟 server 信号）。 */
  steerResponse: string | null = null;
  /** #730 图片附件下载 fake 面：id → 响应或 Error。 */
  attachments: Record<string, MachineAttachmentResponse | Error> = {};
  attachmentCalls: string[] = [];
  /** M7 #308 stop 拉取-确认的 fake 面（steer 同形：可设响应 = discard 位）。 */
  stopResponse: boolean | null = null;
  onStreamEvent: ((ev: MachineStreamEvent) => void) | null = null;
  /** claim 请求计数（#482：wake 事件不得引发在飞 claim 中断重发）。 */
  claimCalls = 0;

  enrollBodies: unknown[] = [];
  presenceBodies: unknown[] = [];

  async enroll(body: { teamId: string; apiKey: string; name?: string; claudeCode?: unknown }) {
    this.calls.push(`enroll:${body.teamId}`);
    this.enrollBodies.push(body);
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
      latestCliVersion: null,
      kind: 'remote' as const,
      enabledRuntimes: [],
      shellEnabled: false,
    };
  }
  async presence(body?: { cliVersion?: string; claudeCode?: unknown }) {
    this.calls.push('presence');
    this.presenceBodies.push(body);
  }
  async recover() {
    this.calls.push('recover');
    return { steps: this.recoverSteps };
  }
  async claim(signal?: AbortSignal): Promise<ClaimedStep | null> {
    this.claimCalls += 1;
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
  async transcriptDelta(stepId: string, text: string) {
    this.calls.push(`transcriptDelta:${stepId}:${text.length}`);
  }
  async relayTool(stepId: string, name: string, params: Record<string, unknown>) {
    this.calls.push(`relayTool:${stepId}:${name}`);
    void params;
    return '{}';
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
      secrets: {},
      git: null,
    };
  }
  async skillsManifest() {
    // #920：默认空清单 = 零团队技能（selection=whitelist，既有断言零扰动）。
    return { selection: 'whitelist' as const, skills: [] };
  }
  async skillFile(): Promise<Buffer> {
    throw new Error('unexpected skillFile call');
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
  async stream(signal: AbortSignal, onEvent: unknown, onConnected?: () => void) {
    this.onStreamEvent = onEvent as (ev: MachineStreamEvent) => void;
    onConnected?.();
    await new Promise<void>((resolve) => {
      signal.addEventListener('abort', () => resolve());
    });
  }
  async steer(stepId: string) {
    this.calls.push(`steer:${stepId}`);
    return this.steerResponse;
  }
  async attachment(stepId: string, attachmentId: string): Promise<MachineAttachmentResponse> {
    this.attachmentCalls.push(`${stepId}:${attachmentId}`);
    const hit = this.attachments[attachmentId];
    if (hit === undefined) throw new Error(`machine api 404: attachment ${attachmentId}`);
    if (hit instanceof Error) throw hit;
    return hit;
  }
  async stop(stepId: string) {
    this.calls.push(`stop:${stepId}`);
    return this.stopResponse;
  }
  async syncResult(syncId: string, body: { status: string; errorMessage?: string }) {
    this.calls.push(`syncResult:${syncId}:${body.status}`);
  }
  async shellPrecheck(): Promise<never> {
    throw new Error('unused');
  }
  async shellResult(): Promise<void> {}
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
  /** spec 17 A3：claude-code 后端测试注入面（缺省 = 首个 runtime 步惰性构造）。 */
  claudeCodeBackend?: AgentBackend;
  /** #867 T6：凭据预检注入面（缺省 = 已登录桩）。 */
  claudeCodeAuthProbe?: () => Promise<ClaudeCodeAuthProbe>;
  withMachineJson?: boolean;
  /** 预置 machine.json（既有注册启动路径）：serverUrl 可指向旧 server。 */
  preEnrolled?: { serverUrl: string };
}) {
  const home = tmpHome();
  const { logger, lines } = captureLogger();
  const config = loadDaemonConfig(
    {
      serverUrl: 'http://server',
      apiKey: 'pacman_k',
      teamId: 'team-1',
      home,
      name: 'test-mbp',
    },
    {},
  );
  const paths = statePaths(home, config.workspacesDir);
  if (opts.preEnrolled) {
    ensureStateDirs(paths);
    saveMachineJson(paths, {
      machineId: 'm-old',
      token: 'b'.repeat(64),
      teamId: 'team-1',
      serverUrl: opts.preEnrolled.serverUrl,
    });
  }
  const api = opts.api ?? new FakeMachineApi();
  const handle = await runMachine({
    config,
    paths,
    logger,
    client: api,
    backend: opts.backend ?? fakeBackend([]).backend,
    claudeCodeBackend: opts.claudeCodeBackend,
    // #867 T6：runtime 步先过机器本地凭据预检——缺省真探针在 CI（无 claude
    // 登录）会探成「未登录」把 runtime 步拦掉，故测试恒注已登录桩。
    claudeCodeAuthProbe:
      opts.claudeCodeAuthProbe ??
      (async () => ({ state: 'logged-in', method: 'oauth_token', provider: 'firstParty' })),
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
    expect(lines).toContain('[wake] push channel connected');
    // 行序 = canon 序（recover 在 Online 后、wake 在 recover 后）。
    const idx = (s: string) => lines.findIndex((l) => l.includes(s));
    expect(idx('Loading pi runtime')).toBeLessThan(idx('Online (machineId'));
    expect(idx('Online (machineId')).toBeLessThan(idx('[recover]'));
    expect(idx('[recover]')).toBeLessThan(idx('[wake] push channel connected'));
    // enroll 落 machine.json（02 §5.3）。
    expect(existsSync(paths.machineJson)).toBe(true);
    expect(JSON.parse(readFileSync(paths.machineJson, 'utf8')).machineId).toBe('m1');
    expect(api.calls[0]).toBe('enroll:team-1');
    // #707：enroll 即带本机模型上报（installed/hostname/models 形状不断言
    // 内容——读的是测试机真实 ~/.claude，只钉上报动作与形状）。
    const enrollBody = api.enrollBodies[0] as { claudeCode?: unknown };
    const report = enrollBody.claudeCode as {
      installed: boolean;
      hostname: string;
      models: unknown[];
    };
    expect(typeof report.installed).toBe('boolean');
    expect(typeof report.hostname).toBe('string');
    expect(report.hostname).not.toBe('');
    expect(Array.isArray(report.models)).toBe(true);
    // presence 首跳同样带上报。
    await waitFor(() => api.presenceBodies.length > 0);
    expect((api.presenceBodies[0] as { claudeCode?: unknown }).claudeCode !== undefined).toBe(true);
    await handle.stop();
    await handle.done;
    expect(lines).toContain('[machine] Shutting down…'); // r3 §1.5 退出行
  });

  test('stop(cause) 退出行带原因后缀（#691：信号名可考）', async () => {
    const { handle, lines } = await boot({});
    await waitFor(() => lines.some((l) => l.includes('[wake] push channel connected')));
    await handle.stop('SIGTERM');
    await handle.done;
    expect(lines).toContain('[machine] Shutting down… (SIGTERM)');
  });
});

describe('server 迁移诊断（#519 控制面搬家：machine.json 注册时 serverUrl 与现配置不一致）', () => {
  test('失败方式：旧 machine.json + 新 PACMAN_SERVER → 启动即警告行（含两地址与再注册指引），照常上线', async () => {
    const api = new FakeMachineApi();
    const { handle, lines } = await boot({
      api,
      preEnrolled: { serverUrl: 'http://old-host:8787' },
    });
    await waitFor(() =>
      lines.some((l) => l.includes('Online (machineId=m-old); polling http://server')),
    );
    // 警告行：[machine] 前缀、含新旧两个地址、含 re-enroll 指引。
    const warn = lines.find((l) => l.includes('[machine]') && l.includes('re-enroll'));
    expect(warn).toBeDefined();
    expect(warn).toContain('http://old-host:8787');
    expect(warn).toContain('http://server');
    // 既有注册被沿用（不重复 enroll），轮询继续走配置地址。
    expect(api.calls).not.toContain('enroll:team-1');
    await handle.stop();
    await handle.done;
  });

  test('一致（或未注册）→ 无该警告行', async () => {
    const api = new FakeMachineApi();
    const { handle, lines } = await boot({ api, preEnrolled: { serverUrl: 'http://server' } });
    await waitFor(() => lines.some((l) => l.includes('Online (machineId=m-old)')));
    expect(lines.some((l) => l.includes('re-enroll'))).toBe(false);
    await handle.stop();
    await handle.done;
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

describe('wake SSE 与在飞 claim（#482 裁定：客户端不消费 wake，低延迟派发归 server 侧 hold 直解）', () => {
  // 失败方式枚举（裁定依据，详 PR body）：server wake() 同轮既推 SSE 又直解
  // claim 等待者——SSE 可能先于 claim 响应到达；若客户端 abort 在飞 claim，
  // server 第二次 tryClaim 已把 step 落库 claimed 写向死 socket = 孤儿步。
  // 本测试钉住裁定：wake 事件对在飞 claim 零作用；若有人重新接线客户端
  // wake-abort，此处红。
  test('wake 事件到达时在飞 claim 不中断不重发——挂起保持，随后照常领步', async () => {
    const api = new FakeMachineApi();
    const { backend } = fakeBackend([{ type: 'done', usage: [] }]);
    const { handle, lines } = await boot({ api, backend });
    await waitFor(() => api.parked !== null); // claim 长轮询挂起（server hold 中）
    const callsBefore = api.claimCalls;

    api.onStreamEvent?.({ type: 'wake' });
    await new Promise((r) => setTimeout(r, 50)); // 给潜在 abort→重发链路留时标

    // 在飞 claim 未被中断：仍挂起、无重发、无退避日志。
    expect(api.parked).not.toBeNull();
    expect(api.claimCalls).toBe(callsBefore);
    expect(lines.some((l) => l.includes('claim failed'))).toBe(false);

    // 挂起的 claim 仍能照常收步执行（server 直解路径的客户端终点）。
    api.parked?.(CLAIMED);
    await waitFor(() => api.doneBodies.length === 1);
    expect(api.doneBodies[0]?.body.status).toBe('success');
    await handle.stop();
    await handle.done;
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
    expect(lines).toContain('step s1 for conv conv-1 (1 running)');
    expect(lines).toContain('using model stub-gw/stub-model');
    expect(lines).toContain('[workspace] 准备工作区...');
    expect(lines).toContain('new session conv-1');
    expect(lines).toContain('finished (0 running)');

    // backend 收到 SessionOpts（provider 凭证内存态 + prompt + cwd + systemPrompt）。
    const opts = created[0]?.opts as {
      prompt?: string;
      cwd: string;
      systemPrompt?: string;
      provider: { providerId: string };
      modelId: string;
    };
    expect(opts.prompt).toBe('探针任务\n\n写一行探针');
    // agent.description 注入（02 §4.4 同缝）+ spec 15 #394 元信息回填指令块
    // （todo 语境步注入,词表 = FIXED_TAGS 单源）。
    expect(opts.systemPrompt).toContain('职责说明');
    expect(opts.systemPrompt).toContain('set_task_meta');
    expect(opts.systemPrompt).toContain('bug');
    expect(opts.provider.providerId).toBe('stub-gw');
    expect(opts.modelId).toBe('stub-model');
    expect(opts.cwd).toBe(join(paths.workspacesDir, 'conv-1'));

    // tool live 回传 + transcript 终稿（upload-urls → PUT）+ done body。
    expect(api.toolCalls.map((t) => t.call.id)).toEqual(['call-1']);
    const upload = api.uploads[0];
    expect(upload?.url).toBe('http://server/up/1');
    const ids = upload?.body.messages.map((m) => m.id);
    // #955 段序：正文段先落、工具行随后——封口在工具到达那一刻发生，段行必须
    // 排在它之后的工具行**之前**（否则流式期工具会显示在自己前导文本的上方）。
    expect(ids).toEqual(['user-s1', 'msg-s1-1', 'call-1']);
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

  test('skillsAllowlist 透传（#372）：worker 步 = agent.skills（含 []）；chief 步不传', async () => {
    // worker 步：勾选 slug 原样进 SessionOpts.skillsAllowlist；空勾选传 []
    // （[] = 不注入任何 skill，缺省才是全量——两态不得混淆）。
    for (const skills of [['alpha', 'beta'], []] as string[][]) {
      const api = new FakeMachineApi();
      const { backend, created } = fakeBackend([{ type: 'done', usage: [] }]);
      const { handle } = await boot({ api, backend });
      await waitFor(() => api.parked !== null);
      api.parked?.({
        ...CLAIMED,
        agent: { ...CLAIMED.agent!, skills },
      });
      await waitFor(() => api.doneBodies.length === 1);
      const opts = created[0]?.opts as { skillsAllowlist?: string[] };
      expect(opts.skillsAllowlist).toEqual(skills);
      await handle.stop();
      await handle.done;
    }

    // worker 步 claim 未携带 skills（旧 server）= 缺省不传（全量直通，零回归）。
    {
      const api = new FakeMachineApi();
      const { backend, created } = fakeBackend([{ type: 'done', usage: [] }]);
      const { handle } = await boot({ api, backend });
      await waitFor(() => api.parked !== null);
      api.parked?.(CLAIMED);
      await waitFor(() => api.doneBodies.length === 1);
      const opts = created[0]?.opts as { skillsAllowlist?: string[] };
      expect(opts.skillsAllowlist).toBeUndefined();
      await handle.stop();
      await handle.done;
    }

    // chief 步：绑定 Agent 即使带 skills 也不传——chief 是信任面，全量 catalog。
    {
      const api = new FakeMachineApi();
      const { backend, created } = fakeBackend([{ type: 'done', usage: [] }]);
      const { handle } = await boot({ api, backend });
      await waitFor(() => api.parked !== null);
      api.parked?.({
        ...CLAIMED,
        step: { ...CLAIMED.step, kind: 'chief' as const },
        conversationId: 'chief-t1',
        agent: { ...CLAIMED.agent!, skills: ['alpha'] },
        chief: { threadId: 't1', systemPrompt: '总管 charter', trigger: 'user' as const },
      });
      await waitFor(() => api.doneBodies.length === 1);
      const opts = created[0]?.opts as { skillsAllowlist?: string[] };
      expect(opts.skillsAllowlist).toBeUndefined();
      await handle.stop();
      await handle.done;
    }
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

describe('steer 投递（W3 #279：事件 → 拉取-确认 → AgentSessionHandle.steer）', () => {
  /** 门控 handle：首事件后停住（步「在跑」），release 后 done 收尾。 */
  function gatedBackend(steered: string[]) {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const backend: AgentBackend = {
      capabilities: PI_CAPABILITIES,
      async createSession() {
        return {
          sessionId: 'pi-sess-steer',
          events: (async function* () {
            yield { type: 'text_delta', text: '跑着' } as StepEvent;
            await gate;
            yield { type: 'done', usage: [] } as StepEvent;
          })(),
          async steer(text: string) {
            steered.push(text);
          },
          async stop() {},
          usage: () => [],
        };
      },
      async continueSession() {
        throw new Error('unused in steer tests');
      },
    };
    return { backend, release };
  }

  test('steer 事件 → 拉取-确认 → 在跑 session 的 handle.steer(text)', async () => {
    const api = new FakeMachineApi();
    api.steerResponse = '顺便把测试也补上';
    const steered: string[] = [];
    const { backend, release } = gatedBackend(steered);
    const { handle, lines } = await boot({ api, backend });
    await waitFor(() => api.parked !== null);
    api.parked?.(CLAIMED);
    await waitFor(() => lines.some((l) => l.includes('new session conv-1')));
    api.onStreamEvent?.({ type: 'steer', stepId: 's1' });
    await waitFor(() => steered.length === 1);
    expect(steered).toEqual(['顺便把测试也补上']);
    expect(api.calls).toContain('steer:s1');
    release();
    await handle.stop();
    await handle.done;
  });

  test('失败方式：拉取空（server 门拒/旧步丢弃）→ 不 steer 不炸', async () => {
    const api = new FakeMachineApi();
    api.steerResponse = null;
    const steered: string[] = [];
    const { backend, release } = gatedBackend(steered);
    const { handle, lines } = await boot({ api, backend });
    await waitFor(() => api.parked !== null);
    api.parked?.(CLAIMED);
    await waitFor(() => lines.some((l) => l.includes('new session conv-1')));
    api.onStreamEvent?.({ type: 'steer', stepId: 's1' });
    await waitFor(() => api.calls.includes('steer:s1'));
    await new Promise((r) => setTimeout(r, 50));
    expect(steered).toEqual([]);
    release();
    await handle.stop();
    await handle.done;
  });

  test('steer 文本携带整行图片 token → 解析下载 → handle.steer(展开文本, images)（#730）', async () => {
    const api = new FakeMachineApi();
    const png = Buffer.from('89504e470d0a1a0a', 'hex');
    api.attachments.id1 = {
      fileName: 'shot.png',
      mimeType: 'image/png',
      sizeBytes: png.byteLength,
      contentBase64: png.toString('base64'),
    };
    const token = formatAttachmentToken('shot.png', 't1/id1.png');
    api.steerResponse = `补一张图\n\n${token}`;
    const steered: { text: string; images?: readonly DeliveredImage[] }[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const backend: AgentBackend = {
      capabilities: PI_CAPABILITIES,
      async createSession() {
        return {
          sessionId: 'pi-sess-steer-img',
          events: (async function* () {
            yield { type: 'text_delta', text: '跑着' } as StepEvent;
            await gate;
            yield { type: 'done', usage: [] } as StepEvent;
          })(),
          async steer(text: string, images?: readonly DeliveredImage[]) {
            steered.push({ text, images });
          },
          async stop() {},
          usage: () => [],
        };
      },
      async continueSession() {
        throw new Error('unused');
      },
    };
    const { handle, lines } = await boot({ api, backend });
    await waitFor(() => api.parked !== null);
    api.parked?.(CLAIMED);
    await waitFor(() => lines.some((l) => l.includes('new session conv-1')));
    api.onStreamEvent?.({ type: 'steer', stepId: 's1' });
    await waitFor(() => steered.length === 1);
    expect(steered[0]!.text).toContain('[image attached: shot.png]');
    expect(steered[0]!.text).not.toContain('attachment:t1/id1.png');
    expect(steered[0]!.images).toEqual([{ data: png.toString('base64'), mimeType: 'image/png' }]);
    expect(api.attachmentCalls).toEqual(['s1:id1']);
    release();
    await handle.stop();
    await handle.done;
  });

  test('失败方式（#730 先判活再下载）：无在跑 handle → 拉取后即丢，不白下字节', async () => {
    const api = new FakeMachineApi();
    const token = formatAttachmentToken('shot.png', 't1/id1.png');
    api.steerResponse = `补一张图\n\n${token}`;
    api.attachments.id1 = {
      fileName: 'shot.png',
      mimeType: 'image/png',
      sizeBytes: 4,
      contentBase64: 'AAAA',
    };
    const steered: { text: string; images?: readonly DeliveredImage[] }[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const backend: AgentBackend = {
      capabilities: PI_CAPABILITIES,
      async createSession() {
        return {
          sessionId: 'pi-sess-steer-dead',
          events: (async function* () {
            yield { type: 'text_delta', text: '跑着' } as StepEvent;
            await gate;
            yield { type: 'done', usage: [] } as StepEvent;
          })(),
          async steer(text: string, images?: readonly DeliveredImage[]) {
            steered.push({ text, images });
          },
          async stop() {},
          usage: () => [],
        };
      },
      async continueSession() {
        throw new Error('unused');
      },
    };
    const { handle, lines } = await boot({ api, backend });
    await waitFor(() => api.parked !== null);
    api.parked?.(CLAIMED);
    await waitFor(() => lines.some((l) => l.includes('new session conv-1')));
    release();
    await waitFor(() => api.doneBodies.length === 1); // 步收尾，handle 已注销
    api.onStreamEvent?.({ type: 'steer', stepId: 's1' });
    await waitFor(() => lines.some((l) => l.includes('steer dropped (no live session)')));
    expect(api.attachmentCalls).toHaveLength(0); // 先判活：一字节都没下
    expect(steered).toHaveLength(0);
    await handle.stop();
    await handle.done;
  });

  test('失败方式（#730 步不崩）：steer 里的图片下载 409 → 注记入 steer 文本、零图片、循环存活', async () => {
    const api = new FakeMachineApi();
    const token = formatAttachmentToken('shot.png', 't1/id1.png');
    api.steerResponse = `补一张图\n\n${token}`;
    api.attachments.id1 = new Error('machine api 409: attachment id1 not ready (pending)');
    const steered: { text: string; images?: readonly DeliveredImage[] }[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const backend: AgentBackend = {
      capabilities: PI_CAPABILITIES,
      async createSession() {
        return {
          sessionId: 'pi-sess-steer-fail',
          events: (async function* () {
            yield { type: 'text_delta', text: '跑着' } as StepEvent;
            await gate;
            yield { type: 'done', usage: [] } as StepEvent;
          })(),
          async steer(text: string, images?: readonly DeliveredImage[]) {
            steered.push({ text, images });
          },
          async stop() {},
          usage: () => [],
        };
      },
      async continueSession() {
        throw new Error('unused');
      },
    };
    const { handle, lines } = await boot({ api, backend });
    await waitFor(() => api.parked !== null);
    api.parked?.(CLAIMED);
    await waitFor(() => lines.some((l) => l.includes('new session conv-1')));
    api.onStreamEvent?.({ type: 'steer', stepId: 's1' });
    await waitFor(() => steered.length === 1);
    expect(steered[0]!.text).toContain(token); // token 原样保留
    expect(steered[0]!.text).toContain('不可用');
    expect(steered[0]!.images ?? []).toHaveLength(0);
    release();
    await handle.stop();
    await handle.done;
  });

  test('失败方式：步收尾后无在跑 handle → 拉取成功也丢弃不炸（日志行 + 循环存活）', async () => {
    const api = new FakeMachineApi();
    api.steerResponse = '晚到的补充';
    const steered: string[] = [];
    const { backend, release } = gatedBackend(steered);
    const { handle, lines } = await boot({ api, backend });
    await waitFor(() => api.parked !== null);
    api.parked?.(CLAIMED);
    await waitFor(() => lines.some((l) => l.includes('new session conv-1')));
    release();
    await waitFor(() => api.doneBodies.length === 1); // 步收尾，handle 已注销
    api.onStreamEvent?.({ type: 'steer', stepId: 's1' });
    await waitFor(() => lines.some((l) => l.includes('steer dropped (no live session)')));
    expect(steered).toEqual([]);
    await handle.stop();
    await handle.done;
  });
});

describe('stop 投递（M7 #308：事件 → 拉取-确认 → AgentSessionHandle.stop → done(stopped)）', () => {
  /** 门控 handle（pi abort 语义同形）：首事件后停住；stop() 结束事件流
   * （不产 done 事件——PiSessionHandle.stop = abort + queue.end 的对偶）；
   * release() = 自然完成（done 事件）。 */
  function stoppableBackend(probe: { stopCalls: number }) {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    let stopped = false;
    const backend: AgentBackend = {
      capabilities: PI_CAPABILITIES,
      async createSession() {
        return {
          sessionId: 'pi-sess-stop',
          events: (async function* () {
            yield { type: 'text_delta', text: '跑着' } as StepEvent;
            await gate;
            if (!stopped) yield { type: 'done', usage: [] } as StepEvent;
          })(),
          async steer() {},
          async stop() {
            probe.stopCalls += 1;
            stopped = true;
            release();
          },
          usage: () => [],
        };
      },
      async continueSession() {
        throw new Error('unused in stop tests');
      },
    };
    return { backend, release };
  }

  test('stop 事件 → 拉取-确认 → live.stop() → done(stopped) 回报 + transcript 上传保留', async () => {
    const api = new FakeMachineApi();
    api.stopResponse = true;
    const probe = { stopCalls: 0 };
    const { backend } = stoppableBackend(probe);
    const { handle, lines } = await boot({ api, backend });
    await waitFor(() => api.parked !== null);
    api.parked?.(CLAIMED);
    await waitFor(() => lines.some((l) => l.includes('new session conv-1')));
    api.onStreamEvent?.({ type: 'stop', stepId: 's1' });
    await waitFor(() => api.doneBodies.length === 1);
    expect(probe.stopCalls).toBe(1);
    expect(api.calls).toContain('stop:s1');
    expect(api.doneBodies[0]?.body.status).toBe('stopped');
    expect(lines.some((l) => l.includes('stop delivered step=s1'))).toBe(true);
    // 部分 transcript 保留（终稿上传照走——运行行「已取消」但过程行不丢）。
    expect(api.uploads.length).toBe(1);
    await handle.stop();
    await handle.done;
  });

  test('失败方式：拉取空（server 门拒/旧步丢弃）→ 不 stop，自然收尾 success', async () => {
    const api = new FakeMachineApi();
    api.stopResponse = null;
    const probe = { stopCalls: 0 };
    const { backend, release } = stoppableBackend(probe);
    const { handle, lines } = await boot({ api, backend });
    await waitFor(() => api.parked !== null);
    api.parked?.(CLAIMED);
    await waitFor(() => lines.some((l) => l.includes('new session conv-1')));
    api.onStreamEvent?.({ type: 'stop', stepId: 's1' });
    await waitFor(() => api.calls.includes('stop:s1'));
    expect(probe.stopCalls).toBe(0);
    release();
    await waitFor(() => api.doneBodies.length === 1);
    expect(api.doneBodies[0]?.body.status).toBe('success');
    expect(lines.some((l) => l.includes('stop delivered'))).toBe(false);
    await handle.stop();
    await handle.done;
  });

  test('失败方式：自然完成先于停止（sawDone 优先）→ success 不被改判 stopped', async () => {
    const api = new FakeMachineApi();
    api.stopResponse = true;
    // stop() 无门控效果的后端：拉取置位后流仍自然跑完（done 事件在位）。
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const backend: AgentBackend = {
      capabilities: PI_CAPABILITIES,
      async createSession() {
        return {
          sessionId: 'pi-sess-late',
          events: (async function* () {
            yield { type: 'text_delta', text: '收尾中' } as StepEvent;
            await gate;
            yield { type: 'done', usage: [] } as StepEvent;
          })(),
          async steer() {},
          async stop() {}, // 无操作——流不被中断（模拟 stop 与完成竞态）
          usage: () => [],
        };
      },
      async continueSession() {
        throw new Error('unused');
      },
    };
    const { handle, lines } = await boot({ api, backend });
    await waitFor(() => api.parked !== null);
    api.parked?.(CLAIMED);
    await waitFor(() => lines.some((l) => l.includes('new session conv-1')));
    api.onStreamEvent?.({ type: 'stop', stepId: 's1' });
    await waitFor(() => api.calls.includes('stop:s1'));
    release();
    await waitFor(() => api.doneBodies.length === 1);
    expect(api.doneBodies[0]?.body.status).toBe('success');
    expect(lines.some((l) => l.includes('stop arrived after completion'))).toBe(true);
    await handle.stop();
    await handle.done;
  });

  test('失败方式：步收尾后无在跑 handle → 拉取成功也丢弃不炸（日志行 + 循环存活）', async () => {
    const api = new FakeMachineApi();
    api.stopResponse = true;
    const probe = { stopCalls: 0 };
    const { backend, release } = stoppableBackend(probe);
    const { handle, lines } = await boot({ api, backend });
    await waitFor(() => api.parked !== null);
    api.parked?.(CLAIMED);
    await waitFor(() => lines.some((l) => l.includes('new session conv-1')));
    release();
    await waitFor(() => api.doneBodies.length === 1); // 步收尾，handle 已注销
    api.onStreamEvent?.({ type: 'stop', stepId: 's1' });
    await waitFor(() => lines.some((l) => l.includes('stop dropped (no live session)')));
    expect(probe.stopCalls).toBe(0);
    await handle.stop();
    await handle.done;
  });
});

describe('per-step 后端解析（spec 17 A3：backendFor 唯一分叉）', () => {
  /** runtime 步 claim fixture（provider = claude-code 身份）。 */
  function claudeClaimed(): ClaimedStep {
    return { ...CLAIMED, agent: { ...CLAIMED.agent!, provider: 'claude-code' } };
  }

  test('失败方式 1：claude-code 步 → claude 后端执行，pi 后端零会话 + 惰性行恰好一条', async () => {
    const api = new FakeMachineApi();
    const { backend: pi, created: piCreated } = fakeBackend([{ type: 'done', usage: [] }]);
    const { backend: claude, created: claudeCreated } = fakeBackend([{ type: 'done', usage: [] }]);
    const { handle, lines } = await boot({ api, backend: pi, claudeCodeBackend: claude });
    await waitFor(() => api.parked !== null);
    api.parked?.(claudeClaimed());
    await waitFor(() => api.doneBodies.length === 1);
    expect(api.doneBodies[0]?.body.status).toBe('success');
    // 路由：claude 步只进 claude 后端。
    expect(claudeCreated).toHaveLength(1);
    expect(piCreated).toHaveLength(0);
    // canon：pi 行常驻（启动序列），claude 行惰性（首个 runtime 步）且恰好一条。
    expect(lines[0]).toBe('Loading pi runtime…');
    const claudeLines = lines.filter((l) => l === 'Loading claude-code runtime…');
    expect(claudeLines).toHaveLength(1);
    // A4 零凭据：FakeMachineApi.token 返回 http stub-gw（mixed-version 面），
    // runtime 分支权威短路照跑——canon 行落 claude-code。
    expect(lines).toContain('using model claude-code/stub-model');
    await handle.stop();
    await handle.done;
  });

  test('失败方式 2：pi-only 步流 → 不初始化 claude 后端、无惰性行', async () => {
    const api = new FakeMachineApi();
    const { backend: pi, created: piCreated } = fakeBackend([{ type: 'done', usage: [] }]);
    const { backend: claude, created: claudeCreated } = fakeBackend([{ type: 'done', usage: [] }]);
    const { handle, lines } = await boot({ api, backend: pi, claudeCodeBackend: claude });
    await waitFor(() => api.parked !== null);
    api.parked?.(CLAIMED); // provider='stub-gw'（custom id，非 runtime 身份）
    await waitFor(() => api.doneBodies.length === 1);
    expect(piCreated).toHaveLength(1);
    expect(claudeCreated).toHaveLength(0);
    expect(lines.some((l) => l === 'Loading claude-code runtime…')).toBe(false);
    await handle.stop();
    await handle.done;
  });

  test('失败方式 4：runtime 步 + 本机无 claude 凭据 → 步前失败，文案点名本机机器名（#867 T6）', async () => {
    const api = new FakeMachineApi();
    const { backend: pi, created: piCreated } = fakeBackend([]);
    const { backend: claude, created: claudeCreated } = fakeBackend([]);
    const { handle, lines } = await boot({
      api,
      backend: pi,
      claudeCodeBackend: claude,
      claudeCodeAuthProbe: async () => ({ state: 'not-logged-in', provider: 'firstParty' }),
    });
    await waitFor(() => api.parked !== null);
    api.parked?.(claudeClaimed());
    await waitFor(() => api.doneBodies.length === 1);
    expect(api.doneBodies[0]?.body.status).toBe('failed');
    // 机器名走 config.name（上线序列那个值，与 machines 页同源）。
    const msg = api.doneBodies[0]?.body.errorMessage ?? '';
    expect(msg).toContain('test-mbp');
    expect(msg).toContain('ANTHROPIC_API_KEY');
    // 预检在 backendFor 之前：连 claude 后端都没构造，模型回合零消耗。
    expect(claudeCreated).toHaveLength(0);
    expect(piCreated).toHaveLength(0);
    expect(lines.some((l) => l === 'Loading claude-code runtime…')).toBe(false);
    await handle.stop();
    await handle.done;
  });

  test('失败方式 3：混合步流（claude 步 + pi 步）→ 各归各后端，惰性行仍恰一条', async () => {
    const api = new FakeMachineApi();
    const { backend: pi, created: piCreated } = fakeBackend([{ type: 'done', usage: [] }]);
    const { backend: claude, created: claudeCreated } = fakeBackend([{ type: 'done', usage: [] }]);
    const { handle, lines } = await boot({ api, backend: pi, claudeCodeBackend: claude });
    await waitFor(() => api.parked !== null);
    api.parked?.(claudeClaimed());
    await waitFor(() => api.doneBodies.length === 1);
    await waitFor(() => api.parked !== null);
    api.parked?.(CLAIMED); // 第二步回归 pi
    await waitFor(() => api.doneBodies.length === 2);
    expect(claudeCreated).toHaveLength(1);
    expect(piCreated).toHaveLength(1);
    expect(lines.filter((l) => l === 'Loading claude-code runtime…')).toHaveLength(1);
    await handle.stop();
    await handle.done;
  });
});
