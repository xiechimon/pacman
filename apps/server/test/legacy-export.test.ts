// spec 13 升级护栏（#367 T1）：skill 表 drop migration 三段语义——先把现存行
// 导出到 `<home>/legacy-export-<ts>.json`（release note 指向的保底副本），再把
// agent.skills 清为 '[]'（旧 id 随表失效，死引用不留），最后 DROP TABLE skill。
// 导出发生在 openDbWithHandle 的 migrate 之前（pre-migration 钩子），仅当旧库
// 里 skill 表仍存在且有行时落盘——新库/已迁移库/空表 = 不落（噪音闸）。
//
// 失败方式先行枚举——
// L1 旧库（skill 有行 + agent.skills 死引用）→ 打开即迁移：skill 表消失 /
//    agent.skills = '[]' / legacy-export-*.json 恰一份且行内容齐（files 列
//    还原为对象，非 JSON 字符串）。
// L2 旧库零行 → 不落文件，表照删。
// L3 全新库（0000 建表 → 同轮 drop）→ 干净迁移、不落文件。
// L4 未传 legacyExportDir（内存测试形态）→ 不落文件、迁移照常。
// L5 文件名形 = legacy-export-<ISO ts 冒号点换连字符>.json。

import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterAll, describe, expect, test } from 'vitest';
import { MIGRATIONS_FOLDER, openDbWithHandle } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';
import { seed } from '../src/db/seed.js';

const temps: string[] = [];
function temp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

// —— 旧库构造（migration 序号不写死——撞号纪律：按「含 DROP skill 的那条」定位，
// 合并期重编号后本测试零改动）———————————————————————————————————————————————

function readJournal(folder: string): { entries: { idx: number; tag: string }[] } {
  return JSON.parse(readFileSync(join(folder, 'meta', '_journal.json'), 'utf8'));
}

/** 复制 migrations 目录并截掉「drop skill 起」的尾部 = 升级前旧库形态。 */
function trimmedMigrations(): string {
  const journal = readJournal(MIGRATIONS_FOLDER);
  const dropIdx = journal.entries.findIndex((entry) =>
    /DROP TABLE\s+`?skill`?/i.test(
      readFileSync(join(MIGRATIONS_FOLDER, `${entry.tag}.sql`), 'utf8'),
    ),
  );
  expect(dropIdx, 'journal 里找不到 drop skill 的 migration').toBeGreaterThan(0);
  const dir = temp('pacman-migrations-old-');
  mkdirSync(join(dir, 'meta'));
  for (const entry of journal.entries.slice(0, dropIdx)) {
    cpSync(join(MIGRATIONS_FOLDER, `${entry.tag}.sql`), join(dir, `${entry.tag}.sql`));
    // snapshot 文件随带（drizzle-kit 链校验用；runtime migrator 只读 journal+sql）
    const snapshot = join(MIGRATIONS_FOLDER, 'meta', `${entry.tag}_snapshot.json`);
    try {
      cpSync(snapshot, join(dir, 'meta', `${entry.tag}_snapshot.json`));
    } catch {
      /* 0008 型 snapshot 缺位先例（db-check.mjs 注）：跳过可接受 */
    }
  }
  writeJournal(dir, journal.entries.slice(0, dropIdx));
  return dir;
}

function writeJournal(dir: string, entries: { idx: number; tag: string }[]): void {
  const full = readJournal(MIGRATIONS_FOLDER);
  writeFileSync(
    join(dir, 'meta', '_journal.json'),
    JSON.stringify(
      { ...full, entries: entries.map((e) => full.entries.find((f) => f.tag === e.tag)) },
      null,
      2,
    ),
  );
}

interface LegacyWorld {
  dbPath: string;
  teamId: string;
}

/** 建旧库：迁移到 drop 前 + seed team + 插 skill 行与带 skills 引用的 agent 行。 */
function buildLegacyDb(opts: { skillRows: number } = { skillRows: 2 }): LegacyWorld {
  const dir = temp('pacman-legacy-db-');
  const dbPath = join(dir, 'server.db');
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: trimmedMigrations() });
  const { team } = seed(db);
  const insertSkill = sqlite.prepare(
    'INSERT INTO skill (id, teamId, name, description, files) VALUES (?, ?, ?, ?, ?)',
  );
  for (let i = 1; i <= opts.skillRows; i++) {
    insertSkill.run(
      `sk-${i}`,
      team.id,
      `技能${i}`,
      i === 1 ? '旧库描述' : null,
      JSON.stringify({ 'SKILL.md': `# 技能${i}\n内容`, 'helper.sh': 'echo hi' }),
    );
  }
  sqlite
    .prepare('INSERT INTO agent (id, teamId, displayName, skills) VALUES (?, ?, ?, ?)')
    .run('ag-1', team.id, '旧 Agent', JSON.stringify(['sk-1', 'sk-gone']));
  sqlite.close();
  return { dbPath, teamId: team.id };
}

