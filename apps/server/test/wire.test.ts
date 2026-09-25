// M2 面核心端点 wire 对拍（04 §3：路径/动词/形状/错误形状 vs 02 §6.1）。
// 真值单源 = shared WEB_REST_ENDPOINTS / DELETE_FACE + record zod schema；
// [推断] 面（响应封套未采/同名 DELETE·PATCH）按 04 §3 不判负口径显式登记。

import {
  buildRecordSchema,
  buildStepActionBodySchema,
  conversationMessagesResponseSchema,
  createTodoBodySchema,
  mergeAcceptedResponseSchema,
  notificationsResponseSchema,
  projectRecordSchema,
  startBuildsBodySchema,
  stepRecordSchema,
  teamMemberSchema,
  teamRecordSchema,
  todoRecordSchema,
  userRecordSchema,
  WEB_REST_ENDPOINTS,
} from '@pacman/shared';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { agent as agentTable, plan as planTable } from '../src/db/schema.js';
import { newRecordId } from '../src/lib/ids.js';
import { completeStep } from '../src/services/builds.js';
import { setTodoPhase } from '../src/services/todos.js';
import { bootServer, postProject, req } from './helpers.js';

/** 已登记 [推断] 路由（词表外扩面，出处注记；补采真值后回写 02 §11）。 */
const INFERRED_ROUTES = [
  'POST /api/projects', // 项目创建流（02 §3/r2 §9 UI 证据，wire 未采）
  'PATCH /api/todos/{id}', // update_todo 面（r5 §3.1 词表证据；02 §6.1 PATCH 未抓）
  'DELETE /api/todos/{id}', // DELETE_FACE 'todos' 同名 DELETE（02 §6.1 [推断] 规则）
  'DELETE /api/projects/{id}', // 项目设置危险操作区删除流（r2 24c UI 证据；#189 复活前置，wire 未采）
  'DELETE /api/schedules/{id}', // DELETE_FACE 'schedules'（unschedule_todo r5 §3.1；once 出队 r3 §9）
  // —— 密钥三面（页/弹窗实测存在 r2 §6.3/§6.5/§6.7、r3 §2/§6，wire 未采；
  // 路径 = REST 同名 [推断]，02 §6.1 规则族）——
  'DELETE /api/teams/{id}/providers/{pid}', // DELETE_FACE 'teams/{id}/providers'（「可以替换或删除」r2 §6.5）
  'GET /api/teams/{id}/secrets', // 密钥页实测存在（r2 §6.3）
  'POST /api/teams/{id}/secrets', // body = shared setSecretBodySchema（r2 §6.3 表单三字段）
  'PATCH /api/teams/{id}/secrets/{sid}', // 覆盖面（「保存后只能覆盖或删除」r2 §6.3）
  'DELETE /api/teams/{id}/secrets/{sid}', // DELETE_FACE 'teams/{id}/secrets'
  'GET /api/teams/{id}/api-keys', // API 密钥页实测存在（r2 §6.7/r3 §6）
  'POST /api/teams/{id}/api-keys', // 创建 → 一次性明文（r3 §6 展示规则）
  // —— Chief 发消息触发回合（M4a）：GET /chief/threads 与 GET /conversations/{id}/
  // messages 在词表内，但「发消息」的 POST wire 未采（r5 §3.6 仅读端点）——REST
  // 同名 POST [推断]，02 §6.1 规则族（不发明新命名空间）——
  'POST /api/teams/{id}/chief/threads', // 新主题：建线程 + 首条消息 + 入队回合步
  'POST /api/conversations/{id}/messages', // 既有 chief 线程续消息（id=chief-<threadId>）
  // —— MCP client 面管理侧（M4b）：GET/POST 在词表内；编辑/删除 = 卡片更多
  // 菜单面（r3 §5.1），DELETE_FACE 'teams/{id}/mcp-servers' + REST 同名 PATCH
  // [推断]（02 §6.1 规则族）——
  'PATCH /api/teams/{id}/mcp-servers/{sid}',
  'DELETE /api/teams/{id}/mcp-servers/{sid}',
  // 记忆条目卡删除图标（r5 §6 UI 实测；02 §4.4「列表/删除 API 保形」，
  // DELETE_FACE 'teams/{id}/agents/{aid}/memories'）
  'DELETE /api/teams/{id}/agents/{aid}/memories/{mid}',
  // —— build 详情读面（M5：详情页 overlay 数据源；wire 未采，路径 =
  // builds/{id}/… REST 同族规则（steps 端点先例），02 §6.1 规则族）——
  'GET /api/projects/{id}/commits', // 文件|历史 分段「历史」读面（#149；r2 07e/24 分段 UI 证据，wire 未采，projects/{id}/… REST 同族规则）
  'GET /api/builds/{id}/plans', // 版本集 + plan.md 内容（版本下拉/文档 pane，r5 §4 触点）
  'GET /api/builds/{id}/changes', // conv 分支 vs 默认分支 diff（变更 pane，r7 27 触点）
  'GET /api/builds/{id}/changes/file', // conv 分支头单文件全文按需取（#224，docpane「显示完整文件」数据源）
  'GET /api/builds/{id}/usage', // build × model 四维记账（Token 用量 dialog，r3 §3.8/r7 30 触点）
];

