// AgentBackend 缝——01 §5 签名（00/D1 移交项闭环，锁定形状、实现期可精化字段）。
// 事件词表 = 02 §5.6 pi 词表 1:1，不得增删改名（PI_STREAM_EVENTS 的会话内
// 15 件；wake/shutdown 为机器控制事件，走机器 stream 通道不入 StepEvent，
// protocol/sse.ts MACHINE_STREAM_EVENT_TYPES）。
// 缝纪律（01 §5/§7.3）：daemon 内 pi 实现类之外，任何模块不得 import
// `@earendil-works/*`（biome noRestrictedImports 强制，seam-lint 面）。
// 第二引擎将来 = 新增一个 AgentBackend 实现，事件面/能力面不动（00/D1）。
// 本文件零依赖 pi——shared 零反向（01 §3）。

import { z } from 'zod';
import { epochMs, recordId } from './records/common.js';
import { messageRecordSchema } from './records/message.js';
import { providerApiSchema, providerModelSchema } from './records/provider.js';

/** 工具调用行（02 §5.6 `toolcall_end` 载荷；transcript 工具行 `> edit README.md`
 * 的数据面，r3 §3.5）。wire 细形未采 [推断]：字段 = pi toolCall + 执行结果的
 * 最小投影，实现期重放补采后回写 02 §11 收紧（04 §3 不判负口径）。 */
export const toolCallRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.unknown(),
  /** 执行结果（toolcall 块完成时可能尚未有结果——live 回传时缺省，
   * transcript 终稿必含 [设计]）。 */
  result: z.unknown().optional(),
  isError: z.boolean().optional(),
  startedAt: epochMs.optional(),
  endedAt: epochMs.optional(),
});
export type ToolCallRecord = z.infer<typeof toolCallRecordSchema>;

/** per-model 四维计数（02 §6.2 tokenUsage 分项；`<provider>/<modelId>` 串
 * r3 §1.5）。build 维由宿主落库时补全（token_usage 表主键 buildId×model）。 */
export const modelUsageSchema = z.object({
  model: z.string(),
  input: z.number().int(),
  output: z.number().int(),
  cacheRead: z.number().int(),
  cacheWrite: z.number().int(),
});
export type ModelUsage = z.infer<typeof modelUsageSchema>;

/** 01 §5 `usage(): TokenUsage`——build × model × {输入,输出,缓存读,缓存写}
 * （02 §6.2）；缝内视角 = per-model 行集（build 维在宿主）。命名精化为
 * AgentTokenUsage 以让位 records/token-usage.ts 的 wire record TokenUsage
 * （01 §5「实现期可精化字段」口径）。 */
export type AgentTokenUsage = readonly ModelUsage[];

export const agentTokenUsageSchema = z.array(modelUsageSchema);

/** provider 配置（01 §5 SessionOpts.provider；kind = 02 §5.6 配置 kind 的
 * provider 三值——`stdio` 为 MCP transport 专用，不入 provider 配置）。
 * apiKey 为运行时内存态：per-step 下发不落盘（02 §8 运行时层），永不持久化、
 * 永不回传 server。 */
export const providerConfigSchema = z.object({
  kind: z.enum(['api_key', 'oauth', 'http']),
  /** preset provider id（38 目录，records/provider.ts）或 custom providerId。 */
  providerId: z.string(),
  label: z.string().optional(),
  /** custom 端点 baseUrl（preset 走 pi 内建目录时可缺省）。 */
  baseUrl: z.string().optional(),
  /** custom 端点三协议（records/provider.ts providerApiSchema）。 */
  api: providerApiSchema.optional(),
  authHeader: z.boolean().optional(),
  models: z.array(providerModelSchema).optional(),
  apiKey: z.string().optional(),
});
export type ProviderConfig = z.infer<typeof providerConfigSchema>;

/** 宿主增量工具规格（01 §5 SessionOpts.tools：web_fetch / remote_shell /
 * push_branch / save_memory，02 §4.4/§5.6）；parameters = JSON Schema（typebox
 * 产物的 wire 形 [设计]）。 */
export const toolSpecSchema = z.object({
  name: z.string(),
  label: z.string().optional(),
  description: z.string(),
  parameters: z.unknown().optional(),
});
export type ToolSpec = z.infer<typeof toolSpecSchema>;

/** MCP 端点（01 §5 SessionOpts.mcpServers；02 §7.1：per-turn 连接、失败降级
 * 不阻断；工具名 `mcp__<slug>__<tool>`）。 */
export const mcpEndpointSchema = z.object({
  slug: z.string(),
  transport: z.enum(['http', 'stdio']),
  url: z.string().optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  headers: z.record(z.string(), z.string()).optional(),
});
export type McpEndpoint = z.infer<typeof mcpEndpointSchema>;

/** StepEvent——02 §5.6 pi 流事件词表的会话内 15 件 1:1（01 §5 锁定：
 * `thinking` = thinking 块全文（thinking_end 时机）、`message_stop` = 流被
 * 停止（abort/stop 语义 [推断]）、`done` 携 usage、`error.retryable` 供宿主
 * 重试策略；映射自 pi AgentSessionEvent 的实现归 daemon backend/pi.ts）。 */
