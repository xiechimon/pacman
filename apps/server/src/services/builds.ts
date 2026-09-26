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
  Phase,
  StepJournalRow,
  StepRecord,
  TriggerSource,
  UserRecord,
} from '@pacman/shared';
import { MERGE_ANNOUNCEMENT, PLAN_FILE_NAME, STOP_MESSAGE } from '@pacman/shared';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import {
  build,
  message,
  plan as planTable,
  steerPending,
  step,
  stopPending,
  todo,
} from '../db/schema.js';
import { HttpError } from '../lib/errors.js';
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

/** steer 写面（W3 #278，06 册 D9）：build 会话运行中补话——claimed 步门
 * （无在跑步 = 409 不静默，spec #277「agent 不在跑时发送要被明确拒绝」）+
 * 单槽 pending upsert（双发覆盖）+ transcript user 行（insertMessageRow 同形）
 * + machine steer 信号（拉取-确认投递的触发沿，services/machines）。 */
export function sendBuildSteer(
  deps: BuildDeps,
  conversationId: string,
  body: { content: string },
): { message: { id: string; role: 'user'; content: string; createdAt: number } } {
  const { db } = deps;
  const buildRow = db.select().from(build).where(eq(build.id, conversationId)).get();
  if (!buildRow) throw new HttpError(404, `conversation ${conversationId}`);
  // activeRun 门 = 该会话存在已领取未收尾的步（agent 在跑）；plan/build/merge
  // 步序贯，取最新 claimed。
  const running = db
    .select()
    .from(step)
    .where(and(eq(step.buildId, conversationId), eq(step.status, 'claimed')))
    .all()
    .at(-1);
  if (!running) {
    throw new HttpError(409, 'no active step on this conversation (steer 只对运行中的会话生效)');
  }
  const now = nowMs();
  const messageRow = {
    id: newRecordId(),
    role: 'user' as const,
    content: body.content,
    createdAt: now,
  };
  insertMessageRow(deps, conversationId, messageRow);
  db.insert(steerPending)
    .values({ conversationId, stepId: running.id, content: body.content, createdAt: now })
    .onConflictDoUpdate({
      target: steerPending.conversationId,
      set: { stepId: running.id, content: body.content, createdAt: now },
    })
    .run();
  const todoRow = db.select().from(todo).where(eq(todo.id, buildRow.todoId)).get();
  if (todoRow) deps.machineHub?.steerSignal(todoRow.teamId, running.id);
  return { message: messageRow };
}

/** GET /conversations/{id}/messages 的 build 分支 steerPending 读位（单槽
 * 内容数组化——封套数组形观测，r5 §3.6）。 */
export function readSteerPending(db: Db, conversationId: string): string[] {
  const pending = db
    .select()
    .from(steerPending)
    .where(eq(steerPending.conversationId, conversationId))
    .get();
  return pending ? [pending.content] : [];
}

/** 停止写面（M7 #308，r9 §3.3 停止钮 / 08 册附录 A composer 停止钮行）：
 * POST /api/builds/{id}/stop body {discard}——中断当前活动步。
 * - claimed 步 = 机器信号面（stop_pending 单槽 upsert + machine stream stop
 *   事件 → GET /api/machine/stop 拉取-确认 → daemon live.stop()，#278 steer
 *   同律）→ {delegated:true} 202；中断在途，done(stopped) 回报才落账。
 * - pending 步 = 无机器可通知，server 侧即时取消 → {delegated:false} 200。
 * 无活动步 = 409 不静默（steer 门同律）。 */
export function requestStop(
  deps: BuildDeps,
  buildId: string,
  body: { discard: boolean },
): { delegated: boolean } {
  const { db } = deps;
  const buildRow = db.select().from(build).where(eq(build.id, buildId)).get();
  if (!buildRow) throw new NotFoundError(`build ${buildId}`);
  // 活动步 = pending/claimed（步序贯，取最新一条；orderBy 显式钉死语义，
  // 不依赖隐式 rowid 序）。
  const active = db
    .select()
    .from(step)
    .where(and(eq(step.buildId, buildId), inArray(step.status, ['pending', 'claimed'])))
    .orderBy(asc(step.createdAt))
    .all()
    .at(-1);
  if (!active) {
    throw new HttpError(409, 'no active step on this build (stop 只对运行中的任务生效)');
  }
  if (active.status === 'pending') {
    applyStoppedStep(deps, active.id);
    return { delegated: false };
  }
  const now = nowMs();
  db.insert(stopPending)
    .values({ conversationId: buildId, stepId: active.id, discard: body.discard, createdAt: now })
    .onConflictDoUpdate({
      target: stopPending.conversationId,
      set: { stepId: active.id, discard: body.discard, createdAt: now },
    })
    .run();
  const todoRow = db.select().from(todo).where(eq(todo.id, buildRow.todoId)).get();
  if (todoRow) deps.machineHub?.stopSignal(todoRow.teamId, active.id);
  return { delegated: true };
}

