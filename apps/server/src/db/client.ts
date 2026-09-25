// DB 打开与 migration 应用（01 §4.2：better-sqlite3 + Drizzle，migration 进
// repo；启动即 migrate，drift 校验在 CI）。

import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { type BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.js';

export type Db = BetterSQLite3Database<typeof schema>;

/** migration 目录双探测（06 §11 包内形态）：源码形态 = apps/server/drizzle
 * （本模块 apps/server/src/db → 上两级）；bundle 形态 = 包根 `drizzle/`
 * （本文件内联进 dist/index.mjs → 上一级 = 包根，pack 原位收录）。
 * 探测锚 = journal 文件；两者都不存在时回落源码形态路径（migrate 报错
 * 路径即真因）。 */
function resolveMigrationsFolder(): string {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const candidates: readonly [string, string] = [
    resolve(moduleDir, '../../drizzle'), // 源码：apps/server/drizzle
    resolve(moduleDir, '../drizzle'), // bundle：包根/drizzle
  ];
  for (const folder of candidates) {
    if (existsSync(join(folder, 'meta', '_journal.json'))) return folder;
  }
  return candidates[0];
}

export const MIGRATIONS_FOLDER = resolveMigrationsFolder();

export interface OpenedDb {
  db: Db;
  close(): void;
}

export function openDbWithHandle(dbPath: string): OpenedDb {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db, close: () => sqlite.close() };
}

export function openDb(dbPath: string): Db {
  return openDbWithHandle(dbPath).db;
}

/** 测试面内存库：同一 migration 路径（顺带验证 migration 可干净应用）。 */
export function openMemoryDb(): Db {
  return openDb(':memory:');
}