export const stepEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text_delta'), text: z.string() }),
  z.object({ type: z.literal('thinking'), text: z.string() }),
  z.object({ type: z.literal('thinking_delta'), text: z.string() }),
  z.object({ type: z.literal('toolcall_end'), call: toolCallRecordSchema }),
  z.object({ type: z.literal('message_update'), message: messageRecordSchema }),
  z.object({ type: z.literal('message_end'), message: messageRecordSchema }),
  z.object({ type: z.literal('message_stop'), message: messageRecordSchema }),
  z.object({ type: z.literal('compaction') }),
  z.object({ type: z.literal('compaction_start') }),
  z.object({ type: z.literal('compaction_end') }),
  z.object({ type: z.literal('auto_retry_start'), attempt: z.number().int() }),
  z.object({ type: z.literal('auto_retry_end'), attempt: z.number().int() }),
  z.object({ type: z.literal('steer'), text: z.string() }),
  z.object({ type: z.literal('done'), usage: agentTokenUsageSchema }),
  z.object({
    type: z.literal('error'),
    error: z.object({ message: z.string(), retryable: z.boolean() }),
  }),
]);
export type StepEvent = z.infer<typeof stepEventSchema>;

/** StepEvent type 词表（与 PI_STREAM_EVENTS 前 15 件一致 = 01 §5「1:1 不得
 * 增删改名」的静态自检面；vocabulary.test 对拍）。 */
export const STEP_EVENT_TYPES = stepEventSchema.options.map(
  (o) => o.shape.type.value,
) as readonly string[];

// —— 01 §5 接口签名（TS 面原样；zod 面 = 上方 wire schema）———————————————

export interface AgentBackendCapabilities {
  readonly name: string; // 'pi'
  /** 配置面「思考强度」（02 §6.2 agent 形状）；pi 七档（docs/sdk.md）。 */
  readonly thinkingLevels: readonly string[];
  /** anthropic/openai-codex/github-copilot/xai（#34 锁定订阅项，02 §5.6）。 */
  readonly oauthProviders: readonly string[];
  readonly compaction: boolean;
  /** continue session（合并轮复用，02 §4.2）。 */
  readonly sessionResume: boolean;
}

export interface SessionOpts {
  /** kind: api_key | oauth | http（02 §5.6 配置 kind）。 */
  provider: ProviderConfig;
  modelId: string;
  thinkingLevel?: string;
  /** memory 注入经 pi before_agent_start 缝（00/D3、02 §4.4）。 */
  systemPrompt?: string;
  /** web_fetch / remote_shell / push_branch / save_memory（宿主增量）。 */
  tools?: ToolSpec[];
  /** remoteTools 定义（chief 步服务端工具，protocol/chief-tools.ts；位形一手
   * = bundle makeRemoteTools 读 step.remoteTools，r5 §3.1）。backend 把每条映射
   * 为 pi customTool，execute → executeRemoteTool relay 回传服务端执行。 */
  remoteTools?: import('./protocol/chief-tools.js').RemoteToolDef[];
  /** remoteTools relay 执行回调（runner 注入 = POST /api/machine/tool/<stepId>
   * {name, params} → {text}）；返回结果文本（r5 §3.1 bundle text() 形）。 */
  executeRemoteTool?: (name: string, params: Record<string, unknown>) => Promise<string>;
  /** per-turn 连接、失败降级不阻断（02 §7.1）。 */
  mcpServers?: McpEndpoint[];
  /** worktree 目录（02 §5.5）。 */
  cwd: string;
  /** 本轮任务文本（实现期精化，01 §5 头部口径）：createSession = 首条用户
   * 消息（02 §4.2 任务 spec）；continueSession = 续轮消息（驳回 feedback /
   * 合并指令，02 §4.2 确认回路）。缺省 = 开会话不发轮（Chief 面板形态）。 */
  prompt?: string;
}

export interface AgentSessionHandle {
  /** 引擎侧会话标识（实现期精化）：done 回传 server（step.sessionId），
   * continueSession(id) 的解析键——宿主 durable 编排的会话持久化索引面
   * （00/D3：durable 语义宿主自持）。 */
  readonly sessionId: string;
  readonly events: AsyncIterable<StepEvent>;
  steer(text: string): Promise<void>;
  stop(): Promise<void>;
  /** build × model × {输入,输出,缓存读,缓存写}（02 §6.2）。 */
  usage(): AgentTokenUsage;
}

export interface AgentBackend {
  readonly capabilities: AgentBackendCapabilities;
  /** new session <convId>（02 §5.7 步骤生命周期行）。 */
  createSession(opts: SessionOpts): Promise<AgentSessionHandle>;
  /** continue session <convId>（02 §5.7；id = 会话持久化标识，实现自定——
   * pi 侧 = sessionId/sessionFile，daemon chat-sessions/ 索引解析）。 */
  continueSession(id: string, opts: SessionOpts): Promise<AgentSessionHandle>;
}

/** 会话持久化标识（continueSession 的 id 形）：宿主 durable 编排面——
 * buildId ≡ conversationId（CONTEXT.md）+ 引擎侧 sessionId 双记录 [设计]。 */
export const sessionRefSchema = z.object({
  conversationId: recordId,
  sessionId: z.string().nullable(),
});
export type SessionRef = z.infer<typeof sessionRefSchema>;
