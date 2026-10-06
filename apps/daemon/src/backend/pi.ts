// AgentBackend 缝的 pi 实现（00/D1、01 §5/§4.3：pi 0.86.0 AgentSession 稳定面）。
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
import { homedir, hostname } from 'node:os';
import { join } from 'node:path';
import {
  type AgentSession,
  createAgentSession,
  createBashToolDefinition,
  createLocalBashOperations,
  DefaultResourceLoader,
  defineTool,
  formatSkillsForPrompt,
  loadSkills,
  ModelRuntime,
  type ResourceDiagnostic,
  SessionManager,
  SettingsManager,
  type Skill,
} from '@earendil-works/pi-coding-agent';
import type {
  AgentBackend,
  AgentBackendCapabilities,
  AgentSessionHandle,
  AgentTokenUsage,
  BriefChannel,
  DeliveredImage,
  ModelUsage,
  ProviderCompat,
  ProviderConfig,
  SessionOpts,
  StepEvent,
  ToolCallRecord,
} from '@pacman/shared';
import { ENV_VARS, THINKING_LEVELS } from '@pacman/shared';
import { buildGatedBashOperations } from './command-gate.js';
import { SessionNotResumableError } from './errors.js';
import { connectFailedLine, connectMcpBridge } from './mcp-bridge.js';
import {
  enrichProviderError,
  type ProviderResponseSink,
  wrapProviderFetch,
} from './provider-response.js';

/** 02 §6.2/#34：oauth 四家订阅；思考强度 = pi 七档。
 *  档位词表取 shared `THINKING_LEVELS` 单源（XMON-16）——server 的能力读面
 *  要投影同一份词表，而 server 读不到 daemon；常量在此复制一份就是两份真值。 */
export const PI_CAPABILITIES: AgentBackendCapabilities = {
  name: 'pi',
  thinkingLevels: THINKING_LEVELS,
  oauthProviders: ['anthropic', 'openai-codex', 'github-copilot', 'xai'],
  compaction: true,
  sessionResume: true,
};

/** pi 内建工具默认面（02 §5.6：其余工具面 = pi-coding-agent 内建）。 */
const PI_BUILTIN_TOOLS = ['read', 'bash', 'edit', 'write'];

// —— #730 图片交付（pi 面原生支持：prompt(text, {images}) / steer(text,
// images)；pi-ai ImageContent 结构 = {type:'image', data, mimeType}）—————————

/** pi ImageContent 的结构形（pi-ai types.d.ts:256；缝纪律——shared 的
 * DeliveredImage 结构同体，映射 = 补 type 判别位）。 */
interface PiImageContent {
  type: 'image';
  data: string;
  mimeType: string;
}

/** DeliveredImage → pi ImageContent（纯映射，可单测）。 */
export function toPiImages(images: readonly DeliveredImage[]): PiImageContent[] {
  return images.map((img) => ({ type: 'image' as const, data: img.data, mimeType: img.mimeType }));
}

/** input 能力钉翻转（#730 堵点，票面要求如实记录）：pi 按 model.input 决定
 * 图片真上送还是静默降级成 "(image omitted: model does not support images)"
 * 占位文本（pi-ai transform-messages downgradeUnsupportedImages）。daemon
 * 物化的 CUSTOM_MODEL_DEFAULTS input:['text'] 会让本步图片全数降级——本步
 * 真带图片时把**该会话的** model 对象翻到含 'image'：图片上送、网关/模型
 * 拒绝时错误可见（#708 链）。幂等：已含 'image' 不重复。 */
export function ensureImageInput(model: { input: ('text' | 'image')[] }): void {
  if (model.input.includes('image')) return;
  model.input = [...model.input, 'image'];
}

/** 只读回合的内建工具面（#511 审核步）：写类工具（edit/write）不下发——审核
 * 者是来判定的，不是来动手的；bash 保留（跑验证命令是它的职责，也是「验证」
 * 与「通读」的分界）。单源 = SessionOpts.readOnly 的落点，宿主无从旁路。 */
const PI_READONLY_TOOLS = ['read', 'bash'];

/** SessionOpts.readOnly → 内建工具名集（纯函数，供 backend 构建与测试共用）。 */
export function builtinToolNames(readOnly: boolean): readonly string[] {
  return readOnly ? PI_READONLY_TOOLS : PI_BUILTIN_TOOLS;
}

/** 会话工具面 = readOnly 判据下的内建面 + remoteTools relay + MCP 工具名
 * + localTools（daemon 本地执行面）。
 * 只读只摘写类内建工具（edit/write），relay / MCP / 本地面照旧——审核者仍要能
 * 用服务端工具与已授权 MCP 取事实。 */
