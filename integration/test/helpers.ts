// 集成引导：真 HTTP server（@hono/node-server，非 app.request 面）+ 世界 seed
// （provider 指向 stub LLM + agent + bootstrap apiKey）。三端互不依赖纪律
// 不破：本 harness 以相对路径消费 server/daemon 源码，独立成包。

import { mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { eq } from 'drizzle-orm';
import { createApp } from '../../apps/server/src/app.js';
import { openMemoryDb } from '../../apps/server/src/db/client.js';
import {
  agent as agentTable,
  provider as providerTable,
  todo as todoTable,
} from '../../apps/server/src/db/schema.js';
import { seed } from '../../apps/server/src/db/seed.js';
import { createEphemeralSecretBox } from '../../apps/server/src/lib/secret-box.js';
import { createApiKey } from '../../apps/server/src/services/api-keys.js';
import { TeamStreamHub } from '../../apps/server/src/services/events.js';
import { MachineWakeHub } from '../../apps/server/src/services/machines.js';

export const AGENT_ID = 'agent-it-1';

export interface RealServer {
  url: string;
  teamId: string;
  apiKey: string;
  db: ReturnType<typeof openMemoryDb>;
  /** POST /api/machine/tasks/claim 请求计数（cadence 时序实测面）。 */
  claimCount: () => number;
  todoPhase(todoId: string): string;
  close(): Promise<void>;
}

export async function bootRealServer(opts: {
  providerBaseUrl: string;
  claimHoldMs?: number;
}): Promise<RealServer> {
  const db = openMemoryDb();
  const { user, team } = seed(db);
  const hub = new TeamStreamHub();
  const machineHub = new MachineWakeHub();
  const secretBox = createEphemeralSecretBox();
  const reposDir = mkdtempSync(join(tmpdir(), 'pacman-it-repos-'));
  const app = createApp({
    db,
    hub,
    machineHub,
    secretBox,
    user,
    team,
    pingIntervalMs: 3_600_000,
    claimHoldMs: opts.claimHoldMs ?? 1_000,
    uploads: new Map(),
    enrollments: new Map(),
    reposDir,
  });
  // 机器注册 key 走 M2c 发行服务面（一次性明文，02 §8）。
  const issuedKey = createApiKey(
    { db },
    {
      teamId: team.id,
      name: 'machine-bootstrap',
      gitAccess: false,
      mcpAccess: false,
      toolGrants: { read: [], write: [] },
    },
  );

  let claims = 0;
  const fetchImpl: typeof app.fetch = (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    if (url.includes('/api/machine/tasks/claim')) claims += 1;
    return app.fetch(input as never, init);
  };

  const server = serve({ fetch: fetchImpl, port: 0 });
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const port = (server.address() as AddressInfo).port;
  const url = `http://127.0.0.1:${port}`;

  // 世界 seed：custom provider（指向 stub LLM，无 key 网关）+ agent。
  db.insert(providerTable)
    .values({
      id: 'prov-it',
      teamId: team.id,
      kind: 'custom',
      providerId: 'stub-gw',
      label: 'Stub Gateway',
      baseUrl: opts.providerBaseUrl,
      api: 'openai-completions',
      authHeader: true,
      compat: { supportsDeveloperRole: false },
      models: [{ id: 'stub-model', name: 'stub-model' }],
      createdBy: user.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    .run();
  db.insert(agentTable)
    .values({
      id: AGENT_ID,
      teamId: team.id,
      displayName: 'it-builder',
      description: '你是集成测试执行 Agent：直接简短回答，不使用任何工具。',
      provider: 'stub-gw',
      modelId: 'stub-model',
    })
    .run();

  return {
    url,
    teamId: team.id,
    apiKey: issuedKey.plaintext,
    db,
    claimCount: () => claims,
    todoPhase(todoId: string) {
      return db.select().from(todoTable).where(eq(todoTable.id, todoId)).get()?.phase ?? '';
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        // 长轮询/SSE 连接会挂住 close()——先掐全部活动连接（node:http 面）。
        (server as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
        server.close((err) => (err ? reject(err) : resolve()));
        rmSync(reposDir, { recursive: true, force: true });
      }),
  };
}

/** web 面 REST 调用（自动登录 cookie 面，测试不携凭证）。 */
export async function api(
  url: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text === '' ? null : (JSON.parse(text) as unknown) };
}

export interface WorldIds {
  projectId: string;
  todoId: string;
}

export async function seedWorld(
  url: string,
  teamId: string,
  todo: { title: string; spec: string },
): Promise<WorldIds> {
  const project = await api(url, 'POST', '/api/projects', { name: 'it-project', teamId });
  const projectId = (project.body as { id: string }).id;
  const res = await api(url, 'POST', `/api/projects/${projectId}/todos`, todo);
  const todoId = (res.body as { id: string }).id;
  return { projectId, todoId };
}

export async function waitFor(
  fn: () => boolean | Promise<boolean>,
  timeoutMs = 60_000,
  intervalMs = 100,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await fn()) return;
    if (Date.now() > deadline) throw new Error('waitFor timeout');
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
