// #863 AMP 对齐 T2 会话亲和：tryClaim worker 候选环——会续接 prior session 的
// 步优先回「持有该会话文件的机器」（machine-execution-plane §4-7：conv 会话文
// 件是执行机本地资产，换机 = 丢对话上下文，机器亲和是正确性项不是优化项）。
// 失败方式（先于实现固化，仓测试纪律）：
// 1. 换机常态化：无亲和时任意在线机 FIFO 抢走续接步 → 上下文丢失成为常态路
//    径而非例外 → 会话机在线期间他机 claim 必须空手（步留 pending 等它领）。
// 2. 让行缺失：会话机离线（含机器行被删、历史行 machineId 空）他机仍不领 →
//    步永挂 → 必须放行（换机由 daemon 侧 SessionNotResumable 回退 +
//    RESUME_FRESH_SESSION_NOTE 显式降级标记兜底，#862 T1 已落，载荷契约不破）。
// 3. 闸死锁：会话机在线但 runtime 闸关 → 他机被亲和挡死 → 必须放行（闸判与
//    claim 侧同律：会话机开不了本步 = 它不是有效候选人）。
// 4. 钉选死锁：钉选机 ≠ 会话机时钉选机也被亲和挡死（钉选 SQL 过滤下唯有它能
//    见）→ 钉选 = 用户显式选择，盖过亲和，钉选机照领（换机降级仍走 T1 标记）。
// 5. 饥饿：他机跳过亲和步后领不到任何步（队头阻塞）→ 跳过只作用于该候选，
//    更晚的它 build 步照领（与钉选过滤同型的「每机可见性」语义）。
// 6. 过宽：review 步 / plan 交接缺失步 / 首步（无历史会话）恒开新会话（无会话
//    文件依赖）→ 不亲和，任意在线机即领。
// 7. 亲和跟链尾：多步链中途换机后，亲和位 = 最新会话机（会话文件在哪台），
//    不是首步机。
// 8. 载荷契约：放行后 claim 载荷仍 continue 原会话（daemon 回退 + 注记的
//    #862 T1 契约原样保留，server 不替 daemon 预判降级）。

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
import { SESSION_WEDGE_GRACE_MS } from '../src/services/dispatch-timeouts.js';
import { claimStep } from '../src/services/machines.js';
import { bootServer, type TestServer } from './helpers.js';

const disposables: (() => void)[] = [];
afterAll(() => {
  for (const d of disposables) d();
});

interface AffinityWorld {
  s: TestServer;
  teamId: string;
  buildId: string;
  targetStepId: string;
  /** 历史会话 done 步 id（按 createdAt 序，与 priorSessions 同长）。 */
  priorStepIds: string[];
  /** 会话机（prior session 的 machineId）。 */
  machineAId: string;
  /** 他机（亲和测试的观察者/竞争者）。 */
  machineBId: string;
  agentId: string;
}

interface WorldOpts {
  /** 会话机在线位（缺省 true）。 */
  ownerOnline?: boolean;
  /** 会话机 runtime 开关（缺省 ['pi']；步跑 stub-gw agent = pi 档）。 */
  ownerRuntimes?: string[];
  /** target 步 kind（缺省 build）。 */
  kind?: 'build' | 'merge' | 'plan' | 'review';
  /** review 步 prompt meta（agentId 头行）。 */
  reviewAgent?: boolean;
  /** withPlan 面（plan 交接缺失形态）。 */
  withPlan?: boolean;
  /** 历史会话链（缺省单条：A/sess-A）；按序插入 done 步。 */
  priorSessions?: { machineId: string | null; sessionId: string; kind?: 'build' | 'merge' }[];
  /** #881：target 步入队年龄（缺省 60_000 = 宽限内；超宽限 = 楔住释放位）。 */
  targetAgeMs?: number;
  /** #881：会话机手上另持一条 claimed 步（= 忙，合法长跑；缺省 false = 空闲
   *  楔住位）。步落在另一个 build 上（忙的是别的任务）。 */
  ownerBusy?: boolean;
}

