// 机器面 HTTP 客户端——02 §5 词表 13 端点（wire schema 单源 = shared
// machine-wire.ts；响应逐字段过 zod parse = 客户端侧协议对拍）。
// HTTP 客户端纪律（01 §4.3）：内置 fetch + undici EnvHttpProxyAgent（proxy.ts）；
// 断网重试预算在 machine-loop（claim 指数退避封顶 30s，r3 §1.5）。

import {
  type ClaimedStep,
  type MachineDoneBody,
  type MachineEnrollResponse,
  type MachineRecord,
  type MachineRecoverResponse,
  type MachineSteerResponse,
  type MachineStreamEvent,
  type MachineTokenResponse,
  machineClaimResponseSchema,
  machineEnrollPollResponseSchema,
  machineEnrollResponseSchema,
  machineEnrollStartResponseSchema,
  machineOkResponseSchema,
  machineRecordSchema,
  machineRecoverResponseSchema,
  machineSteerResponseSchema,
  machineStreamEventSchema,
  machineTokenResponseSchema,
  machineUploadUrlsResponseSchema,
  REMOTE_TOOL_RETRY_DELAYS_MS,
  REMOTE_TOOL_TIMEOUT_MS,
  type StepRecord,
  type ToolCallRecord,
  type TranscriptUpload,
} from '@pacman/shared';

export class MachineApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`machine api ${status}: ${body.slice(0, 200)}`);
    this.name = 'MachineApiError';
  }
}

export interface MachineClientOpts {
  serverUrl: string;
  /** 机器 token（machine.json）；enroll 时缺省。 */
  getToken?: () => string;
  fetchImpl?: typeof fetch;
}

/** 机器面客户端接口（测试注入用结构化类型；实现 = MachineClient）。 */
export interface MachineApi {
  enroll(body: {
    teamId: string;
    name?: string;
    cliVersion?: string;
    apiKey: string;
  }): Promise<MachineEnrollResponse>;
  me(): Promise<MachineRecord>;
  presence(body: { maxConcurrent?: number; cliVersion?: string }): Promise<void>;
  recover(): Promise<MachineRecoverResponse>;
  claim(signal?: AbortSignal, running?: number): Promise<ClaimedStep | null>;
  heartbeat(stepId: string): Promise<void>;
  tool(stepId: string, call: ToolCallRecord): Promise<void>;
  /** live transcript 文本增量（machineToolBodySchema 第三形 [设计]，M5 live
   * streaming）：pi text_delta 节流批量转发，server 侧瞬态进 conversation
   * stream；失败不重试（终稿经 transcript 上传兜底）。 */
  transcriptDelta(stepId: string, text: string): Promise<void>;
  /** remoteTools relay 执行（chief 步服务端工具）：POST tool/{stepId}
   * {name, params} → {text}（r5 §3.1 bundle）。replaySafe → 重试预算
   * REMOTE_TOOL_RETRY_DELAYS_MS；超时 REMOTE_TOOL_TIMEOUT_MS。返回结果文本。 */
  relayTool(
    stepId: string,
    name: string,
    params: Record<string, unknown>,
    opts?: { replaySafe?: boolean; signal?: AbortSignal },
  ): Promise<string>;
  token(stepId: string): Promise<MachineTokenResponse>;
  uploadUrls(
    stepId: string,
    files: { name: string; size?: number }[],
  ): Promise<{
    uploads: { name: string; url: string; method: 'PUT'; headers: Record<string, string> }[];
  }>;
  putUpload(
    url: string,
    headers: Record<string, string>,
    body: TranscriptUpload | string,
    contentType?: string,
  ): Promise<void>;
  done(stepId: string, body: MachineDoneBody): Promise<void>;
  /** steer 拉取-确认（W3 #279，06 册 D9）：{content} = 运行中步的补话文本
   * （拉取即确认，server 侧 pending 随即清）；null = 无待取/非本机在跑步/
   * pending 定向旧步（已丢弃）。 */
  steer(stepId: string): Promise<string | null>;
  stream(
    signal: AbortSignal,
    onEvent: (ev: MachineStreamEvent) => void,
    onConnected?: () => void,
  ): Promise<void>;
}

