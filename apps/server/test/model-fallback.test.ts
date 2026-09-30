// 模型兜底服务面（XMON-44）：agent fallbackModels CRUD 写面去重、claim 载荷
// 透传、token 最小兜底凭证集、done attempts/failureKind 落账 + steps 读面透出、
// 旧形状 done 兼容。失败场景先于实现枚举（issue 验收防偷懒清单）：
// ① 写面未剥离主模型重复项；② claim 载荷丢列表/丢序；③ token 发了非最小集
// （主 provider 重复/漏 provider/漏解密 key）；④ done 落库丢 attempts；
// ⑤ steps 读面丢 attempts；⑥ 旧形状 done 炸；⑦ migration 列缺（旧行回填语义）。

import {
  type ClaimedStep,
  claimedStepSchema,
  machineClaimResponseSchema,
  machineTokenResponseSchema,
} from '@pacman/shared';
import { eq, sql } from 'drizzle-orm';
import type { Hono } from 'hono';
import { describe, expect, test } from 'vitest';
import {
  agent as agentTable,
  build as buildTable,
  provider as providerTable,
  step as stepTable,
  todo as todoTable,
} from '../src/db/schema.js';
import { bootServer, issueApiKey, postProject, req } from './helpers.js';

type TestServer = ReturnType<typeof bootServer>;

const AGENT_ID = 'agent-fb-1';

interface World {
  s: TestServer;
  token: string;
  machineId: string;
  todoId: string;
  projectId: string;
  startBuild(): Promise<{ buildId: string }>;
  claim(): Promise<ClaimedStep | null>;
}