/** 直插 world：project + todo（assignment build 槽带模型 Agent）+ build + 会话机
 * A（prior session 归属）+ 他机 B + 历史会话 done 步 + 目标 pending 步。
 * 机器在线位直写 DB（生产置位路径 = presence/wake SSE，归 machine-wire 测试）。 */
function makeWorld(opts: WorldOpts = {}): AffinityWorld {
  const s = bootServer();
  disposables.push(() => s.dispose());
  const base = Date.now();
  const teamId = s.team.id;
  const suffix = Math.random().toString(36).slice(2);
  const buildId = `build-${suffix}`;
  const targetStepId = `step-target-${suffix}`;
  const machineAId = `machine-a-${suffix}`;
  const machineBId = `machine-b-${suffix}`;
  const agentId = `agent-${suffix}`;
  s.db
    .insert(projectTable)
    .values({ id: `proj-${suffix}`, name: 'affinity', teamId })
    .run();
  s.db
    .insert(agentTable)
    .values({
      id: agentId,
      teamId,
      displayName: 'affinity-agent',
      provider: 'stub-gw',
      modelId: 'stub-model',
    })
    .run();
  s.db
    .insert(todoTable)
    .values({
      id: `todo-${suffix}`,
      teamId,
      projectId: `proj-${suffix}`,
      title: 'affinity target',
      phase: 'building',
      phaseAt: base,
      seqNum: 1,
      assignment: { plan: null, build: { agentId } },
    })
    .run();
  s.db
    .insert(buildTable)
    .values({
      id: buildId,
      todoId: `todo-${suffix}`,
      withPlan: opts.withPlan ?? false,
      triggerSource: 'user',
      createdAt: base - 600_000,
    })
    .run();
  s.db
    .insert(machineTable)
    .values({
      id: machineAId,
      teamId,
      name: `owner-${suffix}`,
      online: opts.ownerOnline ?? true,
      enabledRuntimes: opts.ownerRuntimes ?? ['pi'],
      // #1108：ownerBusy 位 = 会话机 claimed 数达上限（忙 = 真满，并行
      // daemon 有闲位就会来领）。cap=1 时一条 claimed 步即满——忙语义钉死。
      ...(opts.ownerBusy ? { maxConcurrent: 1 } : {}),
    })
    .run();
  s.db
    .insert(machineTable)
    .values({
      id: machineBId,
      teamId,
      name: `other-${suffix}`,
      online: true,
      enabledRuntimes: ['pi'],
    })
    .run();
  const priorSessions = opts.priorSessions ?? [{ machineId: machineAId, sessionId: 'sess-A' }];
  const priorStepIds: string[] = [];
  priorSessions.forEach((p, i) => {
    const id = `step-prior-${suffix}-${i}`;
    priorStepIds.push(id);
    s.db
      .insert(stepTable)
      .values({
        id,
        buildId,
        kind: p.kind ?? 'build',
        status: 'done',
        machineId: p.machineId,
        sessionId: p.sessionId,
        createdAt: base - 500_000 + i * 1_000,
      })
      .run();
  });
  const kind = opts.kind ?? 'build';
  s.db
    .insert(stepTable)
    .values({
      id: targetStepId,
      buildId,
      kind,
      status: 'pending',
      machineId: null,
      // review 步 agentId 在 prompt meta 头行（M7 #330：step 表无 agentId 列）。
      ...(opts.reviewAgent
        ? { prompt: `{"kind":"review","agentId":"${agentId}","gate":"review"}\n审核任务` }
        : {}),
      createdAt: base - (opts.targetAgeMs ?? 60_000),
    })
    .run();
  if (opts.ownerBusy) {
    // 会话机忙位（#1108 起忙 = claimed 数达 maxConcurrent，cap=1 时一条即满）：
    // 另一条 build 的 claimed 步挂 A——有闲位的并行 daemon 会来领新步，达上限
    // 才是「合法等待不误放」，不是楔住。
    s.db
      .insert(stepTable)
      .values({
        id: `step-busy-${suffix}`,
        buildId: `build-busy-${suffix}`,
        kind: 'build',
        status: 'claimed',
        machineId: machineAId,
        createdAt: base - 300_000,
        claimedAt: base - 300_000,
        lastHeartbeatAt: base - 10_000,
      })
      .run();
  }
  return { s, teamId, buildId, targetStepId, priorStepIds, machineAId, machineBId, agentId };
}

