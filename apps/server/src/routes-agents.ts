// Agent 域：agent CRUD + 记忆读/删 + 详情概览「进行中」段数据源。
// #1125 拆域：本模块是 routes.ts 的一个资源域切片（词表单源与
// 对拍契约不变——shared WEB_REST_ENDPOINTS + test/wire.test.ts 拍的是组合
// 后的 app，不是文件布局）。编排位 = routes.ts 的 registerRoutes。

import {
  AGENT_TOOL_DEFAULTS,
  agentTaskSchema,
  createAgentBodySchema,
  filterAgentTools,
  IN_PROGRESS_PHASES,
  patchAgentBodySchema,
} from '@pacman/shared';
import { and, eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import type { AppContext } from './context.js';
import { agent, agentMemory, todo } from './db/schema.js';
import { notFound, parseWith } from './lib/errors.js';
import { newRecordId } from './lib/ids.js';
import {
  agentRecordOf,
  jsonBody,
  requireAgentRow,
  requireTeam,
  toMemoryRecord,
} from './routes-helpers.js';
import { deleteAgent } from './services/agents.js';
import { filterKnownSkillIds } from './services/skills.js';

export function registerAgentRoutes(app: Hono, ctx: AppContext): void {
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
        // tools 写侧过滤（XMON-77：词表外值静默丢弃——filterKnownSkillIds 同
        // 律，存量残值随下一次写自然清退；词表 = shared AGENT_TOOL_SWITCHES）。
        // 创建缺省 = AGENT_TOOL_DEFAULTS（XMON-84 B4）：「推送分支」默认开——
        // 收尾闸落地后新建即推不了工作分支会破坏交付；显式携带（含 [] = 全关）
        // 照旧尊重，缺省才补默认。
        tools: filterAgentTools(body.tools ?? [...AGENT_TOOL_DEFAULTS]),
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
    // XMON-77：tools[] 与 create 同律——写侧过滤（词表外值静默丢弃）。
    if (body.tools !== undefined) {
      sets.tools = filterAgentTools(body.tools);
    }
    for (const key of [
      'displayName',
      'description',
      'provider',
      'modelId',
      'thinkingLevel',
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

  // Agent 详情概览「进行中」段的数据源（词表内 r3 §8.2 观测路由；行形状 =
  // shared agentTaskSchema，其注释记了逐个字段的原件出处）。
  // 三条判据，每条都有实测依据：
  // · assignment 双槽任一指向该 Agent——r3 §4 观测到的归属关系；
  // · phase ∈ IN_PROGRESS_PHASES（queued/planning/building）——原件把
  //   review/confirm 归「等你」、failed 单列，只有跑着的才算「进行中」；
  // · latestBuildId 在位——行以 build 为主体（原件 key = buildId），没有
  //   build 的在跑 todo 不存在，不收进来。
  // 实测反证（2026-09-30，参考账号）：3 条 phase=review 且双槽指向该 Agent 的
  // todo，该端点恒返回 []——故「按 assignment 过滤 todo」的旧实现是错的。
  app.get('/api/teams/:id/agents/:aid/tasks', (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    const agentId = c.req.param('aid');
    const rows = ctx.db.select().from(todo).where(eq(todo.teamId, teamId)).all();
    const inFlight = rows.filter(
      (r) =>
        (r.assignment?.plan?.agentId === agentId || r.assignment?.build?.agentId === agentId) &&
        (IN_PROGRESS_PHASES as readonly string[]).includes(r.phase) &&
        r.latestBuildId !== null,
    );
    return c.json(
      inFlight.map((r) =>
        agentTaskSchema.parse({
          kind: 'build',
          // 等机器（queued）= 原件唯一的等待 token；跑起来后发 null，消费面
          // 回落 todo.phase（见 schema 注释）。
          state: r.phase === 'queued' ? 'waiting' : null,
          buildId: r.latestBuildId,
          todo: { id: r.id, seqNum: r.seqNum, title: r.title, phase: r.phase },
        }),
      ),
    );
  });
}