/** 机器注册 + 双 provider（主 stub-gw / 兜底 gw-2 带 apiKey）+ 兜底 agent + todo。 */
async function setupWorld(
  agentFallbacks?: { provider: string | null; modelId: string }[],
): Promise<World> {
  const s = bootServer({ claimHoldMs: 200 });
  const key = { plain: await issueApiKey(s) };
  s.db
    .insert(providerTable)
    .values({
      id: 'prov-1',
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
    .insert(providerTable)
    .values({
      id: 'prov-2',
      teamId: s.team.id,
      kind: 'custom',
      providerId: 'gw-2',
      label: 'Gateway Two',
      baseUrl: 'http://127.0.0.1:9/v2',
      api: 'openai-completions',
      authHeader: true,
      compat: { supportsDeveloperRole: false },
      models: [{ id: 'm2', name: 'm2' }],
      apiKeyCipher: s.secretBox.seal('sk-gw-2'),
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
      displayName: 'fb-builder',
      provider: 'stub-gw',
      modelId: 'stub-model',
      ...(agentFallbacks !== undefined ? { fallbackModels: agentFallbacks } : {}),
    })
    .run();
  // enroll 走机器面 Authorization 头（Bearer apiKey，02 §8）。
  const enrollRes = await Promise.resolve(
    s.app.request('/api/machine/enroll', {
      method: 'POST',
      headers: { authorization: `Bearer ${key.plain}`, 'content-type': 'application/json' },
      body: JSON.stringify({ teamId: s.team.id, name: 'test-mbp', cliVersion: '0.1.0' }),
    }),
  );
  expect(enrollRes.status).toBe(200);
  const machineJson = (await enrollRes.json()) as { token: string; machineId: string };
  const projectId = await postProject(s.app);
  const todoRes = await req(s.app, 'POST', `/api/projects/${projectId}/todos`, {
    title: '兜底探针',
    spec: '写一行探针',
  });
  const todoBody = (await todoRes.json()) as { id: string };
  return {
    s,
    token: machineJson.token,
    machineId: machineJson.machineId,
    todoId: todoBody.id,
    projectId,
    async startBuild() {
      const res = await req(s.app, 'POST', `/api/projects/${projectId}/builds`, {
        todoIds: [todoBody.id],
        assignment: { plan: { agentId: AGENT_ID }, build: { agentId: AGENT_ID } },
        withPlan: true,
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as { builds: { id: string }[] };
      return { buildId: body.builds[0]!.id };
    },
    async claim() {
      const res = await Promise.resolve(
        s.app.request('/api/machine/tasks/claim', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${machineJson.token}`,
            'content-type': 'application/json',
          },
          body: '{}',
        }),
      );
      const body = machineClaimResponseSchema.parse(await res.json());
      return body.step;
    },
  };
}

function agentCall(app: Hono, method: string, path: string, body?: unknown): Promise<Response> {
  return Promise.resolve(
    app.request(path, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  );
}

describe('agent fallbackModels CRUD（写面剥离主模型重复项）', () => {
  test('create 携带列表：主模型重复项剥离、其余保序落库，GET 读面透出', async () => {
    const w = await setupWorld();
    const res = await agentCall(w.s.app, 'POST', `/api/teams/${w.s.team.id}/agents`, {
      displayName: 'fb-agent',
      provider: 'stub-gw',
      modelId: 'stub-model',
      fallbackModels: [
        { provider: 'stub-gw', modelId: 'stub-model' }, // 显式重复
        { provider: null, modelId: 'stub-model' }, // null 槽继承主 provider → 重复
        { provider: 'gw-2', modelId: 'm2' },
        { provider: null, modelId: 'stub-model-2' }, // null 槽但模型不同 → 保留
      ],
    });
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    const getRes = await agentCall(w.s.app, 'GET', `/api/teams/${w.s.team.id}/agents/${id}`);
    expect(getRes.status).toBe(200);
    const record = (await getRes.json()) as { fallbackModels: unknown[] };
    expect(record.fallbackModels).toEqual([
      { provider: 'gw-2', modelId: 'm2' },
      { provider: null, modelId: 'stub-model-2' },
    ]);
    w.s.dispose();
  });

  test('create 缺省 = []（空 = 现行为）；PATCH 整体替换列表', async () => {
    const w = await setupWorld();
    const create = await agentCall(w.s.app, 'POST', `/api/teams/${w.s.team.id}/agents`, {
      displayName: 'fb-agent',
      provider: 'stub-gw',
      modelId: 'stub-model',
    });
    const { id } = (await create.json()) as { id: string };
    let record = (await (
      await agentCall(w.s.app, 'GET', `/api/teams/${w.s.team.id}/agents/${id}`)
    ).json()) as {
      fallbackModels: unknown[];
    };
    expect(record.fallbackModels).toEqual([]);
    const patch = await agentCall(w.s.app, 'PATCH', `/api/teams/${w.s.team.id}/agents/${id}`, {
      fallbackModels: [{ provider: 'gw-2', modelId: 'm2' }],
    });
    expect(patch.status).toBe(200);
    record = (await patch.json()) as { fallbackModels: unknown[] };
    expect(record.fallbackModels).toEqual([{ provider: 'gw-2', modelId: 'm2' }]);
    // 清空 = 空列表显式置回。
    const cleared = await agentCall(w.s.app, 'PATCH', `/api/teams/${w.s.team.id}/agents/${id}`, {
      fallbackModels: [],
    });
    expect(((await cleared.json()) as { fallbackModels: unknown[] }).fallbackModels).toEqual([]);
    w.s.dispose();
  });

  test('PATCH 换主模型撞上存量兜底项 → 存量列表同步再剥离（不变式在行上恒成立）', async () => {
    const w = await setupWorld();
    const create = await agentCall(w.s.app, 'POST', `/api/teams/${w.s.team.id}/agents`, {
      displayName: 'fb-agent',
      provider: 'stub-gw',
      modelId: 'stub-model',
      fallbackModels: [{ provider: 'gw-2', modelId: 'm2' }],
    });
    const { id } = (await create.json()) as { id: string };
    // 主模型改到 gw-2/m2 = 与存量兜底撞车 → 兜底被剥空。
    const patch = await agentCall(w.s.app, 'PATCH', `/api/teams/${w.s.team.id}/agents/${id}`, {
      provider: 'gw-2',
      modelId: 'm2',
    });
    expect(patch.status).toBe(200);
    const record = (await patch.json()) as { fallbackModels: unknown[] };
    expect(record.fallbackModels).toEqual([]);
    w.s.dispose();
  });
});

describe('claim 载荷透传 agent.fallbackModels', () => {
  test('非空列表按序携带；空列表 = 字段缺省（纯增可选，旧 daemon 忽略）', async () => {
    const w = await setupWorld([
      { provider: 'gw-2', modelId: 'm2' },
      { provider: null, modelId: 'stub-model-2' },
    ]);
    const { buildId } = await w.startBuild();
    const step = await w.claim();
    expect(step).not.toBeNull();
    expect(step!.step.buildId).toBe(buildId);
    expect(step!.step.kind).toBe('plan');
    expect(step!.agent?.fallbackModels).toEqual([
      { provider: 'gw-2', modelId: 'm2' },
      { provider: null, modelId: 'stub-model-2' },
    ]);
    // zod 校验整载荷（claimedStepSchema 单源）。
    expect(claimedStepSchema.parse(step).agent?.fallbackModels).toHaveLength(2);
    w.s.dispose();
  });

  test('空列表 = 字段缺省', async () => {
    const w = await setupWorld([]);
    await w.startBuild();
    const step = await w.claim();
    expect(step).not.toBeNull();
    expect(step!.agent?.fallbackModels).toBeUndefined();
    w.s.dispose();
  });
});

describe('token 下发最小兜底 provider 凭证集', () => {
  async function tokenFor(w: World): Promise<ReturnType<typeof machineTokenResponseSchema.parse>> {
    await w.startBuild();
    const step = await w.claim();
    const res = await Promise.resolve(
      w.s.app.request(`/api/machine/token/${step!.step.id}`, {
        headers: { authorization: `Bearer ${w.token}` },
      }),
    );
    expect(res.status).toBe(200);
    return machineTokenResponseSchema.parse(await res.json());
  }

  test('跨 provider 兜底 → fallbackProviders 只含该 provider（custom 行解密 key）', async () => {
    const w = await setupWorld([
      { provider: 'gw-2', modelId: 'm2' },
      { provider: 'gw-2', modelId: 'm2b' }, // 同 provider 去重成一条
      { provider: null, modelId: 'stub-model-2' }, // null 槽 = 主 provider，凭证已在主槽
    ]);
    const token = await tokenFor(w);
    expect(token.provider).toMatchObject({ kind: 'http', providerId: 'stub-gw' });
    expect(token.fallbackProviders).toHaveLength(1);
    expect(token.fallbackProviders?.[0]).toMatchObject({
      kind: 'http',
      providerId: 'gw-2',
      baseUrl: 'http://127.0.0.1:9/v2',
      apiKey: 'sk-gw-2', // SecretBox 解密明文，内存态下发（02 §8）
    });
    w.s.dispose();
  });

  test('兜底全部走主 provider（null 槽）→ fallbackProviders 缺省（最小集为空）', async () => {
    const w = await setupWorld([{ provider: null, modelId: 'stub-model-2' }]);
    const token = await tokenFor(w);
    expect(token.fallbackProviders).toBeUndefined();
    w.s.dispose();
  });

  test('兜底引用无 custom 行的 provider → api_key 直投形（preset 38 目录同主槽回退律）', async () => {
    const w = await setupWorld([{ provider: 'groq', modelId: 'llama-4' }]);
    const token = await tokenFor(w);
    expect(token.fallbackProviders).toEqual([{ kind: 'api_key', providerId: 'groq' }]);
    w.s.dispose();
  });
});

describe('done 落账 attempts/failureKind + steps 读面透出', () => {
  async function doneFor(
    w: World,
    body: unknown,
  ): Promise<{ buildId: string; stepId: string; done: Response }> {
    const { buildId } = await w.startBuild();
    const step = await w.claim();
    const done = await Promise.resolve(
      w.s.app.request(`/api/machine/done/${step!.step.id}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${w.token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
    return { buildId, stepId: step!.step.id, done };
  }

  test('failed + failureKind + attempts → step 行双列落库，steps 读面透出 attempts；errorMessage 保持最后错', async () => {
    const w = await setupWorld([{ provider: 'gw-2', modelId: 'm2' }]);
    const attempts = [
      {
        provider: 'stub-gw',
        modelId: 'stub-model',
        error: 'rate limited',
        startedAt: 1790000000000,
        endedAt: 1790000001000,
      },
      {
        provider: 'gw-2',
        modelId: 'm2',
        error: '429 quota exceeded',
        startedAt: 1790000002000,
        endedAt: 1790000003000,
      },
    ];
    const { buildId, stepId, done } = await doneFor(w, {
      status: 'failed',
      errorMessage: '429 quota exceeded',
      failureKind: 'model_call',
      attempts,
    });
    expect(done.status).toBe(200);
    const stepRow = w.s.db.select().from(stepTable).where(eq(stepTable.id, stepId)).get()!;
    expect(stepRow.status).toBe('failed');
    expect((stepRow as { failureKind?: string | null }).failureKind).toBe('model_call');
    expect((stepRow as { attempts?: unknown }).attempts).toEqual(attempts);
    // steps 读面（GET /api/builds/{id}/steps）透出 attempts。
    const stepsRes = await req(w.s.app, 'GET', `/api/builds/${buildId}/steps`);
    expect(stepsRes.status).toBe(200);
    const rows = (await stepsRes.json()) as { id: string; attempts: unknown }[];
    expect(rows[0]!.attempts).toEqual(attempts);
    // build.errorMessage = done 回传的 errorMessage（最后错语义不变）。
    const buildRow = w.s.db.select().from(buildTable).where(eq(buildTable.id, buildId)).get()!;
    expect(buildRow.errorMessage).toBe('429 quota exceeded');
    const todoRow = w.s.db.select().from(todoTable).where(eq(todoTable.id, w.todoId)).get()!;
    expect(todoRow.phase).toBe('failed');
    w.s.dispose();
  });

  test('旧形状 done（无 failureKind/attempts）兼容不炸：attempts 读面 null', async () => {
    const w = await setupWorld();
    const { buildId, done } = await doneFor(w, { status: 'failed', errorMessage: '模型连接失败' });
    expect(done.status).toBe(200);
    const stepsRes = await req(w.s.app, 'GET', `/api/builds/${buildId}/steps`);
    const rows = (await stepsRes.json()) as { attempts: unknown }[];
    expect(rows[0]!.attempts).toBeNull();
    w.s.dispose();
  });
});

describe('migration 列回填（agent.fallbackModels / step.attempts / step.failureKind）', () => {
  test('migration 后新列在表上、旧行语义 = 默认值/NULL', () => {
    const s = bootServer();
    const cols = (table: string) =>
      s.db.all(sql.raw(`PRAGMA table_info(${table})`)) as { name: string }[];
    expect(cols('agent').map((c) => c.name)).toContain('fallbackModels');
    expect(cols('step').map((c) => c.name)).toContain('attempts');
    expect(cols('step').map((c) => c.name)).toContain('failureKind');
    // 旧行（migration 前语义）默认 [] / NULL。
    s.db.insert(agentTable).values({ id: 'a-old', teamId: s.team.id, displayName: 'old' }).run();
    const row = s.db.select().from(agentTable).where(eq(agentTable.id, 'a-old')).get()!;
    expect(row.fallbackModels).toEqual([]);
    s.dispose();
  });
});