/** M2 已实现核心面（M2a：todo/build CRUD + team stream + seed 保形；
 * M2b：repo 文件浏览面 02 §3 + 定时面 02 §9.2）。 */
const CORE_ROUTES = [
  'GET /api/auth/session',
  'GET /api/user/me',
  'GET /api/teams',
  'GET /api/teams/{id}/members',
  'GET /api/teams/{id}/notifications',
  'GET /api/teams/{id}/stream',
  'GET /api/projects',
  'GET /api/projects/{id}/todos',
  'GET /api/projects/{id}/builds',
  'GET /api/projects/{id}/tags',
  'GET /api/projects/{id}/branches',
  'GET /api/projects/{id}/tree',
  'GET /api/projects/{id}/file',
  'GET /api/todos',
  'GET /api/todos/{id}',
  'GET /api/builds/{id}',
  'GET /api/builds/{id}/steps',
  'GET /api/conversations/{id}/messages',
  'GET /api/schedules',
  'POST /api/projects/{id}/todos',
  'POST /api/projects/{id}/builds',
  'POST /api/builds/{id}/merge',
  'POST /api/builds/{id}/steps',
  'POST /api/schedules',
];

/** M2c 核心面（密钥三面 + 搜索，#78；通知走既有 team stream 通道无新路由）。 */
const M2C_ROUTES = [
  'GET /api/search',
  'GET /api/teams/{id}/providers',
  'POST /api/teams/{id}/providers',
  'PATCH /api/teams/{id}/providers/{pid}',
  'DELETE /api/teams/{id}/providers/{pid}',
  'GET /api/teams/{id}/secrets',
  'POST /api/teams/{id}/secrets',
  'PATCH /api/teams/{id}/secrets/{sid}',
  'DELETE /api/teams/{id}/secrets/{sid}',
  'GET /api/teams/{id}/api-keys',
  'POST /api/teams/{id}/api-keys',
];

/** M5 汇合面（03 §5 M5 wire 层 = 全端点）：词表内此前未实现的 GET/POST 族 +
 * conversation stream SSE + [推断] build 详情读面（INFERRED_ROUTES 登记）。
 * preview-token 不在列 = 04 册附录 B「在册不设计」（无 UI/wire 触点）。 */
const M5_ROUTES = [
  'GET /api/teams/{id}/machines',
  'GET /api/teams/{id}/models',
  'GET /api/teams/{id}/progress',
  'GET /api/teams/{id}/skills/{sid}',
  'GET /api/teams/{id}/skills/{sid}/file',
  'GET /api/teams/{id}/agents/{aid}/tasks',
  'GET /api/skills',
  'POST /api/skills',
  'GET /api/whats-new',
  'POST /api/analytics/first-touch',
  'GET /api/conversations/{id}/stream',
  'GET /api/builds/{id}/plans',
  'GET /api/builds/{id}/changes',
  'GET /api/builds/{id}/changes/file', // #224 全文读面（INFERRED_ROUTES 同登记）
  'GET /api/builds/{id}/usage',
];

