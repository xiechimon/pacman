// #1031 改名落盘面：PATCH /api/user/me（GET 同名 PATCH [推断]，wire 未采——
// wire.test.ts INFERRED_ROUTES 登记；02 §6.1 REST 同名规则族）。
//
// 失败方式枚举（先列后钉）：
//  1. 改名不落库——PATCH 后重读 DB 行仍是旧名（重启即回退）
//  2. 内存 seed 副本不回填——GET /api/user/me、/api/auth/session、members
//     actor 三条读面在 PATCH 成功后仍报旧名（它们全吃 ctx.user 引用）
//  3. 空串/纯空白名被接受——身份位空白落库
//  4. 坏 body（缺字段/非字符串）不是 400 {error} 单形状
//  5. 响应体不是更新后的 UserRecord 全形（web 端 invalidate 前的直接回执）

import { describe, expect, test } from 'vitest';
import { user as userTable } from '../src/db/schema.js';
import { bootServer, req } from './helpers.js';

async function patchName(s: ReturnType<typeof bootServer>, body: unknown) {
  return req(s.app, 'PATCH', '/api/user/me', body);
}

describe('PATCH /api/user/me（#1031 改名往返）', () => {
  test('改名 → 200 回执全形 + DB 行落库 + 三条读面同步新名', async () => {
    const s = bootServer();
    try {
      const res = await patchName(s, { displayName: '新名字' });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.displayName).toBe('新名字');
      expect(body.id).toBe(s.user.id);
      expect(body.avatarUrl).toBeNull();

      // 失败方式 1：DB 行真落库（不是只改内存）
      const row = s.db.select().from(userTable).all()[0];
      expect(row?.displayName).toBe('新名字');

      // 失败方式 2：seed 单用户的三条读面全部同步
      const me = (await (await req(s.app, 'GET', '/api/user/me')).json()) as {
        displayName: string;
      };
      expect(me.displayName).toBe('新名字');
      const session = (await (await req(s.app, 'GET', '/api/auth/session')).json()) as {
        displayName: string;
      };
      expect(session.displayName).toBe('新名字');
      const members = (await (
        await req(s.app, 'GET', `/api/teams/${s.team.id}/members`)
      ).json()) as { actor: { displayName: string } }[];
      expect(members[0]?.actor.displayName).toBe('新名字');
    } finally {
      s.dispose();
    }
  });

  test('二次改名收敛到最后一个值（幂等覆盖，不叠历史）', async () => {
    const s = bootServer();
    try {
      await patchName(s, { displayName: '甲' });
      const res = await patchName(s, { displayName: '乙' });
      expect(((await res.json()) as { displayName: string }).displayName).toBe('乙');
      const me = (await (await req(s.app, 'GET', '/api/user/me')).json()) as {
        displayName: string;
      };
      expect(me.displayName).toBe('乙');
    } finally {
      s.dispose();
    }
  });

  test('空白名一律 400 {error} 单形状——空串 / 纯空格 / 缺字段 / 非字符串', async () => {
    const s = bootServer();
    try {
      for (const bad of [{ displayName: '' }, { displayName: '   ' }, {}, { displayName: 7 }]) {
        const res = await patchName(s, bad);
        expect(res.status, JSON.stringify(bad)).toBe(400);
        const body = (await res.json()) as { error?: unknown };
        expect(typeof body.error, JSON.stringify(bad)).toBe('string');
      }
      // 失败面不落库：旧名原样
      const row = s.db.select().from(userTable).all()[0];
      expect(row?.displayName).toBe(s.user.displayName);
    } finally {
      s.dispose();
    }
  });
});
