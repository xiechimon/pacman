// AgentBackend 缝的 claude-code 实现（spec 17 T1/#622：第二运行时最小闭环）。
// 缝纪律（01 §5/§7.3 与 pi.ts 同律）：本文件 = daemon 内唯一允许 import
// `@anthropic-ai/claude-agent-sdk` 的模块（biome noRestrictedImports 强制，
// backend/ 目录豁免）。事件面 = 既有 16 型 StepEvent 词表投影（A5 锁定，
// 映射表 spec 17 §事件映射表；映射函数 mapClaudeMessage 为纯函数可单测）。
//
// 凭据纪律（A4 零凭据通道）：claude-code 步的认证 = 机器本地（既有 claude
// 登录或 ANTHROPIC_API_KEY），后端**不消费** SessionOpts.provider（runner 传
// inert 占位满足必填形状）——apiKey 永不进本模块。
//
// 决策面（spec 17 Implementation Decisions）：A6 usage 行集（modelUsage 投影
// + `claude-code/` 键前缀，r3 §1.5 model 键形）；A7 resume 走 SDK `resume`
// + CLI 会话 store 存在性检查（缺失 → SessionNotResumableError，对齐既有
// 冷重试通道）；A8 steer = 流输入队列（下轮消费）——pi 的中途注入语义差异
// 已文档化不抹平，interrupt 归 T2；A9 skills catalog 追加 systemPrompt（复用
// pi 的 buildSkillsCatalog 通道）；A10 remoteTools/localTools/mcpServers
// fail-closed 明报不支持（落地归 T4）；A11 model verbatim 透传；A13
// bypassPermissions + readOnly → disallowedTools 收 Edit/Write（SDK 工具名）
// + AskUserQuestion（非交互 daemon 面，Multica claude.go:1078-1092 同律）；
// thinkingLevel → SDK effort（域内透传，off/minimal 缺省不发，域外 fail-closed）。

import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  type EffortLevel,
  type Options,
  type Query,
  query,
  type SDKMessage,
  type SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk';
import type {
  AgentBackend,
  AgentBackendCapabilities,
  AgentSessionHandle,
  AgentTokenUsage,
  ModelUsage,
  SessionOpts,
  StepEvent,
  ToolCallRecord,
} from '@pacman/shared';
import { SessionNotResumableError } from './errors.js';
import { appendSkillsCatalog, buildSkillsCatalog } from './pi.js';

/** spec 17 :108 能力面。thinkingLevels = SDK effort 五档（pi 七档里
 *  off/minimal 无 SDK 对应——不发 effort 即缺省，见 toEffort）。 */
export const CLAUDE_CODE_CAPABILITIES: AgentBackendCapabilities = {
  name: 'claude-code',
  thinkingLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
  oauthProviders: [], // 认证机器本地（A4），无 oauth 订阅面
  compaction: true,
  sessionResume: true,
};

/** usage 行集的 model 键前缀（r3 §1.5 `<provider>/<modelId>` 键形；pi 侧
 *  = `providerId/modelId`，此处 provider 恒 claude-code）。 */
const USAGE_MODEL_PREFIX = 'claude-code';

/** 域外 thinkingLevel fail-closed（A13「域外值不猜」）。 */
const EFFORT_LEVELS: readonly string[] = ['low', 'medium', 'high', 'xhigh', 'max'];

/** SDK 工具名（Claude Code 内建面，区别于 pi 的小写名）。 */
const SDK_WRITE_TOOLS = ['Edit', 'Write'];
const SDK_ASK_TOOL = 'AskUserQuestion';

/** 流级可重试判定（pi.ts isRetryableError 同律：瞬态词表正则）。 */
function isRetryableError(message: string): boolean {
  return /rate.?limit|overloaded|timeout|temporarily|5\d\d/i.test(message);
}

// —— SDKMessage → StepEvent 映射（纯函数 + 显式 state）—————————————

/** 映射状态（pi MapState 同位）：工具调用回填、usage 捕获、session_id 刮取、
 *  interrupt 判定（stop() 置位——终态 error 路由 message_stop 而非 error）。 */