export function sessionToolNames(opts: {
  readOnly: boolean;
  remoteTools: readonly string[];
  mcpTools: readonly string[];
  localTools?: readonly string[];
}): string[] {
  return [
    ...builtinToolNames(opts.readOnly),
    ...opts.remoteTools,
    ...opts.mcpTools,
    ...(opts.localTools ?? []),
  ];
}

// —— skills 执行面注入（spec 14/#371）————————————————————————
// catalog 是索引不全文：token 预算只与 catalog 长度线性相关，skill 全文由
// agent 按 description 匹配时经 read 工具（location 绝对路径）按需加载。

/** catalog 总数闸（spec 14：catalog 不能无限增长；阈值 lane 内定 50）。 */
export const SKILLS_CATALOG_CAP = 50;
/** 单 description 截断闸（spec 14：200 字符 + 末尾 `…`）。 */
export const SKILL_DESCRIPTION_CAP = 200;

/** 保证不存在的 pi 默认 agentDir（spec 14：强制 loadSkills 跳过 user 级默认
 * 扫描——includeDefaults:false 下 agentDir 仅参与 source 标注，传不存在路径
 * 杜绝任何静默默认加载）。 */
const NO_PI_DEFAULT_AGENT_DIR = join(homedir(), '.pacman-no-such', 'agent');

/** pi 诊断 → `[skills] <type>:` 词表归类（spec 14 日志族：collision /
 * invalid-frontmatter / missing-skill-md；其余 warning/error → invalid 透传）。
 * pi 诊断 message 为自由文本，归类按语义关键词 [推断]。 */
function classifySkillDiagnostic(d: ResourceDiagnostic): string {
  if (d.type === 'collision') return 'collision';
  if (/does not exist|ENOENT|no such file/i.test(d.message)) return 'missing-skill-md';
  if (/^(name|description)\b|frontmatter|parse/i.test(d.message)) return 'invalid-frontmatter';
  return 'invalid';
}

export interface SkillsCatalogOpts {
  /** 扫描根（PACMAN_SKILLS_DIR；目录缺失 = 空集非致命，pi 出诊断行）。 */
  skillsDir: string;
  /** loadSkills 的 cwd = daemon home（非任务 worktree——project 级解析不随
   * worktree 切换跳变，spec 14 Implementation Decisions）。 */
  cwd: string;
  /** per-agent 白名单（#372，SessionOpts.skillsAllowlist 透传）：slug 集
   * （frontmatter name 回落目录名，#367 wire 模型同源）。undefined = 全量
   * 直通（chief 面）；[] = 不注入任何 skill（与 MCP 空勾选同律）；名单内
   * 未知 slug（目录已删）静默跳过。过滤先于 cap 闸——白名单内条目不受
   * 目录总量截顶影响。 */
  allowlist?: string[];
  /** 团队技能物化目录（XMON-112 S2，spec 14 增补）：排在本机 skillsDir 之前
   * 扫描——pi loadSkills first-wins（先进 Map 者为 winner），同名冲突团队条目
   * 胜、本机影子进 collision 诊断行（loser）。cap 闸对合并后序列生效，团队
   * 条目优先占据 cap 名额。缺省 = 纯本机扫描（输出与旧行为逐字节等价）。 */
  teamSkillsDir?: string;
  /** `[skills] <type>: <msg>` 诊断行出口（machine-loop 接 logger.skills）。 */
  log?: (msg: string) => void;
}

/** 扫描 skills 目录 → `<available_skills>` catalog XML 串（空串 = 无可注入
 * skills）。loadSkills 抛错（权限等）降级空集 + invalid 行，不阻断会话创建
 * （spec 14 Premortem 护栏）。 */