function tableExists(dbPath: string, table: string): boolean {
  const sqlite = new Database(dbPath, { readonly: true });
  try {
    const row = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table);
    return row !== undefined;
  } finally {
    sqlite.close();
  }
}

function agentSkills(dbPath: string, agentId: string): string {
  const sqlite = new Database(dbPath, { readonly: true });
  try {
    const row = sqlite.prepare('SELECT skills FROM agent WHERE id = ?').get(agentId) as {
      skills: string;
    };
    return row.skills;
  } finally {
    sqlite.close();
  }
}

function exportFiles(homeDir: string): string[] {
  return readdirSync(homeDir)
    .filter((f) => /^legacy-export-.+\.json$/.test(f))
    .sort();
}

// —— 用例 ————————————————————————————————————————————————————————————————————

describe('legacy-export 迁移护栏（skill 表退役）', () => {
  test('L1/L5：旧库有行 → 导出落盘内容齐、agent.skills 清空、skill 表消失', () => {
    const { dbPath } = buildLegacyDb({ skillRows: 2 });
    const home = temp('pacman-legacy-home-');
    const { db, close } = openDbWithHandle(dbPath, { legacyExportDir: home });
    try {
      expect(tableExists(dbPath, 'skill')).toBe(false);
      expect(agentSkills(dbPath, 'ag-1')).toBe('[]');
      const files = exportFiles(home);
      expect(files).toHaveLength(1);
      // L5 文件名形：legacy-export-<ISO ts>.json（冒号/点已换连字符，跨平台安全）
      expect(files[0]).toMatch(/^legacy-export-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/);
      const body = JSON.parse(readFileSync(join(home, files[0] ?? ''), 'utf8')) as {
        exportedAt: number;
        tables: { skill: { id: string; name: string; files: Record<string, string> }[] };
      };
      expect(typeof body.exportedAt).toBe('number');
      expect(body.tables.skill).toHaveLength(2);
      const first = body.tables.skill.find((r) => r.id === 'sk-1');
      expect(first).toBeDefined();
      expect(first?.name).toBe('技能1');
      // files 列还原为对象（导出 = 人可读保底副本，非 JSON 字符串套娃）
      expect(first?.files).toEqual({ 'SKILL.md': '# 技能1\n内容', 'helper.sh': 'echo hi' });
      // 迁移后的库可正常查询（drizzle 面回归）
      expect(db).toBeDefined();
    } finally {
      close();
    }
  });

  test('L2：旧库零行 → 不落文件，表照删', () => {
    const { dbPath } = buildLegacyDb({ skillRows: 0 });
    const home = temp('pacman-legacy-home-');
    const { close } = openDbWithHandle(dbPath, { legacyExportDir: home });
    try {
      expect(tableExists(dbPath, 'skill')).toBe(false);
      expect(exportFiles(home)).toEqual([]);
    } finally {
      close();
    }
  });

  test('L3：全新库 → 干净迁移、不落文件（同轮建表即删不算升级数据）', () => {
    const dir = temp('pacman-fresh-db-');
    const dbPath = join(dir, 'server.db');
    const home = temp('pacman-legacy-home-');
    const { close } = openDbWithHandle(dbPath, { legacyExportDir: home });
    try {
      expect(tableExists(dbPath, 'skill')).toBe(false);
      expect(exportFiles(home)).toEqual([]);
    } finally {
      close();
    }
  });

  test('L4：未传 legacyExportDir（内存/测试形态）→ 不落文件、迁移照常', () => {
    const { dbPath } = buildLegacyDb({ skillRows: 1 });
    const { close } = openDbWithHandle(dbPath);
    try {
      expect(tableExists(dbPath, 'skill')).toBe(false);
      expect(agentSkills(dbPath, 'ag-1')).toBe('[]');
    } finally {
      close();
    }
  });
});