export interface ClaudeMapState {
  calls: Map<string, ToolCallRecord>;
  /** stop() 置位：终局 error result 路由 message_stop（词表语义：流被停止）。 */
  interrupted: boolean;
  /** 终局 result 的 usage 行集（handle.usage() 兜底面，pi state.usage 同位）。 */
  usage: AgentTokenUsage;
  /** system init / result 帧刮出的 SDK session_id（A7）。 */
  sessionId: string | null;
  /** modelUsage 缺席时的单行合成键（SessionOpts.modelId 兜底）。 */
  modelId?: string;
}

export function createClaudeMapState(opts?: { modelId?: string }): ClaudeMapState {
  return {
    calls: new Map(),
    interrupted: false,
    usage: [],
    sessionId: null,
    ...(opts?.modelId !== undefined ? { modelId: opts.modelId } : {}),
  };
}

/** SDK ModelUsage/usage → pacman 行集（A6）。modelUsage 优先（per-model 总计，
 *  含 subagent/sidechain）；缺席时以 result.usage 合成单行（键 = modelId）。 */
function toUsageRows(
  msg: {
    modelUsage?: Record<
      string,
      {
        inputTokens: number;
        outputTokens: number;
        cacheReadInputTokens: number;
        cacheCreationInputTokens: number;
      }
    >;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  },
  modelId: string | undefined,
): ModelUsage[] {
  const entries = Object.entries(msg.modelUsage ?? {});
  if (entries.length > 0) {
    return entries.map(([key, mu]) => ({
      model: `${USAGE_MODEL_PREFIX}/${key}`,
      input: mu.inputTokens,
      output: mu.outputTokens,
      cacheRead: mu.cacheReadInputTokens,
      cacheWrite: mu.cacheCreationInputTokens,
    }));
  }
  if (msg.usage && modelId !== undefined) {
    return [
      {
        model: `${USAGE_MODEL_PREFIX}/${modelId}`,
        input: msg.usage.input_tokens ?? 0,
        output: msg.usage.output_tokens ?? 0,
        cacheRead: msg.usage.cache_read_input_tokens ?? 0,
        cacheWrite: msg.usage.cache_creation_input_tokens ?? 0,
      },
    ];
  }
  return [];
}

/** SDKMessage → StepEvent[]（spec 17 §事件映射表，词表 01 §5 锁定；pi 的
 *  mapPiSessionEvent 同位同律）。结构化窄化按 type/subtype + 字段在位判定；
 *  词表外成员（status/hook/log 类）静默不计。 */
