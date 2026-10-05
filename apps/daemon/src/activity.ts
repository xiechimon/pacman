// 步活动相位 tracker（#905）：从 runner 已有的 StepEvent 消费点派生「在做
// 什么」，经 machineToolBodySchema 第四形上报（server 盖 stepId/at 后瞬态进
// 会话流）。失败方式枚举与判定见 test/activity.test.ts 头注（F1–F7）；两条
// 设计律：
//   - **无定时器**：重发只由 noteEvent（真实流事件到达）驱动——静默期零上报，
//     browser 端 now−at 增长即「卡住」的诚实呈现（#471）。没有 interval 就没有
//     跨步泄漏面（runStep 提前 return 路径多，timer 清理点钉不全是历史教训）。
//   - **fire-and-forget**：sink 抛错（旧 server 对第四形 400 / 网络断）被吞，
//     活动是呈现信号不是数据面——终稿 transcript 与步状态另有正本。

import type { StepActivityPhase, StepActivityReport } from '@pacman/shared';

/** 事件 flowing 期的重发节流窗：browser 端「最近信号 Ns 前」的新鲜度上限
 *  ≈ repeatMs + 事件间隔。5s = 「在动」肉眼可辨、量级远低于 30s heartbeat。 */
export const ACTIVITY_REPEAT_MS = 5_000;

export interface ActivityTrackerDeps {
  /** 上报出口（runner 接 client.activity 的 fire-and-forget 包装）。 */
  send: (report: StepActivityReport) => void;
  now?: () => number;
  repeatMs?: number;
}

export interface ActivityTracker {
  /** 相位变更：report 与上次已发不同即同步发送（F3）；相同即跳过（F2）。 */
  setPhase: (phase: StepActivityPhase, extra?: { tool?: string; attempt?: number }) => void;
  /** 任何流事件到达（runner 事件循环顶部，与看门狗重置同点）：驱动节流
   *  重发（F1）——只有真事件能把「最近信号」推新。 */
  noteEvent: () => void;
  /** 调用块流完（toolcall_end 无 result）：工具开始执行。并行时显示名 =
   *  最近开始者（F4）。 */
  toolStarted: (id: string, name: string) => void;
  /** 工具终态（toolcall_end 带 result）：pending 空且当前相位是 tool 才回
   *  awaiting_model（F4/F5）；未知 id 静默（异机回放等）。 */
  toolEnded: (id: string) => void;
}

export function createActivityTracker(deps: ActivityTrackerDeps): ActivityTracker {
  const now = deps.now ?? (() => Date.now());
  const repeatMs = deps.repeatMs ?? ACTIVITY_REPEAT_MS;
  /** pending 工具：插入序 Map（末位 = 最近开始者；F4 的显示名来源）。 */
  const pendingTools = new Map<string, string>();
  let current: StepActivityReport | null = null;
  let lastSent: StepActivityReport | null = null;
  let lastSentAt = Number.NEGATIVE_INFINITY;
  let lastEventAt = 0;
  let lastSentEventAt = 0;

  function emit(report: StepActivityReport): void {
    current = report;
    if (sameReport(report, lastSent)) return;
    lastSent = report;
    lastSentAt = now();
    lastSentEventAt = lastEventAt;
    try {
      deps.send(report);
    } catch {
      // F6：出口故障不打断步——下一个相位变化再试。
    }
  }

  return {
    setPhase(phase, extra) {
      emit({
        phase,
        ...(extra?.tool !== undefined ? { tool: extra.tool } : {}),
        ...(extra?.attempt !== undefined ? { attempt: extra.attempt } : {}),
      });
    },
    noteEvent() {
      lastEventAt = now();
      if (current === null) return;
      // F1 双臂：必须有比上次发送更新的事件，且距上次发送满节流窗。
      if (lastEventAt <= lastSentEventAt) return;
      if (lastEventAt - lastSentAt < repeatMs) return;
      lastSentAt = lastEventAt;
      lastSentEventAt = lastEventAt;
      try {
        deps.send(current);
      } catch {
        // F6 同律。
      }
    },
    toolStarted(id, name) {
      pendingTools.set(id, name);
      this.setPhase('tool', { tool: name });
    },
    toolEnded(id) {
      if (!pendingTools.delete(id)) return;
      if (pendingTools.size > 0) {
        const latest = [...pendingTools.values()].at(-1) ?? '';
        this.setPhase('tool', { tool: latest });
        return;
      }
      if (current?.phase === 'tool') this.setPhase('awaiting_model');
    },
  };
}

function sameReport(a: StepActivityReport | null, b: StepActivityReport | null): boolean {
  if (a === null || b === null) return a === b;
  return a.phase === b.phase && a.tool === b.tool && a.attempt === b.attempt;
}
