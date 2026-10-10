// #1136 机器行陈旧判定：sweepStaleMachines——presence 落 lastSeenAt + 阈值
// 扫掠翻 offline。daemon 静默死机（断电/网络分区，无 FIN）时 SSE abort 是唯一
// online 翻转源（routes-machine.ts onAbort），机器行恒 online → 钉选宽限/
// 释放/扫尾整套「有界等待」家族（#862/#864/#881）以 machine.online 为前提，
// 全部失真。本 sweep 补第二真值源：lastSeenAt 超 MACHINE_STALE_OFFLINE_MS
// 未更新的在线机器 → markOffline（与 SSE abort 同一漏斗，事件面一致）。
//
// 失败方式枚举（先于实现固化；每个 test 对应一条）：
// - 误杀：健康机器（presence 30s 节拍内）被翻 offline——亲和闸会放行换机
//   （丢会话），误杀比漏杀贵。阈值 150s 盖 30s presence + 15s tick + 抖动。
// - 漏杀：静默死机机器永不被翻——lastSeenAt 判据 + scheduler tick 接线。
// - 升级路径：存量行 online=true 且 lastSeenAt=NULL（升级前从未走过新
//   markPresence）被当场误杀——NULL = 无数据不判（下一拍 presence ≤30s 补齐）。
// - 越界判定：恰好等于阈值不翻（严格大于），过阈翻。
// - 越权动步：sweep 只翻 online 不动步（步的释放已有自己的判据，
//   sweepAbandonedBuildSteps）——机器扫单独跑，步行原样。
// - presence 回写：markPresence 落 lastSeenAt + 离线机器翻回在线 + 事件
//   （闪断恢复窗口 = 阈值本身：健康 presence 永不过阈，翻回走既有
//   becameOnline 路径，不新增事件形态）。
// - 幂等：第二轮 sweep 对已离线机器不重复发事件。
// - tick 接线 + 家族收口：一次 scheduler tick 同时完成「机器翻 offline」与
//   「失联 claimed 步释放回 pending」（#861 步永久 claimed 的最后残余入口）。

import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, test } from 'vitest';
import {
  build as buildTable,
  machine as machineTable,
  project as projectTable,
  step as stepTable,
  todo as todoTable,
} from '../src/db/schema.js';
import {
  MACHINE_STALE_OFFLINE_MS,
  type MachineDeps,
  markPresence,
  sweepStaleMachines,
} from '../src/services/machines.js';
import { createScheduler } from '../src/services/scheduler.js';
import { bootServer, type TestServer } from './helpers.js';

const disposables: (() => void)[] = [];
afterAll(() => {
  for (const d of disposables) d();
});

interface StaleWorld {
  s: TestServer;
  teamId: string;
  machineId: string;
  /** 只在需要步行的形态下非空（todo/build/step id 三件套）。 */
  todoId: string;
  buildId: string;
  stepId: string;
  base: number;
}

/** 直插 world：一台机器 +（可选）一条 building todo 上的 claimed build 步。
 * machineOnline/lastSeenAtAgo 组合出被测形态；步心跳缺省锚 claim 时刻后
 * 150s（progressed=true 且已超 120s 判据——#861 残余入口的形态：跑过、有
 * 心跳、然后静默死机；机器恒 online 时 builds 释放两分支都不命中）。 */
