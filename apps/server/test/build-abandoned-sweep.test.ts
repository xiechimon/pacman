// #706 build 步失联扫尾（failAbandonedBuildSteps）：判定（超龄 × 在线态 ×
// 步状态 × 步 kind）+ 落账面（step failed + build.errorMessage + todo →
// failed）+ 事件面（build 文档 + 会话流 step 事件，与机器报失败同形，不另起
// 通知面）。机器在线位直写 DB（生产置位路径 wake SSE 断连面归 machine-wire 测试）。

import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, test } from 'vitest';
import {
  build as buildTable,
  machine as machineTable,
  project as projectTable,
  step as stepTable,
  todo as todoTable,
} from '../src/db/schema.js';
import { BUILD_ABANDONED_STEP_MS, failAbandonedBuildSteps } from '../src/services/builds.js';
import { createScheduler } from '../src/services/scheduler.js';
import { bootServer, type TestServer } from './helpers.js';

const disposables: (() => void)[] = [];
afterAll(() => {
  for (const d of disposables) d();
});

interface BuildWorld {
  s: TestServer;
  todoId: string;
  buildId: string;
  stepId: string;
  machineId: string;
  base: number;
}

/** 直插 world：project + building 相 todo + build + build 步 + 一台机器。 */
function makeWorld(step: {
  status: 'pending' | 'claimed';
  kind?: 'plan' | 'build' | 'merge' | 'review' | 'chief';
  createdAgo: number;
  heartbeatAgo?: number | null;
  machineOnline?: boolean;
}): BuildWorld {
  const s = bootServer();
  disposables.push(() => s.dispose());
  const base = Date.now();
  const teamId = s.team.id;
  const todoId = `todo-${Math.random().toString(36).slice(2)}`;
  const buildId = `build-${Math.random().toString(36).slice(2)}`;
  const stepId = `step-${Math.random().toString(36).slice(2)}`;
  const machineId = `machine-${Math.random().toString(36).slice(2)}`;
  s.db.insert(projectTable).values({ id: 'proj-sweep', name: 'sweep', teamId }).run();
  s.db
    .insert(todoTable)
    .values({
      id: todoId,
      teamId,
      projectId: 'proj-sweep',
      title: 'sweep target',
      phase: 'building',
      phaseAt: base - step.createdAgo,
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
      createdAt: base - step.createdAgo,
    })
    .run();
  s.db
    .insert(machineTable)
    .values({ id: machineId, teamId, name: 'sweep-box', online: step.machineOnline ?? false })
    .run();
  const createdAt = base - step.createdAgo;
  const claimedAt = step.status === 'claimed' ? createdAt : null;
  // 缺省心跳 = claim 置位值（生产 claim 面同形）；B-C7 形态即此值 + 机器在线。
  const heartbeat =
    step.heartbeatAgo === undefined
      ? claimedAt
      : step.heartbeatAgo === null
        ? null
        : base - step.heartbeatAgo;
  s.db
    .insert(stepTable)
    .values({
      id: stepId,
      buildId,
      kind: step.kind ?? 'build',
      status: step.status,
      machineId: step.status === 'claimed' ? machineId : null,
      createdAt,
      claimedAt,
      lastHeartbeatAt: step.status === 'claimed' ? heartbeat : null,
    })
    .run();
  return { s, todoId, buildId, stepId, machineId, base };
}

function stepRowOf(w: BuildWorld) {
  return w.s.db.select().from(stepTable).where(eq(stepTable.id, w.stepId)).get()!;
}

function todoRowOf(w: BuildWorld) {
  return w.s.db.select().from(todoTable).where(eq(todoTable.id, w.todoId)).get()!;
}

function buildRowOf(w: BuildWorld) {
  return w.s.db.select().from(buildTable).where(eq(buildTable.id, w.buildId)).get()!;
}

/** 会话流 step 事件捕获桩（钉 web SSE 契约：step 事件携带终态行）。 */
function tapConvStream(s: TestServer, conversationId: string): { events: object[] } {
  const events: object[] = [];
  s.convHub.subscribe(conversationId, {
    nextSeq: () => 1,
    send: (payload: object) => {
      events.push(payload);
      return Promise.resolve();
    },
  });
  return { events };
}

