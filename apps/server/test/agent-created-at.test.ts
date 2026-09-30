// XMON-18（B4 裁 A）：Agent 创建时间——列 + 写路径 + 读面投影 + 状态行。
//
// 一手来源：docs/research/assets/r5/raw/chief-record-testA.json 的
// `agentActor.createdAt = 1789786840183`（= 2026/9/19），与
// docs/research/assets/r3/53-agent-overview.png 的 `active · 创建于 2026/9/19`
// 逐字吻合——原版 wire 有这一位，本仓缺列，故补列而非发明。
//
// 失败方式清单（先固化，代码是让场景通过的手段）：
// ① 写路径不落值：POST /agents 建出来的 Agent，GET 单条里没有 createdAt。
// ② 旧行被吞：migration 前就存在的 Agent（createdAt 列 NULL）经 record 层
//    变成 0 / undefined，或读面直接抛。
// ③ 两条读面不一致：chief 封套的 agentActor 与 GET agents/{aid} 对同一 Agent
//    给出不同的 createdAt。
// ④ migration 只落得下空库：NOT NULL 无 default 的 ADD COLUMN 会让已有 Agent
//    行的旧库启动即崩（2026-10-01 实测 SQLite 3.53.4 报
//    `Cannot add a NOT NULL column with default value NULL`）——故本列可空。

import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterAll, describe, expect, test } from 'vitest';
import { MIGRATIONS_FOLDER } from '../src/db/client.js';
import { agent as agentTable } from '../src/db/schema.js';
import { newRecordId, nowMs } from '../src/lib/ids.js';
import { bootServer, req } from './helpers.js';

const s = bootServer();
afterAll(() => s.dispose());

const agentUrl = (aid: string) => `/api/teams/${s.team.id}/agents/${aid}`;

describe('Agent 创建时间（读面 + 写路径）', () => {
  test('① POST /agents 建出的 Agent，GET 单条带 createdAt（毫秒数，非占位）', async () => {
    const before = nowMs();
    const created = (await (
      await req(s.app, 'POST', `/api/teams/${s.team.id}/agents`, { displayName: 'XMON-18 新装' })
    ).json()) as { id: string };
    const record = (await (await req(s.app, 'GET', agentUrl(created.id))).json()) as {
      createdAt?: unknown;
    };
    expect(typeof record.createdAt).toBe('number');
    // 不是占位值：落在本次创建的时间窗内（0 = 1970 占位，nowMs 量级 = 1.7e12）。
    expect(record.createdAt as number).toBeGreaterThanOrEqual(before);
    expect(record.createdAt as number).toBeLessThanOrEqual(nowMs());
  });

  test('② 旧行（列 NULL，migration 前就在库里的 Agent）读面给 null，不吞成 0', async () => {
    const legacyId = newRecordId();
    // 直插不写 createdAt = 模拟 migration 之前建的行（列可空故合法）。
    s.db
      .insert(agentTable)
      .values({ id: legacyId, teamId: s.team.id, displayName: 'XMON-18 旧行' })
      .run();
    const res = await req(s.app, 'GET', agentUrl(legacyId));
    expect(res.status).toBe(200);
    const record = (await res.json()) as { createdAt?: unknown };
    expect(record).toHaveProperty('createdAt');
    expect(record.createdAt).toBeNull();
  });

  test('③ chief 封套的 agentActor 与 GET agents/{aid} 同值（两条读面不落队）', async () => {
    const created = (await (
      await req(s.app, 'POST', `/api/teams/${s.team.id}/agents`, { displayName: 'XMON-18 总管' })
    ).json()) as { id: string };
    const bound = await req(s.app, 'PATCH', `/api/teams/${s.team.id}/chief`, {
      agent: { agentId: created.id, thinkingLevel: null },
    });
    expect(bound.status).toBe(200);
    const envelope = (await (await req(s.app, 'GET', `/api/teams/${s.team.id}/chief`)).json()) as {
      agentActor: { id: string; createdAt?: unknown } | null;
    };
    const record = (await (await req(s.app, 'GET', agentUrl(created.id))).json()) as {
      createdAt?: unknown;
    };
    expect(envelope.agentActor?.id).toBe(created.id);
    // 先钉「两位都在」，否则两边同为 undefined 会让相等断言空过。
    expect(typeof envelope.agentActor?.createdAt).toBe('number');
    expect(envelope.agentActor?.createdAt).toBe(record.createdAt);
  });
});

describe('④ migration 对「已有 Agent 行的旧库」可干净应用', () => {
  test('旧库里的 Agent 行跨 migration 存活，createdAt 落 NULL', () => {
    const journal = JSON.parse(
      readFileSync(resolve(MIGRATIONS_FOLDER, 'meta/_journal.json'), 'utf8'),
    ) as { entries: { idx: number; tag: string }[] };
    const entries = [...journal.entries].sort((a, b) => a.idx - b.idx);
    const legacyEntries = entries.slice(0, -1); // 除最新一条 = 「旧安装」的迁移集

    const legacyDir = mkdtempSync(join(tmpdir(), 'pacman-legacy-migrations-'));
    const dbPath = join(legacyDir, 'server.db');
    try {
      mkdirSync(join(legacyDir, 'meta'), { recursive: true });
      for (const entry of legacyEntries) {
        copyFileSync(
          resolve(MIGRATIONS_FOLDER, `${entry.tag}.sql`),
          join(legacyDir, `${entry.tag}.sql`),
        );
        const snapshot = `${String(entry.idx).padStart(4, '0')}_snapshot.json`;
        try {
          copyFileSync(
            resolve(MIGRATIONS_FOLDER, 'meta', snapshot),
            join(legacyDir, 'meta', snapshot),
          );
        } catch {
          // journal 有条目而 snapshot 缺失（仓内 0008 即此形态）——drizzle 接受跳过。
        }
      }
      writeFileSync(
        join(legacyDir, 'meta/_journal.json'),
        JSON.stringify({ ...journal, entries: legacyEntries }, null, 2),
      );

      const openAt = (folder: string) => {
        const sqlite = new Database(dbPath);
        sqlite.pragma('foreign_keys = ON');
        migrate(drizzle(sqlite), { migrationsFolder: folder });
        return sqlite;
      };

      const legacy = openAt(legacyDir);
      legacy.exec(`INSERT INTO team (id,name,createdAt,plan) VALUES ('t-legacy','T',1,'free')`);
      legacy
        .prepare(`INSERT INTO agent (id,teamId,displayName,status) VALUES (?,?,?,?)`)
        .run('a-legacy', 't-legacy', '旧 Agent', 'active');
      legacy.close();

      const upgraded = openAt(MIGRATIONS_FOLDER); // 应用最新一条（含 agent.createdAt）
      const row = upgraded.prepare(`SELECT * FROM agent WHERE id = 'a-legacy'`).get() as Record<
        string,
        unknown
      >;
      expect(row).toBeDefined();
      expect(row.createdAt).toBeNull();
      expect(row.displayName).toBe('旧 Agent');
      upgraded.close();
    } finally {
      rmSync(legacyDir, { recursive: true, force: true });
    }
  });
});