function machineDepsOf(w: AffinityWorld) {
  return {
    ...w.s.svc,
    box: w.s.secretBox,
    reposDir: w.s.reposDir,
    attachmentsDir: w.s.attachmentsDir,
  };
}

function claimAs(w: AffinityWorld, machineId: string) {
  return claimStep(machineDepsOf(w), machineId, w.teamId, 10, 'http://localhost');
}

function targetRow(w: AffinityWorld) {
  return w.s.db.select().from(stepTable).where(eq(stepTable.id, w.targetStepId)).get()!;
}

describe('#863 T2 会话亲和（tryClaim worker 候选环）', () => {
  test('核心：会话机在线 → 他机空手、步留 pending；会话机自己领到 + continue 载荷', async () => {
    const w = makeWorld();
    // 失败方式 1：B 若抢走 = 换机常态化（上下文丢失成为默认路径）。
    expect(await claimAs(w, w.machineBId)).toBeNull();
    const row = targetRow(w);
    expect(row.status).toBe('pending');
    expect(row.machineId).toBeNull();

    const got = await claimAs(w, w.machineAId);
    expect(got?.step.id).toBe(w.targetStepId);
    expect(got?.step.machineId).toBe(w.machineAId);
    expect(got?.session).toEqual({ action: 'continue', sessionId: 'sess-A' });
  });

  test('会话机离线 → 他机领到；载荷仍 continue（daemon 回退 + 注记的 T1 契约不破）', async () => {
    const w = makeWorld({ ownerOnline: false });
    const got = await claimAs(w, w.machineBId);
    expect(got?.step.id).toBe(w.targetStepId);
    expect(got?.step.machineId).toBe(w.machineBId);
    // 失败方式 8：server 不替 daemon 预判降级——continue 载荷原样下发，换机降
    // 级由 daemon SessionNotResumable 回退 + transcript 注记显式化。
    expect(got?.session).toEqual({ action: 'continue', sessionId: 'sess-A' });
  });

  test('会话机行被删（机器注销）→ 他机领到（幽灵归属不放行 = 步永挂）', async () => {
    const w = makeWorld();
    w.s.db.delete(machineTable).where(eq(machineTable.id, w.machineAId)).run();
    const got = await claimAs(w, w.machineBId);
    expect(got?.step.id).toBe(w.targetStepId);
  });

  test('历史会话行 machineId 空（存量形态）→ 无亲和位，他机领到', async () => {
    const w = makeWorld({ priorSessions: [{ machineId: null, sessionId: 'sess-A' }] });
    const got = await claimAs(w, w.machineBId);
    expect(got?.step.id).toBe(w.targetStepId);
    expect(got?.session).toEqual({ action: 'continue', sessionId: 'sess-A' });
  });

  test('闸死锁：会话机在线但 runtime 关（步跑 pi、会话机只开 claude-code）→ 他机领到', async () => {
    const w = makeWorld({ ownerRuntimes: ['claude-code'] });
    // 失败方式 3：会话机自己过不了 claim 闸 → 它不是有效候选人，亲和不得挡死
    // 唯一能跑的机器。
    const got = await claimAs(w, w.machineBId);
    expect(got?.step.id).toBe(w.targetStepId);
  });

  test('钉选盖过亲和：钉选机 ≠ 会话机 → 钉选机照领（用户显式选择；换机降级走 T1 标记）', async () => {
    const w = makeWorld();
    w.s.db
      .update(buildTable)
      .set({ pinnedMachineId: w.machineBId })
      .where(eq(buildTable.id, w.buildId))
      .run();
    // 失败方式 4：钉选 SQL 过滤下只有 B 能见该步；亲和若对 B 也生效 = 唯一可见
    // 者也被挡死 → 步在会话机在线期间永挂。
    const got = await claimAs(w, w.machineBId);
    expect(got?.step.id).toBe(w.targetStepId);
    expect(got?.session).toEqual({ action: 'continue', sessionId: 'sess-A' });
  });

  test('无队头阻塞：他机跳过亲和步后照领更晚的它 build 步；会话机随后领亲和步', async () => {
    const w = makeWorld();
    const suffix = Math.random().toString(36).slice(2);
    // 第二个 build：无历史会话（首步），createdAt 晚于亲和步。
    w.s.db
      .insert(projectTable)
      .values({ id: `proj-${suffix}`, name: 'affinity-2', teamId: w.teamId })
      .run();
    w.s.db
      .insert(todoTable)
      .values({
        id: `todo2-${suffix}`,
        teamId: w.teamId,
        projectId: `proj-${suffix}`,
        title: 'second todo',
        phase: 'queued',
        phaseAt: Date.now(),
        seqNum: 2,
        assignment: { plan: null, build: { agentId: w.agentId } },
      })
      .run();
    w.s.db
      .insert(buildTable)
      .values({
        id: `build2-${suffix}`,
        todoId: `todo2-${suffix}`,
        withPlan: false,
        triggerSource: 'user',
        createdAt: Date.now() - 30_000,
      })
      .run();
    const laterStepId = `step-later-${suffix}`;
    w.s.db
      .insert(stepTable)
      .values({
        id: laterStepId,
        buildId: `build2-${suffix}`,
        kind: 'build',
        status: 'pending',
        machineId: null,
        createdAt: Date.now() - 20_000,
      })
      .run();

    // 失败方式 5：B 跳过亲和步（会话机 A 在线）但不饿死——领到更晚的步。
    const gotB = await claimAs(w, w.machineBId);
    expect(gotB?.step.id).toBe(laterStepId);

    // A 随后领到亲和步（FIFO：亲和步 createdAt 更早）。
    const gotA = await claimAs(w, w.machineAId);
    expect(gotA?.step.id).toBe(w.targetStepId);
  });

  test('过宽负例：review 步（恒新会话）不亲和，他机即领', async () => {
    const w = makeWorld({ kind: 'review', reviewAgent: true });
    const got = await claimAs(w, w.machineBId);
    expect(got?.step.id).toBe(w.targetStepId);
    expect(got?.session).toEqual({ action: 'new', sessionId: null });
  });

  test('过宽负例：plan 交接缺失的 build 步（强制新会话）不亲和，他机即领', async () => {
    const w = makeWorld({ kind: 'build', withPlan: true });
    // build.withPlan 且 planDocId 空 = #113 候选2：build 步强制 new session。
    const got = await claimAs(w, w.machineBId);
    expect(got?.step.id).toBe(w.targetStepId);
    expect(got?.session).toEqual({ action: 'new', sessionId: null });
  });

  test('过宽负例：无历史会话（首步）→ 任意机即领（现状回归钉）', async () => {
    const w = makeWorld({ priorSessions: [] });
    const got = await claimAs(w, w.machineBId);
    expect(got?.step.id).toBe(w.targetStepId);
    expect(got?.session).toEqual({ action: 'new', sessionId: null });
  });

  test('亲和跟链尾：中途换机后亲和位 = 最新会话机（不是首步机）', async () => {
    // 会话链：A 跑了第一步（sess-A），B 跑了第二步（sess-B）——B 持有最新会话。
    const w = makeWorld({
      priorSessions: [
        { machineId: null, sessionId: 'sess-A' },
        { machineId: null, sessionId: 'sess-B' },
      ],
    });
    w.s.db
      .update(stepTable)
      .set({ machineId: w.machineAId })
      .where(eq(stepTable.id, w.priorStepIds[0]!))
      .run();
    w.s.db
      .update(stepTable)
      .set({ machineId: w.machineBId })
      .where(eq(stepTable.id, w.priorStepIds[1]!))
      .run();

    // 失败方式 7：亲和若认首步机 A → A 领走 = 续接 sess-B 必失败（文件在 B）。
    expect(await claimAs(w, w.machineAId)).toBeNull();
    const got = await claimAs(w, w.machineBId);
    expect(got?.step.id).toBe(w.targetStepId);
    expect(got?.session).toEqual({ action: 'continue', sessionId: 'sess-B' });
  });
});