export function mapClaudeMessage(msg: SDKMessage, state: ClaudeMapState): StepEvent[] {
  switch (msg.type) {
    case 'stream_event': {
      const event = (
        msg as {
          event?: { type?: string; delta?: { type?: string; text?: string; thinking?: string } };
        }
      ).event;
      if (event?.type !== 'content_block_delta') return [];
      if (event.delta?.type === 'text_delta' && event.delta.text !== undefined) {
        return [{ type: 'text_delta', text: event.delta.text }];
      }
      if (event.delta?.type === 'thinking_delta' && event.delta.thinking !== undefined) {
        return [{ type: 'thinking_delta', text: event.delta.thinking }];
      }
      return [];
    }
    case 'assistant': {
      const content = (msg as { message?: { role?: string; content?: unknown[] } }).message
        ?.content;
      if (!Array.isArray(content)) return [];
      const out: StepEvent[] = [];
      for (const block of content) {
        const b = block as {
          type?: string;
          thinking?: string;
          id?: string;
          name?: string;
          input?: unknown;
        };
        if (b.type === 'thinking' && b.thinking !== undefined) {
          // 块终全文（词表语义；增量面已由 thinking_delta 覆盖）。
          out.push({ type: 'thinking', text: b.thinking });
        } else if (b.type === 'tool_use' && typeof b.id === 'string') {
          // pending 段（无 result——词表「live 回传时缺省」）；终稿段由后续
          // user 帧 tool_result 回填（pi 两段发射同律，runner 以 result 在位
          // 门控 relay）。
          const call: ToolCallRecord = {
            id: b.id,
            name: b.name ?? '',
            arguments: b.input,
          };
          state.calls.set(call.id, call);
          out.push({ type: 'toolcall_end', call });
        }
      }
      out.push({
        type: 'message_end',
        message: {
          role: 'assistant',
          content,
        },
      });
      return out;
    }
    case 'user': {
      const content = (msg as { message?: { role?: string; content?: unknown[] } }).message
        ?.content;
      if (!Array.isArray(content)) return [];
      const out: StepEvent[] = [];
      for (const block of content) {
        const b = block as {
          type?: string;
          tool_use_id?: string;
          content?: unknown;
          is_error?: boolean;
        };
        if (b.type !== 'tool_result' || typeof b.tool_use_id !== 'string') continue;
        const pending = state.calls.get(b.tool_use_id);
        if (!pending) continue; // 无 pending 的 tool_result（异机回放等）静默跳过
        const final: ToolCallRecord = {
          ...pending,
          result: b.content,
          isError: b.is_error ?? false,
        };
        state.calls.set(final.id, final);
        out.push({ type: 'toolcall_end', call: final });
      }
      return out;
    }
    case 'system': {
      const subtype = (msg as { subtype?: string }).subtype;
      if (subtype === 'init') {
        const sessionId = (msg as { session_id?: string }).session_id;
        if (typeof sessionId === 'string') state.sessionId = sessionId;
        return []; // A7：session_id 进 handle，不入事件面
      }
      if (subtype === 'compact_boundary') return [{ type: 'compaction' }];
      if (subtype === 'api_retry') {
        const attempt = (msg as { attempt?: number }).attempt;
        return [{ type: 'auto_retry_start', attempt: attempt ?? 1 }];
      }
      return [];
    }
    case 'result': {
      const subtype = (msg as { subtype?: string }).subtype;
      const sessionId = (msg as { session_id?: string }).session_id;
      if (typeof sessionId === 'string' && state.sessionId === null) {
        state.sessionId = sessionId; // result 帧兜底刮取（Multica 同律）
      }
      const rows = toUsageRows(msg as Parameters<typeof toUsageRows>[0], state.modelId);
      state.usage = rows;
      if (subtype === 'success') {
        return [{ type: 'done', usage: rows }];
      }
      const errors = (msg as { errors?: string[] }).errors ?? [];
      const message = errors.length > 0 ? errors.join('; ') : (subtype ?? 'unknown error');
      if (state.interrupted) {
        // interrupt 终态（stop()/watchdog abort）：流被停止语义（词表
        // message_stop），非失败——stopped 收尾归 runner stopRequests 判定。
        return [
          {
            type: 'message_stop',
            message: { role: 'assistant', content: [{ type: 'text', text: message }] },
          },
        ];
      }
      return [{ type: 'error', error: { message, retryable: isRetryableError(message) } }];
    }
    default:
      return [];
  }
}

// —— 流输入队列与事件队列（AsyncQueue 泛型；pi EventQueue 同构）—————————

/** push → AsyncIterable pull（无界缓冲 [设计]：与 pi EventQueue 同律，背压
 *  面归实现期后票）。事件面（StepEvent）与 SDK 流输入面（SDKUserMessage）
 *  共用本形。 */
class AsyncQueue<T> {
  private readonly items: T[] = [];
  private waiter: ((r: IteratorResult<T>) => void) | null = null;
  private ended = false;

  push(item: T): void {
    if (this.ended) return;
    if (this.waiter) {
      const resolve = this.waiter;
      this.waiter = null;
      resolve({ value: item, done: false });
      return;
    }
    this.items.push(item);
  }

  end(): void {
    if (this.ended) return;
    this.ended = true;
    if (this.waiter) {
      const resolve = this.waiter;
      this.waiter = null;
      resolve({ value: undefined as unknown as T, done: true });
    }
  }

  private next(): Promise<IteratorResult<T>> {
    const item = this.items.shift();
    if (item !== undefined) return Promise.resolve({ value: item, done: false });
    if (this.ended) {
      return Promise.resolve({ value: undefined as unknown as T, done: true });
    }
    return new Promise<IteratorResult<T>>((resolve) => {
      this.waiter = resolve;
    });
  }

  iterable(): AsyncIterable<T> {
    const self = this;
    return {
      [Symbol.asyncIterator](): AsyncIterator<T> {
        return { next: () => self.next() };
      },
    };
  }
}

// —— 会话句柄 ——————————————————————————————————————————————

/** 终局事件（result 帧产物）：之后收事件面并清资源（流输入会话在终局后
 *  挂起等下一轮输入，daemon 步无下一轮——不收尾即 streamIdle 超时假失败）。 */
const TERMINAL_EVENT_TYPES: readonly string[] = ['done', 'error', 'message_stop'];

