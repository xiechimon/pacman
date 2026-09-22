// 核心 REST 面 + SSE team stream——词表单源 = shared WEB_REST_ENDPOINTS
// （02 §6.1 canonical；路由对拍测试 = test/wire.test.ts）。
// 未观测响应封套按 [推断] 投影（04 §3 不判负口径），逐处标注。
// 覆盖面 = todo/build CRUD + team stream + 密钥三面（provider/secret/apiKey，
// 02 §8）+ 搜索（02 §6.3）；git 托管/cron 归 M2b，machine/chief 面归 M3/M4。

import {
  type AgentRecord,
  apiKeyRecordSchema,
  type BuildRecord,
  buildStepActionBodySchema,
  createTodoBodySchema,
  phaseSchema,
  providerApiSchema,
  providerModelSchema,
  setSecretBodySchema,
  startBuildsBodySchema,
  type TeamMember,
  type TodoRecord,
} from '@pacman/shared';
import { eq, inArray, isNull } from 'drizzle-orm';
import type { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import type { AppContext } from './context.js';
import { agent, build, message, notification, project, tag, todo } from './db/schema.js';
import { conflict, notFound, parseWith } from './lib/errors.js';
import { newRecordId } from './lib/ids.js';
import { createApiKey, listApiKeys } from './services/api-keys.js';
import {
  applyBuildStepAction,
  getBuild,
  listSteps,
  requestMerge,
  startBuilds,
  toBuildRecord,
} from './services/builds.js';
import { createSerialConnection } from './services/events.js';
import { PhaseTransitionError } from './services/phase.js';
import {
  createProvider,
  deleteProvider,
  getProvidersEnvelope,
  updateProvider,
} from './services/providers.js';
import { search } from './services/search.js';
import { createSecret, deleteSecret, listSecrets, updateSecret } from './services/secrets.js';
import { createTodo, deleteTodo, getTodo, listTodos, updateTodo } from './services/todos.js';

/** 会话 cookie 名 [设计]（01 §4.2：httpOnly cookie 自设；品牌槽归 #44）。 */
export const SESSION_COOKIE = 'tds_session';

function requireTeam(ctx: AppContext, id: string): void {
  // team 恒 seed 一行（02 §2.2）；其余 id 一律 404。
  if (id !== ctx.team.id) throw notFound(`team ${id}`);
}

function requireProject(ctx: AppContext, id: string): typeof project.$inferSelect {
  const row = ctx.db.select().from(project).where(eq(project.id, id)).get();
  if (!row) throw notFound(`project ${id}`);
  return row;
}

/** PATCH /api/todos/{id} body——update_todo 面 [推断]（02 §6.1 PATCH 面未
 * 抓取；字段 = todo record 可写子集，wire 补采后收紧，04 附录 A）。 */
const patchTodoBodySchema = z.object({
  title: z.string().optional(),
  spec: z.string().optional(),
  phase: phaseSchema.optional(),
  tagIds: z.array(z.string()).optional(),
  orderIndex: z.number().optional(),
});

/** POST /api/projects body [推断]（项目创建流两分支 UI 按 r2 §9，wire 未采；
 * repo 形态细面归 M2b）。 */
const createProjectBodySchema = z.object({
  name: z.string(),
  teamId: z.string().optional(),
});

/** POST/PATCH /api/teams/{id}/providers body [推断]（r3 §2 表单实测字段投影，
 * wire 未采）：record 可写面 + apiKey 只写位（02 §8；null = 清除——「凭证
 * 只写不读：可以替换或删除」r2 §6.5）。 */
const createProviderBodySchema = z.object({
  providerId: z.string(),
  label: z.string(),
  baseUrl: z.string(),
  api: providerApiSchema,
  authHeader: z.boolean().optional(),
  compat: z.object({ supportsDeveloperRole: z.boolean() }).optional(),
  models: z.array(providerModelSchema).optional(),
  apiKey: z.string().nullish(),
});
const patchProviderBodySchema = createProviderBodySchema.partial();

/** PATCH /api/teams/{id}/secrets/{sid} body [推断]（覆盖面 =「保存后只能
 * 覆盖或删除」r2 §6.3；POST body = shared setSecretBodySchema 单源）。 */
const patchSecretBodySchema = z.object({
  name: z.string().optional(),
  description: z.string().nullish(),
  value: z.string().optional(),
});

/** POST /api/teams/{id}/api-keys body = shared apiKeyRecordSchema（02 §6.2
 * 形状原样）+ name 放宽可选（表单「密钥名称（可选）」r3 §6）。 */
const createApiKeyBodySchema = apiKeyRecordSchema.extend({ name: z.string().nullish() });

function agentRecordOf(row: typeof agent.$inferSelect): AgentRecord {
  return {
    id: row.id,
    displayName: row.displayName,
    description: row.description,
    status: 'active', // 观测值仅 "active"（records/agent.ts，词表不收窄外值）
    avatarUrl: row.avatarUrl,
    provider: row.provider,
    modelId: row.modelId,
    thinkingLevel: row.thinkingLevel,
    tools: row.tools,
    secrets: row.secrets,
    skills: row.skills,
    mcpServers: row.mcpServers,
  };
}

async function jsonBody(c: { req: { json(): Promise<unknown> } }): Promise<unknown> {
  return c.req.json().catch(() => null);
}

export function registerRoutes(app: Hono, ctx: AppContext): void {
  const svc = { db: ctx.db, hub: ctx.hub, user: ctx.user };

  // —— 认证保形（02 §2.1：自动登录，无登录页）———————————————————————————
  app.use('/api/*', async (c, next) => {
    if (!getCookie(c, SESSION_COOKIE)) {
      setCookie(c, SESSION_COOKIE, ctx.user.id, { httpOnly: true, path: '/' });
    }
    await next();
  });

  // —— GET 面 ————————————————————————————————————————————————————————————————
  app.get('/api/auth/session', (c) => c.json(ctx.user));
  app.get('/api/user/me', (c) => c.json(ctx.user));

  app.get('/api/teams', (c) => c.json([ctx.team]));

  app.get('/api/teams/:id/members', (c) => {
    const id = c.req.param('id');
    requireTeam(ctx, id);
    // 成员区只渲染自己一行 + Agent 计数（02 §2.3/r3 §4；r5 §1：Agent 列表
    // 实际走 members，memberType:"agent" 行内嵌 actor 全记录）。
    const rows: TeamMember[] = [
      {
        id: `member-${ctx.user.id}`, // 行 id 合成 [推断]（member 无表位，DB_TABLES 单源）
        teamId: id,
        actorId: ctx.user.id,
        memberType: 'user',
        actor: ctx.user,
      },
    ];
    for (const row of ctx.db.select().from(agent).where(eq(agent.teamId, id)).all()) {
      rows.push({
        id: `member-${row.id}`,
        teamId: id,
        actorId: row.id,
        memberType: 'agent',
        actor: agentRecordOf(row),
      });
    }
    return c.json(rows);
  });

  app.get('/api/teams/:id/notifications', (c) => {
    const id = c.req.param('id');
    requireTeam(ctx, id);
    // {unreadThreadIds}（02 §9.1）：未读 entityId 集（todo/chief 线程）；事件面
    // = services/notifications.ts（SSE 三事件，r5 §7.2）。已读写路径无观测端点，
    // 未读集随新事件 upsert 重置（04 附录 A 补采口径）。
    const unread = ctx.db
      .selectDistinct({ entityId: notification.entityId })
      .from(notification)
      .where(isNull(notification.readAt))
      .all()
      .map((r) => r.entityId);
    return c.json({ unreadThreadIds: unread });
  });

  // —— SSE team stream（02 §1.2；事件形状 = shared teamStreamEventSchema）———————
  app.get('/api/teams/:id/stream', (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    return streamSSE(c, async (stream) => {
      const conn = createSerialConnection((payload) =>
        stream.writeSSE({ data: JSON.stringify(payload) }),
      );
      const unsubscribe = ctx.hub.subscribe(teamId, conn);
      const timer = setInterval(() => {
        void conn.send({ type: 'ping', seq: conn.nextSeq() });
      }, ctx.pingIntervalMs);
      let release: () => void = () => {};
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      stream.onAbort(() => {
        clearInterval(timer);
        unsubscribe();
        release();
      });
      // 连接即发首帧 ping（seq 连接内递增，r3 §8.1 样本族）[推断：首帧时机]。
      await conn.send({ type: 'ping', seq: conn.nextSeq() });
      await held;
    });
  });

  app.get('/api/projects', (c) => {
    const teamId = c.req.query('teamId') ?? ctx.team.id;
    const rows = ctx.db.select().from(project).where(eq(project.teamId, teamId)).all();
    return c.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        teamId: r.teamId,
        ...(r.repoKind !== null ? { repoKind: r.repoKind } : {}),
      })),
    );
  });

  app.get('/api/projects/:id/todos', (c) => {
    const row = requireProject(ctx, c.req.param('id'));
    return c.json(listTodos(svc, { projectId: row.id }));
  });

  app.get('/api/projects/:id/builds', (c) => {
    const row = requireProject(ctx, c.req.param('id'));
    // 项目 todo 集下的 build 行（build 无 projectId 列，经 todo 归属投影）。
    const todoIds = ctx.db
      .select({ id: todo.id })
      .from(todo)
      .where(eq(todo.projectId, row.id))
      .all()
      .map((r) => r.id);
    if (todoIds.length === 0) return c.json([]);
    const builds = ctx.db.select().from(build).where(inArray(build.todoId, todoIds)).all();
    return c.json(builds.map(toBuildRecord));
  });

  app.get('/api/projects/:id/tags', (c) => {
    const row = requireProject(ctx, c.req.param('id'));
    const tags = ctx.db.select().from(tag).where(eq(tag.projectId, row.id)).all();
    return c.json(tags.map((t) => ({ id: t.id, projectId: t.projectId, name: t.name })));
  });

  app.get('/api/todos', (c) => {
    const teamId = c.req.query('teamId') ?? ctx.team.id;
    return c.json(listTodos(svc, { teamId }));
  });

  app.get('/api/todos/:id', (c) => {
    const id = c.req.param('id');
    const record = getTodo(svc, id);
    if (!record) throw notFound(`todo ${id}`);
    return c.json(record);
  });

  app.get('/api/builds/:id', (c) => {
    const id = c.req.param('id');
    const record = getBuild(svc, id);
    if (!record) throw notFound(`build ${id}`);
    return c.json(record);
  });

  app.get('/api/builds/:id/steps', (c) => {
    const id = c.req.param('id');
    if (!getBuild(svc, id)) throw notFound(`build ${id}`);
    return c.json(listSteps(svc, id));
  });

  app.get('/api/conversations/:id/messages', (c) => {
    const conversationId = c.req.param('id');
    // 封套 = conversationMessagesResponseSchema（r5 §3.6 原样）；未采字段取
    // 空值 [推断]（chips/steerPending/nextCursor 细形未逐一采集）。
    const rows = ctx.db
      .select()
      .from(message)
      .where(eq(message.conversationId, conversationId))
      .all();
    return c.json({
      messages: rows.map((r) => ({
        id: r.id,
        role: r.role,
        content: r.content,
        createdAt: r.createdAt,
      })),
      chips: [],
      historyEpoch: 0,
      steerPending: [],
      activeRun: null,
      nextCursor: null,
    });
  });

  // —— POST 面 ————————————————————————————————————————————————————————————————
  app.post('/api/projects', async (c) => {
    // [推断] REST 同名（02 §6.1 POST 面未观测；项目创建流 UI 证据 02 §3/r2 §9）。
    const body = parseWith(createProjectBodySchema, await jsonBody(c), 'body');
    const teamId = body.teamId ?? ctx.team.id;
    requireTeam(ctx, teamId);
    const id = newRecordId();
    ctx.db.insert(project).values({ id, name: body.name, teamId, repoKind: null }).run();
    return c.json({ id, name: body.name, teamId }, 201);
  });

  app.post('/api/projects/:id/todos', async (c) => {
    const row = requireProject(ctx, c.req.param('id'));
    const body = parseWith(createTodoBodySchema, await jsonBody(c), 'body');
    const record = createTodo(svc, {
      teamId: row.teamId,
      projectId: row.id,
      title: body.title,
      spec: body.spec,
      createdBy: ctx.user.id, // 人工建 = seed 用户（createdBy 取值 [推断]，records/todo.ts）
      ownerId: ctx.user.id,
    });
    return c.json(record, 201); // 响应封套 [推断]：全记录（安全超集）
  });

  app.post('/api/projects/:id/builds', async (c) => {
    const row = requireProject(ctx, c.req.param('id'));
    const body = parseWith(startBuildsBodySchema, await jsonBody(c), 'body');
    let builds: BuildRecord[];
    try {
      builds = startBuilds(svc, {
        projectId: row.id,
        todoIds: body.todoIds,
        assignment: body.assignment,
        withPlan: body.withPlan,
      });
    } catch (err) {
      if (err instanceof PhaseTransitionError) throw conflict(err.message);
      throw err;
    }
    return c.json({ builds }, 201); // 封套 [推断]（响应 wire 未采）
  });

  app.post('/api/builds/:id/merge', (c) => {
    try {
      const result = requestMerge(svc, c.req.param('id'));
      return c.json(result, 202); // 202 {delegated:true}（r3 §3.6 实测）
    } catch (err) {
      if (err instanceof PhaseTransitionError) throw conflict(err.message);
      throw err;
    }
  });

  app.post('/api/builds/:id/steps', async (c) => {
    const body = parseWith(buildStepActionBodySchema, await jsonBody(c), 'body');
    try {
      applyBuildStepAction(svc, c.req.param('id'), body);
    } catch (err) {
      if (err instanceof PhaseTransitionError) throw conflict(err.message);
      throw err;
    }
    // 响应封套 [推断]：入队即委派语义（与 merge 同族 202；wire 未采）。
    return c.json({ delegated: true }, 202);
  });

  // —— PATCH / DELETE 面（[推断] REST 同名，02 §6.1/DELETE_FACE）—————————————————
  app.patch('/api/todos/:id', async (c) => {
    const id = c.req.param('id');
    const body = parseWith(patchTodoBodySchema, await jsonBody(c), 'body');
    let record: TodoRecord | null;
    try {
      record = updateTodo(svc, id, body);
    } catch (err) {
      if (err instanceof PhaseTransitionError) throw conflict(err.message);
      throw err;
    }
    if (!record) throw notFound(`todo ${id}`);
    return c.json(record);
  });

  app.delete('/api/todos/:id', (c) => {
    const id = c.req.param('id');
    if (!deleteTodo(svc, id)) throw notFound(`todo ${id}`);
    return c.body(null, 204);
  });

  // —— ⌘K 搜索（02 §6.3 [设计] 自设；wire 无外部真值，面板行为对 r2 04）———————
  app.get('/api/search', (c) =>
    c.json(search(svc, { teamId: ctx.team.id, q: c.req.query('q') ?? null })),
  );

  // —— 密钥三面（02 §8：API 面写只读掩码 + apiKey 存哈希；at-rest 经 SecretBox）。
  // provider 三面 = 词表内（GET/POST/PATCH，r3 §2/§8.2）+ DELETE（DELETE_FACE
  // 「可以替换或删除」r2 §6.5）；secret/apiKey 路径 = REST 同名 [推断]
  // （页与弹窗实测存在 r2 §6.3/§6.7/r3 §6，wire 未采；登记 test/wire.test.ts）。
  const keysvc = { db: ctx.db, box: ctx.secretBox };

  app.get('/api/teams/:id/providers', (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    // 封套 [推断]：presets[] 字段实测在位（r3 §2），并列 providers 包络形未采。
    return c.json(getProvidersEnvelope(keysvc, teamId));
  });

  app.post('/api/teams/:id/providers', async (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    const body = parseWith(createProviderBodySchema, await jsonBody(c), 'body');
    const record = createProvider(keysvc, { teamId, body, createdBy: ctx.user.id });
    return c.json(record, 201); // 封套 [推断]：全记录（安全超集，永不含 apiKey）
  });

  app.patch('/api/teams/:id/providers/:pid', async (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    const body = parseWith(patchProviderBodySchema, await jsonBody(c), 'body');
    return c.json(updateProvider(keysvc, teamId, c.req.param('pid'), body));
  });

  app.delete('/api/teams/:id/providers/:pid', (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    if (!deleteProvider(keysvc, teamId, c.req.param('pid'))) {
      throw notFound(`provider ${c.req.param('pid')}`);
    }
    return c.body(null, 204);
  });

  app.get('/api/teams/:id/secrets', (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    return c.json(listSecrets(keysvc, teamId)); // SecretRecord[]：value 永不出现（02 §8）
  });

  app.post('/api/teams/:id/secrets', async (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    const body = parseWith(setSecretBodySchema, await jsonBody(c), 'body');
    const record = createSecret(keysvc, {
      teamId,
      name: body.name,
      description: body.description ?? null,
      value: body.value,
    });
    return c.json(record, 201); // 封套 [推断]：全记录（值只写不读）
  });

  app.patch('/api/teams/:id/secrets/:sid', async (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    const body = parseWith(patchSecretBodySchema, await jsonBody(c), 'body');
    return c.json(updateSecret(keysvc, teamId, c.req.param('sid'), body));
  });

  app.delete('/api/teams/:id/secrets/:sid', (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    if (!deleteSecret(keysvc, teamId, c.req.param('sid'))) {
      throw notFound(`secret ${c.req.param('sid')}`);
    }
    return c.body(null, 204);
  });

  app.get('/api/teams/:id/api-keys', (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    // 掩码行 [推断]（r3 §6 展示规则；行标识/掩码列 wire 字段未采）。
    return c.json(listApiKeys(svc, teamId));
  });

  app.post('/api/teams/:id/api-keys', async (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    const body = parseWith(createApiKeyBodySchema, await jsonBody(c), 'body');
    const created = createApiKey(svc, {
      teamId,
      name: body.name ?? null,
      gitAccess: body.gitAccess,
      mcpAccess: body.mcpAccess,
      toolGrants: body.toolGrants,
    });
    // 创建响应含明文一次（02 §8/r3 §6；封套 [推断]；文案 canon =
    // shared API_KEY_ONE_TIME_COPY，web 面渲染）。
    return c.json(created, 201);
  });
}
