// M5 汇合面（#83）：conversation stream SSE + 词表补齐 GET/POST 族 +
// [推断] build 详情读面 + SPA 静态同源托管（02/A1）。
// 失败方式清单（先固化，代码是让场景通过的手段）：
// ① 会话流：连接即 ping；工具行/live 文本增量/驳回用户行/步状态各自成事件、
//    逐帧过 shared conversationStreamEventSchema；非本机 step 的 delta = 404；
//    空 delta 不发事件。
// ② 词表面：machines/skills/models/progress/agents tasks/whats-new 形状与
//    404/400 语义（skill 无 SKILL.md = 400；未知 team/skill/file = 404）；
//    埋点两端点 = 204 空实现。
// ③ [推断] 读面：builds/{id}/plans|changes|usage 未知 build = 404；无产物 =
//    空集形状（[]/{files:[]}/[]）。
// ④ 静态托管：/ = index.html；未知 /app 路径 SPA 回退 index.html；资产带
//    content-type；/api 未命中 = 404 JSON（不落 index.html）；../ 逃逸拒绝；
//    webDir 未设 = 保持纯 API 形态（404 JSON）。

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  conversationStreamEventSchema,
  machineRecordSchema,
  skillRecordSchema,
  tokenUsageSchema,
} from '@pacman/shared';
import type { Hono } from 'hono';
import { afterAll, describe, expect, test } from 'vitest';
import {
  agent as agentTable,
  plan as planTable,
  provider as providerTable,
} from '../src/db/schema.js';
import { bootServer, issueApiKey, openConvStream, postProject, req } from './helpers.js';

type TestServer = ReturnType<typeof bootServer>;

async function call(
  app: Hono,
  method: string,
  path: string,
  opts: { cred?: string; body?: unknown; text?: string; contentType?: string } = {},
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (opts.cred) headers.authorization = `Bearer ${opts.cred}`;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.contentType !== undefined) headers['content-type'] = opts.contentType;
  return Promise.resolve(
    app.request(path, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : opts.text,
    }),
  );
}

const AGENT_ID = 'agent-m5-1';

/** 机器已注册 + provider/agent seed + 项目/todo 就位的世界（machine-wire
 * 同款引导的 M5 裁剪面）。 */