export function buildSkillsCatalog(opts: SkillsCatalogOpts): string {
  const log = opts.log;
  let skills: Skill[];
  let diagnostics: ResourceDiagnostic[];
  try {
    const result = loadSkills({
      cwd: opts.cwd,
      agentDir: NO_PI_DEFAULT_AGENT_DIR,
      // 团队目录在前 = first-wins 冲突裁决的胜出序（XMON-112 S2）；缺省时
      // skillPaths 与旧行为完全一致（零回归判据的扫描面）。
      skillPaths:
        opts.teamSkillsDir !== undefined ? [opts.teamSkillsDir, opts.skillsDir] : [opts.skillsDir],
      includeDefaults: false,
    });
    skills = result.skills;
    diagnostics = result.diagnostics;
  } catch (err) {
    log?.(`invalid: ${err instanceof Error ? err.message : String(err)}`);
    return '';
  }
  for (const d of diagnostics) {
    const where =
      d.collision !== undefined
        ? ` (winner=${d.collision.winnerPath} loser=${d.collision.loserPath})`
        : d.path !== undefined
          ? ` (${d.path})`
          : '';
    log?.(`${classifySkillDiagnostic(d)}: ${d.message}${where}`);
  }
  // per-agent 白名单过滤（#372）：先于 cap 闸——白名单是授权语义（谁能进
  // catalog），cap 是预算语义（进者截顶）；顺序颠倒会让目录总量把授权条目
  // 挤掉。名单内未知 slug 无对应 skill，天然静默跳过（#367 容忍语义）。
  if (opts.allowlist !== undefined) {
    const allowed = new Set(opts.allowlist);
    const kept: Skill[] = [];
    for (const s of skills) {
      if (allowed.has(s.name)) kept.push(s);
      else log?.(`filtered: ${s.name} not in agent allowlist`);
    }
    skills = kept;
  }
  if (skills.length > SKILLS_CATALOG_CAP) {
    log?.(`cap: total=${skills.length} truncated=${SKILLS_CATALOG_CAP}`);
    skills = skills.slice(0, SKILLS_CATALOG_CAP);
  }
  skills = skills.map((s) => {
    if (s.description.length <= SKILL_DESCRIPTION_CAP) return s;
    log?.(`cap: description truncated for ${s.name}`);
    return { ...s, description: `${s.description.slice(0, SKILL_DESCRIPTION_CAP)}…` };
  });
  if (skills.length > 0) {
    log?.(
      opts.teamSkillsDir !== undefined
        ? `loaded: ${skills.length} skills from ${opts.teamSkillsDir} + ${opts.skillsDir}`
        : `loaded: ${skills.length} skills from ${opts.skillsDir}`,
    );
  }
  return formatSkillsForPrompt(skills, 'read');
}

/** catalog 追加语义（spec 14 数据契约：追加到 systemPrompt 末尾而非覆盖；
 * formatSkillsForPrompt 产物自带 `\n\n` 前导分隔，base 在位时直接拼接；
 * base 缺省时剥前导空行独立成 prompt）。 */
export function appendSkillsCatalog(base: string | undefined, catalog: string): string | undefined {
  if (catalog === '') return base;
  if (base === undefined || base === '') return catalog.replace(/^\n+/, '');
  return base + catalog;
}

/** 后端简报通道共用的技能目录构造（#958）。pi 与 claude-code 的 skills 注入面
 * 同形（claude-code.ts 直接从本模块导入本函数族），抽出来是因为简报改由 runner
 * 组装——而目录构造吃的是**后端私有**的 skillsDir 与 cwd（spec 14 §49：cwd 用
 * daemon home 而非任务 worktree，避免 project 级解析随 worktree 切换跳变），
 * runner 侧面拿不到这份配置。 */
export function composeSkillsSection(
  skills: { skillsDir: string; cwd: string } | undefined,
  opts: { skillsAllowlist?: string[]; teamSkillsDir?: string },
  log?: (msg: string) => void,
): string {
  if (!skills) return '';
  return buildSkillsCatalog({
    skillsDir: skills.skillsDir,
    cwd: skills.cwd,
    ...(opts.skillsAllowlist !== undefined ? { allowlist: opts.skillsAllowlist } : {}),
    ...(opts.teamSkillsDir !== undefined ? { teamSkillsDir: opts.teamSkillsDir } : {}),
    ...(log ? { log } : {}),
  });
}

/** models.json custom provider 占位 key（真 key 走 setRuntimeApiKey 内存态）。 */
const MODELS_JSON_KEY_PLACEHOLDER = 'per-step';

// —— 协议 400 自适配（#654，Multica client.go「按错误回落」同律）——————————
// pi 对未知自定义端点的默认请求形带现代字段（max_completion_tokens +
// store:false），部分网关通道确定性拒绝（错误面 = 400「Model does not
// support this protocol」）。pi 内建重试同形重发恒败；本层做两件事：
// ① 记录/wire compat 旋钮物化进 models.json（显式配置面）；② 撞上错误
// 签名时翻旋钮 + 步内回落重试一次，并把翻过的旋钮记进程内学习——后续步
// 直接以干净形态物化（daemon 重启清零，首次撞错付一次学费）。

/** 进程内学习面：providerId → 已翻旋钮。物化时并入（只填未设置位——
 * 显式配置压过学习）。 */
const learnedCompat = new Map<string, ProviderCompat>();

