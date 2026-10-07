// 团队技能物化（#920 清单 + 按需拉；原 XMON-112 S2，spec 14 增补）：
// GET /api/machine/skills/{stepId} 的文件清单 + GET .../file 单文件按需拉
// → 本机缓存目录，供 buildSkillsCatalog 与本机目录合并扫描。
//
// 缓存拓扑 = 双层内容寻址：
// - blobs/<sha256>：单文件内容库，一次写入终身复用（tmp + rename 原子落
//   位）——「只拉本地缺失或 hash 不同的文件」的增量面即由它承载：改一个
//   文件只传那一个，其余命中 blob 零传输。
// - views/<manifestDigest>：运行时读取的目录树（<dirName>/<path>），由
//   blobs hardlink 装配（跨设备/无权限时回落 copy）；digest = sha256(清单
//   的确定性序列化)——清单任何变化 = 新视图目录，同清单跨步命中即复用
//   （零请求、mtime 触摸 = LRU 最新）。
// hardlink 使视图与 blob 共享 inode：blob 路径被 LRU 回收不影响已装配视图
// 的可读性，视图回收后数据才真正释放。
//
// 失败语义（#920 口径：显式报错，不许静默降级）：拉取失败 / 清单路径逃逸
// / sha256 或 sizeBytes 不符 = 抛 TeamSkillsError，runner 按 failed 收尾并
// 点名根因——旧 fail-open「仅本机技能」降级退役（#920 本体：整包字节闸
// 43 次静默失败无人察觉）。空清单（200，skills=[]）= 服务端无可分发技能
// 的配置事实（白名单空 / server skillsDir 空），非通道故障：返回 null +
// 显式日志行（点名 selection 语境），会话以本机技能继续。
//
// 写入原子性：.tmp-* + rename 落位——半写视图永远不会以 digest 名可见
// （崩溃/失败残留的 .tmp-* 由 pruning 一并回收）。
//
// 路径安全（纵深防御）：server 写面已按目录安全正则与相对路径守卫校验
// （XMON-109 S1），daemon 侧再独立拒绝任何 dirName / file path 的逃逸形态
// ——整清单拒绝（抛错），绝不部分写入。

import { createHash, randomBytes } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import type { MachineSkillsManifestResponse } from '@pacman/shared';

/** 视图目录保留上限（mtime LRU）[设计]：视图 = hardlink 装配，内容占用在
 * blobs 侧计；条目数只随「不同白名单 × 不同清单版本」增长。 */
export const TEAM_SKILLS_CACHE_MAX_ENTRIES = 16;

/** blob 保留上限（mtime LRU）[设计]：文件级内容寻址去重，上界 = 技能库
 * 规模 × 内容版本 churn；复用即触摸 mtime。被现存视图 hardlink 引用的
 * blob 回收路径名不损视图数据（同 inode），视图重建时缺位则重新拉取。 */
export const TEAM_SKILLS_BLOB_MAX_ENTRIES = 4096;

/** 分发通道显式失败（#920）：runner 捕获后按 failed 收尾，errorMessage
 * 直报根因——与「静默降级跑空」的旧语义划界。 */
export class TeamSkillsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TeamSkillsError';
  }
}

export interface MaterializeTeamSkillsOpts {
  /** 缓存根（StatePaths.teamSkillsCacheDir）；缺失即创建。 */
  cacheRoot: string;
  /** machine-wire 技能清单（machineSkillsManifestResponseSchema 已过 zod
   * parse）。 */
  manifest: MachineSkillsManifestResponse;
  /** 单文件按需拉取（runner 接 client.skillFile(stepId, …)）。 */
  fetchFile: (dirName: string, path: string) => Promise<Buffer>;
  /** `[skills]` 日志行出口（runner 接 logger.skills）。 */
  log?: (msg: string) => void;
  /** 视图保留上限覆写（测试注入面 [设计]）。 */
  maxEntries?: number;
  /** blob 保留上限覆写（测试注入面 [设计]）。 */
  maxBlobEntries?: number;
}

