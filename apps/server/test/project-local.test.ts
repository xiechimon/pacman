// spec 12 / #359 G2-T1：POST /api/projects local 形态——localPath 校验三态
// （不存在 / 非 git 工作树 / 是 git 工作树 → 400/400/201）+ `~` 展开 +
// 绝对路径要求 + body 双名兼容（kind = spec 12 数据契约面，repoKind = 既有
// wire 面；kind 优先）。既有 hosted / github 创建面不回归（AC「旧 hosted 不破」）。
// 失败方式先于实现枚举（仓测试纪律）：本文件即 local 校验的失败场景清单。

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, test } from 'vitest';
import { project } from '../src/db/schema.js';
import { runGit } from '../src/lib/git.js';
import { expandHomePath } from '../src/services/git.js';
import { bootServer, req } from './helpers.js';

const s = bootServer();
const tempRoots: string[] = [];

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempRoots.push(dir);
  return dir;
}

afterAll(() => {
  s.dispose();
  for (const dir of tempRoots) rmSync(dir, { recursive: true, force: true });
});

/** 真 git 工作树仓（`git init` 即够——is-inside-work-tree 判定不要求首提交）。 */
async function makeGitRepo(): Promise<string> {
  const dir = tempDir('pacman-local-repo-');
  const r = await runGit(['init', dir]);
  expect(r.code).toBe(0);
  return dir;
}

/** 创建面应答投影（record 位 + 错误位；断言只消费这些键）。 */
interface CreateReply {
  id?: string;
  repoKind?: string;
  repoName?: string;
  githubRepo?: string;
  localPath?: string;
  cloneUrl?: string;
  error?: string;
}

async function postCreate(body: unknown): Promise<{ status: number; body: CreateReply }> {
  const res = await req(s.app, 'POST', '/api/projects', body);
  return { status: res.status, body: (await res.json()) as CreateReply };
}

describe('POST /api/projects kind=local——localPath 校验三态（#359 AC）', () => {
  test('缺 localPath → 400（错误位指 localPath）', async () => {
    const r = await postCreate({ name: 'p-missing', kind: 'local' });
    expect(r.status).toBe(400);
    expect(String(r.body.error)).toContain('localPath');
  });

  test('localPath 空串 → 400', async () => {
    const r = await postCreate({ name: 'p-empty', kind: 'local', localPath: '   ' });
    expect(r.status).toBe(400);
    expect(String(r.body.error)).toContain('localPath');
  });

  test('三态一：路径不存在 → 400', async () => {
    const missing = join(tempDir('pacman-local-base-'), 'no-such-dir');
    const r = await postCreate({ name: 'p-gone', kind: 'local', localPath: missing });
    expect(r.status).toBe(400);
    expect(String(r.body.error)).toContain('localPath');
  });

  test('三态二：存在但不是 git 仓 → 400', async () => {
    const plain = tempDir('pacman-local-plain-');
    const r = await postCreate({ name: 'p-plain', kind: 'local', localPath: plain });
    expect(r.status).toBe(400);
    expect(String(r.body.error)).toContain('git');
  });

  test('三态二变体：指向普通文件 → 400（非目录即非工作树仓）', async () => {
    const dir = tempDir('pacman-local-file-');
    const file = join(dir, 'not-a-repo.txt');
    writeFileSync(file, 'x');
    const r = await postCreate({ name: 'p-file', kind: 'local', localPath: file });
    expect(r.status).toBe(400);
  });

  test('相对路径 → 400（要求绝对路径；`~` 展开后判定）', async () => {
    const r = await postCreate({ name: 'p-rel', kind: 'local', localPath: 'relative/dir' });
    expect(r.status).toBe(400);
    expect(String(r.body.error)).toContain('absolute');
  });

  test('三态三：是 git 工作树仓 → 201，record/DB 行 localPath = 规范绝对路径', async () => {
    const repo = await makeGitRepo();
    const r = await postCreate({ name: 'p-ok', kind: 'local', localPath: repo });
    expect(r.status).toBe(201);
    expect(r.body.repoKind).toBe('local');
    expect(r.body.localPath).toBe(repo);
    const row = s.db
      .select()
      .from(project)
      .where(eq(project.id, String(r.body.id)))
      .get();
    expect(row?.repoKind).toBe('local');
    expect(row?.localPath).toBe(repo);
  });

  test('`~` 展开：localPath `~/<name>` 按 server 端 HOME 展开为绝对路径', async () => {
    const repo = await makeGitRepo();
    const parent = dirname(repo);
    const prevHome = process.env.HOME;
    process.env.HOME = parent;
    try {
      const r = await postCreate({
        name: 'p-tilde',
        kind: 'local',
        localPath: `~/${basename(repo)}`,
      });
      expect(r.status).toBe(201);
      expect(r.body.localPath).toBe(join(parent, basename(repo)));
    } finally {
      if (prevHome === undefined) delete process.env.HOME;
      else process.env.HOME = prevHome;
    }
  });
});