/** server 配置快照（#708 失败方式 3）：providerId → 最近一次物化时的 server
 * 侧 compat 载荷。变更（PATCH 增/删/改任一位）→ 该 provider 的学习作废——
 * 否则学习位会把被删除的旧形填回去，配置改动须重启 daemon 才生效（#519
 * run4 实测形态）。快照未变时学习照旧补位（#654「学费一次」语义零回归）。
 * pi 侧无此问题：ModelRuntime 每次会话创建重建（models.json 磁盘重读）。 */
const lastServerCompat = new Map<string, string>();

/** 错误签名 → 待翻旋钮。只认 upstream 明示的不兼容（Multica
 * isUnsupportedParameter 同律不猜）：relay 的协议 400 原文点名不了字段，
 * 一律翻到最大兼容的旧式形（max_tokens + 无 store——mea shim 实测 229 调用
 * 零重试耗尽的形态）；OpenAI 形 unsupported parameter 只翻被点名的字段。 */
export function protocolCompatFlip(errorMessage: string): Partial<ProviderCompat> | null {
  if (/model does not support this protocol/i.test(errorMessage)) {
    return { maxTokensField: 'max_tokens', supportsStore: false };
  }
  if (/unsupported parameter[^\n]*max_completion_tokens/i.test(errorMessage)) {
    return { maxTokensField: 'max_tokens' };
  }
  if (/unsupported parameter[^\n]*\bstore\b/i.test(errorMessage)) {
    return { supportsStore: false };
  }
  return null;
}

/** 按错误回落（AgentBackend.adaptProviderCompat 的 pi 实现）：签名命中 →
 * 返回翻了 compat 旋钮的 provider 配置并记录学习；null = 未命中/无端点/
 * 旋钮已全在目标态（无可翻即不重试，防循环）。 */
export function adaptProviderCompat(
  provider: ProviderConfig,
  errorMessage: string,
): ProviderConfig | null {
  if (!provider.baseUrl) return null; // preset / runtime 惰性位无请求形态可翻
  const flip = protocolCompatFlip(errorMessage);
  if (flip === null) return null;
  const next: ProviderCompat = {
    ...learnedCompat.get(provider.providerId),
    ...provider.compat,
    ...flip,
  };
  const prior: ProviderCompat = { ...learnedCompat.get(provider.providerId), ...provider.compat };
  if (prior.maxTokensField === next.maxTokensField && prior.supportsStore === next.supportsStore) {
    return null; // 已在目标态仍同错 = 旋钮救不了（坏通道轮询面归 pi 重试）
  }
  learnedCompat.set(provider.providerId, next);
  return { ...provider, compat: next };
}

/** 自定义端点模型默认值 [设计]（contextWindow 128k = r3 §2 展示默认）。
 * maxTokens 16k：思考型模型单回合推理可占 1-6k token，4096 会在推理阶段
 * 就把输出额度耗尽——回合以「无工具调用、无正文」收场，与「模型主动不作
 * 为」不可分辨。 */
const CUSTOM_MODEL_DEFAULTS = {
  reasoning: false,
  input: ['text'] as ('text' | 'image')[],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128_000,
  maxTokens: 16_384,
};

/** 开关：`PACMAN_CUSTOM_MODEL_REASONING=1` 时，自定义端点的模型条目改标
 * `reasoning: true` 并附档位映射——pi 据此下发 `reasoning_effort`，思考深度才
 * 受 `thinkingLevel` 控制。不开时模型条目维持原样（pi 当它不推理，档位旋钮
 * 是死的，见 wiki/评测记录里的实测）。
 *
 * 为什么是 opt-in 而不是默认：不同后端对 `reasoning_effort` 的容忍度不同。
 * 实测某 relay 只认 low/high/max，传 `medium` 直接 400——默认打开等于让一部分
 * 自定义端点整条挂掉。
 *
 * 映射只写该 relay 确认接受的取值（none/low/high/max），并把 pi 的七档单调折到
 * 这四档上；`supportsDeveloperRole:false` 是必需的：`reasoning:true` 会把系统
 * 提示词的角色从 system 换成 developer（pi 的 instructionRole 判定），钉住它才
 * 保证提示词形态与不开开关时一致。 */
