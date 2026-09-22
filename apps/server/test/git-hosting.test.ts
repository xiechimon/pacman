// repo 托管双形态 E2E（02 §3/A4 契约实走）：
// - 托管 = server 本地 bare repo + `git http-backend` CGI：真 git 客户端经真
//   HTTP clone/push 实走绿（凭证纪律 r3 §1.4：手动 fetch 无凭证失败 = 401 面）；
//   文件浏览面 tree?ref=/file?path=&ref= 读裸库（r3 §8.2）。
// - 接入 = GitHub：记录面（owner/repo + cloneUrl 派生）+ executor 契约实走
//   （conv-* 分支 push 到用户自有 repo，02 §3/§5.5）——CI 无 GitHub 凭证，
//   远端以本地 bare 代位（git 协议面同形）。
// git 客户端调用带 GIT_TERMINAL_PROMPT=0（401 时不吊住等输入）。

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { BRAND, conversationBranch, type ProjectRecord } from '@pacman/shared';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { runGit } from '../src/lib/git.js';
import { newUuidv7 } from '../src/lib/ids.js';
import { bootServer, insertGitApiKey, req, type TestServer } from './helpers.js';

const GIT_ENV = {
  GIT_TERMINAL_PROMPT: '0',
  GIT_AUTHOR_NAME: 'r3-probe',
  GIT_AUTHOR_EMAIL: 'probe@localhost',
  GIT_COMMITTER_NAME: 'r3-probe',
  GIT_COMMITTER_EMAIL: 'probe@localhost',
};

const dirs: string[] = [];
function workdir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), `pacman-git-${prefix}-`));
  dirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

let s: TestServer;
let baseUrl: string;
let closeServer: () => Promise<void>;
const API_KEY = 'tds_e2e0e2e0e2e0e2e0e2e0e2e0e2e0e2e0e2e0e2e0e2e0e2e0'; // 形态示意（发行面归 M2c）

beforeAll(async () => {
  s = bootServer();
  insertGitApiKey(s, API_KEY);
  const server = serve({ fetch: s.app.fetch, port: 0 });
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  closeServer = () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
});

afterAll(async () => {
  await closeServer();
  s.dispose();
});

async function createProject(body: unknown): Promise<ProjectRecord> {
  const res = await req(s.app, 'POST', '/api/projects', body);
  expect(res.status).toBe(201);
  return (await res.json()) as ProjectRecord;
}

/** 托管远端 URL（record.cloneUrl 的 origin 随请求源；测试面 app.request 无真
 * 端口，取 pathname 拼真 server 源）。 */
function hostedUrl(record: ProjectRecord): string {
  return `${baseUrl}${new URL(record.cloneUrl as string).pathname}`;
}

/** 带凭证的托管远端 URL（用户名位忽略、密码位 = API key，PAT 同款 [设计]）。 */
function authedUrl(record: ProjectRecord): string {
  const url = new URL(hostedUrl(record));
  url.username = 'git';
  url.password = API_KEY;
  return url.toString();
}

async function git(args: string[], cwd: string) {
  return runGit(args, { cwd, env: GIT_ENV, timeoutMs: 60_000 });
}

