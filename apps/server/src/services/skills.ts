// skills 领域服务（spec 13 资源面本地化，#367 T1）——本地目录现扫只读投影。
// 每个含 SKILL.md 的一级子目录 = 一个技能；不入库、无缓存，每次请求现扫。
// 身份模型（2026-09-29 合同修订，对齐 spec 14 daemon 注入契约）：
// id = SKILL.md frontmatter name，无 frontmatter / 无 name 回落目录名
// （agentskills.io / pi v0.86.0 同律：frontmatter.name 主键）。
// 去重（同律）：realpath 相同（符号链接别名）只算一条；id 冲突 = 目录名
// 字典序先者胜 [设计]（确定性，无静默双条）。
// 容错（spec 13 premortem 护栏）：技能根缺失/不可读 = 空集不炸 server；
// 单目录读取失败（SKILL.md 中途消失/是目录/无权限）= 跳过该条不炸全局。
//
// frontmatter 解析 = 最小解析器 [设计]（仓内无 yaml 依赖，单行为值、可引号
// 包裹；折叠块标量标记（`>`/`|` 族）与多行值不受理 = 按缺省回落目录名 /
// null——真打 anthropics/skills 实测 academy-guide 即 `description: >`
// 折叠形，语义承自旧 GitHub 扫描面 #223，parser 原样保留）。

import {
  type Dirent,
  readdirSync,
  readFileSync,
  realpathSync,
  type Stats,
  statSync,
} from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { SKILL_ENTRY_FILE } from '@pacman/shared';
import { HttpError } from '../lib/errors.js';

/** 单文件内容读上限（承自旧 fetch 面容量闸 [设计]：文本投影经 JSON 下发，
 * 超大二进制/数据文件不进 wire）。 */
const MAX_SKILL_FILE_BYTES = 512_000;

/** 现扫产物（wire SkillRecord 的 server 内部形——dirName 供 detail/file
 * 端点解析盘位，不出 wire）。 */
export interface LocalSkill {
  /** 身份键：frontmatter name，回落目录名（agent.skills[] 同值域）。 */
  id: string;
  /** 显示名 = 与 id 同源（frontmatter name 回落目录名）。 */
  name: string;
  description: string | null;
  /** 所在目录名（技能根的一级子目录）。 */
  dirName: string;
}

/** SKILL.md frontmatter 最小解析（文件头注纪律）；无块/缺字段 → 空洞回落。 */
export function parseSkillFrontmatter(content: string): {
  name?: string;
  description?: string;
} {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  const block = m?.[1];
  if (block === undefined) return {};
  const out: { name?: string; description?: string } = {};
  for (const line of block.split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    const key = kv?.[1];
    if (key !== 'name' && key !== 'description') continue;
    const value = (kv?.[2] ?? '')
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2')
      .trim();
    // 折叠/文字块标量标记（>、|、>-、|+…）= 多行值，最小解析器不受理 → 缺省回落。
    if (value !== '' && !/^[>|][+-]?$/.test(value)) out[key] = value;
  }
  return out;
}

/** 现扫技能根：一级子目录（含符号链接目录）中 SKILL.md 在盘者各出一条，
 * 输出按 id 字典序（确定性 wire 序）。任何 fs 失败 = 空集/跳过（头注容错律）。 */
