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
  assignmentSlotSchema,
  BRAND,
  type BuildRecord,
  buildSteerBodySchema,
  buildStepActionBodySchema,
  buildStopBodySchema,
  chiefSendMessageBodySchema,
  createAgentBodySchema,
  createBranchSyncBodySchema,
  createProjectBodySchema,
  createProviderBodySchema,
  createScheduleBodySchema,
  createTagBodySchema,
  createTodoBodySchema,
  type FsListResult,
  type FsPickResult,
  githubIssueEchoSchema,
  githubIssueStateSchema,
  githubIssuesResponseSchema,
  githubReposResponseSchema,
  importGithubIssueBodySchema,
  type MemoryRecord,
  PHASE_VALUES,
  patchAgentBodySchema,
  patchChiefBodySchema,
  patchMachineBodySchema,
  patchProviderBodySchema,
  phaseSchema,
  planRowSchema,
  SKILL_ENTRY_FILE,
  setSecretBodySchema,
  skillRecordSchema,
  startBuildsBodySchema,
  type TagRecord,
  type TeamMember,
  type TodoRecord,
  tokenUsageSchema,
} from '@pacman/shared';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import type { AppContext } from './context.js';
import {
  agent,
  agentMemory,
  apiKey,
  build,
  machine,
  message,
  notification,
  plan as planTable,
  project,
  provider,
  tag,
  todo,
  tokenUsage,
  whatsNew,
} from './db/schema.js';
import { sha256Hex } from './lib/crypto.js';
import { conflict, HttpError, notFound, parseWith } from './lib/errors.js';
import { systemGitOps } from './lib/git.js';
import { githubUserRepos } from './lib/github.js';
import { newRecordId, nowMs } from './lib/ids.js';
import { deleteAgent } from './services/agents.js';
import { createApiKey, listApiKeys } from './services/api-keys.js';
import {
  grantUpload as grantAttachmentUpload,
  uploadFile as uploadAttachmentFile,
} from './services/attachments.js';
import {
  createBranchSync,
  latestBranchSyncForBuild,
  type MachineSyncHub,
} from './services/branch-sync.js';
import {
  applyBuildStepAction,
  getBuild,
  listSteps,
  readSteerPending,
  requestMerge,
  requestStop,
  sendBuildSteer,
  startBuilds,
  toBuildRecord,
} from './services/builds.js';
import {
  chiefThreadMessages,
  getChiefEnvelope,
  getChiefThread,
  listChiefThreads,
  patchChief,
  sendChiefMessage,
} from './services/chief.js';
import { planDocumentDiff } from './services/documents.js';
import { createSerialConnection } from './services/events.js';
import { listDir } from './services/fs-list.js';
import { pickFolder } from './services/fs-pick.js';
import {
  isGithubRepoRef,
  provisionHostedRepo,
  readBranches,
  readBuildChangeFile,
  readBuildChanges,
  readCommitHistory,
  readFile,
  readTree,
  slugifyRepoName,
  toProjectRecord,
  uniqueRepoName,
  validateLocalRepoPath,
} from './services/git.js';
import {
  deleteGithubConnection,
  openGithubToken,
  readGithubConnectionStatus,
} from './services/github-connection.js';
import {
  type GithubIssueFaceDeps,
  importGithubIssue,
  listProjectGithubIssues,
  readSourceIssueEcho,
} from './services/github-issues.js';
import { isChiefConversation, toMachineRecord } from './services/machines.js';
import { handleMcpRequest } from './services/mcp-face.js';
import { listMcpServers } from './services/mcp-servers.js';
import {
  abortOAuthCallback,
  completeOAuthCallback,
  type OAuthDeps,
  OAuthFlowError,
  type OAuthStateKind,
  startGithubConnectionAuthorize,
  startOAuthAuthorize,
} from './services/oauth.js';
import { PhaseTransitionError } from './services/phase.js';
import { deleteProject } from './services/projects.js';
import {
  createProvider,
  deleteProvider,
  getModelSources,
  getProvidersEnvelope,
  updateProvider,
} from './services/providers.js';
import { createSchedule, deleteSchedule, listSchedules } from './services/schedules.js';
import { search } from './services/search.js';
import { createSecret, deleteSecret, listSecrets, updateSecret } from './services/secrets.js';
import {
  filterKnownSkillIds,
  listSkillFiles,
  readSkillFile,
  resolveLocalSkill,
  scanLocalSkills,
} from './services/skills.js';
import { seedFixedTags } from './services/tags.js';
import {
  createTodo,
  deleteTodo,
  getTodo,
  listTodos,
  retrySelfIssueCreate,
  updateTodo,
} from './services/todos.js';

/** 会话 cookie 名 [设计]（01 §4.2：httpOnly cookie 自设；品牌槽已随 D3 切换，#109，
 * 单源 = shared BRAND.sessionCookieName）。 */
export const SESSION_COOKIE = BRAND.sessionCookieName;

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

/** GET projects/{id}/github/issues query 闸（#446）：state 值域 = shared
 * githubIssueStateSchema 单源（缺省 open）；page  coercion 正整数（非法 →
 * 400，不出站）。 */
const githubIssuesQuerySchema = z.object({
  state: githubIssueStateSchema,
  page: z.coerce.number().int().min(1),
});

/** tag 行 → record 全形（r9 §3.4 实测 wire 六位；显式投影防列面扩张外溢）。 */
function toTagRecord(row: typeof tag.$inferSelect): TagRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    color: row.color,
    createdAt: row.createdAt,
    v: row.v,
  };
}

/** PATCH /api/todos/{id} body——update_todo 面 [推断]（02 §6.1 PATCH 面未
 * 抓取；字段 = todo record 可写子集，wire 补采后收紧，04 附录 A）。 */
const patchTodoBodySchema = z.object({
  title: z.string().optional(),
  spec: z.string().optional(),
  phase: phaseSchema.optional(),
  tagIds: z.array(z.string()).optional(),
  orderIndex: z.number().optional(),
  // 指派双槽（#208「编辑分配」）：槽位词表复用 shared assignmentSlotSchema
  // （02 §6.2）；槽级 optional = 槽级 merge，未提供的槽保持现状。
  assignment: z
    .object({
      plan: assignmentSlotSchema.optional(),
      build: assignmentSlotSchema.optional(),
    })
    .optional(),
});

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

