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
  StepRecord,
  TriggerSource,
  UserRecord,
} from '@pacman/shared';
import { asc, eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { build, message, step, todo } from '../db/schema.js';
import { newRecordId, newUuidv7, nowMs } from '../lib/ids.js';
import type { TeamStreamHub } from './events.js';
import { assertPhaseTransition } from './phase.js';
import { getTodo, setTodoPhase } from './todos.js';

export interface BuildDeps {
  db: Db;
  hub: TeamStreamHub;
  /** 通知收件人（completeStep 经 setTodoPhase 漏斗发三事件，02 §9.1）。 */
  user: UserRecord;
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

function publishBuild(deps: BuildDeps, row: BuildRow): BuildRecord {
  const record = toBuildRecord(row);
  const todoRow = deps.db.select().from(todo).where(eq(todo.id, row.todoId)).get();
  if (todoRow) deps.hub.publishBuildDoc(todoRow.teamId, record);
  return record;
}

function enqueueStep(deps: BuildDeps, buildId: string, kind: StepRecord['kind']): StepRecord {
  const id = newRecordId(); // base64 样 21 字符（r5 §3.1 claim step=…）
  const createdAt = nowMs();
  deps.db
    .insert(step)
    .values({ id, buildId, kind, machineId: null, status: 'pending', createdAt })
    .run();
  return { id, buildId, kind, machineId: null, createdAt };
}

export function getBuild(deps: BuildDeps, id: string): BuildRecord | null {
  const row = deps.db.select().from(build).where(eq(build.id, id)).get();
  return row ? toBuildRecord(row) : null;
}

export function listSteps(deps: BuildDeps, buildId: string): StepRecord[] {
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
    triggerSource?: TriggerSource; // 默认 user；chief/schedule 触发面归 M4/M2b
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
        pinnedMachineId: null,
        planDocId: null,
        errorMessage: null,
        prUrl: null,
        prNumber: null,
        diffHash: null,
        createdAt,
      })
      .run();
    // 首步：先做规划 = 规划步；立即执行 = 执行步（02 §4.2 开始 dialog 两分支）。
    enqueueStep(deps, id, input.withPlan ? 'plan' : 'build');
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
    enqueueStep(deps, buildId, 'build');
    return;
  }
  // revision：用户驳回消息行进 transcript（role user，r5 §3.6/§4 时间线呈现）。
  deps.db
    .insert(message)
    .values({
      id: newRecordId(),
      conversationId: buildId,
      role: 'user',
      content: body.feedback,
      createdAt: nowMs(),
    })
    .run();
  setTodoPhase(deps, todoRecord.id, 'planning');
  enqueueStep(deps, buildId, 'plan');
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
  enqueueStep(deps, buildId, 'merge');
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
  // merge 步成 → done + 🎉（时间线「发起了合并」+ 结果行，r3 §3.6）。
  setTodoPhase(deps, todoRow.id, 'done');
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = 'NotFoundError';
  }
}
