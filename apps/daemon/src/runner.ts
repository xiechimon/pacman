// step 单会话执行（03 M3a：claim → pi 会话 → transcript 回传落库）。
// 生命周期日志行序 canon = 02 §5.7（`step <id> for conv <uuid> (n running)`
// → `using model <provider>/<modelId>` → workspace 准备 → `new session <convId>`
// / `continue session <convId>` → `finished (m running)`；`pushed <convBranch>`
// 行属 git 面，归 M3b）。
// journal 状态机（02 §5.4 recover 细节 [推断] = 04 附录 A 自定等价物）：
// claimed → running → awaiting-upload →（done | failed）；中断残留由
// machine-loop recover 面对账续跑。

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  AgentBackend,
  AgentSessionHandle,
  AgentTokenUsage,
  ClaimedStep,
  CommitIdentity,
  LocalToolDef,
  PreparedWorkspace,
  ProviderConfig,
  SessionOpts,
  WorktreeOps,
} from '@pacman/shared';
import {
  AGENT_TOOL_MERGE,
  AGENT_TOOL_PUSH,
  buildTaskPromptText,
  CONTINUE_PROMPTS,
  FIXED_TAGS,
  isBackendRuntimeId,
  LOCAL_TOOL_CREATE_TAG,
  LOCAL_TOOL_REMOTE_SHELL,
  PLAN_FILE_NAME,
  parseReviewPromptMeta,
  REMOTE_TOOL_RETRY_DELAYS_MS,
  type ReviewGate,
  STREAM_TIMEOUTS_MS,
  stepTakesSecrets,
  transcriptPromptRowId,
} from '@pacman/shared';
import { SessionNotResumableError } from './backend/errors.js';
import { notInConfigLine, resolveMcpEndpoints } from './backend/mcp-config.js';
import { clearCredentials, pushCredential } from './credentials.js';
import { type StepJournal, TranscriptBuffer } from './journal.js';
import type { DaemonLogger } from './log.js';
import type { MachineApi } from './machine-client.js';
import { extractReviewVerdict } from './review-findings.js';
import { buildSecretTool } from './secret-channel.js';
import { buildRemoteShellTool } from './shell-channel.js';
import type { StatePaths } from './state.js';
import { buildCreateTagTool } from './tag-tool.js';
import { materializeTeamSkills } from './team-skills.js';

/** 停止请求（M7 #308）：discard = 确认弹层「丢弃本轮修改」勾选位——
 * true 时收尾 rewind worktree 到步起点 checkpoint（r9 §3.3）。 */
export interface StopRequest {
  discard: boolean;
}

export interface RunStepDeps {
  client: MachineApi;
  journal: StepJournal;
  /** per-step 后端解析（spec 17 A3 唯一分叉点）：入参 = claim 载荷的
   * agent.provider 原值（null / custom provider id / runtime 身份），
   * runtime 身份（∈ BACKEND_RUNTIME_IDS）→ claude-code 后端，否则 → pi。
   * machine-loop 注入（懒初始化 registry）；单测注入固定值。 */
  backendFor: (agentProviderId: string | null | undefined) => AgentBackend;
  logger: DaemonLogger;
  paths: StatePaths;
  workspacesDir: string;
  /** 本机 MCP config 路径（spec 13/#368：claim slug 列表在此解析成执行
   * 端点；machine-loop 从 config.mcpConfigPath 注入）。 */
  mcpConfigPath: string;
  /** worktree 契约面（02 §5.5；machine-loop 注入共享实例——projectLock 跨步
   * 串行化需要单例）。缺省且步带 repo 绑定 = 配置错误，按 failed 收尾。 */
  workspace?: WorktreeOps;
  /** 在跑 session 句柄注册表（W3 #279 steer 投递面）：machine-loop 持有，
   * runStep 装卸（handle 创建即注册、各收尾路径注销），machine-loop 的
   * deliverSteer 按 stepId 消费。缺省 = 无 steer 面（单测形态）。 */
  sessionHandles?: Map<string, AgentSessionHandle>;
  /** 停止请求旗标（M7 #308 stop 投递面）：machine-loop deliverStop 拉取-
   * 确认后置位，runStep 事件流结束后消费判 stopped 收尾。缺省 = 无 stop
   * 面（单测形态）。 */
  stopRequests?: Map<string, StopRequest>;
  /** heartbeat 节奏 [设计]（r3 未采具体值；presence 同族 ~30s）。 */
  heartbeatIntervalMs?: number;
  now?: () => number;
}

export interface RunStepOptions {
  /** recover 续跑：已有 journal 条目（continue session 解析用）。 */
  resume?: { sessionId: string | null; prompt: string | null };
  /** 已认领的运行数（canon 行 `(n running)` 的 n）。 */
  running?: number;
  /** 流超时三臂覆盖（测试注入毫秒级；缺省 = 02 §5.6 r3 三值）。 */
  streamTimeouts?: { first: number; idle: number; body: number };
  /** 步级流时长上界覆盖（测试注入；缺省 = env PACMAN_STREAM_DURATION_CAP_MS
   * 或 STREAM_DURATION_CAP_DEFAULT_MS）。 */
  streamDurationCapMs?: number;
}

/** 步级流时长绝对上界默认值（#699 失败方式 3）：body 臂改事件重置后，步
 * 总时长的唯一不事件化护栏——兜住「日志噪声 / 费用失控」的完全无上界步。
 * 3600s = 真实任务常态（>9 分钟的规划/审核步）之上、费用失控之下。 */
export const STREAM_DURATION_CAP_DEFAULT_MS = 3_600_000;

/** 上界 env 旋钮（#699：可配绝对上界）；非法/非正值回落默认值——0 不是
 * 「拆墙」出口，墙保持是墙。 */
export const STREAM_DURATION_CAP_ENV = 'PACMAN_STREAM_DURATION_CAP_MS';

