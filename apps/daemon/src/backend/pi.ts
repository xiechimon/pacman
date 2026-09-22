// AgentBackend 缝的 pi 实现（00/D1、01 §5/§4.3：pi 0.85.1 AgentSession 稳定面）。
// 缝纪律（01 §5/§7.3）：本文件 = daemon 内唯一允许 import `@earendil-works/*`
// 的模块（biome noRestrictedImports 强制）；第二引擎将来 = 新增一个
// AgentBackend 实现，事件面/能力面不动。
//
// 事件映射 = 02 §5.6 pi 词表 1:1 的宿主投影 [推断]（AgentSessionEvent →
// StepEvent；映射函数 mapPiSessionEvent 为纯函数，可单测）：
// - message_update(text_delta/thinking_delta) → text_delta/thinking_delta + message_update
// - thinking_end → thinking（块全文）
// - toolcall_end（调用块完成）→ toolcall_end（无 result）；tool_execution_end →
//   toolcall_end（含 result，同 id 幂等 upsert 覆盖）
// - message_end → message_end；stopReason=aborted → message_stop；error → error
// - compaction_start/end、auto_retry_start/end → 同名事件
// - agent_end(!willRetry) → done(usage)；裸 compaction 事件本映射不产生
//   （词表位保留给引擎侧压缩归档消息 [推断]）。
//
// per-step 凭证纪律（02 §8 运行时层）：apiKey 只走 ModelRuntime.setRuntimeApiKey
// （内存态，不持久化）；models.json 落盘的 apiKey 恒为占位符。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type AgentSession,
  createAgentSession,
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from '@earendil-works/pi-coding-agent';
import type {
  AgentBackend,
  AgentBackendCapabilities,
  AgentSessionHandle,
  AgentTokenUsage,
  ModelUsage,
  ProviderConfig,
  SessionOpts,
  StepEvent,
  ToolCallRecord,
} from '@pacman/shared';
import { SessionNotResumableError } from './errors.js';

/** 02 §6.2/#34：oauth 四家订阅；思考强度 = pi 七档（docs/sdk.md）。 */
export const PI_CAPABILITIES: AgentBackendCapabilities = {
  name: 'pi',
  thinkingLevels: ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
  oauthProviders: ['anthropic', 'openai-codex', 'github-copilot', 'xai'],
  compaction: true,
  sessionResume: true,
};

/** pi 内建工具默认面（02 §5.6：其余工具面 = pi-coding-agent 内建）。 */
const PI_BUILTIN_TOOLS = ['read', 'bash', 'edit', 'write'];

/** models.json custom provider 占位 key（真 key 走 setRuntimeApiKey 内存态）。 */
const MODELS_JSON_KEY_PLACEHOLDER = 'per-step';

/** 自定义端点模型默认值 [设计]（contextWindow 128k = r3 §2 展示默认）。 */
const CUSTOM_MODEL_DEFAULTS = {
  reasoning: false,
  input: ['text'] as ('text' | 'image')[],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128_000,
  maxTokens: 4_096,
};

interface PiMessageLike {
  role: string;
  content?: unknown;
  provider?: string;
  model?: string;
  stopReason?: string;
  errorMessage?: string;
  usage?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number };
}

/** AgentSessionEvent 的结构化投影（映射输入面）：单测无需 import pi 类型
 * （缝纪律——@earendil-works/* 只在本模块出现）。字段全 optional = 事件族
 * 宽松投影；映射按 type + 字段在位判定。 */
export interface AgentSessionEventLike {
  type: string;
  message?: PiMessageLike;
  assistantMessageEvent?: {
    type: string;
    delta?: string;
    content?: string;
    toolCall?: { id: string; name: string; arguments: unknown };
  };
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  result?: unknown;
  isError?: boolean;
  attempt?: number;
  willRetry?: boolean;
}

export interface MapState {
  usage: Map<string, ModelUsage>;
  calls: Map<string, ToolCallRecord>;
}

export function newMapState(): MapState {
  return { usage: new Map(), calls: new Map() };
}

