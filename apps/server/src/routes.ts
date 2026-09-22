// M2a 核心 REST 面 + SSE team stream——词表单源 = shared WEB_REST_ENDPOINTS
// （02 §6.1 canonical；路由对拍测试 = test/wire.test.ts）。
// 未观测响应封套按 [推断] 投影（04 §3 不判负口径），逐处标注。
// 本票面 = todo/build CRUD 核心 + team stream 骨架；git 托管/cron 归 M2b，
// 密钥/搜索/通知 SSE 归 M2c，machine/chief 面归 M3/M4。

import {
  type AgentRecord,
  type BuildRecord,
  buildStepActionBodySchema,
  createTodoBodySchema,
  phaseSchema,
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
  const svc = { db: ctx.db, hub: ctx.hub, machineHub: ctx.machineHub };

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
    // {unreadThreadIds}（02 §9.1）：chief 线程未读 entityId 集；通知事件面归 M2c。
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
}
