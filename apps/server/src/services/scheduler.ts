// Scheduler 缝实现（shared scheduler.ts 接口；02 §9.2 server 端 cron 宿主自持，
// 00/D3 不外包 pi）。触发闭环（r3 §9 + r5 §8 实测语义）：
// - 到期 → 新 build 全新重跑：triggerSource="schedule"、直执行（观测轮 32s 直达
//   审核关口、未在方案关口停驻 [推断]）、machineId → build.pinnedMachineId
//   （null=自动）；到确认/审核关口暂停 = 常规 build 流程（02 §9.2）。
// - 触发时停驻关口（confirm/review）的旧 build 标 errorMessage:"Cancelled"
//   + build 文档事件（r5 §8 实测；done 轮旧 build 已合并落地，不标 [推断]）。
// - `once` 触发后自动出队（r3 §9）；周期档滚动 nextRunAt（cron tz 感知）。
// - 进行中 phase（queued/planning/building）不抢占：本轮跳过、周期档仍滚动
//   [设计]（wire/UI 无抢占观测）。孤儿（todo 已删）自愈出队 [设计]。
// 时间线「由定时发起」= build.triggerSource 数据面（呈现归 web）。

import type { Scheduler } from '@pacman/shared';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { build, schedule, todo } from '../db/schema.js';
import { nowMs } from '../lib/ids.js';
import { type BuildDeps, startBuilds, toBuildRecord } from './builds.js';
import { fireDueChiefWakes } from './chief.js';
import type { TeamStreamHub } from './events.js';
import { PhaseTransitionError } from './phase.js';
import { computeNextRunAt, dueSchedules, isRecurring, updateNextRunAt } from './schedules.js';

export interface SchedulerOptions {
  /** 真实时间循环 tick 间隔（config schedulerTickMs）。 */
  tickMs: number;
}

/** 触发时旧 build 标 Cancelled 的关口集（r5 §8：停驻轮被新轮顶替）。 */
const CANCEL_GATE_PHASES = new Set(['confirm', 'review']);

export function createScheduler(deps: BuildDeps, opts: SchedulerOptions): Scheduler {
  let timer: NodeJS.Timeout | null = null;

  function cancelGateBuild(db: Db, hub: TeamStreamHub, todoId: string): void {
    const todoRow = db.select().from(todo).where(eq(todo.id, todoId)).get();
    if (!todoRow || !CANCEL_GATE_PHASES.has(todoRow.phase) || todoRow.latestBuildId === null) {
      return;
    }
    const buildId = todoRow.latestBuildId;
    db.update(build)
      .set({ errorMessage: 'Cancelled' }) // r5 §7.2 实测字面值
      .where(eq(build.id, buildId))
      .run();
    const row = db.select().from(build).where(eq(build.id, buildId)).get();
    if (row) hub.publishBuildDoc(todoRow.teamId, toBuildRecord(row));
  }

  function tick(now = nowMs()): void {
    const due = dueSchedules(deps, now);
    for (const row of due) {
      const todoRow = deps.db.select().from(todo).where(eq(todo.id, row.todoId)).get();
      if (!todoRow) {
        // 孤儿自愈：todo 已删 → 出队 [设计]。
        deps.db.delete(schedule).where(eq(schedule.id, row.id)).run();
        continue;
      }
      try {
        cancelGateBuild(deps.db, deps.hub, row.todoId);
        startBuilds(deps, {
          projectId: row.projectId,
          todoIds: [row.todoId],
          assignment: todoRow.assignment ?? { plan: null, build: null },
          withPlan: false,
          triggerSource: 'schedule',
          pinnedMachineId: row.machineId,
        });
      } catch (err) {
        if (err instanceof PhaseTransitionError) {
          // 进行中/搁置 phase：本轮不触发。周期档仍滚动（同一落点不重复尝试）；
          // once 保留 nextRunAt，todo 可重跑后的下一 tick 补触发 [设计]。
          if (isRecurring(row.kind) && row.at !== null) {
            updateNextRunAt(deps, row.id, computeNextRunAt(row.kind, row.at, row.tz, now));
          }
          continue;
        }
        throw err;
      }
      if (!isRecurring(row.kind)) {
        // once 触发后自动出队（r3 §9：GET /api/schedules?team= → []）。
        deps.db.delete(schedule).where(eq(schedule.id, row.id)).run();
      } else if (row.at !== null) {
        updateNextRunAt(deps, row.id, computeNextRunAt(row.kind, row.at, row.tz, now));
      }
    }
    // chief set_wake 到期触发（r5 §2 关注与提醒「约定到点回头核实」；BuildDeps
    // 与 ChiefDeps 同形，直接复用）。
    fireDueChiefWakes(deps, now);
  }

  return {
    tick,
    start() {
      if (timer !== null) return;
      tick(); // 启动即补扫（停机期间到期行下一 tick 语义，[设计]）
      timer = setInterval(() => tick(), opts.tickMs);
      timer.unref?.(); // 测试/短命令不吊住事件循环
    },
    stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
