// 审核步执行面（#511）：审核者拿到的材料与工作区随关口分叉，且审核绝不产
// 可合并改动。harness 同 runner-local.test.ts（FakeClient + 录制型 fake
// WorktreeOps + 捕获 SessionOpts 的 backend）。
// 失败方式枚举先于实现固化（AGENTS.md 测试规则 3）：
//   1. 审核关口 + repo 绑定：开只读检出（prepare 在），审核者读得到本轮产物。
//   2. 审核关口：审核者写入被丢弃——收尾 rewind 到步起点，且不 commitAll /
//      不 push / 不 merge；done 不带 commit、hasChanges=false（审核步不产
//      可合并改动，票面「既有性质不因本票破坏」）。
//   3. 确认关口（gate=confirm）：不开检出（事实还不存在，只审方案）——cwd
//      回落裸任务目录，但材料照常交付。
//   4. 材料投递：#330 引入的空 continue prompt（CONTINUE_PROMPTS.review = ''）
//      必须不再吃掉审核材料——createSession 收到的 prompt = instruction。
//   5. 只读是硬的：审核会话的 edit/write 工具不在工具面（bash 保留 = 跑验证
//      命令），且 readOnly 只对审核步开。

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
  SessionOpts,
  ToolCallRecord,
  TranscriptUpload,
  WorktreeOps,
} from '@pacman/shared';
import { buildReviewStepPrompt, type DocumentDiffFile } from '@pacman/shared';
import { describe, expect, test } from 'vitest';
import { builtinToolNames, PI_CAPABILITIES } from '../src/backend/pi.js';
import { StepJournal } from '../src/journal.js';
import type { DaemonLogger } from '../src/log.js';
import type { MachineApi } from '../src/machine-client.js';
import { runStep } from '../src/runner.js';
import { statePaths } from '../src/state.js';

const HOSTED_REPO = { kind: 'hosted' as const, cloneUrl: 'http://localhost:9/git/t/r.git' };
const PLAN_TEXT = '# plan v1\n\n## Changes\n- 加 parseInput\n';
const CHANGES: DocumentDiffFile[] = [
  {
    path: 'src/parse.ts',
    additions: 1,
    deletions: 0,
    hunks: [{ header: '@@ -0,0 +1,1 @@', lines: ['+export function parseInput() {}'] }],
  },
];

function captureLogger(): DaemonLogger {
  const noop = () => {};
  return {
    raw: noop,
    prefixed: noop,
    supervisor: noop,
    machine: noop,
    step: noop,
    workspace: noop,
    recover: noop,
    wake: noop,
    skills: noop,
    mcp: noop,
  };
}

