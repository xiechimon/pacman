// worktree 契约落地（02 §5.5 全表，r3 §1.4 实测；shared WorktreeOps 缝的
// daemon 实现，01 §4.3）：
// - 基座 clone `<workspacesRoot>/<projectId>/repo`；任务 worktree
//   `<workspacesRoot>/<conversationId>`；分支 `tds/conv-<conversationId>`
//   （brand.ts conversationBranch()）。
// - `worktree add -b <branch> <dir> <base>`，base = origin/<convBranch>
//   （已 fetch 时）否则 origin/<defaultBranch>。
// - 复用 `Worktree reused`；checkpoint 恢复 `reset --hard` + `clean -fd` →
//   `Worktree restored`；陈旧 `worktree remove --force` + `prune` + `branch -D`；
//   孤儿回收 TTL 7×24h（ORPHAN_WORKTREE_TTL_MS）。
// - projectLock(projectId) 串行化同项目工作区操作。
// - 防分叉护栏 REMOTE_BRANCH_DIVERGED（shared RemoteBranchDivergedError）。
// git spawn 一律经 git.ts 原语（缝纪律，01 §7.3）。

import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  conversationBranch,
  type GitCredentials,
  ORPHAN_WORKTREE_TTL_MS,
  type OrphanCleanupInput,
  type PreparedWorkspace,
  RemoteBranchDivergedError,
  type WorktreeOps,
  type WorktreePrepareInput,
} from '@pacman/shared';
import { gitPrim, withGitNetRetries } from './git.js';
import type { DaemonLogger } from './log.js';

/** conversationId 目录形状（UUIDv7，r3 §1.4 样本）——孤儿扫描的判别式。 */
const CONV_DIR_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface WorkspaceManagerOpts {
  logger: DaemonLogger;
  /** 测试注入（缺省 7×24h，02 §5.5）。 */
  orphanTtlMs?: number;
}

export class WorkspaceManager implements WorktreeOps {
  /** projectLock(projectId)：同项目工作区操作串行化（02 §5.5 并发保护）。 */
  private readonly locks = new Map<string, Promise<unknown>>();
  private readonly logger: DaemonLogger;
  private readonly orphanTtlMs: number;

  constructor(opts: WorkspaceManagerOpts) {
    this.logger = opts.logger;
    this.orphanTtlMs = opts.orphanTtlMs ?? ORPHAN_WORKTREE_TTL_MS;
  }

