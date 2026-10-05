// #706 失联扫尾 + #862 T1 跨机续跑：sweepAbandonedBuildSteps——失联 claimed
// 步释放回 pending 供他机认领（new-session 降级由 daemon 侧 transcript 标记），
// 无人认领的 pending 步（团队零在线机器）仍按失败收尾。判定（超龄 × 在线态 ×
// 步状态 × 步 kind）+ 落账面 + 事件面（会话流 step 事件，不另起通知面）。机器
// 在线位直写 DB（生产置位路径 wake SSE 断连面归 machine-wire 测试）。

import { RESUME_FRESH_SESSION_NOTE } from '@pacman/shared';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, test } from 'vitest';
import {
  agent as agentTable,
  build as buildTable,
  machine as machineTable,
  project as projectTable,
  step as stepTable,
  todo as todoTable,
} from '../src/db/schema.js';
import { BUILD_ABANDONED_STEP_MS, sweepAbandonedBuildSteps } from '../src/services/builds.js';
import { claimStep } from '../src/services/machines.js';
import { createScheduler } from '../src/services/scheduler.js';
import { bootServer, type TestServer } from './helpers.js';

const disposables: (() => void)[] = [];
afterAll(() => {
  for (const d of disposables) d();
});

interface BuildWorld {
  s: TestServer;
  teamId: string;
  todoId: string;
  buildId: string;
  stepId: string;
  machineId: string;
  agentId: string | null;
  base: number;
}

/** 直插 world：project + building 相 todo + build + build 步 + 一台机器。
 * withAgent = 指派带模型的 Agent（认领路径用：tryClaim 要求 assignment 槽有
 * 模型位；机器开 pi runtime）。 */
