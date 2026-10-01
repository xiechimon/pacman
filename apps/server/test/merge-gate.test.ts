// 合并权限闸（XMON-26 a 语义）：requestMerge 单点双开关闸——「合并分支」与
// 「推送分支」任一缺 → 403 拒（关 = 拒 merge 步；plan/build 步自动推不受影响，
// 闸后于 phase 关口、先于时间线行——拒时不落「发起了合并」、不入队 merge 步）。
// 边界：build 槽未指派 = 放行不查（无 Agent 可查；merge 步本就不可认领，
// machines.ts agentForStep 同口径）。执行者解析 = build 槽（merge 步归 build 槽）。

import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, test } from 'vitest';
import {
  agent as agentTable,
  message as messageTable,
  todo as todoTable,
} from '../src/db/schema.js';
import { completeStep, listSteps } from '../src/services/builds.js';
import { setTodoPhase } from '../src/services/todos.js';
import { bootServer, postProject, req, type TestServer } from './helpers.js';

const AGENT_ID = 'agent-gate';
const BOTH = ['合并分支', '推送分支'];

const servers: TestServer[] = [];
function boot(): TestServer {
  const s = bootServer();
  servers.push(s);
  return s;
}
afterEach(() => {
  while (servers.length > 0) servers.pop()?.dispose();
});

/** tools = null → 不建 Agent、assignment 双槽空（未指派边界）；否则建带
 * 指定 tools 的 Agent 并挂 build 槽。世界推进到 review（merge 关口就绪）。 */
async function world(tools: string[] | null) {
  const s = boot();
  const projectId = await postProject(s.app, 'gate-proj');
  const todoDoc = (await (
    await req(s.app, 'POST', `/api/projects/${projectId}/todos`, { title: 'gate', spec: '' })
  ).json()) as { id: string };
  let assignment: { plan: null; build: { agentId: string } | null } = { plan: null, build: null };
  if (tools !== null) {
    s.db
      .insert(agentTable)
      .values({
        id: AGENT_ID,
        teamId: s.team.id,
        displayName: 'gate-builder',
        description: null,
        status: 'active',
        avatarUrl: null,
        provider: null,
        modelId: null,
        thinkingLevel: null,
        tools,
        secrets: [],
        skills: [],
        mcpServers: [],
      })
      .run();
    assignment = { plan: null, build: { agentId: AGENT_ID } };
  }
  const buildsBody = (await (
    await req(s.app, 'POST', `/api/projects/${projectId}/builds`, {
      todoIds: [todoDoc.id],
      assignment,
      withPlan: false,
    })
  ).json()) as { builds: { id: string }[] };
  const buildId = buildsBody.builds[0]!.id;
  // 直执行一轮到 review（schedules.test runToReview 同款推进）。
  setTodoPhase(s.svc, todoDoc.id, 'building');
  completeStep(s.svc, listSteps(s.svc, buildId)[0]!.id);
  return { s, buildId, todoId: todoDoc.id };
}

function mergeStepsOf(w: Awaited<ReturnType<typeof world>>) {
  return listSteps(w.s.svc, w.buildId).filter((r) => r.kind === 'merge');
}

function announcementsOf(w: Awaited<ReturnType<typeof world>>) {
  return w.s.db
    .select()
    .from(messageTable)
    .where(eq(messageTable.conversationId, w.buildId))
    .all()
    .filter((m) => m.content === '发起了合并');
}

function phaseOf(w: Awaited<ReturnType<typeof world>>) {
  return w.s.db.select().from(todoTable).where(eq(todoTable.id, w.todoId)).get()!.phase;
}

async function expectRefused(w: Awaited<ReturnType<typeof world>>, missing: string[]) {
  const res = await req(w.s.app, 'POST', `/api/builds/${w.buildId}/merge`);
  expect(res.status).toBe(403);
  const body = (await res.json()) as { error: string };
  expect(Object.keys(body)).toEqual(['error']); // 错误形状 {error}（wire 单形状）
  for (const name of missing) expect(body.error).toContain(name);
  // 拒 = 零副作用：不入队、不落时间线行、phase 停在 review 关口。
  expect(mergeStepsOf(w)).toHaveLength(0);
  expect(announcementsOf(w)).toHaveLength(0);
  expect(phaseOf(w)).toBe('review');
}

describe('POST /api/builds/:id/merge 权限闸（XMON-26 四组合）', () => {
  test('合并分支+推送分支都开 → 202 delegated + merge 步入队 + 时间线行', async () => {
    const w = await world(BOTH);
    const res = await req(w.s.app, 'POST', `/api/builds/${w.buildId}/merge`);
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ delegated: true });
    expect(mergeStepsOf(w)).toHaveLength(1);
    expect(announcementsOf(w)).toHaveLength(1);
  });

  test('缺「推送分支」→ 403 拒，零副作用', async () => {
    const w = await world(['合并分支']);
    await expectRefused(w, ['推送分支']);
  });

  test('缺「合并分支」→ 403 拒，零副作用', async () => {
    const w = await world(['推送分支']);
    await expectRefused(w, ['合并分支']);
  });

  test('双关 → 403 拒，文案含两开关名', async () => {
    const w = await world([]);
    await expectRefused(w, BOTH);
  });

  test('build 槽未指派 → 放行不查（现状不变：202 + 入队）', async () => {
    const w = await world(null);
    const res = await req(w.s.app, 'POST', `/api/builds/${w.buildId}/merge`);
    expect(res.status).toBe(202);
    expect(mergeStepsOf(w)).toHaveLength(1);
  });
});