  private async withProjectLock<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(projectId) ?? Promise.resolve();
    const run = prev.then(fn, fn); // 前锁失败不传染（各步独立收尾）。
    // 链尾 swallow：锁链本身不因业务错误断裂。
    const tail = run.then(
      () => undefined,
      () => undefined,
    );
    this.locks.set(projectId, tail);
    try {
      return await run;
    } finally {
      if (this.locks.get(projectId) === tail) this.locks.delete(projectId);
    }
  }

  async prepare(input: WorktreePrepareInput): Promise<PreparedWorkspace> {
    return this.withProjectLock(input.projectId, async () => {
      const branch = conversationBranch(input.conversationId);
      const baseRepoDir = join(input.workspacesRoot, input.projectId, 'repo');
      const convDir = join(input.workspacesRoot, input.conversationId);

      // —— 基座 clone / fetch（r3 §1.5 日志行 `Cloning <teamId>/<repoName>
      // (branch: main)` 形状；teamId/repoName = cloneUrl 路径段）——
      if (!existsSync(join(baseRepoDir, '.git')) && !isBareish(baseRepoDir)) {
        const label = repoLabel(input.cloneUrl);
        const defaultBranchGuess = 'main';
        this.logger.workspace(`Cloning ${label} (branch: ${defaultBranchGuess})`);
        await withGitNetRetries(() =>
          gitPrim.clone(input.cloneUrl, baseRepoDir, input.credentials),
        );
      } else {
        await withGitNetRetries(() => gitPrim.fetch(baseRepoDir, input.credentials));
      }
      const defaultBranch = await gitPrim.remoteDefaultBranch(baseRepoDir);

      // —— 任务 worktree：存在→reused；不在→add -b（base 二择，02 §5.5）——
      if (isWorktreeDir(convDir)) {
        // 防分叉护栏（02 §5.5）：origin/<branch> 有本机没有的提交且 worktree
        // 不在该分支 → 抛错。
        if (await gitPrim.hasRemoteBranch(baseRepoDir, branch)) {
          const current = await gitPrim.currentBranch(convDir);
          const remoteAhead = await gitPrim.countRemoteAhead(baseRepoDir, branch);
          if (remoteAhead > 0 && current !== branch) throw new RemoteBranchDivergedError(branch);
        }
        this.logger.workspace('Worktree reused');
        return { cwd: convDir, baseRepoDir, branch, defaultBranch, reused: true };
      }

      // 陈旧残留（目录在但非 worktree / 分支在但 worktree 不在）→ 清理三步
      // （remove --force + prune + branch -D，r3 §1.4）。
      if (existsSync(convDir)) rmSync(convDir, { recursive: true, force: true });
      await gitPrim.worktreePrune(baseRepoDir);
      const remoteHas = await gitPrim.hasRemoteBranch(baseRepoDir, branch);
      const localHas = await gitPrim.hasLocalBranch(baseRepoDir, branch);
      if (localHas) await gitPrim.branchDelete(baseRepoDir, branch); // 陈旧分支重建
      const base = remoteHas ? `origin/${branch}` : `origin/${defaultBranch}`;
      if (!(await gitPrim.hasRemoteBranch(baseRepoDir, defaultBranch)) && !remoteHas) {
        throw new Error(`remote has no base branch (origin/${defaultBranch} missing)`);
      }
      await gitPrim.worktreeAdd(baseRepoDir, branch, convDir, base);
      this.logger.workspace(`Worktree added (${branch} from ${base})`);
      return { cwd: convDir, baseRepoDir, branch, defaultBranch, reused: false };
    });
  }

  async commitAll(cwd: string, message: string, identity: { name: string; email: string }) {
    await gitPrim.addAll(cwd);
    const committed = await gitPrim.commit(cwd, message, identity);
    const head = await gitPrim.head(cwd);
    return { committed, head };
  }

  async push(cwd: string, branch: string, credentials: GitCredentials | null): Promise<void> {
    // 重试预算覆盖 git-host 5xx 窗口（02 §5.5/r3 bundle 注原话语义）。
    await withGitNetRetries(() => gitPrim.push(cwd, branch, credentials));
  }

  async mergeDefaultBranch(cwd: string, defaultBranch: string): Promise<{ output: string }> {
    const output = await gitPrim.mergeNoEdit(cwd, `origin/${defaultBranch}`);
    return { output };
  }

  async headCommit(cwd: string): Promise<string | null> {
    return gitPrim.head(cwd);
  }

  async countAhead(cwd: string, defaultBranch: string): Promise<number> {
    return gitPrim.countAhead(cwd, defaultBranch);
  }

  async restoreCheckpoint(cwd: string, commit: string): Promise<void> {
    await gitPrim.resetHard(cwd, commit);
    await gitPrim.cleanFd(cwd);
    this.logger.workspace('Worktree restored');
  }

  /** 孤儿回收（r3 §1.4 cleanupOrphanWorktrees(ttlMs = 7*24h)）：conv 形状
   * 目录、非活步（journal pending 面）、龄超 TTL → 陈旧清理三步。龄 =
   * 目录 mtime 与最后提交时刻取新 [设计]（未采观测值）。 */
  async cleanupOrphans(input: OrphanCleanupInput): Promise<string[]> {
    const ttlMs = input.ttlMs > 0 ? input.ttlMs : this.orphanTtlMs;
    const active = new Set(input.activeConversationIds);
    const removed: string[] = [];
    let entries: string[] = [];
    try {
      entries = readdirSync(input.workspacesRoot);
    } catch {
      return removed; // 根目录不存在 = 无孤儿
    }
    for (const name of entries) {
      if (!CONV_DIR_PATTERN.test(name) || active.has(name)) continue;
      const dir = join(input.workspacesRoot, name);
      if (!isWorktreeDir(dir)) continue;
      const age = input.now - (await this.lastActivity(dir));
      if (age < ttlMs) continue;
      try {
        await this.removeStale(dir);
        removed.push(name);
      } catch (err) {
        this.logger.workspace(
          `orphan cleanup failed for ${name}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return removed;
  }

  /** 单工作区陈旧清理（remove --force + prune + branch -D，02 §5.5）。 */
  async removeStale(convDir: string): Promise<void> {
    const branch = await gitPrim.currentBranch(convDir);
    const commonDir = await gitPrim.commonGitDir(convDir);
    if (commonDir !== null) {
      const baseRepoDir = dirname(commonDir);
      await gitPrim.worktreeRemoveForce(baseRepoDir, convDir);
      await gitPrim.worktreePrune(baseRepoDir);
      if (branch !== null) {
        await gitPrim.branchDelete(baseRepoDir, branch).catch(() => {});
      }
      return;
    }
    // 基座已失联：目录直删（无 worktree 元数据可清）。
    rmSync(convDir, { recursive: true, force: true });
  }

  private async lastActivity(dir: string): Promise<number> {
    let latest = statSync(dir).mtimeMs;
    const head = await gitPrim.head(dir);
    if (head !== null) {
      const r = await gitPrim.commitTime(dir, head);
      if (r !== null) latest = Math.max(latest, r);
    }
    return latest;
  }
}

function isWorktreeDir(dir: string): boolean {
  return existsSync(join(dir, '.git'));
}

function isBareish(dir: string): boolean {
  return existsSync(join(dir, 'HEAD'));
}

/** `Cloning <teamId>/<repoName>` 标签（r3 §1.5 行形；托管 = /git/ 后两段，
 * github = owner/repo）。 */
export function repoLabel(cloneUrl: string): string {
  try {
    const path = new URL(cloneUrl).pathname.replace(/^\/+|\/+$/g, '');
    const segments = path.split('/').filter(Boolean);
    if (segments[0] === 'git') segments.shift();
    return segments
      .slice(-2)
      .join('/')
      .replace(/\.git$/, '');
  } catch {
    return cloneUrl;
  }
}

export { CONV_DIR_PATTERN };