function makeWorld(opts: {
  machineOnline: boolean;
  /** 秒龄落 lastSeenAt；null = 列保持 NULL（升级前存量行形态）。 */
  lastSeenAtAgo: number | null;
  withClaimedStep?: boolean;
  /** 步入队至今的毫秒龄（claimed 时刻锚）。 */
  stepAgeMs?: number;
  /** 心跳距今毫秒龄（须 > claim 龄才 progressed=false；缺省 = 龄 - 150s）。 */
  heartbeatAgoMs?: number;
}): StaleWorld {
  const s = bootServer();
  disposables.push(() => s.dispose());
  const base = Date.now();
  const teamId = s.team.id;
  const machineId = `machine-${Math.random().toString(36).slice(2)}`;
  const todoId = `todo-${Math.random().toString(36).slice(2)}`;
  const buildId = `build-${Math.random().toString(36).slice(2)}`;
  const stepId = `step-${Math.random().toString(36).slice(2)}`;
  s.db
    .insert(machineTable)
    .values({
      id: machineId,
      teamId,
      name: 'stale-box',
      online: opts.machineOnline,
      ...(opts.lastSeenAtAgo === null ? {} : { lastSeenAt: base - opts.lastSeenAtAgo }),
    })
    .run();
  if (opts.withClaimedStep === true) {
    const age = opts.stepAgeMs ?? 300_000;
    const beatAgo = opts.heartbeatAgoMs ?? age - 150_000;
    s.db.insert(projectTable).values({ id: 'proj-stale', name: 'stale', teamId }).run();
    s.db
      .insert(todoTable)
      .values({
        id: todoId,
        teamId,
        projectId: 'proj-stale',
        title: 'stale target',
        phase: 'building',
        phaseAt: base - age,
        seqNum: 1,
      })
      .run();
    s.db
      .insert(buildTable)
      .values({
        id: buildId,
        todoId,
        withPlan: false,
        triggerSource: 'user',
        createdAt: base - age,
      })
      .run();
    s.db
      .insert(stepTable)
      .values({
        id: stepId,
        buildId,
        kind: 'build',
        status: 'claimed',
        machineId,
        createdAt: base - age,
        claimedAt: base - age,
        lastHeartbeatAt: base - beatAgo,
      })
      .run();
  }
  return { s, teamId, machineId, todoId, buildId, stepId, base };
}

function machineRowOf(w: StaleWorld) {
  return w.s.db.select().from(machineTable).where(eq(machineTable.id, w.machineId)).get()!;
}

function stepRowOf(w: StaleWorld) {
  return w.s.db.select().from(stepTable).where(eq(stepTable.id, w.stepId)).get()!;
}

/** team stream machine_presence 事件捕获桩（钉 web SSE 契约同
 * build-abandoned-sweep 的 conv tap 形）。 */
function tapTeamStream(s: TestServer, teamId: string): { events: object[] } {
  const events: object[] = [];
  s.hub.subscribe(teamId, {
    nextSeq: () => 1,
    send: (payload: object) => {
      events.push(payload);
      return Promise.resolve();
    },
  });
  return { events };
}

function machineDepsOf(w: StaleWorld): MachineDeps {
  return {
    ...w.s.svc,
    box: w.s.secretBox,
    reposDir: w.s.reposDir,
    attachmentsDir: w.s.attachmentsDir,
  };
}

