// spec 13 升级护栏（#368）：mcp_server 表 drop 之前先把现存行原样导出到
// ~/.pacman/legacy-export-<ts>.json，同 migration 清 agent.mcpServers 为 '[]'
// （旧 slug 随 DB 登记制失效，死引用不留；用户按新本地源重新勾选）。
// 失败方式清单：
//   有行旧库 → 导出文件缺失 / 行内容缺字段 / 表未 drop / agent 列未清；
//   全新库 → 无谓产出导出文件；
//   :memory: → 导出尝试炸库。
// 旧库构造 = 复制 migrations 目录、截掉含 DROP mcp_server 的那条及其后继，
// 先 migrate 到旧终态再插行——升级路径与真实用户一致（journal 续跑）。

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { describe, expect, test } from 'vitest';
import { MIGRATIONS_FOLDER, openDbWithHandle, openMemoryDb } from '../src/db/client.js';
import { agent as agentTable } from '../src/db/schema.js';

/** migrations 副本，止于 DROP mcp_server 那条之前 = 旧版本终态。 */
function oldMigrationsDir(): string {
  const journalPath = join(MIGRATIONS_FOLDER, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
    entries: { idx: number; tag: string }[];
  };
  const dropIdx = journal.entries.findIndex((e) =>
    /DROP TABLE [`"]mcp_server[`"]/.test(
      readFileSync(join(MIGRATIONS_FOLDER, `${e.tag}.sql`), 'utf8'),
    ),
  );
  // 钉扎：本票 migration 必须在场且含 drop（重编号不影响——按内容找不按序号找）。
  expect(dropIdx, 'no migration drops mcp_server').toBeGreaterThan(0);
  const dst = mkdtempSync(join(tmpdir(), 'pacman-old-migrations-'));
  mkdirSync(join(dst, 'meta'));
  const entries = journal.entries.slice(0, dropIdx);
  writeJournal(dst, entries);
  for (const e of entries) {
    copyFileSync(join(MIGRATIONS_FOLDER, `${e.tag}.sql`), join(dst, `${e.tag}.sql`));
  }
  return dst;
}

function writeJournal(dir: string, entries: { idx: number; tag: string }[]): void {
  const src = JSON.parse(
    readFileSync(join(MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8'),
  ) as Record<string, unknown>;
  writeFileSync(join(dir, 'meta', '_journal.json'), JSON.stringify({ ...src, entries }), 'utf8');
}

function legacyExports(home: string): string[] {
  return readdirSync(home).filter((f) => f.startsWith('legacy-export-') && f.endsWith('.json'));
}

describe('legacy export + drop mcp_server（spec 13 migration 护栏）', () => {
  test('有行旧库升级：先导出后 drop，agent.mcpServers 清空', () => {
    const home = mkdtempSync(join(tmpdir(), 'pacman-legacy-home-'));
    const dbPath = join(home, 'server', 'server.db');
    mkdirSync(join(home, 'server'), { recursive: true });

    // 旧终态库：migrate 到 drop 前 + 插 team/agent/mcp_server 行。
    const raw = new Database(dbPath);
    migrate(drizzle(raw), { migrationsFolder: oldMigrationsDir() });
    raw.prepare(`INSERT INTO team (id, name, createdAt) VALUES ('t1', 'legacy', 1)`).run();
    raw
      .prepare(
        `INSERT INTO agent (id, teamId, displayName, mcpServers) VALUES ('a1', 't1', 'w', '["demo"]')`,
      )
      .run();
    raw
      .prepare(
        `INSERT INTO mcp_server (id, teamId, label, slug, transport, url, hasCredential, credentialKeys, command, args, headersCipher, createdBy, createdAt, updatedAt)
         VALUES ('m1', 't1', 'demo', 'demo', 'http', 'https://x.invalid/mcp', 1, '["Authorization"]', NULL, '[]', 'cipher-text', 'u1', 1, 1)`,
      )
      .run();
    raw.close();

    // 升级：openDbWithHandle 导出钩子先跑，migrate 再 drop（home 由 dbPath
    // 布局 <home>/server/server.db 推导——生产同路径）。
    const opened = openDbWithHandle(dbPath);

    const tables = opened.db
      .all<{ name: string }>(sql`SELECT name FROM sqlite_master WHERE type = 'table'`)
      .map((r) => r.name);
    expect(tables).not.toContain('mcp_server');

    const agents = opened.db.select({ mcpServers: agentTable.mcpServers }).from(agentTable).all();
    expect(agents[0]?.mcpServers).toEqual([]);

    const files = legacyExports(home);
    expect(files).toHaveLength(1);
    const dump = JSON.parse(readFileSync(join(home, files[0]!), 'utf8')) as {
      exportedAt: number;
      tables: { mcp_server: Record<string, unknown>[] };
    };
    expect(dump.exportedAt).toBeGreaterThan(0);
    expect(dump.tables.mcp_server).toHaveLength(1);
    expect(dump.tables.mcp_server[0]).toMatchObject({
      id: 'm1',
      slug: 'demo',
      url: 'https://x.invalid/mcp',
      credentialKeys: '["Authorization"]',
    });
    opened.close();
  });

  test('全新库：不产出导出文件', () => {
    const home = mkdtempSync(join(tmpdir(), 'pacman-fresh-home-'));
    const dbPath = join(home, 'server', 'server.db');
    const opened = openDbWithHandle(dbPath);
    expect(legacyExports(home)).toEqual([]);
    opened.close();
  });

  test('二次启动幂等：表已 drop = 不再导出', () => {
    const home = mkdtempSync(join(tmpdir(), 'pacman-reopen-home-'));
    const dbPath = join(home, 'server', 'server.db');
    openDbWithHandle(dbPath).close();
    openDbWithHandle(dbPath).close();
    expect(existsSync(dbPath)).toBe(true);
    expect(legacyExports(home)).toEqual([]);
  });

  test(':memory: 不尝试导出、不炸', () => {
    expect(() => openMemoryDb()).not.toThrow();
  });
});
