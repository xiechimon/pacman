// M4b MCP 双面 E2E（02 §7，00/D4 薄桥两侧实跑）：
// ① client 面（外部 MCP → Agent）：团队 MCP server 接入（REST CRUD）+ per-Agent
//    授权（PATCH agents mcpServers[]）→ claim 载荷携带端点 → daemon per-turn
//    连接 → pi 工具 `mcp__<slug>__<tool>` 真调用外部 server → transcript 工具行
//    落库；坏端点降级不阻断（canon 行 `[mcp] dead: connect failed — …`，r3 §1.5）。
// ② server 面（外部 MCP 客户端 ← pacman）：真 sdk Client（StreamableHTTP）连
//    /api/mcp，Bearer apiKey + key 级白名单（initialize/tools/list/tools/call
//    全往返）；未授工具 call 被拒（limits every call）；create_todo 以 key 属主
//    身份落库。

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { MCP_TOOL_REGISTRY } from '@pacman/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { z } from 'zod';
import { loadDaemonConfig } from '../../apps/daemon/src/config.js';
import { createDaemonLogger } from '../../apps/daemon/src/log.js';
import { type MachineHandle, runMachine } from '../../apps/daemon/src/machine-loop.js';
import { type StatePaths, statePaths } from '../../apps/daemon/src/state.js';
import { message as messageTable, todo as todoTable } from '../../apps/server/src/db/schema.js';
import { createApiKey } from '../../apps/server/src/services/api-keys.js';
import { AGENT_ID, api, bootRealServer, type RealServer, seedWorld, waitFor } from './helpers.js';
import { type StubLlm, startStubLlm } from './stub-llm.js';

/** 外部 MCP server（测试内起，client 面对拍端）：echo 工具 + 调用记录。 */
async function startExternalMcp(): Promise<{
  url: string;
  calls: { name: string; args: Record<string, unknown> }[];
  close(): Promise<void>;
}> {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const http: Server = createServer((req, res) => {
    void (async () => {
      const server = new McpServer({ name: 'external-fixture', version: '0.0.1' });
      server.registerTool(
        'echo',
        { description: 'Echo text back.', inputSchema: { text: z.string() } },
        async (args) => {
          calls.push({ name: 'echo', args: args as Record<string, unknown> });
          return { content: [{ type: 'text', text: `external-echo:${args.text}` }] };
        },
      );
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      await server.connect(transport);
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const body =
        chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
      res.on('close', () => {
        void transport.close();
        void server.close();
      });
      await transport.handleRequest(req, res, body);
    })();
  });
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
  const addr = http.address();
  if (!addr || typeof addr === 'string') throw new Error('no address');
  return {
    url: `http://127.0.0.1:${addr.port}/mcp`,
    calls,
    close: () =>
      new Promise<void>((resolve) => {
        http.closeAllConnections();
        http.close(() => resolve());
      }),
  };
}

let stub: StubLlm;
let server: RealServer;
let external: Awaited<ReturnType<typeof startExternalMcp>>;
let handle: MachineHandle;
let paths: StatePaths;
let home: string;
let world: { projectId: string; todoId: string };
let buildId = '';

function logLines(): string[] {
  try {
    return readFileSync(paths.daemonLog, 'utf8').split('\n');
  } catch {
    return [];
  }
}

beforeAll(async () => {
  external = await startExternalMcp();
  stub = await startStubLlm([
    // worker 执行步轮 1：调桥接工具 mcp__demo__echo（外部 MCP server 真调用）。
    { toolCall: { name: 'mcp__demo__echo', arguments: { text: 'm4b-bridge' } } },
    // 轮 2：收尾。
    { content: '已通过外部 MCP 工具 echo 验证连通。' },
  ]);
  server = await bootRealServer({
    providerBaseUrl: stub.url,
    claimHoldMs: 1_000,
    agentDescription: '你是集成测试 Agent：按指令使用工具，然后简短汇报。',
  });
  home = mkdtempSync(join(tmpdir(), 'pacman-m4b-mcp-home-'));
  const config = loadDaemonConfig(
    {
      serverUrl: server.url,
      apiKey: server.apiKey,
      teamId: server.teamId,
      home,
      name: 'm4b-mcp-mbp',
      maxConcurrent: 1,
    },
    {},
  );
  paths = statePaths(config.home, config.workspacesDir);
  const logger = createDaemonLogger({ logFile: paths.daemonLog });
  handle = await runMachine({
    config,
    paths,
    logger,
    idleSleepPrevention: false,
    proxyEnv: {},
    claimBackoffBaseMs: 50,
    heartbeatIntervalMs: 500,
  });
  await waitFor(() => logLines().includes('[wake] push channel connected'), 30_000);
}, 120_000);

afterAll(async () => {
  await handle?.stop();
  await handle?.done;
  await server?.close();
  await stub?.close();
  await external?.close();
  if (home) rmSync(home, { recursive: true, force: true });
  process.stdout.write(
    `\n[diag] stub requests consumed: ${stub?.requests.length ?? -1}\n[diag] daemon.log tail:\n${logLines().slice(-40).join('\n')}\n`,
  );
});