export class MachineClient implements MachineApi {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: MachineClientOpts) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private url(path: string): string {
    return `${this.opts.serverUrl}${path}`;
  }

  private async request<T>(
    method: string,
    path: string,
    opts: {
      bearer?: string;
      body?: unknown;
      signal?: AbortSignal;
      parse?: (raw: unknown) => T;
      raw?: boolean;
    } = {},
  ): Promise<T> {
    const token = opts.bearer ?? this.opts.getToken?.();
    const headers: Record<string, string> = {};
    if (token) headers.authorization = `Bearer ${token}`;
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    const res = await this.fetchImpl(this.url(path), {
      method,
      headers,
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
      ...(opts.signal ? { signal: opts.signal } : {}),
    });
    if (!res.ok) {
      throw new MachineApiError(res.status, await res.text());
    }
    const raw = (await res.json()) as unknown;
    return opts.parse ? opts.parse(raw) : (raw as T);
  }

  // —— enroll（02 §5.2 路径二：apiKey Bearer）———————————————————————————————

  async enroll(body: {
    teamId: string;
    name?: string;
    cliVersion?: string;
    apiKey: string;
  }): Promise<MachineEnrollResponse> {
    const { apiKey, ...rest } = body;
    return this.request<MachineEnrollResponse>('POST', '/api/machine/enroll', {
      bearer: apiKey,
      body: rest,
      parse: (raw) => machineEnrollResponseSchema.parse(raw),
    });
  }

  async enrollStart(body: { teamId?: string; name?: string }): Promise<{
    enrollId: string;
    url: string;
  }> {
    return this.request('POST', '/api/machine/enroll/start', {
      body,
      parse: (raw) =>
        machineEnrollStartResponseSchema.parse(raw) as { enrollId: string; url: string },
    });
  }

  async enrollPoll(
    enrollId: string,
  ): Promise<
    | { status: 'pending' }
    | { status: 'authorized'; machine: MachineEnrollResponse }
    | { status: 'expired' }
  > {
    return this.request('POST', '/api/machine/enroll/poll', {
      body: { enrollId },
      parse: (raw) => machineEnrollPollResponseSchema.parse(raw) as never,
    });
  }

  // —— 机器面（token Bearer）———————————————————————————————————————————————

  async me(): Promise<MachineRecord> {
    return this.request('GET', '/api/machine/me', {
      parse: (raw) => machineRecordSchema.parse(raw),
    });
  }

  async presence(body: { maxConcurrent?: number; cliVersion?: string }): Promise<void> {
    await this.request('POST', '/api/machine/presence', {
      body,
      parse: (raw) => machineOkResponseSchema.parse(raw),
    });
  }

  async recover(): Promise<MachineRecoverResponse> {
    return this.request('POST', '/api/machine/recover', {
      body: {},
      parse: (raw) => machineRecoverResponseSchema.parse(raw),
    });
  }

  /** claim 长轮询（server hold ~75s，r3 §1.5）；调用方给 signal 控制中断；
   * running = 本机在跑步数（machineClaimBodySchema 字段，并发门面）。 */
  async claim(signal?: AbortSignal, running = 0): Promise<ClaimedStep | null> {
    const res = await this.request<{ step: ClaimedStep | null }>(
      'POST',
      '/api/machine/tasks/claim',
      {
        body: { running },
        signal,
        parse: (raw) => machineClaimResponseSchema.parse(raw) as { step: ClaimedStep | null },
      },
    );
    return res.step;
  }

  async heartbeat(stepId: string): Promise<void> {
    await this.request('POST', `/api/machine/heartbeat/${stepId}`, {
      body: {},
      parse: (raw) => machineOkResponseSchema.parse(raw),
    });
  }

  async tool(stepId: string, call: ToolCallRecord): Promise<void> {
    await this.request('POST', `/api/machine/tool/${stepId}`, {
      body: call,
      parse: (raw) => machineOkResponseSchema.parse(raw),
    });
  }

  async transcriptDelta(stepId: string, text: string): Promise<void> {
    await this.request('POST', `/api/machine/tool/${stepId}`, {
      body: { kind: 'transcript_delta' as const, text },
      parse: (raw) => machineOkResponseSchema.parse(raw),
    });
  }

  /** remoteTools relay（r5 §3.1 bundle `remoteTools.ts` 语义）：replaySafe 读工具
   * 带重试预算 [500,2000]ms + 10s 超时；写工具（非 replaySafe）单次不重试。
   * 服务端拒绝（4xx {error}）→ 抛错由上层转 pi 工具结果文本；成功 → text。 */
  async relayTool(
    stepId: string,
    name: string,
    params: Record<string, unknown>,
    opts: { replaySafe?: boolean; signal?: AbortSignal } = {},
  ): Promise<string> {
    const replaySafe = opts.replaySafe ?? false;
    const delays = replaySafe ? [...REMOTE_TOOL_RETRY_DELAYS_MS] : [];
    let lastErr: unknown;
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      const timeout = AbortSignal.timeout(REMOTE_TOOL_TIMEOUT_MS);
      const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
      try {
        const res = await this.fetchImpl(this.url(`/api/machine/tool/${stepId}`), {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(this.opts.getToken?.()
              ? { authorization: `Bearer ${this.opts.getToken?.()}` }
              : {}),
          },
          body: JSON.stringify({ name, params }),
          signal,
        });
        const body = (await res.json().catch(() => null)) as {
          text?: string;
          error?: string;
        } | null;
        if (res.ok) {
          return typeof body?.text === 'string' ? body.text : '';
        }
        // 服务端拒绝（非瞬态）→ 不重试，抛 {error} 供上层落工具结果。
        const msg =
          typeof body?.error === 'string' ? body.error : `${name} failed (HTTP ${res.status})`;
        if (!replaySafe || res.status < 500) throw new MachineApiError(res.status, msg);
        lastErr = new MachineApiError(res.status, msg); // 5xx + replaySafe → 重试
      } catch (err) {
        if (err instanceof MachineApiError && (!replaySafe || err.status < 500)) throw err;
        lastErr = err; // 超时/网络（replaySafe）→ 重试
        if (!replaySafe) throw err;
      }
      const delay = delays[attempt];
      if (delay === undefined) break;
      await new Promise((r) => setTimeout(r, delay));
    }
    throw lastErr instanceof Error ? lastErr : new Error(`${name} relay failed`);
  }

  async token(stepId: string): Promise<MachineTokenResponse> {
    return this.request('GET', `/api/machine/token/${stepId}`, {
      parse: (raw) => machineTokenResponseSchema.parse(raw),
    });
  }

  async uploadUrls(
    stepId: string,
    files: { name: string; size?: number }[],
  ): Promise<{
    uploads: { name: string; url: string; method: 'PUT'; headers: Record<string, string> }[];
  }> {
    return this.request('POST', `/api/machine/upload-urls/${stepId}`, {
      body: { files },
      parse: (raw) => machineUploadUrlsResponseSchema.parse(raw) as never,
    });
  }

  /** 预签名 PUT（绝对 URL；一次性）。机器 token 仅同源附带（预签名 URL 若
   * 指向异源存储，不得外泄 Bearer [设计]）。body 双形：transcript.json =
   * JSON；plan.md = 原文 text/markdown（02 §4.2 plan 即文件）。 */
  async putUpload(
    url: string,
    headers: Record<string, string>,
    body: TranscriptUpload | string,
    contentType?: string,
  ): Promise<void> {
    const sameOrigin = new URL(url).origin === new URL(this.opts.serverUrl).origin;
    const token = sameOrigin ? this.opts.getToken?.() : undefined;
    const res = await this.fetchImpl(url, {
      method: 'PUT',
      headers: {
        'content-type': contentType ?? 'application/json',
        ...headers,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
    if (!res.ok) throw new MachineApiError(res.status, await res.text());
    machineOkResponseSchema.parse(await res.json());
  }

  async done(stepId: string, body: MachineDoneBody): Promise<void> {
    await this.request('POST', `/api/machine/done/${stepId}`, {
      body,
      parse: (raw) => machineOkResponseSchema.parse(raw),
    });
  }

  /** steer 拉取-确认（W3 #279）：GET /api/machine/steer?stepId=（[设计]
   * MACHINE_WIRE_EXTENSIONS 登记位；本机在跑步单槽 pending）。 */
  async steer(stepId: string): Promise<string | null> {
    const res = await this.request<MachineSteerResponse>(
      'GET',
      `/api/machine/steer?stepId=${encodeURIComponent(stepId)}`,
      { parse: (raw) => machineSteerResponseSchema.parse(raw) },
    );
    return res.content;
  }

  /** wake SSE（02 §1.2 机器通道）：帧解析回调；连接断开自然返回。 */
  async stream(
    signal: AbortSignal,
    onEvent: (ev: MachineStreamEvent) => void,
    onConnected?: () => void,
  ): Promise<void> {
    const token = this.opts.getToken?.();
    const res = await this.fetchImpl(this.url('/api/machine/stream'), {
      headers: {
        accept: 'text/event-stream',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      signal,
    });
    if (!res.ok || !res.body) throw new MachineApiError(res.status, 'stream unavailable');
    onConnected?.();
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        buf += decoder.decode(value, { stream: true });
        let idx = buf.indexOf('\n\n');
        while (idx >= 0) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          for (const line of frame.split('\n')) {
            if (!line.startsWith('data:')) continue;
            onEvent(machineStreamEventSchema.parse(JSON.parse(line.slice(5).trim())));
          }
          idx = buf.indexOf('\n\n');
        }
      }
    } finally {
      void reader.cancel().catch(() => {});
    }
  }
}

export type { StepRecord };