function toMessageRecord(msg: PiMessageLike): {
  role: 'system' | 'user' | 'assistant';
  content: unknown;
} {
  const role =
    msg.role === 'assistant' ? 'assistant' : msg.role === 'user' ? 'user' : ('system' as const);
  return { role, content: msg.content ?? null };
}

function isRetryableError(message: string): boolean {
  // 流级可重试判定 [推断]（pi 自带 auto_retry 覆盖大多数瞬态；error 事件的
  // retryable 供宿主日志/失败文案用，宿主持「步级失败无自动重跑」纪律）。
  return /rate.?limit|overloaded|timeout|temporarily|5\d\d/i.test(message);
}

/** AgentSessionEvent → StepEvent[] 纯映射（state 累积 usage 与工具调用）。 */
export function mapPiSessionEvent(event: AgentSessionEventLike, state: MapState): StepEvent[] {
  switch (event.type) {
    case 'message_update': {
      const msg = event.message;
      if (!msg) return [];
      const record = toMessageRecord(msg);
      const ame = event.assistantMessageEvent;
      if (!ame) return [{ type: 'message_update', message: record }];
      if (ame.type === 'text_delta' && ame.delta !== undefined) {
        return [
          { type: 'text_delta', text: ame.delta },
          { type: 'message_update', message: record },
        ];
      }
      if (ame.type === 'thinking_delta' && ame.delta !== undefined) {
        return [
          { type: 'thinking_delta', text: ame.delta },
          { type: 'message_update', message: record },
        ];
      }
      if (ame.type === 'thinking_end') {
        return [{ type: 'thinking', text: ame.content ?? '' }];
      }
      if (ame.type === 'toolcall_end' && ame.toolCall) {
        const call: ToolCallRecord = {
          id: ame.toolCall.id,
          name: ame.toolCall.name,
          arguments: ame.toolCall.arguments,
        };
        state.calls.set(call.id, call);
        return [{ type: 'toolcall_end', call }];
      }
      return [{ type: 'message_update', message: record }];
    }
    case 'message_end': {
      const msg = event.message;
      if (!msg) return [];
      if (msg.role === 'assistant' && msg.usage && msg.provider && msg.model) {
        const key = `${msg.provider}/${msg.model}`;
        const prev = state.usage.get(key) ?? {
          model: key,
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
        };
        state.usage.set(key, {
          model: key,
          input: prev.input + (msg.usage.input ?? 0),
          output: prev.output + (msg.usage.output ?? 0),
          cacheRead: prev.cacheRead + (msg.usage.cacheRead ?? 0),
          cacheWrite: prev.cacheWrite + (msg.usage.cacheWrite ?? 0),
        });
      }
      if (msg.stopReason === 'aborted') {
        return [{ type: 'message_stop', message: toMessageRecord(msg) }];
      }
      const out: StepEvent[] = [{ type: 'message_end', message: toMessageRecord(msg) }];
      if (msg.role === 'assistant' && msg.stopReason === 'error') {
        const message = msg.errorMessage ?? 'unknown error';
        out.push({ type: 'error', error: { message, retryable: isRetryableError(message) } });
      }
      return out;
    }
    case 'tool_execution_end': {
      const toolCallId = event.toolCallId ?? '';
      const prior = state.calls.get(toolCallId);
      const call: ToolCallRecord = {
        id: toolCallId,
        name: event.toolName ?? prior?.name ?? '',
        arguments: prior?.arguments ?? event.args,
        result: event.result,
        isError: event.isError ?? false,
        ...(prior?.startedAt !== undefined ? { startedAt: prior.startedAt } : {}),
        endedAt: Date.now(),
      };
      state.calls.set(call.id, call);
      return [{ type: 'toolcall_end', call }];
    }
    case 'compaction_start':
      return [{ type: 'compaction_start' }];
    case 'compaction_end':
      return [{ type: 'compaction_end' }];
    case 'auto_retry_start':
      return [{ type: 'auto_retry_start', attempt: event.attempt ?? 1 }];
    case 'auto_retry_end':
      return [{ type: 'auto_retry_end', attempt: event.attempt ?? 1 }];
    case 'agent_end': {
      if (event.willRetry) return [];
      const usage: ModelUsage[] = [...state.usage.values()];
      return [{ type: 'done', usage }];
    }
    default:
      return [];
  }
}

