// M2 核心 REST 面 + SSE team stream + repo 托管双形态 git 面——词表单源 =
// shared WEB_REST_ENDPOINTS（02 §6.1 canonical；路由对拍测试 = test/wire.test.ts）。
// 未观测响应封套按 [推断] 投影（04 §3 不判负口径），逐处标注。
// 覆盖面 = M2a 核心 CRUD + team stream + repo 双形态（02 §3/A4：托管 bare
// `git http-backend` + GitHub 接入记录面 + tree/file/branches 文件浏览）+
// schedule CRUD（02 §9.2，M2b）+ 密钥三面（provider/secret/apiKey，02 §8）+
// 搜索（02 §6.3，M2c）；machine/chief 面归 M3/M4。

import { timingSafeEqual } from 'node:crypto';
import { join } from 'node:path';
import {
  type AgentRecord,
  apiKeyRecordSchema,
  type BuildRecord,
  buildStepActionBodySchema,
  createScheduleBodySchema,
  createTodoBodySchema,
  phaseSchema,
  projectRepoKindSchema,
  providerApiSchema,
  providerModelSchema,
  setSecretBodySchema,
  startBuildsBodySchema,
  type TeamMember,
  type TodoRecord,
} from '@pacman/shared';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import type { AppContext } from './context.js';
import { agent, apiKey, build, message, notification, project, tag, todo } from './db/schema.js';
import { sha256Hex } from './lib/crypto.js';
import { conflict, HttpError, notFound, parseWith } from './lib/errors.js';
import { systemGitOps } from './lib/git.js';
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
import {
  isGithubRepoRef,
  provisionHostedRepo,
  readBranches,
  readFile,
  readTree,
  slugifyRepoName,
  toProjectRecord,
  uniqueRepoName,
} from './services/git.js';
import { PhaseTransitionError } from './services/phase.js';
import {
  createProvider,
  deleteProvider,
  getProvidersEnvelope,
  updateProvider,
} from './services/providers.js';
import { createSchedule, deleteSchedule, listSchedules } from './services/schedules.js';
import { search } from './services/search.js';
import { createSecret, deleteSecret, listSecrets, updateSecret } from './services/secrets.js';
import { createTodo, deleteTodo, getTodo, listTodos, updateTodo } from './services/todos.js';

/** 会话 cookie 名 [设计]（01 §4.2：httpOnly cookie 自设；品牌槽归 #44）。 */
export const SESSION_COOKIE = 'tds_session';

/** git http 认证域 [设计]（Basic realm；品牌槽归 #44）。 */
const GIT_AUTH_REALM = 'pacman-git';

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

/** POST /api/projects body [推断]（项目创建流两分支 UI 按 r2 §9 D 组截图为靶，
 * 02 §3；wire 未采）。repoKind 缺省 = 未绑定 repo（M2a 兼容形状）。 */