describe('#881 会话机在线但楔住（tryClaim 亲和闸的有界化）', () => {
  // 失败方式（先于实现固化，#863 已知缝）：会话机在线（presence 心跳鲜活）
  // 但不领步——claim 主循环死/进程挂——亲和闸按「在线 + 闸开」永久让行，
  // 步无期 pending。有界化：步等了 SESSION_WEDGE_GRACE_MS 仍无人领、且会话机
  // 手上没有 claimed 步（忙 = 合法等待不误放）→ 闸放行，他机认领换机，降级
  // 走 #862 T1 的 daemon 注记（server 不预判）。

  test('楔住：会话机在线 + 手上无步 + 步超宽限 → 他机领到（等待有界）；载荷仍 continue（契约不破）', async () => {
    const w = makeWorld({ targetAgeMs: SESSION_WEDGE_GRACE_MS + 60_000 });
    const got = await claimAs(w, w.machineBId);
    expect(got?.step.id).toBe(w.targetStepId);
    expect(got?.step.machineId).toBe(w.machineBId);
    // 换机降级的 #862 T1 契约原样：continue 载荷下发，daemon 续不上回退新会话。
    expect(got?.session).toEqual({ action: 'continue', sessionId: 'sess-A' });
  });

  test('忙 = 合法等待：会话机在线 + 另持 claimed 步（心跳新鲜或停更）+ 步超宽限 → 他机仍空手', async () => {
    // 心跳停更变体一并钉：claimed 步「部分存活歧义态」的归属面既有政策（等
    // presence 过期走释放），亲和不得越过它抢先换机。
    const w = makeWorld({
      targetAgeMs: SESSION_WEDGE_GRACE_MS + 60_000,
      ownerBusy: true,
    });
    expect(await claimAs(w, w.machineBId)).toBeNull();
    expect(targetRow(w).status).toBe('pending');
  });

  test('宽限内楔住 → 仍让行（在线位准确时不急放，给 claim 长轮询节奏留量）', async () => {
    const w = makeWorld({ targetAgeMs: 60_000 });
    expect(await claimAs(w, w.machineBId)).toBeNull();
    expect(targetRow(w).status).toBe('pending');
  });

  test('楔住释放后会话机自己仍可领（闸从不挡它自己——恢复即无损续接）', async () => {
    const w = makeWorld({ targetAgeMs: SESSION_WEDGE_GRACE_MS + 60_000 });
    const got = await claimAs(w, w.machineAId);
    expect(got?.step.id).toBe(w.targetStepId);
    expect(got?.step.machineId).toBe(w.machineAId);
    expect(got?.session).toEqual({ action: 'continue', sessionId: 'sess-A' });
  });

  test('楔住宽限是单一来源的定值（10 分钟：盖过 claim 长轮询节奏与退避，仍是有界等待）', () => {
    expect(SESSION_WEDGE_GRACE_MS).toBe(600_000);
  });
});
