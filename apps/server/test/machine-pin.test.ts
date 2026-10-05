// #682 机器钉选闭环（t-0047 调研落地）：任务级机器 todo.machineId 三条入口
// 接线 + enabledRuntimes claim 真闸 + chief 线程机器亲和。失败方式（先于实现
// 固化，仓测试纪律）：
// 1. 界外机器 id 建/改任务 → 400（tagIds 同律边界防御）
// 2. startBuilds 缺省链：REST 人工启动不带 pin → build 落 todo.machineId；
//    schedule 显式值覆盖 todo 值；schedule null 回落 todo 值（不顶掉）
// 3. restart 不继承失败轮 pin，回落 todo.machineId
// 4. claim 钉选过滤：pinned build 只有钉的机器能领（现状语义回归钉）
// 5. enabledRuntimes 真闸：机器未开步所需 runtime → 领不到（worker 与 chief
//    步同律）；机器开回 pi → 领到（PATCH 热写秒级生效）
// 6. chief 亲和：orchestrate 落 thread.pinnedMachineId + 请求行机器名；别机
//    领不到 chief 步
// 7. run_builds machineId：显式覆盖；缺省继承 todo 值；null 形 400
// 8. 0022 回填：存量 [] 机器行 → ['pi']；已开 claude-code 的行不动；SQL 幂等
// #895 单机编排默认策略（spec 21，主力机缺省链四态 + PATCH 机器槽三态 +
// orchestration 封套投影）：失败方式 A–H 分列对应 describe 块内注释。

import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ClaimedStep } from '@pacman/shared';
import { claimedStepSchema } from '@pacman/shared';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterAll, describe, expect, test } from 'vitest';
import { MIGRATIONS_FOLDER } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';
import {
  agent as agentTable,
  build as buildTable,
  chief as chiefTable,
  chiefThread as chiefThreadTable,
  machine as machineTable,
  step as stepTable,
  todo as todoTable,
} from '../src/db/schema.js';
import { seed } from '../src/db/seed.js';
import { newUuidv7, nowMs } from '../src/lib/ids.js';
import { executeChiefTool } from '../src/services/chief-tools.js';
import { createScheduler } from '../src/services/scheduler.js';
import { bootServer, issueApiKey, postProject, req, type TestServer } from './helpers.js';

const AGENT_ID = 'agent-pin-1';
const CC_AGENT_ID = 'agent-pin-cc';

const temps: string[] = [];
function temp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

/** 带 Bearer 的请求（machine wire 面，g2t2 同律——helpers.req 不带鉴权头）。 */
function call(
  app: TestServer['app'],
  method: string,
  path: string,
  opts: { cred?: string; body?: unknown } = {},
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (opts.cred) headers.authorization = `Bearer ${opts.cred}`;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  return Promise.resolve(
    app.request(path, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    }),
  );
}

/** 注册一台机器换 claim token（enroll 缺省 enabledRuntimes=['pi']，#682）。 */
async function enroll(s: TestServer, name: string): Promise<string> {
  const key = await issueApiKey(s);
  const res = await call(s.app, 'POST', '/api/machine/enroll', {
    cred: key,
    body: { teamId: s.team.id, name, cliVersion: '0.1.0' },
  });
  expect(res.status).toBe(200);
  return ((await res.json()) as { token: string }).token;
}

async function claim(app: TestServer['app'], token: string): Promise<ClaimedStep | null> {
  const res = await call(app, 'POST', '/api/machine/tasks/claim', { cred: token, body: {} });
  const body = (await res.json()) as { step: ClaimedStep | null };
  return body.step === null ? null : claimedStepSchema.parse(body.step);
}

function seedAgent(s: TestServer, id: string, provider: string) {
  s.db
    .insert(agentTable)
    .values({
      id,
      teamId: s.team.id,
      displayName: id,
      status: 'active',
      avatarUrl: null,
      provider,
      modelId: 'stub-model',
      thinkingLevel: null,
      tools: [],
      secrets: [],
      skills: [],
      mcpServers: [],
    })
    .run();
}

interface World {
  s: TestServer;
  tokenA: string;
  tokenB: string;
  machineAId: string;
  machineBId: string;
  projectId: string;
}

