// Chief 服务面（02 §4.3 结构契约 + r5 §2/§3 实测行为；M4a）。
// - 身份：每「用户×团队」一个（chiefIdFormat）；特例 Agent 实例——绑定 Agent
//   经 PATCH /chief（二次确认告示 canon = shared CHIEF_REBIND_CONFIRM_COPY，
//   记忆不迁移：Chief 无独立记忆存储，r5 §2）。
// - 执行形态：Chief 回合 = 机器 step（kind 'chief'，conv = thread id
//   `chief-<uuid>`，r5 §3.1 daemon.log 实测）+ pi 会话；模型 = 绑定 Agent 模型。
// - 线程面落库：chief_thread/chief_message（01 §6）；toolDefHashes = 49 词表
//   哈希键面（值形仿 raw 12 字符 base64url 样 [推断]——哈希输入 = 复刻自定
//   工具定义，与官方值必然不同，仅形状对齐）。
// - watch/wake 主动回路（r5 §3.5）：派工即自动 watch（reason canon）；gate 停驻
//   /settle/failed 三触发 wake 轮；settle/failed 后 watch 自动解除。
// - 策略层（措辞→spec/分派权重/单 todo 直派）= system prompt 指引 + 49 词表
//   relay 工具面，由 LLM 决策——黑盒逼近（04 §1 A4：[推断]/[设计] 不冒充实测）。

import type {
  ActiveRun,
  AgentRecord,
  ChiefGetResponse,
  ChiefThread,
  ChiefWakeKind,
  ChiefWatch,
  MachineDoneBody,
  PatchChiefBody,
  Phase,
  TodoRecord,
  UserRecord,
} from '@pacman/shared';
import {
  CHIEF_REMOTE_TOOLS,
  CHIEF_THREAD_ID_PREFIX,
  CHIEF_WATCH_REASON_DISPATCH,
  chiefIdFormat,
  chiefThreadTitle,
  newChiefThreadId,
} from '@pacman/shared';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import {
  agent,
  agentMemory,
  build,
  chief,
  chiefMessage,
  chiefThread,
  machine,
  project,
  skill,
  step,
  todo,
  tokenUsage,
} from '../db/schema.js';
import { sha256Hex } from '../lib/crypto.js';
import { HttpError } from '../lib/errors.js';
import { newRecordId, newUuidv7, nowMs } from '../lib/ids.js';
import type { TeamStreamHub } from './events.js';
import type { MachineWakeHub } from './machines.js';
import { notifyChiefMessage } from './notifications.js';

export interface ChiefDeps {
  db: Db;
  hub: TeamStreamHub;
  /** 入队即 wake（低延迟派发，02 §5.4）。 */
  machineHub?: MachineWakeHub;
  user: UserRecord;
}

type ChiefRow = typeof chief.$inferSelect;
type ThreadRow = typeof chiefThread.$inferSelect;

/** wake 轮 prompt 标记前缀（[设计]：step.prompt 内嵌触发词，claim 时解析回
 * chief.trigger；wire 无对照物）。 */
export const WAKE_PROMPT_PREFIX = '[wake:';

// —— chief 记录（每「用户×团队」一个，惰性 upsert）———————————————————————

export function ensureChief(deps: ChiefDeps, teamId: string): ChiefRow {
  const id = chiefIdFormat(deps.user.id, teamId);
  const existing = deps.db.select().from(chief).where(eq(chief.id, id)).get();
  if (existing) return existing;
  deps.db
    .insert(chief)
    .values({
      id,
      userId: deps.user.id,
      teamId,
      agentId: null,
      thinkingLevel: null,
      compactionModel: null, // 默认「与 Chief 相同」（#203）
      charter: '', // raw 观测默认空串（chief-record-testA.json 一手）
      watches: [],
      wakes: [],
      lastTurnAt: null,
      createdAt: nowMs(),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    })
    .run();
  const row = deps.db.select().from(chief).where(eq(chief.id, id)).get();
  if (!row) throw new Error('chief missing after insert');
  return row;
}

function toChiefRecord(row: ChiefRow): ChiefGetResponse['chief'] {
  return {
    id: row.id,
    userId: row.userId,
    teamId: row.teamId,
    agent: row.agentId !== null ? { agentId: row.agentId } : null,
    charter: row.charter,
    compactionModel: row.compactionModel,
    lastTurnAt: row.lastTurnAt,
    createdAt: row.createdAt,
    tz: row.tz,
  };
}

