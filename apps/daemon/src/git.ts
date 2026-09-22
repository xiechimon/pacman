// daemon 侧 git 原语（GitOps 缝的 daemon 半，01 §4.3「与 server 共缝，shared
// 定义 daemon 实现」；词表 = 02 §5.5 worktree 契约全表，r3 §1.4 实测）。
// 缝纪律（01 §7.3）：本模块 = daemon 内唯一 git spawn 点（workspace.ts 经本
// 模块消费；isomorphic-git/simple-git 不引入，01 §4.2）。
// 注入安全：全程 argv 数组（无 shell）。
// 凭证纪律（02 §5.4/§8 per-step 下发不落盘 + relay 工具名对照 push_credential
// r5 §3.1）：git 凭证只经 GIT_CONFIG_* env 注入 credential.helper（git ≥2.31）
// ——不进 argv（ps 面）、不进 .git/config、不进 ~/.git-credentials、不落任何盘。

import { spawn } from 'node:child_process';
import type { CommitIdentity, GitCredentials } from '@pacman/shared';

export interface GitRunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export function runGit(
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {},
): Promise<GitRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      windowsHide: true,
      ...(opts.timeoutMs !== undefined ? { timeout: opts.timeoutMs } : {}),
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (c: Buffer) => stdout.push(c));
    child.stderr.on('data', (c: Buffer) => stderr.push(c));
    child.on('error', reject);
    child.on('close', (code) =>
      resolve({
        code: code ?? 0,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      }),
    );
  });
}

/** 非零退 = 抛错（stderr 上浮；调用方按语义捕获）。 */
export async function runGitOk(
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {},
): Promise<string> {
  const r = await runGit(args, opts);
  if (r.code !== 0) {
    throw new Error(`git ${args[0]} failed (${r.code}): ${r.stderr.trim() || r.stdout.trim()}`);
  }
  return r.stdout.trim();
}

/** per-step git 凭证 → env 注入（内存态；见头注凭证纪律）。密码含 shell 元
 * 字符亦安全（credential.helper 值不经 shell——git 直接以 `sh -c` 执行 fn
 * 体，echo 单引号位转义 `'` → `'\''`）。 */
