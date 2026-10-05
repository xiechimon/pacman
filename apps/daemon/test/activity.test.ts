// 步活动相位 tracker（#905）：从既有 StepEvent 流派生「在做什么」上报。
// 失败方式枚举先于实现固化（AGENTS.md 测试规则 3）：
//   F1 假新鲜：静默期（无流事件）不得重发——重发只在 noteEvent 驱动下发生，
//      且距上次发送不足 repeatMs 不发。卡住的模型必须让 browser 端
//      now−at 持续增长（#471 律的反面：不伪造心跳）。
//   F2 洪水：同相位重复 setPhase（每个 thinking_delta 都调）不得逐次发送——
//      report 与上次已发相同即跳过；事件流的新鲜度由 F1 的节流重发承载。
//   F3 相位变化立即发：setPhase 到不同 report 即同步发送一次（不等节流窗）。
//   F4 并行工具：第二个 toolStarted 覆盖显示名（最近开始者）；乱序
//      toolEnded（先结束后开始的）不清相位——pending 集合空了才回
//      awaiting_model。
//   F5 toolEnded 清空后当前相位不是 tool（如 retrying）时不抢相位。
//   F6 sink 抛错（网络断 / 旧 server 400）不冒泡——tracker 继续工作，
//      后续相位变化照常尝试发送。
//   F7 重发携带的是当前 report（相位在两次重发之间变过则发新值，由 F3
//      路径先行；重发本身不改变 report 内容）。

import { STEP_ACTIVITY_PHASES, type StepActivityReport } from '@pacman/shared';
import { describe, expect, it } from 'vitest';
import { createActivityTracker } from '../src/activity.js';

function harness(opts: { repeatMs?: number } = {}) {
  const sent: { at: number; report: StepActivityReport }[] = [];
  let t = 1_000;
  const tracker = createActivityTracker({
    send: (report) => sent.push({ at: t, report }),
    now: () => t,
    ...(opts.repeatMs !== undefined ? { repeatMs: opts.repeatMs } : {}),
  });
  return {
    sent,
    tracker,
    advance(ms: number) {
      t += ms;
    },
  };
}

describe('activity tracker', () => {
  it('F3: phase change sends immediately with the new report', () => {
    const h = harness();
    h.tracker.setPhase('preparing');
    expect(h.sent).toEqual([{ at: 1_000, report: { phase: 'preparing' } }]);
    h.tracker.setPhase('starting');
    expect(h.sent.at(-1)?.report).toEqual({ phase: 'starting' });
  });

  it('F2: repeated same-phase sets do not re-send', () => {
    const h = harness();
    h.tracker.setPhase('thinking');
    h.tracker.setPhase('thinking');
    h.tracker.setPhase('thinking');
    expect(h.sent).toHaveLength(1);
  });

  it('F1: silent windows never re-send; flowing events re-send after repeatMs', () => {
    const h = harness({ repeatMs: 5_000 });
    h.tracker.setPhase('thinking');
    expect(h.sent).toHaveLength(1);
    // 静默 60s：无事件 → 零重发（卡住 = browser 端 now−at 增长，诚实）。
    h.tracker.noteEvent(); // 首个事件到达即相位设置那次之后的 liveness
    h.advance(60_000);
    expect(h.sent).toHaveLength(1); // noteEvent 在 t=1000，距上次发送 0ms < repeatMs
    // 事件持续流：每个事件 noteEvent，距上次发送 ≥ repeatMs 才重发。
    h.advance(5_000);
    h.tracker.noteEvent();
    expect(h.sent).toHaveLength(2);
    expect(h.sent.at(-1)?.report).toEqual({ phase: 'thinking' });
    // 紧跟着的事件不再发（节流窗内）。
    h.tracker.noteEvent();
    h.tracker.noteEvent();
    expect(h.sent).toHaveLength(2);
    // 下一个窗口再发一次。
    h.advance(5_000);
    h.tracker.noteEvent();
    expect(h.sent).toHaveLength(3);
  });

  it('F1: no events, no re-send even after many repeat windows', () => {
    const h = harness({ repeatMs: 1_000 });
    h.tracker.setPhase('tool', { tool: 'bash' });
    h.advance(30_000);
    expect(h.sent).toHaveLength(1);
  });

  it('F4: parallel tools — latest start shows; out-of-order ends keep phase until empty', () => {
    const h = harness();
    h.tracker.toolStarted('call-1', 'read');
    expect(h.sent.at(-1)?.report).toEqual({ phase: 'tool', tool: 'read' });
    h.tracker.toolStarted('call-2', 'bash');
    expect(h.sent.at(-1)?.report).toEqual({ phase: 'tool', tool: 'bash' });
    // 后开始的先结束：仍有 pending（call-1），相位留 tool，显示名回到剩余者。
    h.tracker.toolEnded('call-2');
    expect(h.sent.at(-1)?.report).toEqual({ phase: 'tool', tool: 'read' });
    // 全部结束 → awaiting_model。
    h.tracker.toolEnded('call-1');
    expect(h.sent.at(-1)?.report).toEqual({ phase: 'awaiting_model' });
    // 未知 id 的 toolEnded（异机回放等）不炸、不发。
    const before = h.sent.length;
    h.tracker.toolEnded('call-unknown');
    expect(h.sent).toHaveLength(before);
  });

  it('F5: tool end while compacting does not steal the phase', () => {
    const h = harness();
    h.tracker.toolStarted('call-1', 'bash');
    h.tracker.setPhase('compacting');
    h.tracker.toolEnded('call-1');
    expect(h.sent.at(-1)?.report).toEqual({ phase: 'compacting' });
  });

  it('F6: sink errors do not bubble; later changes still attempt sends', () => {
    const reports: StepActivityReport[] = [];
    let fail = true;
    const tracker = createActivityTracker({
      send: (report) => {
        if (fail) throw new Error('machine api 400');
        reports.push(report);
      },
      now: () => 1,
    });
    expect(() => tracker.setPhase('thinking')).not.toThrow();
    fail = false;
    tracker.setPhase('responding');
    expect(reports).toEqual([{ phase: 'responding' }]);
  });

  it('F7: re-send carries the current report after an unsent extra change', () => {
    const h = harness({ repeatMs: 5_000 });
    h.tracker.setPhase('thinking');
    h.tracker.setPhase('retrying', { attempt: 2 });
    expect(h.sent.at(-1)?.report).toEqual({ phase: 'retrying', attempt: 2 });
    h.advance(5_000);
    h.tracker.noteEvent();
    expect(h.sent.at(-1)?.report).toEqual({ phase: 'retrying', attempt: 2 });
  });

  it('phase vocabulary is closed: every phase is settable with its extras', () => {
    const h = harness();
    for (const phase of STEP_ACTIVITY_PHASES) {
      h.tracker.setPhase(phase);
    }
    expect(h.sent.map((s) => s.report.phase)).toEqual([
      // preparing 起手全相位轮转：同相位不重发（F2），相邻异相位各发一次。
      ...STEP_ACTIVITY_PHASES,
    ]);
  });
});
