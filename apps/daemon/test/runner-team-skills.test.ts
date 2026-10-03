// 团队技能物化的 runner 接线（XMON-112 S2，spec 14 增补）：步启动拉
// GET /api/machine/skills/{stepId} → 物化缓存目录 → SessionOpts.teamSkillsDir
// 透传 backend。失败方式清单先于实现固化（票面纪律）：
//   R1 拉取成功 → sessionOpts.teamSkillsDir = 缓存目录（SKILL.md 内容可读）
//      + `[skills] team: N skill(s) materialized` 行 + done success
//   R2 拉取抛错（server 不可达 / 4xx / 5xx 同形）→ 无 teamSkillsDir、
//      `[skills] team-fetch-failed: … continuing with local skills only` 行、
//      会话照常创建、done success（spec 14 MCP 降级同律，会话不阻断）
//   R3 空包 {skills:[]}（白名单空）→ 无 teamSkillsDir，零物化目录创建
//   R4 非法包（dirName 逃逸）→ 无 teamSkillsDir + `team-invalid` 行、步照常
//   R5 老 server 无端点（404）→ 与 R2 同形降级（版本墙 fail-open）

import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  AgentBackend,
  AgentSessionHandle,
  ClaimedStep,
  MachineDoneBody,
  MachineSkillsResponse,
  MachineStreamEvent,
  SessionOpts,
  ToolCallRecord,
  TranscriptUpload,
} from '@pacman/shared';
import { describe, expect, test } from 'vitest';
import { PI_CAPABILITIES } from '../src/backend/pi.js';
import { StepJournal } from '../src/journal.js';
import type { DaemonLogger } from '../src/log.js';
import { type MachineApi, MachineApiError } from '../src/machine-client.js';
import { runStep } from '../src/runner.js';
import { statePaths } from '../src/state.js';

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

const DEMO_PKG: MachineSkillsResponse = {
  skills: [
    {
      id: 'deploy-demo',
      name: 'deploy-demo',
      description: '演示部署技能。',
      dirName: 'deploy-demo',
      files: [
        {
          path: 'SKILL.md',
          content: '---\nname: deploy-demo\ndescription: 演示部署技能。\n---\n\n部署正文。\n',
        },
      ],
    },
  ],
};

function claimedBuildStep(): ClaimedStep {
  return {
    step: { id: 's1', buildId: 'conv-1', kind: 'build', machineId: 'm1', createdAt: 1 },
    conversationId: 'conv-1',
    session: { action: 'new', sessionId: null },
    todo: { id: 't1', seqNum: 1, title: '技能探针', spec: '跑一步' },
    project: { id: 'p1', name: 'demo', repo: null },
    agent: {
      id: 'a1',
      displayName: 'stub-builder',
      description: null,
      provider: null,
      modelId: 'stub-model',
      thinkingLevel: null,
      tools: [],
      skills: ['deploy-demo'],
    },
  };
}

class FakeClient implements MachineApi {
  doneBodies: { stepId: string; body: MachineDoneBody }[] = [];
  skillsCalls: string[] = [];

  constructor(
    private readonly skillsOutcome:
      | { kind: 'pkg'; pkg: MachineSkillsResponse }
      | { kind: 'error'; error: Error },
  ) {}

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
      secrets: {},
      git: null,
    };
  }
  async skills(stepId: string) {
    this.skillsCalls.push(stepId);
    if (this.skillsOutcome.kind === 'error') throw this.skillsOutcome.error;
    return this.skillsOutcome.pkg;
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
  }
  async steer() {
    return null;
  }
  async attachment(): Promise<never> {
    throw new Error('unused');
  }
  async stop() {
    return null;
  }
  async syncResult(_syncId: string, _body: { status: string; errorMessage?: string }) {}
  async shellPrecheck(): Promise<never> {
    throw new Error('unused');
  }
  async shellResult(): Promise<void> {}
  async stream(_signal: AbortSignal, _onEvent: (ev: MachineStreamEvent) => void) {}
}

