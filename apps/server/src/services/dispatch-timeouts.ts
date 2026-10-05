// 派发超时策略（#864 T3）：钉选机器离线的宽限与文案。
//
// 为什么单列一个叶子模块：这条策略同时管 worker 步（builds.ts 的
// sweepAbandonedBuildSteps）与 chief 回合（chief.ts 的 failAbandonedChiefSteps），
// 而 chief.ts → builds.ts 之间隔着 todos.ts → chief.ts 的既有环，值 import 会把
// 环拉直成真环。零依赖的叶子让「一个策略一个数」在代码层可见。
//
// 策略本身（#864 裁决，见票面三问）：
// - 等多久：钉选机器离线的 pending 步等 PIN_OFFLINE_GRACE_MS。比无人认领的
//   120 秒（BUILD_ABANDONED_STEP_MS / CHIEF_ABANDONED_STEP_MS）长得多——那一档
//   是环境错配（团队根本没机器能跑），这一档常是「我指定的那台暂时不在」
//   （笔记本合盖、daemon 重启、SSE 断连抖动），短窗口会杀掉合法的等待。
// - 谁通知：不新增通知通道，走既有失败漏斗——worker 步 = 步事件 + build.
//   errorMessage + todo → failed（看板失败卡 + 详情 banner）；chief 回合 =
//   chief_turn_error 行 + 会话流 message 事件（web toast，#631 链）。
// - 能否转自动：不自动改派。pin 的语义是确定性（t-0047 调研、#682 落地），
//   静默换机会让「钉 A 机」变成不确定；超时的产物是可见的失败加显式出口，
//   不是另一台机器上的静默重跑。
//
// 判据口径：pending + 钉选机不在线（行缺失 = 已移除，同离线语义）+ 步的最后
// 活动时刻（心跳 → 领取 → 入队）已过宽限。锚在「最后活动」而非入队时刻，是为
// T1 释放（#862）留窗口：长跑步被释放回 pending 后，机器回来的机会从失联时刻
// 起算，而不是从入队时刻倒扣。

export const PIN_OFFLINE_GRACE_MS = 10 * 60_000;

/** 步的最后活动时刻：心跳 → 领取 → 入队（T1 释放保留 claimedAt/lastHeartbeatAt
 *  作死亡时刻审计，故释放后的 pending 步锚在失联时刻）。 */
export function stepActivityAt(row: {
  lastHeartbeatAt: number | null;
  claimedAt: number | null;
  createdAt: number;
}): number {
  return row.lastHeartbeatAt ?? row.claimedAt ?? row.createdAt;
}

/** 钉选机器离线超时的失败文案（worker/chief 两族共用主语与数字，尾注按族给）。
 *  machineName = null 表示钉的机器行已不在（被删/被换团队），不吐裸 id。 */
export function pinOfflineReason(machineName: string | null, hint: string): string {
  const label = machineName ?? '（已移除）';
  return `本轮无人认领：钉选的机器「${label}」离线超过 ${PIN_OFFLINE_GRACE_MS / 60_000} 分钟。${hint}`;
}

/** worker 步的尾注：出口 = 让机器上线，或显式改钉（不自动改派）。 */
export const WORKER_PIN_OFFLINE_HINT =
  '请让它上线后重跑，或把任务的机器改为其它在线机器（重跑沿用任务的钉选）。';

/** chief 回合的尾注：回合同律，动作面是「重发」。 */
export const CHIEF_PIN_OFFLINE_HINT = '请让它上线后重发，或把任务的机器改为其它在线机器。';