function makeWorld(step: {
  status: 'pending' | 'claimed';
  kind?: 'plan' | 'build' | 'merge' | 'review' | 'chief';
  createdAgo: number;
  heartbeatAgo?: number | null;
  machineOnline?: boolean;
  withAgent?: boolean;
}): BuildWorld {
  const s = bootServer();
  disposables.push(() => s.dispose());
  const base = Date.now();
  const teamId = s.team.id;
  const todoId = `todo-${Math.random().toString(36).slice(2)}`;
  const buildId = `build-${Math.random().toString(36).slice(2)}`;
  const stepId = `step-${Math.random().toString(36).slice(2)}`;
  const machineId = `machine-${Math.random().toString(36).slice(2)}`;
  const agentId = step.withAgent ? `agent-${Math.random().toString(36).slice(2)}` : null;
  s.db.insert(projectTable).values({ id: 'proj-sweep', name: 'sweep', teamId }).run();
  if (agentId !== null) {
    s.db
      .insert(agentTable)
      .values({ id: agentId, teamId, displayName: 'sweep-agent', modelId: 'stub-model' })
      .run();
  }
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
      ...(agentId !== null ? { assignment: { plan: null, build: { agentId } } } : {}),
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
    .values({
      id: machineId,
      teamId,
      name: 'sweep-box',
      online: step.machineOnline ?? false,
      ...(step.withAgent ? { enabledRuntimes: ['pi'] } : {}),
    })
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
  return { s, teamId, todoId, buildId, stepId, machineId, agentId, base };
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

function stepEventOf(events: object[], stepId: string): { status: string } {
  const ev = events.find(
    (e): e is { type: string; step: unknown } => (e as { type?: string }).type === 'step',
  );
  if (ev === undefined) throw new Error('no step event on the conversation stream');
  if ((ev.step as { id: string }).id !== stepId) throw new Error('step event for another step');
  return ev.step as { status: string };
}

/** claim 面要 MachineDeps（svc 只有 BuildDeps 位，box/目录面补齐）。 */
function machineDepsOf(w: BuildWorld) {
  return {
    ...w.s.svc,
    box: w.s.secretBox,
    reposDir: w.s.reposDir,
    attachmentsDir: w.s.attachmentsDir,
  };
}

describe('#862 T1 失联 claimed 步释放（sweepAbandonedBuildSteps）', () => {
  test('claimed 心跳停更超阈值 + 机器离线：释放回 pending（机位清空、相位不动、无失败痕迹）+ 会话流 step 事件 + wake 唤醒认领循环', async () => {
    const w = makeWorld({ status: 'claimed', createdAgo: 300_000, heartbeatAgo: 300_000 });
    const { events } = tapConvStream(w.s, w.buildId);
    const woken = w.s.svc.machineHub.waitWake(w.teamId, 50);

    sweepAbandonedBuildSteps(w.s.svc, w.base);

    const row = stepRowOf(w);
    expect(row.status).toBe('pending');
    expect(row.machineId).toBeNull();
    // 非失败路径：todo 相位不动、build 无 errorMessage（与机器报失败同漏斗不混）。
    expect(todoRowOf(w).phase).toBe('building');
    expect(buildRowOf(w).errorMessage).toBeNull();
    expect(stepEventOf(events, w.stepId).status).toBe('pending');
    // 他机 75s 长轮询不等满：释放即 wake，同队等待者立即重认领。
    await expect(woken).resolves.toBe(true);
  });

  test('B-C7：claimed 自领取零心跳进展超阈值 + 机器在线：同样释放（server 标了 claimed 但机器侧零执行，步可被他机/本机重领）', () => {
    // heartbeat 缺省 = claim 置位值（从未推进）+ 机器在线 = B-C7 移交竞态形。
    const w = makeWorld({
      status: 'claimed',
      createdAgo: 300_000,
      machineOnline: true,
    });

    sweepAbandonedBuildSteps(w.s.svc, w.base);

    expect(stepRowOf(w).status).toBe('pending');
    expect(stepRowOf(w).machineId).toBeNull();
    expect(todoRowOf(w).phase).toBe('building');
    expect(buildRowOf(w).errorMessage).toBeNull();
  });

  test('释放后他机可认领：另一台在线机器 claim 拿到同一 步（跨机续跑的 server 半）', async () => {
    const w = makeWorld({
      status: 'claimed',
      createdAgo: 300_000,
      heartbeatAgo: 300_000,
      withAgent: true,
    });
    const meaId = `machine-mea-${Math.random().toString(36).slice(2)}`;
    w.s.db
      .insert(machineTable)
      .values({ id: meaId, teamId: w.teamId, name: 'mea', online: true, enabledRuntimes: ['pi'] })
      .run();

    sweepAbandonedBuildSteps(w.s.svc, w.base);
    expect(stepRowOf(w).status).toBe('pending');

    const claimed = await claimStep(machineDepsOf(w), meaId, w.teamId, 10, 'http://localhost');
    if (claimed === null) throw new Error('released step was not reclaimable');
    expect(claimed.step.id).toBe(w.stepId);
    expect(claimed.step.machineId).toBe(meaId);
    // 会话面：无历史 session → 新会话开工；daemon 侧回退标记见 runner-resume-note 测试。
    expect(claimed.session.action).toBe('new');
  });

  test('释放后认领带历史会话：prior session 在位 → continue 载荷（他机 daemon 续不上即回退新会话 + 显式标记）', async () => {
    const w = makeWorld({
      status: 'claimed',
      createdAgo: 300_000,
      heartbeatAgo: 300_000,
      withAgent: true,
    });
    // 同 build 更早的 done 步带 sessionId = 历史会话（server 侧 continue 判定源）。
    w.s.db
      .insert(stepTable)
      .values({
        id: `step-prior-${Math.random().toString(36).slice(2)}`,
        buildId: w.buildId,
        kind: 'build',
        status: 'done',
        machineId: w.machineId,
        sessionId: 'sess-old',
        createdAt: w.base - 600_000,
      })
      .run();
    const meaId = `machine-mea-${Math.random().toString(36).slice(2)}`;
    w.s.db
      .insert(machineTable)
      .values({ id: meaId, teamId: w.teamId, name: 'mea', online: true, enabledRuntimes: ['pi'] })
      .run();

    sweepAbandonedBuildSteps(w.s.svc, w.base);

    const claimed = await claimStep(machineDepsOf(w), meaId, w.teamId, 10, 'http://localhost');
    if (claimed === null) throw new Error('released step was not reclaimable');
    expect(claimed.session).toEqual({ action: 'continue', sessionId: 'sess-old' });
  });

  test('pending 超龄 + 团队零在线机器：仍按失败收尾（T3 领地，本票不动）', () => {
    const w = makeWorld({ status: 'pending', createdAgo: 300_000 });

    sweepAbandonedBuildSteps(w.s.svc, w.base);

    expect(stepRowOf(w).status).toBe('failed');
    expect(buildRowOf(w).errorMessage).toContain('无人认领');
    expect(todoRowOf(w).phase).toBe('failed');
  });

  test('释放后仍无在线机器 → 下一轮按无人认领失败（释放不是无期等待，超时策略归 T3）', () => {
    const w = makeWorld({ status: 'claimed', createdAgo: 300_000, heartbeatAgo: 300_000 });

    sweepAbandonedBuildSteps(w.s.svc, w.base);
    expect(stepRowOf(w).status).toBe('pending');

    sweepAbandonedBuildSteps(w.s.svc, w.base + 600_000);
    expect(stepRowOf(w).status).toBe('failed');
    expect(buildRowOf(w).errorMessage).toContain('无人认领');
  });

  test('释放后有在线机器 → 继续排队不杀', () => {
    const w = makeWorld({ status: 'claimed', createdAgo: 300_000, heartbeatAgo: 300_000 });
    w.s.db
      .insert(machineTable)
      .values({
        id: `machine-mea-${Math.random().toString(36).slice(2)}`,
        teamId: w.teamId,
        name: 'mea',
        online: true,
      })
      .run();

    sweepAbandonedBuildSteps(w.s.svc, w.base);
    expect(stepRowOf(w).status).toBe('pending');
    sweepAbandonedBuildSteps(w.s.svc, w.base + 600_000);
    expect(stepRowOf(w).status).toBe('pending');
    expect(todoRowOf(w).phase).toBe('building');
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

    sweepAbandonedBuildSteps(online.s.svc, online.base);
    sweepAbandonedBuildSteps(offline.s.svc, offline.base);

    // 心跳年龄是活判据：新鲜 = 长步仍在跑，不命中任何判据。
    expect(stepRowOf(online).status).toBe('claimed');
    expect(stepRowOf(offline).status).toBe('claimed');
    expect(buildRowOf(online).errorMessage).toBeNull();
  });

  test('负例：pending 且团队有在线机器 = 合法排队不碰', () => {
    const w = makeWorld({ status: 'pending', createdAgo: 300_000, machineOnline: true });

    sweepAbandonedBuildSteps(w.s.svc, w.base);

    expect(stepRowOf(w).status).toBe('pending');
    expect(todoRowOf(w).phase).toBe('building');
  });

  test('负例：pending 未超龄 → 不动', () => {
    const w = makeWorld({ status: 'pending', createdAgo: 10_000 });

    sweepAbandonedBuildSteps(w.s.svc, w.base);

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

    sweepAbandonedBuildSteps(w.s.svc, w.base);

    expect(stepRowOf(w).status).toBe('claimed');
  });

  test('幂等：终态步跳过；chief 步不在本面', () => {
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

    sweepAbandonedBuildSteps(w.s.svc, w.base);
    expect(stepRowOf(w).status).toBe('pending');
    const chief = w.s.db
      .select()
      .from(stepTable)
      .where(eq(stepTable.id, 'step-chief-other'))
      .get()!;
    expect(chief.status).toBe('claimed'); // chief 面归 chief.ts 扫尾
  });

  test('阈值与 #684 同节奏（120 秒，不自造新节奏）', () => {
    expect(BUILD_ABANDONED_STEP_MS).toBe(120_000);
  });

  test('降级标记文案单源：daemon 回退注记复用 shared 常量（双端一致）', () => {
    expect(RESUME_FRESH_SESSION_NOTE.length).toBeGreaterThan(0);
    expect(RESUME_FRESH_SESSION_NOTE).not.toMatch(/[{}]/);
  });

  test('scheduler tick 接线：tick(now) 驱动 sweep（真实宿主路径）', () => {
    const w = makeWorld({ status: 'claimed', createdAgo: 300_000, heartbeatAgo: 300_000 });
    const scheduler = createScheduler(w.s.svc, { tickMs: 60_000 });

    scheduler.tick(w.base);
    expect(stepRowOf(w).status).toBe('pending');
    scheduler.stop();
  });
});
