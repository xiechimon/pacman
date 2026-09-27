// MCP client 面管理侧（02 §7.1，M4b）：团队 MCP server CRUD（r3 §5.1 record
// 形状原样）+ per-Agent mcpServers[] 授权（r3 §4/§5.1，B14）+ claim 载荷携带
// （worker/chief 回合 per-turn 连接的 server 侧半；headers 密文 per-step 解析
// = 02 §8 运行时纪律同族）+ executor 最低版本门形状（02 §7.1，MCP_MIN_CLI_VERSION）。

import {
  type ClaimedStep,
  claimedStepSchema,
  MCP_MIN_CLI_VERSION,
  MCP_SLUG_COPY,
  mcpServerRecordSchema,
  WORKER_REMOTE_TOOLS,
} from '@pacman/shared';
import type { Hono } from 'hono';
import { describe, expect, test } from 'vitest';
import { agentMemory, agent as agentTable, mcpServer } from '../src/db/schema.js';
import { bootServer, issueApiKey, postProject, type TestServer } from './helpers.js';

async function call(
  app: Hono,
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

describe('团队 MCP server CRUD（r3 §5.1 record 形状保形）', () => {
  test('POST http server：record 原样 + headers 值只写不读（密文 at-rest，02 §8）', async () => {
    const s = bootServer();
    const res = await call(s.app, 'POST', `/api/teams/${s.team.id}/mcp-servers`, {
      body: {
        label: '工单系统',
        slug: 'tickets',
        transport: 'http',
        url: 'https://example.invalid/mcp',
        headers: { Authorization: 'Bearer h-secret' },
      },
    });
    expect(res.status).toBe(201);
    const record = mcpServerRecordSchema.parse(await res.json());
    expect(record).toMatchObject({
      teamId: s.team.id,
      label: '工单系统',
      slug: 'tickets',
      transport: 'http',
      url: 'https://example.invalid/mcp',
      hasCredential: true,
      credentialKeys: ['Authorization'],
      createdBy: s.user.id,
    });
    // 值不回显（写只读掩码纪律同族）：record 无 headers 字段。
    expect(JSON.stringify(record)).not.toContain('h-secret');
    // at-rest 密文：行内密文 ≠ 明文，SecretBox 可解回。
    const row = s.db.select().from(mcpServer).all()[0]!;
    expect(row.headersCipher).not.toBeNull();
    expect(row.headersCipher).not.toContain('h-secret');
    const plain = s.secretBox.open(row.headersCipher!);
    expect(JSON.parse(plain)).toEqual({ Authorization: 'Bearer h-secret' });

    // GET 列表 = record 数组（同形状）。
    const list = await call(s.app, 'GET', `/api/teams/${s.team.id}/mcp-servers`);
    expect(list.status).toBe(200);
    const rows = (await list.json()) as unknown[];
    expect(rows).toHaveLength(1);
    expect(mcpServerRecordSchema.parse(rows[0]).slug).toBe('tickets');
    s.dispose();
  });

  test('POST stdio server：command/args 内部承载，record url 空串 [推断]', async () => {
    const s = bootServer();
    const res = await call(s.app, 'POST', `/api/teams/${s.team.id}/mcp-servers`, {
      body: {
        label: '浏览器',
        slug: 'browser',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', 'mcp-browser'],
      },
    });
    expect(res.status).toBe(201);
    const record = mcpServerRecordSchema.parse(await res.json());
    expect(record).toMatchObject({
      transport: 'stdio',
      url: '',
      hasCredential: false,
      credentialKeys: [],
    });
    const row = s.db.select().from(mcpServer).all()[0]!;
    expect(row.command).toBe('npx');
    expect(row.args).toEqual(['-y', 'mcp-browser']);
    s.dispose();
  });

  test('slug 规则：小写标识符（MCP_SLUG_COPY canon）；重复 = 409；transport 必填位 = 400', async () => {
    const s = bootServer();
    expect(MCP_SLUG_COPY).toContain('小写字母标识符');
    const base = `/api/teams/${s.team.id}/mcp-servers`;
    for (const slug of ['Tickets', 'tick ets', '_x', '']) {
      const res = await call(s.app, 'POST', base, {
        body: { label: 'x', slug, transport: 'http', url: 'https://example.invalid/mcp' },
      });
      expect(res.status, `slug ${JSON.stringify(slug)}`).toBe(400);
      expect(Object.keys((await res.json()) as Record<string, unknown>)).toEqual(['error']);
    }
    // http 无 url / stdio 无 command = 400。
    expect(
      (await call(s.app, 'POST', base, { body: { label: 'x', slug: 'a', transport: 'http' } }))
        .status,
    ).toBe(400);
    expect(
      (await call(s.app, 'POST', base, { body: { label: 'x', slug: 'b', transport: 'stdio' } }))
        .status,
    ).toBe(400);
    // 重复 slug = 409（标识符 = 工具名前缀，团队内唯一）。
    const ok = await call(s.app, 'POST', base, {
      body: { label: 'x', slug: 'dup', transport: 'http', url: 'https://example.invalid/mcp' },
    });
    expect(ok.status).toBe(201);
    const dup = await call(s.app, 'POST', base, {
      body: { label: 'y', slug: 'dup', transport: 'http', url: 'https://example.invalid/mcp' },
    });
    expect(dup.status).toBe(409);
    s.dispose();
  });

  test('PATCH 编辑（slug 不可改，r3 §5.1 文案 canon）+ DELETE（卡片更多菜单面）', async () => {
    const s = bootServer();
    const base = `/api/teams/${s.team.id}/mcp-servers`;
    const created = (await (
      await call(s.app, 'POST', base, {
        body: { label: 'x', slug: 'edit-me', transport: 'http', url: 'https://a.invalid/mcp' },
      })
    ).json()) as { id: string };
    // 改 label/url/headers。
    const patched = await call(s.app, 'PATCH', `${base}/${created.id}`, {
      body: { label: 'y', url: 'https://b.invalid/mcp', headers: { 'X-Key': 'v' } },
    });
    expect(patched.status).toBe(200);
    const record = mcpServerRecordSchema.parse(await patched.json());
    expect(record).toMatchObject({
      label: 'y',
      slug: 'edit-me',
      url: 'https://b.invalid/mcp',
      hasCredential: true,
      credentialKeys: ['X-Key'],
    });
    // slug 不可改。
    const slugPatch = await call(s.app, 'PATCH', `${base}/${created.id}`, {
      body: { slug: 'other' },
    });
    expect(slugPatch.status).toBe(400);
    // DELETE → 204；再删 404。
    expect((await call(s.app, 'DELETE', `${base}/${created.id}`)).status).toBe(204);
    expect((await call(s.app, 'DELETE', `${base}/${created.id}`)).status).toBe(404);
    expect(s.db.select().from(mcpServer).all()).toHaveLength(0);
    s.dispose();
  });
});

describe('per-Agent 授权面（02 §7.1：授权在每个 Agent 的页面上单独进行）', () => {
  test('PATCH agents/{aid} mcpServers[] 勾选；未知 slug = 400；GET 单 Agent 保形', async () => {
    const s = bootServer();
    const serverId = 'mcp-demo';
    s.db
      .insert(mcpServer)
      .values({
        id: serverId,
        teamId: s.team.id,
        label: 'demo',
        slug: 'demo',
        transport: 'http',
        url: 'https://example.invalid/mcp',
        hasCredential: false,
        credentialKeys: [],
        createdBy: s.user.id,
        createdAt: 1,
        updatedAt: 1,
      })
      .run();
    const agentRes = await call(s.app, 'POST', `/api/teams/${s.team.id}/agents`, {
      body: { displayName: 'worker-a' },
    });
    expect(agentRes.status).toBe(201);
    const { id: agentId } = (await agentRes.json()) as { id: string };

    const patch = await call(s.app, 'PATCH', `/api/teams/${s.team.id}/agents/${agentId}`, {
      body: { mcpServers: ['demo'] },
    });
    expect(patch.status).toBe(200);
    const record = (await patch.json()) as { mcpServers: string[] };
    expect(record.mcpServers).toEqual(['demo']);

    const bad = await call(s.app, 'PATCH', `/api/teams/${s.team.id}/agents/${agentId}`, {
      body: { mcpServers: ['nope'] },
    });
    expect(bad.status).toBe(400);

    const get = await call(s.app, 'GET', `/api/teams/${s.team.id}/agents/${agentId}`);
    expect(get.status).toBe(200);
    expect(((await get.json()) as { mcpServers: string[] }).mcpServers).toEqual(['demo']);
    // 未命中 Agent = 404。
    expect((await call(s.app, 'GET', `/api/teams/${s.team.id}/agents/none`)).status).toBe(404);
    s.dispose();
  });
});

describe('claim 载荷携带（per-turn 连接的 server 侧半 + 版本墙形状）', () => {
  async function world(cliVersion: string, opts: { authorize?: boolean } = {}) {
    const s = bootServer({ claimHoldMs: 250 });
    const plain = await issueApiKey(s);
    const enroll = await call(s.app, 'POST', '/api/machine/enroll', {
      cred: plain,
      body: { teamId: s.team.id, name: 'm4b-mbp', cliVersion },
    });
    const { token } = (await enroll.json()) as { token: string };
    // MCP server（带 headers 凭证）+ provider/agent。
    await call(s.app, 'POST', `/api/teams/${s.team.id}/mcp-servers`, {
      body: {
        label: 'demo',
        slug: 'demo',
        transport: 'http',
        url: 'https://example.invalid/mcp',
        headers: { Authorization: 'Bearer hh' },
      },
    });
    const agentId = 'agent-m4b';
    s.db
      .insert(agentTable)
      .values({
        id: agentId,
        teamId: s.team.id,
        displayName: 'w',
        provider: 'stub-gw',
        modelId: 'stub-model',
        mcpServers: opts.authorize === false ? [] : ['demo'],
      })
      .run();
    const projectId = await postProject(s.app);
    const todoRes = await call(s.app, 'POST', `/api/projects/${projectId}/todos`, {
      body: { title: 't', spec: 's' },
    });
    const { id: todoId } = (await todoRes.json()) as { id: string };
    await call(s.app, 'POST', `/api/projects/${projectId}/builds`, {
      body: { todoIds: [todoId], assignment: { plan: null, build: { agentId } }, withPlan: false },
    });
    const claimRes = await call(s.app, 'POST', '/api/machine/tasks/claim', {
      cred: token,
      body: {},
    });
    const body = (await claimRes.json()) as { step: ClaimedStep | null };
    return { s, step: body.step ? claimedStepSchema.parse(body.step) : null };
  }

  test('worker 步携带记忆三件套 + 附件读 remoteTools + 已授权 mcpServers（headers per-step 解析）', async () => {
    const { s, step } = await world(MCP_MIN_CLI_VERSION);
    expect(step).not.toBeNull();
    expect(step!.remoteTools?.map((t) => t.name)).toEqual(WORKER_REMOTE_TOOLS.map((t) => t.name));
    expect(step!.mcpServers).toEqual([
      {
        slug: 'demo',
        transport: 'http',
        url: 'https://example.invalid/mcp',
        headers: { Authorization: 'Bearer hh' },
      },
    ]);
    s.dispose();
  });

  test('版本墙形状：latestCliVersion < MCP_MIN_CLI_VERSION = 不携带 mcpServers（02 §7.1）', async () => {
    const { s, step } = await world('0.0.1');
    expect(step).not.toBeNull();
    expect(step!.mcpServers).toBeUndefined();
    // 记忆 + 附件工具不受版本墙门控（02 §4.4 无版本语义，#310/r9 §3.1 worker attachment 同律）。
    expect(step!.remoteTools?.map((t) => t.name)).toEqual(WORKER_REMOTE_TOOLS.map((t) => t.name));
    s.dispose();
  });

  test('未授权（agent.mcpServers 空）= 不携带', async () => {
    const { s, step } = await world(MCP_MIN_CLI_VERSION, { authorize: false });
    expect(step).not.toBeNull();
    expect(step!.mcpServers).toBeUndefined();
    s.dispose();
  });

  test('stdio 授权 = endpoint 带 command/args（无 url）', async () => {
    const s = bootServer({ claimHoldMs: 250 });
    const plain = await issueApiKey(s);
    const enroll = await call(s.app, 'POST', '/api/machine/enroll', {
      cred: plain,
      body: { teamId: s.team.id, name: 'm', cliVersion: MCP_MIN_CLI_VERSION },
    });
    const { token } = (await enroll.json()) as { token: string };
    await call(s.app, 'POST', `/api/teams/${s.team.id}/mcp-servers`, {
      body: {
        label: 'local',
        slug: 'local',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', 'x'],
      },
    });
    s.db
      .insert(agentTable)
      .values({
        id: 'a1',
        teamId: s.team.id,
        displayName: 'w',
        provider: 'p',
        modelId: 'm',
        mcpServers: ['local'],
      })
      .run();
    const projectId = await postProject(s.app);
    const { id: todoId } = (await (
      await call(s.app, 'POST', `/api/projects/${projectId}/todos`, {
        body: { title: 't', spec: 's' },
      })
    ).json()) as { id: string };
    await call(s.app, 'POST', `/api/projects/${projectId}/builds`, {
      body: {
        todoIds: [todoId],
        assignment: { plan: null, build: { agentId: 'a1' } },
        withPlan: false,
      },
    });
    const claimRes = await call(s.app, 'POST', '/api/machine/tasks/claim', {
      cred: token,
      body: {},
    });
    const { step } = (await claimRes.json()) as { step: ClaimedStep | null };
    expect(step?.mcpServers).toEqual([
      { slug: 'local', transport: 'stdio', command: 'npx', args: ['-y', 'x'] },
    ]);
    s.dispose();
  });
});

describe('记忆删除 REST 面（02 §4.4「列表/删除 API 保形」；DELETE 同名 [推断]）', () => {
  test('DELETE memories/{mid} → 204；未知/越权 agent = 404', async () => {
    const s: TestServer = bootServer();
    s.db.insert(agentTable).values({ id: 'a1', teamId: s.team.id, displayName: 'w' }).run();
    s.db
      .insert(agentMemory)
      .values({
        id: 'mem-1',
        agentId: 'a1',
        teamId: s.team.id,
        title: 't',
        content: 'c',
        projectId: null,
        sourceTodoId: null,
        sourceBuildId: null,
        createdAt: 1,
        updatedAt: 1,
      })
      .run();
    const base = `/api/teams/${s.team.id}/agents/a1/memories`;
    expect((await call(s.app, 'GET', base)).status).toBe(200);
    expect((await call(s.app, 'DELETE', `${base}/mem-x`)).status).toBe(404);
    expect(
      (await call(s.app, 'DELETE', `/api/teams/${s.team.id}/agents/none/memories/mem-1`)).status,
    ).toBe(404);
    expect((await call(s.app, 'DELETE', `${base}/mem-1`)).status).toBe(204);
    expect(s.db.select().from(agentMemory).all()).toHaveLength(0);
    s.dispose();
  });
});
