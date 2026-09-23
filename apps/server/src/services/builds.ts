// build 服务面（02 §4.2/A6 锁定语义）：
// - 实体等式：一次运行 = 一个 build = 一个 conversation；buildId ≡ conversationId
//   （UUIDv7，r3 §3.0）。
// - step 队列 server 持有、机器 claim：POST builds → 入队规划步（withPlan）或
//   执行步（直执行）；确认 → 入队执行步；驳回 → 入队重规划步（同 conv
//   continue session，执行在 M3）；merge → 202 delegated + 入队合并步。
// - 失败仅人工重跑（r3 §3.7）：重跑 = 新 POST builds（新 conv/新 build）。
// 机器侧执行（claim/心跳/phase 推进 planning→confirm→…）归 M3；本层只持有
// 队列与人工触发的 phase 流转。

import type {
  Assignment,
  BuildRecord,
  StepJournalRow,
  StepRecord,
  TriggerSource,
  UserRecord,
} from '@pacman/shared';
import { MERGE_ANNOUNCEMENT } from '@pacman/shared';
import { asc, eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { build, message, step, todo } from '../db/schema.js';
import { newRecordId, newUuidv7, nowMs } from '../lib/ids.js';
import type { ConversationStreamHub, TeamStreamHub } from './events.js';
import type { MachineWakeHub } from './machines.js';
import { assertPhaseTransition } from './phase.js';
import { getTodo, setTodoPhase } from './todos.js';

export interface BuildDeps {
  db: Db;
  hub: TeamStreamHub;
  /** 机器 wake 通道（入队即唤醒 claim 长轮询 + machine stream，02 §5.4）；
   * 缺省 = 无机器面（M2a 编排测试形态）。 */
  machineHub?: MachineWakeHub;
  /** 通知收件人（completeStep 经 setTodoPhase 漏斗发三事件，02 §9.1）。 */
  user: UserRecord;
  /** conversation stream 通道（M5 live streaming：入队步/驳回与合并用户行
   * 即时推送，02 §1.2 会话流）；缺省 = 无会话流面。 */
  convHub?: ConversationStreamHub;
}

type BuildRow = typeof build.$inferSelect;

export function toBuildRecord(row: BuildRow): BuildRecord {
  return {
    id: row.id,
    todoId: row.todoId,
    withPlan: row.withPlan,
    prevPhase: row.prevPhase ?? null,
    triggerSource: row.triggerSource,
    pinnedMachineId: row.pinnedMachineId,
    planDocId: row.planDocId,
    errorMessage: row.errorMessage,
    prUrl: row.prUrl,
    prNumber: row.prNumber,
    diffHash: row.diffHash,
    createdAt: row.createdAt,
  };
}

/** transcript 行落库 + 会话流即时推送（M5 live streaming：驳回 feedback 行/
 * 合并宣告行/🎉 行三处同形；machine 面 live 行走 machines.ts upsert 族）。 */
export function insertMessageRow(
  deps: { db: Db; convHub?: ConversationStreamHub },
  conversationId: string,
  row: {
    id: string;
    role: 'system' | 'user' | 'assistant';
    content: unknown;
    createdAt: number;
  },
): void {
  deps.db
    .insert(message)
    .values({ ...row, conversationId })
    .run();
  deps.convHub?.publishMessage(conversationId, row);
}

function publishBuild(deps: BuildDeps, row: BuildRow): BuildRecord {
  const record = toBuildRecord(row);
  const todoRow = deps.db.select().from(todo).where(eq(todo.id, row.todoId)).get();
  if (todoRow) deps.hub.publishBuildDoc(todoRow.teamId, record);
  return record;
}

function enqueueStep(
  deps: BuildDeps,
  buildId: string,
  kind: StepRecord['kind'],
  teamId: string,
  /** [内部] 续轮指令（step.prompt）：驳回 feedback 注入重规划轮（r5 §4「v2
   * 忠实执行反馈」的宿主等价物）；claim 载荷 instruction 位透出。 */
  prompt?: string,
): StepRecord {
  const id = newRecordId(); // base64 样 21 字符（r5 §3.1 claim step=…）
  const createdAt = nowMs();
  deps.db
    .insert(step)
    .values({
      id,
      buildId,
      kind,
      machineId: null,
      status: 'pending',
      prompt: prompt ?? null,
      createdAt,
    })
    .run();
  // 入队即 wake（低延迟派发，02 §1.2/§5.4；claim 长轮询等待者 + SSE 双通道）。
  deps.machineHub?.wake(teamId);
  // 会话流 step 事件（pending）：详情页进度行即时更新（M5 live streaming）。
  deps.convHub?.publishStep(buildId, {
    id,
    buildId,
    kind,
    machineId: null,
    createdAt,
    status: 'pending',
    checkpointCommit: null,
  });
  return { id, buildId, kind, machineId: null, createdAt };
}

export function getBuild(deps: BuildDeps, id: string): BuildRecord | null {
  const row = deps.db.select().from(build).where(eq(build.id, id)).get();
  return row ? toBuildRecord(row) : null;
}

// steps 读面行 = shared stepJournalRowSchema 单源（record + journal 位透出
// [设计]，02 §5.4「journal 状态字段归实现期展开」；zod strip 下 record 对拍
// 不漂移）。

export function listSteps(deps: BuildDeps, buildId: string): StepJournalRow[] {
  return deps.db
    .select()
    .from(step)
    .where(eq(step.buildId, buildId))
    .orderBy(asc(step.createdAt))
    .all()
    .map((r) => ({
      id: r.id,
      buildId: r.buildId,
      kind: r.kind,
      machineId: r.machineId,
      createdAt: r.createdAt,
      status: r.status,
      checkpointCommit: r.checkpointCommit,
    }));
}

/** 开始/重跑：POST /api/projects/{id}/builds body {todoIds[], assignment,
 * withPlan}（r5 §3.4 人工启动抓包原样；todoIds 数组 = 批量形状）。
 * 每 todo：phase→queued（重跑自 failed 同边，r3 §3.7）+ 建 build（UUIDv7，
 * triggerSource 记录）+ 入队首步。 */
export function startBuilds(
  deps: BuildDeps,
  input: {
    projectId: string;
    todoIds: string[];
    assignment: Assignment;
    withPlan: boolean;
    triggerSource?: TriggerSource; // 默认 user；schedule = 定时触发（services/scheduler.ts）；chief 面归 M4
    /** 钉选机器（schedule.machineId 透传，null = 自动，r3 §9/02 §6.2）。 */
    pinnedMachineId?: string | null;
  },
): BuildRecord[] {
  const triggerSource = input.triggerSource ?? 'user';
  const created: BuildRecord[] = [];
  for (const todoId of input.todoIds) {
    const todoRecord = getTodo(deps, todoId);
    if (!todoRecord || todoRecord.projectId !== input.projectId) {
      throw new NotFoundError(`todo ${todoId}`);
    }
    // todo → queued（02 §4.1：已启动，等空闲机器）。
    assertPhaseTransition(todoRecord.phase, 'queued');
    const id = newUuidv7(); // buildId ≡ conversationId（UUIDv7，r3 §3.0）
    const createdAt = nowMs();
    deps.db
      .insert(build)
      .values({
        id,
        todoId,
        withPlan: input.withPlan,
        prevPhase: todoRecord.phase,
        triggerSource,
        pinnedMachineId: input.pinnedMachineId ?? null,
        planDocId: null,
        errorMessage: null,
        prUrl: null,
        prNumber: null,
        diffHash: null,
        createdAt,
      })
      .run();
    // 首步：先做规划 = 规划步；立即执行 = 执行步（02 §4.2 开始 dialog 两分支）。
    enqueueStep(deps, id, input.withPlan ? 'plan' : 'build', todoRecord.teamId);
    setTodoPhase(deps, todoId, 'queued', {
      assignment: input.assignment,
      latestBuildId: id,
      lastRunAt: createdAt,
    });
    const row = deps.db.select().from(build).where(eq(build.id, id)).get();
    if (!row) throw new Error('build missing after insert');
    created.push(publishBuild(deps, row));
  }
  return created;
}

/** 确认回路（02 §4.2，r5 §4 实走）：POST /api/builds/{id}/steps
 * - {action:"confirm"} → confirm→building + 入队执行步（直执行时 building 中
 *   的再确认不适用，409 由流转表兜底）。
 * - {action:"revision", side:"plan", feedback, clientMessageId} → confirm→
 *   planning + 入队重规划步（同 conv continue session 语义归 M3）+ 时间线插
 *   用户驳回消息行（r5 §4）。 */
export function applyBuildStepAction(
  deps: BuildDeps,
  buildId: string,
  body:
    | { action: 'confirm' }
    | { action: 'revision'; side: 'plan'; feedback: string; clientMessageId: string },
): void {
  const row = deps.db.select().from(build).where(eq(build.id, buildId)).get();
  if (!row) throw new NotFoundError(`build ${buildId}`);
  const todoRecord = getTodo(deps, row.todoId);
  if (!todoRecord) throw new NotFoundError(`todo ${row.todoId}`);

  if (body.action === 'confirm') {
    setTodoPhase(deps, todoRecord.id, 'building');
    enqueueStep(deps, buildId, 'build', todoRecord.teamId);
    return;
  }
  // revision：用户驳回消息行进 transcript（role user，r5 §3.6/§4 时间线呈现）。
  insertMessageRow(deps, buildId, {
    id: newRecordId(),
    role: 'user',
    content: body.feedback,
    createdAt: nowMs(),
  });
  setTodoPhase(deps, todoRecord.id, 'planning');
  // 重规划步（同 conv continue session，r5 §4）：feedback 注入续轮指令，v2 忠实
  // 执行反馈（宿主等价物——措辞由 LLM 侧组织，本层给事实与要求）。
  const replanPrompt = `用户对方案提出驳回。驳回反馈：「${body.feedback}」。请忠实按反馈调整方案，输出更新后的 plan.md（覆盖 Context/Changes/Edge cases/Verification 四段），并在结尾一句话摘要本次调整了什么。`;
  enqueueStep(deps, buildId, 'plan', todoRecord.teamId, replanPrompt);
}

/** 合并（02 §4.2/A6：merge = 202 delegated 机器执行；机器领合并步 continue
 * session 复用执行轮会话 → git merge --no-edit → phase=done，执行面归 M3）。 */
export function requestMerge(deps: BuildDeps, buildId: string): { delegated: true } {
  const row = deps.db.select().from(build).where(eq(build.id, buildId)).get();
  if (!row) throw new NotFoundError(`build ${buildId}`);
  const todoRow = deps.db.select().from(todo).where(eq(todo.id, row.todoId)).get();
  if (!todoRow) throw new NotFoundError(`todo ${row.todoId}`);
  // 合并关口 = review（「将改动合并到默认分支」确认弹层，r3 §3.6）。
  assertPhaseTransition(todoRow.phase, 'done');
  // 时间线「发起了合并」行（r3 §3.6 实测：`15:06 Xmon Dai 发起了合并`；
  // 行形 [设计]——role user 纯文本 = shared MERGE_ANNOUNCEMENT 单源，呈现层
  // 拼装时间/actor）。
  insertMessageRow(deps, buildId, {
    id: newRecordId(),
    role: 'user',
    content: MERGE_ANNOUNCEMENT,
    createdAt: nowMs(),
  });
  enqueueStep(deps, buildId, 'merge', todoRow.teamId);
  return { delegated: true };
}

/** 机器步完成后的 phase 推进（M3 claim/journal 面挂接点；M2a 供编排测试
 * 驱动状态机）：规划步成 → confirm（withPlan）/ building（直执行续跑）；
 * 执行步成 → review；合并步成 → done（02 §4.2 主时序）。 */
export function completeStep(
  deps: BuildDeps,
  stepId: string,
  outcome: { hasChanges?: boolean } = {},
): void {
  const stepRow = deps.db.select().from(step).where(eq(step.id, stepId)).get();
  if (!stepRow) throw new NotFoundError(`step ${stepId}`);
  deps.db.update(step).set({ status: 'done' }).where(eq(step.id, stepId)).run();
  const buildRow = deps.db.select().from(build).where(eq(build.id, stepRow.buildId)).get();
  if (!buildRow) return;
  const todoRow = deps.db.select().from(todo).where(eq(todo.id, buildRow.todoId)).get();
  if (!todoRow) return;

  if (stepRow.kind === 'plan') {
    // plan 卡就绪 → confirm（02 §4.2：phase=confirm 等人工）。
    deps.db.update(todo).set({ hasPlan: true }).where(eq(todo.id, todoRow.id)).run();
    setTodoPhase(deps, todoRow.id, 'confirm');
    return;
  }
  if (stepRow.kind === 'build') {
    setTodoPhase(deps, todoRow.id, 'review', {
      hasChanges: outcome.hasChanges ?? true,
    });
    return;
  }
  // merge 步成 → done + 🎉（时间线「发起了合并」+ 结果行 + `🎉 任务已完成`，
  // r3 §3.6；celebration 行 [设计] = role system 纯文本）。
  setTodoPhase(deps, todoRow.id, 'done');
  insertMessageRow(deps, buildRow.id, {
    id: newRecordId(),
    role: 'system',
    content: '🎉 任务已完成',
    createdAt: nowMs(),
  });
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = 'NotFoundError';
  }
}
