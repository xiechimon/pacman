// phase 九值流转（02 §4.1 权威 + §4.2 主时序/确认回路/失败重跑；验收 =
// 「phase 九值流转按 02 §4.1（含 6 列折叠映射）」）。
// 看板 6 列折叠映射单源在 shared boardColumnFor（phase × hasChanges 双键，
// r5 §8）——server 不重复实现，仅消费与测试对拍。
// 边集出处：start→queued（02 §4.2 POST builds 入队）、claim→planning/building
// （机器领规划步/直执行步）、planning→confirm（plan 卡就绪）、confirm→building
// （确认 {action:"confirm"}）、confirm→planning（驳回 {action:"revision"} 重规划，
// r5 §4）、building→review、review→done（合并落地）、failed→queued（重跑，r3
// §3.7 新 conv/新 build）、{confirm,review,done}→queued（定时重跑：02 §9.2
// 触发→新 build 全新重跑；r3 §9 done 复跑实测「看板 #1 从已完成回到执行中→
// 待验收」、r5 §8 停驻轮旧 build Cancelled + 新轮）、*→closed（右键 Close，
// r1 §443）、closed→todo（reopen，MCP reopen_todos r5 §3.1）。未直接观测的边
// 标 [推断]（04 §3 不判负）。

import type { Phase } from '@pacman/shared';

export const PHASE_TRANSITIONS: Readonly<Record<Phase, readonly Phase[]>> = {
  todo: ['queued', 'closed'],
  // 机器 claim：规划步→planning / 直执行步（withPlan=false）→building（02 §4.2）。
  queued: ['planning', 'building', 'failed'],
  planning: ['confirm', 'failed'],
  // 确认→building；驳回→重规划（02 §4.2 确认回路，r5 §4 实走）；定时轮顶替→queued（r5 §8）。
  confirm: ['building', 'planning', 'failed', 'queued'],
  building: ['review', 'failed'],
  // 完成+合并落地→done（02 §4.2：merge 202 delegated → 机器合并步 → done）；
  // 定时轮顶替→queued（r5 §8）。
  review: ['done', 'failed', 'queued'],
  // 定时重跑→queued（r3 §9 实测：done todo 到点全新重跑回到执行中→待验收）；
  // 其余出边（reopen 类）未观测 [推断]。
  done: ['queued'],
  // 重跑 = POST builds 新 conv/新分支/新 build（r3 §3.7）；或搁置。
  failed: ['queued', 'closed'],
  closed: ['todo'], // reopen [推断]（MCP reopen_todos 词表证据，wire 未采）
};

export function canTransitionPhase(from: Phase, to: Phase): boolean {
  return PHASE_TRANSITIONS[from].includes(to);
}

/** 非法流转 = 409 语义（错误形状 {error}，r5 §1 实测族）。 */
export class PhaseTransitionError extends Error {
  constructor(
    readonly from: Phase,
    readonly to: Phase,
  ) {
    super(`illegal phase transition: ${from} -> ${to}`);
    this.name = 'PhaseTransitionError';
  }
}

export function assertPhaseTransition(from: Phase, to: Phase): void {
  if (!canTransitionPhase(from, to)) throw new PhaseTransitionError(from, to);
}