describe('#706 build 步失联扫尾（failAbandonedBuildSteps）', () => {
  test('claimed 心跳停更超阈值 + 机器离线：全链落位（步 failed + errorMessage + 相位 failed + 会话流 step 事件）', () => {
    const w = makeWorld({ status: 'claimed', createdAgo: 300_000, heartbeatAgo: 300_000 });
    const { events } = tapConvStream(w.s, w.buildId);

    failAbandonedBuildSteps(w.s.svc, w.base);

    expect(stepRowOf(w).status).toBe('failed');
    const build = buildRowOf(w);
    expect(build.errorMessage).not.toBeNull();
    expect(build.errorMessage).toContain('失联');
    // #631 语义：todo 相位翻「失败」，重跑入口保留给用户（failed→queued 边）。
    expect(todoRowOf(w).phase).toBe('failed');
    const ev = events.find(
      (e): e is { type: string; step: unknown } => (e as { type?: string }).type === 'step',
    );
    if (ev === undefined) throw new Error('no step event on the conversation stream');
    expect((ev.step as { id: string }).id).toBe(w.stepId);
    expect((ev.step as { status: string }).status).toBe('failed');
  });

  test('B-C7：claimed 自领取零心跳进展超阈值 + 机器在线：同样按失败收尾', () => {
    // heartbeat 缺省 = claim 置位值（从未推进）+ 机器在线 = B-C7 移交竞态形。
    const w = makeWorld({
      status: 'claimed',
      createdAgo: 300_000,
      machineOnline: true,
    });

    failAbandonedBuildSteps(w.s.svc, w.base);

    expect(stepRowOf(w).status).toBe('failed');
    expect(buildRowOf(w).errorMessage).toContain('无进展');
    expect(todoRowOf(w).phase).toBe('failed');
  });

  test('pending 超龄 + 团队零在线机器：按失败收尾', () => {
    const w = makeWorld({ status: 'pending', createdAgo: 300_000 });

    failAbandonedBuildSteps(w.s.svc, w.base);

    expect(stepRowOf(w).status).toBe('failed');
    expect(buildRowOf(w).errorMessage).toContain('无人认领');
    expect(todoRowOf(w).phase).toBe('failed');
  });

  test('负例：心跳新鲜的 claimed 步不动（在线/离线皆可）', () => {
    const online = makeWorld({
      status: 'claimed',
      createdAgo: 300_000,
      heartbeatAgo: 10_000,
      machineOnline: true,
    });
    const offline = makeWorld({
      status: 'claimed',
      createdAgo: 300_000,
      heartbeatAgo: 10_000,
    });

    failAbandonedBuildSteps(online.s.svc, online.base);
    failAbandonedBuildSteps(offline.s.svc, offline.base);

    // 心跳年龄是活判据：新鲜 = 长步仍在跑，不命中任何判据。
    expect(stepRowOf(online).status).toBe('claimed');
    expect(stepRowOf(offline).status).toBe('claimed');
    expect(buildRowOf(online).errorMessage).toBeNull();
  });

  test('负例：pending 且团队有在线机器 = 合法排队不杀', () => {
    const w = makeWorld({ status: 'pending', createdAgo: 300_000, machineOnline: true });

    failAbandonedBuildSteps(w.s.svc, w.base);

    expect(stepRowOf(w).status).toBe('pending');
    expect(todoRowOf(w).phase).toBe('building');
  });

  test('负例：pending 未超龄 → 不动', () => {
    const w = makeWorld({ status: 'pending', createdAgo: 10_000 });

    failAbandonedBuildSteps(w.s.svc, w.base);

    expect(stepRowOf(w).status).toBe('pending');
  });

  test('负例：在线机器上曾有心跳后停更的 claimed 步 = 歧义态不动', () => {
    // 执行/推送通道部分存活的楔子态：不动，等 presence 过期走离线判据。
    const w = makeWorld({
      status: 'claimed',
      createdAgo: 600_000,
      heartbeatAgo: 300_000,
      machineOnline: true,
    });

    failAbandonedBuildSteps(w.s.svc, w.base);

    expect(stepRowOf(w).status).toBe('claimed');
  });

  test('幂等：终态步跳过；chief 步不在本面；第二轮无变化', () => {
    const w = makeWorld({ status: 'claimed', createdAgo: 300_000, heartbeatAgo: 300_000 });
    w.s.db
      .insert(stepTable)
      .values({
        id: 'step-chief-other',
        buildId: 'chief-thread-1',
        kind: 'chief',
        status: 'claimed',
        machineId: w.machineId,
        createdAt: w.base - 300_000,
        claimedAt: w.base - 300_000,
        lastHeartbeatAt: w.base - 300_000,
      })
      .run();

    failAbandonedBuildSteps(w.s.svc, w.base);
    expect(stepRowOf(w).status).toBe('failed');
    const chief = w.s.db
      .select()
      .from(stepTable)
      .where(eq(stepTable.id, 'step-chief-other'))
      .get()!;
    expect(chief.status).toBe('claimed'); // chief 面归 chief.ts 扫尾

    const errorMessage = buildRowOf(w).errorMessage;
    failAbandonedBuildSteps(w.s.svc, w.base + 600_000);
    expect(stepRowOf(w).status).toBe('failed');
    expect(buildRowOf(w).errorMessage).toBe(errorMessage); // 无重复收尾
  });

  test('阈值与 #684 同节奏（120 秒）', () => {
    expect(BUILD_ABANDONED_STEP_MS).toBe(120_000);
  });

  test('scheduler tick 接线：tick(now) 驱动 sweep（真实宿主路径）', () => {
    const w = makeWorld({ status: 'claimed', createdAgo: 300_000, heartbeatAgo: 300_000 });
    const scheduler = createScheduler(w.s.svc, { tickMs: 60_000 });

    scheduler.tick(w.base);
    expect(stepRowOf(w).status).toBe('failed');
    scheduler.stop();
  });
});