function envDurationCapMs(env: NodeJS.ProcessEnv): number | null {
  const raw = env[STREAM_DURATION_CAP_ENV];
  if (raw === undefined) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** 流超时触发臂（#699 失败方式 4）：first = 首事件期限、idle = 事件间空闲、
 * body = 流 body 预算、duration = 步级绝对上界。 */
export type StreamTimeoutArm = 'first' | 'idle' | 'body' | 'duration';

/** 超时收尾文案（#699 失败方式 4）：指名触发臂与各自数值——build.errorMessage
 * 携带本文案，相位面看到的是真凶，不是笼统的 stream timeout。 */
export function streamTimeoutMessage(
  arm: StreamTimeoutArm,
  timeouts: { first: number; idle: number; body: number; durationCap: number },
): string {
  const value =
    arm === 'first'
      ? timeouts.first
      : arm === 'idle'
        ? timeouts.idle
        : arm === 'body'
          ? timeouts.body
          : timeouts.durationCap;
  const label = arm === 'duration' ? 'cap' : arm;
  return `stream timeout (arm=${arm}, ${label}=${value}ms)`;
}

/** 任务文本（M3a 骨架 [设计]：title + spec 原文，文本单源 = shared
 * buildTaskPromptText——web transcript 过滤侧按同一合成式识别本行，#612；
 * plan.md 产出/git 面归 M3b，驳回 feedback / 合并指令等续轮 prompt 由调用方
 * 经 resume.prompt 传入）。chief 步无 todo → 用 server 合成的 instruction
 * （用户消息/wake 事实）。 */
export function buildTaskPrompt(claimed: ClaimedStep): string {
  const todo = claimed.todo;
  if (!todo) return claimed.instruction ?? '';
  return buildTaskPromptText(todo.title, todo.spec);
}

// continue session 续轮指令 = shared CONTINUE_PROMPTS 单源（#612 起 web
// transcript 过滤侧消费同一词表——合成指令不再冒名用户气泡）。语义备注：
// chief 续轮 = wake 事实走 instruction，表内 chief 值不用（占位保全键）；
// review（M7 #312）首轮由 server instruction 注入（含 plan.md 全文 + 用户
// focus），continue 路径不被使用——审核步是额外 agent 步，不接续到主 conv
// 会话（#511 起 server 侧恒下发 session.action='new'，runner 侧 review 走
// instruction 分支，双保险）。

/** 任务元信息注入的项目形态面（#446 / ADR 0005 分叉律；claim 载荷
 * todo.meta 同形投影）：github 形态携带——词表 = 项目标签集镜像（仓库
 * label 同步行，server claim 时现取），多枚可贴；缺省 = local/hosted 现
 * 行为（FIXED_TAGS 单标签 + 占位回填，文本逐字节不变）。 */
export interface TaskMetaForm {
  /** 项目标签集镜像的 name 列（claim 载荷 todo.meta.vocab 同形子集；
   * titleFinal 的短路面在 taskMetaOpts，不进文本合成）。 */
  vocab: readonly { name: string }[];
}

/** 任务元信息回填指令（spec 15 #394 / ADR 0002 D3 + #446 / ADR 0005）：
 * worker 步带 todo 语境时注入 systemPrompt。meta 缺省 = local/hosted 形态：
 * 词表与含义 = shared FIXED_TAGS 单源（改一处全链路生效）、至多 1 个。
 * meta 携带 = github 形态：词表 = 镜像行 name 列表（含义就在名字里，仓库
 * 真值不加注释）、tags 多枚可贴；空词表 = 项目尚无镜像行，明说无标签可贴
 * （不渲染空列表误导 agent）。回填失败不阻断 build（relay 拒绝/传输失败
 * 只是少一次元信息更新，占位标题继续服役）。currentTitle = 当前占位标题
 * （agent 对照参照物）。 */
export function composeTaskMetaInstruction(currentTitle: string, meta?: TaskMetaForm): string {
  if (meta === undefined) {
    const vocab = FIXED_TAGS.map((t) => `- ${t.name}：${t.description}`).join('\n');
    return `## 任务元信息\n本任务当前标题是占位截断：「${currentTitle}」。正式开工前，先调用一次 \`set_task_meta\` 工具回填元信息：\`title\` = 用不超过 50 个字总结任务正文（平文本，无 markdown，覆盖占位标题）；\`tag\` = 从下面的固定词表选至多 1 个最贴切的类别，判不出就不传 \`tag\`：\n${vocab}`;
  }
  const tagInstruction =
    meta.vocab.length > 0
      ? `\`tags\` = 从下面的项目标签词表选贴切的类别（可多选，判不出就不传 \`tags\`）：\n${meta.vocab
          .map((t) => `- ${t.name}`)
          .join('\n')}`
      : '本项目当前没有可用标签，不传 `tags`。';
  return `## 任务元信息\n本任务当前标题是占位截断：「${currentTitle}」。正式开工前，先调用一次 \`set_task_meta\` 工具回填元信息：\`title\` = 用不超过 50 个字总结任务正文（平文本，无 markdown，覆盖占位标题）；${tagInstruction}`;
}

/** todo 语境 → taskMeta 注入位（#446 / ADR 0005 D5）：meta.titleFinal =
 * issue 来源标题已真值、标签已导入 → 整段元信息指令不注入（回填反而覆盖
 * 真值）；否则 currentTitle + 形态 meta 原样透传（meta 缺省 = local 词表
 * 现行为）。chief 步无 todo → undefined。 */
function taskMetaOpts(
  todo: ClaimedStep['todo'],
): { taskMeta: { currentTitle: string; meta?: TaskMetaForm } } | undefined {
  if (!todo) return undefined;
  if (todo.meta?.titleFinal === true) return undefined;
  return {
    taskMeta: {
      currentTitle: todo.title,
      ...(todo.meta !== undefined ? { meta: todo.meta } : {}),
    },
  };
}

/** worker 步 systemPrompt = 职责文本 + 记忆注入（02 §4.4 读路径最小形；每步
 * 开跑注入该 Agent 记忆条目——注入形 [推断] 保留，触到即验证回写 04 附录 A）
 * + 任务元信息回填指令（spec 15 #394，todo 语境步开启；taskMeta.meta =
 * github 形态词表位，#446）。 */
export function composeWorkerSystemPrompt(
  description: string | null | undefined,
  memories: readonly { title: string; content: string }[] | undefined,
  opts?: { taskMeta?: { currentTitle: string; meta?: TaskMetaForm } },
): string | undefined {
  const parts: string[] = [];
  if (description) parts.push(description);
  if (memories && memories.length > 0) {
    parts.push(`## 记忆\n${memories.map((m) => `- ${m.title}：${m.content}`).join('\n')}`);
  }
  if (opts?.taskMeta) {
    parts.push(composeTaskMetaInstruction(opts.taskMeta.currentTitle, opts.taskMeta.meta));
  }
  return parts.length > 0 ? parts.join('\n\n') : undefined;
}

/** hasChanges 判定 [推断骨架]（02 §4.1/r5 §8 列位双键；git diff 面归 M3b，
 * 当前 = transcript 含写类工具行）。 */
const CHANGE_TOOLS = new Set(['edit', 'write', 'bash']);

/** live transcript 文本增量转发节流窗口 [设计]（M5 live streaming；官方节奏
 * 不可观测——窗口取「肉眼成流、请求不成洪」的折中）。 */
const TRANSCRIPT_DELTA_FLUSH_MS = 250;

async function withRetries<T>(
  fn: () => Promise<T>,
  delaysMs: readonly number[],
  logger: DaemonLogger,
  label: string,
): Promise<T | null> {
  let lastErr: unknown;
  for (let i = 0; i <= delaysMs.length; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const delay = delaysMs[i - 1];
      if (delay === undefined) break;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  // 重试预算耗尽：原因上浮日志（不再静默吞错）。
  logger.step(
    `${label} retry exhausted: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
  );
  return null;
}

export async function runStep(
  deps: RunStepDeps,
  claimed: ClaimedStep,
  opts: RunStepOptions = {},
): Promise<void> {
  const { client, journal, logger } = deps;
  const now = deps.now ?? (() => Date.now());
  const stepId = claimed.step.id;
  const convId = claimed.conversationId;
  const running = opts.running ?? 1;
  logger.raw(`step ${stepId} for conv ${convId} (${running} running)`);

  // chief 步（回合 = 机器 step，r5 §3.1）：任务文本 = server 合成的 instruction
  // （用户消息 / wake 事实），无 todo 语境；remoteTools relay + systemPrompt 走
  // chief 块。worker 步：title+spec 或续轮指令。review 步（#511）= server 合成
  // 的审核材料（meta + 输出契约 + 方案全文 + 变更），同 chief 走 instruction。
  const isChief = claimed.step.kind === 'chief';
  const isReview = claimed.step.kind === 'review';
  // 关口（#511）：step 表无相位列，prompt 的 meta 头即是它的持久载体。缺省
  // （无该字段的存量 prompt）= confirm 语义——不开检出、材料不含变更。
  const reviewGate: ReviewGate =
    (isReview ? parseReviewPromptMeta(claimed.instruction ?? null)?.gate : undefined) ?? 'confirm';
  const prompt =
    opts.resume?.prompt ??
    (isChief || isReview
      ? (claimed.instruction ?? '')
      : claimed.session.action === 'continue' && claimed.session.sessionId
        ? CONTINUE_PROMPTS[claimed.step.kind]
        : buildTaskPrompt(claimed));

  // journal：claimed（recover 面即时落盘，02 §5.4）。
  journal.claim({
    stepId,
    buildId: claimed.step.buildId,
    kind: claimed.step.kind,
    conversationId: convId,
    sessionAction: claimed.session.action,
    sessionId: opts.resume?.sessionId ?? claimed.session.sessionId,
    prompt,
    claimed,
  });

  // per-step 凭证下发（02 §5.4/§8：内存持有，不落盘常驻；push_credential
  // 对照 = credentials.ts）。runtime 身份步（spec 17 A4：agent.provider ∈
  // BACKEND_RUNTIME_IDS）零凭据——认证机器本地（claude 登录或
  // ANTHROPIC_API_KEY），daemon 无可注入面；provider 槽 = inert 占位（满足
  // SessionOpts.provider 必填形状，claude-code 后端不消费）。runtime 分支
  // 权威短路 creds.provider：未升级 server 的 mixed-version 窗口里老 side 仍
  // fabricate 伪 api_key 配置，此处不透传伪语义。非 runtime 步逐字节保持
  // 原行为（creds.provider → agent.provider 回退）。
  const tokenRes = await client.token(stepId);
  const creds = pushCredential(tokenRes);
  const agent = claimed.agent;
  const runtimeId = isBackendRuntimeId(agent?.provider) ? agent.provider : null;
  // let（#654）：回落闸翻 compat 旋钮时重赋值（sessionOpts.provider 同步）。
  let provider: ProviderConfig | null =
    runtimeId !== null
      ? { kind: 'api_key', providerId: runtimeId }
      : (creds.provider ??
        (agent?.provider ? { kind: 'api_key', providerId: agent.provider } : null));
  // 守卫合并判据：runtime 步 provider 恒为 inert 占位（非 null），非 runtime
  // 步要求 creds/agent 兜底命中——`!provider` 单判据即覆盖两分支，且让 TS 收窄
  // 供 sessionOpts.provider（必填槽）。
  if (!agent?.modelId || !provider) {
    clearCredentials(creds);
    await failStep(
      deps,
      stepId,
      runtimeId !== null ? `${runtimeId} step has no model id` : 'no agent/model on claimed step',
    );
    return;
  }
  // 合并权限闸（XMON-77）：合并步收尾 = git merge + conv 分支 push（三形态
  // repo 落地都以推送为前置），Agent 必须同时持「合并分支」「推送分支」。闸在
  // 会话/工作区之前——无授权的合并不烧模型回合。tools 携带才判（claim 恒携
  // 含空数组）；缺省 = 老 server 版本墙 fail-open。
  const agentTools = agent.tools;
  if (claimed.step.kind === 'merge' && agentTools !== undefined) {
    const missing = [AGENT_TOOL_MERGE, AGENT_TOOL_PUSH].filter((t) => !agentTools.includes(t));
    if (missing.length > 0) {
      clearCredentials(creds);
      await failStep(
        deps,
        stepId,
        `Agent 未获「${missing.join('」「')}」授权（Agent 详情页权限 tab），合并步拒绝执行`,
      );
      return;
    }
  }
  // canon 行（r3 §1.5）：runtime 步 = `claude-code/<modelId>`（inert 占位的
  // providerId 与 agent.provider 同值）；非 runtime 步不变。canon 行在
  // backendFor 解析后（失败方式 6：解析入参钉 agent.provider 原值）。
  const backend = deps.backendFor(agent?.provider);
  logger.raw(`using model ${provider?.providerId ?? agent.provider}/${agent.modelId}`);

  // workspace 准备（02 §5.5 worktree 契约：基座 clone + `worktree add -b`；
  // 项目未绑 repo = 裸任务目录退化形 [设计]，M3a 兼容）。chief 步 = 只读探索，
  // 不开 worktree（不产可合并改动；仓库读经 remoteTools docs/projects relay，
  // 黑盒逼近 04 §1 A4）→ 裸任务目录。review 步（M7 #312 / #511）= 审核关口
  // 开**只读检出**：给它产物分支的检出，它才能回答「这段代码跑起来对不对」
  // ——只给 diff 文本只能回答「看起来对不对」。确认关口无产物可读 → 裸任务
  // 目录（不开工作区）。
  // repo 三形态同吃 worktree 契约（spec 12 G2-T2，契约零改动）：hosted =
  // http 远端 + per-step key；github = https 远端 + per-step x-access-token
  // （server 从 github_connection 下发）；local = cloneUrl 即用户仓库绝对路径
  // （git clone 本地路径默认硬链接，近零成本；凭证 null）。
  logger.workspace('准备工作区...');
  let ws: PreparedWorkspace | null = null;
  const checkout = isReview && reviewGate === 'review';
  const repo = isChief || (isReview && !checkout) ? null : (claimed.project?.repo ?? null);
  if (repo !== null) {
    if (!deps.workspace) {
      clearCredentials(creds);
      await failStep(deps, stepId, 'workspace ops unavailable for repo-bound step');
      return;
    }
    try {
      ws = await deps.workspace.prepare({
        projectId: claimed.project?.id ?? '',
        conversationId: convId,
        cloneUrl: repo.cloneUrl,
        workspacesRoot: deps.workspacesDir,
        credentials: creds.git,
      });
    } catch (err) {
      clearCredentials(creds);
      await failStep(deps, stepId, err instanceof Error ? err.message : String(err));
      return;
    }
  }
  const cwd = ws?.cwd ?? join(deps.workspacesDir, convId);
  if (!ws) mkdirSync(cwd, { recursive: true });

  // 步起点 head（M7 #308：停止 + 丢弃本轮修改的 rewind 目标 checkpoint——
  // prepare 后即时捕获，pi 会话期间的提交/脏树都在其上层）。
  let headAtStart: string | null = null;
  if (ws !== null && deps.workspace) {
    try {
      headAtStart = await deps.workspace.headCommit(ws.cwd);
    } catch {
      headAtStart = null; // 空基座等退化形：无可回退点，discard 降级为不清理
    }
  }

  // systemPrompt：chief = server 合成（charter + 资源清单 + 策略指引 + 记忆，
  // 02 §4.3）；worker = 职责文本 + 记忆注入（02 §4.4 读路径最小形，注入形 [推断]）
  // + 任务元信息注入。todo.meta.titleFinal（#446 / ADR 0005 D5）= issue 来源
  // 标题已真值、标签已导入——整段元信息指令短路不注入（回填反而会覆盖真值）。
  const systemPrompt =
    isChief && claimed.chief
      ? claimed.chief.systemPrompt
      : composeWorkerSystemPrompt(agent.description, agent.memories, taskMetaOpts(claimed.todo));
  // remoteTools：chief 步 = 49 词表全量；worker 步 = 记忆三件套 + 附件读
  // （02 §4.4/r5 §6 worker 写路径经 remoteTools relay；M4b 起服务端对 worker
  // 步同样下发；#310/r9 §3.1 worker attachment 工具 = spec `attachment:`
  // token 解析路径）。
  const remoteTools = claimed.remoteTools;
  // MCP per-turn 连接面（spec 13 slug 化）：claim 携带勾选 slug 列表，本机
  // config 解析实际端点（凭证值只活在执行机，从不跨 wire）；未知 slug /
  // 坏条目跳过 + 降级行（[mcp] <slug>: not in local config … 族）。每回合
  // 打出实际加载集与来源文件——多机各读各 config 的跑偏一眼可见（spec 13
  // premortem 护栏二）。
  const mcpSlugs = claimed.mcpServers ?? [];
  const mcpEndpoints =
    mcpSlugs.length > 0
      ? resolveMcpEndpoints(deps.mcpConfigPath, mcpSlugs, {
          onMissing: (slug) => logger.mcp(notInConfigLine(slug)),
        })
      : [];
  if (mcpSlugs.length > 0) {
    logger.mcp(
      `loaded from ${deps.mcpConfigPath}: ${
        mcpEndpoints.length > 0 ? mcpEndpoints.map((e) => e.slug).join(', ') : '(none)'
      }`,
    );
  }
  // 团队技能物化（XMON-112 S2，spec 14 增补）：按步拉技能包（server 按
  // claim agent.skills 白名单交集出包；chief 步 = 信任面全量）→ 内容寻址
  // 缓存目录。任何失败（server 不可达 / 4xx / 5xx / 非法包）= 仅本机技能 +
  // `[skills]` 降级行，会话不阻断（spec 14 MCP 降级同律；老 server 无端点
  // 404 同形 = 版本墙 fail-open）。
  let teamSkillsDir: string | null = null;
  try {
    const skillsPkg = await client.skills(stepId);
    teamSkillsDir = materializeTeamSkills({
      cacheRoot: deps.paths.teamSkillsCacheDir,
      pkg: skillsPkg,
      log: (msg) => logger.skills(msg),
    });
  } catch (err) {
    logger.skills(
      `team-fetch-failed: ${err instanceof Error ? err.message : String(err)} — continuing with local skills only`,
    );
  }
  // 团队密钥取用通道（02 §8 运行时层）：明文不经进程环境，只有真正需要密钥
  // 的步 kind 注册本地工具（records/step.ts stepTakesSecrets——规划/审核/总管
  // 探索步连工具面都没有）。授权面为空也注册：agent 取不到时拿到的是「未授权」
  // 这条明确原因，而不是一个说不清的缺值。
  const secretTool = stepTakesSecrets(claimed.step.kind)
    ? buildSecretTool({
        creds,
        stepId,
        agentId: agent?.id ?? null,
        onAudit: (line) => logger.step(line),
      })
    : null;
  // 远程 shell 执行通道（XMON-110 R2）：注册面 = claim localTools（server 算好
  // 双闸「agent 远程 shell ∩ machine.shellEnabled」下发；worker 恒携带含 []、
  // chief 不携带 = 不注册，fail-closed）。词缺席 = 开关关，agent 工具面不出现
  // 该词（密钥通道按 kind 裁剪同律）；每条命令的真实闸在 server 预检端点
  // （POST /api/machine/shell/{stepId}，审计行先于放行），本进程无策略。
  const remoteShellTool = (claimed.localTools ?? []).includes(LOCAL_TOOL_REMOTE_SHELL)
    ? buildRemoteShellTool({
        wire: client,
        stepId,
        cwd,
        onAudit: (line) => logger.step(line),
      })
    : null;
  // 步身份 [设计]（r3 未采 committer 词表）：Agent 名 + 机器位。两处消费同源
  // ——create_tag 的 tagger 与收尾 commitAll 的提交者署名一致；annotated tag
  // 没有 git 可用的兜底身份（无全局 user.name/user.email 的机器上直接挂 128），
  // 故必须显式注入。
  const stepIdentity: CommitIdentity = {
    name: claimed.agent?.displayName ?? 'pacman-agent',
    email: `${claimed.step.machineId ?? 'machine'}@pacman.local`,
  };
  // create_tag 注册面（XMON-111 T1）：claim localTools 词集是唯一判据（server
  // claimLocalTools 判定单源，daemon 不自判权限）；词缺席/缺省 = 不注册
  // （fail-closed）。repo null 步词在也注册：execute 返回「无仓库工作树」明确
  // 原因（secret-channel 同律）。凭证 = 本步 creds.git（local 形态 null）。
  const createTagTool = (claimed.localTools ?? []).includes(LOCAL_TOOL_CREATE_TAG)
    ? buildCreateTagTool({ repoDir: ws?.cwd ?? null, cred: creds.git, identity: stepIdentity })
    : null;
  const localToolDefs = [secretTool, remoteShellTool, createTagTool].filter(
    (t): t is LocalToolDef => t !== null,
  );
  // 工具面按步全量透传（#647/T4）：claude-code 后端把 host 注入工具
  // （remoteTools relay + localTools 本地执行）包成 in-process MCP server、
  // McpEndpoint 映射 SDK 原生 config——T1 期的 runtimeDrop 降级（worker/review
  // runtime 步丢三面 + 降级行）至此退役。pi 步零变化：三面透传本就是 pi 的
  // 既有行为。
  const sessionOpts: SessionOpts = {
    provider,
    modelId: agent.modelId,
    ...(agent.thinkingLevel ? { thinkingLevel: agent.thinkingLevel } : {}),
    ...(systemPrompt ? { systemPrompt } : {}),
    cwd,
    ...(prompt !== null ? { prompt } : {}),
    ...(localToolDefs.length > 0 ? { localTools: localToolDefs } : {}),
    ...(remoteTools && remoteTools.length > 0
      ? {
          remoteTools,
          // relay 执行（r5 §3.1 bundle：execute → POST tool/<stepId> {name,params}
          // → {text}；replaySafe 读工具带重试预算 + 10s 超时）。
          executeRemoteTool: (name, params) => {
            const def = remoteTools.find((t) => t.name === name);
            return client.relayTool(stepId, name, params, {
              ...(def?.replaySafe ? { replaySafe: true } : {}),
            });
          },
        }
      : {}),
    ...(mcpEndpoints.length > 0 ? { mcpServers: mcpEndpoints } : {}),
    // skills 白名单（#372）：worker/review 步 = claim 携带的 agent.skills 勾选
    // slug（[] 也传——[] = 不注入任何 skill，与 MCP 空勾选同律）；chief 步不传
    // （undefined = 全量 catalog，chief 是信任面）；旧 server 未携带 = 缺省
    // 直通（零回归）。过滤落点 = backend catalog 构建（backend/pi.ts）。
    ...(isChief || agent.skills === undefined ? {} : { skillsAllowlist: agent.skills }),
    // 团队技能物化目录（XMON-112 S2）：backend 把它排在本机 skillsDir 之前
    // 扫描（同名冲突团队条目胜，pi first-wins）；null = 纯本机（零回归）。
    ...(teamSkillsDir !== null ? { teamSkillsDir } : {}),
    // 只读回合（#511）：审核者不下发 edit/write——写入在工具面即被拒，且它
    // 对检出造成的任何写入在收尾被丢弃（见下「审核步收尾」）。
    ...(isReview ? { readOnly: true } : {}),
  };

  // continue 解析键：journal 快照（recover 面）优先，其次 claim 载荷携带的
  // server 侧 sessionId（02 §5.7 合并轮/续轮复用同 conv 会话）。
  const continueId =
    claimed.session.action === 'continue'
      ? (opts.resume?.sessionId ?? claimed.session.sessionId)
      : null;

  const transcript = new TranscriptBuffer(deps.paths.outboxDir, stepId);
  if (prompt !== null) {
    transcript.upsert({
      id: transcriptPromptRowId(stepId),
      role: 'user',
      content: prompt,
      createdAt: now(),
    });
  }

  // heartbeat 续活（失败不打断执行——与 presence 同纪律 [推断]）。
  const heartbeat = setInterval(() => {
    client.heartbeat(stepId).catch(() => {});
  }, deps.heartbeatIntervalMs ?? 30_000);
  if (heartbeat.unref) heartbeat.unref();

  let usage: AgentTokenUsage = [];
  let lastError: string | null = null;
  // 最近一次模型错误事件（#654）：auto_retry_start 清 lastError 不清它——流
  // 超时收尸场景（同形 400 重试烧到 540s 墙）lastError 是超时文案，回落判
  // 定仍要看得到底层错误签名。
  let lastModelError: string | null = null;
  let messageSeq = 0;
  let sawChangeTool = false;
  // 自然完成判定（M7 #308）：done 事件在位 = 会话自然收尾，stop 旗标迟到
  // 不改判（停止与自然完成的竞态以完成为准）。
  let sawDone = false;
  // 零进展判定（#654 回落护栏）：模型输出事件（text_delta / assistant
  // message_end / toolcall_end）在位 = 有进展——重放会重复执行工具与重复
  // 落 transcript 行，只允许零进展轮回落重试。
  let sawProgress = false;
  // 流超时护栏（02 §5.6 三值 + #699 语义修订）：三臂全部「事件到达即重置」
  // ——first = 首事件期限、idle = 事件间空闲、body = 流 body 预算（#654 先
  // 把重置粒度从步推进到轮，#699 推进到事件，对齐 pi 在树参考实现的
  // first/idle 事件重置语义）。事件重置救的是活跃流（失败方式 1）；真死流
  // 由 idle 臂收（失败方式 2），步级总时长由不事件化的 duration cap 收
  // （失败方式 3）。超时 = 中断会话并按 failed 收尾，文案指名触发臂与数值
  // （失败方式 4）。
  const streamTimeouts = {
    first: opts.streamTimeouts?.first ?? STREAM_TIMEOUTS_MS.streamFirstEvent,
    idle: opts.streamTimeouts?.idle ?? STREAM_TIMEOUTS_MS.streamIdle,
    body: opts.streamTimeouts?.body ?? STREAM_TIMEOUTS_MS.streamBodyTimeout,
  };
  const streamDurationCapMs =
    opts.streamDurationCapMs ?? envDurationCapMs(process.env) ?? STREAM_DURATION_CAP_DEFAULT_MS;
  let timedOut = false;
  let timeoutArm: StreamTimeoutArm | null = null;
  let watchdog: NodeJS.Timeout | null = null;
  let bodyTimeout: NodeJS.Timeout | null = null;
  let durationCap: NodeJS.Timeout | null = null;
  const tripTimeout = (arm: StreamTimeoutArm) => {
    timedOut = true;
    timeoutArm = arm;
    void handle.stop();
  };
  const armWatchdog = (ms: number, arm: 'first' | 'idle') => {
    if (watchdog) clearTimeout(watchdog);
    watchdog = setTimeout(() => tripTimeout(arm), ms);
    watchdog.unref?.();
  };
  // body 总时长护栏（#654 按轮独立装设 + #699 事件到达即重置）：回落轮重置
  // 预算、每个流事件再重置——零进展轮烧掉的同形重试空转不饿死回落轮，活跃
  // 长步不死于固定墙。事件重置下安静流先撞更紧的 idle 预算，body 仍独立指名
  // 在案（数值独立可配；将来 idle 重置面收窄时它仍是兜底）。
  const armBodyTimeout = () => {
    if (bodyTimeout) clearTimeout(bodyTimeout);
    bodyTimeout = setTimeout(() => tripTimeout('body'), streamTimeouts.body);
    bodyTimeout.unref?.();
  };
  // 步级绝对上界（#699 失败方式 3）：不随事件重置、不随回落轮重置（单步一
  // 份预算）；超界即收——「事件流活跃但完全无上界」的日志/费用失控墙。
  const armDurationCap = () => {
    durationCap = setTimeout(() => tripTimeout('duration'), streamDurationCapMs);
    durationCap.unref?.();
  };
  // live transcript 文本增量转发（M5 live streaming）：pi text_delta 按
  // TRANSCRIPT_DELTA_FLUSH_MS 窗口聚合批量 POST（tool/{stepId} 第三形
  // [设计]）；fire-and-forget——失败仅日志，终稿经 transcript 上传兜底。
  let deltaBuf = '';
  let deltaTimer: NodeJS.Timeout | null = null;
  const flushDeltas = () => {
    if (deltaTimer !== null) {
      clearTimeout(deltaTimer);
      deltaTimer = null;
    }
    const text = deltaBuf;
    deltaBuf = '';
    if (text === '') return;
    client.transcriptDelta(stepId, text).catch((err: unknown) => {
      logger.step(
        `transcript delta relay failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  };
  // —— 会话轮（#654 协议 400 步内回落，Multica client.go「按错误回落」同
  // 律）：第一轮零进展且终局错误命中自适配签名 → backend 翻 compat 旋钮 →
  // 重开一轮（单次预算：第二起失败 / 有进展 / 无可翻即按现状收尾）。——
  let handle: AgentSessionHandle;
  let resumed = Boolean(continueId);
  // 会话开面（两轮共用）：continue 优先 + 会话文件未落盘的冷重试回退
  // （02 §5.7 崩溃竞态 [设计]）；回落轮沿同开面续会话——误差轮不追加历史，
  // pi 重试机制本就摘除错误轮，续开即从误差前状态继续。
  const openSession = (): Promise<AgentSessionHandle> => {
    resumed = Boolean(continueId);
    if (continueId === null) return backend.createSession(sessionOpts);
    return backend.continueSession(continueId, sessionOpts).catch((err: unknown) => {
      if (!(err instanceof SessionNotResumableError)) throw err;
      logger.step(`continue session unavailable (${continueId}) — falling back to new session`);
      resumed = false;
      return backend.createSession(sessionOpts);
    });
  };
  for (let pass = 0; ; pass++) {
    if (pass > 0) {
      // 回落轮状态复位（零进展护栏保证 messageSeq/sawChangeTool/增量缓冲在
      // 第一轮本就未动）。duration cap 不在此复位——它是步级预算（#699）。
      lastError = null;
      lastModelError = null;
      sawDone = false;
      sawProgress = false;
      timedOut = false;
      timeoutArm = null;
      usage = [];
    }
    try {
      handle = await openSession();
    } catch (err) {
      clearInterval(heartbeat);
      flushDeltas();
      clearCredentials(creds);
      await failStep(deps, stepId, err instanceof Error ? err.message : String(err));
      return;
    }
    logger.raw(resumed ? `continue session ${convId}` : `new session ${convId}`);
    // 会话持久化索引即时落 journal（崩溃 recover 的 continue 解析键）。
    journal.update(stepId, { state: 'running', sessionId: handle.sessionId });
    // steer 投递面注册（W3 #279）：在跑期间 deliverSteer 可达；各收尾路径注销。
    deps.sessionHandles?.set(stepId, handle);
    armWatchdog(streamTimeouts.first, 'first');
    armBodyTimeout();
    if (pass === 0) armDurationCap();
    try {
      for await (const ev of handle.events) {
        armWatchdog(streamTimeouts.idle, 'idle');
        // body 预算与 idle 同拍按事件重置（#699 失败方式 1 的核心）。
        armBodyTimeout();
        switch (ev.type) {
          case 'text_delta': {
            sawProgress = true;
            deltaBuf += ev.text;
            if (deltaTimer === null) {
              deltaTimer = setTimeout(flushDeltas, TRANSCRIPT_DELTA_FLUSH_MS);
              deltaTimer.unref?.();
            }
            break;
          }
          case 'toolcall_end': {
            sawProgress = true;
            if (ev.call.name && CHANGE_TOOLS.has(ev.call.name)) sawChangeTool = true;
            transcript.upsert({
              id: ev.call.id,
              role: 'assistant',
              content: { kind: 'toolcall', call: ev.call },
              createdAt: ev.call.endedAt ?? now(),
            });
            if (ev.call.result !== undefined) {
              // live 回传（重试预算 = REMOTE_TOOL_RETRY_DELAYS_MS [500,2000]ms，
              // r5 §3.1；终败仅日志——终稿 transcript 经 upload-urls 兜底）。
              const ok = await withRetries(
                () => client.tool(stepId, ev.call),
                REMOTE_TOOL_RETRY_DELAYS_MS,
                logger,
                `tool relay ${ev.call.id}`,
              );
              if (ok === null)
                logger.step(
                  `tool relay failed for ${ev.call.id} (transcript upload will carry it)`,
                );
            }
            break;
          }
          case 'message_end': {
            // user 行不重复落（任务文本行 user-<stepId> 已在缓冲；pi 回声同文）。
            if (ev.message.role === 'user') break;
            sawProgress = true;
            messageSeq += 1;
            transcript.upsert({
              id: `msg-${stepId}-${messageSeq}`,
              role: ev.message.role,
              content: ev.message.content,
              createdAt: now(),
            });
            break;
          }
          case 'error':
            lastError = ev.error.message;
            lastModelError = ev.error.message;
            logger.step(`error: ${ev.error.message} (retryable=${ev.error.retryable})`);
            break;
          case 'auto_retry_start':
            lastError = null; // pi 流级自动重试吸收前错（02 §4.2）
            logger.step(`auto_retry_start attempt=${ev.attempt}`);
            break;
          case 'compaction_start':
            logger.step('compaction_start');
            break;
          case 'done':
            sawDone = true;
            usage = ev.usage;
            break;
          default:
            break;
        }
      }
    } catch (err) {
      clearInterval(heartbeat);
      if (watchdog) clearTimeout(watchdog);
      if (bodyTimeout) clearTimeout(bodyTimeout);
      if (durationCap) clearTimeout(durationCap);
      flushDeltas();
      clearCredentials(creds);
      await failStep(deps, stepId, err instanceof Error ? err.message : String(err));
      return;
    }
    // —— #654 回落闸（判据取轮内原值，先于下方超时文案覆盖 lastError）：
    // 零进展 + 终局失败（或超时收尸但底层模型错误在位）+ 签名命中且旋钮
    // 可翻 → 翻旋钮重开一轮。停止钮经 handle.stop() 收尾不带 error，天然
    // 不进此闸。——
    if (pass === 0 && !sawProgress && !sawDone) {
      const failureText = lastModelError ?? lastError;
      if (failureText !== null && (lastError !== null || (timedOut && lastModelError !== null))) {
        const amended: ProviderConfig | null =
          backend.adaptProviderCompat?.(provider, failureText) ?? null;
        if (amended !== null) {
          provider = amended;
          sessionOpts.provider = amended;
          logger.step(
            `protocol fallback: provider ${amended.providerId} compat adapted (${JSON.stringify(
              amended.compat,
            )}), retrying session once`,
          );
          deps.sessionHandles?.delete(stepId);
          continue;
        }
      }
    }
    break;
  }
  flushDeltas();
  clearInterval(heartbeat);
  if (watchdog) clearTimeout(watchdog);
  if (bodyTimeout) clearTimeout(bodyTimeout);
  if (durationCap) clearTimeout(durationCap);
  if (timedOut && timeoutArm !== null)
    lastError = streamTimeoutMessage(timeoutArm, {
      ...streamTimeouts,
      durationCap: streamDurationCapMs,
    });

  // —— 停止钮中断判定（M7 #308）：旗标 = machine-loop deliverStop 拉取-确认
  // 后置位；sawDone 优先 = stop 与自然完成竞态归完成（success 不改判）。——
  const stopReq = deps.stopRequests?.get(stepId);
  if (stopReq !== undefined) deps.stopRequests?.delete(stepId);
  const stopped = stopReq !== undefined && !sawDone;
  if (stopReq !== undefined && sawDone) logger.step('stop arrived after completion — ignored');
  // abort 吞掉终局 done 事件（backend/pi.ts stopping 位——停止钮与流超时
  // watchdog 共用 handle.stop()）→ usage 从 handle 累计面兜底（逐消息累积，
  // token 记账不因中断丢失）。
  if (!sawDone) usage = handle.usage();

  /** worktree 回退到步起点（stop/discard 与审核步只读收尾共用一处护栏）；
   * 返回失败原因，null = 回退成功或不适用（无检出/无起点）。回退失败意味着
   * 本轮写入可能残留——调用方按各自语义报出去，不静默。 */
  const rewindToStepStart = async (): Promise<string | null> => {
    if (ws === null || !deps.workspace || headAtStart === null) return '步起点 commit 不可得';
    try {
      await deps.workspace.restoreCheckpoint(ws.cwd, headAtStart);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  };

  if (stopped) {
    logger.step(`step stopped by user (discard=${stopReq?.discard === true})`);
    // 丢弃本轮修改 = worktree rewind 到步起点 checkpoint（r9 §3.3「方案和
    // 代码回到上一个版本」；方案文档面天然回上版——plan.md 上传在步收尾，
    // 停止即不上传）。不 commit/push：中断步不产交接物，远端分支停在上一步
    // 收尾态（本地 rewind 后即与远端一致，无需 force push）。
    if (stopReq?.discard === true) {
      const failed = await rewindToStepStart();
      if (failed !== null) logger.step(`discard rewind failed: ${failed}`);
    }
  }

  // —— 审核步收尾（#511）：只读是硬的，两层落点——
  //   ① 工具面：edit/write 不下发（SessionOpts.readOnly）——常见写路径直接拒；
  //   ② 检出回退：审核者在检出里跑过的任何写入（含 bash 落盘）一律 rewind 到
  //      步起点——不采集、不合并。这一层是必须的：检出与后续步（合并轮）同
  //      目录复用，遗留脏树会被下一步的 commitAll 顺手扫进合并提交。
  //   bash 仍是它的工具（跑验证命令），故 fs 级只写闸做不到——本票「只读」=
  //   「写入不被采集、不被合并」（票面裁定的可落地形态）。残留边界要说清：
  //   审核者若在 bash 里自己 push（prompt 明令禁止），daemon 拦不住——托管/
  //   github 形态远端要 per-step 凭证（只在 daemon 内存里、只经参数传给 git
  //   原语），裸 push 拿不到凭证；local 形态远端是本地路径，推得动。
  //   回退失败不能只写 daemon 日志：那正是「写入残留 + 下一步顺手提交」的窗口，
  //   落一条 system 行走 transcript 让用户在合并前看得见。
  if (checkout) {
    const failed = await rewindToStepStart();
    if (failed !== null) {
      logger.step(`review rewind failed: ${failed}`);
      transcript.upsert({
        id: `review-rewind-${stepId}`,
        role: 'system',
        content: `审核检出未能回退到本轮起点（${failed}）——本轮审核对工作区的写入可能残留，合并前请确认工作区状态`,
        createdAt: now(),
      });
    }
  }

  // —— git 收尾（02 §5.5：每步结束自动 commit + push 本 conversation 工作
  // 分支；合并步先走 `git merge --no-edit origin/<default>`，r3 §3.6；
  // 停止步跳过——中断步不产交接物；审核步跳过——只读步不产交接物）——
  let headCommit: string | null = null;
  // 审核步不产改动（#511）：它跑 bash 跑验证命令会被 CHANGE_TOOLS 记为「写过」，
  // 但那不是本轮的变更——如实报 false（server 侧同样不计入 todo.hasChanges）。
  let hasChanges = isReview ? false : sawChangeTool; // 未绑 repo 退化形 = transcript 写类工具行 [推断骨架]
  if (ws !== null && deps.workspace && lastError === null && !stopped && !isReview) {
    const git = deps.workspace;
    try {
      const committed = await git.commitAll(
        ws.cwd,
        `${claimed.step.kind}: ${claimed.todo?.title ?? claimed.conversationId}`,
        stepIdentity,
      );
      if (claimed.step.kind === 'merge') {
        const merged = await git.mergeDefaultBranch(ws.cwd, ws.defaultBranch);
        // 合并结果行进 transcript（r3 §3.6 时间线样本「git merge origin/main
        // 结果为 "Already up to date"…」同形）。
        transcript.upsert({
          id: `merge-${stepId}`,
          role: 'system',
          content: `git merge origin/${ws.defaultBranch} 结果为 "${merged.output || 'OK'}"`,
          createdAt: now(),
        });
      }
      // 推送闸（XMON-77）：Agent 未持「推送分支」= 不推——提交留在本地工作
      // 分支（步本身照常 success，拒的是推送不是工作），transcript 落 system
      // 行说明（用户在合并前看得见为何没上去）。tools 携带才判（含空数组 =
      // 全关）；缺省 = 老 server 版本墙 fail-open 现行为。
      const pushDenied =
        claimed.agent?.tools !== undefined && !claimed.agent.tools.includes(AGENT_TOOL_PUSH);
      const pushWarranted =
        committed.committed ||
        claimed.step.kind === 'merge' ||
        (await git.countAhead(ws.cwd, ws.defaultBranch)) > 0;
      if (pushWarranted && pushDenied) {
        transcript.upsert({
          id: `push-skip-${stepId}`,
          role: 'system',
          content: `Agent 未获「${AGENT_TOOL_PUSH}」授权——本轮提交保留在本地工作分支 ${ws.branch}，未推送到远端`,
          createdAt: now(),
        });
        logger.step(`push skipped: agent lacks ${AGENT_TOOL_PUSH} permission`);
      } else if (pushWarranted) {
        await git.push(ws.cwd, ws.branch, creds.git);
        logger.raw(`pushed ${ws.branch}`);
        // local 形态落地（spec 12 G2-T2）：merge 步 push 回用户仓库后
        // `git merge --ff-only <convBranch>` 推进用户当前分支；脏工作区/非 ff
        // → git 自拒 → lastError（failed 收尾，reason 含 git 拒绝原文）——
        // 永不 force、永不动用户工作树。hosted 落地在 server applyMergeLanding
        // （hosted-only 不变）；github v1 done 语义 = conv 分支已推上，不落地。
        if (repo?.kind === 'local' && claimed.step.kind === 'merge') {
          await git.landLocalFastForward(repo.cloneUrl, ws.branch);
        }
      }
      headCommit = committed.head ?? (await git.headCommit(ws.cwd));
      // hasChanges = conv 分支领先默认分支的提交在位（02 §4.1/r5 §8 列位双键；
      // git 真值面取代 M3a transcript 推断骨架）。
      hasChanges = (await git.countAhead(ws.cwd, ws.defaultBranch)) > 0;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  const status = stopped ? 'stopped' : lastError === null ? 'success' : 'failed';
  if (!stopped && lastError !== null) logger.step(`step failed: ${lastError}`);
  journal.update(stepId, { state: 'awaiting-upload' });

  // upload-urls → transcript 终稿 + plan.md 产物回传落库（02 §1.3 数据所有权；
  // plan 即文件、版本 = 文件版本——规划步收尾上传当前版，02 §4.2/r5 §4）。
  try {
    const messages = transcript.messages();
    const files: { name: string; size?: number }[] = [
      { name: 'transcript.json', size: JSON.stringify(messages).length },
    ];
    let planContent: string | null = null;
    if (ws !== null && claimed.step.kind === 'plan' && !stopped) {
      const planPath = join(ws.cwd, PLAN_FILE_NAME);
      if (existsSync(planPath)) {
        planContent = readFileSync(planPath, 'utf8');
        files.push({ name: PLAN_FILE_NAME, size: planContent.length });
      }
    }
    const { uploads } = await client.uploadUrls(stepId, files);
    for (const upload of uploads) {
      if (upload.name === PLAN_FILE_NAME && planContent !== null) {
        await client.putUpload(upload.url, upload.headers, planContent, 'text/markdown');
      } else if (upload.name === 'transcript.json') {
        await client.putUpload(upload.url, upload.headers, { stepId, messages });
      }
    }
  } catch (err) {
    // 回传失败 = journal 残留 awaiting-upload，recover 面重传 [设计]。
    logger.step(`transcript upload failed: ${err instanceof Error ? err.message : String(err)}`);
    clearCredentials(creds);
    deps.sessionHandles?.delete(stepId); // journal 残留 recover 面重传，handle 不再 steer
    deps.stopRequests?.delete(stepId);
    return;
  }

  try {
    // AI 审核步 findings（M7 #330，r8 §3.1）：仅 review 步携带——其它步类
    // 无该输出契约，强制 null 避免假阳。解析失败 = 不携带（server 侧 verdict
    // 兜底「审核未返回结论」+ 不触发修订）。
    const findings =
      claimed.step.kind === 'review' ? extractReviewVerdict(transcript.messages()) : null;
    await client.done(stepId, {
      status,
      ...(lastError !== null ? { errorMessage: lastError } : {}),
      sessionId: handle.sessionId,
      usage: [...usage],
      hasChanges,
      // per-step checkpoint（done 回传 commit：「恢复到此处」数据源 + 合并步
      // fast-forward 落地键，r3 §3.5/§3.9 [设计]）。
      ...(headCommit !== null ? { commit: headCommit } : {}),
      ...(findings !== null ? { findings } : {}),
    });
  } catch (err) {
    logger.step(`done report failed: ${err instanceof Error ? err.message : String(err)}`);
    clearCredentials(creds);
    deps.sessionHandles?.delete(stepId); // journal 残留 recover 补报，handle 不再 steer
    deps.stopRequests?.delete(stepId);
    return; // journal 残留，recover 面补报
  }
  clearCredentials(creds);
  journal.remove(stepId);
  deps.sessionHandles?.delete(stepId);
  deps.stopRequests?.delete(stepId);
  logger.raw(`finished (${running - 1} running)`);
}

async function failStep(deps: RunStepDeps, stepId: string, message: string): Promise<void> {
  deps.sessionHandles?.delete(stepId); // 覆盖 handle 后失败路径（前置失败 = 无键可删）
  deps.stopRequests?.delete(stepId);
  deps.logger.step(`failed: ${message}`);
  try {
    await deps.client.done(stepId, { status: 'failed', errorMessage: message });
    deps.journal.remove(stepId);
  } catch (err) {
    // 离线：journal 保持 claimed/running（pending 面），recover 对账重报
    // （02 §5.4）；原因上浮日志。
    deps.logger.step(
      `done(failed) report unreachable: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