export function agentRecordOfRow(row: typeof agent.$inferSelect): AgentRecord {
  return {
    id: row.id,
    displayName: row.displayName,
    description: row.description,
    status: 'active',
    avatarUrl: row.avatarUrl,
    provider: row.provider,
    modelId: row.modelId,
    thinkingLevel: row.thinkingLevel,
    tools: row.tools,
    secrets: row.secrets,
    skills: row.skills,
    mcpServers: row.mcpServers,
  };
}

/** watches[] 的 phase 快照随读刷新（r5 raw 样本 phase 为活值 [推断]：观测值
 * "building" 与当时 todo 实况一致，判为派生面）。 */
function refreshWatches(deps: ChiefDeps, watches: ChiefWatch[]): ChiefWatch[] {
  return watches.map((w) => {
    const todoRow = deps.db
      .select({ phase: todo.phase })
      .from(todo)
      .where(eq(todo.id, w.todoId))
      .get();
    return todoRow ? { ...w, phase: todoRow.phase } : w;
  });
}

/** context.tokens = chief 会话累计用量（r5 §3.6 随回合增长 27065→29866；
 * 归属维 [推断]：token_usage 按 buildId 记账，chief 回合 buildId = conv id
 * `chief-%`——contextWindow 128000 = raw 观测值）。 */
function chiefContext(deps: ChiefDeps): { tokens: number; contextWindow: number } | null {
  const rows = deps.db
    .select({
      input: tokenUsage.input,
      output: tokenUsage.output,
      cacheRead: tokenUsage.cacheRead,
      cacheWrite: tokenUsage.cacheWrite,
    })
    .from(tokenUsage)
    .where(sql`${tokenUsage.buildId} LIKE ${`${CHIEF_THREAD_ID_PREFIX}%`}`)
    .all();
  if (rows.length === 0) return null;
  const tokens = rows.reduce((n, r) => n + r.input + r.output + r.cacheRead + r.cacheWrite, 0);
  return { tokens, contextWindow: 128_000 };
}

/** GET /api/teams/{id}/chief 响应封套（r5 §3.6 API 原样）。 */
export function getChiefEnvelope(deps: ChiefDeps, teamId: string): ChiefGetResponse {
  const row = ensureChief(deps, teamId);
  const agentRow = row.agentId
    ? deps.db.select().from(agent).where(eq(agent.id, row.agentId)).get()
    : undefined;
  return {
    chief: toChiefRecord(row),
    agentActor: agentRow ? agentRecordOfRow(agentRow) : null,
    context: chiefContext(deps),
    watches: refreshWatches(deps, row.watches),
    wakes: row.wakes,
  };
}

/** PATCH /api/teams/{id}/chief——`agent` 槽 = r5 §2 抓包原样（绑定/换绑；
 * 记忆不迁移 = 无迁移动作，共用绑定 Agent 存储）；`charter` 槽 = 章程 tab
 * 保存面 [推断]（保存 wire 未采）。agent:null = 解绑 [推断]。
 * `compactionModel` 槽 = 压缩模型长槽（#203 [设计]）：undefined = 不动，
 * null = 清空回默认「与 Chief 相同」。body 型 = shared PatchChiefBody 单源。 */
export function patchChief(
  deps: ChiefDeps,
  teamId: string,
  body: PatchChiefBody,
): ChiefGetResponse {
  const row = ensureChief(deps, teamId);
  const sets: Partial<ChiefRow> = {};
  if (body.agent !== undefined) {
    if (body.agent === null) {
      sets.agentId = null;
      sets.thinkingLevel = null;
    } else {
      const agentRow = deps.db
        .select()
        .from(agent)
        .where(and(eq(agent.id, body.agent.agentId), eq(agent.teamId, teamId)))
        .get();
      if (!agentRow) throw new HttpError(404, `agent ${body.agent.agentId}`);
      sets.agentId = agentRow.id;
      sets.thinkingLevel = body.agent.thinkingLevel;
    }
  }
  if (body.charter !== undefined) sets.charter = body.charter ?? '';
  if (body.compactionModel !== undefined) sets.compactionModel = body.compactionModel;
  if (Object.keys(sets).length > 0) {
    deps.db.update(chief).set(sets).where(eq(chief.id, row.id)).run();
  }
  return getChiefEnvelope(deps, teamId);
}

// —— 线程面（chief_thread/chief_message 落库，01 §6）———————————————————————

