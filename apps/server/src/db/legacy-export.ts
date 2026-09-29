// 升级护栏导出（spec 13）：退役表在 drop migration 应用**前**把现存行导出到
// `<legacyExportDir>/legacy-export-<ts>.json`（release note 指向的保底副本——
// 旧登记数据可人工找回，agent 授权勾选重新勾一次即可）。
//
// 本票撤除的登记制面 = T1 skill（#367）+ T2 mcp_server（#368），两票合并期
// 导出集在此汇合。
//
// 触发窗 = 「表还在盘上」的唯一一次启动：全新库（同轮建表即删）与已迁移库
// 均无表 → 不落文件；表在但零行 → 不落（空导出 = 噪音）。导出失败**阻断
// 启动**（fail loudly——静默跳过等于亲手丢掉护栏要保的数据；home 不可写时
// DB 本身也开不起来，语义一致）。
//
// 值边界：密文列（mcp_server.headersCipher）在导出中保持密文（SecretBox
// keyfile 同在 home 下，本地备份语义；明文永不扩散）。
//
// 扩展位：LEGACY_TABLES 逐表登记，jsonColumns 把 TEXT 存 JSON 的列还原为
// 对象（人可读副本，非 JSON 字符串套娃）。

import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';

interface LegacyTableSpec {
  name: string;
  /** TEXT 存 JSON 的列（导出时 parse 还原；坏值保留原串）。 */
  jsonColumns: readonly string[];
}

const LEGACY_TABLES: readonly LegacyTableSpec[] = [
  { name: 'skill', jsonColumns: ['files'] }, // spec 13 T1（#367）
  { name: 'mcp_server', jsonColumns: ['credentialKeys', 'args'] }, // spec 13 T2（#368）
];

function tableExists(sqlite: Database.Database, table: string): boolean {
  const row = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table);
  return row !== undefined;
}

function tryParseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value; // 坏值保留原串（无损优先）
  }
}

/** 文件名 ts 形：ISO-8601 的冒号/点换连字符（跨平台文件名安全）。 */
function exportFileName(now: Date): string {
  return `legacy-export-${now.toISOString().replaceAll(':', '-').replaceAll('.', '-')}.json`;
}

/** migrate 前调用（db/client.ts 唯一接线位）。legacyExportDir 缺省 = 跳过
 * （内存/测试形态无升级语义）。 */
export function exportLegacyTables(
  sqlite: Database.Database,
  legacyExportDir: string | undefined,
  now: Date = new Date(),
): void {
  if (legacyExportDir === undefined) return;
  const tables: Record<string, unknown[]> = {};
  let rowCount = 0;
  for (const spec of LEGACY_TABLES) {
    if (!tableExists(sqlite, spec.name)) continue;
    const rows = sqlite.prepare(`SELECT * FROM \`${spec.name}\``).all() as Record<
      string,
      unknown
    >[];
    if (rows.length === 0) continue; // 零行 = 不落（噪音闸）
    tables[spec.name] = rows.map((row) => {
      const out: Record<string, unknown> = { ...row };
      for (const col of spec.jsonColumns) {
        if (col in out) out[col] = tryParseJson(out[col]);
      }
      return out;
    });
    rowCount += rows.length;
  }
  if (rowCount === 0) return;
  mkdirSync(legacyExportDir, { recursive: true });
  const file = join(legacyExportDir, exportFileName(now));
  writeFileSync(
    file,
    `${JSON.stringify({ exportedAt: now.getTime(), tables }, null, 2)}\n`,
    'utf8',
  );
}

/** 诊断/测试面：目录里现有的导出文件名（字典序）。 */
export function listLegacyExports(legacyExportDir: string): string[] {
  try {
    return readdirSync(legacyExportDir)
      .filter((f) => /^legacy-export-.+\.json$/.test(f))
      .sort();
  } catch {
    return [];
  }
}