class ClaudeSessionHandle implements AgentSessionHandle {
  readonly sessionId: string;
  readonly events: AsyncIterable<StepEvent>;
  private readonly queue = new AsyncQueue<StepEvent>();
  private readonly input: AsyncQueue<SDKUserMessage>;
  private readonly state: ClaudeMapState;
  private readonly q: Query;
  private readonly abort: AbortController;
  private closed = false;
  private stopping = false;

  constructor(
    q: Query,
    opts: {
      sessionId: string;
      state: ClaudeMapState;
      abort: AbortController;
      input: AsyncQueue<SDKUserMessage>;
    },
  ) {
    this.q = q;
    this.sessionId = opts.sessionId;
    this.state = opts.state;
    this.abort = opts.abort;
    this.input = opts.input;
    this.events = this.queue.iterable();
    void this.pump();
  }

  /** SDKMessage 泵 → 映射 → 事件面。终局事件（done/error/message_stop）收
   *  事件面；生成器耗尽（输入流关后 query 自然收尾）= 无终局兜底收面。 */
  private async pump(): Promise<void> {
    try {
      for await (const msg of this.q) {
        for (const ev of mapClaudeMessage(msg, this.state)) {
          this.queue.push(ev);
          if (TERMINAL_EVENT_TYPES.includes(ev.type)) {
            this.finish();
            return;
          }
        }
      }
      this.queue.end();
    } catch (err) {
      // abort/interrupt 面吞错（pi stopping 同律）：stopped 收尾归 runner
      // stopRequests 旗标，错误文本不冒充失败原因。
      if (this.stopping) {
        this.queue.end();
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      this.queue.push({ type: 'error', error: { message, retryable: false } });
      this.queue.end();
    }
  }

  private finish(): void {
    if (this.closed) return;
    this.closed = true;
    this.input.end(); // 流尾 → query 收尾（流输入会话不挂起）
    this.queue.end();
    if (!this.abort.signal.aborted) this.abort.abort(); // 资源清理（SDK 契约）
  }

  /** steer = 流输入队列（下轮消费）+ steer 事件（A8：与 pi 中途注入语义有
   *  已知差异，文档化不抹平；interrupt 归 T2）。 */
  async steer(text: string): Promise<void> {
    this.input.push(userMessage(text));
    this.queue.push({ type: 'steer', text });
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.state.interrupted = true; // 终局 error result 路由 message_stop
    this.input.end();
    this.q.interrupt().catch(() => {}); // 旧 CLI 无回执 → resolve undefined
    this.finish();
  }

  usage(): AgentTokenUsage {
    return this.state.usage;
  }
}

/** 流输入用户帧（MessageParam 文本形；parent_tool_use_id = 顶层消息位 null）。 */
function userMessage(text: string): SDKUserMessage {
  return {
    type: 'user',
    message: { role: 'user', content: text },
    parent_tool_use_id: null,
  };
}

/** CLI 会话 store 惯例 [推断]（r4-foundation 调研；Multica claude.go:936-972
 *  同源）：~/.claude/projects/<cwd-slug>/<sessionId>.jsonl。存在性 = resume
 *  资格的本地判据（空 store/换机 → SessionNotResumableError 冷重试一次）。 */
function sdkTranscriptPath(cwd: string, sessionId: string): string {
  return join(homedir(), '.claude', 'projects', cwd.replaceAll('/', '-'), `${sessionId}.jsonl`);
}

// —— 后端 ——————————————————————————————————————————————————

export interface ClaudeCodeBackendOpts {
  /** skills 执行面注入（spec 14/#371，A9 复用 pi 通道）：skillsDir =
   *  PACMAN_SKILLS_DIR 扫描根；cwd = daemon home。缺省 = 不注入。 */
  skills?: { skillsDir: string; cwd: string };
  /** `[skills]` 诊断行出口（machine-loop 接 logger.skills，与 pi 同型）。 */
  onSkillsLog?: (msg: string) => void;
}

export class ClaudeCodeBackend implements AgentBackend {
  readonly capabilities = CLAUDE_CODE_CAPABILITIES;

  constructor(private readonly opts: ClaudeCodeBackendOpts) {}

  async createSession(opts: SessionOpts): Promise<AgentSessionHandle> {
    return this.open(opts, null);
  }

