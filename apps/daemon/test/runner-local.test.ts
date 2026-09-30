// runner repo 形态接线（spec 12 G2-T2，#362）：local/github kind 进入
// worktree 契约 + local merge 步 push 后 ff-only 落回用户仓库。
// harness 同 runner-stop.test.ts（FakeClient + fake WorktreeOps 录制调用序）。
// 失败方式枚举先于实现固化（AGENTS.md 测试规则 3）：
//   1. local merge 步：prepare 开 worktree（cloneUrl = 用户仓库路径）→
//      commitAll → mergeDefaultBranch → push（凭证 null）→
//      landLocalFastForward(用户仓库, conv 分支)，序在 push 之后；done success
//   2. landing 抛错（git 自拒）→ done failed，errorMessage 含 git 拒绝原文
//   3. github merge 步：prepare 开 worktree（https clone）→ push 消费 per-step
//      凭证 {x-access-token, token}；不触发 landing（v1 done = conv 分支已推上）
//   4. local build 步：push 照常，不触发 landing（落地仅 merge 步）
//   5. 无 repo 项目（repo null）：不开 worktree，裸任务目录退化形不变

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  AgentBackend,
  AgentSessionHandle,
  ClaimedStep,
  GitCredentials,
  MachineDoneBody,
  MachineStreamEvent,
  ToolCallRecord,
  TranscriptUpload,
  WorktreeOps,
} from '@pacman/shared';
import { describe, expect, test } from 'vitest';
import { PI_CAPABILITIES } from '../src/backend/pi.js';
import { StepJournal } from '../src/journal.js';
import type { DaemonLogger } from '../src/log.js';
import type { MachineApi } from '../src/machine-client.js';
import { runStep } from '../src/runner.js';
import { statePaths } from '../src/state.js';

const USER_REPO = '/tmp/pacman-user-repo-probe';
const GITHUB_TOKEN: GitCredentials = { username: 'x-access-token', password: 'ghp_steptoken' };

function captureLogger(): { logger: DaemonLogger; lines: string[] } {
  const lines: string[] = [];
  const push = (prefix: string | undefined, msg: string) =>
    lines.push(prefix ? `[${prefix}] ${msg}` : msg);
  const logger: DaemonLogger = {
    raw: (msg) => push(undefined, msg),
    prefixed: (prefix, msg) => push(prefix, msg),
    supervisor: (msg) => push('supervisor', msg),
    machine: (msg) => push('machine', msg),
    step: (msg) => push('step', msg),
    workspace: (msg) => push('workspace', msg),
    recover: (msg) => push('recover', msg),
    wake: (msg) => push('wake', msg),
    skills: (msg) => push('skills', msg),
    mcp: (msg) => push('mcp', msg),
  };
  return { logger, lines };
}

function claimedStep(
  kind: 'build' | 'merge',
  repo: NonNullable<ClaimedStep['project']>['repo'],
): ClaimedStep {
  return {
    step: { id: 's1', buildId: 'conv-1', kind, machineId: 'm1', createdAt: 1 },
    conversationId: 'conv-1',
    session: { action: 'new', sessionId: null },
    todo: { id: 't1', seqNum: 1, title: 'local 探针', spec: '改一行' },
    project: { id: 'p1', name: 'demo', repo },
    agent: {
      id: 'a1',
      displayName: 'stub-builder',
      description: null,
      provider: null,
      modelId: 'stub-model',
      thinkingLevel: null,
    },
  };
}

class FakeClient implements MachineApi {
  calls: string[] = [];
  doneBodies: { stepId: string; body: MachineDoneBody }[] = [];
  git: GitCredentials | null = null;

  async enroll(): Promise<never> {
    throw new Error('unused');
  }
  async me(): Promise<never> {
    throw new Error('unused');
  }
  async presence() {}
  async recover() {
    return { steps: [] };
  }
  async claim() {
    return null;
  }
  async heartbeat() {}
  async tool(_stepId: string, _call: ToolCallRecord) {}
  async transcriptDelta() {}
  async relayTool() {
    return '{}';
  }
  async token() {
    this.calls.push('token');
    return {
      provider: {
        kind: 'http' as const,
        providerId: 'stub-gw',
        baseUrl: 'http://127.0.0.1:9/v1',
        api: 'openai-completions' as const,
        authHeader: true,
        models: [{ id: 'stub-model', name: 'stub-model' }],
      },
      env: {},
      git: this.git,
    };
  }
  async uploadUrls(_stepId: string, files: { name: string }[]) {
    return {
      uploads: files.map((f, i) => ({
        name: f.name,
        url: `http://server/up/${i}`,
        method: 'PUT' as const,
        headers: {},
      })),
    };
  }
  async putUpload(
    _url: string,
    _headers: Record<string, string>,
    _body: TranscriptUpload | string,
  ) {}
  async done(stepId: string, body: MachineDoneBody) {
    this.doneBodies.push({ stepId, body });
    this.calls.push(`done:${stepId}:${body.status}`);
  }
  async steer() {
    return null;
  }
  async stop() {
    return null;
  }
  async syncResult(_syncId: string, _body: { status: string; errorMessage?: string }) {}
  async stream(_signal: AbortSignal, _onEvent: (ev: MachineStreamEvent) => void) {}
}

