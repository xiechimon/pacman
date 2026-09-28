// 升级护栏（spec 13/#368）：登记制撤除面 drop 之前，把现存行原样导出到
// `<PACMAN_HOME>/legacy-export-<ts>.json`——用户旧登记数据可回溯（release
// note 引导按新本地源重新勾选）。调用点 = db/client.ts openDbWithHandle 的
// migrate 前置钩子（migrate 内含 DROP TABLE，导出必须先跑）。
// 值边界：headersCipher 等密文列在导出中保持密文（SecretBox keyfile 同在
// home 下，本地备份语义；明文永不扩散）。
// 表存在性判定 = 导出触发条件：全新库/已升级库无该表 = no-op（幂等，二次
// 启动不重复产出）；:memory: 无遗留面，client.ts 侧跳过。

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';

/** 本票撤除的登记制表集（spec 13 T2 = mcp_server；T1 的 skill 表归 #367，
 * 合并期两票导出集在此汇合）。 */
const LEGACY_TABLES = ['mcp_server'] as const;

export interface LegacyExport {
  exportedAt: number;
  tables: Record<string, unknown[]>;
}

/** 导出仍存在的 legacy 表行；无表/无行 = 不产出文件（返回 null）。 */
export function exportLegacyTables(sqlite: Database.Database, homeDir: string): string | null {
  const tables: Record<string, unknown[]> = {};
  for (const table of LEGACY_TABLES) {
    const present = sqlite
      .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`)
      .get(table);
    if (!present) continue;
    const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all();
    if (rows.length === 0) continue; // 空表无可失，不落文件
    tables[table] = rows;
  }
  if (Object.keys(tables).length === 0) return null;
  mkdirSync(homeDir, { recursive: true });
  const exportedAt = Date.now();
  const file = join(homeDir, `legacy-export-${exportedAt}.json`);
  const dump: LegacyExport = { exportedAt, tables };
  writeFileSync(file, `${JSON.stringify(dump, null, 2)}\n`, 'utf8');
  return file;
}
