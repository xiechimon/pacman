// 团队技能物化（XMON-112 S2，spec 14 增补）：GET /api/machine/skills/{stepId}
// 的技能包 → 本机缓存目录，供 buildSkillsCatalog 与本机目录合并扫描。
//
// 缓存策略 = 内容寻址（票面二选一取此）：目录名 = sha256(包的确定性序列化)。
// 同包跨步命中即复用（零重写、mtime 触摸 = LRU 最新）；内容变化 = 新目录，
// 旧目录由 mtime LRU pruning 回收（保留上限 TEAM_SKILLS_CACHE_MAX_ENTRIES）。
// 内容寻址优于 mtime 失效的原因：daemon 无从得知 server 侧目录的 mtime，
// 而包内容 hash 天然覆盖「server 改了任何文件」的全部情形，且并发步命中
// 同一目录时天然幂等。
//
// 写入原子性：.tmp-* 目录 + rename 落位——半写目录永远不会以 hash 名可见
// （崩溃后残留的 .tmp-* 不会被复用，pruning 一并回收）。
//
// 路径安全（纵深防御）：server 写面已按目录安全正则与相对路径守卫校验
// （XMON-109 S1），daemon 侧再独立拒绝任何 dirName / file path 的逃逸形态
// ——整包拒绝降级为仅本机技能，绝不部分写入。

import { createHash, randomBytes } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import type { MachineSkillsResponse } from '@pacman/shared';

/** 缓存目录保留上限（mtime LRU）[设计]：包总量 ≤ MAX_SKILL_TOTAL_BYTES
 * （2MB），16 条上界 ≈ 32MB，磁盘占用可忽略；条目数只随「不同白名单 ×
 * 不同内容版本」增长。 */
export const TEAM_SKILLS_CACHE_MAX_ENTRIES = 16;

export interface MaterializeTeamSkillsOpts {
  /** 缓存根（StatePaths.teamSkillsCacheDir）；缺失即创建。 */
  cacheRoot: string;
  /** machine-wire 技能包（machineSkillsResponseSchema 已过 zod parse）。 */
  pkg: MachineSkillsResponse;
  /** `[skills]` 日志行出口（runner 接 logger.skills）。 */
  log?: (msg: string) => void;
  /** 保留上限覆写（测试注入面 [设计]）。 */
  maxEntries?: number;
}

/** 物化结果目录（含各技能 dirName 子目录）；空包 = null（零创建，catalog
 * 走纯本机路径 = 零回归面）；非法包 = null + `team-invalid` 行（整包拒绝）。 */
export function materializeTeamSkills(opts: MaterializeTeamSkillsOpts): string | null {
  const { cacheRoot, pkg, log } = opts;
  if (pkg.skills.length === 0) return null;
  const invalid = findUnsafeEntry(pkg);
  if (invalid !== null) {
    log?.(`team-invalid: ${invalid} — continuing with local skills only`);
    return null;
  }
  const digest = createHash('sha256').update(canonicalize(pkg)).digest('hex');
  const target = join(cacheRoot, digest);
  if (existsSync(target)) {
    const now = new Date();
    utimesSync(target, now, now); // LRU 触摸：命中 = 最新使用
    log?.(`team: ${pkg.skills.length} skill(s) cache hit → ${target}`);
    return target;
  }
  mkdirSync(cacheRoot, { recursive: true });
  const tmp = join(cacheRoot, `.tmp-${digest}-${process.pid}-${randomBytes(4).toString('hex')}`);
  try {
    mkdirSync(tmp, { recursive: true });
    for (const skill of pkg.skills) {
      for (const file of skill.files) {
        const dest = join(tmp, skill.dirName, file.path);
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, file.content, 'utf8');
      }
    }
    renameSync(tmp, target);
  } catch (err) {
    rmSync(tmp, { recursive: true, force: true });
    // 并发步竞争同一 hash：对方已落位 = 内容相同，直接复用（幂等）。
    if (existsSync(target)) {
      log?.(`team: ${pkg.skills.length} skill(s) cache hit → ${target}`);
      return target;
    }
    log?.(
      `team-invalid: write failed (${err instanceof Error ? err.message : String(err)}) — continuing with local skills only`,
    );
    return null;
  }
  log?.(`team: ${pkg.skills.length} skill(s) materialized → ${target}`);
  pruneCache(cacheRoot, opts.maxEntries ?? TEAM_SKILLS_CACHE_MAX_ENTRIES, log);
  return target;
}

/** 包的确定性序列化（hash 输入）：字段显式定序，不依赖对象键序。 */
function canonicalize(pkg: MachineSkillsResponse): string {
  return JSON.stringify(
    pkg.skills.map((s) => [
      s.id,
      s.name,
      s.description,
      s.dirName,
      s.files.map((f) => [f.path, f.content]),
    ]),
  );
}

/** 相对 posix 路径段守卫：非空、无 `.`/`..` 段、无绝对路径、无反斜杠。 */
function isSafeRelPath(p: string): boolean {
  if (p === '' || p.startsWith('/') || p.includes('\\')) return false;
  const segments = p.split('/');
  return segments.every((seg) => seg !== '' && seg !== '.' && seg !== '..');
}

/** 整包预检（写入前）：任何一条非法 = 拒绝整包，返回拒绝理由。 */
function findUnsafeEntry(pkg: MachineSkillsResponse): string | null {
  for (const skill of pkg.skills) {
    if (!isSafeRelPath(skill.dirName) || skill.dirName.includes('/')) {
      return `unsafe skill dirName ${JSON.stringify(skill.dirName)}`;
    }
    for (const file of skill.files) {
      if (!isSafeRelPath(file.path)) {
        return `unsafe file path ${JSON.stringify(file.path)} in skill ${skill.dirName}`;
      }
    }
  }
  return null;
}

/** mtime LRU pruning：hash 目录（含 .tmp-* 残留）超过上限即删最旧。
 * best-effort——失败只记日志，不影响本步物化结果。 */
function pruneCache(cacheRoot: string, maxEntries: number, log?: (msg: string) => void): void {
  try {
    const entries = readdirSync(cacheRoot)
      .map((name) => {
        const p = join(cacheRoot, name);
        return { p, mtimeMs: statSync(p).mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    for (const entry of entries.slice(maxEntries)) {
      rmSync(entry.p, { recursive: true, force: true });
    }
  } catch (err) {
    log?.(`team-prune: failed (${err instanceof Error ? err.message : String(err)})`);
  }
}