/** 录制型 backend：记录每次 createSession 的 SessionOpts；自然完成。 */
function recordingBackend(): { backend: AgentBackend; sessions: SessionOpts[] } {
  const sessions: SessionOpts[] = [];
  const backend: AgentBackend = {
    capabilities: PI_CAPABILITIES,
    async createSession(opts: SessionOpts): Promise<AgentSessionHandle> {
      sessions.push(opts);
      return {
        sessionId: 'pi-sess-team',
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
  return { backend, sessions };
}

async function setup(
  skillsOutcome: { kind: 'pkg'; pkg: MachineSkillsResponse } | { kind: 'error'; error: Error },
) {
  const home = mkdtempSync(join(tmpdir(), 'pacman-runner-team-'));
  const paths = statePaths(home, join(home, 'workspaces'));
  const { logger, lines } = captureLogger();
  const client = new FakeClient(skillsOutcome);
  const journal = new StepJournal(paths.outboxDir);
  const { backend, sessions } = recordingBackend();
  await runStep(
    {
      client,
      journal,
      backendFor: () => backend,
      logger,
      paths,
      workspacesDir: join(home, 'workspaces'),
      mcpConfigPath: join(home, 'claude.json'),
      heartbeatIntervalMs: 60_000,
    },
    claimedBuildStep(),
  );
  return { client, lines, sessions, paths };
}

describe('runner 团队技能接线（XMON-112 S2）', () => {
  test('R1 拉取成功 → teamSkillsDir 透传会话 + 内容落盘可读 + materialized 行 + done success', async () => {
    const { client, lines, sessions, paths } = await setup({ kind: 'pkg', pkg: DEMO_PKG });
    expect(client.skillsCalls).toEqual(['s1']);
    const opts = sessions[0]!;
    expect(opts.teamSkillsDir).toBeDefined();
    expect(opts.teamSkillsDir!.startsWith(paths.teamSkillsCacheDir)).toBe(true);
    expect(readFileSync(join(opts.teamSkillsDir!, 'deploy-demo', 'SKILL.md'), 'utf8')).toContain(
      '部署正文。',
    );
    expect(lines.some((l) => l.startsWith('[skills] team: 1 skill(s) materialized'))).toBe(true);
    expect(client.doneBodies[0]!.body.status).toBe('success');
  });

  test('R2 拉取抛错 → 无 teamSkillsDir + team-fetch-failed 行 + 会话照常 + done success', async () => {
    const { lines, sessions, client } = await setup({
      kind: 'error',
      error: new MachineApiError(500, 'boom'),
    });
    expect(sessions[0]!.teamSkillsDir).toBeUndefined();
    const failed = lines.find((l) => l.startsWith('[skills] team-fetch-failed:'));
    expect(failed).toBeDefined();
    expect(failed).toContain('continuing with local skills only');
    expect(sessions.length).toBe(1);
    expect(client.doneBodies[0]!.body.status).toBe('success');
  });

  test('R3 空包（白名单空）→ 无 teamSkillsDir、缓存根零创建', async () => {
    const { lines, sessions, paths } = await setup({ kind: 'pkg', pkg: { skills: [] } });
    expect(sessions[0]!.teamSkillsDir).toBeUndefined();
    expect(existsSync(paths.teamSkillsCacheDir)).toBe(false);
    expect(lines.some((l) => l.startsWith('[skills] team:'))).toBe(false);
  });

  test('R4 非法包（dirName 逃逸）→ 无 teamSkillsDir + team-invalid 行 + 步照常', async () => {
    const evil: MachineSkillsResponse = {
      skills: [{ ...DEMO_PKG.skills[0]!, dirName: '../evil' }],
    };
    const { lines, sessions, client } = await setup({ kind: 'pkg', pkg: evil });
    expect(sessions[0]!.teamSkillsDir).toBeUndefined();
    expect(lines.some((l) => l.startsWith('[skills] team-invalid:'))).toBe(true);
    expect(client.doneBodies[0]!.body.status).toBe('success');
  });

  test('R5 老 server 404（无端点）→ 与 R2 同形降级', async () => {
    const { lines, sessions, client } = await setup({
      kind: 'error',
      error: new MachineApiError(404, 'not found'),
    });
    expect(sessions[0]!.teamSkillsDir).toBeUndefined();
    expect(lines.some((l) => l.startsWith('[skills] team-fetch-failed:'))).toBe(true);
    expect(client.doneBodies[0]!.body.status).toBe('success');
  });

  test('R2 补充：物化成功的缓存目录只含 hash 条目（无 .tmp 残留）', async () => {
    const { sessions, paths } = await setup({ kind: 'pkg', pkg: DEMO_PKG });
    expect(readdirSync(paths.teamSkillsCacheDir).filter((e) => e.includes('.tmp-'))).toEqual([]);
    expect(sessions[0]!.teamSkillsDir).toBeDefined();
  });
});