describe('托管形态：bare repo + git http-backend（02 §3 锁定）', () => {
  test('POST /api/projects repoKind:hosted → bare repo 落地 + record 带 repoName/cloneUrl', async () => {
    const record = await createProject({ name: 'r3-lifecycle', repoKind: 'hosted' });
    expect(record.repoKind).toBe('hosted');
    expect(record.repoName).toBe('r3-lifecycle'); // slug = 原名同形（r3 daemon.log 样本）
    // 形状对应 r3 §1.4 `https://git.todos.dev/<teamId>/<repoName>`（域名段 = 本地
    // 主机代位 + 同源 /git 前缀 [设计]）：路径尾段 = <teamId>/<repoName>
    expect(new URL(record.cloneUrl as string).pathname).toBe(`/git/${s.team.id}/r3-lifecycle`);
    const dir = join(s.reposDir, s.team.id, 'r3-lifecycle.git');
    const head = await git(['symbolic-ref', '--short', 'HEAD'], dir);
    expect(head.stdout.toString().trim()).toBe('main'); // 默认分支 main（r3 §3.6 origin/main）
  });

  test('凭证纪律（r3 §1.4：手动 fetch 无凭证失败）：匿名 clone → 401 → git 非零退', async () => {
    const record = await createProject({ name: 'anon-probe', repoKind: 'hosted' });
    const dir = workdir('anon');
    const r = await git(['clone', hostedUrl(record), join(dir, 'repo')], dir);
    expect(r.code).not.toBe(0);
    // 401 + WWW-Authenticate（HTTP 面直查）
    const res = await fetch(`${hostedUrl(record)}/info/refs?service=git-upload-pack`);
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain('Basic realm=');
    // 错误凭证同样 401
    const bad = new URL(hostedUrl(record));
    bad.username = 'git';
    bad.password = 'tds_wrong';
    const r2 = await git(['clone', bad.toString(), join(dir, 'repo2')], dir);
    expect(r2.code).not.toBe(0);
  });

  test('clone/commit/push 实走绿（http-backend CGI 全链）→ branches/tree/file 读回', async () => {
    const record = await createProject({ name: 'push-probe', repoKind: 'hosted' });
    const dir = workdir('push');
    const repoDir = join(dir, 'repo');
    // clone（空库容忍）
    const clone = await git(['clone', authedUrl(record), repoDir], dir);
    expect(clone.code, clone.stderr).toBe(0);
    // 首个提交进 main（-B：空库 clone 的本地 unborn HEAD 名不定，强制落 main）
    const readme = '# push-probe\n\n托管形态实走。\n';
    writeFileSync(join(repoDir, 'README.md'), readme);
    expect((await git(['checkout', '-B', 'main'], repoDir)).code).toBe(0);
    expect((await git(['add', 'README.md'], repoDir)).code).toBe(0);
    expect((await git(['commit', '-m', 'docs: README'], repoDir)).code).toBe(0);
    const push = await git(['push', '-u', 'origin', 'main'], repoDir);
    expect(push.code, push.stderr).toBe(0);

    // branches（「分支与 PR」区数据面）
    const branches = (await (
      await req(s.app, 'GET', `/api/projects/${record.id}/branches`)
    ).json()) as { defaultBranch: string | null; branches: { name: string; isDefault: boolean }[] };
    expect(branches.defaultBranch).toBe('main');
    expect(branches.branches).toContainEqual({ name: 'main', isDefault: true });

    // tree?ref=（读裸库 ref 树，无检出要求，02 §3）
    const tree = (await (
      await req(s.app, 'GET', `/api/projects/${record.id}/tree?ref=main`)
    ).json()) as {
      ref: string;
      commit: string;
      entries: { name: string; path: string; type: string; size: number | null }[];
    };
    expect(tree.ref).toBe('main');
    expect(tree.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(tree.entries).toContainEqual({
      name: 'README.md',
      path: 'README.md',
      type: 'blob',
      size: Buffer.byteLength(readme),
    });

    // file?path=&ref=（单文件读回；83 号验证同款「main README 读回」语义）
    const file = (await (
      await req(s.app, 'GET', `/api/projects/${record.id}/file?path=README.md&ref=main`)
    ).json()) as { encoding: string; content: string; size: number };
    expect(file.encoding).toBe('utf-8');
    expect(file.content).toBe(readme);
    expect(file.size).toBe(Buffer.byteLength(readme));

    // 缺 ref → HEAD（= main）
    const headTree = (await (
      await req(s.app, 'GET', `/api/projects/${record.id}/tree`)
    ).json()) as { entries: unknown[] };
    expect(headTree.entries).toHaveLength(1);
  });

  test('conv 分支 push（02 §5.5：conv-<conversationId>）+ 二进制文件 base64', async () => {
    const record = await createProject({ name: 'conv-probe', repoKind: 'hosted' });
    const dir = workdir('conv');
    const repoDir = join(dir, 'repo');
    await git(['clone', authedUrl(record), repoDir], dir);
    // 基座 main 先立（空库无 ref 不能 worktree；种子提交）
    writeFileSync(join(repoDir, 'README.md'), '# conv-probe\n');
    await git(['checkout', '-B', 'main'], repoDir);
    await git(['add', '.'], repoDir);
    await git(['commit', '-m', 'init'], repoDir);
    await git(['push', '-u', 'origin', 'main'], repoDir);
    // 任务分支 = 品牌前缀 + conversationId（02 §5.5 词表；前缀 tds/ 品牌位 → #44）
    const convId = '01a0b85b-0000-7000-8000-000000000000';
    const branch = conversationBranch(convId);
    expect(branch).toBe(`${BRAND.branchPrefix}${convId}`);
    expect((await git(['checkout', '-b', branch], repoDir)).code).toBe(0);
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'); // ‰PNG 魔数段
    writeFileSync(join(repoDir, 'icon.png'), png);
    await git(['add', '.'], repoDir);
    await git(['commit', '-m', 'feat: icon'], repoDir);
    const push = await git(['push', '-u', 'origin', branch], repoDir);
    expect(push.code, push.stderr).toBe(0);
    // 分支面读回 + conv 分支 tree
    const branches = (await (
      await req(s.app, 'GET', `/api/projects/${record.id}/branches`)
    ).json()) as { branches: { name: string }[] };
    expect(branches.branches.map((b) => b.name)).toEqual(['main', branch]);
    const file = (await (
      await req(s.app, 'GET', `/api/projects/${record.id}/file?path=icon.png&ref=${branch}`)
    ).json()) as { encoding: string; content: string };
    expect(file.encoding).toBe('base64');
    expect(Buffer.from(file.content, 'base64').equals(png)).toBe(true);
  });

  test('同名项目 repoName 唯一化（-2 后缀 [设计]）；未知 repo 404', async () => {
    const first = await createProject({ name: 'dupe probe', repoKind: 'hosted' });
    const second = await createProject({ name: 'dupe probe', repoKind: 'hosted' });
    expect(first.repoName).toBe('dupe-probe'); // slug：空格 → -
    expect(second.repoName).toBe('dupe-probe-2');
    const r = await fetch(
      `${baseUrl}/git/${s.team.id}/no-such-repo/info/refs?service=git-upload-pack`,
      {
        headers: { authorization: `Basic ${Buffer.from(`git:${API_KEY}`).toString('base64')}` },
      },
    );
    expect(r.status).toBe(404);
  });

  test('文件面错误形状：缺 path 400 / 未知 ref·文件 404 / github 项目无本地库 404', async () => {
    const record = await createProject({ name: 'err-probe', repoKind: 'hosted' });
    const missingPath = await req(s.app, 'GET', `/api/projects/${record.id}/file`);
    expect(missingPath.status).toBe(400);
    expect(Object.keys((await missingPath.json()) as Record<string, unknown>)).toEqual(['error']);
    const badRef = await req(s.app, 'GET', `/api/projects/${record.id}/tree?ref=no-such-ref`);
    expect(badRef.status).toBe(404);
    // 路径护栏：`..` 段拒绝（400 族，绝不逃逸裸库）
    const traversal = await req(s.app, 'GET', `/api/projects/${record.id}/file?path=../server.db`);
    expect(traversal.status).toBe(400);
    const gh = await createProject({
      name: 'imported',
      repoKind: 'github',
      githubRepo: 'octocat/hello',
    });
    expect((await req(s.app, 'GET', `/api/projects/${gh.id}/tree`)).status).toBe(404);
  });
});

describe('GitHub 接入形态（02 §3：记录面 + executor 契约实走）', () => {
  test('POST repoKind:github → owner/repo 记录 + cloneUrl 派生；坏 owner/repo 400', async () => {
    const record = await createProject({
      name: 'imported',
      repoKind: 'github',
      githubRepo: 'octocat/hello',
    });
    expect(record.repoKind).toBe('github');
    expect(record.githubRepo).toBe('octocat/hello');
    expect(record.cloneUrl).toBe('https://github.com/octocat/hello.git');
    const bad = await req(s.app, 'POST', '/api/projects', {
      name: 'bad',
      repoKind: 'github',
      githubRepo: 'no-slash',
    });
    expect(bad.status).toBe(400);
    // GET /api/projects 读回同形
    const list = (await (await req(s.app, 'GET', `/api/projects?teamId=${s.team.id}`)).json()) as
      | ProjectRecord[]
      | { error: string };
    expect(Array.isArray(list)).toBe(true);
    const found = (list as ProjectRecord[]).find((p) => p.id === record.id);
    expect(found).toMatchObject({ repoKind: 'github', githubRepo: 'octocat/hello' });
  });

  test('executor 契约实走：clone 用户自有 repo → conv-* 分支 → push（远端本地 bare 代位）', async () => {
    // GitHub 远端代位：本地 bare（git 协议面同形；CI 无 GitHub 凭证）。
    const remoteDir = join(workdir('gh-remote'), 'hello.git');
    expect((await runGit(['init', '--bare', remoteDir], { env: GIT_ENV })).code).toBe(0);
    const record = await createProject({
      name: 'imported',
      repoKind: 'github',
      githubRepo: 'octocat/hello',
    });
    expect(record.cloneUrl).toContain('github.com'); // 记录面指向 GitHub；实走用代位远端

    const dir = workdir('gh-walk');
    const repoDir = join(dir, 'repo');
    expect((await git(['clone', remoteDir, repoDir], dir)).code).toBe(0);
    writeFileSync(join(repoDir, 'CHANGELOG.md'), '# changelog\n');
    await git(['checkout', '-B', 'main'], repoDir);
    await git(['add', '.'], repoDir);
    await git(['commit', '-m', 'docs: changelog'], repoDir);
    await git(['push', '-u', 'origin', 'main'], repoDir);
    // executor push conv-* 分支（02 §3 GitHub 行；分支词表 02 §5.5）
    const branch = conversationBranch(newUuidv7());
    expect((await git(['checkout', '-b', branch], repoDir)).code).toBe(0);
    writeFileSync(join(repoDir, 'CHANGELOG.md'), '# changelog\n\n- conv 轮改动\n');
    await git(['add', '.'], repoDir);
    await git(['commit', '-m', 'feat: conv round'], repoDir);
    const push = await git(['push', '-u', 'origin', branch], repoDir);
    expect(push.code, push.stderr).toBe(0);
    // 远端读回：conv 分支在（PR 建卡面依赖 GitHub API，归 M3+）
    const lsRemote = await git(['ls-remote', '--heads', remoteDir], dir);
    const heads = lsRemote.stdout.toString();
    expect(heads).toContain('refs/heads/main');
    expect(heads).toContain(`refs/heads/${branch}`);
    expect(branch.startsWith(BRAND.branchPrefix)).toBe(true);
  });
});
