// 测试引导：内存库 + migration + seed + app（wire 对拍面，04 §3）。

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Hono } from 'hono';
import { createApp } from '../src/app.js';
import { openMemoryDb } from '../src/db/client.js';
import { apiKey } from '../src/db/schema.js';
import { seed } from '../src/db/seed.js';
import { sha256Hex } from '../src/lib/crypto.js';
import { newRecordId } from '../src/lib/ids.js';
import { createEphemeralSecretBox } from '../src/lib/secret-box.js';
import { TeamStreamHub } from '../src/services/events.js';
import { MachineWakeHub } from '../src/services/machines.js';

export function bootServer(
  opts: { pingIntervalMs?: number; claimHoldMs?: number; reposDir?: string } = {},
) {
  const db = openMemoryDb();
  const { user, team } = seed(db);
  const hub = new TeamStreamHub();
  const machineHub = new MachineWakeHub();
  // 随机 key 驻内存（keyfile 落盘面 = test/secret-box.test.ts 专测）。
  const secretBox = createEphemeralSecretBox();
  // 自建临时 reposDir（git 托管面实走用）；显式传入时由调用方管理生命周期。
  const ownReposDir = opts.reposDir === undefined;
  const reposDir = opts.reposDir ?? mkdtempSync(join(tmpdir(), 'pacman-server-repos-'));
  const app = createApp({
    db,
    hub,
    machineHub,
    secretBox,
    user,
    team,
    // 默认拉长 ping 间隔，避免噪音；SSE 测试显式缩短。
    pingIntervalMs: opts.pingIntervalMs ?? 3_600_000,
    // claim 长轮询 hold 默认缩短，时序测试显式给值。
    claimHoldMs: opts.claimHoldMs ?? 250,
    uploads: new Map(),
    enrollments: new Map(),
    reposDir,
  });
  return {
    app,
    db,
    hub,
    machineHub,
    secretBox,
    user,
    team,
    reposDir,
    svc: { db, hub, machineHub, user },
    dispose(): void {
      if (ownReposDir) rmSync(reposDir, { recursive: true, force: true });
    },
  };
}

/** 机器注册用 API key：走 M2c 发行端点（POST /api/teams/{id}/api-keys，
 * 一次性明文语义，02 §8/r3 §6）。 */
export async function issueApiKey(s: ReturnType<typeof bootServer>): Promise<string> {
  const res = await req(s.app, 'POST', `/api/teams/${s.team.id}/api-keys`, {
    name: 'machine-bootstrap',
    gitAccess: false,
    mcpAccess: false,
    toolGrants: { read: [], write: [] },
  });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`issueApiKey: ${res.status}`);
  }
  const body = (await res.json()) as { plaintext?: string; apiKey?: string; key?: string };
  const plain = body.plaintext ?? body.apiKey ?? body.key;
  if (!plain) throw new Error(`issueApiKey: no plaintext in ${JSON.stringify(body)}`);
  return plain;
}

export type TestServer = ReturnType<typeof bootServer>;

const jsonHeaders = { 'content-type': 'application/json' };

export function req(app: Hono, method: string, path: string, body?: unknown): Promise<Response> {
  return Promise.resolve(
    app.request(path, {
      method,
      headers: body !== undefined ? jsonHeaders : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  );
}

export async function postProject(app: Hono, name = 'demo'): Promise<string> {
  const res = await req(app, 'POST', '/api/projects', { name });
  if (res.status !== 201) throw new Error(`postProject: ${res.status}`);
  const body = (await res.json()) as { id: string };
  return body.id;
}

/** 直插 gitAccess api_key 行（存哈希不存可逆值，02 §8；key 发行端点归 M2c，
 * git 面测试用本 helper 供凭证）。 */
export function insertGitApiKey(s: TestServer, secret: string): string {
  const id = newRecordId();
  s.db
    .insert(apiKey)
    .values({
      id,
      teamId: s.team.id,
      name: 'git-e2e',
      gitAccess: true,
      mcpAccess: false,
      toolGrants: { read: [], write: [] },
      keyHash: sha256Hex(secret),
      masked: `${secret.slice(0, 12)}…`,
      createdAt: Date.now(),
    })
    .run();
  return id;
}

/** SSE 连接读取器：帧 = `data: <json>\n\n`（team stream 无 event 名，
 * 类型在载荷 type 字段，r3 §8.1/r5 §7.2 原样）。 */
export async function openStream(app: Hono, teamId: string) {
  const ctrl = new AbortController();
  const res = await app.request(`/api/teams/${teamId}/stream`, { signal: ctrl.signal });
  if (!res.body) throw new Error('stream response has no body');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  const pending: unknown[] = [];

  async function pump(deadline: number): Promise<void> {
    while (Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) return;
      buf += decoder.decode(value, { stream: true });
      let idx = buf.indexOf('\n\n');
      while (idx >= 0) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        for (const line of frame.split('\n')) {
          if (line.startsWith('data:')) pending.push(JSON.parse(line.slice(5).trim()));
        }
        idx = buf.indexOf('\n\n');
      }
      if (pending.length > 0) return;
    }
  }

  return {
    /** 读取直到 match 命中的事件（丢弃不匹配帧），超时抛错。 */
    async next(
      match: (ev: Record<string, unknown>) => boolean,
      timeoutMs = 3000,
    ): Promise<Record<string, unknown>> {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const hit = pending.findIndex((ev) => match(ev as Record<string, unknown>));
        if (hit >= 0) return pending.splice(hit, 1)[0] as Record<string, unknown>;
        await pump(deadline);
        if (
          pending.findIndex((ev) => match(ev as Record<string, unknown>)) < 0 &&
          Date.now() >= deadline
        ) {
          throw new Error(`stream timeout waiting for event (buffered ${pending.length})`);
        }
      }
    },
    close(): void {
      ctrl.abort();
      void reader.cancel().catch(() => {});
    },
  };
}
