// #113 plan→build 阶段交接缺口：plan 关未产 plan.md 时 build agent 无任务上下文
// （05 §5 实跑发现：withPlan 链路规划轮可跳过写 plan.md 直接交付，build 轮仅收到
// confirm 关口措辞，拿不到 todo 原始 spec 而反问「哪个方案」）。
// 裁定 = 候选1+2 组合（02 §4.2 注记）：
//  ① plan 步完成校验交接物 —— 缺失则不算成：留 planning + 自动补写一轮（有界：
//     仅首轮规划步触发；补写/驳回重规划等续轮指令步仍无产物 → 放行 confirm，
//     关口决策交还人）。
//  ② build 步 claim 时交接物仍缺失 → 强制 new session：daemon 走 buildTaskPrompt
//     = todo 原始 title+spec，agent 必拿任务内容（不依赖模型配合的确定兜底）。
// 失败方式清单（先固化，代码是让场景通过的手段）：
//  1. plan 步成功但无 plan.md → 直接 confirm（交接物缺失放行 → build 轮空转）；
//  2. 自动补写无界 → 模型持续不写则循环入队烧 token；
//  3. build 步续轮 confirm 措辞无方案可指（spec 兜底缺失 → agent 反问）；
//  4. 正常路径回归：plan.md 在 → confirm + continue session 不变；
//  5. 驳回重规划轮（续轮指令步）未新产 plan.md → 误触发自动补写（界混淆）；
//  6. withPlan=false 直执行面被波及（planDocId 恒 null 误判交接缺失）。

