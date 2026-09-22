// DB 打开与 migration 应用（01 §4.2：better-sqlite3 + Drizzle，migration 进
// repo；启动即 migrate，drift 校验在 CI）。

import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { type BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.js';

export type Db = BetterSQLite3Database<typeof schema>;

/** migration 目录 = apps/server/drizzle（drizzle-kit generate 产物，进 repo）。 */
export const MIGRATIONS_FOLDER = resolve(dirname(fileURLToPath(import.meta.url)), '../../drizzle');

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
