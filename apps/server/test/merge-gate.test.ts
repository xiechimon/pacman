// requestMerge 双开关闸（XMON-88，XMON-26 方案 a）：merge 步执行 Agent
// （todo.assignment.build 槽，解析口径同 machines.ts agentForStep——合并轮
// 复用执行轮会话）须已开「合并分支」「推送分支」两授权，任一关 = 403 拒。
//
// 失败方式清单（先于实现固化，代码是让这些场景通过的手段）：
// 1. 四组合漏判——该拒不拒（关着的开关放行入队）或该放不放（双开仍 403）。
// 2. 拒后留痕——merge 步已入队或 MERGE_ANNOUNCEMENT 行已落库（半合并态：
//    时间线宣称「发起了合并」但步无人可执行）。
// 3. 文案失明——403 文案不点名缺失授权项（用户与 chief 转述面无从知道去
//    开哪个开关）。
// 4. 未指派误伤——build 槽空时 403（未指派语义归 claim 面：merge 步本就
//    不可认领，不归本闸管）。
// 5. 403 出线丢失——HttpError 未按 status 出线（REST 面变 500 / 形状非
//    {error} 单形状）。

import { type BuildRecord, MERGE_ANNOUNCEMENT, todoRecordSchema } from '@pacman/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { agent as agentTable, message as messageTable } from '../src/db/schema.js';
import { completeStep, listSteps } from '../src/services/builds.js';
import { setTodoPhase } from '../src/services/todos.js';
import { bootServer, postProject, req, type TestServer } from './helpers.js';

const AGENT_ID = 'agent-merge-gate';

/** 建到 review 关口的 fixture：todo + build 槽指派（insertTools undefined =
 * 槽指派但 Agent 行不存在——悬空引用形；slotAgentId null = 不指派）+ 直执行
 * 一轮到 review（02 §4.2 主时序，机器面归 M3——同 schedules.test.ts
 * runToReview 推进法）。 */
async function fixtureAtReview(
  slotAgentId: string | null,
  insertTools?: string[],
): Promise<TestServer & { projectId: string; todoId: string; buildId: string }> {
  const s = bootServer();
  const projectId = await postProject(s.app);
  const todoDoc = todoRecordSchema.parse(
    await (
      await req(s.app, 'POST', `/api/projects/${projectId}/todos`, { title: '合并闸', spec: '' })
    ).json(),
  );
  if (insertTools !== undefined) {
    s.db
      .insert(agentTable)
      .values({
        id: AGENT_ID,
        teamId: s.team.id,
        displayName: '小林',
        modelId: 'm',
        tools: insertTools,
      })
      .run();
  }
  const started = (await (
    await req(s.app, 'POST', `/api/projects/${projectId}/builds`, {
      todoIds: [todoDoc.id],
      assignment: { plan: null, build: slotAgentId === null ? null : { agentId: slotAgentId } },
      withPlan: false,
    })
  ).json()) as { builds: BuildRecord[] };
  const buildId = started.builds[0]?.id as string;
  setTodoPhase(s.svc, todoDoc.id, 'building');
  completeStep(s.svc, listSteps(s.svc, buildId)[0]?.id as string); // 执行步成 → review
  return { ...s, projectId, todoId: todoDoc.id, buildId };
}

/** 该 build 已入队的 merge 步（拒时必须为 0——入队点唯一 = requestMerge）。 */
function mergeSteps(s: TestServer, buildId: string) {
  return listSteps(s.svc, buildId).filter((st) => st.kind === 'merge');
}

/** 时间线是否已落「发起了合并」宣告行（拒时必须无——拒不宣称发起）。 */
function announced(s: TestServer, buildId: string): boolean {
  return s.db
    .select()
    .from(messageTable)
    .where(eq(messageTable.conversationId, buildId))
    .all()
    .some((row) => row.content === MERGE_ANNOUNCEMENT);
}

async function todoPhase(s: TestServer, todoId: string) {
  return todoRecordSchema.parse(await (await req(s.app, 'GET', `/api/todos/${todoId}`)).json())
    .phase;
}

describe('requestMerge 双开关闸（XMON-88）', () => {
  test('合/推双开 → 202 放行：入队 merge 步 + 落宣告行（现状不变）', async () => {
    const f = await fixtureAtReview(AGENT_ID, ['合并分支', '推送分支']);
    const res = await req(f.app, 'POST', `/api/builds/${f.buildId}/merge`);
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ delegated: true });
    expect(mergeSteps(f, f.buildId)).toHaveLength(1);
    expect(announced(f, f.buildId)).toBe(true);
    f.dispose();
  });

  test('合开/推关 → 403 点名「推送分支」；无 merge 步、无宣告行、phase 留 review', async () => {
    const f = await fixtureAtReview(AGENT_ID, ['合并分支']);
    const res = await req(f.app, 'POST', `/api/builds/${f.buildId}/merge`);
    expect(res.status).toBe(403);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(['error']); // {error} 单形状（04 §3）
    expect(String(body.error)).toContain('「推送分支」');
    expect(String(body.error)).not.toContain('「合并分支」');
    expect(mergeSteps(f, f.buildId)).toHaveLength(0);
    expect(announced(f, f.buildId)).toBe(false);
    expect(await todoPhase(f, f.todoId)).toBe('review');
    f.dispose();
  });

  test('合关/推开 → 403 点名「合并分支」；无步、无宣告行、phase 留 review', async () => {
    const f = await fixtureAtReview(AGENT_ID, ['推送分支']);
    const res = await req(f.app, 'POST', `/api/builds/${f.buildId}/merge`);
    expect(res.status).toBe(403);
    const body = (await res.json()) as Record<string, unknown>;
    expect(String(body.error)).toContain('「合并分支」');
    expect(String(body.error)).not.toContain('「推送分支」');
    expect(mergeSteps(f, f.buildId)).toHaveLength(0);
    expect(announced(f, f.buildId)).toBe(false);
    expect(await todoPhase(f, f.todoId)).toBe('review');
    f.dispose();
  });

  test('合/推双关 → 403 并报两项；无步、无宣告行、phase 留 review', async () => {
    const f = await fixtureAtReview(AGENT_ID, []);
    const res = await req(f.app, 'POST', `/api/builds/${f.buildId}/merge`);
    expect(res.status).toBe(403);
    const body = (await res.json()) as Record<string, unknown>;
    expect(String(body.error)).toContain('「合并分支」');
    expect(String(body.error)).toContain('「推送分支」');
    expect(mergeSteps(f, f.buildId)).toHaveLength(0);
    expect(announced(f, f.buildId)).toBe(false);
    expect(await todoPhase(f, f.todoId)).toBe('review');
    f.dispose();
  });

  test('build 槽未指派 → 放行不查（未指派语义归 claim 面，非本闸职责）', async () => {
    const f = await fixtureAtReview(null);
    const res = await req(f.app, 'POST', `/api/builds/${f.buildId}/merge`);
    expect(res.status).toBe(202);
    expect(mergeSteps(f, f.buildId)).toHaveLength(1);
    f.dispose();
  });

  test('槽指向不存在的 Agent 行 → 放行不查（悬空引用同未指派形；agent 删除面摘槽为正路）', async () => {
    const f = await fixtureAtReview(AGENT_ID); // 槽指派、Agent 行不插
    const res = await req(f.app, 'POST', `/api/builds/${f.buildId}/merge`);
    expect(res.status).toBe(202);
    expect(mergeSteps(f, f.buildId)).toHaveLength(1);
    f.dispose();
  });
});