function requireAgentRow(ctx: AppContext, teamId: string, agentId: string) {
  const row = ctx.db
    .select()
    .from(agent)
    .where(and(eq(agent.id, agentId), eq(agent.teamId, teamId)))
    .get();
  if (!row) throw notFound(`agent ${agentId}`);
  return row;
}

// agent.mcpServers[] = 本机 config 键名（spec 13/#368）：写入不做存在性校验
// ——未知键静默容忍（勾选与 ~/.claude.json 漂移、多机各读各 config 的竞态），
// 执行 daemon 解析时跳过并落降级行。

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

function toMemoryRecord(row: typeof agentMemory.$inferSelect): MemoryRecord {
  return {
    id: row.id,
    agentId: row.agentId,
    teamId: row.teamId,
    title: row.title,
    content: row.content,
    projectId: row.projectId,
    sourceTodoId: row.sourceTodoId,
    sourceBuildId: row.sourceBuildId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
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
  // box/githubFetch（#452 写向）：createTodo 收口的自建 issue 出站 deps——
  // 三条创建路径（web 路由 / chief 工具 / MCP face）同律透传。
  const svc = {
    db: ctx.db,
    hub: ctx.hub,
    machineHub: ctx.machineHub,
    user: ctx.user,
    convHub: ctx.convHub,
    // #511 审核关口材料：变更面计算位（与人的变更面同源）
    reposDir: ctx.reposDir,
    box: ctx.secretBox,
    ...(ctx.githubFetch !== undefined ? { githubFetch: ctx.githubFetch } : {}),
  };

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
    return c.json(tags.map(toTagRecord));
  });

  // POST /api/projects/{id}/tags（#309，r9 §3.4 实测 wire：body {name,color}
  // → 201 全 record。color 客户端缺省 #6366f1（TAG_DEFAULT_COLOR），server
  // 不产色。tag 无 PATCH/DELETE 观测面——删除/管理面归项目设置「标签」tab
  // （r9 §3.4，REST 直删 404 实测，不在本票垂直切片）。
  app.post('/api/projects/:id/tags', async (c) => {
    const row = requireProject(ctx, c.req.param('id'));
    const body = parseWith(createTagBodySchema, await jsonBody(c), 'body');
    const id = newRecordId();
    ctx.db
      .insert(tag)
      .values({
        id,
        projectId: row.id,
        name: body.name,
        color: body.color,
        createdAt: nowMs(),
        v: 1,
      })
      .run();
    const created = ctx.db.select().from(tag).where(eq(tag.id, id)).get();
    if (!created) throw new Error(`tag ${id} missing after insert`);
    return c.json(toTagRecord(created), 201); // 响应封套 = record 全形（r9 实测）
  });

  // —— GitHub issue 读面（#446 / ADR 0005 读向；自有设计面，02 §6.1 词表外
  // = wire.test INFERRED_ROUTES 入位）。只读，不在 GitHub 留痕迹（写向 =
  // ADR 0006 另票）；token 纪律 = repos 代理同族（openGithubToken 唯一读出
  // 点，Authorization 头唯一消费位）。形态/连接闸与错误语义归
  // services/github-issues.ts。封套单源 = shared githubIssuesResponseSchema。
  /** issue 读面 deps 装配（oauthDeps 同式）：githubFetch 注入位收窄到
   * 服务面，两端点共用。 */
  const githubIssueDeps = (): GithubIssueFaceDeps => ({
    db: ctx.db,
    box: ctx.secretBox,
    ...(ctx.githubFetch !== undefined ? { githubFetch: ctx.githubFetch } : {}),
  });

  app.get('/api/projects/:id/github/issues', async (c) => {
    const row = requireProject(ctx, c.req.param('id'));
    const query = parseWith(
      githubIssuesQuerySchema,
      {
        state: c.req.query('state') ?? 'open',
        page: c.req.query('page') ?? '1',
      },
      'query',
    );
    const face = await listProjectGithubIssues(githubIssueDeps(), row, {
      state: query.state,
      page: query.page,
    });
    return c.json(githubIssuesResponseSchema.parse(face));
  });

  // 从 issue 建任务（#446）：现拉 issue 详情 + 镜像同步仓库 label 集 →
  // createTodo（标题原样 / 正文 = body / 多标签 / 来源两列）。201 全
  // TodoRecord（POST todos 面同律）。
  app.post('/api/projects/:id/github/issues/import', async (c) => {
    const row = requireProject(ctx, c.req.param('id'));
    const body = parseWith(importGithubIssueBodySchema, await jsonBody(c), 'body');
    const record = await importGithubIssue({ ...svc, ...githubIssueDeps() }, row, body.number);
    return c.json(record, 201);
  });

  // —— GitHub 写向（#452 / ADR 0006）：来源 issue 只读回显 + 未建成重试 ——
  // 回显（D5/D6）：详情页进入时拉一次；任何拉不到 = 非 200（web 整行隐藏，
  // 不显示陈旧值不弹错）。重试（D2）：未建成 → 同步建站补来源；已建成/在飞
  // → 409（不双建）。封套单源 = shared githubIssueEchoSchema。
  app.get('/api/todos/:id/github-issue', async (c) => {
    const echo = await readSourceIssueEcho(githubIssueDeps(), c.req.param('id'));
    return c.json(githubIssueEchoSchema.parse(echo));
  });

  app.post('/api/todos/:id/github-issue/retry', async (c) => {
    const record = await retrySelfIssueCreate(svc, c.req.param('id'));
    return c.json(record);
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

  // commits 读面（#149 文件|历史 分段「历史」；[推断] 路由，wire.test
  // INFERRED_ROUTES 登记——r2 07e/24 分段 UI 证据、wire 未采）。
  app.get('/api/projects/:id/commits', async (c) => {
    const row = requireProject(ctx, c.req.param('id'));
    return c.json(await readCommitHistory(ctx, row.id, c.req.query('ref')));
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
    // chief 会话（conv id = `chief-<threadId>`，r5 §3.6）→ chief_message + 线程
    // activeRun；worker 会话 → message 表。
    if (isChiefConversation(conversationId)) {
      const thread = getChiefThread(svc, conversationId);
      if (!thread) throw notFound(`conversation ${conversationId}`);
      const rows = chiefThreadMessages(ctx.db, conversationId);
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
        activeRun: thread.activeRun,
        nextCursor: null,
      });
    }
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
      // W3 #278：build 会话分支透出单槽 pending 内容（数组形封套观测位）。
      steerPending: readSteerPending(ctx.db, conversationId),
      activeRun: null,
      nextCursor: null,
    });
  });

  // —— SSE conversation stream（02 §1.2 会话流，词表内；r3 §3.5 抓包见请求，
  // 逐事件载荷未枚举 = pi 流词表承载 [推断]，事件面单源 = shared
  // conversationStreamEventSchema 定型四事件 ping/message/text_delta/step）。
  // 订阅不存在的会话合法（空流 + ping；build 首启前详情页即挂流的时序面）。
  app.get('/api/conversations/:id/stream', (c) => {
    const conversationId = c.req.param('id');
    return streamSSE(c, async (stream) => {
      const conn = createSerialConnection((payload) =>
        stream.writeSSE({ data: JSON.stringify(payload) }),
      );
      const unsubscribe = ctx.convHub?.subscribe(conversationId, conn) ?? (() => {});
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
      await conn.send({ type: 'ping', seq: conn.nextSeq() }); // 连接即首帧 ping
      await held;
    });
  });

  // —— 附件面（#310，r9 §3.1/§4 三步 wire：grant → upload → content 内嵌
  // `attachment:<key>`）。grant 端返回 uploadUrl + HMAC 签名 token；upload 端
  // 验签 + 写盘 + DB 状态 ready；read 端供详情页/工具面拉原始字节。—————————————

  const grantBodySchema = z.object({
    kind: z.literal('attachment'),
    fileName: z.string(),
    mimeType: z.string(),
    size: z.number().int().positive(),
    scope: z.enum(['spec', 'message']).optional(),
  });

  app.post('/api/uploads/grant', async (c) => {
    const body = parseWith(grantBodySchema, await jsonBody(c), 'body');
    const out = grantAttachmentUpload(
      {
        db: ctx.db,
        secretBox: ctx.secretBox,
        attachmentsDir: ctx.attachmentsDir,
        userId: ctx.user.id,
        teamId: ctx.team.id,
      },
      {
        fileName: body.fileName,
        mimeType: body.mimeType,
        size: body.size,
        scope: body.scope ?? 'message',
      },
    );
    return c.json(out, 200);
  });

  app.post('/api/uploads/upload', async (c) => {
    const form = await c.req.formData();
    const grant = form.get('grant');
    const file = form.get('file');
    if (typeof grant !== 'string' || grant === '') {
      throw new HttpError(401, 'grant missing');
    }
    if (!(file instanceof File)) {
      throw new HttpError(400, 'file missing');
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const out = uploadAttachmentFile(
      {
        db: ctx.db,
        secretBox: ctx.secretBox,
        attachmentsDir: ctx.attachmentsDir,
        userId: ctx.user.id,
        teamId: ctx.team.id,
      },
      {
        grant,
        fileBytes: bytes,
        fileMimeType: file.type || 'application/octet-stream',
        fileName: file.name || '',
      },
    );
    return c.json(out, 201);
  });

  app.get('/api/attachments/:id', async (c) => {
    const id = c.req.param('id');
    const { readAttachment } = await import('./services/attachments.js');
    const { row, absPath } = readAttachment(
      {
        db: ctx.db,
        secretBox: ctx.secretBox,
        attachmentsDir: ctx.attachmentsDir,
        userId: ctx.user.id,
        teamId: ctx.team.id,
      },
      id,
    );
    const { readFileSync } = await import('node:fs');
    const bytes = readFileSync(absPath);
    return new Response(bytes, {
      status: 200,
      headers: {
        'content-type': row.mimeType,
        'content-length': String(row.sizeBytes),
        'cache-control': 'private, max-age=300',
      },
    });
  });

  // —— Chief 面（02 §4.3/r5 §2–§3；M4a）———————————————————————————————
  // GET/PATCH /chief、GET /chief/threads = 02 §6.1 词表内；POST /chief/threads
  // 与 POST /conversations/{id}/messages（发消息触发回合）= REST 同名 [推断]
  // （r5 §3.6 发送 wire 未采；登记 test/wire.test.ts INFERRED_ROUTES）。
  app.get('/api/teams/:id/chief', (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    return c.json(getChiefEnvelope(svc, teamId));
  });

  app.patch('/api/teams/:id/chief', async (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    const body = parseWith(patchChiefBodySchema, await jsonBody(c), 'body');
    // 绑定 Agent = PATCH agent 槽（记忆不迁移：无迁移动作，共用绑定 Agent 存储，
    // r5 §2）；charter 槽 = 章程保存 [推断]。二次确认告示 canon = shared
    // CHIEF_REBIND_CONFIRM_COPY（web 面渲染）。
    return c.json(patchChief(svc, teamId, body));
  });

  app.get('/api/teams/:id/chief/threads', (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    return c.json(listChiefThreads(svc, teamId));
  });

  // 新主题 = POST /chief/threads body {content}（REST 同名 [推断]）：建线程 +
  // 首条用户消息 + 入队 chief 回合步（机器 claim → pi 会话 + remoteTools relay）。
  app.post('/api/teams/:id/chief/threads', async (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    const body = parseWith(
      chiefSendMessageBodySchema,
      { threadId: null, content: ((await jsonBody(c)) as { content?: unknown })?.content },
      'body',
    );
    const result = sendChiefMessage(svc, teamId, body);
    // 会话流即时推送（chief 会话 = chief-<threadId> 键，M5 live 面）。
    ctx.convHub?.publishMessage(result.thread.id, { ...result.message });
    return c.json(result, 201);
  });

  // 既有线程续消息 = POST /conversations/{id}/messages（REST 同名 [推断]）。
  // 分流（W3 #278，06 册 D9）：chief 会话（id = chief-<threadId>）= 现行为
  // （入队 chief 回合步）；build 会话 = steer 语义（运行中补话：claimed 步门
  // + 单槽 pending + machine 拉取-确认投递，spec #277）。
  app.post('/api/conversations/:id/messages', async (c) => {
    const conversationId = c.req.param('id');
    if (!isChiefConversation(conversationId)) {
      const body = parseWith(buildSteerBodySchema, await jsonBody(c), 'body');
      const result = sendBuildSteer(svc, conversationId, body);
      // 会话流即时推送（与 chief 分支同形：用户行立即上屏）。
      ctx.convHub?.publishMessage(conversationId, { ...result.message });
      return c.json(result, 201);
    }
    const raw = (await jsonBody(c)) as { content?: unknown };
    const thread = getChiefThread(svc, conversationId);
    if (!thread) throw notFound(`conversation ${conversationId}`);
    const body = parseWith(
      chiefSendMessageBodySchema,
      { threadId: conversationId, content: raw?.content },
      'body',
    );
    const result = sendChiefMessage(svc, thread.teamId, body);
    ctx.convHub?.publishMessage(conversationId, { ...result.message });
    return c.json(result, 201);
  });

  // —— 记忆读面（02 §4.4/r5 §6：GET agents/{aid}/memories 词表内）————————————
  app.get('/api/teams/:id/agents/:aid/memories', (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    const agentId = c.req.param('aid');
    const rows = ctx.db
      .select()
      .from(agentMemory)
      .where(and(eq(agentMemory.agentId, agentId), eq(agentMemory.teamId, teamId)))
      .all();
    return c.json(rows.map(toMemoryRecord));
  });

  // 记忆删除面（02 §4.4「列表/删除 API 保形」；条目卡删除图标 r5 §6 UI 实测，
  // DELETE 同名 [推断]，02 §6.1 规则族 + DELETE_FACE 登记）。
  app.delete('/api/teams/:id/agents/:aid/memories/:mid', (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    const res = ctx.db
      .delete(agentMemory)
      .where(
        and(
          eq(agentMemory.id, c.req.param('mid')),
          eq(agentMemory.agentId, c.req.param('aid')),
          eq(agentMemory.teamId, teamId),
        ),
      )
      .run();
    if (res.changes === 0) throw notFound(`memory ${c.req.param('mid')}`);
    return c.body(null, 204);
  });

  // —— Agent 面（r3 §4/r5 §1：POST → 201 {id}、GET 单条词表内；PATCH 同名
  // [推断]——per-Agent mcpServers[] 授权勾选（02 §7.1「授权在每个 Agent 的
  // 页面上单独进行」）+ 配置面编辑走此路径）———————————————————————————————
  app.post('/api/teams/:id/agents', async (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    const body = parseWith(createAgentBodySchema, await jsonBody(c), 'body');
    const id = newRecordId();
    ctx.db
      .insert(agent)
      .values({
        id,
        teamId,
        displayName: body.displayName,
        description: body.description ?? null,
        status: 'active',
        avatarUrl: null,
        provider: body.provider ?? null,
        modelId: body.modelId ?? null,
        thinkingLevel: body.thinkingLevel ?? null,
        tools: body.tools ?? [],
        secrets: body.secrets ?? [],
        // spec 13 #367：skills[] 校验源 = 本地现扫存在性；未知 id 静默跳过
        // （目录删除后死引用不留，不报错）。
        skills: filterKnownSkillIds(ctx.skillsDir, body.skills ?? []),
        mcpServers: body.mcpServers ?? [],
      })
      .run();
    return c.json({ id }, 201); // r5 §1/§8 补录：创建 → 201 {id}
  });

  app.get('/api/teams/:id/agents/:aid', (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    const row = requireAgentRow(ctx, teamId, c.req.param('aid'));
    return c.json(agentRecordOf(row));
  });

  app.patch('/api/teams/:id/agents/:aid', async (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    const row = requireAgentRow(ctx, teamId, c.req.param('aid'));
    const body = parseWith(patchAgentBodySchema, await jsonBody(c), 'body');
    const sets: Partial<typeof row> = {};
    // spec 13 #367：skills[] 与 create 同律——现扫存在性过滤，未知 id 静默跳过。
    if (body.skills !== undefined) {
      sets.skills = filterKnownSkillIds(ctx.skillsDir, body.skills);
    }
    for (const key of [
      'displayName',
      'description',
      'provider',
      'modelId',
      'thinkingLevel',
      'tools',
      'secrets',
      'mcpServers',
    ] as const) {
      if (body[key] !== undefined) {
        // null 语义：可空列显式清空（description/provider/modelId/thinkingLevel）。
        sets[key] = (body[key] === null ? null : body[key]) as never;
      }
    }
    if (Object.keys(sets).length > 0) {
      ctx.db.update(agent).set(sets).where(eq(agent.id, row.id)).run();
    }
    const updated = requireAgentRow(ctx, teamId, row.id);
    return c.json(agentRecordOf(updated));
  });

  // Agent 删除面（XMON-19 / B2）：删除入口与二次确认文案直读原版产线 bundle
  // （agent_modal.remove/remove_title/remove_confirm/remove_over_quota 四语
  // 语料），删除语义直读 todos.dev 官方 docs——canon 出处与关联面三件取舍
  // （memories 不级联 / assignment 摘槽 / chief 摘绑定）的完整论证在
  // services/agents.ts，此处不再复述。路由 = REST 同名 DELETE（02 §6.1 规则族
  // + DELETE_FACE），wire 未采——登记 wire.test.ts INFERRED_ROUTES。
  app.delete('/api/teams/:id/agents/:aid', (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    const agentId = c.req.param('aid');
    if (!deleteAgent({ db: ctx.db }, teamId, agentId)) throw notFound(`agent ${agentId}`);
    return c.body(null, 204);
  });

  // —— 团队 MCP server 读面（spec 13/#368 本地 config 只读制：数据源 =
  // server 本机 ~/.claude.json 投影；管理写面 POST/PATCH/DELETE 已随登记制
  // 删除——配置变更 = 直接编辑 config 文件）—————————————————————————
  app.get('/api/teams/:id/mcp-servers', (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    return c.json(listMcpServers({ mcpConfigPath: ctx.mcpConfigPath }, teamId));
  });

  // —— plan.md 版本文档 diff（02 §4.2/r5 §4：documents/{id}/diff 词表内）——————
  app.get('/api/documents/:id/diff', (c) => {
    const against = c.req.query('againstVersion');
    const diff = planDocumentDiff(
      ctx.db,
      c.req.param('id'),
      against !== undefined && against !== '' ? Number(against) : undefined,
    );
    return c.json(diff);
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
    // body 单源 = shared createProjectBodySchema（spec 12 数据契约面 kind /
    // localPath / githubRepo{owner,repo} + 既有 wire 面 repoKind / githubRepo
    // 字符串；双名并存 kind 优先，皆缺 = 无 repo 普通项目）。
    const body = parseWith(createProjectBodySchema, await jsonBody(c), 'body');
    const teamId = body.teamId ?? ctx.team.id;
    requireTeam(ctx, teamId);
    const kind = body.kind ?? body.repoKind;
    let githubRepo: string | null = null;
    if (kind === 'github') {
      // 双面归一（对象面 = picker 回填，字符串面 = 手动兜底）→ 同一 400 闸。
      const ref =
        typeof body.githubRepo === 'string'
          ? body.githubRepo
          : body.githubRepo
            ? `${body.githubRepo.owner}/${body.githubRepo.repo}`
            : undefined;
      if (ref === undefined || !isGithubRepoRef(ref)) {
        throw new HttpError(400, 'invalid body at githubRepo: expected "owner/repo"');
      }
      githubRepo = ref;
    }
    // local 形态：localPath 三态校验 400 闸（services/git.ts，spec 12 / #359）。
    const localPath = kind === 'local' ? await validateLocalRepoPath(body.localPath) : null;
    const id = newRecordId();
    let repoName: string | null = null;
    if (kind === 'hosted') {
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
        repoKind: kind ?? null,
        repoName,
        githubRepo,
        localPath,
      })
      .run();
    // spec 15 #394：固定标签词表随项目播种（ADR 0002 D4；幂等，chief
    // create_project 面同调）。github 形态跳过——词表 = 仓库 label 镜像
    // （#446 / ADR 0005 D2，导入面现拉同步），6 词播种会污染真值。
    if (kind !== 'github') seedFixedTags(ctx.db, id);
    const row = requireProject(ctx, id);
    return c.json(toProjectRecord(row, requestOrigin(c)), 201);
  });

  // POST /api/fs/pick（ADR 0003 / #440）：server 代弹 macOS 原生选文件夹
  // 对话框（浏览器拿不到绝对路径，只能目标机进程代弹）。200 {path} = 选中；
  // 200 {path:null} = 用户取消（正常结局非错误面）；422 unavailable / 409
  // busy 带 reason（词汇单源 = shared FS_PICK_ERROR_REASONS，#386 模式）。
  app.post('/api/fs/pick', async (c) => {
    const path = await pickFolder();
    return c.json({ path } satisfies FsPickResult);
  });

  // GET /api/fs/list（ADR 0003 D5/D6 / #441）：应用内目录浏览数据源——
  // remote/headless 形态下 fs/pick 422 unavailable 的兜底浏览器。只列目录 +
  // git 提示标记 + 容量闸；dir 缺省/空串 = server $HOME 起点；400 带 reason
  // （词汇单源 = shared FS_LIST_ERROR_REASONS，#386 模式）。
  app.get('/api/fs/list', (c) => {
    const result = listDir(c.req.query('dir'));
    return c.json(result satisfies FsListResult);
  });

  app.post('/api/projects/:id/todos', async (c) => {
    const row = requireProject(ctx, c.req.param('id'));
    const body = parseWith(createTodoBodySchema, await jsonBody(c), 'body');
    const record = createTodo(svc, {
      teamId: row.teamId,
      projectId: row.id,
      title: body.title,
      spec: body.spec,
      ...(body.tagIds !== undefined ? { tagIds: body.tagIds } : {}),
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

  // —— build 分支对话框「同步到机器」（M7 #319，08 册附录 B）———————————————
  // 创建同步：web → server 写 pending 行 + 推 machine wire sync 事件 +
  // 推 team stream branch_sync 事件；machine wire 派发失败（机器 stream 断连
  // 中间态）= 路由层 409 + 结果卡显示 failed（services/branch-sync.ts 落账）。
  // 响应 = 全 branch_sync 行，载荷形 wire = shared branchSyncRecordSchema 单源。
  // build → teamId 经 todo 行投影（build record 无 teamId 列，02 §6.2
  // 字段表不含——投影必经 todo）；cloneUrl 经 todo → project → repoKind 双形态
  // 分流（hosted = server 端 bare clone URL；github = github.com/<owner>/<repo>.git）。
  app.post('/api/builds/:id/branch-sync', async (c) => {
    const buildId = c.req.param('id');
    const buildRow = getBuild(svc, buildId);
    if (!buildRow) throw notFound(`build ${buildId}`);
    const todoRow = ctx.db
      .select({ teamId: todo.teamId, projectId: todo.projectId })
      .from(todo)
      .where(eq(todo.id, buildRow.todoId))
      .get();
    if (!todoRow) throw notFound(`todo ${buildRow.todoId}`);
    let cloneUrl: string | null = null;
    let projectId: string | null = null;
    if (todoRow.projectId !== null) {
      const projRow = ctx.db.select().from(project).where(eq(project.id, todoRow.projectId)).get();
      if (projRow) {
        projectId = projRow.id;
        const origin = requestOrigin(c);
        if (projRow.repoKind === 'hosted' && projRow.repoName !== null) {
          cloneUrl = `${origin}/git/${todoRow.teamId}/${projRow.repoName}`;
        } else if (projRow.repoKind === 'github' && projRow.githubRepo !== null) {
          cloneUrl = `https://github.com/${projRow.githubRepo}.git`;
        }
      }
    }
    const body = parseWith(createBranchSyncBodySchema, await jsonBody(c), 'body');
    const record = createBranchSync(
      {
        db: ctx.db,
        hub: ctx.hub,
        // MachineWakeHub 实现了 MachineSyncHub 接口（同进程内 cast 安全）。
        machineHub: ctx.machineHub as unknown as MachineSyncHub,
      },
      {
        buildId,
        machineId: body.machineId,
        teamId: todoRow.teamId,
        projectId,
        cloneUrl,
        directory: body.directory,
        ref: body.ref,
        commit: body.commit,
        force: body.force,
      },
    );
    return c.json(record, 201);
  });

  // 查 build 最新一次 sync：web 端结果卡初屏数据源（订阅失败/SSE 错位时兜底
  // 重取，02 §1.2/§1.3 双保险）。无 sync 行 = null（前端不显示结果卡）。
  app.get('/api/builds/:id/branch-sync', (c) => {
    const buildId = c.req.param('id');
    if (!getBuild(svc, buildId)) throw notFound(`build ${buildId}`);
    return c.json(latestBranchSyncForBuild({ db: ctx.db }, buildId));
  });

  app.post('/api/builds/:id/steps', async (c) => {
    const body = parseWith(buildStepActionBodySchema, await jsonBody(c), 'body');
    try {
      // await 必须在位：审核关口的材料组装要读变更面（git 面异步），异常
      // 经 Promise 拒绝上浮——不 await 会让 409/404 变成未处理拒绝。
      await applyBuildStepAction(svc, c.req.param('id'), body);
    } catch (err) {
      if (err instanceof PhaseTransitionError) throw conflict(err.message);
      throw err;
    }
    // 响应封套 [推断]：入队即委派语义（与 merge 同族 202；wire 未采）。
    return c.json({ delegated: true }, 202);
  });

  // 停止钮（M7 #308，r9 §3.3；[设计] builds 族路径——原站 stop wire 未采，
  // r9 §5）：claimed 步 = 委派机器信号 202；pending 步 = server 即时取消 200。
  app.post('/api/builds/:id/stop', async (c) => {
    const body = parseWith(buildStopBodySchema, await jsonBody(c), 'body');
    const result = requestStop(svc, c.req.param('id'), body);
    return c.json(result, result.delegated ? 202 : 200);
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
  // 删项目（#189 删除区复活前置）：级联语义单源 = services/projects.ts 头注；
  // 危险操作区删除流 UI 证据 r2 24c，wire 未采（INFERRED_ROUTES 登记）。
  app.delete('/api/projects/:id', (c) => {
    const id = c.req.param('id');
    if (!deleteProject({ db: ctx.db, reposDir: ctx.reposDir }, id)) {
      throw notFound(`project ${id}`);
    }
    return c.body(null, 204);
  });

  app.patch('/api/todos/:id', async (c) => {
    const id = c.req.param('id');
    const body = parseWith(patchTodoBodySchema, await jsonBody(c), 'body');
    let record: TodoRecord | null;
    try {
      // #160：HTTP PATCH phase = 看板拖拽手动改相面（六列 dropPhase 目标
      // 放行漏斗非法边）；系统流不经本路由，漏斗不变。
      record = updateTodo(svc, id, body, { manualPhase: true });
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

  // —— M5 词表补齐面（02 §6.1 canonical 词表内、此前未实现的 GET 族；响应
  // 封套 wire 未采处 = [推断] 投影，04 §3 不判负口径，wire.test 登记）——————

  app.get('/api/teams/:id/machines', (c) => {
    const id = c.req.param('id');
    requireTeam(ctx, id);
    const rows = ctx.db.select().from(machine).where(eq(machine.teamId, id)).all();
    return c.json(rows.map((r) => toMachineRecord(r)));
  });

  // per-runtime 开关写回（spec 11 A8/A9，#357）：enabledRuntimes 全量替换；
  // 词表外 runtime = 400（shared patchMachineBodySchema 钉 MACHINE_RUNTIMES）。
  app.patch('/api/machines/:id', async (c) => {
    const id = c.req.param('id');
    const row = ctx.db.select().from(machine).where(eq(machine.id, id)).get();
    if (!row) throw notFound(`machine ${id}`);
    requireTeam(ctx, row.teamId);
    const body = parseWith(patchMachineBodySchema, await jsonBody(c), 'body');
    ctx.db
      .update(machine)
      .set({ enabledRuntimes: body.enabledRuntimes })
      .where(eq(machine.id, id))
      .run();
    const updated = ctx.db.select().from(machine).where(eq(machine.id, id)).get();
    if (!updated) throw notFound(`machine ${id}`);
    return c.json(toMachineRecord(updated));
  });

  // 模型选项面（02 §6.2「model = Provider 下的具名可选项」；provider.models
  // JSON 列聚合投影 [推断]——wire 未采，配置面下拉/Agent 模型槽数据源）。
  app.get('/api/teams/:id/models', (c) => {
    const id = c.req.param('id');
    requireTeam(ctx, id);
    const rows = ctx.db.select().from(provider).where(eq(provider.teamId, id)).all();
    const models = rows.flatMap((r) =>
      r.models.map((m) => ({ ...m, providerId: r.providerId, providerLabel: r.label })),
    );
    return c.json(models);
  });

  // 进度面（词表内；载荷未采 [推断] = todo 计数按 phase 投影，用量/进度屏
  // 数据源，02 §6.1）。
  app.get('/api/teams/:id/progress', (c) => {
    const id = c.req.param('id');
    requireTeam(ctx, id);
    const rows = ctx.db.select({ phase: todo.phase }).from(todo).where(eq(todo.teamId, id)).all();
    const byPhase: Record<string, number> = Object.fromEntries(PHASE_VALUES.map((p) => [p, 0]));
    for (const r of rows) byPhase[r.phase] = (byPhase[r.phase] ?? 0) + 1;
    return c.json({ todos: { total: rows.length, byPhase } });
  });

  // —— 技能面（spec 13 #367：本地目录现扫只读投影，不入库无缓存；词表内
  // GET /api/skills?teamId=、GET teams/{id}/skills/{sid}(+/file?fileName=)；
  // record = shared skillRecordSchema 保形，id = frontmatter name 回落目录名，
  // teamId = 请求 team 占位。写面（POST 上传 / GitHub scan）已删——
  // NON_REPLICATED_ENDPOINTS 登记 divergence）————————————————————
  app.get('/api/skills', (c) => {
    const teamId = c.req.query('teamId') ?? ctx.team.id;
    requireTeam(ctx, teamId);
    return c.json(
      scanLocalSkills(ctx.skillsDir).map((s) =>
        skillRecordSchema.parse({
          id: s.id,
          teamId,
          name: s.name,
          description: s.description,
        }),
      ),
    );
  });

  app.get('/api/teams/:id/skills/:sid', (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    const resolved = resolveLocalSkill(ctx.skillsDir, c.req.param('sid'));
    if (!resolved) throw notFound(`skill ${c.req.param('sid')}`);
    // 封套 [推断]：record + 文件名清单（内容经 /file 逐文件取，01 §6；
    // 清单 = 磁盘递归相对路径，spec 13 换源）。
    return c.json({
      ...skillRecordSchema.parse({
        id: resolved.skill.id,
        teamId,
        name: resolved.skill.name,
        description: resolved.skill.description,
      }),
      fileNames: listSkillFiles(resolved.dir),
    });
  });

  app.get('/api/teams/:id/skills/:sid/file', (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    const resolved = resolveLocalSkill(ctx.skillsDir, c.req.param('sid'));
    if (!resolved) throw notFound(`skill ${c.req.param('sid')}`);
    const fileName = c.req.query('fileName') ?? SKILL_ENTRY_FILE;
    const content = readSkillFile(resolved.dir, fileName); // 逃逸/缺位 = null
    if (content === null) throw notFound(`file ${fileName}`);
    return c.json({ fileName, content }); // 封套 [推断]；文本投影
  });

  // Agent 任务面（词表内；载荷未采 [推断] = assignment 双槽任一指向该 Agent
  // 的 todo 集，r3 §4 Agent 详情「任务」tab 数据源）。
  app.get('/api/teams/:id/agents/:aid/tasks', (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    const agentId = c.req.param('aid');
    const rows = ctx.db.select().from(todo).where(eq(todo.teamId, teamId)).all();
    const assigned = rows.filter(
      (r) => r.assignment?.plan?.agentId === agentId || r.assignment?.build?.agentId === agentId,
    );
    return c.json(assigned.map((r) => getTodo(svc, r.id)).filter((r) => r !== null));
  });

  // whats-new（词表内：形状保留、内容自选，02 §6.1 [设计]——记录 = whats_new
  // 表 body JSON 行）。
  app.get('/api/whats-new', (c) => {
    const rows = ctx.db.select().from(whatsNew).all();
    return c.json(rows.map((r) => ({ id: r.id, createdAt: r.createdAt, ...r.body })));
  });

  // —— [推断] build 详情读面（M5 详情页 overlay 数据源；wire 未采，路径 =
  // builds/{id}/… REST 同族规则，wire.test INFERRED_ROUTES 登记）：
  // plans = 版本集 + plan.md 内容（版本下拉/文档 pane，r5 §4 触点）；
  // changes = conv 分支 vs 默认分支文件级 diff（变更 pane，r7 27 触点）；
  // usage = build × model 四维记账（Token 用量 dialog，r3 §3.8/r7 30 触点）。
  app.get('/api/builds/:id/plans', (c) => {
    const id = c.req.param('id');
    if (!getBuild(svc, id)) throw notFound(`build ${id}`);
    const rows = ctx.db
      .select()
      .from(planTable)
      .where(eq(planTable.buildId, id))
      .orderBy(asc(planTable.version))
      .all();
    // 行形单源 = shared planRowSchema（record + content 透出 [推断] 封套）。
    return c.json(
      rows.map((r) =>
        planRowSchema.parse({
          id: r.id,
          buildId: r.buildId,
          version: r.version,
          createdAt: r.createdAt,
          content: r.content,
        }),
      ),
    );
  });

  app.get('/api/builds/:id/changes', async (c) =>
    c.json(await readBuildChanges({ db: ctx.db, reposDir: ctx.reposDir }, c.req.param('id'))),
  );

  // changes/file = conv 分支头单文件全文按需取（#224；docpane「显示完整文件」
  // 数据源，web 接线 #225）——独立端点，changes 列表面不被全文撑爆。
  app.get('/api/builds/:id/changes/file', async (c) => {
    const path = c.req.query('path');
    if (path === undefined || path === '') {
      throw new HttpError(400, 'invalid query path: required');
    }
    return c.json(
      await readBuildChangeFile({ db: ctx.db, reposDir: ctx.reposDir }, c.req.param('id'), path),
    );
  });

  app.get('/api/builds/:id/usage', (c) => {
    const id = c.req.param('id');
    if (!getBuild(svc, id)) throw notFound(`build ${id}`);
    const rows = ctx.db.select().from(tokenUsage).where(eq(tokenUsage.buildId, id)).all();
    return c.json(rows.map((r) => tokenUsageSchema.parse(r)));
  });

  // —— 埋点空实现（词表内「形状保留、可空实现」，02 §6.1：analytics/first-touch
  // + PostHog 风格 batch track；复刻无埋点后端，204 收下即弃）——————————
  app.post('/api/analytics/first-touch', () => new Response(null, { status: 204 }));
  app.post('/_mp/api/track', () => new Response(null, { status: 204 }));

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

  // model-sources 面（spec 11 数据契约，#356）：providers 页 runtime tabs
  // 真值——pi = custom providers models[] 投影；claude-code = server fs
  // 直读本机 ~/.claude/settings.json（每次 GET 重读，实时语义）。
  app.get('/api/teams/:id/model-sources', (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    return c.json(getModelSources(keysvc, teamId));
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

  // —— OAuth 握手面（#231，[设计] 面：todos.dev 此面 wire 未采；词表登记 =
  // shared WEB_REST_ENDPOINTS，族表 = OAUTH_FAMILIES）。token 密封落
  // provider.apiKeyCipher（02 §8 只写不读）；callback 302 回 providers 页，
  // 结果经 ?oauth=connected|error 查询参传递——token 永不进 redirect。
  const oauthDeps = (): OAuthDeps => ({
    db: ctx.db,
    box: ctx.secretBox,
    states: ctx.oauthStates,
    fetch: ctx.oauthFetch ?? globalThis.fetch,
    client: ctx.oauthClient,
  });

  app.post('/api/teams/:id/providers/oauth/:preset/authorize', (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    // returnOrigin = 浏览器 origin（vite proxy 下同源经 /api 转发，Origin 头
    // 原样透传）；裸 API 形态缺 Origin 时回退请求自身 origin。
    const origin = c.req.header('origin') ?? new URL(c.req.url).origin;
    try {
      const { authorizationUrl } = startOAuthAuthorize(oauthDeps(), {
        teamId,
        presetId: c.req.param('preset'),
        origin,
      });
      return c.json({ authorizationUrl });
    } catch (err) {
      if (err instanceof OAuthFlowError) {
        if (err.reason === 'unknown-family') throw new HttpError(404, err.message);
        if (err.reason === 'not-configured') throw new HttpError(400, err.message);
      }
      throw err;
    }
  });

  app.get('/api/oauth/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state') ?? '';
    // 落点按 state 族分支（#361），单点描述符：provider 族回 providers 页
    // （#231 原律）；github-connection 族回新建项目页（flag github=connection
    // = 该页着陆消费的 picker 打开/错误信号，provider 族着陆不带、两页互不
    // 串）。kind 不可判（bad-state 不在册形）→ 默认 providers 页；origin 缺
    // （同形）→ 相对 Location：浏览器同源解析，不引入请求方提供的任何
    // origin——「不信任外部 returnOrigin」纪律不变。
    const landingFor = (kind: OAuthStateKind | undefined) =>
      kind === 'github-connection'
        ? { path: '/app/project/new', flag: '&github=connection' }
        : { path: '/app/resources/providers', flag: '' };
    const landing = (
      origin: string | undefined,
      kind: OAuthStateKind | undefined,
      result: string,
    ) => {
      const target = landingFor(kind);
      return c.redirect(`${origin ?? ''}${target.path}?${result}${target.flag}`, 302);
    };
    // #243：state 缺/过期不再裸 400——统一 302 reason=state，与
    // denied/exchange 同律（web 着陆面给可重试路径）。
    const badStateLanding = (err: OAuthFlowError) =>
      landing(err.origin, err.kind, 'oauth=error&reason=state');
    // 用户在 provider 站拒绝（GitHub：?error=access_denied&state=…，无 code）。
    if (c.req.query('error') !== undefined || code === undefined || code === '') {
      try {
        const { origin, kind } = abortOAuthCallback(oauthDeps(), state);
        return landing(origin, kind, 'oauth=error&reason=denied');
      } catch (err) {
        if (err instanceof OAuthFlowError && err.reason === 'bad-state') {
          return badStateLanding(err);
        }
        throw err;
      }
    }
    try {
      const outcome = await completeOAuthCallback(oauthDeps(), {
        code,
        state,
        createdBy: ctx.user.id,
      });
      const result =
        outcome.kind === 'provider'
          ? `oauth=connected&provider=${outcome.presetId}`
          : 'oauth=connected';
      return landing(outcome.origin, outcome.kind, result);
    } catch (err) {
      if (err instanceof OAuthFlowError) {
        if (err.reason === 'exchange-failed' && err.origin !== undefined) {
          return landing(err.origin, err.kind, 'oauth=error&reason=exchange');
        }
        if (err.reason === 'bad-state') return badStateLanding(err);
      }
      throw err;
    }
  });

  // —— GitHub 连接认证面（spec 12 / #361 G2-T4，[设计] 面：todos.dev 此面
  // wire 未采，INFERRED_ROUTES 登记）。authorize = state 签发（github-
  // connection 族——callback 按 kind 分支落回新建项目页）；GET connection =
  // 认证状态读面（login/scope，token 位永不出现，02 §8）；DELETE = 断开
  // （删行幂等，DAO 单点 services/github-connection.ts）。
  app.post('/api/teams/:id/github/oauth/authorize', (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    // returnOrigin 纪律同 provider 族 authorize（Origin 头随 state 绑定）。
    const origin = c.req.header('origin') ?? new URL(c.req.url).origin;
    try {
      const { authorizationUrl } = startGithubConnectionAuthorize(oauthDeps(), {
        teamId,
        origin,
      });
      return c.json({ authorizationUrl });
    } catch (err) {
      if (err instanceof OAuthFlowError && err.reason === 'not-configured') {
        throw new HttpError(400, err.message);
      }
      throw err;
    }
  });

  app.get('/api/teams/:id/github/connection', (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    return c.json(readGithubConnectionStatus({ db: ctx.db, box: ctx.secretBox }, teamId));
  });

  app.delete('/api/teams/:id/github/connection', (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    deleteGithubConnection({ db: ctx.db, box: ctx.secretBox }, teamId);
    return c.body(null, 204);
  });

  /** GET /api/github/repos?q=（spec 12 / #359：新建项目 repo picker 数据面）。
   * GitHub `GET /user/repos` 代理——token 取自 github_connection（SecretBox
   * 密文解封仅在此出站边界，Authorization 头唯一消费位，never 进 URL/日志/
   * 响应）；未连接 = 404（web 面据此显示「认证 GitHub」入口，spec 12 story 2）。
   * q = full_name 大小写不敏感子串过滤 [设计]（上游无查询参数面，本地过滤）；
   * 限流两形经 lib/github.ts 错误映射直透（429/502）。封套单源 = shared
   * githubReposResponseSchema（spec 12 数据契约）。 */
  app.get('/api/github/repos', async (c) => {
    const teamId = c.req.query('teamId') ?? ctx.team.id;
    requireTeam(ctx, teamId);
    const token = openGithubToken({ db: ctx.db, box: ctx.secretBox }, teamId);
    if (token === null) throw notFound('github connection');
    const fetchImpl = ctx.githubFetch ?? fetch;
    const repos = await githubUserRepos(fetchImpl, token);
    const q = c.req.query('q')?.trim().toLowerCase() ?? '';
    const hits = q === '' ? repos : repos.filter((r) => r.fullName.toLowerCase().includes(q));
    return c.json(
      githubReposResponseSchema.parse({
        repos: hits.map((r) => ({
          id: r.id,
          owner: r.owner,
          name: r.name,
          full_name: r.fullName,
          private: r.isPrivate,
        })),
      }),
    );
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

  // —— MCP server 面（02 §7.2，M4b）：/api/mcp 路径保形；Bearer <apiKey> +
  // key 级 24 工具白名单；stateless streamable HTTP（services/mcp-face.ts =
  // server 侧唯一 sdk 薄桥位，00/D4）。app.all = 协议面动词族（POST JSON-RPC；
  // GET/DELETE stateless 405），wire 词表对拍按 ALL 豁免（git 面同族）。
  app.all('/api/mcp', (c) =>
    handleMcpRequest(
      {
        db: ctx.db,
        hub: ctx.hub,
        machineHub: ctx.machineHub,
        box: ctx.secretBox,
        user: ctx.user,
        reposDir: ctx.reposDir,
        attachmentsDir: ctx.attachmentsDir,
        mcpConfigPath: ctx.mcpConfigPath,
        skillsDir: ctx.skillsDir,
        ...(ctx.githubFetch !== undefined ? { githubFetch: ctx.githubFetch } : {}),
      },
      c.req.raw,
    ),
  );

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