/** toolDefHashes = 49 词表哈希键面（thread 创建时定格；值形仿 raw 12 字符
 * base64url 样 [推断]）。 */
export function chiefToolDefHashes(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const def of CHIEF_REMOTE_TOOLS) {
    const digest = sha256Hex(JSON.stringify(def));
    out[def.name] = Buffer.from(digest, 'hex').toString('base64url').slice(0, 12);
  }
  return out;
}

export function toChiefThreadRecord(row: ThreadRow): ChiefThread {
  return {
    id: row.id,
    chiefId: row.chiefId,
    userId: row.userId,
    teamId: row.teamId,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastTurnAt: row.lastTurnAt,
    session: { runtime: 'pi', id: row.sessionId, openedAt: row.sessionOpenedAt },
    pendingSessionResumeAt: row.pendingSessionResumeAt,
    toolDefHashes: row.toolDefHashes,
    toolResultHashes: row.toolResultHashes,
    activeRun: row.activeRun,
  };
}

export function listChiefThreads(deps: ChiefDeps, teamId: string): ChiefThread[] {
  const row = ensureChief(deps, teamId);
  return deps.db
    .select()
    .from(chiefThread)
    .where(eq(chiefThread.chiefId, row.id))
    .orderBy(desc(chiefThread.updatedAt))
    .all()
    .map(toChiefThreadRecord);
}

export function getChiefThread(deps: { db: Db }, threadId: string): ThreadRow | undefined {
  return deps.db.select().from(chiefThread).where(eq(chiefThread.id, threadId)).get();
}

/** 绑定 Agent 校验（回合派发前置：模型位在位才可执行——门控条 canon
 * 「请先为总管选择一个 Agent。」r5 §2 的 server 半 [设计] 409）。 */
function requireBoundAgent(deps: ChiefDeps, row: ChiefRow) {
  if (row.agentId === null) {
    throw new HttpError(409, 'chief agent not bound (请先为总管选择一个 Agent。)');
  }
  const agentRow = deps.db.select().from(agent).where(eq(agent.id, row.agentId)).get();
  if (!agentRow?.modelId) {
    throw new HttpError(409, 'chief agent has no model configured');
  }
  return agentRow;
}

/** 用户 → Chief 发消息（发送 wire 未采 [设计]）：线程 get-or-create（标题 =
 * 首句截断 + …，r5 §3.6）+ user 消息行落库 + chief 步入队（回合 = 机器 step，
 * r5 §3.1）+ 机器 wake。 */
export function sendChiefMessage(
  deps: ChiefDeps,
  teamId: string,
  body: { threadId: string | null; content: string },
): {
  thread: ChiefThread;
  message: { id: string; role: 'user'; content: string; createdAt: number };
} {
  const chiefRow = ensureChief(deps, teamId);
  requireBoundAgent(deps, chiefRow);

  let threadRow: ThreadRow | undefined;
  if (body.threadId !== null) {
    threadRow = getChiefThread(deps, body.threadId);
    if (!threadRow || threadRow.teamId !== teamId) {
      throw new HttpError(404, `chief thread ${body.threadId}`);
    }
  }
  const now = nowMs();
  if (!threadRow) {
    const id = newChiefThreadId(newUuidv7()); // thread id 形 chief-<uuid>（r5 §3.6）
    deps.db
      .insert(chiefThread)
      .values({
        id,
        chiefId: chiefRow.id,
        userId: deps.user.id,
        teamId,
        title: chiefThreadTitle(body.content),
        createdAt: now,
        updatedAt: now,
        lastTurnAt: null,
        sessionRuntime: 'pi',
        sessionId: '', // 引擎会话未开——首轮 new session（done 回传后落值）
        sessionOpenedAt: now,
        pendingSessionResumeAt: null,
        toolDefHashes: chiefToolDefHashes(),
        toolResultHashes: {},
        activeRun: null,
      })
      .run();
    threadRow = getChiefThread(deps, id);
    if (!threadRow) throw new Error('chief thread missing after insert');
  }

  const message = {
    id: newRecordId(),
    role: 'user' as const,
    content: body.content,
    createdAt: now,
  };
  deps.db
    .insert(chiefMessage)
    .values({
      id: message.id,
      threadId: threadRow.id,
      role: 'user',
      content: body.content,
      createdAt: now,
    })
    .run();
  deps.db.update(chiefThread).set({ updatedAt: now }).where(eq(chiefThread.id, threadRow.id)).run();

  enqueueChiefStep(deps, threadRow.id, { prompt: body.content, trigger: 'user' });
  return { thread: toChiefThreadRecord(threadRow), message };
}

