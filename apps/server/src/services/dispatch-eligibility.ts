// 认领资格判定原语（#881 单源）：步的 Agent 解析 + runtime 闸判。
//
// 为什么单列叶子：tryClaim（machines.ts，claim 面）与失联扫尾（builds.ts /
// chief.ts 的 sweep 面）要用**同一份判据**回答「这台机器开没开这条步的
// runtime」。#864 把「钉选机在线但 runtime 闸挡」登记为已知缝，原因正是
// 判定藏在 machines.ts 里、sweep 侧值 import 会成环（machines → builds/
// chief 是既有正向边）。下沉到本叶子（只依赖 db schema 与 shared，不 import
// 任何 service），claim 面与 sweep 面共用一份事实——两处判定一旦漂移，后果
// 是 sweep 误杀 claim 能领的步，或放过 claim 永远领不了的步（后者即无期
// pending 的缝本身）。

import { isBackendRuntimeId, parseReviewPromptMeta, type StepKind } from '@pacman/shared';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { agent, type todo } from '../db/schema.js';

/** #682 enabledRuntimes 真闸——步的 runtime 判定（与 daemon runner 的
 *  backendFor 同律：agent provider ∈ BACKEND_RUNTIME_IDS → claude-code，
 *  其余（含 BYOK 自定义 provider）→ pi）。判定单源在此；claim 侧与 sweep
 *  侧（#881 钉选在线被挡判据）共同消费，机器侧开关 = machine.enabledRuntimes
 *  （PATCH 热写，秒级生效）。 */
export function stepRuntimeFor(agentProvider: string | null | undefined): 'pi' | 'claude-code' {
  return isBackendRuntimeId(agentProvider) ? 'claude-code' : 'pi';
}

/** 机器未开步所需的 runtime = 不可领该步（步留 pending 给能跑的机器——
 *  spec 11 A8「我可以决定本机跑 pi 还是 Claude Code 任务」的兑现位）。 */
export function runtimeGatePasses(
  machineRow: { enabledRuntimes: string[] },
  agentProvider: string | null | undefined,
): boolean {
  return machineRow.enabledRuntimes.includes(stepRuntimeFor(agentProvider));
}

/** 步的 Agent 解析（claim 载荷组装与 #881 sweep 判据共用）：
 *  - review 步：agentId 在 prompt meta header 里（M7 #330，step 表无 agentId
 *    列；测试已钉此口径，apps/server/test/review.test.ts）；
 *  - 其它步类：assignment 双槽按步类取（02 §4.2/r5 §5）——规划步 → plan 槽；
 *    执行/合并步 → build 槽（合并轮复用执行轮会话，同 Agent）。
 *  无 Agent（槽空 / 槽指向已删 Agent / review meta 无 agentId）= null：claim
 *  面按失败收尾该步（#1104 B：applyStepFailure 落 build.errorMessage + todo
 *  → failed 终态，不再静默跳过候选）；sweep 面无从计算 runtime（不进闸挡判）。 */
export function agentForStep(
  db: Db,
  todoRow: typeof todo.$inferSelect,
  kind: StepKind,
  /** review 步的 prompt（meta header 解析用）。 */
  prompt: string | null = null,
): typeof agent.$inferSelect | null {
  // review 步：agentId 经 prompt meta header 透出（r8 §3.1：模态选 Agent
  // 入队，不走 assignment 槽——执行/规划 Agent 不一定适合审核）。
  if (kind === 'review') {
    const meta = parseReviewPromptMeta(prompt);
    const agentId = meta?.agentId ?? null;
    if (!agentId) return null;
    return db.select().from(agent).where(eq(agent.id, agentId)).get() ?? null;
  }
  const slot = kind === 'plan' ? todoRow.assignment?.plan : todoRow.assignment?.build;
  const agentId = slot?.agentId ?? null;
  if (!agentId) return null;
  return db.select().from(agent).where(eq(agent.id, agentId)).get() ?? null;
}