async function setupWorld(): Promise<World> {
  const s = bootServer({ claimHoldMs: 200 });
  temps.push(''); // dispose 由 bootServer 拥有的目录自身管理；空占位避免误删
  const tokenA = await enroll(s, 'pin-mbp');
  const tokenB = await enroll(s, 'pin-other');
  const machineAId = s.db
    .select()
    .from(machineTable)
    .where(eq(machineTable.name, 'pin-mbp'))
    .get()!.id;
  const machineBId = s.db
    .select()
    .from(machineTable)
    .where(eq(machineTable.name, 'pin-other'))
    .get()!.id;
  seedAgent(s, AGENT_ID, 'stub-gw');
  seedAgent(s, CC_AGENT_ID, 'claude-code');
  const projectId = await postProject(s.app, 'pin-proj');
  return { s, tokenA, tokenB, machineAId, machineBId, projectId };
}

async function createTodo(
  s: TestServer,
  projectId: string,
  machineId?: string | null,
): Promise<string> {
  const res = await req(s.app, 'POST', `/api/projects/${projectId}/todos`, {
    title: '',
    spec: '探针任务',
    ...(machineId != null ? { machineId } : {}),
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

async function startBuild(s: TestServer, projectId: string, todoId: string): Promise<string> {
  const res = await req(s.app, 'POST', `/api/projects/${projectId}/builds`, {
    todoIds: [todoId],
    assignment: { plan: null, build: { agentId: AGENT_ID } },
    withPlan: false,
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { builds: { id: string }[] }).builds[0]!.id as string;
}

function buildPin(s: TestServer, buildId: string): string | null {
  return s.db
    .select({ pin: buildTable.pinnedMachineId })
    .from(buildTable)
    .where(eq(buildTable.id, buildId))
    .get()!.pin;
}

describe('#682 任务级机器写面（createTodo / PATCH）', () => {
  test('失败方式 1：界外机器 id 建任务 → 400；合法 id 落库透出', async () => {
    const w = await setupWorld();
    const bad = await req(w.s.app, 'POST', `/api/projects/${w.projectId}/todos`, {
      title: '',
      spec: 'x',
      machineId: 'machine-not-in-team',
    });
    expect(bad.status).toBe(400);

    const todoId = await createTodo(w.s, w.projectId, w.machineAId);
    const rec = (await (await req(w.s.app, 'GET', `/api/todos/${todoId}`)).json()) as {
      machineId: string | null;
    };
    expect(rec.machineId).toBe(w.machineAId);

    // PATCH：改钉 / 清回自动 / 界外 400。
    const re = await req(w.s.app, 'PATCH', `/api/todos/${todoId}`, {
      machineId: w.machineBId,
    });
    expect(re.status).toBe(200);
    expect(((await re.json()) as { machineId: string | null }).machineId).toBe(w.machineBId);
    const clear = await req(w.s.app, 'PATCH', `/api/todos/${todoId}`, { machineId: null });
    expect(clear.status).toBe(200);
    expect(((await clear.json()) as { machineId: string | null }).machineId).toBeNull();
    const badPatch = await req(w.s.app, 'PATCH', `/api/todos/${todoId}`, {
      machineId: 'machine-not-in-team',
    });
    expect(badPatch.status).toBe(400);
  });
});

describe('#682 startBuilds 缺省链（显式钉 > todo > 自动）', () => {
  test('失败方式 2a：REST 人工启动不带 pin → build 落 todo.machineId；无钉 todo → null', async () => {
    const w = await setupWorld();
    const pinned = await createTodo(w.s, w.projectId, w.machineAId);
    const buildId = await startBuild(w.s, w.projectId, pinned);
    expect(buildPin(w.s, buildId)).toBe(w.machineAId);

    const unpinned = await createTodo(w.s, w.projectId);
    const buildId2 = await startBuild(w.s, w.projectId, unpinned);
    expect(buildPin(w.s, buildId2)).toBeNull();
  });

  test('失败方式 2b：schedule 显式值覆盖 todo 值；schedule null 回落 todo 值', async () => {
    const w = await setupWorld();
    const todoId = await createTodo(w.s, w.projectId, w.machineAId);
    const scheduler = createScheduler(w.s.svc, { tickMs: 60_000 });
    scheduler.start();
    try {
      const at = new Date('2026-10-01T00:00:00+08:00').getTime();
      // schedule 钉 B → build 落 B（覆盖 todo 的 A）。
      await req(w.s.app, 'POST', '/api/schedules', {
        todoId,
        kind: 'once',
        at,
        machineId: w.machineBId,
      });
      scheduler.tick();
      const pins = w.s.db
        .select({ pin: buildTable.pinnedMachineId })
        .from(buildTable)
        .innerJoin(todoTable, eq(buildTable.todoId, todoTable.id))
        .all();
      expect(pins.some((p) => p.pin === w.machineBId)).toBe(true);

      // 第二轮：schedule 未钉（null）→ build 回落 todo 的 A（不被 null 顶掉）。
      const todoId2 = await createTodo(w.s, w.projectId, w.machineAId);
      await req(w.s.app, 'POST', '/api/schedules', { todoId: todoId2, kind: 'once', at });
      scheduler.tick();
      const pin2 = w.s.db
        .select({ pin: buildTable.pinnedMachineId })
        .from(buildTable)
        .where(eq(buildTable.todoId, todoId2))
        .get()!.pin;
      expect(pin2).toBe(w.machineAId);
    } finally {
      scheduler.stop();
    }
  });

  test('失败方式 3：restart 不继承失败轮 pin，回落 todo.machineId', async () => {
    const w = await setupWorld();
    const todoId = await createTodo(w.s, w.projectId, w.machineAId);
    // 失败轮被 schedule 钉到 B（制造「失败轮 pin ≠ todo 值」的分离态）。
    const buildId = newUuidv7();
    w.s.db
      .insert(buildTable)
      .values({
        id: buildId,
        todoId,
        withPlan: false,
        prevPhase: 'building',
        triggerSource: 'schedule',
        pinnedMachineId: w.machineBId,
        createdAt: nowMs(),
      })
      .run();
    w.s.db
      .update(todoTable)
      .set({ phase: 'failed', latestBuildId: buildId })
      .where(eq(todoTable.id, todoId))
      .run();
    const res = await req(w.s.app, 'POST', `/api/builds/${buildId}/steps`, {
      action: 'restart',
      feedback: '再试一次',
      clientMessageId: 'cm-restart-1',
    });
    expect(res.status).toBe(202);
    const newPin = w.s.db
      .select({ pin: buildTable.pinnedMachineId, id: buildTable.id })
      .from(buildTable)
      .where(eq(buildTable.todoId, todoId))
      .all()
      .find((r) => r.id !== buildId);
    expect(newPin?.pin).toBe(w.machineAId);
  });
});

describe('#682 claim 钉选过滤与 runtime 真闸', () => {
  test('失败方式 4：pinned build 只有钉的机器能领；别机领不到', async () => {
    const w = await setupWorld();
    const todoId = await createTodo(w.s, w.projectId, w.machineAId);
    await startBuild(w.s, w.projectId, todoId);
    // 领过一次后步即 claimed——负断言在前防顺序污染。
    expect(await claim(w.s.app, w.tokenB)).toBeNull();
    const got = await claim(w.s.app, w.tokenA);
    expect(got?.step.kind).toBe('build');
    expect(got?.step.machineId).toBe(w.machineAId);
  });

  test('失败方式 5a：机器 runtime 全关/未开步所需 runtime → 领不到；开回 → 领到', async () => {
    const w = await setupWorld();
    const todoId = await createTodo(w.s, w.projectId); // 不钉，纯闸测试
    await startBuild(w.s, w.projectId, todoId);
    const patch = (id: string, enabledRuntimes: string[]) =>
      req(w.s.app, 'PATCH', `/api/machines/${id}`, { enabledRuntimes });

    // 全关（存量 [] 形态）→ 领不到。
    await patch(w.machineAId, []);
    expect(await claim(w.s.app, w.tokenA)).toBeNull();
    // 只开 claude-code，步跑 pi agent（provider stub-gw）→ 仍领不到。
    await patch(w.machineAId, ['claude-code']);
    expect(await claim(w.s.app, w.tokenA)).toBeNull();
    // 开回 pi → 领到（PATCH 热写秒级生效的钉面）。
    await patch(w.machineAId, ['pi']);
    const got = await claim(w.s.app, w.tokenA);
    expect(got?.step.kind).toBe('build');
  });

  test('失败方式 5b：claude-code agent 步在只开 pi 的机器上领不到', async () => {
    const w = await setupWorld();
    const todoId = await createTodo(w.s, w.projectId, w.machineAId);
    const res = await req(w.s.app, 'POST', `/api/projects/${w.projectId}/builds`, {
      todoIds: [todoId],
      assignment: { plan: null, build: { agentId: CC_AGENT_ID } },
      withPlan: false,
    });
    expect(res.status).toBe(201);
    // A 只开 pi（enroll 缺省）→ claude-code 步领不到；开两档 → 领到。
    expect(await claim(w.s.app, w.tokenA)).toBeNull();
    await req(w.s.app, 'PATCH', `/api/machines/${w.machineAId}`, {
      enabledRuntimes: ['pi', 'claude-code'],
    });
    const got = await claim(w.s.app, w.tokenA);
    expect(got?.step.kind).toBe('build');
  });
});

describe('#682 chief 线程机器亲和', () => {
  async function bindChief(w: World): Promise<string> {
    const chiefId = `chief-${w.s.user.id}-${w.s.team.id}`;
    const now = nowMs();
    w.s.db
      .insert(chiefTable)
      .values({
        id: chiefId,
        userId: w.s.user.id,
        teamId: w.s.team.id,
        agentId: AGENT_ID,
        charter: '',
        createdAt: now,
      })
      .run();
    return chiefId;
  }

  test('失败方式 6：orchestrate 落 thread.pinnedMachineId + 请求行机器名；别机领不到 chief 步', async () => {
    const w = await setupWorld();
    await bindChief(w);
    const todoId = await createTodo(w.s, w.projectId, w.machineAId);
    const res = await req(w.s.app, 'POST', `/api/todos/${todoId}/orchestrate`, {});
    expect(res.status).toBe(201);
    const body = (await res.json()) as { thread: { id: string }; message: { content: string } };
    const threadRow = w.s.db
      .select()
      .from(chiefThreadTable)
      .where(eq(chiefThreadTable.id, body.thread.id))
      .get()!;
    expect(threadRow.pinnedMachineId).toBe(w.machineAId);
    // 编排请求行明示机器名（chief 裁量改派时有据）。
    expect(body.message.content).toContain('pin-mbp');

    // 别机领不到 chief 步；钉的机器领到。
    expect(await claim(w.s.app, w.tokenB)).toBeNull();
    const got = await claim(w.s.app, w.tokenA);
    expect(got?.step.kind).toBe('chief');
    expect(got?.conversationId).toBe(body.thread.id);

    // 对照：未钉 todo 的 orchestrate → thread pin = null（任何机器可领）。
    const todoId2 = await createTodo(w.s, w.projectId);
    const res2 = await req(w.s.app, 'POST', `/api/todos/${todoId2}/orchestrate`, {});
    expect(res2.status).toBe(201);
    const thread2 = (await res2.json()) as { thread: { id: string } };
    const row2 = w.s.db
      .select({ pin: chiefThreadTable.pinnedMachineId })
      .from(chiefThreadTable)
      .where(eq(chiefThreadTable.id, thread2.thread.id))
      .get()!;
    expect(row2.pin).toBeNull();
  });

  test('失败方式 7：run_builds machineId 显式覆盖；缺省继承 todo 值；null 形 400', async () => {
    const w = await setupWorld();
    const chiefId = await bindChief(w);
    const threadId = `chief-${newUuidv7()}`;
    w.s.db
      .insert(chiefThreadTable)
      .values({
        id: threadId,
        chiefId,
        userId: w.s.user.id,
        teamId: w.s.team.id,
        title: 'pin relay',
        createdAt: nowMs(),
        updatedAt: nowMs(),
        sessionRuntime: 'pi',
        sessionId: '',
        sessionOpenedAt: nowMs(),
        toolDefHashes: {},
        toolResultHashes: {},
      })
      .run();
    const relay = (params: Record<string, unknown>) =>
      executeChiefTool(
        {
          db: w.s.db,
          hub: w.s.hub,
          machineHub: w.s.machineHub,
          box: w.s.secretBox,
          user: w.s.user,
          reposDir: w.s.reposDir,
          attachmentsDir: w.s.attachmentsDir,
          skillsDir: w.s.skillsDir,
        },
        {
          teamId: w.s.team.id,
          userId: w.s.user.id,
          chiefId,
          threadId,
          chiefAgentId: AGENT_ID,
          conversationId: threadId,
        },
        'run_builds',
        params,
      );

    // 每个 todo 只派一次（再派撞相位闸 queued→queued 是合法拒绝），三个
    // 断言各用各的 todo。
    const todo1 = await createTodo(w.s, w.projectId, w.machineAId);
    const out1 = JSON.parse(
      await relay({ todoIds: [todo1], assignment: { build: { agentId: AGENT_ID } } }),
    ) as { builds: { id: string; pinnedMachineId: string | null }[] };
    expect(out1.builds[0]!.pinnedMachineId).toBe(w.machineAId);

    // 显式 B → 覆盖。
    const todo2 = await createTodo(w.s, w.projectId, w.machineAId);
    const out2 = JSON.parse(
      await relay({
        todoIds: [todo2],
        assignment: { build: { agentId: AGENT_ID } },
        machineId: w.machineBId,
      }),
    ) as { builds: { id: string; pinnedMachineId: string | null }[] };
    expect(out2.builds[0]!.pinnedMachineId).toBe(w.machineBId);

    // null 形 400（语义误导：会被缺省链回落 todo 值而非「自动」）。
    const todo3 = await createTodo(w.s, w.projectId, w.machineAId);
    await expect(
      relay({ todoIds: [todo3], assignment: { build: { agentId: AGENT_ID } }, machineId: null }),
    ).rejects.toThrow(/machineId must be a machine id or omitted/);
  });
});

// —— #895 单机编排默认策略（spec 21）：主力机 chief.machineId 缺省链 +
// PATCH /chief 机器槽 + GET /chief orchestration 封套 ——————————————————

describe('#895 主力机缺省链（todo 钉 > chief.machineId > null，spec 21 A3）', () => {
  /** 直插带主力机的 chief 行（PATCH 面另行覆盖；缺省链测试绕开写面）。 */
  async function bindChiefWithMachine(w: World, machineId: string | null): Promise<string> {
    const chiefId = `chief-${w.s.user.id}-${w.s.team.id}`;
    w.s.db
      .insert(chiefTable)
      .values({
        id: chiefId,
        userId: w.s.user.id,
        teamId: w.s.team.id,
        agentId: AGENT_ID,
        charter: '',
        createdAt: nowMs(),
        machineId,
      })
      .run();
    return chiefId;
  }

  function threadPin(s: TestServer, threadId: string): string | null {
    return s.db
      .select({ pin: chiefThreadTable.pinnedMachineId })
      .from(chiefThreadTable)
      .where(eq(chiefThreadTable.id, threadId))
      .get()!.pin;
  }

  test('失败方式 A：todo 钉选盖过主力机——两边都设时线程落 todo 的机器', async () => {
    const w = await setupWorld();
    await bindChiefWithMachine(w, w.machineBId);
    const todoId = await createTodo(w.s, w.projectId, w.machineAId);
    const res = await req(w.s.app, 'POST', `/api/todos/${todoId}/orchestrate`, {});
    expect(res.status).toBe(201);
    const body = (await res.json()) as { thread: { id: string } };
    expect(threadPin(w.s, body.thread.id)).toBe(w.machineAId);
  });

  test('失败方式 B：todo 未钉 + 主力机设 → orchestrate 线程与抽屉新主题同落主力机', async () => {
    const w = await setupWorld();
    await bindChiefWithMachine(w, w.machineAId);
    // orchestrate 入口（缺省链第二级接管）。
    const todoId = await createTodo(w.s, w.projectId);
    const res = await req(w.s.app, 'POST', `/api/todos/${todoId}/orchestrate`, {});
    expect(res.status).toBe(201);
    const body = (await res.json()) as { thread: { id: string } };
    expect(threadPin(w.s, body.thread.id)).toBe(w.machineAId);
    // 抽屉新主题（POST /chief/threads，同一条缺省链）。
    const res2 = await req(w.s.app, 'POST', `/api/teams/${w.s.team.id}/chief/threads`, {
      content: '帮我看看现在的任务',
    });
    expect(res2.status).toBe(201);
    const body2 = (await res2.json()) as { thread: { id: string } };
    expect(threadPin(w.s, body2.thread.id)).toBe(w.machineAId);
  });

  test('失败方式 C：双未设 → 线程 pin null（回归红线：与 main 逐语义等价）', async () => {
    const w = await setupWorld();
    await bindChiefWithMachine(w, null);
    const todoId = await createTodo(w.s, w.projectId);
    const res = await req(w.s.app, 'POST', `/api/todos/${todoId}/orchestrate`, {});
    expect(res.status).toBe(201);
    const body = (await res.json()) as { thread: { id: string } };
    expect(threadPin(w.s, body.thread.id)).toBeNull();
  });

  test('失败方式 D：既有线程不回写——主力机后设，旧未钉线程续消息 pin 仍 null', async () => {
    const w = await setupWorld();
    await bindChiefWithMachine(w, null);
    const first = await req(w.s.app, 'POST', `/api/teams/${w.s.team.id}/chief/threads`, {
      content: '第一轮',
    });
    const { thread } = (await first.json()) as { thread: { id: string } };
    // 主力机中途落下（PATCH 写面）——既有线程不被重钉（N7：中途换机丢会话
    // 上下文，creation-time 语义保持）。
    const patch = await req(w.s.app, 'PATCH', `/api/teams/${w.s.team.id}/chief`, {
      machineId: w.machineAId,
    });
    expect(patch.status).toBe(200);
    const second = await req(w.s.app, 'POST', `/api/conversations/${thread.id}/messages`, {
      content: '第二轮',
    });
    expect(second.status).toBe(201);
    expect(threadPin(w.s, thread.id)).toBeNull();
  });
});

describe('#895 PATCH /chief machineId 槽（spec 21 A7）', () => {
  async function patchMachine(
    w: World,
    body: Record<string, unknown>,
  ): Promise<{ status: number; json: () => Promise<unknown> }> {
    return req(w.s.app, 'PATCH', `/api/teams/${w.s.team.id}/chief`, body);
  }

  function envelopeMachineId(res: unknown): string | null {
    const body = res as { chief: { machineId: string | null } };
    return body.chief.machineId;
  }

  test('失败方式 E：界外机器 400（todos 同律）；合法 id 落库并经封套透出', async () => {
    const w = await setupWorld();
    const bad = await patchMachine(w, { machineId: 'machine-not-in-team' });
    expect(bad.status).toBe(400);

    const ok = await patchMachine(w, { machineId: w.machineAId });
    expect(ok.status).toBe(200);
    expect(envelopeMachineId(await ok.json())).toBe(w.machineAId);
  });

  test('失败方式 F：null 清回自动；undefined 不动（charter PATCH 不碰 machineId）', async () => {
    const w = await setupWorld();
    await patchMachine(w, { machineId: w.machineAId });
    const cleared = await patchMachine(w, { machineId: null });
    expect(cleared.status).toBe(200);
    expect(envelopeMachineId(await cleared.json())).toBeNull();

    // 重设后走「槽缺席」路径：PATCH charter 不带 machineId → 值不动。
    await patchMachine(w, { machineId: w.machineBId });
    const untouched = await patchMachine(w, { charter: '优先本机执行。' });
    expect(untouched.status).toBe(200);
    expect(envelopeMachineId(await untouched.json())).toBe(w.machineBId);
  });
});

describe('#895 GET /chief orchestration 封套（spec 21 A5）', () => {
  interface OrchestrationBlock {
    orchestration: {
      defaultMachineId: string | null;
      activity: { machineId: string; running: number; waiting: number }[];
    };
  }

  async function getEnvelope(w: World): Promise<OrchestrationBlock> {
    const res = await req(w.s.app, 'GET', `/api/teams/${w.s.team.id}/chief`);
    expect(res.status).toBe(200);
    return (await res.json()) as OrchestrationBlock;
  }

  /** 改写 POST 已入队的 chief 步（封套计数的事实源——每线程恰好一步，不
   *  另插行以免重复计数）。 */
  function setChiefStep(
    s: TestServer,
    threadId: string,
    opts: { status: 'claimed' | 'pending'; machineId?: string | null },
  ): void {
    const row = s.db.select().from(stepTable).where(eq(stepTable.buildId, threadId)).get()!;
    s.db
      .update(stepTable)
      .set({ status: opts.status, machineId: opts.machineId ?? null })
      .where(eq(stepTable.id, row.id))
      .run();
  }

  test('失败方式 G：投影——defaultMachineId + running（claimed）/ waiting（pending 被钉且不可执行）计数', async () => {
    const w = await setupWorld();
    await req(w.s.app, 'PATCH', `/api/teams/${w.s.team.id}/chief`, {
      agent: { agentId: AGENT_ID, thinkingLevel: null },
      machineId: w.machineAId,
    });
    // running：A 上一个 claimed chief 步。
    const t1 = await req(w.s.app, 'POST', `/api/teams/${w.s.team.id}/chief/threads`, {
      content: '回合一',
    });
    const thread1 = ((await t1.json()) as { thread: { id: string } }).thread.id;
    setChiefStep(w.s, thread1, { status: 'claimed', machineId: w.machineAId });
    // waiting：线程钉 B（pending）且 B 离线（enroll 不置在线）。
    const t2 = await req(w.s.app, 'POST', `/api/teams/${w.s.team.id}/chief/threads`, {
      content: '回合二',
    });
    const thread2 = ((await t2.json()) as { thread: { id: string } }).thread.id;
    w.s.db
      .update(chiefThreadTable)
      .set({ pinnedMachineId: w.machineBId })
      .where(eq(chiefThreadTable.id, thread2))
      .run();

    const body = await getEnvelope(w);
    expect(body.orchestration.defaultMachineId).toBe(w.machineAId);
    const activityA = body.orchestration.activity.find((a) => a.machineId === w.machineAId);
    const activityB = body.orchestration.activity.find((a) => a.machineId === w.machineBId);
    expect(activityA?.running).toBe(1);
    expect(activityB?.waiting).toBe(1);
  });

  test('失败方式 H：waiting 判据——机器在线但 runtime 闸关也计入（T3 缝隙可见性）', async () => {
    const w = await setupWorld();
    await req(w.s.app, 'PATCH', `/api/teams/${w.s.team.id}/chief`, {
      agent: { agentId: AGENT_ID, thinkingLevel: null },
    });
    // B 在线但只开 claude-code；chief 绑定 agent = stub-gw → pi 档。
    await req(w.s.app, 'PATCH', `/api/machines/${w.machineBId}`, {
      enabledRuntimes: ['claude-code'],
    });
    w.s.db
      .update(machineTable)
      .set({ online: true })
      .where(eq(machineTable.id, w.machineBId))
      .run();
    const t = await req(w.s.app, 'POST', `/api/teams/${w.s.team.id}/chief/threads`, {
      content: '回合',
    });
    const threadId = ((await t.json()) as { thread: { id: string } }).thread.id;
    w.s.db
      .update(chiefThreadTable)
      .set({ pinnedMachineId: w.machineBId })
      .where(eq(chiefThreadTable.id, threadId))
      .run();

    const body = await getEnvelope(w);
    const activityB = body.orchestration.activity.find((a) => a.machineId === w.machineBId);
    expect(activityB?.waiting).toBe(1);
  });

  test('回归红线：未设主力机 + 无 chief 步 → defaultMachineId null + activity 空', async () => {
    const w = await setupWorld();
    const body = await getEnvelope(w);
    expect(body.orchestration.defaultMachineId).toBeNull();
    expect(body.orchestration.activity).toEqual([]);
  });
});

describe('#682 0022 回填（存量 [] 机器行 → [pi]）', () => {
  function readJournal(folder: string): { entries: { idx: number; tag: string }[] } {
    return JSON.parse(readFileSync(join(folder, 'meta', '_journal.json'), 'utf8'));
  }

  /** 定位含 machine.enabledRuntimes 回填 UPDATE 的 migration（不写死序号，
   * 撞号纪律同 agent-tool-backfill.test.ts）。 */
  function pinMigrationIdx(): number {
    const journal = readJournal(MIGRATIONS_FOLDER);
    const idx = journal.entries.findIndex((entry) =>
      /UPDATE `machine` SET `enabledRuntimes`/i.test(
        readFileSync(join(MIGRATIONS_FOLDER, `${entry.tag}.sql`), 'utf8'),
      ),
    );
    expect(idx, 'journal 里找不到 enabledRuntimes 回填 migration').toBeGreaterThan(0);
    return idx;
  }

  function prePinMigrations(): string {
    const journal = readJournal(MIGRATIONS_FOLDER);
    const cut = pinMigrationIdx();
    const dir = temp('pacman-migrations-pre-pin-');
    mkdirSync(join(dir, 'meta'));
    for (const entry of journal.entries.slice(0, cut)) {
      cpSync(join(MIGRATIONS_FOLDER, `${entry.tag}.sql`), join(dir, `${entry.tag}.sql`));
      const snapshot = join(MIGRATIONS_FOLDER, 'meta', `${entry.tag}_snapshot.json`);
      try {
        cpSync(snapshot, join(dir, 'meta', `${entry.tag}_snapshot.json`));
      } catch {
        /* snapshot 缺位先例（agent-tool-backfill 同律） */
      }
    }
    const full = readJournal(MIGRATIONS_FOLDER);
    writeFileSync(
      join(dir, 'meta', '_journal.json'),
      JSON.stringify({ ...full, entries: full.entries.slice(0, cut) }, null, 2),
    );
    return dir;
  }

  function buildPrePinDb(): string {
    const dir = temp('pacman-pin-db-');
    const dbPath = join(dir, 'server.db');
    const sqlite = new Database(dbPath);
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: prePinMigrations() });
    const { team } = seed(db);
    const insert = sqlite.prepare(
      'INSERT INTO machine (id, teamId, name, enabledRuntimes) VALUES (?, ?, ?, ?)',
    );
    insert.run('m-legacy-off', team.id, 'legacy-off', '[]');
    insert.run('m-legacy-cc', team.id, 'legacy-cc', '["claude-code"]');
    sqlite.close();
    return dbPath;
  }

  function readRuntimes(dbPath: string, id: string): string[] {
    const sqlite = new Database(dbPath, { readonly: true });
    const row = sqlite.prepare('SELECT enabledRuntimes FROM machine WHERE id = ?').get(id) as {
      enabledRuntimes: string;
    };
    sqlite.close();
    return JSON.parse(row.enabledRuntimes);
  }

  test('失败方式 8：升级前旧库 → 补跑全量 migration：[] 行回填 [pi]，已开 claude-code 行不动', () => {
    const dbPath = buildPrePinDb();
    const sqlite = new Database(dbPath);
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    sqlite.close();
    expect(readRuntimes(dbPath, 'm-legacy-off')).toEqual(['pi']);
    expect(readRuntimes(dbPath, 'm-legacy-cc')).toEqual(['claude-code']);
  });

  test('回填 UPDATE 幂等（防御性重放不重复；ALTER 段不在重放面）', () => {
    const dbPath = buildPrePinDb();
    const entry = readJournal(MIGRATIONS_FOLDER).entries[pinMigrationIdx()]!;
    const sql = readFileSync(join(MIGRATIONS_FOLDER, `${entry.tag}.sql`), 'utf8');
    // 幂等面只覆盖回填 UPDATE（ALTER 段双跑必然 duplicate column——迁移框架
    // 用 journal 保证单跑，重放防护只需数据语句自身幂等，0018 同律）。
    const updateStmt = sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .find((s) => /^UPDATE `machine`/i.test(s))!;
    const sqlite = new Database(dbPath);
    sqlite.exec(updateStmt);
    sqlite.exec(updateStmt);
    sqlite.close();
    expect(readRuntimes(dbPath, 'm-legacy-off')).toEqual(['pi']);
  });
});