/** chief 步入队（step 队列复用 [设计]：buildId = conv id = thread id，无 build
 * 行）+ activeRun 置位（r5 §3.5 `{phase:"chief"}`）+ 机器 wake。 */
export function enqueueChiefStep(
  deps: ChiefDeps,
  threadId: string,
  opts: { prompt: string; trigger: 'user' | ChiefWakeKind | 'wake' },
): string {
  const threadRow = getChiefThread(deps, threadId);
  if (!threadRow) throw new HttpError(404, `chief thread ${threadId}`);
  const id = newRecordId();
  const prompt =
    opts.trigger === 'user' ? opts.prompt : `${WAKE_PROMPT_PREFIX}${opts.trigger}] ${opts.prompt}`;
  deps.db
    .insert(step)
    .values({
      id,
      buildId: threadId,
      kind: 'chief',
      machineId: null,
      status: 'pending',
      prompt,
      createdAt: nowMs(),
    })
    .run();
  const activeRun = { phase: 'chief' } satisfies ActiveRun;
  deps.db
    .update(chiefThread)
    .set({ activeRun, updatedAt: nowMs() })
    .where(eq(chiefThread.id, threadId))
    .run();
  deps.machineHub?.wake(threadRow.teamId);
  return id;
}

// —— watch/wake 主动回路（r5 §3.5）—————————————————————————————————————————

/** 派工即自动 watch（run_builds relay 挂接）；reason canon =
 * CHIEF_WATCH_REASON_DISPATCH（r5 §3.5 API 原样）。同 todo 重复 watch 幂等。 */
export function addChiefWatch(
  deps: ChiefDeps,
  input: {
    teamId: string;
    todo: TodoRecord;
    projectName: string;
    threadId: string;
    reason?: string;
  },
): void {
  const chiefRow = ensureChief(deps, input.teamId);
  if (chiefRow.watches.some((w) => w.todoId === input.todo.id)) return;
  const threadRow = getChiefThread(deps, input.threadId);
  const watch: ChiefWatch = {
    todoId: input.todo.id,
    projectId: input.todo.projectId,
    seqNum: input.todo.seqNum,
    title: input.todo.title,
    projectName: input.projectName,
    phase: input.todo.phase,
    reason: input.reason ?? CHIEF_WATCH_REASON_DISPATCH,
    createdAt: nowMs(),
    threadId: input.threadId,
    threadTitle: threadRow?.title ?? '',
  };
  deps.db
    .update(chief)
    .set({ watches: [...chiefRow.watches, watch] })
    .where(eq(chief.id, chiefRow.id))
    .run();
}

export function removeChiefWatches(deps: ChiefDeps, teamId: string, todoIds: string[]): void {
  const chiefRow = ensureChief(deps, teamId);
  const next = chiefRow.watches.filter((w) => !todoIds.includes(w.todoId));
  if (next.length !== chiefRow.watches.length) {
    deps.db.update(chief).set({ watches: next }).where(eq(chief.id, chiefRow.id)).run();
  }
}

/** phase 流转漏斗挂接（services/todos.ts setTodoPhase/updateTodo 调）：
 * gate（confirm/review 停驻）/settle（done）/failed 三触发 wake 轮；
 * settle/failed 后 watch 自动解除（r5 §3.5「watch 生命周期」实测）。 */
export function triggerChiefWakes(deps: ChiefDeps, todoRecord: TodoRecord, to: Phase): void {
  if (to !== 'confirm' && to !== 'review' && to !== 'done' && to !== 'failed') return;
  const chiefs = deps.db.select().from(chief).where(eq(chief.teamId, todoRecord.teamId)).all();
  for (const chiefRow of chiefs) {
    const watches = chiefRow.watches.filter((w) => w.todoId === todoRecord.id);
    if (watches.length === 0) continue;
    const kind: ChiefWakeKind = to === 'done' ? 'settle' : to === 'failed' ? 'failed' : 'gate';
    const buildId = todoRecord.latestBuildId;
    const buildRow = buildId
      ? deps.db.select().from(build).where(eq(build.id, buildId)).get()
      : undefined;
    for (const watch of watches) {
      // 陈旧 watch 自愈：线程已删 → 跳过并解除该 watch（不阻断 phase 流转）。
      if (!getChiefThread(deps, watch.threadId)) {
        removeChiefWatches(deps, todoRecord.teamId, [todoRecord.id]);
        continue;
      }
      const facts = wakeFacts(kind, todoRecord, buildRow?.errorMessage ?? null);
      enqueueChiefStep(deps, watch.threadId, { prompt: facts, trigger: kind });
    }
    if (kind === 'settle' || kind === 'failed') {
      removeChiefWatches(deps, todoRecord.teamId, [todoRecord.id]);
    }
  }
}