/** 录制型 fake worktree：全操作进 calls；landing 可注入失败。 */
function fakeWorkspace(opts: { landError?: string } = {}) {
  const calls: string[] = [];
  const pushes: { branch: string; cred: GitCredentials | null }[] = [];
  const ws: WorktreeOps = {
    async prepare(input) {
      calls.push(`prepare:${input.cloneUrl}`);
      return {
        cwd: join(input.workspacesRoot, input.conversationId),
        baseRepoDir: join(input.workspacesRoot, input.projectId, 'repo'),
        branch: `pacman/conv-${input.conversationId}`,
        defaultBranch: 'main',
        reused: false,
      };
    },
    async commitAll() {
      calls.push('commitAll');
      return { committed: true, head: 'abc123' };
    },
    async push(_cwd, branch, cred) {
      calls.push(`push:${branch}`);
      pushes.push({ branch, cred });
    },
    async mergeDefaultBranch() {
      calls.push('mergeDefaultBranch');
      return { output: 'Already up to date' };
    },
    async landLocalFastForward(userRepoDir, branch) {
      calls.push(`landLocalFastForward:${userRepoDir}:${branch}`);
      if (opts.landError) throw new Error(opts.landError);
    },
    async headCommit() {
      return 'abc123';
    },
    async countAhead() {
      return 1;
    },
    async restoreCheckpoint() {},
    async cleanupOrphans() {
      return [];
    },
  };
  return { ws, calls, pushes };
}

/** 自然完成 backend：text_delta + done（无工具行——git 真值面接管 hasChanges）。 */
function completingBackend(): AgentBackend {
  return {
    capabilities: PI_CAPABILITIES,
    async createSession(): Promise<AgentSessionHandle> {
      return {
        sessionId: 'pi-sess-local',
        events: (async function* () {
          yield { type: 'text_delta', text: 'ok' } as never;
          yield { type: 'done', usage: [] } as never;
        })(),
        async steer() {},
        async stop() {},
        usage: () => [],
      };
    },
    async continueSession(): Promise<never> {
      throw new Error('unused');
    },
  };
}

async function setup(
  claimed: ClaimedStep,
  opts: { landError?: string; git?: GitCredentials | null } = {},
) {
  const home = mkdtempSync(join(tmpdir(), 'pacman-runner-local-'));
  const paths = statePaths(home, join(home, 'workspaces'));
  const { logger, lines } = captureLogger();
  const client = new FakeClient();
  client.git = opts.git ?? null;
  const journal = new StepJournal(paths.outboxDir);
  const { ws, calls, pushes } = fakeWorkspace(
    opts.landError !== undefined ? { landError: opts.landError } : {},
  );
  const deps = {
    client,
    journal,
    backend: completingBackend(),
    logger,
    paths,
    workspace: ws,
    workspacesDir: join(home, 'workspaces'),
    mcpConfigPath: join(home, 'claude.json'), // runner-stop 同款占位（步无 mcpServers slug = 不读）
    heartbeatIntervalMs: 60_000,
  };
  await runStep(deps, claimed);
  return { client, calls, pushes, lines };
}

describe('runner repo 形态接线（spec 12 G2-T2）', () => {
  test('失败方式 1：local merge 步 → worktree + push 回用户仓库 + ff-only 落地（序在 push 后）+ done success', async () => {
    const { client, calls } = await setup(
      claimedStep('merge', { kind: 'local', cloneUrl: USER_REPO }),
    );
    expect(calls).toContain(`prepare:${USER_REPO}`);
    expect(calls).toContain('mergeDefaultBranch');
    expect(calls).toContain('push:pacman/conv-conv-1');
    expect(calls).toContain(`landLocalFastForward:${USER_REPO}:pacman/conv-conv-1`);
    expect(calls.indexOf('push:pacman/conv-conv-1')).toBeLessThan(
      calls.indexOf(`landLocalFastForward:${USER_REPO}:pacman/conv-conv-1`),
    );
    expect(client.doneBodies[0]!.body.status).toBe('success');
  });

  test('失败方式 2：landing git 自拒 → done failed，errorMessage 含拒绝原文', async () => {
    const refusal =
      'git merge --ff-only pacman/conv-conv-1 refused: fatal: Not possible to fast-forward, aborting.';
    const { client } = await setup(claimedStep('merge', { kind: 'local', cloneUrl: USER_REPO }), {
      landError: refusal,
    });
    expect(client.doneBodies[0]!.body.status).toBe('failed');
    expect(client.doneBodies[0]!.body.errorMessage).toContain('Not possible to fast-forward');
  });

  test('失败方式 3：github merge 步 → worktree（https clone）+ push 消费 per-step 凭证；不触发 landing', async () => {
    const { client, calls, pushes } = await setup(
      claimedStep('merge', { kind: 'github', cloneUrl: 'https://github.com/o/r.git' }),
      { git: GITHUB_TOKEN },
    );
    expect(calls).toContain('prepare:https://github.com/o/r.git');
    expect(pushes[0]!.cred).toEqual(GITHUB_TOKEN);
    expect(calls.some((c) => c.startsWith('landLocalFastForward'))).toBe(false);
    expect(client.doneBodies[0]!.body.status).toBe('success');
  });

  test('失败方式 4：local build 步 → push 照常、无 landing（落地仅 merge 步）', async () => {
    const { calls } = await setup(claimedStep('build', { kind: 'local', cloneUrl: USER_REPO }));
    expect(calls).toContain(`prepare:${USER_REPO}`);
    expect(calls).toContain('push:pacman/conv-conv-1');
    expect(calls.some((c) => c.startsWith('landLocalFastForward'))).toBe(false);
    expect(calls).not.toContain('mergeDefaultBranch');
  });

  test('失败方式 5：repo null → 不开 worktree（裸任务目录退化形不变）', async () => {
    const { calls } = await setup(claimedStep('build', null));
    expect(calls.some((c) => c.startsWith('prepare'))).toBe(false);
    expect(calls.some((c) => c.startsWith('push'))).toBe(false);
  });
});