/** gate 回落目标（r9 §3.3「todo 落上一完成 turn 的 gate」的 build 内投影
 * [设计]——pacman 重跑 = 新 build 新会话新分支，跨 build 回落会指向旧会话的
 * 变更面（latestBuildId 已换），故回落以本 build 为界）：最近 done 步的
 * 关口（plan→confirm / build|merge→review）；无 done 步 → build.prevPhase
 * （回到本轮开始前的面：fresh→todo、失败重跑→failed、定时复跑→done…）。 */
function stopFallbackPhase(db: Db, buildRow: BuildRow): Phase {
  const lastDone = db
    .select()
    .from(step)
    .where(and(eq(step.buildId, buildRow.id), eq(step.status, 'done')))
    .orderBy(asc(step.createdAt))
    .all()
    .at(-1);
  if (lastDone) return lastDone.kind === 'plan' ? 'confirm' : 'review';
  return buildRow.prevPhase ?? 'todo';
}

/** 停止落账（pending 步即时取消 × done(stopped) 机器回报两面单源）：
 * step stopped + build.errorMessage 取消标记（STOP_MESSAGE，运行历史面数据源）
 * + gate 回落 + stop_pending 清理 + 会话流/文档事件推送。
 * 回落绕过 setTodoPhase 漏斗 [设计]：取消回退边不在前进流转表（如
 * building→confirm、planning→todo），且取消是用户在场动作——不触发
 * confirm/review 进入通知与 chief wake（重复通知 = 误导）。 */
export function applyStoppedStep(deps: BuildDeps, stepId: string): void {
  const { db } = deps;
  const stepRow = db.select().from(step).where(eq(step.id, stepId)).get();
  if (!stepRow) throw new NotFoundError(`step ${stepId}`);
  db.update(step).set({ status: 'stopped' }).where(eq(step.id, stepId)).run();
  db.delete(stopPending).where(eq(stopPending.conversationId, stepRow.buildId)).run();
  const stoppedRow = db.select().from(step).where(eq(step.id, stepId)).get();
  if (stoppedRow) {
    deps.convHub?.publishStep(stepRow.buildId, {
      id: stoppedRow.id,
      buildId: stoppedRow.buildId,
      kind: stoppedRow.kind,
      machineId: stoppedRow.machineId,
      createdAt: stoppedRow.createdAt,
      status: stoppedRow.status,
      checkpointCommit: stoppedRow.checkpointCommit,
    });
  }
  const buildRow = db.select().from(build).where(eq(build.id, stepRow.buildId)).get();
  if (!buildRow) return;
  db.update(build).set({ errorMessage: STOP_MESSAGE }).where(eq(build.id, buildRow.id)).run();
  const cancelledRow = db.select().from(build).where(eq(build.id, buildRow.id)).get();
  if (cancelledRow) publishBuild(deps, cancelledRow);
  const todoRow = db.select().from(todo).where(eq(todo.id, buildRow.todoId)).get();
  if (!todoRow) return;
  const target = stopFallbackPhase(db, buildRow);
  if (todoRow.phase === target) return;
  db.update(todo)
    .set({ phase: target, phaseAt: nowMs(), v: todoRow.v + 1 })
    .where(eq(todo.id, todoRow.id))
    .run();
  const record = getTodo(deps, todoRow.id);
  if (record) deps.hub.publishTodoDoc(record.teamId, record);
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

/** plan 步未产 plan.md 的自动补写指令（#113 裁定候选1，02 §4.2「plan 即文件」
 * 交接物契约执行；四段落要求同驳回重规划指令族——措辞由本层给事实与要求）。 */
const PLAN_REWRITE_PROMPT = `规划步未产出 ${PLAN_FILE_NAME} 交接文件。请将方案写入工作区根目录的 ${PLAN_FILE_NAME}（覆盖 Context/Changes/Edge cases/Verification 四段）再结束本步；若改动已在规划轮完成，${PLAN_FILE_NAME} 如实记录改动内容与验证方式即可。`;

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
    // 交接物校验（#113：05 §5 实跑发现规划轮可跳过写 plan.md 直接交付，build 轮
    // 仅剩 confirm 关口措辞而拿不到任务内容）：首轮规划步成功但未产 plan.md →
    // 不算成——留 planning + 自动补写一轮。有界：仅首轮触发（续轮指令步 prompt
    // 非 null——补写轮/驳回重规划轮仍无产物 → 放行 confirm，关口决策交还人；
    // 此时 build 步有 spec 兜底，见 machines.ts claim 合成）。
    const planDoc = deps.db
      .select({ id: planTable.id })
      .from(planTable)
      .where(eq(planTable.buildId, stepRow.buildId))
      .get();
    if (!planDoc && stepRow.prompt === null) {
      enqueueStep(deps, stepRow.buildId, 'plan', todoRow.teamId, PLAN_REWRITE_PROMPT);
      return;
    }
    // plan 卡就绪 → confirm（02 §4.2：phase=confirm 等人工）；hasPlan 据实置位
    // （无交接物不谎称有方案——看板 plan chip 数据源）。
    if (planDoc) {
      deps.db.update(todo).set({ hasPlan: true }).where(eq(todo.id, todoRow.id)).run();
    }
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