/** wake 轮事实文本（server 合成 [设计]；r5 §3.5 汇报行为的宿主侧输入——
 * 汇报措辞由 LLM 产，法证式汇报要点按 r5 §3.5 样本指引）。 */
export function wakeFacts(
  kind: ChiefWakeKind,
  todo: TodoRecord,
  errorMessage: string | null,
): string {
  const ref = `#${todo.seqNum}「${todo.title}」`;
  switch (kind) {
    case 'gate':
      return `任务 ${ref} 停驻在 ${todo.phase} 关口。请查看当前结果并向用户汇报；需要用户确认或答复时，说明下一步动作。`;
    case 'settle':
      return `任务 ${ref} 已合并完成（done）。请向用户汇报结果已确认落地；该任务的关注已自动解除。`;
    case 'failed':
      return `任务 ${ref} 运行失败${errorMessage ? `：${errorMessage}` : ''}。请先调用 machines 等工具核实环境，再向用户做法证式汇报（失败原因/定性/工作保全位置/环境建议）。`;
  }
}

/** set_wake/clear_wake/wakes（r5 §10：wakes[] 非空形态未实测 [推断] 开放
 * 条目；到期触发 = scheduler tick 挂接 fireDueChiefWakes [设计]）。 */
export function setChiefWake(
  deps: ChiefDeps,
  teamId: string,
  input: { at: number; note?: string; todoId?: string; threadId: string },
): Record<string, unknown> {
  const chiefRow = ensureChief(deps, teamId);
  const wake = {
    id: newRecordId(),
    at: input.at,
    note: input.note ?? null,
    todoId: input.todoId ?? null,
    threadId: input.threadId,
    createdAt: nowMs(),
  };
  deps.db
    .update(chief)
    .set({ wakes: [...chiefRow.wakes, wake] })
    .where(eq(chief.id, chiefRow.id))
    .run();
  return wake;
}

export function clearChiefWake(deps: ChiefDeps, teamId: string, wakeId: string): boolean {
  const chiefRow = ensureChief(deps, teamId);
  const next = chiefRow.wakes.filter((w) => w.id !== wakeId);
  if (next.length === chiefRow.wakes.length) return false;
  deps.db.update(chief).set({ wakes: next }).where(eq(chief.id, chiefRow.id)).run();
  return true;
}

/** 到期 wake → chief 步（scheduler tick 每轮调用，遍历全部 chief 行；
 * 「约定到点回头核实」r5 §2 关注与提醒 tab set_wake 语义的触发半，节奏 =
 * scheduler tick [设计]）。 */
export function fireDueChiefWakes(deps: ChiefDeps, now: number): void {
  const chiefs = deps.db.select().from(chief).all();
  for (const chiefRow of chiefs) {
    const due = chiefRow.wakes.filter((w) => typeof w.at === 'number' && w.at <= now);
    if (due.length === 0) continue;
    deps.db
      .update(chief)
      .set({ wakes: chiefRow.wakes.filter((w) => !due.includes(w)) })
      .where(eq(chief.id, chiefRow.id))
      .run();
    for (const wake of due) {
      const note = typeof wake.note === 'string' ? wake.note : '约定时间已到';
      enqueueChiefStep(deps, String(wake.threadId), {
        prompt: `${note}。请回头核实相关任务状态并向用户汇报。`,
        trigger: 'wake',
      });
    }
  }
}

// —— claim 面（机器领取 chief 步的载荷组装，services/machines.ts 消费）———————

/** chief 步 system prompt（02 §4.3 接口契约「输入 = 用户自然语言消息 + 团队
 * 资源清单」的宿主合成 [设计]；策略指引 = r5 §3.2–§3.5 实测行为的黑盒逼近
 * ——指引文本本身非官方原件，04 §1 A4 边界）。 */