/** 事件队列（subscribe push → AsyncIterable pull；无界缓冲 [设计]：单步
 * transcript 量级有限，背压面归实现期后票）。 */
class EventQueue {
  private readonly items: StepEvent[] = [];
  private waiter: ((r: IteratorResult<StepEvent>) => void) | null = null;
  private ended = false;

  push(ev: StepEvent): void {
    if (this.ended) return;
    if (this.waiter) {
      const resolve = this.waiter;
      this.waiter = null;
      resolve({ value: ev, done: false });
      return;
    }
    this.items.push(ev);
  }

  end(): void {
    if (this.ended) return;
    this.ended = true;
    if (this.waiter) {
      const resolve = this.waiter;
      this.waiter = null;
      resolve({ value: undefined as unknown as StepEvent, done: true });
    }
  }

  next(): Promise<IteratorResult<StepEvent>> {
    const item = this.items.shift();
    if (item !== undefined) return Promise.resolve({ value: item, done: false });
    if (this.ended) {
      return Promise.resolve({ value: undefined as unknown as StepEvent, done: true });
    }
    return new Promise<IteratorResult<StepEvent>>((resolve) => {
      this.waiter = resolve;
    });
  }

  iterable(): AsyncIterable<StepEvent> {
    const self = this;
    return {
      [Symbol.asyncIterator](): AsyncIterator<StepEvent> {
        return { next: () => self.next() };
      },
    };
  }
}

class PiSessionHandle implements AgentSessionHandle {
  readonly sessionId: string;
  readonly events: AsyncIterable<StepEvent>;
  private readonly queue = new EventQueue();
  private readonly state = newMapState();
  private closed = false;

  constructor(private readonly session: AgentSession) {
    this.sessionId = session.sessionId;
    this.events = this.queue.iterable();
    session.subscribe((event) => {
      for (const mapped of mapPiSessionEvent(
        event as unknown as AgentSessionEventLike,
        this.state,
      )) {
        this.queue.push(mapped);
        if (mapped.type === 'done') this.finish();
      }
    });
  }

  private finish(): void {
    if (this.closed) return;
    this.closed = true;
    this.queue.end();
    this.session.dispose();
  }

  async steer(text: string): Promise<void> {
    await this.session.steer(text);
    this.queue.push({ type: 'steer', text });
  }

  async stop(): Promise<void> {
    await this.session.abort();
    this.finish();
  }

  usage(): AgentTokenUsage {
    return [...this.state.usage.values()];
  }
}

export interface PiBackendOpts {
  /** pi 运行时目录（auth.json/models.json/settings；02 §5.3 agent-runtime/）。 */
  agentDir: string;
  /** 会话持久化目录（02 §5.3 chat-sessions/；SessionManager sessionDir）。 */
  sessionDir: string;
  /** continueSession 解析键：sessionId → sessionFile（chat-sessions 索引）。 */
  resolveSessionFile?: (sessionId: string) => string | null;
  /** 会话建立回调（索引落盘由宿主做——durable 语义宿主自持，00/D3）。 */
  onSession?: (sessionId: string, sessionFile: string | undefined) => void;
}

export class PiBackend implements AgentBackend {
  readonly capabilities = PI_CAPABILITIES;

  constructor(private readonly opts: PiBackendOpts) {
    mkdirSync(opts.agentDir, { recursive: true });
    mkdirSync(opts.sessionDir, { recursive: true });
    // 模型目录网络刷新关闭（self-host 确定性；pi docs/sdk.md PI_OFFLINE）。
    process.env.PI_OFFLINE = process.env.PI_OFFLINE ?? '1';
    process.env.PI_CODING_AGENT_DIR = opts.agentDir;
  }

