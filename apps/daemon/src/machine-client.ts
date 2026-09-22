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
  type MachineStreamEvent,
  type MachineTokenResponse,
  machineClaimResponseSchema,
  machineEnrollPollResponseSchema,
  machineEnrollResponseSchema,
  machineEnrollStartResponseSchema,
  machineOkResponseSchema,
  machineRecordSchema,
  machineRecoverResponseSchema,
  machineStreamEventSchema,
  machineTokenResponseSchema,
  machineUploadUrlsResponseSchema,
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
  claim(signal?: AbortSignal): Promise<ClaimedStep | null>;
  heartbeat(stepId: string): Promise<void>;
  tool(stepId: string, call: ToolCallRecord): Promise<void>;
  token(stepId: string): Promise<MachineTokenResponse>;
  uploadUrls(
    stepId: string,
    files: { name: string; size?: number }[],
  ): Promise<{
    uploads: { name: string; url: string; method: 'PUT'; headers: Record<string, string> }[];
  }>;
  putUpload(url: string, headers: Record<string, string>, body: TranscriptUpload): Promise<void>;
  done(stepId: string, body: MachineDoneBody): Promise<void>;
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

  /** claim 长轮询（server hold ~75s，r3 §1.5）；调用方给 signal 控制中断。 */
  async claim(signal?: AbortSignal): Promise<ClaimedStep | null> {
    const res = await this.request<{ step: ClaimedStep | null }>(
      'POST',
      '/api/machine/tasks/claim',
      {
        body: {},
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

  /** 预签名 PUT（绝对 URL；一次性）。 */
  async putUpload(
    url: string,
    headers: Record<string, string>,
    body: TranscriptUpload,
  ): Promise<void> {
    const token = this.opts.getToken?.();
    const res = await this.fetchImpl(url, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        ...headers,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
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
