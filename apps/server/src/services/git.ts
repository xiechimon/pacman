// repo 托管双形态服务面（02 §3/A4）：
// - 托管 = server 本地 bare repo（`<reposDir>/<teamId>/<repoName>.git`），对
//   executor 呈现 http-backend 远端 URL（形状对应 r3 §1.4
//   `https://git.todos.dev/<teamId>/<repoName>`，域名段 = 本地主机名代位，
//   02 §5.8 gitHostDomain 槽；同源 `/git` 前缀为 [设计] 代位段）。
// - 接入 = GitHub（`owner/repo` 记录面；executor 直连远端 clone/push conv 分支，
//   PR/issues/CI 读面依赖 GitHub API，server 侧无本地存储）。
// 文件浏览面（tree?ref=/file?path=&ref=，r3 §8.2）：读裸库，无检出要求；
// 响应形状 [推断]（端点存在实测、载荷未采，04 附录 A 补采后收紧）。

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  gitHostedRepoPath,
  type ProjectBranchesResponse,
  type ProjectFileResponse,
  type ProjectRecord,
  type ProjectTreeResponse,
} from '@pacman/shared';
import { eq } from 'drizzle-orm';
import type { AppContext } from '../context.js';
import { project } from '../db/schema.js';
import { HttpError, notFound } from '../lib/errors.js';
import { isSafeRepoPath, systemGitOps } from '../lib/git.js';

export type ProjectRow = typeof project.$inferSelect;

/** 项目名 → repo 名 slug（[设计]：小写、路径安全字符集；r3 样本
 * `r3-lifecycle` 即原名同形）。 */
export function slugifyRepoName(name: string): string {
  const slug = name
    .toLowerCase()
    .replaceAll(/[^a-z0-9._-]+/g, '-')
    .replaceAll(/-{2,}/g, '-')
    .replaceAll(/^[-.]+|[-.]+$/g, '');
  return slug === '' ? 'repo' : slug;
}

/** 团队内 repoName 唯一化（冲突加 `-2`/`-3`…后缀 [设计]）。 */
export async function uniqueRepoName(
  ctx: AppContext,
  teamId: string,
  base: string,
): Promise<string> {
  const existing = new Set(
    ctx.db
      .select({ repoName: project.repoName })
      .from(project)
      .where(eq(project.teamId, teamId))
      .all()
      .map((r) => r.repoName)
      .filter((v): v is string => v !== null),
  );
  let candidate = base;
  for (let i = 2; existing.has(candidate); i++) {
    candidate = `${base}-${i}`;
  }
  return candidate;
}

/** bare repo 目录（托管形态唯一存储位；数据根 = 01 §4.2 单一数据根）。 */
export function repoDirFor(ctx: AppContext, teamId: string, repoName: string): string {
  return join(ctx.reposDir, teamId, `${repoName}.git`);
}

/** 托管形态落地：init 本地 bare repo（02 §3 锁定；HEAD 指默认分支）。 */
export async function provisionHostedRepo(
  ctx: AppContext,
  teamId: string,
  repoName: string,
): Promise<string> {
  const dir = repoDirFor(ctx, teamId, repoName);
  mkdirSync(join(ctx.reposDir, teamId), { recursive: true });
  await systemGitOps.initBareRepo(dir);
  return dir;
}

/** 托管 clone URL（本地主机代位；origin = 请求源 [设计]——单机自 host，
 * executor 经 serverUrl 同源取远端，02 §1.1）。 */
export function hostedCloneUrl(origin: string, teamId: string, repoName: string): string {
  return `${origin}/git${gitHostedRepoPath(teamId, repoName)}`;
}

/** GitHub 接入 clone URL（https 派生 [设计]；凭证 per-step 注入归 M3，02 §8）。 */
export function githubCloneUrl(githubRepo: string): string {
  return `https://github.com/${githubRepo}.git`;
}