export function composeChiefSystemPrompt(deps: ChiefDeps, teamId: string): string {
  const chiefRow = ensureChief(deps, teamId);
  const agentRow = chiefRow.agentId
    ? deps.db.select().from(agent).where(eq(agent.id, chiefRow.agentId)).get()
    : undefined;
  const projects = deps.db.select().from(project).where(eq(project.teamId, teamId)).all();
  const agents = deps.db.select().from(agent).where(eq(agent.teamId, teamId)).all();
  const machines = deps.db.select().from(machine).where(eq(machine.teamId, teamId)).all();
  const skills = deps.db.select().from(skill).where(eq(skill.teamId, teamId)).all();
  const memories = agentRow
    ? deps.db.select().from(agentMemory).where(eq(agentMemory.agentId, agentRow.id)).all()
    : [];

  const lines: string[] = [
    '你是「总管」（Chief）——每「用户×团队」一个的调度与对话代理：理解用户请求、创建任务、分派给合适的 Agent 执行，并在关口/落地/失败时跟进汇报。',
    '',
    '## 章程（常设指示）',
    chiefRow.charter !== '' ? chiefRow.charter : '（尚无章程）',
    '',
    '## 你的运行位',
    agentRow
      ? `绑定 Agent：${agentRow.displayName}（${agentRow.provider ?? 'n/a'}/${agentRow.modelId ?? 'n/a'}）。职责：${agentRow.description ?? '未设置职责'}`
      : '未绑定 Agent。',
    '',
    '## 团队资源清单',
    `projects: ${JSON.stringify(projects.map((p) => ({ id: p.id, name: p.name, repoKind: p.repoKind })))}`,
    `agents: ${JSON.stringify(agents.map((a) => ({ id: a.id, displayName: a.displayName, description: a.description, modelId: a.modelId })))}`,
    `machines: ${JSON.stringify(machines.map((m) => ({ id: m.id, name: m.name, online: m.online, latestCliVersion: m.latestCliVersion })))}`,
    `skills: ${JSON.stringify(skills.map((s) => ({ id: s.id, name: s.name })))}`,
    '',
    '## 记忆（与绑定 Agent 共用同一份存储）',
    memories.length > 0
      ? memories.map((m) => `- ${m.title}：${m.content}`).join('\n')
      : '（尚无记忆）',
    '',
    '## 工作约定',
    '- 措辞→spec：把用户口语请求变换为 todo——title = 动词短语提炼；spec = 三段式：① 用户原文 blockquote（`> …`）② `要求：` bullet 展开（文件位置/内容要点/读者对象）③ 需要时 `补充信息（探测得出，非用户确认）：` bullet（先探测仓库/资源再写事实，显式标注非用户确认）。',
    '- 拆分：单请求 → 单 todo；多子事项以 ` + ` 并入标题，不过度拆分。',
    '- 分派：读 agents 的职责文本按权重选择（纯文档→文档职责 Agent；含代码→代码职责 Agent）；run_builds 传 assignment.build.agentId，默认 withPlan:false 直接执行。',
    '- 回执：派工后向用户复述要求、点名承接 Agent 的职责语义（如「由文档专职 Agent [名](agent:<id>) 承接」），并说明完成或需要确认时会跟进汇报。',
    '- wake 轮：汇报区分「委派已受理」与「结果已确认」两阶段；failed wake 先调 machines 等工具核实环境，再做法证式汇报（失败原因/定性/工作保全位置/环境建议）。',
    '- 正文内联实体引用用自定义 URI markdown：[名](agent:<id>)、[#n](todo:<id>)。',
    '- 记忆写入：仅在用户明确要求或明显值得沉淀时 save_memory（配额 100 条）。',
    '- 用与用户相同的语言回复。',
  ];
  return lines.join('\n');
}

/** claim 载荷的 chief 块 + 会话解析（services/machines.ts tryClaim 消费）。 */
export function chiefClaimContext(
  deps: ChiefDeps,
  threadId: string,
): {
  systemPrompt: string;
  trigger: 'user' | ChiefWakeKind | 'wake';
  sessionId: string | null;
} | null {
  const threadRow = getChiefThread(deps, threadId);
  if (!threadRow) return null;
  return {
    systemPrompt: composeChiefSystemPrompt(deps, threadRow.teamId),
    // continue 判定：引擎会话已开（done 回传落值）→ 续轮（r5 §3.5 wake 轮
    // `continue session chief-…` 实测）。
    sessionId: threadRow.sessionId !== '' ? threadRow.sessionId : null,
    trigger: 'user', // 实际触发词由 step.prompt 标记解析（machines.ts）
  };
}

