// per-step 凭证下发接口面对拍（02 §8 运行时层 + 02 §5.4 token/{stepId} 挂接，
// HTTP 端点归 M3；载荷细形 [推断]）。
// - 解析链：step → build → todo → assignment 执行侧槽 → agent → provider
//   → SecretBox 解密（明文只进返回值）
// - env = agent.secrets 授权集（per-Agent 授权，r2 权限 tab）；未指派 = 无注入
// - git 槽恒 null（托管 repo 面归 M2b）
// - 护栏：keyfile 丢失（换 box）→ SecretBoxError = 存量报废口径（02 §8）

import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { agent, step as stepTable } from '../src/db/schema.js';
import { createEphemeralSecretBox, SecretBoxError } from '../src/lib/secret-box.js';
import { startBuilds } from '../src/services/builds.js';
import { resolveStepCredentials } from '../src/services/credentials.js';
import { createProvider } from '../src/services/providers.js';
import { createSecret } from '../src/services/secrets.js';
import { bootServer, postProject, req } from './helpers.js';

const RELAY_KEY = 'sk-relay-per-step';
const STRIPE_VALUE = 'sk_live_stripe';

async function withAgentStack(opts: { secretsGranted?: boolean } = {}) {
  const s = bootServer();
  const keysvc = { db: s.db, box: s.secretBox };
  createProvider(keysvc, {
    teamId: s.team.id,
    body: {
      providerId: 'r3-gw',
      label: 'r3 网关',
      baseUrl: 'https://api.example.com/v1',
      api: 'anthropic-messages',
      apiKey: RELAY_KEY,
      models: [{ id: 'claude-sonnet-5', name: 'claude-sonnet-5' }],
    },
    createdBy: s.user.id,
  });
  const secret = createSecret(keysvc, {
    teamId: s.team.id,
    name: 'STRIPE_API_KEY',
    description: null,
    value: STRIPE_VALUE,
  });
  const agentId = 'agent-xiaolin';
  s.db
    .insert(agent)
    .values({
      id: agentId,
      teamId: s.team.id,
      displayName: '小林',
      status: 'active',
      provider: 'r3-gw', // providerId 寻址（r3 §1.5 model 串同源）
      modelId: 'claude-sonnet-5',
      tools: [],
      secrets: opts.secretsGranted === false ? [] : [secret.id], // 授权集 [推断] = secret id
      skills: [],
      mcpServers: [],
    })
    .run();
  const projectId = await postProject(s.app);
  const todoDoc = (await (
    await req(s.app, 'POST', `/api/projects/${projectId}/todos`, { title: '跑任务', spec: '' })
  ).json()) as { id: string };
  const builds = startBuilds(
    { db: s.db, hub: s.hub, user: s.user },
    {
      projectId,
      todoIds: [todoDoc.id],
      assignment: { plan: null, build: { agentId } },
      withPlan: true,
    },
  );
  const buildId = builds[0]?.id;
  if (!buildId) throw new Error('no build');
  const stepRow = s.db.select().from(stepTable).where(eq(stepTable.buildId, buildId)).all()[0];
  if (!stepRow) throw new Error('no step');
  return { ...s, keysvc, stepId: stepRow.id, todoId: todoDoc.id, projectId };
}

describe('resolveStepCredentials（per-step 下发接口面）', () => {
  test('全链解析：provider 明文 + env 授权集 + git null 槽', async () => {
    const s = await withAgentStack();
    const bundle = resolveStepCredentials(s.keysvc, s.stepId);
    expect(bundle.provider).toMatchObject({
      providerId: 'r3-gw',
      baseUrl: 'https://api.example.com/v1',
      api: 'anthropic-messages',
      authHeader: true,
      apiKey: RELAY_KEY, // 明文只进返回值（内存 only，02 §8）
      modelId: 'claude-sonnet-5',
    });
    expect(bundle.env).toEqual({ STRIPE_API_KEY: STRIPE_VALUE });
    expect(bundle.git).toBeNull(); // M2b 托管 repo 面槽位
  });

  test('secrets 开关未授权 = 无注入（per-Agent 授权，r2 权限 tab）', async () => {
    const s = await withAgentStack({ secretsGranted: false });
    const bundle = resolveStepCredentials(s.keysvc, s.stepId);
    expect(bundle.env).toEqual({});
    expect(bundle.provider?.apiKey).toBe(RELAY_KEY);
  });

  test('未指派 Agent = provider null + env 空；未知 step 404', async () => {
    const s = await withAgentStack();
    // 另建一条未指派 todo（首条已 queued，重跑边仅自 failed 合法）。
    const second = (await (
      await req(s.app, 'POST', `/api/projects/${s.projectId}/todos`, { title: '裸跑', spec: '' })
    ).json()) as { id: string };
    const builds = startBuilds(
      { db: s.db, hub: s.hub, user: s.user },
      {
        projectId: s.projectId,
        todoIds: [second.id],
        assignment: { plan: null, build: null },
        withPlan: false,
      },
    );
    const stepRow = s.db
      .select()
      .from(stepTable)
      .where(eq(stepTable.buildId, builds[0]?.id ?? ''))
      .all()[0];
    const bundle = resolveStepCredentials(s.keysvc, stepRow?.id ?? '');
    expect(bundle.provider).toBeNull();
    expect(bundle.env).toEqual({});

    expect(() => resolveStepCredentials(s.keysvc, 'nope')).toThrowError(/not found/);
  });

  test('keyfile 丢失（换 box）→ SecretBoxError = 存量报废口径（02 §8 护栏）', async () => {
    const s = await withAgentStack();
    const orphaned = { db: s.db, box: createEphemeralSecretBox() }; // 模拟丢失后再生成
    expect(() => resolveStepCredentials(orphaned, s.stepId)).toThrow(SecretBoxError);
  });
});