  async createSession(opts: SessionOpts): Promise<AgentSessionHandle> {
    return this.open(opts, null);
  }

  async continueSession(id: string, opts: SessionOpts): Promise<AgentSessionHandle> {
    const file = this.opts.resolveSessionFile?.(id) ?? null;
    if (!file || !existsSync(file)) {
      throw new SessionNotResumableError(id);
    }
    return this.open(opts, file);
  }

  private async open(opts: SessionOpts, resumeFile: string | null): Promise<AgentSessionHandle> {
    const modelsPath = join(this.opts.agentDir, 'models.json');
    materializeProvider(modelsPath, opts.provider);
    const authPath = join(this.opts.agentDir, 'auth.json');
    const runtime = await ModelRuntime.create({ authPath, modelsPath });
    // per-step 凭证内存态注入（02 §8：不落盘常驻）。
    if (opts.provider.apiKey) {
      await runtime.setRuntimeApiKey(opts.provider.providerId, opts.provider.apiKey);
    }
    const model = runtime.getModel(opts.provider.providerId, opts.modelId);
    if (!model) {
      throw new Error(`model ${opts.provider.providerId}/${opts.modelId} not found`);
    }
    const settingsManager = SettingsManager.inMemory({ compaction: { enabled: true } });
    const loader = new DefaultResourceLoader({
      cwd: opts.cwd,
      agentDir: this.opts.agentDir,
      settingsManager,
      ...(opts.systemPrompt !== undefined
        ? { systemPromptOverride: () => opts.systemPrompt as string }
        : {}),
    });
    await loader.reload();
    const sessionManager = resumeFile
      ? SessionManager.open(resumeFile, this.opts.sessionDir, opts.cwd)
      : SessionManager.create(opts.cwd, this.opts.sessionDir);
    const { session } = await createAgentSession({
      cwd: opts.cwd,
      agentDir: this.opts.agentDir,
      model,
      ...(opts.thinkingLevel !== undefined
        ? {
            thinkingLevel: opts.thinkingLevel as
              | 'off'
              | 'minimal'
              | 'low'
              | 'medium'
              | 'high'
              | 'xhigh'
              | 'max',
          }
        : {}),
      modelRuntime: runtime,
      resourceLoader: loader,
      sessionManager,
      settingsManager,
      tools: PI_BUILTIN_TOOLS,
    });
    this.opts.onSession?.(session.sessionId, session.sessionFile);
    const handle = new PiSessionHandle(session);
    if (opts.prompt !== undefined) {
      void session.prompt(opts.prompt).catch((err: unknown) => {
        // 失败经事件面报告（message_end stopReason=error / agent_end）；
        // prompt() 拒绝仅兜底防未处理 rejection。
        void err;
      });
    }
    return handle;
  }
}

/** custom provider（baseUrl 形态）物化进 models.json（pi 自定义模型机制，
 * docs/models.md）；apiKey 恒占位符——真 key 走 setRuntimeApiKey（02 §8）。 */
export function materializeProvider(modelsPath: string, provider: ProviderConfig): void {
  if (!provider.baseUrl) return; // preset provider 走 pi 内建目录
  const raw = existsSync(modelsPath)
    ? (JSON.parse(readFileSync(modelsPath, 'utf8')) as {
        providers?: Record<string, Record<string, unknown>>;
      })
    : {};
  const providers = raw.providers ?? {};
  providers[provider.providerId] = {
    baseUrl: provider.baseUrl,
    api: provider.api ?? 'openai-completions',
    apiKey: MODELS_JSON_KEY_PLACEHOLDER,
    ...(provider.authHeader !== undefined ? { authHeader: provider.authHeader } : {}),
    models: (provider.models ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      ...CUSTOM_MODEL_DEFAULTS,
    })),
  };
  writeFileSync(modelsPath, `${JSON.stringify({ providers }, null, 2)}\n`, 'utf8');
}

export function createPiBackend(opts: PiBackendOpts): AgentBackend {
  return new PiBackend(opts);
}
