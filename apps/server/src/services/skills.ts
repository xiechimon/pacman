// skills 领域服务（#223：GitHub 扫描发现半）——候选发现 + 文件集取回。
// 出站唯一通道 = lib/github.ts 薄桥（缝纪律：本模块不直接 fetch）；HTTP 面
// 归 routes.ts POST /api/skills/scan，wire 词表 = shared records/skill.ts。
//
// 语义链（#195 resolution）：scan（候选 [{path,name,description}]）→ 用户选中
// → fetch（文件集 Record，与 POST /api/skills body.files 同形）→ 复用既有
// 文件集导入半入库。
//
// 发现规则：树中每个 SKILL.md（canon 名精确匹配，SKILL_ENTRY_FILE 单源）=
// 一个候选，path = 所在目录（仓根 = ''）。name/description 取自 SKILL.md
// frontmatter（最小解析器 [设计]——仓内无 yaml 依赖，单行为值、可引号包裹；
// 折叠块标量标记（`>`/`|` 族）与多行值不受理 = 按缺省回落目录名 / null，
// 真打 anthropics/skills 实测 academy-guide 即 `description: >` 折叠形）。

import {
  type FetchSkillFilesResponse,
  type ScanSkillsResponse,
  SKILL_ENTRY_FILE,
} from '@pacman/shared';
import { HttpError, notFound } from '../lib/errors.js';
import {
  type FetchLike,
  type GithubTreeEntry,
  githubRawFile,
  githubRepoInfo,
  githubRepoTree,
} from '../lib/github.js';
import { isGithubRepoRef } from './git.js';

/** 容量闸 [设计]：候选数上限（防 monorepo 数百 SKILL.md 打爆 raw 面）、
 * 文件集文件数/单文件字节上限（tree size 先知，超限不发 raw）。 */
const MAX_CANDIDATES = 100;
const MAX_SKILL_FILES = 64;
const MAX_SKILL_FILE_BYTES = 512_000;
/** raw 并发度 [设计]（CDN 面顺序拉太慢、无界并发太凶）。 */
const RAW_CONCURRENCY = 8;

/** repo 输入归一：`owner/repo` 或 https://github.com/owner/repo(.git)(/) →
 * `owner/repo`；其它形 → 400（接受形状在 message 点名）。 */
