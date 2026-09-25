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

/** migration 目录双探测（06 册 §11 W2 主包形态）：src 形态 = apps/server/
 * drizzle（drizzle-kit generate 产物，进 repo；本模块 = src/db/client.ts 向上
 * 两级）；bundle 形态（dist/index.mjs，含发布包 `<pkg>/dist`）= 同目录 `../
 * drizzle`——src/ 与 dist/ 同深，两形态各自命中。判据 = `meta/_journal.json`
 * （migrate 真正消费的入口，与 schema.test.ts 同源标记）；未命中取 bundle
 * 形态兜底，把「目录不存在」留给 migrate 直抛（不静默降级）。 */
function resolveMigrationsFolder(): string {
  const here = dirname(fileURLToPath(import.meta.url)); // src/db | dist | <pkg>/dist
  const srcForm = resolve(here, '../../drizzle');
  const bundleForm = resolve(here, '../drizzle');
  return existsSync(join(srcForm, 'meta', '_journal.json')) ? srcForm : bundleForm;
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