async function setupWorld(opts: { webDir?: string | null; pingIntervalMs?: number } = {}) {
  const s = bootServer({
    claimHoldMs: 250,
    pingIntervalMs: opts.pingIntervalMs ?? 3_600_000,
    ...(opts.webDir !== undefined ? { webDir: opts.webDir } : {}),
  });
  const apiKey = await issueApiKey(s);
  s.db
    .insert(providerTable)
    .values({
      id: 'prov-m5',
      teamId: s.team.id,
      kind: 'custom',
      providerId: 'stub-gw',
      label: 'Stub Gateway',
      baseUrl: 'http://127.0.0.1:9/v1',
      api: 'openai-completions',
      authHeader: true,
      compat: { supportsDeveloperRole: false },
      models: [{ id: 'stub-model', name: 'stub-model' }],
      createdBy: s.user.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    .run();
  s.db
    .insert(agentTable)
    .values({
      id: AGENT_ID,
      teamId: s.team.id,
      displayName: 'm5-builder',
      provider: 'stub-gw',
      modelId: 'stub-model',
    })
    .run();
  const enrollRes = await call(s.app, 'POST', '/api/machine/enroll', {
    cred: apiKey,
    body: { teamId: s.team.id, name: 'm5-mbp', cliVersion: '0.1.0' },
  });
  const { token, machineId } = (await enrollRes.json()) as { token: string; machineId: string };
  const projectId = await postProject(s.app);
  const todoRes = await call(s.app, 'POST', `/api/projects/${projectId}/todos`, {
    body: { title: 'M5 探针', spec: '探针 spec' },
  });
  const { id: todoId } = (await todoRes.json()) as { id: string };
  return { s, token, machineId, projectId, todoId };
}

async function startBuild(s: TestServer, projectId: string, todoId: string): Promise<string> {
  const res = await call(s.app, 'POST', `/api/projects/${projectId}/builds`, {
    body: {
      todoIds: [todoId],
      assignment: { plan: { agentId: AGENT_ID }, build: { agentId: AGENT_ID } },
      withPlan: true,
    },
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as { builds: { id: string }[] };
  return body.builds[0]!.id;
}

describe('conversation stream（02 §1.2 会话流，M5 live streaming 服务端半）', () => {
  test('连接即 ping；步事件/工具行/文本增量/驳回行逐帧过 schema', async () => {
    const { s, token, projectId, todoId } = await setupWorld({ pingIntervalMs: 60 });
    const buildId = await startBuild(s, projectId, todoId);
    // buildId ≡ conversationId（CONTEXT.md 实体等式）——流键 = buildId。
    const stream = await openConvStream(s.app, buildId);
    try {
      // ① 首帧 ping（连接即发，r3 §8.1 同族节奏）。
      const ping = await stream.next((ev) => ev.type === 'ping');
      expect(conversationStreamEventSchema.parse(ping)).toBeTruthy();

      // ② 步 pending 事件在开流前已发（startBuild 入队即刻）——订阅晚于事件
      //    属正常时序（web 侧以 REST 重取兜底，02 §1.2 双保险）；此处断言
      //    claim 之后的 claimed 事件与后续增量。
      const claimRes = await call(s.app, 'POST', '/api/machine/tasks/claim', {
        cred: token,
        body: { running: 0 },
      });
      const claimed = (await claimRes.json()) as { step: { step: { id: string } } | null };
      expect(claimed.step).not.toBeNull();
      const stepId = claimed.step!.step.id;
      const stepEv = await stream.next(
        (ev) => ev.type === 'step' && (ev.step as { status: string }).status === 'claimed',
      );
      expect(conversationStreamEventSchema.parse(stepEv)).toBeTruthy();

      // ③ live 工具行回传 → message 事件（toolcall 内容行）。
      const toolCall = {
        id: 'call-m5-1',
        name: 'bash',
        arguments: { command: 'echo probe' },
        result: 'probe',
        startedAt: Date.now(),
        endedAt: Date.now(),
      };
      const toolRes = await call(s.app, 'POST', `/api/machine/tool/${stepId}`, {
        cred: token,
        body: toolCall,
      });
      expect(toolRes.status).toBe(200);
      const msgEv = await stream.next((ev) => ev.type === 'message');
      const parsedMsg = conversationStreamEventSchema.parse(msgEv);
      expect(parsedMsg.type === 'message' && parsedMsg.message.id).toBe('call-m5-1');

      // ④ transcript delta（第三形 [设计]）→ text_delta 事件；空文本不发。
      const deltaRes = await call(s.app, 'POST', `/api/machine/tool/${stepId}`, {
        cred: token,
        body: { kind: 'transcript_delta', text: '正在分析仓库结构…' },
      });
      expect(deltaRes.status).toBe(200);
      const deltaEv = await stream.next((ev) => ev.type === 'text_delta');
      expect(conversationStreamEventSchema.parse(deltaEv)).toBeTruthy();
      expect((deltaEv as { text: string }).text).toBe('正在分析仓库结构…');

      const emptyRes = await call(s.app, 'POST', `/api/machine/tool/${stepId}`, {
        cred: token,
        body: { kind: 'transcript_delta', text: '' },
      });
      expect(emptyRes.status).toBe(200); // 收下但无事件（空增量静默）

      // ⑤ 非本机 step 的 delta = 404（所有权校验与 tool 面同款）。
      const foreign = await call(s.app, 'POST', '/api/machine/tool/no-such-step', {
        cred: token,
        body: { kind: 'transcript_delta', text: 'x' },
      });
      expect(foreign.status).toBe(404);

      // ⑥ 步收尾 → step done 事件（finishStep 状态位透出）。
      const doneRes = await call(s.app, 'POST', `/api/machine/done/${stepId}`, {
        cred: token,
        body: { status: 'success', hasChanges: false },
      });
      expect(doneRes.status).toBe(200);
      const doneEv = await stream.next(
        (ev) => ev.type === 'step' && (ev.step as { status: string }).status === 'done',
      );
      expect(conversationStreamEventSchema.parse(doneEv)).toBeTruthy();
    } finally {
      stream.close();
      s.dispose();
    }
  });

  test('驳回回路：revision 用户反馈行即时进会话流（r5 §4 时间线）', async () => {
    const { s, token, projectId, todoId } = await setupWorld();
    const buildId = await startBuild(s, projectId, todoId);
    // 驱动到 confirm：claim 规划步 → plan.md 交接物回传（#113：无产物规划步
    // 不算成、不进 confirm）→ done success（completeStep → confirm）。
    const claimRes = await call(s.app, 'POST', '/api/machine/tasks/claim', {
      cred: token,
      body: { running: 0 },
    });
    const stepId = ((await claimRes.json()) as { step: { step: { id: string } } }).step!.step.id;
    const planUrlsRes = await call(s.app, 'POST', `/api/machine/upload-urls/${stepId}`, {
      cred: token,
      body: { files: [{ name: 'plan.md' }] },
    });
    const planUpload = ((await planUrlsRes.json()) as { uploads: { url: string }[] }).uploads[0]!;
    await call(s.app, 'PUT', planUpload.url.replace(/^https?:\/\/[^/]+/, ''), {
      cred: token,
      text: '# 方案\nContext: x',
      contentType: 'text/markdown',
    });
    await call(s.app, 'POST', `/api/machine/done/${stepId}`, {
      cred: token,
      body: { status: 'success' },
    });
    const stream = await openConvStream(s.app, buildId);
    try {
      const revRes = await call(s.app, 'POST', `/api/builds/${buildId}/steps`, {
        body: {
          action: 'revision',
          side: 'plan',
          feedback: '标题去掉项目名后缀',
          clientMessageId: '3f9a0c2e-0000-4000-8000-000000000001',
        },
      });
      expect(revRes.status).toBe(202);
      const ev = await stream.next(
        (e) => e.type === 'message' && (e.message as { role: string }).role === 'user',
      );
      const parsed = conversationStreamEventSchema.parse(ev);
      expect(parsed.type === 'message' && parsed.message.content).toBe('标题去掉项目名后缀');
      // 重规划步入队 → step pending 事件（同流）。
      const stepEv = await stream.next(
        (e) => e.type === 'step' && (e.step as { kind: string }).kind === 'plan',
      );
      expect(conversationStreamEventSchema.parse(stepEv)).toBeTruthy();
    } finally {
      stream.close();
      s.dispose();
    }
  });
});

describe('M5 词表补齐面（02 §6.1 canonical）', () => {
  test('GET teams/{id}/machines → machineRecord[]（注册机器在列）', async () => {
    const { s, machineId } = await setupWorld();
    try {
      const res = await req(s.app, 'GET', `/api/teams/${s.team.id}/machines`);
      expect(res.status).toBe(200);
      const rows = (await res.json()) as unknown[];
      expect(rows).toHaveLength(1);
      const record = machineRecordSchema.parse(rows[0]);
      expect(record.id).toBe(machineId);
      expect(record.name).toBe('m5-mbp');
      // 未知 team = 404 {error}
      expect((await req(s.app, 'GET', '/api/teams/nope/machines')).status).toBe(404);
    } finally {
      s.dispose();
    }
  });

  test('技能面：POST 校验 SKILL.md → 201；列表/单读/file 端点闭环', async () => {
    const { s } = await setupWorld();
    try {
      // 无 SKILL.md = 400（r2 §6.1「技能文件夹必须包含 SKILL.md」）。
      const bad = await req(s.app, 'POST', '/api/skills', {
        name: 'deploy',
        files: { 'README.md': '# x' },
      });
      expect(bad.status).toBe(400);
      const created = await req(s.app, 'POST', '/api/skills', {
        name: 'deploy',
        description: '部署流程',
        files: { 'SKILL.md': '# deploy\n步骤…', 'helper.sh': 'echo hi' },
      });
      expect(created.status).toBe(201);
      const record = skillRecordSchema.parse(await created.json());
      expect(record.name).toBe('deploy');

      const list = (await (
        await req(s.app, 'GET', `/api/skills?teamId=${s.team.id}`)
      ).json()) as unknown[];
      expect(list).toHaveLength(1);
      expect(skillRecordSchema.safeParse(list[0]).success).toBe(true);

      const one = await req(s.app, 'GET', `/api/teams/${s.team.id}/skills/${record.id}`);
      expect(one.status).toBe(200);
      const detail = (await one.json()) as { fileNames: string[] };
      expect(detail.fileNames.sort()).toEqual(['SKILL.md', 'helper.sh']);

      const file = await req(
        s.app,
        'GET',
        `/api/teams/${s.team.id}/skills/${record.id}/file?fileName=helper.sh`,
      );
      expect(file.status).toBe(200);
      expect((await file.json()) as { content: string }).toEqual({
        fileName: 'helper.sh',
        content: 'echo hi',
      });
      // 默认文件 = SKILL.md
      const entry = await req(s.app, 'GET', `/api/teams/${s.team.id}/skills/${record.id}/file`);
      expect(((await entry.json()) as { fileName: string }).fileName).toBe('SKILL.md');
      // 未知 file / 未知 skill = 404
      expect(
        (await req(s.app, 'GET', `/api/teams/${s.team.id}/skills/${record.id}/file?fileName=nope`))
          .status,
      ).toBe(404);
      expect((await req(s.app, 'GET', `/api/teams/${s.team.id}/skills/nope`)).status).toBe(404);
    } finally {
      s.dispose();
    }
  });

  test('models/progress/agents tasks/whats-new/埋点面', async () => {
    const { s, projectId, todoId } = await setupWorld();
    try {
      // models = provider.models 聚合投影（providerId/providerLabel 伴随）。
      const models = (await (await req(s.app, 'GET', `/api/teams/${s.team.id}/models`)).json()) as {
        id: string;
        providerId: string;
        providerLabel: string;
      }[];
      expect(models).toEqual([
        {
          id: 'stub-model',
          name: 'stub-model',
          providerId: 'stub-gw',
          providerLabel: 'Stub Gateway',
        },
      ]);

      // progress = todo 计数按 phase 投影。
      const progress = (await (
        await req(s.app, 'GET', `/api/teams/${s.team.id}/progress`)
      ).json()) as { todos: { total: number; byPhase: Record<string, number> } };
      expect(progress.todos.total).toBe(1);
      expect(progress.todos.byPhase.todo).toBe(1);

      // agents/{aid}/tasks = assignment 双槽指向该 Agent 的 todo 集。
      await call(s.app, 'POST', `/api/projects/${projectId}/builds`, {
        body: {
          todoIds: [todoId],
          assignment: { plan: { agentId: AGENT_ID }, build: { agentId: AGENT_ID } },
          withPlan: false,
        },
      });
      const tasks = (await (
        await req(s.app, 'GET', `/api/teams/${s.team.id}/agents/${AGENT_ID}/tasks`)
      ).json()) as { id: string }[];
      expect(tasks.map((t) => t.id)).toEqual([todoId]);
      const noTasks = (await (
        await req(s.app, 'GET', `/api/teams/${s.team.id}/agents/other/tasks`)
      ).json()) as unknown[];
      expect(noTasks).toEqual([]);

      // whats-new = 数组（内容自选，空表 → []）。
      expect(await (await req(s.app, 'GET', '/api/whats-new')).json()).toEqual([]);

      // 埋点两端点 = 204 空实现（词表「可空实现」口径）。
      expect((await req(s.app, 'POST', '/api/analytics/first-touch', {})).status).toBe(204);
      expect((await req(s.app, 'POST', '/_mp/api/track', {})).status).toBe(204);
    } finally {
      s.dispose();
    }
  });
});

describe('[推断] build 详情读面（M5 overlay 数据源，wire.test 登记）', () => {
  test('plans/changes/usage：未知 build 404；空产物 = 空集形状', async () => {
    const { s, projectId, todoId } = await setupWorld();
    try {
      for (const path of [
        '/api/builds/nope/plans',
        '/api/builds/nope/changes',
        '/api/builds/nope/usage',
      ]) {
        expect((await req(s.app, 'GET', path)).status).toBe(404);
      }
      const buildId = await startBuild(s, projectId, todoId);
      expect(await (await req(s.app, 'GET', `/api/builds/${buildId}/plans`)).json()).toEqual([]);
      expect(await (await req(s.app, 'GET', `/api/builds/${buildId}/usage`)).json()).toEqual([]);
      // 项目无 repoKind（postProject 默认）→ changes 空集。
      expect(await (await req(s.app, 'GET', `/api/builds/${buildId}/changes`)).json()).toEqual({
        files: [],
      });
    } finally {
      s.dispose();
    }
  });

  test('plans 落库后 = 版本集 + 内容；usage = tokenUsageSchema 行', async () => {
    const { s, token, projectId, todoId } = await setupWorld();
    try {
      const buildId = await startBuild(s, projectId, todoId);
      const claimRes = await call(s.app, 'POST', '/api/machine/tasks/claim', {
        cred: token,
        body: { running: 0 },
      });
      const stepId = ((await claimRes.json()) as { step: { step: { id: string } } }).step!.step.id;
      // done 带 usage → 记账行 → usage 端点读出。
      await call(s.app, 'POST', `/api/machine/done/${stepId}`, {
        cred: token,
        body: {
          status: 'success',
          usage: [
            { model: 'stub-gw/stub-model', input: 12, output: 980, cacheRead: 100, cacheWrite: 0 },
          ],
        },
      });
      const usage = (await (
        await req(s.app, 'GET', `/api/builds/${buildId}/usage`)
      ).json()) as unknown[];
      expect(usage).toHaveLength(1);
      expect(tokenUsageSchema.safeParse(usage[0]).success).toBe(true);
      // plan 行直插（documents 面同款内容列）→ plans 端点透出 content。
      s.db
        .insert(planTable)
        .values({
          id: 'plan-m5-1',
          buildId,
          version: 1,
          content: '# 方案\nContext: x',
          createdAt: Date.now(),
        })
        .run();
      const plans = (await (await req(s.app, 'GET', `/api/builds/${buildId}/plans`)).json()) as {
        id: string;
        version: number;
        content: string;
      }[];
      expect(plans).toHaveLength(1);
      expect(plans[0]!.content).toContain('Context:');
    } finally {
      s.dispose();
    }
  });
});

describe('SPA 静态同源托管（02/A1）', () => {
  const webDir = mkdtempSync(join(tmpdir(), 'pacman-web-dir-'));
  afterAll(() => rmSync(webDir, { recursive: true, force: true }));
  mkdirSync(join(webDir, 'assets'), { recursive: true });
  writeFileSync(join(webDir, 'index.html'), '<!doctype html><title>spa</title>');
  writeFileSync(join(webDir, 'assets', 'app.js'), 'console.log(1)');
  writeFileSync(join(webDir, 'manifest.webmanifest'), '{"name":"x"}');

  test('根/深层路由 = index.html；资产带 content-type；API 未命中仍 404 JSON', async () => {
    const { s } = await setupWorld({ webDir });
    try {
      const root = await req(s.app, 'GET', '/');
      expect(root.status).toBe(200);
      expect(root.headers.get('content-type')).toContain('text/html');
      expect(await root.text()).toContain('<title>spa</title>');

      // SPA 回退：未知 /app 树路径 → index.html（客户端路由持有）。
      const deep = await req(s.app, 'GET', '/app/todo/whatever');
      expect(deep.status).toBe(200);
      expect(await deep.text()).toContain('<title>spa</title>');

      const asset = await req(s.app, 'GET', '/assets/app.js');
      expect(asset.status).toBe(200);
      expect(asset.headers.get('content-type')).toContain('text/javascript');

      const manifest = await req(s.app, 'GET', '/manifest.webmanifest');
      expect(manifest.headers.get('content-type')).toContain('application/manifest+json');

      // API 未命中 = 404 JSON（不落 index.html——错误形状对拍面，04 §3）。
      const apiMiss = await req(s.app, 'GET', '/api/no-such-route');
      expect(apiMiss.status).toBe(404);
      expect(await apiMiss.json()).toEqual({ error: 'Not found' });

      // 路径逃逸拒绝（百分号编码 ../ 解码后越根 = 404，绝不吐根外文件；
      // 字面 /../ 由 URL 解析器先行归一化，走 SPA 回退不触逃逸面）。
      const traversal = await req(s.app, 'GET', '/%2e%2e%2f%2e%2e%2fpackage.json');
      expect(traversal.status).toBe(404);
    } finally {
      s.dispose();
    }
  });

  test('webDir 未设 = 纯 API 形态（GET / 404 JSON）', async () => {
    const { s } = await setupWorld();
    try {
      const root = await req(s.app, 'GET', '/');
      expect(root.status).toBe(404);
      expect(await root.json()).toEqual({ error: 'Not found' });
    } finally {
      s.dispose();
    }
  });
});