  async continueSession(id: string, opts: SessionOpts): Promise<AgentSessionHandle> {
    if (!existsSync(sdkTranscriptPath(opts.cwd, id))) {
      throw new SessionNotResumableError(id);
    }
    return this.open(opts, id);
  }

  private async open(opts: SessionOpts, resumeId: string | null): Promise<AgentSessionHandle> {
    // A10 fail-closed（落地归 T4）：明报不支持，不静默丢弃。
    if (opts.remoteTools && opts.remoteTools.length > 0) {
      throw new Error('claude-code backend: remoteTools not supported yet (T4)');
    }
    if (opts.localTools && opts.localTools.length > 0) {
      throw new Error('claude-code backend: localTools not supported yet (T4)');
    }
    if (opts.mcpServers && opts.mcpServers.length > 0) {
      throw new Error('claude-code backend: mcpServers not supported yet (T4)');
    }
    if (opts.executeRemoteTool) {
      throw new Error('claude-code backend: executeRemoteTool not supported yet (T4)');
    }
    // A13 thinkingLevel → effort：域内透传；off/minimal 缺省不发（SDK 无对应
    // 档）；域外 fail-closed 不猜。
    const effort = toEffort(opts.thinkingLevel);
    // A9 skills catalog 追加 systemPrompt（pi 同律通道；不采 workdir
    // CLAUDE.md 写入法——pacman worktree 纪律不容 git status 污染）。
    const skillsCatalog = this.opts.skills
      ? buildSkillsCatalog({
          skillsDir: this.opts.skills.skillsDir,
          cwd: this.opts.skills.cwd,
          ...(opts.skillsAllowlist !== undefined ? { allowlist: opts.skillsAllowlist } : {}),
          ...(opts.teamSkillsDir !== undefined ? { teamSkillsDir: opts.teamSkillsDir } : {}),
          ...(this.opts.onSkillsLog ? { log: this.opts.onSkillsLog } : {}),
        })
      : '';
    const append = appendSkillsCatalog(opts.systemPrompt, skillsCatalog);
    // A4 零凭据：不消费 opts.provider（inert 占位）；A11 model verbatim；
    // A13 bypassPermissions + disallowedTools（readOnly 收 Edit/Write；
    // AskUserQuestion 恒拒 = 非交互 daemon 面）。
    const disallowedTools = [SDK_ASK_TOOL, ...(opts.readOnly === true ? SDK_WRITE_TOOLS : [])];
    const abort = new AbortController();
    const sessionId = resumeId ?? randomUUID(); // 自铸 UUID（A7 通道同值回传）
    const sdkOptions: Options = {
      cwd: opts.cwd,
      model: opts.modelId,
      permissionMode: 'bypassPermissions',
      disallowedTools,
      includePartialMessages: true, // text_delta/thinking_delta 增量面
      ...(effort !== undefined ? { effort } : {}),
      ...(append !== undefined
        ? { systemPrompt: { type: 'preset', preset: 'claude_code', append } }
        : {}),
      ...(resumeId !== null ? { resume: resumeId } : { sessionId }),
      abortController: abort,
    };
    const state = createClaudeMapState({ modelId: opts.modelId });
    // 流输入队列（query 消费面 = 同一实例）：首轮任务文本先入队（02 §4.2
    // createSession = 首条用户消息；缺省 = 开会话不发轮，队列空但保持打开）。
    const input = new AsyncQueue<SDKUserMessage>();
    if (opts.prompt !== undefined) input.push(userMessage(opts.prompt));
    const q = query({ prompt: input.iterable(), options: sdkOptions });
    return new ClaudeSessionHandle(q, { sessionId, state, abort, input });
  }
}

/** thinkingLevel → SDK effort（A13）：off/minimal = 不发（缺省档）；域内
 *  透传；域外 fail-closed。 */
function toEffort(level: string | undefined): EffortLevel | undefined {
  if (level === undefined || level === 'off' || level === 'minimal') return undefined;
  if (EFFORT_LEVELS.includes(level)) return level as EffortLevel;
  throw new Error(`claude-code backend: unsupported thinkingLevel '${level}' (fail-closed)`);
}

export function createClaudeCodeBackend(opts: ClaudeCodeBackendOpts): AgentBackend {
  return new ClaudeCodeBackend(opts);
}
