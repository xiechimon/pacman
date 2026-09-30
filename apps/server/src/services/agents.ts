// Agent 删除面（XMON-19 / B2）：DELETE /api/teams/{id}/agents/{aid}。
// 路由 = REST 同名 DELETE（02 §6.1 规则族 + shared DELETE_FACE
// 'teams/{id}/agents/{aid}'），wire 未采——登记 wire.test.ts INFERRED_ROUTES。
//
// canon 出处（本票实测，非转述）：2026-10-01 在登录态的原版上走了全流程（入口
// → 确认层 → 取消 → 删除 → 落点 `/app/team`）；参考产品产线 bundle 的 i18n 四语
// 语料（agent_modal.remove / remove_title / remove_confirm / remove_over_quota）
// 与通用 ConfirmProvider 行为是第二源，两源一致；删除语义直读 todos.dev 官方
// docs——/docs/agents「Removing an agent」、/docs/memory「A removed agent's
// entries stay stored but stop being used, since it no longer runs tasks」、
// /docs/team「Removing an agent is done from the same tab」。
//
// 关联面取舍（三件，写死在这里，别处不再复述）：
//
// 1. **memories 不级联**。docs 原文「Its memory is kept but no longer used」把
//    保留写成了明语义；仓内 project 删除同口径（agentMemory 属 Agent 资产，
//    只清作用域指针留本体）。代价如实记：记忆行以 agentId 悬空留存，
//    agent_memory.agentId 是 notNull 列、没有「已删 Agent」的键位可迁移，故
//    这些行在本仓成为不可达知识（Agent 页随行 404）。选保留不选清库 = 破坏性
//    操作里选数据可回滚的一侧；真要回收，是后票的 GC 面，不在删除路径上顺手删。
//
// 2. **todo.assignment 摘槽**（与 1 相反的一侧，理由不同：这里摘的不是历史，是
//    活引用）。assignment 槽决定下次运行谁来执行；指向已删 Agent 的槽会让
//    resolveStepCredentials 走 agentRow=null 分支，静默给出 provider/secrets
//    双空（services/credentials.ts）——用户看到的是「跑了但模型没配上」，查不出
//    原因。摘空回既有「未指派」态（startBuilds 的 {plan:null,build:null} 同形），
//    与原版提示「请为该 todo 指派其他 Agent 后重新运行」同向。任务本体、相位、
//    运行历史一律不动。
//
// 3. **chief.agentId 摘绑定**。chief 步的凭证解析按 chief.agentId 取 Agent 行，
//    取不到直接 notFound（services/credentials.ts resolveChiefStepCredentials）
//    ——悬空绑定 = 该团队所有 chief 回合硬 404。chief.agentId 本就可空
//    （schema 注释「未绑定 null」），置 null 落回产品既有的「尚未选择 Agent」
//    态，不新造状态。
//
// 未做（明确非本票范围，别当漏项）：原版二次确认正文许诺的「该 Agent 进行中的
// 任务将被停止」在这里没有对应实现——本仓停止面是 POST /api/builds/{id}/stop
// （按 buildId 逐条停），DELETE 端点上没有 buildId 上下文，逐 todo 反查在建
// build 并停步是另一条面（且原版该许诺的任务侧可见性——「该任务的 Agent 已被
// 移除」提示——本仓尚无承载位）。开票时按面另议。

import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { agent, chief, todo } from '../db/schema.js';

export interface AgentDeps {
  db: Db;
}

/** DELETE /api/teams/{id}/agents/{aid}：存在且属该团队则删，返回是否删成。
 * 404 由调用方按返回值抛出（未知 id / 跨团队 / 复删三态同结果，DELETE_FACE
 * 族律：memories/projects 同口径）。 */
export function deleteAgent(deps: AgentDeps, teamId: string, agentId: string): boolean {
  const { db } = deps;
  const row = db
    .select()
    .from(agent)
    .where(and(eq(agent.id, agentId), eq(agent.teamId, teamId)))
    .get();
  if (!row) return false;
  db.transaction((tx) => {
    for (const todoRow of tx.select().from(todo).where(eq(todo.teamId, teamId)).all()) {
      const assignment = todoRow.assignment;
      if (assignment === null) continue;
      const plan = assignment.plan?.agentId === agentId ? null : assignment.plan;
      const build = assignment.build?.agentId === agentId ? null : assignment.build;
      if (plan === assignment.plan && build === assignment.build) continue;
      tx.update(todo).set({ assignment: { plan, build } }).where(eq(todo.id, todoRow.id)).run();
    }
    for (const chiefRow of tx.select().from(chief).where(eq(chief.teamId, teamId)).all()) {
      if (chiefRow.agentId !== agentId) continue;
      tx.update(chief).set({ agentId: null }).where(eq(chief.id, chiefRow.id)).run();
    }
    tx.delete(agent).where(eq(agent.id, agentId)).run();
  });
  return true;
}
