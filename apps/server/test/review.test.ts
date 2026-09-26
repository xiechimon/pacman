// AI 审核发起写面（M7 #312，r8 §3.1）：POST /api/builds/{id}/steps
// {action:"review", agentId, focus?} = 入队审核步（kind:review）+ 时间线插
// REVIEW_ANNOUNCEMENT + 接受机 agent 上下文 + phase 留 confirm/review。
// 失败方式枚举先于实现固化（AGENTS.md 测试规则 3）：
//   1. confirm/review 之外相位 → 409 不静默（沿用 chief 门规则）
//   2. 缺 agentId → 400 (zod body schema)；空 focus 允许（可选）
//   3. happy path：审核步 kind:review + REVIEW_ANNOUNCEMENT message +
//      phase 不变
//   4. 终态闭环：claim + done(success) review 步 → REVIEW_COMPLETE_PLACEHOLDER
//      message 落地（步完成占位，#326 真 findings 上线前占位）

import {
  claimedStepSchema,
  MERGE_ANNOUNCEMENT,
  REVIEW_ANNOUNCEMENT,
  REVIEW_COMPLETE_PLACEHOLDER,
} from '@pacman/shared';
import { eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import { beforeEach, describe, expect, test } from 'vitest';
import {
  agent as agentTable,
  build as buildTable,
  message as messageTable,
  plan as planTable,
  provider as providerTable,
  step as stepTable,
  todo as todoTable,
} from '../src/db/schema.js';
import type { TestServer } from './helpers.js';
import { bootServer, issueApiKey, postProject, req } from './helpers.js';

const AGENT_ID = 'agent-review-1';
const REVIEW_AGENT_ID = 'agent-reviewer-1';
const PLAN_FILE_NAME = 'plan.md';

async function call(
  app: Hono,
  method: string,
  path: string,
  opts: { cred?: string; body?: unknown; text?: string; contentType?: string } = {},
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (opts.cred) headers.authorization = `Bearer ${opts.cred}`;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.contentType !== undefined) headers['content-type'] = opts.contentType;
  return Promise.resolve(
    app.request(path, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : opts.text,
    }),
  );
}

interface World {
  s: TestServer;
  todoId: string;
  machineToken: string;
  startBuild(withPlan?: boolean): Promise<string>;
  claim(): Promise<{ stepId: string; kind: string }>;
  done(stepId: string, body: Record<string, unknown>): Promise<void>;
  uploadPlan(stepId: string, content: string): Promise<void>;
  confirm(buildId: string): Promise<void>;
  startReview(buildId: string, body?: { agentId: string; focus?: string }): Promise<Response>;
  todoRow(): ReturnType<typeof loadTodoRow>;
  buildRow(buildId: string): ReturnType<typeof loadBuildRow>;
  stepsOf(buildId: string): ReturnType<typeof loadStepsOf>;
  messagesOf(buildId: string): ReturnType<typeof loadMessagesOf>;
  planContent(buildId: string): ReturnType<typeof loadPlanContent>;
}

function loadTodoRow(s: TestServer, todoId: string) {
  return s.db.select().from(todoTable).where(eq(todoTable.id, todoId)).get()!;
}
function loadBuildRow(s: TestServer, buildId: string) {
  return s.db.select().from(buildTable).where(eq(buildTable.id, buildId)).get()!;
}
function loadStepsOf(s: TestServer, buildId: string) {
  return s.db.select().from(stepTable).where(eq(stepTable.buildId, buildId)).all();
}
function loadMessagesOf(s: TestServer, buildId: string) {
  return s.db.select().from(messageTable).where(eq(messageTable.conversationId, buildId)).all();
}
function loadPlanContent(s: TestServer, buildId: string) {
  return s.db.select().from(planTable).where(eq(planTable.buildId, buildId)).all();
}

