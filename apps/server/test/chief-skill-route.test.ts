// #823 发送后 skill 路由的 claim 面契约：claim 时（worker 开工前路由位）
// 服务端按用户消息检测技能，提示节只进 chief.systemPrompt ——
// - 用户触发轮才检测（wake/系统轮无节）；
// - step.prompt（instruction，用户原文）逐字不动；
// - 普通对话零节（第一失败方式：不劫持）；
// - skills 资源清单带 description（agent 自检切合度用）。
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { claimedStepSchema } from '@pacman/shared';
import { beforeEach, describe, expect, test } from 'vitest';
import { agent as agentTable, chief as chiefTable, chiefThread } from '../src/db/schema.js';
import { nowMs } from '../src/lib/ids.js';
import { enqueueChiefStep } from '../src/services/chief.js';
import { bootServer, issueApiKey, req, type TestServer } from './helpers.js';

const AGENT_ID = 'agent-route-1';

let s: TestServer;
let teamId: string;
let userId: string;
let chiefId: string;

function seedSkill(dirName: string, name: string, description: string): void {
  mkdirSync(join(s.skillsDir, dirName), { recursive: true });
  writeFileSync(
    join(s.skillsDir, dirName, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\n---\n\n步骤…\n`,
  );
}

function seedAgentAndChief(): void {
  const now = nowMs();
  s.db
    .insert(agentTable)
    .values({
      id: AGENT_ID,
      teamId,
      displayName: AGENT_ID,
      description: '负责调度',
      status: 'active',
      avatarUrl: null,
      provider: 'stub-gw',
      modelId: 'stub-model',
      thinkingLevel: null,
      tools: [],
      secrets: [],
      skills: [],
      mcpServers: [],
    })
    .run();
  s.db
    .insert(chiefTable)
    .values({
      id: chiefId,
      userId,
      teamId,
      agentId: AGENT_ID,
      charter: '',
      watches: [],
      wakes: [],
      createdAt: now,
    })
    .run();
}

async function claimToken(): Promise<string> {
  const plain = await issueApiKey(s);
  const enroll = await s.app.request('/api/machine/enroll', {
    method: 'POST',
    headers: { authorization: `Bearer ${plain}`, 'content-type': 'application/json' },
    body: JSON.stringify({ teamId, name: 'route-probe', cliVersion: '0.1.0' }),
  });
  expect(enroll.status).toBe(200);
  return ((await enroll.json()) as { token: string }).token;
}

async function claim(token: string) {
  const res = await s.app.request('/api/machine/tasks/claim', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { step: unknown };
  if (body.step === null) throw new Error('claim 空手：chief 步未入队或被抢');
  return claimedStepSchema.parse(body.step);
}

beforeEach(() => {
  s = bootServer();
  teamId = s.team.id;
  userId = s.user.id;
  chiefId = `chief-${userId}-${teamId}`;
  seedAgentAndChief();
  seedSkill('morning-reminder', 'morning-reminder', '定时提醒与日程通知');
});

describe('claim 面 skill 路由（#823）', () => {
  test('提醒消息 → systemPrompt 尾带路由节（点名技能 + 内置回落），instruction 与原文逐字一致', async () => {
    const content = '明早 9 点提醒我开站会';
    const sent = await req(s.app, 'POST', `/api/teams/${teamId}/chief/threads`, { content });
    expect(sent.status).toBe(201);
    const claimed = await claim(await claimToken());
    expect(claimed.step.kind).toBe('chief');
    const prompt = claimed.chief?.systemPrompt ?? '';
    expect(prompt).toContain('发送后自动检测');
    expect(prompt).toContain('morning-reminder');
    expect(prompt).toContain('定时提醒与日程通知');
    expect(prompt).toContain('set_wake');
    // 用户原文不动：instruction 与发送 content 逐字一致。
    expect((claimed as { instruction?: string }).instruction).toBe(content);
  });

  test('普通对话 → 无路由节（第一失败方式：不劫持）', async () => {
    const sent = await req(s.app, 'POST', `/api/teams/${teamId}/chief/threads`, {
      content: '明天的会议纪要帮我整理一下',
    });
    expect(sent.status).toBe(201);
    const claimed = await claim(await claimToken());
    expect(claimed.chief?.systemPrompt).not.toContain('发送后自动检测');
  });

  test('wake 轮 → 无路由节（系统触发不检测）', async () => {
    const now = nowMs();
    const threadId = `chief-${userId}-${teamId}-wake`;
    s.db
      .insert(chiefThread)
      .values({
        id: threadId,
        chiefId,
        userId,
        teamId,
        title: 'wake 探针线程',
        createdAt: now,
        updatedAt: now,
        sessionRuntime: 'pi',
        sessionId: '',
        sessionOpenedAt: now,
        toolDefHashes: {},
        toolResultHashes: {},
      })
      .run();
    enqueueChiefStep({ db: s.db, hub: s.hub, machineHub: s.machineHub, user: s.user }, threadId, {
      prompt: '任务 #1 已合并完成（done）。请向用户汇报。',
      trigger: 'settle',
    });
    const claimed = await claim(await claimToken());
    expect(claimed.chief?.systemPrompt).not.toContain('发送后自动检测');
    expect(claimed.chief?.trigger).toBe('settle');
  });

  test('skills 资源清单带 description + 路由约定行（agent 自检可用）', async () => {
    const sent = await req(s.app, 'POST', `/api/teams/${teamId}/chief/threads`, {
      content: '随便聊聊今天的安排',
    });
    expect(sent.status).toBe(201);
    const claimed = await claim(await claimToken());
    const prompt = claimed.chief?.systemPrompt ?? '';
    expect(prompt).toContain('morning-reminder');
    expect(prompt).toContain('定时提醒与日程通知');
    expect(prompt).toContain('技能路由提示节在位时');
  });
});