function normalizePath(path: string): string {
  return path.replaceAll(/:([A-Za-z]+)/g, '{$1}');
}

async function json(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

function first<T>(arr: readonly T[]): T {
  const v = arr[0];
  if (v === undefined) throw new Error('expected non-empty array');
  return v;
}

function last<T>(arr: readonly T[]): T {
  const v = arr[arr.length - 1];
  if (v === undefined) throw new Error('expected non-empty array');
  return v;
}

async function expectErrorShape(res: Response, status: number): Promise<void> {
  expect(res.status).toBe(status);
  const body = await json(res);
  expect(Object.keys(body)).toEqual(['error']); // 错误形状 {error}（r5 §1 实测样本族）
  expect(typeof body.error).toBe('string');
}

describe('路由面 = 02 §6.1 词表', () => {
  const { app } = bootServer();
  // 机器面 /api/machine/* 归 02 §5 词表（machine-wire.test.ts 逐字段对拍），
  // 不入本 web 面（02 §6.1）路由集合。
  const have = new Set(
    app.routes
      .filter(
        (r) =>
          r.method !== 'ALL' && r.path.startsWith('/api') && !r.path.startsWith('/api/machine'),
      )
      .map((r) => `${r.method} ${normalizePath(r.path)}`),
  );
  const canon = new Set([
    ...WEB_REST_ENDPOINTS.map((e) => `${e.method} ${e.path}`),
    ...INFERRED_ROUTES,
  ]);

  test('M2a 核心面全部在位', () => {
    for (const route of CORE_ROUTES) {
      expect(have.has(route), `missing ${route}`).toBe(true);
    }
  });

  test('M2c 密钥/搜索面全部在位', () => {
    for (const route of M2C_ROUTES) {
      expect(have.has(route), `missing ${route}`).toBe(true);
    }
  });

  test('M5 汇合面全部在位（词表补齐 + conversation stream + 详情读面）', () => {
    for (const route of M5_ROUTES) {
      expect(have.has(route), `missing ${route}`).toBe(true);
    }
    // /_mp/api/track = 词表内埋点位（r3 §8.2；「可空实现」口径）——路径不在
    // /api 前缀下，上方 have 集扫不到，此处显式断言在位（词表覆盖零漏位）。
    const all = new Set(
      app.routes.filter((r) => r.method !== 'ALL').map((r) => `${r.method} ${r.path}`),
    );
    expect(all.has('POST /_mp/api/track'), 'missing POST /_mp/api/track').toBe(true);
  });

  test('无词表外发明路径（[推断] 面显式登记）', () => {
    for (const route of have) {
      expect(canon.has(route), `invented route ${route}`).toBe(true);
    }
  });
});

describe('seed 保形端点（02 §2）', () => {
  const s = bootServer();

  test('GET /api/auth/session 与 /api/user/me 保形返回 seed 用户', async () => {
    for (const path of ['/api/auth/session', '/api/user/me']) {
      const res = await req(s.app, 'GET', path);
      expect(res.status).toBe(200);
      expect(userRecordSchema.safeParse(await res.json()).success).toBe(true);
      expect(res.headers.get('set-cookie')).toContain('pacman_session='); // httpOnly cookie 自设（01 §4.2）
      expect(res.headers.get('set-cookie')).toContain('HttpOnly');
    }
  });

  test('GET /api/teams 恒 seed 一行', async () => {
    const res = await req(s.app, 'GET', '/api/teams');
    const body = (await res.json()) as unknown[];
    expect(body).toHaveLength(1);
    expect(teamRecordSchema.safeParse(body[0]).success).toBe(true);
  });

  test('GET /api/teams/{id}/members 自己一行（r2 缓存样本形）', async () => {
    const res = await req(s.app, 'GET', `/api/teams/${s.team.id}/members`);
    const body = (await res.json()) as unknown[];
    expect(body).toHaveLength(1);
    expect(teamMemberSchema.safeParse(body[0]).success).toBe(true);
    expect((body[0] as { memberType: string }).memberType).toBe('user');
  });

  test('未知 team id 一律 404 {error}（team 恒一行）', async () => {
    await expectErrorShape(await req(s.app, 'GET', '/api/teams/nope/members'), 404);
  });

  test('GET /api/teams/{id}/notifications → {unreadThreadIds}', async () => {
    const res = await req(s.app, 'GET', `/api/teams/${s.team.id}/notifications`);
    expect(notificationsResponseSchema.safeParse(await res.json()).success).toBe(true);
  });
});

describe('todo CRUD（demo 面：curl 增删改查）', () => {
  async function setup() {
    const s = bootServer();
    const projectId = await postProject(s.app);
    return { ...s, projectId };
  }

  test('POST /api/projects [推断] → 201 ProjectRecord', async () => {
    const s = bootServer();
    const res = await req(s.app, 'POST', '/api/projects', { name: 'demo' });
    expect(res.status).toBe(201);
    expect(projectRecordSchema.safeParse(await res.json()).success).toBe(true);
    const list = (await (
      await req(s.app, 'GET', `/api/projects?teamId=${s.team.id}`)
    ).json()) as unknown[];
    expect(list).toHaveLength(1);
  });

  test('增：POST todos {title,spec}（r3 §3.1 body 原样）→ 201 TodoRecord', async () => {
    const s = await setup();
    const body: unknown = { title: '写贡献指南', spec: '> 原始诉求\n\n要求：README 末尾追加' };
    expect(createTodoBodySchema.safeParse(body).success).toBe(true); // body 即契约
    const res = await req(s.app, 'POST', `/api/projects/${s.projectId}/todos`, body);
    expect(res.status).toBe(201);
    const record = await res.json();
    expect(todoRecordSchema.safeParse(record).success).toBe(true);
    const doc = todoRecordSchema.parse(record);
    expect(doc.phase).toBe('todo');
    expect(doc.seqNum).toBe(1); // 团队内持久序号 #1
    expect(doc.v).toBe(1);
    expect(doc.ownerId).toBe(s.user.id);
  });

  test('查：项目/团队两个 list 面 + 单读', async () => {
    const s = await setup();
    const created = todoRecordSchema.parse(
      await (
        await req(s.app, 'POST', `/api/projects/${s.projectId}/todos`, { title: 'a', spec: '' })
      ).json(),
    );
    await req(s.app, 'POST', `/api/projects/${s.projectId}/todos`, { title: 'b', spec: '' });
    const byProject = (await (
      await req(s.app, 'GET', `/api/projects/${s.projectId}/todos`)
    ).json()) as unknown[];
    expect(byProject).toHaveLength(2);
    const byTeam = (await (
      await req(s.app, 'GET', `/api/todos?teamId=${s.team.id}`)
    ).json()) as unknown[];
    expect(byTeam).toHaveLength(2);
    expect((byTeam[1] as { seqNum: number }).seqNum).toBe(2);
    const one = await req(s.app, 'GET', `/api/todos/${created.id}`);
    expect(todoRecordSchema.safeParse(await one.json()).success).toBe(true);
  });

  test('改：PATCH todos/{id} → v 递增；非法 phase 流转 409', async () => {
    const s = await setup();
    const created = todoRecordSchema.parse(
      await (
        await req(s.app, 'POST', `/api/projects/${s.projectId}/todos`, { title: 'a', spec: 'x' })
      ).json(),
    );
    const patched = await req(s.app, 'PATCH', `/api/todos/${created.id}`, {
      title: 'a2',
      spec: 'y',
    });
    expect(patched.status).toBe(200);
    const doc = todoRecordSchema.parse(await patched.json());
    expect(doc.title).toBe('a2');
    expect(doc.v).toBe(created.v + 1);
    // close / reopen（r1 §443 / reopen [推断]）
    const closed = todoRecordSchema.parse(
      await (await req(s.app, 'PATCH', `/api/todos/${created.id}`, { phase: 'closed' })).json(),
    );
    expect(closed.phase).toBe('closed');
    // closed 不占列 = 不可作手动改相源（shared BOARD_DROP_PHASES 单源）；
    // 漏斗 closed 出边仅 todo → 其余目标 409
    await expectErrorShape(
      await req(s.app, 'PATCH', `/api/todos/${created.id}`, { phase: 'planning' }),
      409,
    );
    const reopened = todoRecordSchema.parse(
      await (await req(s.app, 'PATCH', `/api/todos/${created.id}`, { phase: 'todo' })).json(),
    );
    expect(reopened.phase).toBe('todo');
    // 手动改相面（#160 看板拖拽）：PATCH phase 目标 ∈ 看板六列 dropPhase =
    // 用户手动列迁移（onboarding P2 r3 §3.10「拖拽至目标列」），漏斗非法边
    // 也放行；系统流（builds/MCP）仍走 02 §4.1 漏斗不变。
    const moved = todoRecordSchema.parse(
      await (await req(s.app, 'PATCH', `/api/todos/${created.id}`, { phase: 'done' })).json(),
    );
    expect(moved.phase).toBe('done');
    expect(moved.v).toBe(reopened.v + 1);
    // 非列目标且漏斗非法边 → 409 {error}（done 出边仅 queued，failed 无列位）
    await expectErrorShape(
      await req(s.app, 'PATCH', `/api/todos/${created.id}`, { phase: 'failed' }),
      409,
    );
    // 列内排序位（01 §4.1 拖拽面 orderIndex）独立落盘
    const reordered = todoRecordSchema.parse(
      await (await req(s.app, 'PATCH', `/api/todos/${created.id}`, { orderIndex: 5 })).json(),
    );
    expect(reordered.orderIndex).toBe(5);
  });

  test('改：PATCH todos/{id} assignment 双槽——槽级 merge + agent 派生投影随动（#208）', async () => {
    const s = await setup();
    const created = todoRecordSchema.parse(
      await (
        await req(s.app, 'POST', `/api/projects/${s.projectId}/todos`, { title: 'a', spec: '' })
      ).json(),
    );
    expect(created.assignment).toBeNull();
    expect(created.agent).toBeNull();
    // 两 Agent 行（plan/build 槽各指一；agent 投影派生自 build 槽，services/todos.ts）。
    const planAgentId = newRecordId();
    const buildAgentId = newRecordId();
    for (const [id, displayName] of [
      [planAgentId, '规划小林'],
      [buildAgentId, '执行小林'],
    ] as const) {
      s.db
        .insert(agentTable)
        .values({
          id,
          teamId: s.team.id,
          displayName,
          description: null,
          status: 'active',
          avatarUrl: null,
          provider: null,
          modelId: null,
          thinkingLevel: null,
          tools: [],
          secrets: [],
          skills: [],
          mcpServers: [],
        })
        .run();
    }
    // plan 槽单写：回显 plan 槽、build 槽 null；agent 投影 = build 槽引用 → 仍 null。
    const planOnly = todoRecordSchema.parse(
      await (
        await req(s.app, 'PATCH', `/api/todos/${created.id}`, {
          assignment: { plan: { agentId: planAgentId } },
        })
      ).json(),
    );
    expect(planOnly.assignment).toEqual({ plan: { agentId: planAgentId }, build: null });
    expect(planOnly.agent).toBeNull();
    expect(planOnly.v).toBe(created.v + 1);
    // build 槽单写：槽级 merge——plan 槽保留；agent 投影随动 = build 槽 Agent。
    const both = todoRecordSchema.parse(
      await (
        await req(s.app, 'PATCH', `/api/todos/${created.id}`, {
          assignment: { build: { agentId: buildAgentId } },
        })
      ).json(),
    );
    expect(both.assignment).toEqual({
      plan: { agentId: planAgentId },
      build: { agentId: buildAgentId },
    });
    expect(both.agent).toEqual({ id: buildAgentId, displayName: '执行小林' });
    // GET 回显 = 持久化真值（非 PATCH 响应一次性投影）。
    const got = todoRecordSchema.parse(
      await (await req(s.app, 'GET', `/api/todos/${created.id}`)).json(),
    );
    expect(got.assignment).toEqual(both.assignment);
    expect(got.agent).toEqual(both.agent);
  });

  test('删：DELETE todos/{id} → 204；再读 404；再删 404', async () => {
    const s = await setup();
    const created = todoRecordSchema.parse(
      await (
        await req(s.app, 'POST', `/api/projects/${s.projectId}/todos`, { title: 'a', spec: '' })
      ).json(),
    );
    expect((await req(s.app, 'DELETE', `/api/todos/${created.id}`)).status).toBe(204);
    await expectErrorShape(await req(s.app, 'GET', `/api/todos/${created.id}`), 404);
    await expectErrorShape(await req(s.app, 'DELETE', `/api/todos/${created.id}`), 404);
  });

  test('错误形状：未知 id 404 / 坏 body 400（{error} 单形状）', async () => {
    const s = await setup();
    await expectErrorShape(await req(s.app, 'GET', '/api/todos/nope'), 404);
    await expectErrorShape(await req(s.app, 'GET', '/api/no-such-route'), 404);
    await expectErrorShape(
      await req(s.app, 'POST', `/api/projects/${s.projectId}/todos`, { title: 'only-title' }),
      400,
    );
    await expectErrorShape(
      await req(s.app, 'POST', `/api/projects/${s.projectId}/todos`, null),
      400,
    );
  });
});

describe('build 面 + phase 九值流转（02 §4.2 主时序 server 侧脊柱）', () => {
  async function withTodo() {
    const s = bootServer();
    const projectId = await postProject(s.app);
    const todoDoc = todoRecordSchema.parse(
      await (
        await req(s.app, 'POST', `/api/projects/${projectId}/todos`, { title: 'run', spec: '' })
      ).json(),
    );
    return { ...s, projectId, todoDoc };
  }

  test('POST builds body = startBuildsBodySchema（r5 §3.4 抓包原样）', async () => {
    const s = await withTodo();
    const body = {
      todoIds: [s.todoDoc.id],
      assignment: { plan: null, build: null },
      withPlan: true,
    };
    expect(startBuildsBodySchema.safeParse(body).success).toBe(true);
    const res = await req(s.app, 'POST', `/api/projects/${s.projectId}/builds`, body);
    expect(res.status).toBe(201);
    const payload = (await res.json()) as { builds: unknown[] };
    expect(payload.builds).toHaveLength(1);
    const b = buildRecordSchema.parse(payload.builds[0]);
    // buildId ≡ conversationId：UUIDv7 形（r3 §3.0）
    expect(b.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(b.prevPhase).toBe('todo');
    expect(b.triggerSource).toBe('user');
    expect(b.withPlan).toBe(true);
    // todo → queued（02 §4.1：已启动，等空闲机器），assignment/latestBuildId/lastRunAt 落位
    const t = todoRecordSchema.parse(
      await (await req(s.app, 'GET', `/api/todos/${s.todoDoc.id}`)).json(),
    );
    expect(t.phase).toBe('queued');
    expect(t.latestBuildId).toBe(b.id);
    expect(t.lastRunAt).not.toBeNull();
    // 规划步入队（step 队列 server 持有，A6）
    const steps = (await (
      await req(s.app, 'GET', `/api/builds/${b.id}/steps`)
    ).json()) as unknown[];
    expect(steps).toHaveLength(1);
    const st = stepRecordSchema.parse(steps[0]);
    expect(st.kind).toBe('plan');
    expect(st.machineId).toBeNull();
    // 项目 builds 面
    const projectBuilds = (await (
      await req(s.app, 'GET', `/api/projects/${s.projectId}/builds`)
    ).json()) as unknown[];
    expect(projectBuilds).toHaveLength(1);
  });

  test('直执行（withPlan:false）入队执行步（02 §4.2 开始 dialog 两分支）', async () => {
    const s = await withTodo();
    const res = await req(s.app, 'POST', `/api/projects/${s.projectId}/builds`, {
      todoIds: [s.todoDoc.id],
      assignment: { plan: null, build: null },
      withPlan: false,
    });
    const b = buildRecordSchema.parse(((await res.json()) as { builds: unknown[] }).builds[0]);
    const steps = (await (
      await req(s.app, 'GET', `/api/builds/${b.id}/steps`)
    ).json()) as unknown[];
    expect(stepRecordSchema.parse(steps[0]).kind).toBe('build');
  });

  test('主时序全链：queued→planning→confirm→(驳回 v2 回路)→building→review→merge 202→done', async () => {
    const s = await withTodo();
    const started = await req(s.app, 'POST', `/api/projects/${s.projectId}/builds`, {
      todoIds: [s.todoDoc.id],
      assignment: { plan: null, build: null },
      withPlan: true,
    });
    const b = buildRecordSchema.parse(((await started.json()) as { builds: unknown[] }).builds[0]);
    const stepsOf = async () =>
      ((await (await req(s.app, 'GET', `/api/builds/${b.id}/steps`)).json()) as unknown[]).map(
        (r) => stepRecordSchema.parse(r),
      );
    const phaseOf = async () =>
      todoRecordSchema.parse(await (await req(s.app, 'GET', `/api/todos/${s.todoDoc.id}`)).json())
        .phase;

    // 机器领规划步（claim/journal 面归 M3；此处按 02 §4.1 语义驱动）
    setTodoPhase(s.svc, s.todoDoc.id, 'planning');
    expect(await phaseOf()).toBe('planning');
    // 规划步成 → plan 卡就绪 → confirm（02 §4.2）；plan.md 交接物落库在先
    //（#113：无产物规划步不算成——服务面直驱以直插 plan 行等价产物回传）。
    s.db
      .insert(planTable)
      .values({
        id: 'plan-wire-1',
        buildId: b.id,
        version: 1,
        content: '# 方案',
        createdAt: Date.now(),
      })
      .run();
    completeStep(s.svc, first(await stepsOf()).id);
    expect(await phaseOf()).toBe('confirm');
    // 合并关口前拒绝：非 review 态 merge → 409 {error}
    await expectErrorShape(await req(s.app, 'POST', `/api/builds/${b.id}/merge`), 409);
    // 驳回回路（r5 §4）：body = buildStepActionBodySchema 抓包原样
    const revisionBody = {
      action: 'revision',
      side: 'plan',
      feedback: '标题去掉项目名后缀',
      clientMessageId: '3f9a0c2e-0000-4000-8000-000000000000',
    };
    expect(buildStepActionBodySchema.safeParse(revisionBody).success).toBe(true);
    const revision = await req(s.app, 'POST', `/api/builds/${b.id}/steps`, revisionBody);
    expect(revision.status).toBe(202);
    expect(await phaseOf()).toBe('planning'); // 重规划步入队（同 conv continue session 语义归 M3）
    // 时间线插用户驳回消息行；封套 = conversationMessagesResponseSchema（r5 §3.6）
    const msgs = await (await req(s.app, 'GET', `/api/conversations/${b.id}/messages`)).json();
    expect(conversationMessagesResponseSchema.safeParse(msgs).success).toBe(true);
    const envelope = conversationMessagesResponseSchema.parse(msgs);
    expect(envelope.messages).toHaveLength(1);
    expect(envelope.messages[0]).toMatchObject({ role: 'user', content: revisionBody.feedback });
    // 重规划步成 → 再 confirm → 确认
    completeStep(s.svc, last(await stepsOf()).id);
    expect(await phaseOf()).toBe('confirm');
    const confirm = await req(s.app, 'POST', `/api/builds/${b.id}/steps`, { action: 'confirm' });
    expect(confirm.status).toBe(202);
    expect(await phaseOf()).toBe('building');
    // 执行步成 → review（hasChanges=true → 待验收列，r5 §8）
    completeStep(s.svc, last(await stepsOf()).id);
    expect(await phaseOf()).toBe('review');
    // merge = 202 {delegated:true}（r3 §3.6 实测）+ 合并步入队
    const merge = await req(s.app, 'POST', `/api/builds/${b.id}/merge`);
    expect(merge.status).toBe(202);
    expect(mergeAcceptedResponseSchema.safeParse(await merge.json()).success).toBe(true);
    const steps4 = await stepsOf();
    expect(last(steps4).kind).toBe('merge');
    // 合并步成 → done（🎉 时间线面归 web；phase 落位 = server 侧脊柱终点）
    completeStep(s.svc, last(steps4).id);
    expect(await phaseOf()).toBe('done');
    // 定时复跑边（r3 §9 实测：done todo 到点全新重跑回到执行中→待验收）：
    // done→queued 合法，新 build prevPhase=done。流转表对触发源不敏感
    // （手动自 done 重跑未分离观测 [推断]，与 failed 重跑同口径放行；
    // wire 补采后收紧，04 附录 A）。
    const rerun = await req(s.app, 'POST', `/api/projects/${s.projectId}/builds`, {
      todoIds: [s.todoDoc.id],
      assignment: { plan: null, build: null },
      withPlan: false,
    });
    expect(rerun.status).toBe(201);
    const rerunBuild = buildRecordSchema.parse(
      ((await rerun.json()) as { builds: unknown[] }).builds[0],
    );
    expect(rerunBuild.prevPhase).toBe('done');
    expect(await phaseOf()).toBe('queued');
  });

  test('失败重跑边：failed→queued 经 POST builds（r3 §3.7）', async () => {
    const s = await withTodo();
    await req(s.app, 'POST', `/api/projects/${s.projectId}/builds`, {
      todoIds: [s.todoDoc.id],
      assignment: { plan: null, build: null },
      withPlan: false,
    });
    setTodoPhase(s.svc, s.todoDoc.id, 'building');
    setTodoPhase(s.svc, s.todoDoc.id, 'failed'); // 机器离线 canon（02 §4.2）
    const rerun = await req(s.app, 'POST', `/api/projects/${s.projectId}/builds`, {
      todoIds: [s.todoDoc.id],
      assignment: { plan: null, build: null },
      withPlan: false,
    });
    expect(rerun.status).toBe(201); // 新 conv/新分支/新 build
    const t = todoRecordSchema.parse(
      await (await req(s.app, 'GET', `/api/todos/${s.todoDoc.id}`)).json(),
    );
    expect(t.phase).toBe('queued');
    expect(t.buildHistory.length).toBe(2); // 运行历史两行（r3 §3.8）
  });

  test('未知 build 404；坏 steps body 400', async () => {
    const s = await withTodo();
    await expectErrorShape(await req(s.app, 'GET', '/api/builds/nope'), 404);
    await expectErrorShape(await req(s.app, 'GET', '/api/builds/nope/steps'), 404);
    const started = await req(s.app, 'POST', `/api/projects/${s.projectId}/builds`, {
      todoIds: [s.todoDoc.id],
      assignment: { plan: null, build: null },
      withPlan: true,
    });
    const b = buildRecordSchema.parse(((await started.json()) as { builds: unknown[] }).builds[0]);
    await expectErrorShape(
      await req(s.app, 'POST', `/api/builds/${b.id}/steps`, { action: 'cancel' }),
      400,
    );
  });
});

describe('响应 shape 全量 zod 复验（字段即契约，02/A9）', () => {
  test('CRUD 全链每个响应体过 shared schema', async () => {
    const s = bootServer();
    const projectId = await postProject(s.app);
    const created = (await (
      await req(s.app, 'POST', `/api/projects/${projectId}/todos`, { title: 'x', spec: '' })
    ).json()) as { id: string };
    expect(todoRecordSchema.safeParse(created).success).toBe(true);
    const list = await (await req(s.app, 'GET', `/api/todos?teamId=${s.team.id}`)).json();
    expect(z.array(todoRecordSchema).safeParse(list).success).toBe(true);
    const tags = await (await req(s.app, 'GET', `/api/projects/${projectId}/tags`)).json();
    expect(tags).toEqual([]);
    const one = await (await req(s.app, 'GET', `/api/todos/${created.id}`)).json();
    expect(todoRecordSchema.safeParse(one).success).toBe(true);
  });
});