/** 物化结果目录（含各技能 dirName 子目录）；空清单 = null（零创建，catalog
 * 走纯本机路径 + 显式日志行）；通道失败/非法清单 = 抛 TeamSkillsError。 */
export async function materializeTeamSkills(
  opts: MaterializeTeamSkillsOpts,
): Promise<string | null> {
  const { cacheRoot, manifest, fetchFile, log } = opts;
  if (manifest.skills.length === 0) {
    // 空清单 = 配置事实（server 无可分发技能 / 白名单空），不是通道故障：
    // 显式行点名语境，不阻断会话（#920 口径的反面是「静默」，不是「续跑」）。
    log?.(
      `team-manifest-empty: server distributed zero skills (selection=${manifest.selection}) — running with local skills only`,
    );
    return null;
  }
  const invalid = findUnsafeEntry(manifest);
  if (invalid !== null) throw new TeamSkillsError(`unsafe skill manifest: ${invalid}`);

  const digest = createHash('sha256').update(canonicalize(manifest)).digest('hex');
  const viewsRoot = join(cacheRoot, 'views');
  const blobsRoot = join(cacheRoot, 'blobs');
  const target = join(viewsRoot, digest);
  if (existsSync(target)) {
    touch(target); // LRU 触摸：命中 = 最新使用
    log?.(`team: ${countSkills(manifest)} skill(s) cache hit → ${target}`);
    return target;
  }
  mkdirSync(viewsRoot, { recursive: true });
  mkdirSync(blobsRoot, { recursive: true });
  const tmp = join(viewsRoot, `.tmp-${digest}-${process.pid}-${randomBytes(4).toString('hex')}`);
  let fetched = 0;
  let fetchedBytes = 0;
  let reused = 0;
  try {
    mkdirSync(tmp, { recursive: true });
    for (const skill of manifest.skills) {
      for (const file of skill.files) {
        const blob = join(blobsRoot, file.sha256);
        if (existsSync(blob)) {
          touch(blob); // blob LRU：复用 = 最新使用
          reused++;
        } else {
          const bytes = await fetchFile(skill.dirName, file.path);
          assertFileIntegrity(skill.dirName, file, bytes);
          writeBlobAtomically(blobsRoot, blob, bytes);
          fetched++;
          fetchedBytes += bytes.byteLength;
        }
        const dest = join(tmp, skill.dirName, file.path);
        mkdirSync(dirname(dest), { recursive: true });
        linkOrCopy(blob, dest);
      }
    }
    renameSync(tmp, target);
  } catch (err) {
    rmSync(tmp, { recursive: true, force: true });
    // 并发步竞争同一 digest：对方已落位 = 内容相同，直接复用（幂等）。
    if (existsSync(target)) {
      touch(target);
      log?.(`team: ${countSkills(manifest)} skill(s) cache hit → ${target}`);
      return target;
    }
    if (err instanceof TeamSkillsError) throw err;
    throw new TeamSkillsError(
      `materialization failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const fileTotal = countFiles(manifest);
  log?.(
    `team: ${countSkills(manifest)} skill(s), ${fileTotal} file(s) materialized → ${target} ` +
      `(fetched ${fetched} file(s) / ${fetchedBytes} byte(s), reused ${reused})`,
  );
  pruneCache(
    cacheRoot,
    opts.maxEntries ?? TEAM_SKILLS_CACHE_MAX_ENTRIES,
    opts.maxBlobEntries ?? TEAM_SKILLS_BLOB_MAX_ENTRIES,
    log,
  );
  return target;
}

/** 清单的确定性序列化（视图 digest 输入）：字段显式定序，不依赖对象键序；
 * 文件内容经 sha256 代表（内容变 = hash 变 = digest 变）。 */
function canonicalize(manifest: MachineSkillsManifestResponse): string {
  return JSON.stringify(
    manifest.skills.map((s) => [
      s.id,
      s.name,
      s.description,
      s.dirName,
      s.files.map((f) => [f.path, f.sizeBytes, f.sha256]),
    ]),
  );
}

function countSkills(manifest: MachineSkillsManifestResponse): number {
  return manifest.skills.length;
}

function countFiles(manifest: MachineSkillsManifestResponse): number {
  return manifest.skills.reduce((n, s) => n + s.files.length, 0);
}

/** 逐文件完整性双校验（#920）：sizeBytes + sha256 均须与清单一致——传输
 * 损坏/服务端清单漂移在落盘前显式点名，绝不带病物化。 */
function assertFileIntegrity(
  dirName: string,
  file: { path: string; sizeBytes: number; sha256: string },
  bytes: Buffer,
): void {
  if (bytes.byteLength !== file.sizeBytes) {
    throw new TeamSkillsError(
      `size mismatch for ${dirName}/${file.path}: manifest says ${file.sizeBytes} bytes, got ${bytes.byteLength}`,
    );
  }
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== file.sha256) {
    throw new TeamSkillsError(
      `sha256 mismatch for ${dirName}/${file.path}: manifest says ${file.sha256}, got ${actual}`,
    );
  }
}

/** blob 原子落位：tmp + rename（POSIX rename 覆盖既存目标 = 并发写同内容
 * 幂等）。 */
function writeBlobAtomically(blobsRoot: string, blob: string, bytes: Buffer): void {
  const tmp = join(
    blobsRoot,
    `.tmp-${createHash('sha256').update(bytes).digest('hex')}-${process.pid}-${randomBytes(4).toString('hex')}`,
  );
  writeFileSync(tmp, bytes);
  try {
    renameSync(tmp, blob);
  } catch (err) {
    rmSync(tmp, { force: true });
    if (!existsSync(blob)) throw err; // 并发对手已落位 = 幂等通过
  }
}

/** hardlink 装配，跨设备（EXDEV）或无 hardlink 权限时回落 copy——视图
 * 永远可装配，代价是回落时磁盘双份。 */
function linkOrCopy(blob: string, dest: string): void {
  try {
    linkSync(blob, dest);
  } catch {
    copyFileSync(blob, dest);
  }
}

function touch(p: string): void {
  const now = new Date();
  utimesSync(p, now, now);
}

/** 相对 posix 路径段守卫：非空、无 `.`/`..` 段、无绝对路径、无反斜杠。 */
function isSafeRelPath(p: string): boolean {
  if (p === '' || p.startsWith('/') || p.includes('\\')) return false;
  const segments = p.split('/');
  return segments.every((seg) => seg !== '' && seg !== '.' && seg !== '..');
}

/** 整清单预检（写入前）：任何一条非法 = 拒绝整清单（抛错），返回拒绝
 * 理由。 */
function findUnsafeEntry(manifest: MachineSkillsManifestResponse): string | null {
  for (const skill of manifest.skills) {
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

/** 三段回收（best-effort——失败只记日志，不影响本步物化结果）：
 * 1. 视图 LRU：views/ 下 digest 目录（含 .tmp-* 残留）超上限删最旧；
 * 2. blob LRU：blobs/ 下内容文件（含 .tmp-* 残留）超上限删最旧；
 * 3. 旧形态残骸：cacheRoot 顶层 views/blobs 之外的条目（#920 前单层内容
 *    寻址目录与根级 .tmp-*）整体回收——纯缓存数据，删除安全。 */
function pruneCache(
  cacheRoot: string,
  maxViewEntries: number,
  maxBlobEntries: number,
  log?: (msg: string) => void,
): void {
  try {
    pruneDirLru(join(cacheRoot, 'views'), maxViewEntries);
    pruneDirLru(join(cacheRoot, 'blobs'), maxBlobEntries);
    for (const name of readdirSync(cacheRoot)) {
      if (name === 'views' || name === 'blobs') continue;
      rmSync(join(cacheRoot, name), { recursive: true, force: true });
    }
  } catch (err) {
    log?.(`team-prune: failed (${err instanceof Error ? err.message : String(err)})`);
  }
}

function pruneDirLru(dir: string, maxEntries: number): void {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir)
    .map((name) => {
      const p = join(dir, name);
      return { p, mtimeMs: statSync(p).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  for (const entry of entries.slice(maxEntries)) {
    rmSync(entry.p, { recursive: true, force: true });
  }
}