describe('sweepStaleMachines（#1136 机器行陈旧判定）', () => {
  test('阈值钉 150s：盖 30s presence + 15s tick + 抖动（误杀比漏杀贵，Multica 150s 同款推导）', () => {
    expect(MACHINE_STALE_OFFLINE_MS).toBe(150_000);
  });

  test('健康机器（lastSeenAt 在节拍内）不翻——误杀会放行亲和换机丢会话', () => {
    const w = makeWorld({ machineOnline: true, lastSeenAtAgo: 35_000 });
    const { events } = tapTeamStream(w.s, w.teamId);

    sweepStaleMachines(w.s.svc, w.base);

    expect(machineRowOf(w).online).toBe(true);
    expect(events).toHaveLength(0);
  });

  test('过阈在线机器翻 offline + team stream machine_presence 事件（与 SSE abort 同漏斗）', () => {
    const w = makeWorld({ machineOnline: true, lastSeenAtAgo: MACHINE_STALE_OFFLINE_MS + 1_000 });
    const { events } = tapTeamStream(w.s, w.teamId);

    sweepStaleMachines(w.s.svc, w.base);

    expect(machineRowOf(w).online).toBe(false);
    expect(events).toEqual([{ type: 'machine_presence', machineId: w.machineId, online: false }]);
  });

  test('恰好等于阈值不翻（严格大于，节拍边缘机器不吃刀）', () => {
    const w = makeWorld({ machineOnline: true, lastSeenAtAgo: MACHINE_STALE_OFFLINE_MS });

    sweepStaleMachines(w.s.svc, w.base);

    expect(machineRowOf(w).online).toBe(true);
  });

  test('离线机器不动（只翻 online→offline 单向；幂等 = 第二轮不重复发事件）', () => {
    const w = makeWorld({ machineOnline: false, lastSeenAtAgo: MACHINE_STALE_OFFLINE_MS + 1_000 });
    const { events } = tapTeamStream(w.s, w.teamId);

    sweepStaleMachines(w.s.svc, w.base);
    sweepStaleMachines(w.s.svc, w.base + 60_000);

    expect(machineRowOf(w).online).toBe(false);
    expect(events).toHaveLength(0);
  });

  test('升级路径：online=true 且 lastSeenAt=NULL（存量行）不翻——无数据不判，下一拍 presence 补齐', () => {
    const w = makeWorld({ machineOnline: true, lastSeenAtAgo: null });

    sweepStaleMachines(w.s.svc, w.base + 3600_000);

    expect(machineRowOf(w).online).toBe(true);
  });

  test('只翻 online 不动步：机器扫单独跑，claimed 步行原样（步的释放归 sweepAbandonedBuildSteps 自己的判据）', () => {
    const w = makeWorld({
      machineOnline: true,
      lastSeenAtAgo: MACHINE_STALE_OFFLINE_MS + 1_000,
      withClaimedStep: true,
      stepAgeMs: 300_000,
    });

    sweepStaleMachines(w.s.svc, w.base);

    expect(machineRowOf(w).online).toBe(false);
    const stepRow = stepRowOf(w);
    expect(stepRow.status).toBe('claimed');
    expect(stepRow.machineId).toBe(w.machineId);
  });

  test('presence 回写：markPresence 落 lastSeenAt + 离线机器翻回在线 + 事件（闪断恢复走既有 becameOnline 路径）', () => {
    const w = makeWorld({ machineOnline: false, lastSeenAtAgo: 600_000 });
    const { events } = tapTeamStream(w.s, w.teamId);

    markPresence(machineDepsOf(w), w.machineId, {});
    expect(machineRowOf(w).online).toBe(true);
    expect(machineRowOf(w).lastSeenAt).toBeGreaterThanOrEqual(w.base);

    // 翻回在线后，同一时刻的 sweep 不再翻它（lastSeenAt 已刷新）。
    sweepStaleMachines(w.s.svc, Date.now());
    expect(machineRowOf(w).online).toBe(true);
    expect(events).toEqual([{ type: 'machine_presence', machineId: w.machineId, online: true }]);
  });
});

describe('scheduler tick 接线（#861 步永久 claimed 的最后残余入口收口）', () => {
  test('一次 tick：僵尸机器（online + lastSeenAt 过阈 + 心跳曾推进）翻 offline，同 tick 失联 claimed 步释放回 pending', () => {
    const w = makeWorld({
      machineOnline: true,
      lastSeenAtAgo: MACHINE_STALE_OFFLINE_MS + 1_000,
      withClaimedStep: true,
      stepAgeMs: 300_000, // 心跳 150s 前（progressed 且超 120s 判据）
    });
    const scheduler = createScheduler(w.s.svc, { tickMs: 60_000 });

    scheduler.tick(w.base);

    expect(machineRowOf(w).online).toBe(false);
    expect(stepRowOf(w).status).toBe('pending');
    expect(stepRowOf(w).machineId).toBeNull();
    scheduler.stop();
  });

  test('机器在线 + 心跳曾推进（改动前的永久 claimed 形态）：步不释放——机器扫不误翻在线机器', () => {
    // #861 残余入口的精确形态：心跳 progressed（150s 前还在跳）+ 机器
    // lastSeenAt 在节拍内（健康）——builds 释放两分支（离线 / 心跳从未推进）
    // 都不命中，步留 claimed 等它真回来。本改动只翻真死的机器，不碰这个。
    const w = makeWorld({
      machineOnline: true,
      lastSeenAtAgo: 30_000,
      withClaimedStep: true,
      stepAgeMs: 300_000,
    });
    const scheduler = createScheduler(w.s.svc, { tickMs: 60_000 });

    scheduler.tick(w.base);

    expect(machineRowOf(w).online).toBe(true);
    expect(stepRowOf(w).status).toBe('claimed');
    scheduler.stop();
  });
});