export function gitCredentialEnv(cred: GitCredentials): NodeJS.ProcessEnv {
  const sq = (v: string) => v.replace(/'/g, `'\\''`);
  const helper = `!f() { echo username=${sq(cred.username)}; echo password=${sq(cred.password)}; }; f`;
  return {
    // 首条空值重置 credential.helper 列表（git 语义：空值清空此前累积的全部
    // helper）。缺此条则系统级/全局 osxkeychain 等 helper 叠加在前：同主机
    // 命中陈旧凭证（上一步已撤销的 token）致 auth 失败，且成功轮会回写钥匙串
    // （凭证落盘面，破 02 §8 不落盘纪律）。重置后本步内联 helper 是唯一来源。
    GIT_CONFIG_COUNT: '2',
    GIT_CONFIG_KEY_0: 'credential.helper',
    GIT_CONFIG_VALUE_0: '',
    GIT_CONFIG_KEY_1: 'credential.helper',
    GIT_CONFIG_VALUE_1: helper,
    // 交互提示关闭（无 tty 场景挂起护栏）。
    GIT_TERMINAL_PROMPT: '0',
  };
}

export function commitEnv(identity: CommitIdentity): NodeJS.ProcessEnv {
  return {
    GIT_AUTHOR_NAME: identity.name,
    GIT_AUTHOR_EMAIL: identity.email,
    GIT_COMMITTER_NAME: identity.name,
    GIT_COMMITTER_EMAIL: identity.email,
  };
}

const META_TIMEOUT_MS = 30_000;
/** 网络面预算（02 §5.5 重试预算行：push 覆盖 git-host 5xx 窗口；冷 worktree
 * ls-remote+fetch「~2 min typical, ~8 min worst on /done's path」r3 原文）。 */
const NET_TIMEOUT_MS = 480_000;

// —— 原语面（workspace.ts 组装 02 §5.5 契约行为）——————————————————————————

export const gitPrim = {
  async clone(url: string, dir: string, cred: GitCredentials | null): Promise<void> {
    await runGitOk(['clone', '--end-of-options', url, dir], {
      env: cred ? gitCredentialEnv(cred) : undefined,
      timeoutMs: NET_TIMEOUT_MS,
    });
  },

  async fetch(repoDir: string, cred: GitCredentials | null): Promise<void> {
    await runGitOk(['fetch', '--prune', 'origin'], {
      cwd: repoDir,
      env: cred ? gitCredentialEnv(cred) : undefined,
      timeoutMs: NET_TIMEOUT_MS,
    });
  },

  /** 默认分支（origin/HEAD symbolic-ref；缺省回退 main——r3 §3.6 origin/main
   * 正典值 [推断回退]）。 */
  async remoteDefaultBranch(repoDir: string): Promise<string> {
    const r = await runGit(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], {
      cwd: repoDir,
      timeoutMs: META_TIMEOUT_MS,
    });
    if (r.code === 0) {
      const name = r.stdout.trim().replace(/^origin\//, '');
      if (name !== '') return name;
    }
    return 'main';
  },

  async hasRemoteBranch(repoDir: string, branch: string): Promise<boolean> {
    const r = await runGit(['rev-parse', '--verify', `refs/remotes/origin/${branch}`], {
      cwd: repoDir,
      timeoutMs: META_TIMEOUT_MS,
    });
    return r.code === 0;
  },

  async hasLocalBranch(repoDir: string, branch: string): Promise<boolean> {
    const r = await runGit(['rev-parse', '--verify', `refs/heads/${branch}`], {
      cwd: repoDir,
      timeoutMs: META_TIMEOUT_MS,
    });
    return r.code === 0;
  },

  /** 远端领先本地的提交数（防分叉护栏数据面，02 §5.5）。 */
  async countRemoteAhead(repoDir: string, branch: string): Promise<number> {
    const local = await gitPrim.hasLocalBranch(repoDir, branch);
    const range = local ? `refs/heads/${branch}..refs/remotes/origin/${branch}` : '';
    const args = local
      ? ['rev-list', '--count', range]
      : ['rev-list', '--count', `refs/remotes/origin/${branch}`];
    const r = await runGit(args, { cwd: repoDir, timeoutMs: META_TIMEOUT_MS });
    if (r.code !== 0) return 0;
    const n = Number.parseInt(r.stdout.trim(), 10);
    return Number.isNaN(n) ? 0 : n;
  },

  async worktreeAdd(
    repoDir: string,
    branch: string,
    dir: string,
    base: string | null,
  ): Promise<void> {
    // base null = 挂既有本地分支（陈旧清理后的重建路径）。
    const args =
      base !== null
        ? ['worktree', 'add', '-b', branch, dir, base]
        : ['worktree', 'add', dir, branch];
    await runGitOk(args, { cwd: repoDir, timeoutMs: META_TIMEOUT_MS });
  },

  async worktreeRemoveForce(repoDir: string, dir: string): Promise<void> {
    await runGitOk(['worktree', 'remove', '--force', dir], {
      cwd: repoDir,
      timeoutMs: META_TIMEOUT_MS,
    });
  },

  async worktreePrune(repoDir: string): Promise<void> {
    await runGitOk(['worktree', 'prune'], { cwd: repoDir, timeoutMs: META_TIMEOUT_MS });
  },

  async branchDelete(repoDir: string, branch: string): Promise<void> {
    await runGitOk(['branch', '-D', branch], { cwd: repoDir, timeoutMs: META_TIMEOUT_MS });
  },

  async currentBranch(dir: string): Promise<string | null> {
    const r = await runGit(['branch', '--show-current'], { cwd: dir, timeoutMs: META_TIMEOUT_MS });
    return r.code === 0 && r.stdout.trim() !== '' ? r.stdout.trim() : null;
  },

  /** checkpoint 恢复两步（02 §5.5：`reset --hard` + `clean -fd`）。 */
  async resetHard(dir: string, commit: string): Promise<void> {
    await runGitOk(['reset', '--hard', '--end-of-options', commit], {
      cwd: dir,
      timeoutMs: META_TIMEOUT_MS,
    });
  },

  async cleanFd(dir: string): Promise<void> {
    await runGitOk(['clean', '-fd'], { cwd: dir, timeoutMs: META_TIMEOUT_MS });
  },

  async addAll(dir: string): Promise<void> {
    await runGitOk(['add', '-A'], { cwd: dir, timeoutMs: META_TIMEOUT_MS });
  },

  /** commit；干净树（nothing to commit）= false 不抛。 */
  async commit(dir: string, message: string, identity: CommitIdentity): Promise<boolean> {
    const r = await runGit(['commit', '-m', message], {
      cwd: dir,
      env: commitEnv(identity),
      timeoutMs: META_TIMEOUT_MS,
    });
    if (r.code === 0) return true;
    if (/nothing to commit/i.test(r.stdout) || /nothing to commit/i.test(r.stderr)) return false;
    throw new Error(`git commit failed (${r.code}): ${r.stderr.trim() || r.stdout.trim()}`);
  },

  async head(dir: string): Promise<string | null> {
    const r = await runGit(['rev-parse', '--verify', 'HEAD'], {
      cwd: dir,
      timeoutMs: META_TIMEOUT_MS,
    });
    if (r.code !== 0) return null;
    const sha = r.stdout.trim();
    return /^[0-9a-f]{40,64}$/.test(sha) ? sha : null;
  },

  async push(dir: string, branch: string, cred: GitCredentials | null): Promise<void> {
    await runGitOk(['push', '--end-of-options', 'origin', `refs/heads/${branch}`], {
      cwd: dir,
      env: cred ? gitCredentialEnv(cred) : undefined,
      timeoutMs: NET_TIMEOUT_MS,
    });
  },

  /** `git merge --no-edit origin/<defaultBranch>`（02 §5.5/r3 §3.6）；冲突 =
   * 自动 `merge --abort` 后抛错（失败仅人工重跑，02/A6）。 */
  async mergeNoEdit(dir: string, ref: string): Promise<string> {
    const r = await runGit(['merge', '--no-edit', '--end-of-options', ref], {
      cwd: dir,
      timeoutMs: META_TIMEOUT_MS,
    });
    if (r.code === 0) return r.stdout.trim();
    if (/conflict/i.test(r.stdout + r.stderr)) {
      await runGit(['merge', '--abort'], { cwd: dir, timeoutMs: META_TIMEOUT_MS });
      throw new Error(`merge conflict against ${ref} (aborted; manual rerun required)`);
    }
    throw new Error(`git merge failed (${r.code}): ${r.stderr.trim() || r.stdout.trim()}`);
  },

  /** conv 分支领先 origin/<default> 的提交数（hasChanges 判定面）。 */
  async countAhead(dir: string, defaultBranch: string): Promise<number> {
    const r = await runGit(['rev-list', '--count', `refs/remotes/origin/${defaultBranch}..HEAD`], {
      cwd: dir,
      timeoutMs: META_TIMEOUT_MS,
    });
    if (r.code !== 0) return 0;
    const n = Number.parseInt(r.stdout.trim(), 10);
    return Number.isNaN(n) ? 0 : n;
  },

  /** 提交时刻（epoch ms；孤儿回收龄判定用 [设计]）。 */
  async commitTime(dir: string, commit: string): Promise<number | null> {
    const r = await runGit(['log', '-1', '--format=%ct', '--end-of-options', commit], {
      cwd: dir,
      timeoutMs: META_TIMEOUT_MS,
    });
    if (r.code !== 0) return null;
    const secs = Number.parseInt(r.stdout.trim(), 10);
    return Number.isNaN(secs) ? null : secs * 1000;
  },

  async commonGitDir(dir: string): Promise<string | null> {
    const r = await runGit(['rev-parse', '--path-format=absolute', '--git-common-dir'], {
      cwd: dir,
      timeoutMs: META_TIMEOUT_MS,
    });
    return r.code === 0 && r.stdout.trim() !== '' ? r.stdout.trim() : null;
  },
};

/** 网络重试预算 [设计]（02 §5.5「push 重试覆盖 git-host 5xx 窗口」的最小
 * 等价物：两档退避；冷 worktree 长预算由 NET_TIMEOUT_MS 兜）。 */
export const GIT_NET_RETRY_DELAYS_MS = [1_000, 5_000] as const;

export async function withGitNetRetries<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= GIT_NET_RETRY_DELAYS_MS.length; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const delay = GIT_NET_RETRY_DELAYS_MS[i - 1];
      if (delay === undefined) break;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