describe('expandHomePath（`~` 展开单源；homeDir 测试注入）', () => {
  test('~/x → <home>/x；裸 ~ → <home>', () => {
    expect(expandHomePath('~/code/x', '/home/u')).toBe('/home/u/code/x');
    expect(expandHomePath('~', '/home/u')).toBe('/home/u');
  });

  test('绝对路径与相对路径原样；~user 形态不展开', () => {
    expect(expandHomePath('/abs/x', '/home/u')).toBe('/abs/x');
    expect(expandHomePath('rel/x', '/home/u')).toBe('rel/x');
    expect(expandHomePath('~other/x', '/home/u')).toBe('~other/x');
  });
});

describe('body 双名兼容：kind（spec 12 契约）与 repoKind（既有 wire），kind 优先', () => {
  test('既有面回归：repoKind github + githubRepo 字符串 → 201', async () => {
    const r = await postCreate({ name: 'p-old-gh', repoKind: 'github', githubRepo: 'octo/cat' });
    expect(r.status).toBe(201);
    expect(r.body.repoKind).toBe('github');
    expect(r.body.githubRepo).toBe('octo/cat');
  });

  test('新面：kind github + githubRepo {owner,repo} 对象 → 201，列值归一 owner/repo', async () => {
    const r = await postCreate({
      name: 'p-new-gh',
      kind: 'github',
      githubRepo: { owner: 'octo', repo: 'dog' },
    });
    expect(r.status).toBe(201);
    expect(r.body.repoKind).toBe('github');
    expect(r.body.githubRepo).toBe('octo/dog');
  });

  test('kind 与 repoKind 并存 → kind 优先（不误触 hosted provisioning）', async () => {
    const repo = await makeGitRepo();
    const r = await postCreate({
      name: 'p-prio',
      kind: 'local',
      repoKind: 'hosted',
      localPath: repo,
    });
    expect(r.status).toBe(201);
    expect(r.body.repoKind).toBe('local');
    expect(r.body.repoName).toBeUndefined();
  });

  test('kind=github 缺 githubRepo → 400（owner/repo 提示）', async () => {
    const r = await postCreate({ name: 'p-gh-none', kind: 'github' });
    expect(r.status).toBe(400);
    expect(String(r.body.error)).toContain('owner/repo');
  });

  test('kind=github githubRepo 非法串 → 400', async () => {
    const r = await postCreate({ name: 'p-gh-bad', kind: 'github', githubRepo: 'has space/x' });
    expect(r.status).toBe(400);
  });

  test('kind=github githubRepo 对象空段 → 400（归一后过 isGithubRepoRef 闸）', async () => {
    const r = await postCreate({
      name: 'p-gh-empty',
      kind: 'github',
      githubRepo: { owner: 'a', repo: '' },
    });
    expect(r.status).toBe(400);
  });

  test('旧 hosted 不破：kind=hosted → 201 + bare repo 落地（repoName 在位）', async () => {
    const r = await postCreate({ name: 'p-hosted', kind: 'hosted' });
    expect(r.status).toBe(201);
    expect(r.body.repoKind).toBe('hosted');
    expect(typeof r.body.repoName).toBe('string');
    expect(String(r.body.cloneUrl)).toContain('/git/');
  });

  test('无 repo 默认面不破：仅 name → 201，record 无 repoKind/localPath', async () => {
    const r = await postCreate({ name: 'p-plain' });
    expect(r.status).toBe(201);
    expect(r.body.repoKind).toBeUndefined();
    expect(r.body.localPath).toBeUndefined();
  });

  test('GET /api/projects 投影带 localPath（record 单源 = shared projectRecordSchema）', async () => {
    const repo = await makeGitRepo();
    const created = await postCreate({ name: 'p-list', kind: 'local', localPath: repo });
    expect(created.status).toBe(201);
    const res = await req(s.app, 'GET', `/api/projects?teamId=${s.team.id}`);
    expect(res.status).toBe(200);
    const rows = (await res.json()) as CreateReply[];
    const hit = rows.find((r) => r.id === created.body.id);
    expect(hit?.localPath).toBe(repo);
    expect(hit?.repoKind).toBe('local');
  });
});