function claimedReview(
  gate: 'confirm' | 'review',
  repo: NonNullable<ClaimedStep['project']>['repo'],
): ClaimedStep {
  return {
    step: { id: 's-review', buildId: 'conv-1', kind: 'review', machineId: 'm1', createdAt: 1 },
    conversationId: 'conv-1',
    session: { action: 'new', sessionId: null },
    instruction: buildReviewStepPrompt({
      agentId: 'a1',
      gate,
      planText: PLAN_TEXT,
      ...(gate === 'review' ? { changes: CHANGES } : {}),
    }),
    todo: { id: 't1', seqNum: 1, title: '审核探针', spec: '实现一段示例代码' },
    project: { id: 'p1', name: 'demo', repo },
    agent: {
      id: 'a1',
      displayName: 'stub-reviewer',
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
      git: null as GitCredentials | null,
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

/** 录制型 fake worktree：全操作进 calls（rewind 序靠 calls 判读）。 */
function fakeWorkspace(calls: string[]): WorktreeOps {
  return {
    async prepare(input) {
      calls.push(`prepare:${input.cloneUrl}`);
      return {
        cwd: join(input.workspacesRoot, input.conversationId),
        baseRepoDir: join(input.workspacesRoot, input.projectId, 'repo'),
        branch: `pacman/conv-${input.conversationId}`,
        defaultBranch: 'main',
        reused: true,
      };
    },
    async commitAll() {
      calls.push('commitAll');
      return { committed: true, head: 'abc123' };
    },
    async push(_cwd, branch) {
      calls.push(`push:${branch}`);
    },
    async mergeDefaultBranch() {
      calls.push('mergeDefaultBranch');
      return { output: 'Already up to date' };
    },
    async landLocalFastForward() {
      calls.push('landLocalFastForward');
    },
    async headCommit() {
      calls.push('headCommit');
      return 'abc123';
    },
    async countAhead() {
      return 1;
    },
    async restoreCheckpoint(_cwd, commit) {
      calls.push(`restoreCheckpoint:${commit}`);
    },
    async cleanupOrphans() {
      return [];
    },
  };
}

/** 捕获 SessionOpts 的自然完成 backend。 */
function capturingBackend(captured: SessionOpts[]): AgentBackend {
  const session = (): AgentSessionHandle => ({
    sessionId: 'pi-sess-review',
    events: (async function* () {
      yield { type: 'text_delta', text: 'ok' } as never;
      yield { type: 'done', usage: [] } as never;
    })(),
    async steer() {},
    async stop() {},
    usage: () => [],
  });
  return {
    capabilities: PI_CAPABILITIES,
    async createSession(opts: SessionOpts) {
      captured.push(opts);
      return session();
    },
    async continueSession() {
      throw new Error('审核步不接续主 conv 会话');
    },
  };
}

async function setup(claimed: ClaimedStep) {
  const home = mkdtempSync(join(tmpdir(), 'pacman-runner-review-'));
  const paths = statePaths(home, join(home, 'workspaces'));
  const calls: string[] = []; // 单一调用序：client 与 workspace 共写一份（rewind 先于 done 的时序靠它判读）
  const client = new FakeClient();
  client.calls = calls;
  const captured: SessionOpts[] = [];
  const deps = {
    client,
    journal: new StepJournal(paths.outboxDir),
    backend: capturingBackend(captured),
    logger: captureLogger(),
    paths,
    workspace: fakeWorkspace(calls),
    workspacesDir: join(home, 'workspaces'),
    mcpConfigPath: join(home, 'claude.json'),
    heartbeatIntervalMs: 60_000,
  };
  await runStep(deps, claimed);
  return { client, calls, captured };
}

describe('审核步执行面（#511）', () => {
  test('失败方式 1+2：审核关口开只读检出，审核者写入被丢弃、不 commit / 不 push', async () => {
    const { client, calls } = await setup(claimedReview('review', HOSTED_REPO));
    expect(calls).toContain(`prepare:${HOSTED_REPO.cloneUrl}`);
    // 写入丢弃：rewind 到步起点（headAtStart），且在 done 之前
    expect(calls).toContain('restoreCheckpoint:abc123');
    expect(calls.indexOf('restoreCheckpoint:abc123')).toBeLessThan(
      calls.indexOf('done:s-review:success'),
    );
    // 不产可合并改动：无 commit / 无 push / 无 merge
    expect(calls).not.toContain('commitAll');
    expect(calls.some((c) => c.startsWith('push:'))).toBe(false);
    expect(calls).not.toContain('mergeDefaultBranch');
    const body = client.doneBodies[0]!.body;
    expect(body.status).toBe('success');
    expect(body.hasChanges).toBe(false);
    expect(body.commit).toBeUndefined();
  });

  test('失败方式 3：确认关口不开检出（cwd 回落裸任务目录），材料照常交付', async () => {
    const { calls, captured } = await setup(claimedReview('confirm', HOSTED_REPO));
    expect(calls.some((c) => c.startsWith('prepare'))).toBe(false);
    expect(calls.some((c) => c.startsWith('push:'))).toBe(false);
    // 无检出 = 不取步起点 head（git 收尾面整段不参与）
    expect(calls).not.toContain('headCommit');
    // 确认关口材料仍含方案（只是不含变更段）
    expect(captured[0]!.prompt).toContain(PLAN_TEXT);
    expect(captured[0]!.prompt).not.toContain('src/parse.ts');
  });

  test('失败方式 4：审核材料真的投递（prompt = instruction，不吃 CONTINUE_PROMPTS 空串）', async () => {
    const { captured } = await setup(claimedReview('review', HOSTED_REPO));
    const prompt = captured[0]!.prompt ?? '';
    expect(prompt).not.toBe('');
    expect(prompt).toContain(PLAN_TEXT);
    expect(prompt).toContain('src/parse.ts');
    expect(prompt).toContain('+export function parseInput() {}');
  });

  test('失败方式 5：审核会话只读——readOnly 置位，edit/write 不在工具面、bash 保留', async () => {
    const { captured } = await setup(claimedReview('review', HOSTED_REPO));
    expect(captured[0]!.readOnly).toBe(true);
    expect(builtinToolNames(true)).toEqual(['read', 'bash']);
    expect(builtinToolNames(false)).toEqual(['read', 'bash', 'edit', 'write']);
  });

  test('审核关口 + 未绑 repo：不开检出（裸目录退化形），材料仍含变更', async () => {
    const { calls, captured } = await setup(claimedReview('review', null));
    expect(calls.some((c) => c.startsWith('prepare'))).toBe(false);
    expect(captured[0]!.prompt).toContain('src/parse.ts');
  });
});