function customModelReasoning(): Record<string, unknown> {
  if (process.env[ENV_VARS.customModelReasoning] !== '1') return {};
  return {
    reasoning: true,
    compat: { supportsDeveloperRole: false },
    thinkingLevelMap: {
      off: 'none',
      minimal: 'low',
      low: 'low',
      medium: 'low',
      high: 'high',
      xhigh: 'high',
      max: 'max',
    },
  };
}

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
  /** 错误文案装饰面（#882）：pi 的结构化错误文案 → 宿主可见文案。宿主注入
   *  「拼上 provider 响应真实形态」的闭包；缺省 = 原样（既有调用面零回归，
   *  纯映射面不 import 诊断模块）。 */
  diagnose?: (message: string) => string;
}

export function newMapState(opts?: { diagnose?: (message: string) => string }): MapState {
  return {
    usage: new Map(),
    calls: new Map(),
    ...(opts?.diagnose !== undefined ? { diagnose: opts.diagnose } : {}),
  };
}

function toMessageRecord(msg: PiMessageLike): {
  role: 'system' | 'user' | 'assistant';
  content: unknown;
  /** 终态位（#708）：pi 结构化错误面（assistant errorMessage 的 message_end
   * 携 stopReason=error）。messageRecordSchema loose 透传，不改 wire 面；
   * runner 消费判「错误行不是进展」（auto_retry 生命周期 / #654 回落闸）。 */
  stopReason?: string;
} {
  const role =
    msg.role === 'assistant' ? 'assistant' : msg.role === 'user' ? 'user' : ('system' as const);
  return {
    role,
    content: msg.content ?? null,
    ...(msg.stopReason !== undefined ? { stopReason: msg.stopReason } : {}),
  };
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
        // retryable 取**原始**文案（#882 失败方式 7）：追加的响应形态里带着
        // 状态码数字，先判再装饰——否则 `-> 500` 这类事实会把重试语义带偏。
        const retryable = isRetryableError(message);
        out.push({
          type: 'error',
          error: { message: state.diagnose?.(message) ?? message, retryable },
        });
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
  private readonly state: MapState;
  private closed = false;
  private stopping = false;

  constructor(
    private readonly session: AgentSession,
    private readonly model: { input: ('text' | 'image')[] } | null,
    private readonly onDispose?: () => void,
    diagnose?: (message: string) => string,
  ) {
    this.sessionId = session.sessionId;
    this.state = newMapState(diagnose !== undefined ? { diagnose } : undefined);
    this.events = this.queue.iterable();
    session.subscribe((event) => {
      for (const mapped of mapPiSessionEvent(
        event as unknown as AgentSessionEventLike,
        this.state,
      )) {
        // 停止钮 abort（M7 #308）：pi 在 abort 时同步发出的终局 done 是中断
        // 产物、非自然完成——吞掉不 push（runner 的 sawDone 判定依赖
        // done = 自然收尾语义；usage 累计在 state，handle.usage() 兜底）。
        if (this.stopping && mapped.type === 'done') continue;
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
    this.onDispose?.(); // per-turn 资源释放（MCP 桥 close，02 §7.1）
  }

  async steer(text: string, images?: readonly DeliveredImage[]): Promise<void> {
    // #730：随话图片先翻本会话的 input 能力钉（见 ensureImageInput 注释），
    // 再进 pi 的 steer(text, images) —— pi SDK 双参原生支持。
    if (images !== undefined && images.length > 0 && this.model !== null) {
      ensureImageInput(this.model);
      await this.session.steer(text, toPiImages(images));
    } else {
      await this.session.steer(text);
    }
    this.queue.push({ type: 'steer', text });
  }

  /** 后端内部错误上浮面（#698）：prompt() 预检拒绝（auth 校验 / compaction
   * 守卫 / input handler 拒绝）在 agent run 之前 throw——无事件无终局，原先
   * 被吞掉会把 runner 挂到流超时看门狗（报看门狗不报真凶）。经此注入事件
   * 面：推 error 事件并收面。幂等：已收面（done 已到）则事件被队列丢弃、
   * finish 重入无副作用。 */
  emitBackendError(message: string): void {
    this.queue.push({ type: 'error', error: { message, retryable: false } });
    this.finish();
  }

  async stop(): Promise<void> {
    this.stopping = true;
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
  /** MCP per-turn 连接降级行出口（runner 接 logger.mcp，r3 §1.5 canon 行形；
   * 02 §7.1 失败降级不阻断）。 */
  onMcpLog?: (msg: string) => void;
  /** skills 执行面注入（spec 14/#371）：skillsDir = PACMAN_SKILLS_DIR 扫描根；
   * cwd = daemon home（project 级解析不随任务 worktree 跳变）。
   * 缺省 = 不注入（既有调用面零回归）。 */
  skills?: { skillsDir: string; cwd: string };
  /** `[skills]` 诊断行出口（machine-loop 接 logger.skills，与 onMcpLog 同型）。 */
  onSkillsLog?: (msg: string) => void;
  /** `[gate]` 裁决行出口（#866 T5 命令闸：machine-loop 接 logger.gate；只记
   * 非放行裁决，allow 静默）。缺省 = 仍门控，只是不落行。 */
  onGateLog?: (msg: string) => void;
  /** 本机机器名（#882：非 SSE 响应诊断文案的「哪台机器」位；缺省 =
   * os.hostname()）。与 #867 同值来源 = config.name。 */
  machineName?: string;
}

export class PiBackend implements AgentBackend {
  readonly capabilities = PI_CAPABILITIES;

  /** 简报文件通道（#958）：pi 的 resource-loader 原生就读 cwd 的上下文文件
   * （候选序 `AGENTS.override.md > AGENTS.md > AGENTS.MD > CLAUDE.md > CLAUDE.MD`，
   * first-wins），且 `systemPromptOverride` 只替换 customPrompt、不抑制这条加载。
   * 故简报写进那个文件即被引擎读到，无需任何后端侧改动。 */
  readonly brief: BriefChannel = {
    backendId: 'pi',
    composeBody: (opts, base) =>
      appendSkillsCatalog(
        base,
        composeSkillsSection(this.opts.skills, opts, this.opts.onSkillsLog),
      ) ?? '',
  };

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

  /** #654 协议 400 自适配（AgentBackend 可选面；纯函数转发——学习态在模块
   * 级 Map，open() 物化时消费）。 */
  adaptProviderCompat(provider: ProviderConfig, errorMessage: string): ProviderConfig | null {
    return adaptProviderCompat(provider, errorMessage);
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
    // —— #882 非 SSE 响应诊断：把记录用的 fetch 接进 provider 请求面 ——
    // pi 的请求选项有 `fetch` 位（pi-ai types.d.ts `ProviderRequestOptions.fetch`；
    // 三家适配器都消费：openai-completions / openai-responses / anthropic-messages），
    // 而 pi-coding-agent 的 createAgentSession 没有把它暴露出来——唯一的接点
    // 是本会话 runtime 的 streamSimple（会话级私有对象，开出即抛，不外泄）。
    // 包一层只做「旁路记录 + 原样返回」：请求与响应都不改写，适配器不吃这个
    // 位时整条诊断静默降级（fail-open，见 provider-response.ts）。
    const providerResponses: ProviderResponseSink = { current: null };
    const diagnosedFetch = wrapProviderFetch(globalThis.fetch, providerResponses);
    const streamSimple = runtime.streamSimple.bind(runtime);
    runtime.streamSimple = (requestModel, context, options) =>
      streamSimple(requestModel, context, { ...options, fetch: diagnosedFetch });
    const diagnose = (message: string): string =>
      enrichProviderError(message, providerResponses.current, {
        ...(this.opts.machineName !== undefined
          ? { machineName: this.opts.machineName }
          : { machineName: hostname() }),
        ...(opts.provider.baseUrl !== undefined ? { providerBaseUrl: opts.provider.baseUrl } : {}),
      });
    // skills catalog 的落点自 #958 起归简报文件通道（见 this.brief）：目录内容由
    // `composeSections` 产出、runner 写进 worktree 的上下文文件，不再追加进
    // systemPrompt。这里只透传 runner 给的 systemPrompt——**只有**不具备简报
    // 通道的后端才会拿到非空值。空集 = 不覆盖引擎自身的 system prompt。
    const settingsManager = SettingsManager.inMemory({ compaction: { enabled: true } });
    const loader = new DefaultResourceLoader({
      cwd: opts.cwd,
      agentDir: this.opts.agentDir,
      settingsManager,
      ...(opts.systemPrompt !== undefined ? { systemPromptOverride: () => opts.systemPrompt } : {}),
    });
    await loader.reload();
    const sessionManager = resumeFile
      ? SessionManager.open(resumeFile, this.opts.sessionDir, opts.cwd)
      : SessionManager.create(opts.cwd, this.opts.sessionDir);
    // remoteTools → pi customTools（r5 §3.1 bundle makeRemoteTools 同构）：每条
    // execute 经 opts.executeRemoteTool relay 回传服务端执行；拒绝/传输失败 →
    // 结果文本（bundle text(msg) 形，pi 侧照常消费，不抛断回合）。
    const remoteTools = opts.remoteTools ?? [];
    const relay = opts.executeRemoteTool;
    const customTools =
      remoteTools.length > 0 && relay
        ? remoteTools.map((def) =>
            defineTool({
              name: def.name,
              label: def.label ?? def.name,
              description: def.description,
              // parameters = JSON Schema（typebox 产物 wire 形，protocol/chief-tools.ts）。
              parameters: (def.parameters ?? { type: 'object', properties: {} }) as never,
              execute: async (_id: string, params: Record<string, unknown>) => {
                try {
                  const text = await relay(def.name, params ?? {});
                  return { content: [{ type: 'text' as const, text }], details: {} };
                } catch (err) {
                  const msg = err instanceof Error ? err.message : String(err);
                  return {
                    content: [{ type: 'text' as const, text: `${def.name} rejected: ${msg}` }],
                    details: {},
                  };
                }
              },
            }),
          )
        : [];
    // daemon 本地工具（02 §8：团队密钥取用通道的落点）：位形同 remoteTools，
    // 差别只在 execute 在 daemon 进程内跑（不经 relay、不出机器）——值不进
    // 子进程环境，只有 agent 显式调用这一次会拿到文本。
    const localTools = (opts.localTools ?? []).map((def) =>
      defineTool({
        name: def.name,
        label: def.label ?? def.name,
        description: def.description,
        parameters: (def.parameters ?? { type: 'object', properties: {} }) as never,
        execute: async (_id: string, params: Record<string, unknown>) => {
          try {
            const text = await def.execute(params ?? {});
            return { content: [{ type: 'text' as const, text }], details: {} };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return {
              content: [{ type: 'text' as const, text: `${def.name} failed: ${msg}` }],
              details: {},
            };
          }
        },
      }),
    );
    // MCP 薄桥（00/D4、02 §7.1）：per-turn 连接已授权 server → `mcp__<slug>__
    // <tool>` 工具面；单点失败降级不阻断（canon 行经 onMcpLog）。
    const mcpBridge =
      opts.mcpServers && opts.mcpServers.length > 0
        ? await connectMcpBridge(opts.mcpServers, {
            ...(this.opts.onMcpLog
              ? {
                  onConnectFailed: (slug: string, reason: string) => {
                    this.opts.onMcpLog?.(connectFailedLine(slug, reason));
                  },
                }
              : {}),
          })
        : null;
    const mcpTools = (mcpBridge?.tools ?? []).map((t) =>
      defineTool({
        name: t.name,
        label: t.name,
        description: t.description,
        // 远端 inputSchema 原样透传（relay 同族机制，M4a/#81 已坐实 pi
        // customTools 接受原始 JSON Schema）。
        parameters: (t.inputSchema ?? { type: 'object', properties: {} }) as never,
        execute: async (_id: string, params: Record<string, unknown>) => {
          try {
            const text = await t.call(params ?? {});
            return { content: [{ type: 'text' as const, text }], details: {} };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return {
              content: [{ type: 'text' as const, text: `${t.name} rejected: ${msg}` }],
              details: {},
            };
          }
        },
      }),
    );
    // 命令闸（#866 T5）：门控 bash 以同名 customTool 覆盖内建 bash（pi 注册
    // 表按名后写胜出，执行/定义/提示面一致走覆盖后；定义仍是 pi 自家的
    // createBashToolDefinition——描述/schema/流式/截断/超时/exit 码文案与内建
    // 同一，只把 operations.exec 换成门控版）。defineTool 包一层保参数推断
    // （与 remoteTools/localTools 同形，customTools 数组元素类型统一）。
    // 放行命令行为零差；ask/reject 抛拒绝进 tool error 结果（agent 可见改道
    // 文案）+ [gate] 行（allow 静默）。
    const gatedBash = defineTool(
      createBashToolDefinition(opts.cwd, {
        operations: buildGatedBashOperations(createLocalBashOperations(), {
          ...(this.opts.onGateLog ? { log: this.opts.onGateLog } : {}),
        }),
      }),
    );
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
      tools: sessionToolNames({
        readOnly: opts.readOnly === true,
        remoteTools: remoteTools.map((t) => t.name),
        mcpTools: mcpTools.map((t) => t.name),
        localTools: localTools.map((t) => t.name),
      }),
      ...(customTools.length > 0 || mcpTools.length > 0 || localTools.length > 0
        ? { customTools: [gatedBash, ...customTools, ...localTools, ...mcpTools] }
        : { customTools: [gatedBash] }),
    });
    this.opts.onSession?.(session.sessionId, session.sessionFile);
    const handle = new PiSessionHandle(
      session,
      model,
      () => {
        if (mcpBridge) void mcpBridge.close();
      },
      diagnose,
    );
    // #730 首轮图片交付：promptImages 随 prompt 进会话（pi PromptOptions.
    // images 原生面）。先翻本会话的 input 能力钉（ensureImageInput）——
    // models.json 的 CUSTOM_MODEL_DEFAULTS input:['text'] 是 daemon 物化的
    // 目录默认值（pi 据此把图片静默降级成占位文本），本步真带图片时翻到
    // ['text','image']：图片上送，网关/模型不支持时错误可见（#708 链），
    // 不静默假装看过。翻的域 = 该会话的 model 对象引用（MaterialRuntime
    // getModel 返回、createAgentSession 持有同引用）——不写回 models.json，
    // 不影响其它步（票面失败方式 9：不许全局翻开）。
    if (opts.prompt !== undefined) {
      const promptImages =
        opts.promptImages !== undefined && opts.promptImages.length > 0
          ? opts.promptImages
          : undefined;
      if (promptImages !== undefined) {
        ensureImageInput(model);
      }
      const sent =
        promptImages !== undefined
          ? session.prompt(opts.prompt, { images: toPiImages(promptImages) })
          : session.prompt(opts.prompt);
      void sent.catch((err: unknown) => {
        // 运行期失败经事件面报告（message_end stopReason=error / agent_end）；
        // 预检拒绝（auth / compaction 守卫 / input handler）在 agent run 之前
        // throw、无事件面——原先静默吞掉，runner 只能挂到流超时看门狗。转成
        // error 事件 + 收面（#698）：步快速 failed 且文案是真凶。图片附件
        // 路径（#730）同走这一收面。
        const message = err instanceof Error ? err.message : String(err);
        handle.emitBackendError(`session.prompt rejected: ${message}`);
      });
    }
    return handle;
  }
}

/** compat 旋钮合并：显式配置（wire/record）压过进程内学习（学习只填未设
 * 置位）。产物只含已设置键——缺省位留给 pi 端点探测默认（既有 provider
 * 零行为漂移：无 compat 的行物化产物与旧行为逐字节同形）。 */
function mergedCompat(provider: ProviderConfig): ProviderCompat | undefined {
  const merged: ProviderCompat = {
    ...learnedCompat.get(provider.providerId),
    ...provider.compat,
  };
  const hasAny =
    merged.supportsDeveloperRole !== undefined ||
    merged.maxTokensField !== undefined ||
    merged.supportsStore !== undefined;
  return hasAny ? merged : undefined;
}

/** custom provider（baseUrl 形态）物化进 models.json（pi 自定义模型机制，
 * docs/models.md）；apiKey 恒占位符——真 key 走 setRuntimeApiKey（02 §8）。
 * compat（#654）写 provider 级条目——pi provider-composer modelFromJson 对
 * provider compat 与模型条目做浅合并（getCompat 以显式位覆盖探测默认）。
 * server compat 载荷与上次物化不同 → 学习作废（#708 失败方式 3：配置变更
 * 即时生效，不留学习位旧形回流）。 */
export function materializeProvider(modelsPath: string, provider: ProviderConfig): void {
  if (!provider.baseUrl) return; // preset provider 走 pi 内建目录
  // 配置变更判定先于学习并入（#708）：快照在位且载荷不同 → 作废该 provider
  // 的学习位；同载荷重复物化不动它。首见（无快照）不动——学习的学费期。
  const serverCompatKey = JSON.stringify(provider.compat ?? null);
  if (
    lastServerCompat.has(provider.providerId) &&
    lastServerCompat.get(provider.providerId) !== serverCompatKey
  ) {
    learnedCompat.delete(provider.providerId);
  }
  lastServerCompat.set(provider.providerId, serverCompatKey);
  const raw = existsSync(modelsPath)
    ? (JSON.parse(readFileSync(modelsPath, 'utf8')) as {
        providers?: Record<string, Record<string, unknown>>;
      })
    : {};
  const providers = raw.providers ?? {};
  const compat = mergedCompat(provider);
  providers[provider.providerId] = {
    baseUrl: provider.baseUrl,
    api: provider.api ?? 'openai-completions',
    apiKey: MODELS_JSON_KEY_PLACEHOLDER,
    ...(provider.authHeader !== undefined ? { authHeader: provider.authHeader } : {}),
    ...(compat !== undefined ? { compat } : {}),
    models: (provider.models ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      ...CUSTOM_MODEL_DEFAULTS,
      ...customModelReasoning(),
    })),
  };
  writeFileSync(modelsPath, `${JSON.stringify({ providers }, null, 2)}\n`, 'utf8');
}

export function createPiBackend(opts: PiBackendOpts): AgentBackend {
  return new PiBackend(opts);
}