async function setupWorld(): Promise<World> {
  const s = bootServer({ claimHoldMs: 200, pingIntervalMs: 3_600_000 });
  const key = await issueApiKey(s);
  s.db
    .insert(providerTable)
    .values({
      id: 'prov-review',
      teamId: s.team.id,
      kind: 'custom',
      providerId: 'stub-gw',
      label: 'Stub Gateway',
      baseUrl: 'http://127.0.0.1:9/v1',
      api: 'openai-completions',
      authHeader: true,
      compat: { supportsDeveloperRole: false },
      models: [{ id: 'stub-model', name: 'stub-model' }],
      createdBy: s.user.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    .run();
  // 双 agent：plan/build 用 stub-builder；review agent 是被评审方。
  s.db
    .insert(agentTable)
    .values({
      id: AGENT_ID,
      teamId: s.team.id,
      displayName: 'stub-builder',
      provider: 'stub-gw',
      modelId: 'stub-model',
    })
    .run();
  s.db
    .insert(agentTable)
    .values({
      id: REVIEW_AGENT_ID,
      teamId: s.team.id,
      displayName: 'stub-reviewer',
      provider: 'stub-gw',
      modelId: 'stub-model',
    })
    .run();
  const enrollRes = await call(s.app, 'POST', '/api/machine/enroll', {
    cred: key,
    body: { teamId: s.team.id, name: 'review-mbp', cliVersion: '0.1.0' },
  });
  expect(enrollRes.status).toBe(200);
  const { token: machineToken } = (await enrollRes.json()) as { token: string; machineId: string };
  const projectId = await postProject(s.app);
  const todoRes = await call(s.app, 'POST', `/api/projects/${projectId}/todos`, {
    body: { title: '审核探针', spec: '实现一段示例代码供审核' },
  });
  const { id: todoId } = (await todoRes.json()) as { id: string };

  async function startBuild(withPlan = true): Promise<string> {
    const res = await call(s.app, 'POST', `/api/projects/${projectId}/builds`, {
      body: {
        todoIds: [todoId],
        assignment: { plan: { agentId: AGENT_ID }, build: { agentId: AGENT_ID } },
        withPlan,
      },
    });
    expect(res.status).toBe(201);
    return ((await res.json()) as { builds: { id: string }[] }).builds[0]!.id;
  }
  async function claim() {
    const res = await call(s.app, 'POST', '/api/machine/tasks/claim', {
      cred: machineToken,
      body: {},
    });
    const body = (await res.json()) as { step: unknown };
    if (!body.step) throw new Error('claim returned no step');
    const parsed = claimedStepSchema.parse(body.step);
    return { stepId: parsed.step.id, kind: parsed.step.kind };
  }
  async function done(stepId: string, body: Record<string, unknown>): Promise<void> {
    const res = await call(s.app, 'POST', `/api/machine/done/${stepId}`, {
      cred: machineToken,
      body,
    });
    expect(res.status).toBe(200);
  }
  async function uploadPlan(stepId: string, content: string): Promise<void> {
    const urlsRes = await call(s.app, 'POST', `/api/machine/upload-urls/${stepId}`, {
      cred: machineToken,
      body: { files: [{ name: PLAN_FILE_NAME }] },
    });
    const urls = (await urlsRes.json()) as { uploads: { url: string }[] };
    const up = urls.uploads[0]!;
    const put = await call(s.app, 'PUT', up.url.replace(/^https?:\/\/[^/]+/, ''), {
      cred: machineToken,
      text: content,
      contentType: 'text/markdown',
    });
    expect(put.status).toBe(200);
  }
  async function confirm(buildId: string): Promise<void> {
    const res = await call(s.app, 'POST', `/api/builds/${buildId}/steps`, {
      body: { action: 'confirm' },
    });
    expect(res.status).toBe(202);
  }
  async function startReview(
    buildId: string,
    body: { agentId: string; focus?: string } = { agentId: REVIEW_AGENT_ID },
  ): Promise<Response> {
    return call(s.app, 'POST', `/api/builds/${buildId}/steps`, {
      body: { action: 'review', ...body },
    });
  }

  return {
    s,
    todoId,
    machineToken,
    startBuild,
    claim,
    done,
    uploadPlan,
    confirm,
    startReview,
    todoRow: () => loadTodoRow(s, todoId),
    buildRow: (buildId: string) => loadBuildRow(s, buildId),
    stepsOf: (buildId: string) => loadStepsOf(s, buildId),
    messagesOf: (buildId: string) => loadMessagesOf(s, buildId),
    planContent: (buildId: string) => loadPlanContent(s, buildId),
  };
}

describe('AI 审核发起写面（M7 #312）', () => {
  let w: World;
  beforeEach(async () => {
    w = await setupWorld();
  });

  test('失败方式 1：planning 态 → 409 不静默', async () => {
    const buildId = await w.startBuild(true);
    const claimed = await w.claim();
    expect(claimed.kind).toBe('plan');
    const res = await w.startReview(buildId);
    expect(res.status).toBe(409);
    expect(w.stepsOf(buildId).find((s) => s.kind === 'review')).toBeUndefined();
  });

  test('失败方式 2：缺 agentId → 400 (zod body schema)', async () => {
    const buildId = await w.startBuild(true);
    const planClaimed = await w.claim();
    await w.uploadPlan(planClaimed.stepId, '# plan v1');
    await w.done(planClaimed.stepId, { status: 'success' });
    // 推到 confirm phase（plan done(success) 后自然进 confirm，confirm(buildId)
    // 会再推到 building——所以这里不调 confirm）。
    expect(w.todoRow().phase).toBe('confirm');
    const res = await req(w.s.app, 'POST', `/api/builds/${buildId}/steps`, {
      body: { action: 'review', focus: '看看安全' },
    });
    expect(res.status).toBe(400);
  });

  test('happy path：confirm 态发起审核 → review 步入队 + REVIEW_ANNOUNCEMENT + phase 留 confirm', async () => {
    const buildId = await w.startBuild(true);
    const planClaimed = await w.claim();
    await w.uploadPlan(planClaimed.stepId, '# plan v1');
    await w.done(planClaimed.stepId, { status: 'success' });
    expect(w.todoRow().phase).toBe('confirm');

    const res = await w.startReview(buildId, {
      agentId: REVIEW_AGENT_ID,
      focus: '关注边界情况',
    });
    expect(res.status).toBe(202);

    const steps = w.stepsOf(buildId);
    const reviewStep = steps.find((s) => s.kind === 'review');
    expect(reviewStep).toBeDefined();
    expect(reviewStep?.status).toBe('pending');
    // step 表无 agentId 列（review 步的 agentId 经 prompt 透出 + claim 载荷传
    // 机器；DB 不冗余）。本测试只钉审核步 kind/status + prompt 携带用户关注点。
    expect(reviewStep?.prompt ?? '').toContain('用户关注点：关注边界情况');

    // 时间线插 REVIEW_ANNOUNCEMENT（r8 §3.1 双端单源）
    const messages = w.messagesOf(buildId);
    const announcement = messages.find(
      (m) => m.role === 'user' && m.content === REVIEW_ANNOUNCEMENT,
    );
    expect(announcement).toBeDefined();

    // phase 留 confirm（review 步是额外 agent 步，不推进主时序）
    expect(w.todoRow().phase).toBe('confirm');
    // build 表无 hasChanges 列（hasChanges 是 todo 表字段，02 §4.2）；用 todo
    // 表 hasChanges 钉「审核不计入用户变更」语义。
    expect(w.todoRow().hasChanges).toBe(false);
  });

  test('happy path：空 focus 允许（可选 textarea 可空）', async () => {
    const buildId = await w.startBuild(true);
    const planClaimed = await w.claim();
    await w.uploadPlan(planClaimed.stepId, '# plan v1');
    await w.done(planClaimed.stepId, { status: 'success' });
    expect(w.todoRow().phase).toBe('confirm');
    const res = await w.startReview(buildId, { agentId: REVIEW_AGENT_ID, focus: '' });
    expect(res.status).toBe(202);
    expect(w.stepsOf(buildId).find((s) => s.kind === 'review')).toBeDefined();
  });

  test('happy path：review phase 态也能再发起一次审核', async () => {
    // 推进到 review phase：先建带 plan 的 build → plan done(success) → confirm
    // action = confirm → phase 推到 building + 入队 build 步 → claim +
    // done(success) → phase = 'review'。
    const buildId = await w.startBuild(true);
    const planClaimed = await w.claim();
    await w.uploadPlan(planClaimed.stepId, '# plan v1');
    await w.done(planClaimed.stepId, { status: 'success' });
    await w.confirm(buildId);
    expect(w.todoRow().phase).toBe('building');
    const buildClaimed = await w.claim();
    expect(buildClaimed.kind).toBe('build');
    await w.done(buildClaimed.stepId, { status: 'success' });
    expect(w.todoRow().phase).toBe('review');
    const res = await w.startReview(buildId, { agentId: REVIEW_AGENT_ID });
    expect(res.status).toBe(202);
    expect(w.stepsOf(buildId).filter((s) => s.kind === 'review')).toHaveLength(1);
  });

  test('终态闭环：review 步 done(success) → REVIEW_COMPLETE_PLACEHOLDER 消息落地 + phase 不动', async () => {
    const buildId = await w.startBuild(true);
    const planClaimed = await w.claim();
    await w.uploadPlan(planClaimed.stepId, '# plan v1');
    await w.done(planClaimed.stepId, { status: 'success' });
    expect(w.todoRow().phase).toBe('confirm');
    await w.startReview(buildId, { agentId: REVIEW_AGENT_ID });
    expect(w.todoRow().phase).toBe('confirm');

    // claim review 步 → done(success)
    const reviewClaimed = await w.claim();
    expect(reviewClaimed.kind).toBe('review');
    expect(reviewClaimed.stepId).not.toBe('');
    await w.done(reviewClaimed.stepId, { status: 'success' });

    const messages = w.messagesOf(buildId);
    const placeholder = messages.find(
      (m) => m.role === 'system' && m.content === REVIEW_COMPLETE_PLACEHOLDER,
    );
    expect(placeholder).toBeDefined();
    // phase 仍 confirm（review 步完成 → 占位 ack；主时序在用户手动 confirm 后才推进）
    expect(w.todoRow().phase).toBe('confirm');
    // 审核步状态落 done（step status enum = pending|claimed|done|failed|stopped）
    const reviewStep = w.stepsOf(buildId).find((s) => s.kind === 'review');
    expect(reviewStep?.status).toBe('done');
    // 跟 merge_announcement 路径无交叉（不是合并）
    expect(messages.some((m) => m.content === MERGE_ANNOUNCEMENT)).toBe(false);
  });
});