export function parseChiefTrigger(prompt: string | null): 'user' | ChiefWakeKind | 'wake' {
  if (!prompt) return 'user';
  const m = /^\[wake:(\w+)\]/.exec(prompt);
  if (!m) return 'user';
  const kind = m[1];
  return kind === 'gate' || kind === 'settle' || kind === 'failed' || kind === 'wake'
    ? kind
    : 'wake';
}

// —— done/upload 面（回合收尾落库）———————————————————————————————————————————

/** chief 回合收尾：thread.sessionId（continue 复用面）+ lastTurnAt + activeRun
 * 清空；chief.lastTurnAt（r5 §3.6 记录字段）。 */
export function finishChiefTurn(deps: { db: Db }, threadId: string, body: MachineDoneBody): void {
  const threadRow = deps.db.select().from(chiefThread).where(eq(chiefThread.id, threadId)).get();
  if (!threadRow) return;
  const now = nowMs();
  deps.db
    .update(chiefThread)
    .set({
      ...(body.sessionId !== undefined ? { sessionId: body.sessionId } : {}),
      activeRun: null,
      lastTurnAt: now,
      updatedAt: now,
    })
    .where(eq(chiefThread.id, threadId))
    .run();
  deps.db.update(chief).set({ lastTurnAt: now }).where(eq(chief.id, threadRow.chiefId)).run();
}

/** transcript 终稿/live 工具行 → chief_message 落库（02 §1.3 数据所有权的
 * chief 面投影 [设计]：message 表按 conversationId 键控，chief conv 无 build，
 * 行落 chief_message 与线程面同表族）。id 幂等 upsert。 */
export function upsertChiefMessage(
  db: Db,
  row: {
    id: string;
    threadId: string;
    role: 'system' | 'user' | 'assistant';
    content: unknown;
    createdAt: number;
  },
): void {
  db.insert(chiefMessage)
    .values(row)
    .onConflictDoUpdate({
      target: chiefMessage.id,
      set: { role: row.role, content: row.content, createdAt: row.createdAt },
    })
    .run();
  db.update(chiefThread).set({ updatedAt: nowMs() }).where(eq(chiefThread.id, row.threadId)).run();
}

/** chief_message 通知（r5 §7.2：type chief_message、snippet = 消息全文、
 * agent = 绑定 Agent）：回合收尾取最后一条 assistant 文本发事件。 */
export function notifyChiefTurn(deps: ChiefDeps, threadId: string): void {
  const threadRow = getChiefThread(deps, threadId);
  if (!threadRow) return;
  const last = deps.db
    .select()
    .from(chiefMessage)
    .where(and(eq(chiefMessage.threadId, threadId), eq(chiefMessage.role, 'assistant')))
    .orderBy(desc(chiefMessage.createdAt))
    .limit(1)
    .get();
  const text = last ? extractText(last.content) : null;
  if (text === null || text === '') return;
  const chiefRow = deps.db.select().from(chief).where(eq(chief.id, threadRow.chiefId)).get();
  const agentRow = chiefRow?.agentId
    ? deps.db.select().from(agent).where(eq(agent.id, chiefRow.agentId)).get()
    : undefined;
  notifyChiefMessage(deps, {
    threadId,
    message: text,
    agent: agentRow
      ? { name: agentRow.displayName, avatarUrl: agentRow.avatarUrl }
      : { name: deps.user.displayName, avatarUrl: deps.user.avatarUrl },
  });
}

/** content → 纯文本（assistant 行 content 形 pi 依赖 [推断]：string 或
 * {type:"text",text}[] 块列——两形都收）。 */
export function extractText(content: unknown): string | null {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const parts = content
      .map((b) =>
        b !== null && typeof b === 'object' && 'text' in b && typeof b.text === 'string'
          ? b.text
          : null,
      )
      .filter((t): t is string => t !== null);
    return parts.length > 0 ? parts.join('') : null;
  }
  return null;
}

/** GET /api/conversations/chief-<threadId>/messages 的 chief 分支行集。 */
export function chiefThreadMessages(db: Db, threadId: string) {
  return db
    .select()
    .from(chiefMessage)
    .where(eq(chiefMessage.threadId, threadId))
    .orderBy(asc(chiefMessage.createdAt))
    .all();
}