const createProjectBodySchema = z.object({
  name: z.string(),
  teamId: z.string().optional(),
  repoKind: projectRepoKindSchema.optional(),
  /** GitHub 接入 `owner/repo`（repoKind=github 必填）。 */
  githubRepo: z.string().optional(),
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

/** 请求源（托管 cloneUrl 的本地主机代位段，02 §5.8 gitHostDomain 槽）。 */
function requestOrigin(c: { req: { url: string } }): string {
  return new URL(c.req.url).origin;
}

/** git Basic auth → api_key 行 id。凭证 = key 明文（用户名位忽略，PAT 同款
 * [设计]）；校验 = sha256 哈希比对（存哈希不存可逆值，02 §8）+ gitAccess 白名单
 * （02 §6.2）。key 发行端点归 M2c；未命中 = undefined（401 面，02 §3 凭证纪律
 * 「手动 fetch 无凭证失败」）。 */
function verifyGitBasicAuth(ctx: AppContext, header: string): string | undefined {
  const match = /^Basic\s+(.+)$/i.exec(header);
  if (!match) return undefined;
  const decoded = Buffer.from(match[1] ?? '', 'base64').toString('utf8');
  const sep = decoded.indexOf(':');
  if (sep < 0) return undefined;
  const secret = decoded.slice(sep + 1);
  if (secret === '') return undefined;
  const hash = Buffer.from(sha256Hex(secret));
  const rows = ctx.db.select().from(apiKey).where(eq(apiKey.gitAccess, true)).all();
  return rows.find(
    (r) => r.keyHash.length === hash.byteLength && timingSafeEqual(Buffer.from(r.keyHash), hash), // 定长比较（哈希面卫生）
  )?.id;
}

export function registerRoutes(app: Hono, ctx: AppContext): void {
  const svc = { db: ctx.db, hub: ctx.hub, machineHub: ctx.machineHub, user: ctx.user };

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
    const origin = requestOrigin(c);
    const rows = ctx.db.select().from(project).where(eq(project.teamId, teamId)).all();
    return c.json(rows.map((r) => toProjectRecord(r, origin)));
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

  // —— repo 文件浏览面（02 §3：读裸库 ref 树与单文件，server 端实现，无检出
  // 要求；服务 `Tasks | Files` 分段开关，r1 §461。响应形状 [推断]）———————————
  app.get('/api/projects/:id/tree', async (c) => {
    const row = requireProject(ctx, c.req.param('id'));
    return c.json(await readTree(ctx, row.id, c.req.query('ref')));
  });

  app.get('/api/projects/:id/file', async (c) => {
    const row = requireProject(ctx, c.req.param('id'));
    const path = c.req.query('path');
    if (path === undefined || path === '') {
      throw new HttpError(400, 'invalid query path: required');
    }
    return c.json(await readFile(ctx, row.id, path, c.req.query('ref')));
  });

  app.get('/api/projects/:id/branches', async (c) => {
    const row = requireProject(ctx, c.req.param('id'));
    return c.json(await readBranches(ctx, row.id));
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

  // —— 定时面（02 §9.2/r3 §9；record = shared scheduleRecordSchema）————————————
  app.get('/api/schedules', (c) => {
    // 查询参数名 `team`（02 §6.1 `schedules?team=` 实测原样）。
    const teamId = c.req.query('team') ?? ctx.team.id;
    requireTeam(ctx, teamId);
    return c.json(listSchedules(svc, teamId));
  });

  // —— POST 面 ————————————————————————————————————————————————————————————————
  app.post('/api/projects', async (c) => {
    // [推断] REST 同名（02 §6.1 POST 面未观测；项目创建流两分支 UI 证据 02 §3/r2 §9）。
    const body = parseWith(createProjectBodySchema, await jsonBody(c), 'body');
    const teamId = body.teamId ?? ctx.team.id;
    requireTeam(ctx, teamId);
    if (
      body.repoKind === 'github' &&
      (body.githubRepo === undefined || !isGithubRepoRef(body.githubRepo))
    ) {
      throw new HttpError(400, 'invalid body at githubRepo: expected "owner/repo"');
    }
    const id = newRecordId();
    let repoName: string | null = null;
    if (body.repoKind === 'hosted') {
      // 托管形态落地：init 本地 bare repo（02 §3 锁定）。
      repoName = await uniqueRepoName(ctx, teamId, slugifyRepoName(body.name));
      await provisionHostedRepo(ctx, teamId, repoName);
    }
    ctx.db
      .insert(project)
      .values({
        id,
        name: body.name,
        teamId,
        repoKind: body.repoKind ?? null,
        repoName,
        githubRepo: body.repoKind === 'github' ? (body.githubRepo ?? null) : null,
      })
      .run();
    const row = requireProject(ctx, id);
    return c.json(toProjectRecord(row, requestOrigin(c)), 201);
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

  app.post('/api/schedules', async (c) => {
    const body = parseWith(createScheduleBodySchema, await jsonBody(c), 'body');
    // 响应封套 [推断]：201 全记录（record 形状 = r3 §8.3 实测原样）。
    const record = createSchedule(svc, {
      ...body,
      teamId: ctx.team.id,
      createdBy: ctx.user.id,
    });
    return c.json(record, 201);
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

  app.delete('/api/schedules/:id', (c) => {
    const id = c.req.param('id');
    if (!deleteSchedule(svc, id)) throw notFound(`schedule ${id}`);
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

  // —— 托管 repo git 面（02 §3/A4：`git http-backend` CGI，不引第三方 git host；
  // 远端 URL 形状 = `<origin>/git/<teamId>/<repoName>`，对应 r3 §1.4
  // `https://git.todos.dev/<teamId>/<repoName>`，域名段 = 本地主机代位 +
  // 同源 `/git` 前缀 [设计]）。凭证纪律（r3 §1.4 实测手动 fetch 无凭证失败）：
  // Basic auth → api_key(gitAccess) 哈希比对，未认证一律 401。 ————————————————
  app.all('/git/*', async (c) => {
    const url = new URL(c.req.url);
    const segments = url.pathname.slice('/git/'.length).split('/');
    const teamId = segments[0] ?? '';
    const repoName = segments[1] ?? '';
    const rest = segments.slice(2).join('/');
    if (teamId !== ctx.team.id || repoName === '' || rest === '') {
      throw notFound('git endpoint');
    }
    const row = ctx.db
      .select()
      .from(project)
      .where(
        and(
          eq(project.teamId, teamId),
          eq(project.repoKind, 'hosted'),
          eq(project.repoName, repoName),
        ),
      )
      .get();
    if (!row?.repoName) throw notFound(`repo ${teamId}/${repoName}`);

    const method = c.req.method;
    if (method !== 'GET' && method !== 'POST') return c.body(null, 405);

    const authorization = c.req.header('authorization');
    const remoteUser =
      authorization === undefined ? undefined : verifyGitBasicAuth(ctx, authorization);
    if (remoteUser === undefined) {
      c.header('WWW-Authenticate', `Basic realm="${GIT_AUTH_REALM}"`);
      return c.json({ error: 'git authentication required' }, 401);
    }

    const body = method === 'POST' ? new Uint8Array(await c.req.arrayBuffer()) : new Uint8Array(0);
    const contentType = c.req.header('content-type');
    const cgi = await systemGitOps.httpBackend({
      projectRoot: join(ctx.reposDir, teamId),
      pathInfo: `/${row.repoName}.git/${rest}`, // repoName 取库行（slug 安全字符集）
      queryString: url.search.replace(/^\?/, ''),
      method,
      ...(contentType !== undefined ? { contentType } : {}),
      remoteUser,
      body,
    });
    return c.body(
      new Uint8Array(cgi.body),
      cgi.status as 200, // CGI Status 头透传（git 协议面 200/403/404 族）
      Object.fromEntries(cgi.headers),
    );
  });
}