describe('M4b MCP client 面 E2E：团队 server 接入 + per-Agent 授权 + per-turn 桥接（02 §7.1）', () => {
  test('授权 Agent 后执行步真调外部工具；坏端点降级不阻断（canon 行 r3 §1.5）', async () => {
    // 团队 MCP server 接入（REST 管理面，r3 §5.1）：一个活端点 + 一个死端点。
    const created = await api(server.url, 'POST', `/api/teams/${server.teamId}/mcp-servers`, {
      label: '外部演示',
      slug: 'demo',
      transport: 'http',
      url: external.url,
      headers: { Authorization: 'Bearer demo-secret' },
    });
    expect(created.status).toBe(201);
    const dead = await api(server.url, 'POST', `/api/teams/${server.teamId}/mcp-servers`, {
      label: '死端点',
      slug: 'dead',
      transport: 'http',
      url: 'http://127.0.0.1:1/mcp',
    });
    expect(dead.status).toBe(201);

    // per-Agent 授权（「授权在每个 Agent 的页面上单独进行」的 REST 面）。
    const authed = await api(
      server.url,
      'PATCH',
      `/api/teams/${server.teamId}/agents/${AGENT_ID}`,
      {
        mcpServers: ['demo', 'dead'],
      },
    );
    expect(authed.status).toBe(200);

    // 派工执行步（无 repo 裸任务目录即可——本测证桥接不证 git）。
    world = await seedWorld(
      server.url,
      server.teamId,
      { title: 'MCP 桥接探针', spec: '调用外部 echo 工具验证连通。' },
      { projectName: 'm4b-mcp' },
    );
    const started = await api(server.url, 'POST', `/api/projects/${world.projectId}/builds`, {
      todoIds: [world.todoId],
      assignment: { plan: null, build: { agentId: AGENT_ID } },
      withPlan: false,
    });
    expect(started.status).toBe(201);
    buildId = (started.body as { builds: { id: string }[] }).builds[0]!.id;

    await waitFor(() => server.todoPhase(world.todoId) === 'review', 150_000);

    // 外部 MCP server 真收到调用（薄桥端到端实证：pi customTool → sdk client
    // → 外部 server），工具名映射 mcp__demo__echo ↔ 远端 echo。
    expect(external.calls).toEqual([{ name: 'echo', args: { text: 'm4b-bridge' } }]);

    // transcript 工具行落库（bridge 工具名 = mcp__<slug>__<tool>，r3 §5.1）。
    const msgs = server.db
      .select()
      .from(messageTable)
      .where(eq(messageTable.conversationId, buildId))
      .all();
    expect(JSON.stringify(msgs)).toContain('mcp__demo__echo');

    // 死端点降级不阻断：canon 行落 daemon.log，回合照常完成（r3 §1.5 实测行形）。
    const lines = logLines();
    expect(
      lines.some(
        (l) =>
          l.startsWith('[mcp] dead: connect failed — its tools are unavailable this turn') ||
          l.includes('[mcp] dead: connect failed — its tools are unavailable this turn'),
      ),
    ).toBe(true);
  }, 150_000);
});

describe('M4b MCP server 面 E2E：真 sdk Client 连 /api/mcp（02 §7.2）', () => {
  test('Bearer key + 白名单全往返：initialize/list/call；未授工具被拒；属主身份落库', async () => {
    // key：MCP 访问开 + 部分授权（读 Todos/Projects + 写 Create Todo）。
    const key = createApiKey(
      { db: server.db },
      {
        teamId: server.teamId,
        name: 'mcp-client-e2e',
        gitAccess: false,
        mcpAccess: true,
        toolGrants: { read: ['Todos', 'Projects'], write: ['Create Todo'] },
      },
    );
    const transport = new StreamableHTTPClientTransport(new URL(`${server.url}/api/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${key.plaintext}` } },
    });
    const client = new Client({ name: 'e2e-mcp-client', version: '1.0' });
    await client.connect(transport);

    // tools/list = 授出三件（key's tool selection limits every call）。
    const list = await client.listTools();
    expect(list.tools.map((t) => t.name).sort()).toEqual(['create_todo', 'projects', 'todos']);

    // tools/call create_todo → 以 key 属主身份落库（r3 §5.2）。
    const created = await client.callTool({
      name: 'create_todo',
      arguments: { projectId: world.projectId, title: 'MCP 客户端建的任务', spec: '外部客户端建' },
    });
    const text = JSON.stringify(created.content);
    expect(text).toContain('MCP 客户端建的任务');
    const row = server.db
      .select()
      .from(todoTable)
      .all()
      .find((t) => t.title === 'MCP 客户端建的任务');
    expect(row).toBeDefined();
    expect(row!.ownerId).not.toBeNull();

    // 未授工具（machines 未勾）→ 拒绝面（isError 或 JSON-RPC error）。
    let denied = false;
    try {
      const res = await client.callTool({ name: 'machines', arguments: {} });
      denied = res.isError === true;
    } catch {
      denied = true;
    }
    expect(denied).toBe(true);

    await client.close();
  }, 120_000);

  test('注册表白名单保形：24 件 = 读 11 + 写 13（02/A10 单源对拍）', () => {
    expect(MCP_TOOL_REGISTRY).toHaveLength(24);
    expect(MCP_TOOL_REGISTRY.filter((t) => t.kind === 'read')).toHaveLength(11);
    expect(MCP_TOOL_REGISTRY.filter((t) => t.kind === 'write')).toHaveLength(13);
  });
});
