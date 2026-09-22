// todo 服务面：CRUD + record 投影（wire 形状 = shared todoRecordSchema，
// 02 §4.1/§6.2 字段即契约）+ 变更即发 team stream 文档事件（r5 §7.2 双保险
// 复刻侧：SSE 文档事件直更 + 前端重取兜底）。
// 派生字段（不存列）：tagIds（todo_tag join）、agent（assignment.build 槽 →
// agent 行）、buildHistory（build 表投影 {buildId, createdAt}，records/todo.ts
// 最小投影 [推断]）。

import type { Phase, TodoRecord } from '@pacman/shared';
import { and, asc, eq, max, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { agent, build, todo, todoTag } from '../db/schema.js';
import { newRecordId, nowMs } from '../lib/ids.js';
import type { TeamStreamHub } from './events.js';
import { assertPhaseTransition } from './phase.js';

type TodoRow = typeof todo.$inferSelect;

export interface TodoDeps {
  db: Db;
  hub: TeamStreamHub;
}

export function toTodoRecord(deps: TodoDeps, row: TodoRow): TodoRecord {
  const { db } = deps;
  const tagIds = db
    .select({ tagId: todoTag.tagId })
    .from(todoTag)
    .where(eq(todoTag.todoId, row.id))
    .all()
    .map((r) => r.tagId);
  const history = db
    .select({ buildId: build.id, createdAt: build.createdAt })
    .from(build)
    .where(eq(build.todoId, row.id))
    .orderBy(asc(build.createdAt))
    .all();
  // agent = assignment.build 槽引用（开始 dialog 执行侧 Agent，r5 §3.4/§5）。
  const buildAgentId = row.assignment?.build?.agentId ?? null;
  const agentRow = buildAgentId
    ? db.select().from(agent).where(eq(agent.id, buildAgentId)).get()
    : undefined;
  return {
    id: row.id,
    teamId: row.teamId,
    projectId: row.projectId,
    title: row.title,
    spec: row.spec,
    phase: row.phase,
    phaseAt: row.phaseAt,
    seqNum: row.seqNum,
    orderIndex: row.orderIndex,
    tagIds,
    assignment: row.assignment ?? null,
    agent: agentRow ? { id: agentRow.id, displayName: agentRow.displayName } : null,
    latestBuildId: row.latestBuildId,
    lastRunAt: row.lastRunAt,
    hasChanges: row.hasChanges,
    hasPlan: row.hasPlan,
    buildHistory: history,
    sourceTodo: row.sourceTodo,
    v: row.v,
    createdBy: row.createdBy,
    ownerId: row.ownerId,
    sourceBuildId: row.sourceBuildId,
  };
}

function getRow(deps: TodoDeps, id: string): TodoRow | undefined {
  return deps.db.select().from(todo).where(eq(todo.id, id)).get();
}

export function listTodos(
  deps: TodoDeps,
  filter: { teamId?: string; projectId?: string } = {},
): TodoRecord[] {
  const conds = [
    filter.teamId !== undefined ? eq(todo.teamId, filter.teamId) : undefined,
    filter.projectId !== undefined ? eq(todo.projectId, filter.projectId) : undefined,
  ].filter((c) => c !== undefined);
  const rows = deps.db
    .select()
    .from(todo)
    .where(conds.length > 0 ? and(...conds) : sql`1=1`)
    .orderBy(asc(todo.seqNum))
    .all();
  return rows.map((row) => toTodoRecord(deps, row));
}

export function getTodo(deps: TodoDeps, id: string): TodoRecord | null {
  const row = getRow(deps, id);
  return row ? toTodoRecord(deps, row) : null;
}

/** POST /api/projects/{id}/todos body {title, spec}（r3 §3.1 抓包原样）。 */
export function createTodo(
  deps: TodoDeps,
  input: {
    teamId: string;
    projectId: string;
    title: string;
    spec: string;
    /** 人工建 = seed 用户 id；Chief 派工 = 绑定 Agent id（records/todo.ts
     * 人工建取值未分离观测 [推断]，按属主用户填）。 */
    createdBy: string | null;
    ownerId: string | null;
  },
): TodoRecord {
  const { db, hub } = deps;
  // seqNum = 团队内持久序号（CONTEXT.md `#seqNum`；观测 #11–#14 跨项目递增，
  // 团队级计数 [推断]）。
  const seqRow = db
    .select({ n: max(todo.seqNum) })
    .from(todo)
    .where(eq(todo.teamId, input.teamId))
    .get();
  const seqNum = (seqRow?.n ?? 0) + 1;
  // orderIndex = 「待开始」列尾（列内排序位，records/todo.ts）。
  const orderRow = db
    .select({ n: max(todo.orderIndex) })
    .from(todo)
    .where(and(eq(todo.projectId, input.projectId), eq(todo.phase, 'todo')))
    .get();
  const now = nowMs();
  const id = newRecordId();
  db.insert(todo)
    .values({
      id,
      teamId: input.teamId,
      projectId: input.projectId,
      title: input.title,
      spec: input.spec,
      phase: 'todo',
      phaseAt: now,
      seqNum,
      orderIndex: (orderRow?.n ?? -1) + 1,
      assignment: null,
      latestBuildId: null,
      lastRunAt: null,
      hasChanges: false,
      hasPlan: false,
      sourceTodo: null,
      v: 1,
      createdBy: input.createdBy,
      ownerId: input.ownerId,
      sourceBuildId: null,
    })
    .run();
  const record = getTodo(deps, id);
  if (!record) throw new Error('todo missing after insert');
  hub.publishTodoDoc(input.teamId, record);
  return record;
}

/** PATCH /api/todos/{id}（[推断] REST 同名，02 §6.1 DELETE 面同规则；
 * update_todo 词表证据 r5 §3.1）。字段级 patch；任何变更 v++ 并发文档事件。 */
export function updateTodo(
  deps: TodoDeps,
  id: string,
  patch: {
    title?: string;
    spec?: string;
    phase?: Phase;
    tagIds?: string[];
    orderIndex?: number;
  },
): TodoRecord | null {
  const { db, hub } = deps;
  const row = getRow(deps, id);
  if (!row) return null;

  const sets: Partial<TodoRow> = {};
  if (patch.title !== undefined) sets.title = patch.title;
  if (patch.spec !== undefined) sets.spec = patch.spec;
  if (patch.orderIndex !== undefined) sets.orderIndex = patch.orderIndex;
  if (patch.phase !== undefined && patch.phase !== row.phase) {
    assertPhaseTransition(row.phase, patch.phase);
    sets.phase = patch.phase;
    sets.phaseAt = nowMs();
  }
  if (Object.keys(sets).length > 0) {
    sets.v = row.v + 1;
    db.update(todo).set(sets).where(eq(todo.id, id)).run();
  }
  if (patch.tagIds !== undefined) {
    db.delete(todoTag).where(eq(todoTag.todoId, id)).run();
    for (const tagId of patch.tagIds) {
      db.insert(todoTag).values({ todoId: id, tagId }).run();
    }
    if (Object.keys(sets).length === 0) {
      db.update(todo)
        .set({ v: row.v + 1 })
        .where(eq(todo.id, id))
        .run();
    }
  }

  const record = getTodo(deps, id);
  if (!record) return null;
  hub.publishTodoDoc(record.teamId, record);
  return record;
}

/** phase 流转（服务面统一入口：流转表校验 + phaseAt/v 维护 + 文档事件）。 */
export function setTodoPhase(
  deps: TodoDeps,
  id: string,
  to: Phase,
  extra: Partial<
    Pick<TodoRow, 'hasChanges' | 'hasPlan' | 'latestBuildId' | 'lastRunAt' | 'assignment'>
  > = {},
): TodoRecord | null {
  const { db } = deps;
  const row = getRow(deps, id);
  if (!row) return null;
  assertPhaseTransition(row.phase, to);
  db.update(todo)
    .set({ ...extra, phase: to, phaseAt: nowMs(), v: row.v + 1 })
    .where(eq(todo.id, id))
    .run();
  const record = getTodo(deps, id);
  if (!record) return null;
  deps.hub.publishTodoDoc(record.teamId, record);
  return record;
}

/** DELETE /api/todos/{id}（DELETE_FACE：REST 同名 DELETE [推断]；
 * delete_todos 词表证据 r5 §3.1）。build/step/message 经 FK cascade 随行。 */
export function deleteTodo(deps: TodoDeps, id: string): boolean {
  const { db } = deps;
  const row = getRow(deps, id);
  if (!row) return false;
  db.delete(todo).where(eq(todo.id, id)).run();
  return true;
}