export function scanLocalSkills(skillsDir: string): LocalSkill[] {
  let entryNames: string[];
  try {
    entryNames = readdirSync(skillsDir, { withFileTypes: true }).map((e) => e.name);
  } catch {
    return []; // 根缺失 / 非目录 / 不可读 = 空集（不炸）
  }
  const dirNames: string[] = [];
  for (const name of entryNames) {
    try {
      // statSync 跟随符号链接：链接目录同律收录（realpath 去重在下游）。
      if (statSync(join(skillsDir, name)).isDirectory()) dirNames.push(name);
    } catch {
      // 中途消失/坏链接 = 跳过
    }
  }
  dirNames.sort((a, b) => a.localeCompare(b));
  const out: LocalSkill[] = [];
  const seenReal = new Set<string>();
  const seenId = new Set<string>();
  for (const dirName of dirNames) {
    const dir = join(skillsDir, dirName);
    let real: string;
    try {
      real = realpathSync(dir);
    } catch {
      continue;
    }
    if (seenReal.has(real)) continue; // 符号链接别名 = 同一技能
    let content: string;
    try {
      // canon 名精确匹配（SKILL_ENTRY_FILE）：大小写不敏感文件系统（macOS/
      // Windows）上 readFileSync('SKILL.md') 会命中 skill.md——先 readdir
      // 验名录里确有精确大小写条目，再读。
      if (!readdirSync(dir).includes(SKILL_ENTRY_FILE)) continue;
      content = readFileSync(join(dir, SKILL_ENTRY_FILE), 'utf8');
    } catch {
      continue; // 无 SKILL.md / 不可读（中途消失、是目录、无权限）= 不是技能
    }
    seenReal.add(real);
    const fm = parseSkillFrontmatter(content);
    const id = fm.name ?? dirName;
    if (seenId.has(id)) continue; // id 冲突 = 目录名序先者胜 [设计]
    seenId.add(id);
    out.push({ id, name: id, description: fm.description ?? null, dirName });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/** id → 技能 + 盘位（detail/file 端点用）。未知 id / 不安全段 = null（路由
 * 面 404；sid 是 URL 段，虽经 scan 匹配仍显式挡 `..`、分隔符——纵深防御）。 */
export function resolveLocalSkill(
  skillsDir: string,
  id: string,
): { skill: LocalSkill; dir: string } | null {
  if (id === '' || id === '.' || id === '..' || id.includes('/') || id.includes('\\')) {
    return null;
  }
  const skill = scanLocalSkills(skillsDir).find((s) => s.id === id);
  if (!skill) return null;
  return { skill, dir: join(skillsDir, skill.dirName) };
}

/** 技能目录文件清单（相对路径、posix 分隔、含 SKILL.md 自身，字典序）。
 * 递归 walk；单条目失败跳过（容错律同 scan）。 */
export function listSkillFiles(skillDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        out.push(relative(skillDir, full).split(sep).join('/'));
      }
      // 符号链接/特殊文件不入清单（文本投影面只对常规文件诚实 [设计]）
    }
  };
  walk(skillDir);
  return out.sort((a, b) => a.localeCompare(b));
}

/** 技能目录内单文件读（文本投影）。fileName 逃逸/绝对路径/不在盘/非常规
 * 文件/符号链接出目录 = null（路由面 404，不泄露存在性）；超容量闸 = 400
 * （点名上限）。逃逸判定双道：文本 resolve 前缀闸 + realpath 解析后仍在
 * 技能目录内（文件级符号链接指向目录外时拒读——与 listSkillFiles「符号
 * 链接不入清单」同律；技能根级链接目录的信任语义在 scanLocalSkills S11，
 * 边界 = 用户亲手放进技能根的目录，不外溢到目录内文件链接）。 */
export function readSkillFile(skillDir: string, fileName: string): string | null {
  let root: string;
  try {
    root = realpathSync(resolve(skillDir)); // 根先 realpath（macOS /var → /private/var 族）
  } catch {
    return null;
  }
  const target = resolve(root, fileName);
  if (target !== root && !target.startsWith(root + sep)) return null; // 文本逃逸
  if (target === root) return null; // fileName='' 解析回目录本身
  let real: string;
  let st: Stats;
  try {
    real = realpathSync(target); // 解析全部符号链接后仍在目录内才受理
    st = statSync(real);
  } catch {
    return null;
  }
  if (real !== root && !real.startsWith(root + sep)) return null; // 链接逃逸
  if (!st.isFile()) return null;
  if (st.size > MAX_SKILL_FILE_BYTES) {
    throw new HttpError(
      400,
      `skill file too large: ${fileName} is ${st.size} bytes (limit ${MAX_SKILL_FILE_BYTES})`,
    );
  }
  return readFileSync(real, 'utf8');
}

/** agent.skills[] 授权勾选过滤（spec 13：校验源 = 现扫存在性；未知 id 静默
 * 跳过不报错——目录删除后死引用随下次写入自然脱落，任务面不炸）。 */
export function filterKnownSkillIds(skillsDir: string, ids: string[]): string[] {
  const known = new Set(scanLocalSkills(skillsDir).map((s) => s.id));
  return ids.filter((id) => known.has(id));
}