import type { ClaimedStep } from '@pacman/shared';
import { claimedStepSchema, machineUploadUrlsResponseSchema, PLAN_FILE_NAME } from '@pacman/shared';
import { eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import { describe, expect, test } from 'vitest';
import {
  agent as agentTable,
  provider as providerTable,
  step as stepTable,
  todo as todoTable,
} from '../src/db/schema.js';
import { bootServer, issueApiKey, postProject } from './helpers.js';

type TestServer = ReturnType<typeof bootServer>;

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

const AGENT_ID = 'agent-ph-1';

/** machine-wire 同款引导裁剪面：provider/agent + enroll + 项目/todo 就位。 */
async function setupWorld() {
  const s = bootServer({ claimHoldMs: 200 });
  const key = await issueApiKey(s);
  s.db
    .insert(providerTable)
    .values({
      id: 'prov-ph',
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
  s.db
    .insert(agentTable)
    .values({
      id: AGENT_ID,
      teamId: s.team.id,
      displayName: 'ph-builder',
      provider: 'stub-gw',
      modelId: 'stub-model',
    })
    .run();
  const enrollRes = await call(s.app, 'POST', '/api/machine/enroll', {
    cred: key,
    body: { teamId: s.team.id, name: 'ph-mbp', cliVersion: '0.1.0' },
  });
  const { token } = (await enrollRes.json()) as { token: string };
  const projectId = await postProject(s.app);
  const todoRes = await call(s.app, 'POST', `/api/projects/${projectId}/todos`, {
    body: { title: '探针任务', spec: '写一行探针到 README.md' },
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
    const body = (await res.json()) as { builds: { id: string }[] };
    return body.builds[0]!.id;
  }
  async function claim(): Promise<ClaimedStep> {
    const res = await call(s.app, 'POST', '/api/machine/tasks/claim', { cred: token, body: {} });
    const body = (await res.json()) as { step: unknown };
    if (!body.step) throw new Error('claim returned no step');
    return claimedStepSchema.parse(body.step);
  }
  async function done(stepId: string, body: Record<string, unknown>): Promise<void> {
    const res = await call(s.app, 'POST', `/api/machine/done/${stepId}`, { cred: token, body });
    expect(res.status).toBe(200);
  }
  /** plan.md 产物回传（upload-urls 预签名 → PUT 原文，02 §1.3/§4.2 分流）。 */
  async function uploadPlan(stepId: string, content: string): Promise<void> {
    const urlsRes = await call(s.app, 'POST', `/api/machine/upload-urls/${stepId}`, {
      cred: token,
      body: { files: [{ name: PLAN_FILE_NAME }] },
    });
    const urls = machineUploadUrlsResponseSchema.parse(await urlsRes.json());
    const up = urls.uploads[0]!;
    const put = await call(s.app, 'PUT', up.url.replace(/^https?:\/\/[^/]+/, ''), {
      cred: token,
      text: content,
      contentType: 'text/markdown',
    });
    expect(put.status).toBe(200);
  }
  const todoRow = () => s.db.select().from(todoTable).where(eq(todoTable.id, todoId)).get()!;
  const stepsOf = (buildId: string) =>
    s.db.select().from(stepTable).where(eq(stepTable.buildId, buildId)).all();
  return { s, token, projectId, todoId, startBuild, claim, done, uploadPlan, todoRow, stepsOf };
}

type World = Awaited<ReturnType<typeof setupWorld>>;

async function confirm(w: World, buildId: string): Promise<void> {
  const res = await call(w.s.app, 'POST', `/api/builds/${buildId}/steps`, {
    body: { action: 'confirm' },
  });
  expect(res.status).toBe(202);
}

describe('plan 关交接物校验（#113 候选1：plan 即文件 plan.md，02 §4.2）', () => {
  test('plan 步未产 plan.md → 不进 confirm：留 planning + 自动补写步入队（带补写指令）', async () => {
    const w = await setupWorld();
    try {
      const buildId = await w.startBuild(true);
      const planStep = await w.claim();
      expect(planStep.step.kind).toBe('plan');
      expect(planStep.session.action).toBe('new');
      // 复现场景：plan 阶段不写 plan.md 直接交付。
      await w.done(planStep.step.id, { status: 'success', sessionId: 'pi-1' });
      // 不进 confirm：留 planning（交接物缺失 → 规划步不算成）。
      expect(w.todoRow().phase).toBe('planning');
      // 自动补写一轮：新 plan 步 pending + 补写指令 prompt 落库。
      const pending = w
        .stepsOf(buildId)
        .filter((st) => st.kind === 'plan' && st.status === 'pending');
      expect(pending).toHaveLength(1);
      expect(pending[0]!.prompt).toContain(PLAN_FILE_NAME);
      // hasPlan 不置位（无交接物不谎称有方案——看板 plan chip 数据源）。
      expect(w.todoRow().hasPlan).toBe(false);
    } finally {
      w.s.dispose();
    }
  });

  test('补写轮仍无 plan.md → 有界放行 confirm（不再补写第三轮）', async () => {
    const w = await setupWorld();
    try {
      const buildId = await w.startBuild(true);
      const planStep = await w.claim();
      await w.done(planStep.step.id, { status: 'success', sessionId: 'pi-1' });
      // 补写步被领取：续轮同 conv 会话 + claim 载荷 instruction 透出补写指令。
      const rewrite = await w.claim();
      expect(rewrite.step.kind).toBe('plan');
      expect(rewrite.session).toEqual({ action: 'continue', sessionId: 'pi-1' });
      expect(rewrite.instruction).toContain(PLAN_FILE_NAME);
      // 补写轮仍直接交付（无 plan.md）→ 放行 confirm，关口决策交还人。
      await w.done(rewrite.step.id, { status: 'success', sessionId: 'pi-1' });
      expect(w.todoRow().phase).toBe('confirm');
      // 有界：两轮 plan 步封顶，无第三补写步。
      expect(w.stepsOf(buildId).filter((st) => st.kind === 'plan')).toHaveLength(2);
      expect(w.todoRow().hasPlan).toBe(false);
    } finally {
      w.s.dispose();
    }
  });

  test('正常路径不回归：plan.md 产物在 → confirm + hasPlan 置位（无补写步）', async () => {
    const w = await setupWorld();
    try {
      const buildId = await w.startBuild(true);
      const planStep = await w.claim();
      await w.uploadPlan(planStep.step.id, '# 方案\nContext: x');
      await w.done(planStep.step.id, { status: 'success', sessionId: 'pi-1' });
      expect(w.todoRow().phase).toBe('confirm');
      expect(w.todoRow().hasPlan).toBe(true);
      expect(w.stepsOf(buildId).filter((st) => st.kind === 'plan')).toHaveLength(1);
    } finally {
      w.s.dispose();
    }
  });

  test('驳回重规划轮未新产 plan.md → 直接 confirm（自动补写不套续轮指令步）', async () => {
    const w = await setupWorld();
    try {
      const buildId = await w.startBuild(true);
      const planStep = await w.claim();
      await w.uploadPlan(planStep.step.id, '# v1');
      await w.done(planStep.step.id, { status: 'success', sessionId: 'pi-1' });
      expect(w.todoRow().phase).toBe('confirm');
      // 驳回 → 重规划步（prompt 带 feedback 指令 = 续轮指令步）。
      const rev = await call(w.s.app, 'POST', `/api/builds/${buildId}/steps`, {
        body: {
          action: 'revision',
          side: 'plan',
          feedback: '标题去掉项目名后缀',
          clientMessageId: '3f9a0c2e-0000-4000-8000-000000000002',
        },
      });
      expect(rev.status).toBe(202);
      expect(w.todoRow().phase).toBe('planning');
      const replan = await w.claim();
      expect(replan.step.kind).toBe('plan');
      // 重规划轮未新产 plan.md（v1 仍在库）→ 直接 confirm，不触发自动补写。
      await w.done(replan.step.id, { status: 'success', sessionId: 'pi-1' });
      expect(w.todoRow().phase).toBe('confirm');
      expect(w.stepsOf(buildId).filter((st) => st.kind === 'plan')).toHaveLength(2);
    } finally {
      w.s.dispose();
    }
  });
});

describe('build 步 spec 兜底（#113 候选2：交接物仍缺失 → 强制 new session）', () => {
  test('confirm 时 plan.md 缺席 → build 步 claim = new session + todo 原始 spec 随载荷', async () => {
    const w = await setupWorld();
    try {
      const buildId = await w.startBuild(true);
      // 首轮不写 → 自动补写；补写轮仍不写 → 放行 confirm。
      const planStep = await w.claim();
      await w.done(planStep.step.id, { status: 'success', sessionId: 'pi-1' });
      const rewrite = await w.claim();
      await w.done(rewrite.step.id, { status: 'success', sessionId: 'pi-1' });
      expect(w.todoRow().phase).toBe('confirm');
      await confirm(w, buildId);
      // build 步 = new session：daemon 走 buildTaskPrompt = title+spec（agent 必拿
      // 任务内容，不再只有 confirm 关口措辞）。
      const buildStep = await w.claim();
      expect(buildStep.step.kind).toBe('build');
      expect(buildStep.session).toEqual({ action: 'new', sessionId: null });
      expect(buildStep.todo).toMatchObject({
        title: '探针任务',
        spec: '写一行探针到 README.md',
      });
    } finally {
      w.s.dispose();
    }
  });

  test('plan.md 在 → build 步 continue session 不变（正常路径不回归）', async () => {
    const w = await setupWorld();
    try {
      const buildId = await w.startBuild(true);
      const planStep = await w.claim();
      await w.uploadPlan(planStep.step.id, '# 方案\nContext: x');
      await w.done(planStep.step.id, { status: 'success', sessionId: 'pi-1' });
      await confirm(w, buildId);
      const buildStep = await w.claim();
      expect(buildStep.step.kind).toBe('build');
      expect(buildStep.session).toEqual({ action: 'continue', sessionId: 'pi-1' });
    } finally {
      w.s.dispose();
    }
  });

  test('withPlan=false 直执行不受影响（planDocId 恒 null 不误判交接缺失）', async () => {
    const w = await setupWorld();
    try {
      await w.startBuild(false);
      const buildStep = await w.claim();
      expect(buildStep.step.kind).toBe('build');
      expect(buildStep.session).toEqual({ action: 'new', sessionId: null });
      expect(w.todoRow().phase).toBe('building');
    } finally {
      w.s.dispose();
    }
  });
});
