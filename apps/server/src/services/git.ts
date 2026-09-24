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
  conversationBranch,
  type DocumentDiffFile,
  gitHostedRepoPath,
  type ProjectBranchesResponse,
  type ProjectCommitsResponse,
  type ProjectFileResponse,
  type ProjectRecord,
  type ProjectTreeResponse,
} from '@pacman/shared';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { build as buildTable, project, todo as todoTable } from '../db/schema.js';
import { HttpError, notFound } from '../lib/errors.js';
import { isSafeRepoPath, runGit, systemGitOps } from '../lib/git.js';

export type ProjectRow = typeof project.$inferSelect;

/** 文件浏览面所需的最小上下文（AppContext 的结构子集；chief `docs` relay 与
 * REST tree/file/branches 共用——避免把整个 AppContext 拖进 relay 执行面）。 */
export interface RepoCtx {
  db: Db;
  reposDir: string;
}

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
export async function uniqueRepoName(ctx: RepoCtx, teamId: string, base: string): Promise<string> {
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
export function repoDirFor(reposDir: string, teamId: string, repoName: string): string {
  return join(reposDir, teamId, `${repoName}.git`);
}

/** 托管形态落地：init 本地 bare repo（02 §3 锁定；HEAD 指默认分支）+ 种子
 * 提交立 main（M3b [设计]：空库无 ref 不能 worktree add——02 §5.5 base=
 * `origin/<defaultBranch>` 前提；merge 步 fast-forward 亦需 main 在位）。 */
export async function provisionHostedRepo(
  ctx: RepoCtx,
  teamId: string,
  repoName: string,
): Promise<string> {
  const dir = repoDirFor(ctx.reposDir, teamId, repoName);
  mkdirSync(join(ctx.reposDir, teamId), { recursive: true });
  await systemGitOps.initBareRepo(dir);
  await systemGitOps.seedInitialCommit(dir, `init ${repoName}`);
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
export function requireHostedRepoDir(ctx: RepoCtx, projectId: string): string {
  const row = ctx.db.select().from(project).where(eq(project.id, projectId)).get();
  if (!row) throw notFound(`project ${projectId}`);
  if (row.repoKind !== 'hosted' || row.repoName === null) {
    throw notFound(`hosted repo for project ${projectId}`);
  }
  return repoDirFor(ctx.reposDir, row.teamId, row.repoName);
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
  ctx: RepoCtx,
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
  ctx: RepoCtx,
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
  ctx: RepoCtx,
  projectId: string,
): Promise<ProjectBranchesResponse> {
  const dir = requireHostedRepoDir(ctx, projectId);
  return systemGitOps.listBranches(dir);
}

// —— commits 读面（#149 项目页 文件|历史 分段「历史」数据源）：[推断] 端点
// GET /api/projects/{id}/commits，wire 未采——行形 = git log 最小投影（封套
// 单源 shared projectCommitsResponseSchema），登记 wire.test INFERRED_ROUTES。
// runGit 直调先例 = readBuildChanges（diff 面同款：缝词表外的只读 git 查询
// 留在 server lib/git.ts spawn 家族内）。非托管形态无本地读面 = 404
// （tree/file/branches 同族口径）。

/** 提交行上限（历史 pane 首屏 [设计]；分页归后票）。 */
const COMMITS_LIMIT = 50;

export async function readCommitHistory(
  ctx: RepoCtx,
  projectId: string,
  refParam?: string,
): Promise<ProjectCommitsResponse> {
  const dir = requireHostedRepoDir(ctx, projectId);
  const { defaultBranch } = await systemGitOps.listBranches(dir);
  const ref = refParam ?? defaultBranch ?? 'HEAD';
  const commit = await systemGitOps.resolveCommit(dir, ref);
  if (commit === null) return { ref, commits: [] }; // 空库（无 ref）= 空集
  // %x00 分隔 + %s 标题行：单行原子字段，无换行歧义（解析 [设计]）
  const r = await runGit(
    ['log', `--max-count=${COMMITS_LIMIT}`, '--format=%H%x00%h%x00%aI%x00%an%x00%s', commit],
    { cwd: dir, timeoutMs: 30_000 },
  );
  if (r.code !== 0) return { ref, commits: [] };
  const commits = r.stdout
    .toString('utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => {
      const [sha, shortSha, at, authorName, message] = line.split('\0');
      return {
        sha: sha ?? '',
        shortSha: shortSha ?? '',
        message: message ?? '',
        authorName: authorName ?? '',
        at: Date.parse(at ?? '') || 0,
      };
    });
  return { ref, commits };
}

// —— build 变更面（M5 [推断] 读端点 GET /api/builds/{id}/changes 数据源）：
// 变更 pane（r7 27/27b/36）= conv 分支相对默认分支的文件级 unified diff。
// 端点/封套 wire 未采——形状复用 documentDiffSchema 的 files 段（diffFileSchema
// 单源，r5 §4 触点同族），登记 wire.test INFERRED_ROUTES（04 §3 不判负口径）。
// GitHub-backed 项目无本地存储 = 空集（PR 面归后票，02 §3）。

/** unified diff 文本 → diffFileSchema[]（git diff 输出解析 [设计]；行保留
 * `+`/`-`/` ` 前缀 = documents.ts structuredPatch 行形同款约定）。 */
export function parseUnifiedDiff(text: string): DocumentDiffFile[] {
  const files: DocumentDiffFile[] = [];
  let current: DocumentDiffFile | null = null;
  let hunk: { header: string; lines: string[] } | null = null;
  const lines = text.replace(/\n$/, '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.startsWith('diff --git ')) {
      current = { path: '', additions: 0, deletions: 0, hunks: [] };
      files.push(current);
      hunk = null;
      continue;
    }
    if (current === null) continue;
    if (line.startsWith('+++ ')) {
      const p = line.slice(4).trim();
      if (p !== '/dev/null') current.path = p.replace(/^b\//, '');
      continue;
    }
    if (line.startsWith('--- ')) {
      const p = line.slice(4).trim();
      if (current.path === '' && p !== '/dev/null') current.path = p.replace(/^a\//, '');
      continue;
    }
    if (line.startsWith('@@')) {
      hunk = { header: line.split(' @@')[0]! + ' @@', lines: [] };
      current.hunks.push(hunk);
      continue;
    }
    if (hunk === null) continue; // index/mode 头等文件级元数据行
    if (line.startsWith('\\')) continue; // `\ No newline at end of file`
    if (line === '') continue; // 防御：hunk 内空串（git 输出上下文行恒带前缀空格）
    hunk.lines.push(line);
    if (line.startsWith('+')) current.additions += 1;
    else if (line.startsWith('-')) current.deletions += 1;
  }
  return files.filter((f) => f.path !== '' && f.hunks.length > 0);
}

/** conv 分支相对默认分支的变更文件集（变更 pane 数据源）；无托管 repo /
 * 分支缺位 / 空 diff = 空集（占位文案面归 web，r7 38）。 */
export async function readBuildChanges(
  ctx: RepoCtx,
  buildId: string,
): Promise<{ files: DocumentDiffFile[] }> {
  const buildRow = ctx.db.select().from(buildTable).where(eq(buildTable.id, buildId)).get();
  if (!buildRow) throw notFound(`build ${buildId}`);
  const todoRow = ctx.db.select().from(todoTable).where(eq(todoTable.id, buildRow.todoId)).get();
  if (!todoRow) throw notFound(`todo ${buildRow.todoId}`);
  const projRow = ctx.db.select().from(project).where(eq(project.id, todoRow.projectId)).get();
  if (!projRow || projRow.repoKind !== 'hosted' || projRow.repoName === null) {
    return { files: [] };
  }
  const dir = repoDirFor(ctx.reposDir, projRow.teamId, projRow.repoName);
  const { defaultBranch } = await systemGitOps.listBranches(dir);
  const base = defaultBranch ?? 'main';
  const baseSha = await systemGitOps.resolveCommit(dir, `refs/heads/${base}`);
  const headSha = await systemGitOps.resolveCommit(
    dir,
    `refs/heads/${conversationBranch(buildId)}`,
  );
  if (baseSha === null || headSha === null) return { files: [] };
  const r = await runGit(['diff', `${baseSha}...${headSha}`], { cwd: dir, timeoutMs: 30_000 });
  if (r.code !== 0) return { files: [] };
  return { files: parseUnifiedDiff(r.stdout.toString('utf8')) };
}
