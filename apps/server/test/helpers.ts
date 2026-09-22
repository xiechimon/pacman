// 测试引导：内存库 + migration + seed + app（wire 对拍面，04 §3）。

import type { Hono } from 'hono';
import { createApp } from '../src/app.js';
import { openMemoryDb } from '../src/db/client.js';
import { seed } from '../src/db/seed.js';
import { TeamStreamHub } from '../src/services/events.js';
import { MachineWakeHub } from '../src/services/machines.js';

export function bootServer(opts: { pingIntervalMs?: number; claimHoldMs?: number } = {}) {
  const db = openMemoryDb();
  const { user, team, bootstrapApiKey } = seed(db);
  const hub = new TeamStreamHub();
  const machineHub = new MachineWakeHub();
  const app = createApp({
    db,
    hub,
    machineHub,
    user,
    team,
    // 默认拉长 ping 间隔，避免噪音；SSE 测试显式缩短。
    pingIntervalMs: opts.pingIntervalMs ?? 3_600_000,
    // claim 长轮询 hold 默认缩短，时序测试显式给值。
    claimHoldMs: opts.claimHoldMs ?? 250,
    uploads: new Map(),
    enrollments: new Map(),
  });
  return {
    app,
    db,
    hub,
    machineHub,
    user,
    team,
    bootstrapApiKey,
    svc: { db, hub, machineHub },
  };
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
