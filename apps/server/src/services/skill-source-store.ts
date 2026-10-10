// 技能导入来源记录（#1170）：refresh 的数据源。技能本体是本地目录现扫投影
// （spec 13 #367「不入库」域律），来源登记不入 DB——落 server 数据根的
// skill-sources.json（与 repos/、attachments/ 同根：server 自有数据面，不
// 污染用户技能池目录，零 migration；Multica 对照 = 技能行上的 origin config
// JSON——它的技能是 DB 行，pacman 的技能在盘上，等价物即这份侧车登记）。
// 键 = skillId（frontmatter name）；值 = 导入时的来源（kind + ref）与时间。
// 损坏/缺失的文件按空登记处理（refresh 面 409 逐条报错，不炸 server）；
// 下一次成功导入/refresh 会整文件重写。
// 并发：读-改-写无事务——用模块级 promise 链串行化写（导入/refresh 是
// 罕见的人工动作，串行等待零感知）；崩溃窗口由 tmp+rename 原子落位兜底
// （最坏 = 旧文件保持，丢一条来源记录 = 该技能 refresh 409，可重导入自愈）。
// 调用方 await 返回值：写完才算动作成功（201/200 即来源已登记）。

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** 来源种类：localPath（本机目录）/ github（URL，记录 canonical 形）。 */
export type SkillSourceKind = 'localPath' | 'github';

export interface SkillSourceRecord {
  /** 技能身份键 = frontmatter name（与技能目录现扫 id 同值域）。 */
  skillId: string;
  kind: SkillSourceKind;
  /** 来源引用：localPath = resolve 后的绝对路径；github = canonical URL
   * （含 ref——refresh 确定性重拉）。 */
  ref: string;
  /** 导入时刻（epoch ms）。 */
  importedAt: number;
  /** 最近一次 refresh 成功时刻；null = 从未 refresh。 */
  refreshedAt: number | null;
}

/** 盘上文件形（version 自描述，未来形状演进有迁移位）。 */
interface SkillSourcesFile {
  version: 1;
  sources: Record<string, SkillSourceRecord>;
}

const EMPTY_FILE: SkillSourcesFile = { version: 1, sources: {} };

/** 读全文（缺失/损坏 = 空登记——见头注容错律）。 */
function readFile(path: string): SkillSourcesFile {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return EMPTY_FILE;
  }
  try {
    const parsed = JSON.parse(raw) as SkillSourcesFile;
    if (parsed.version !== 1 || typeof parsed.sources !== 'object' || parsed.sources === null) {
      return EMPTY_FILE;
    }
    return parsed;
  } catch {
    return EMPTY_FILE;
  }
}

/** 写串行化（读-改-写无并发交错；崩溃窗口由原子 rename 兜底）。 */
let writeChain: Promise<void> = Promise.resolve();

/** 原子写：同目录 tmp + rename（半写文件永不以正名可见）。 */
function writeFileAtomic(path: string, file: SkillSourcesFile): void {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  const tmp = `${path}.tmp-${Date.now()}`;
  writeFileSync(tmp, `${JSON.stringify(file, null, 2)}\n`);
  renameSync(tmp, path);
}

/** 查一条来源记录（无 = null；refresh 面据此 409）。 */
export function readSkillSource(path: string, skillId: string): SkillSourceRecord | null {
  return readFile(path).sources[skillId] ?? null;
}

/** upsert 一条来源记录（导入 = 新键，refresh = 推进 refreshedAt）。返回
 * promise：排空写链后 resolve——调用方 await 它，「动作成功」即含来源落盘。 */
export function writeSkillSource(path: string, record: SkillSourceRecord): Promise<void> {
  const task = writeChain.then(() => {
    const file = readFile(path);
    file.sources[record.skillId] = record;
    writeFileAtomic(path, file);
  });
  // 链本身串行传递：本条失败不阻断后续写（下次写仍落盘）；失败向上冒给
  // 本条调用方（导入/refresh 显式 500，来源未登记不静默）。
  writeChain = task.catch(() => {});
  return task;
}