export function toProjectRecord(row: ProjectRow, origin?: string): ProjectRecord {
  return {
    id: row.id,
    name: row.name,
    teamId: row.teamId,
    ...(row.repoKind !== null ? { repoKind: row.repoKind } : {}),
    ...(row.repoName !== null ? { repoName: row.repoName } : {}),
    ...(row.githubRepo !== null ? { githubRepo: row.githubRepo } : {}),
    ...(row.repoKind === 'hosted' && row.repoName !== null && origin !== undefined
      ? { cloneUrl: hostedCloneUrl(origin, row.teamId, row.repoName) }
      : {}),
    ...(row.repoKind === 'github' && row.githubRepo !== null
      ? { cloneUrl: githubCloneUrl(row.githubRepo) }
      : {}),
  };
}

/** GitHub 接入 `owner/repo` 形状校验（[推断] 最小护栏）。 */
export function isGithubRepoRef(value: string): boolean {
  return /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(value);
}

/** 文件浏览面要求托管形态（GitHub-backed 读面依赖 GitHub API，不在 M2b
 * server 存储面 [设计]）。返回 bare repo 目录。 */
export function requireHostedRepoDir(ctx: AppContext, projectId: string): string {
  const row = ctx.db.select().from(project).where(eq(project.id, projectId)).get();
  if (!row) throw notFound(`project ${projectId}`);
  if (row.repoKind !== 'hosted' || row.repoName === null) {
    throw notFound(`hosted repo for project ${projectId}`);
  }
  return repoDirFor(ctx, row.teamId, row.repoName);
}

// —— tree/file/branches 面（响应封套单源 = shared projectTree/File/Branches
// ResponseSchema，[推断] 注记在 shared 侧）———————————————————————————————

/** ref → commit sha；解析失败 = 404（tree/file 共用）。 */
async function resolveCommitOr404(dir: string, ref: string): Promise<string> {
  const commit = await systemGitOps.resolveCommit(dir, ref);
  if (commit === null) throw notFound(`ref ${ref}`);
  return commit;
}

export async function readTree(
  ctx: AppContext,
  projectId: string,
  refParam?: string,
  pathParam?: string,
): Promise<ProjectTreeResponse> {
  const dir = requireHostedRepoDir(ctx, projectId);
  const ref = refParam ?? 'HEAD';
  const commit = await resolveCommitOr404(dir, ref);
  const subPath = pathParam !== undefined && pathParam !== '' ? pathParam : undefined;
  const entries = await systemGitOps.lsTree(dir, commit, subPath);
  return { ref, commit, path: subPath ?? '', entries };
}

/** 二进制判定：首 8KB 含 NUL（git 同款启发式 [设计]）。 */
function looksBinary(buf: Uint8Array): boolean {
  const window = buf.subarray(0, 8000);
  return window.includes(0);
}

export async function readFile(
  ctx: AppContext,
  projectId: string,
  path: string,
  refParam?: string,
): Promise<ProjectFileResponse> {
  // 400 前置校验（lib 层同名校验 = 缝契约兜底，双保险 [设计]）。
  if (!isSafeRepoPath(path)) throw new HttpError(400, `invalid query path: ${path}`);
  const dir = requireHostedRepoDir(ctx, projectId);
  const ref = refParam ?? 'HEAD';
  const commit = await resolveCommitOr404(dir, ref);
  const file = await systemGitOps.readFileAt(dir, commit, path);
  if (file === null) throw notFound(`file ${path} at ref ${ref}`);
  const binary = looksBinary(file.content);
  return {
    ref,
    commit,
    path,
    size: file.size,
    encoding: binary ? 'base64' : 'utf-8',
    content: binary
      ? Buffer.from(file.content).toString('base64')
      : new TextDecoder().decode(file.content),
  };
}

export async function readBranches(
  ctx: AppContext,
  projectId: string,
): Promise<ProjectBranchesResponse> {
  const dir = requireHostedRepoDir(ctx, projectId);
  return systemGitOps.listBranches(dir);
}