export function parseGithubRepoRef(input: string): string {
  const trimmed = input.trim();
  if (isGithubRepoRef(trimmed)) return trimmed;
  const m = /^https?:\/\/(?:www\.)?github\.com\/([^/?#]+)\/([^/?#]+)/.exec(trimmed);
  const owner = m?.[1];
  const name = m?.[2];
  if (owner && name) {
    const repo = `${owner}/${name.replace(/\.git$/, '')}`;
    if (isGithubRepoRef(repo)) return repo;
  }
  throw new HttpError(
    400,
    `invalid repo: expected 'owner/repo' or https://github.com/owner/repo, got ${JSON.stringify(input)}`,
  );
}

/** fetch 模式 path 安全闸：`..` / 反斜杠 / 绝对路径 → 400（raw URL 构造前拦）。 */
function requireSafeSkillPath(path: string): void {
  if (path.split('/').includes('..') || path.includes('\\') || path.startsWith('/')) {
    throw new HttpError(400, `invalid path: ${JSON.stringify(path)}`);
  }
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

/** 有限并发 map（null 丢弃 = raw 404 race 跳过语义）。 */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R | null>,
): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const idx = i++;
      if (idx >= items.length) return; // 领取与访问同步段，无交错
      const item = items[idx];
      if (item === undefined) return;
      const r = await fn(item);
      if (r !== null) out.push(r);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** 候选目录集：树中每个 SKILL.md blob → 所在目录（'' = 仓根）。 */
function skillDirsOf(entries: GithubTreeEntry[]): string[] {
  const dirs = entries
    .filter(
      (e) =>
        e.type === 'blob' &&
        (e.path === SKILL_ENTRY_FILE || e.path.endsWith(`/${SKILL_ENTRY_FILE}`)),
    )
    .map((e) => (e.path === SKILL_ENTRY_FILE ? '' : e.path.slice(0, -SKILL_ENTRY_FILE.length - 1)));
  return [...new Set(dirs)].sort();
}

/** scan/fetch 共用前导：repo 归一 → info → 递归全树（2 次 REST 纪律单点）。 */
async function loadGithubRepoTree(fetchImpl: FetchLike, repoInput: string) {
  const repo = parseGithubRepoRef(repoInput);
  const info = await githubRepoInfo(fetchImpl, repo);
  const tree = await githubRepoTree(fetchImpl, repo, info.defaultBranch);
  return { repo, info, tree };
}

/** scan 模式：候选发现（name/description = frontmatter，缺省回落目录名/null）。 */
export async function scanGithubSkills(
  fetchImpl: FetchLike,
  repoInput: string,
): Promise<ScanSkillsResponse> {
  const { repo, info, tree } = await loadGithubRepoTree(fetchImpl, repoInput);
  const all = skillDirsOf(tree.entries);
  const over = all.length > MAX_CANDIDATES;
  const dirs = over ? all.slice(0, MAX_CANDIDATES) : all;
  const repoName = repo.split('/')[1] ?? repo;
  const candidates = await mapPool(dirs, RAW_CONCURRENCY, async (dir) => {
    const mdPath = dir === '' ? SKILL_ENTRY_FILE : `${dir}/${SKILL_ENTRY_FILE}`;
    const content = await githubRawFile(fetchImpl, repo, info.defaultBranch, mdPath);
    if (content === null) return null; // tree/raw race：跳过（C6）
    const fm = parseSkillFrontmatter(content);
    const fallback = dir === '' ? repoName : (dir.split('/').pop() ?? dir);
    return {
      path: dir,
      name: fm.name ?? fallback,
      description: fm.description ?? null,
    };
  });
  candidates.sort((a, b) => a.path.localeCompare(b.path));
  return {
    repo,
    defaultBranch: info.defaultBranch,
    candidates,
    truncated: tree.truncated || over,
  };
}

/** fetch 模式：取回单个技能目录文件集（键相对技能目录，与 POST /api/skills
 * body.files 同形）。目录无 SKILL.md → 404；容量闸超限 → 400。 */
export async function fetchGithubSkillFiles(
  fetchImpl: FetchLike,
  repoInput: string,
  path: string,
): Promise<FetchSkillFilesResponse> {
  requireSafeSkillPath(path); // 400 抢在网络出站前
  const { repo, info, tree } = await loadGithubRepoTree(fetchImpl, repoInput);
  const prefix = path === '' ? '' : `${path}/`;
  const entryFile = path === '' ? SKILL_ENTRY_FILE : `${path}/${SKILL_ENTRY_FILE}`;
  const blobs = tree.entries.filter(
    (e) => e.type === 'blob' && (prefix === '' || e.path.startsWith(prefix)),
  );
  if (!blobs.some((e) => e.path === entryFile)) {
    throw notFound(`skill at ${JSON.stringify(path)} (no ${SKILL_ENTRY_FILE})`);
  }
  if (blobs.length > MAX_SKILL_FILES) {
    throw new HttpError(
      400,
      `skill has ${blobs.length} files (limit ${MAX_SKILL_FILES}): ${JSON.stringify(path)}`,
    );
  }
  for (const b of blobs) {
    if (b.size !== undefined && b.size > MAX_SKILL_FILE_BYTES) {
      throw new HttpError(
        400,
        `skill file too large: ${b.path} is ${b.size} bytes (limit ${MAX_SKILL_FILE_BYTES})`,
      );
    }
  }
  const pairs = await mapPool(blobs, RAW_CONCURRENCY, async (b) => {
    const content = await githubRawFile(fetchImpl, repo, info.defaultBranch, b.path);
    if (content === null) {
      throw new HttpError(502, `github raw vanished mid-scan: ${b.path}`);
    }
    return [b.path.slice(prefix.length), content] as const;
  });
  return { repo, path, files: Object.fromEntries(pairs) };
}
