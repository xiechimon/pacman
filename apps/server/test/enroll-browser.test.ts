// 浏览器授权流（W4 #285，02 §5.2 路径一）：enroll/start（name 保留）→
// poll（pending/authorized/expired 三态）→ confirm（capability=enrollId 单次；
// 建机无 apiKey）。失败方式枚举先于实现固化（票 #285 AC）：
//   1. start → enrollId + capability URL 形
//   2. poll pending / 未知 id expired
//   3. confirm 未知/过期 → 404 不静默
//   4. confirm ok → machine 行（apiKeyId null + tokenHash）+ poll authorized
//   5. 双重 confirm → 409（单次纪律）

import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { machine as machineTable } from '../src/db/schema.js';
import { bootServer, req } from './helpers.js';

describe('浏览器授权流（W4 #285）', () => {
  test('start → poll pending → confirm → authorized；未知/双重/失效门', async () => {
    const s = bootServer();
    // 失败方式 1：start 无参 → 默认团队 + capability URL。
    const started = await req(s.app, 'POST', '/api/machine/enroll/start', {
      name: 'mbp-14',
    });
    expect(started.status).toBe(200); // 既有 start 路由口径（c.json 默认 200）
    const startBody = (await started.json()) as { enrollId: string; url: string };
    expect(startBody.url).toContain(`/app/machines/authorize?enroll=${startBody.enrollId}`);

    // 失败方式 2：pending / 未知 id expired。
    const pending = await req(s.app, 'POST', '/api/machine/enroll/poll', {
      enrollId: startBody.enrollId,
    });
    expect(await pending.json()).toEqual({ status: 'pending' });
    const unknown = await req(s.app, 'POST', '/api/machine/enroll/poll', {
      enrollId: 'nope',
    });
    expect(await unknown.json()).toEqual({ status: 'expired' });

    // 失败方式 3：confirm 未知 → 404 不静默。
    const bad = await req(s.app, 'POST', '/api/machine/enroll/confirm', { enrollId: 'nope' });
    expect(bad.status).toBe(404);
    expect(Object.keys((await bad.json()) as object)).toEqual(['error']);

    // 失败方式 4：confirm ok → machine.json + DB 行（name 保留 + 无 apiKey）。
    const confirmed = await req(s.app, 'POST', '/api/machine/enroll/confirm', {
      enrollId: startBody.enrollId,
    });
    expect(confirmed.status).toBe(200);
    const { machine } = (await confirmed.json()) as {
      machine: { machineId: string; token: string; teamId: string; serverUrl: string };
    };
    expect(machine.teamId).toBe(s.team.id);
    expect(machine.serverUrl).toContain('http');
    const row = s.db
      .select()
      .from(machineTable)
      .where(eq(machineTable.id, machine.machineId))
      .get();
    expect(row).toMatchObject({
      teamId: s.team.id,
      name: 'mbp-14',
      apiKeyId: null,
      online: false,
    });
    expect(row?.tokenHash).toBeTruthy();

    // poll → authorized + machine 载荷。
    const after = await req(s.app, 'POST', '/api/machine/enroll/poll', {
      enrollId: startBody.enrollId,
    });
    expect(await after.json()).toEqual({ status: 'authorized', machine });

    // 失败方式 5：双重 confirm → 409（capability 单次）。
    const again = await req(s.app, 'POST', '/api/machine/enroll/confirm', {
      enrollId: startBody.enrollId,
    });
    expect(again.status).toBe(409);
  });
});
