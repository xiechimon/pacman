// 项目删除面（#189）：DELETE /api/projects/{id} 级联语义。
// 取舍（级联语义设计点，PR 同文）：
// - 级联删，非拒绝非空——危险操作区 = 单确认语义（web 复活票 DeleteConfirm
//   家族 + invalidateAll，#172 Notes 正典）；拒绝非空要求的逐 todo 手删 UI
//   不存在，会把删除区变成事实死钮。
// - 清图序（事务内）：step（无 FK，deleteTodo 同款手动清）→ schedule（无 FK
//   列，免孤儿触发位——scheduler 触发面自愈是兜底不是语义）→ tag → todo
//   （FK cascade 随行 build/plan/todo_tag）→ chief watch 摘除（watches =
//   JSON 列无 FK，陈旧 watch 不自愈；不借 removeChiefWatches——其 ensureChief
//   create-on-read 会在删除路径凭空建行，且只覆盖单 chief 行）→
//   agentMemory.projectId 置 null（记忆 = Agent 资产，agentId+teamId 键、
//   projectId 可空作用域：清作用域指针留知识本体；sourceTodoId/sourceBuildId
//   溯源槽悬空 = deleteTodo 既有面同口径）→ project 行。
// - message/tokenUsage/document_diff 无 FK 孤儿行 = deleteTodo 既有面同口径
//   保留（清运面归后票 GC，不在本票扩面）。
// - 托管 bare repo 磁盘面随行清（removeHostedRepoDir，services/git.ts 与
//   provisionHostedRepo 对偶位）；库面先落、磁盘后清——rm 失败不吞（500
//   实情），force 幂等（目录缺位不阻断删除）。
// - 不发 SSE 文档事件：deleteTodo 同律无发布；web 复活票走 invalidateAll
//   客户端重取（#172 Notes 正典）。

import { eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { agentMemory, build, chief, project, schedule, step, tag, todo } from '../db/schema.js';
import { removeHostedRepoDir } from './git.js';

export interface ProjectDeps {
  db: Db;
  reposDir: string;
}

/** DELETE /api/projects/{id}（[推断] REST 同名 DELETE；危险操作区删除流 UI
 * 证据 r2 24c，wire 未采——登记 wire.test.ts INFERRED_ROUTES）。返回是否存在
 * 并删除。 */
export function deleteProject(deps: ProjectDeps, id: string): boolean {
  const { db } = deps;
  const row = db.select().from(project).where(eq(project.id, id)).get();
  if (!row) return false;
  const todoIds = db
    .select({ id: todo.id })
    .from(todo)
    .where(eq(todo.projectId, id))
    .all()
    .map((r) => r.id);
  const buildIds =
    todoIds.length > 0
      ? db
          .select({ id: build.id })
          .from(build)
          .where(inArray(build.todoId, todoIds))
          .all()
          .map((r) => r.id)
      : [];
  db.transaction((tx) => {
    if (buildIds.length > 0) tx.delete(step).where(inArray(step.buildId, buildIds)).run();
    tx.delete(schedule).where(eq(schedule.projectId, id)).run();
    tx.delete(tag).where(eq(tag.projectId, id)).run();
    if (todoIds.length > 0) tx.delete(todo).where(inArray(todo.id, todoIds)).run();
    // chief watch 摘除（全 chief 行扫——单用户 seed 现实下行数恒 ≤1）
    for (const chiefRow of tx.select().from(chief).where(eq(chief.teamId, row.teamId)).all()) {
      const next = chiefRow.watches.filter((w) => !todoIds.includes(w.todoId));
      if (next.length !== chiefRow.watches.length) {
        tx.update(chief).set({ watches: next }).where(eq(chief.id, chiefRow.id)).run();
      }
    }
    tx.update(agentMemory).set({ projectId: null }).where(eq(agentMemory.projectId, id)).run();
    tx.delete(project).where(eq(project.id, id)).run();
  });
  // 磁盘面在库面之后：库删成而 rm 败 = 孤儿目录（uniqueRepoName 不查，唯一害
  // 是同名复建拿到原名时 reinit 旧库——500 实情上抛，不吞）。
  if (row.repoKind === 'hosted' && row.repoName !== null) {
    removeHostedRepoDir(deps.reposDir, row.teamId, row.repoName);
  }
  return true;
}
