// todos 域（#1125 拆分自 routes.ts）：任务 CRUD + 相位手动改面（#160 拖拽）+
// orchestrate 单出口（#640，直发总管编排回合）+ reset 闸（#755）+ 来源 issue
// 回显/重试（#452/ADR 0006 写向）。项目作用域的建任务面在 routes-projects.ts
// （URL 命名空间归 projects）。

import {
  assignmentSlotSchema,
  buildOrchestratePrompt,
  githubIssueEchoSchema,
  phaseSchema,
  type TodoRecord,
} from '@pacman/shared';
import { eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from './context.js';
import { machine } from './db/schema.js';
import { conflict, notFound, parseWith } from './lib/errors.js';
import { jsonBody, svcOf } from './routes-helpers.js';
import { sendChiefMessage } from './services/chief.js';
import { type GithubIssueFaceDeps, readSourceIssueEcho } from './services/github-issues.js';
import { PhaseTransitionError } from './services/phase.js';
import {
  deleteTodo,
  getTodo,
  listTodos,
  resetTodo,
  retrySelfIssueCreate,
  updateTodo,
} from './services/todos.js';

/** PATCH /api/todos/{id} body——update_todo 面 [推断]（02 §6.1 PATCH 面未
 * 抓取；字段 = todo record 可写子集，wire 补采后收紧，04 附录 A）。 */
const patchTodoBodySchema = z.object({
  title: z.string().optional(),
  spec: z.string().optional(),
  phase: phaseSchema.optional(),
  tagIds: z.array(z.string()).optional(),
  orderIndex: z.number().optional(),
  // #682 任务级钉选机器：string = 改钉 / null = 清回自动 / 缺省 = 不动
  // （只影响之后新起的 build；team 外 id 400）。
  machineId: z.string().nullable().optional(),
  // 指派双槽（#208「编辑分配」）：槽位词表复用 shared assignmentSlotSchema
  // （02 §6.2）；槽级 optional = 槽级 merge，未提供的槽保持现状。
  assignment: z
    .object({
      plan: assignmentSlotSchema.optional(),
      build: assignmentSlotSchema.optional(),
    })
    .optional(),
});

export function registerTodoRoutes(app: Hono, ctx: AppContext): void {
  const svc = svcOf(ctx);
  /** issue 回显面 deps 装配（原 routes.ts 单件 githubIssueDeps 的本域副本；
   * projects 域的读/导入面同式）：githubFetch 注入位收窄到服务面。 */
  const githubIssueDeps = (): GithubIssueFaceDeps => ({
    db: ctx.db,
    box: ctx.secretBox,
    ...(ctx.githubFetch !== undefined ? { githubFetch: ctx.githubFetch } : {}),
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

  // 开始任务 = 单出口直发总管编排回合（#640 / r14 §5.7，用户 2026-10-02
  // 前置裁决：入口不再给「先做规划/立即执行」选择，编排为唯一默认路径）。
  // 新 chief 线程 + 编排请求首条用户消息（任务原文逐字 = 稳定锚点，
  // r14 §5.2）+ chief 步入队；总管裁定单任务直派或拆子卡（纪律在其 system
  // prompt 工作约定）。相位闸：todo（开始）/ failed（重跑），其余 409。
  // #682：todo 钉了机器 → 线程落 pinnedMachineId（chief 会话机器亲和，claim
  // 过滤面）+ 编排请求行明示机器名（chief 裁量改派时有据）。未钉 = 现行为。
  // wire 未采 → INFERRED_ROUTES 登记（todos/{id}/… REST 同族规则）。
  app.post('/api/todos/:id/orchestrate', (c) => {
    const id = c.req.param('id');
    const record = getTodo(svc, id);
    if (!record) throw notFound(`todo ${id}`);
    if (record.phase !== 'todo' && record.phase !== 'failed') {
      throw conflict(`orchestrate 仅适用于 待开始/失败 相位（当前 ${record.phase}）`);
    }
    const machineRow =
      record.machineId !== null
        ? ctx.db.select().from(machine).where(eq(machine.id, record.machineId)).get()
        : undefined;
    const content = buildOrchestratePrompt({
      id: record.id,
      seqNum: record.seqNum,
      spec: record.spec,
      failed: record.phase === 'failed',
      ...(machineRow ? { pinnedMachineName: machineRow.name } : {}),
    });
    const result = sendChiefMessage(svc, record.teamId, {
      threadId: null,
      content,
      ...(record.machineId !== null ? { pinnedMachineId: record.machineId } : {}),
    });
    // 会话流即时推送（chief 会话 = chief-<threadId> 键，POST threads 同形）。
    ctx.convHub?.publishMessage(result.thread.id, { ...result.message });
    return c.json(result, 201);
  });

  // —— PATCH / DELETE 面（[推断] REST 同名，02 §6.1/DELETE_FACE）—————————————————
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

  // 任务重置（#755）：已开始卡拖回待开始的确认落位——中断在飞构建 + 清空
  // 产物 + 相位回 todo。body 快照（dialog 打开时刻的相位/build）与服务端
  // 现值对不上 = 409 + 现记录（构建在确认前推进了，调用方刷新 dialog 文案
  // 重新确认，不得按旧文案重置）。
  const resetTodoBodySchema = z.object({
    expectedPhase: phaseSchema.optional(),
    expectedBuildId: z.string().nullable().optional(),
  });

  app.post('/api/todos/:id/reset', async (c) => {
    const id = c.req.param('id');
    const body = parseWith(resetTodoBodySchema, await jsonBody(c), 'body');
    const result = resetTodo(
      svc,
      id,
      body.expectedPhase !== undefined || body.expectedBuildId !== undefined
        ? { phase: body.expectedPhase, buildId: body.expectedBuildId }
        : undefined,
    );
    if (!result) throw notFound(`todo ${id}`);
    if (result.stale) {
      return c.json(
        {
          error: '任务在你确认前发生了变化（构建已推进），请按最新状态重新确认。',
          record: result.record,
        },
        409,
      );
    }
    return c.json(result.record);
  });

  app.delete('/api/todos/:id', (c) => {
    const id = c.req.param('id');
    if (!deleteTodo(svc, id)) throw notFound(`todo ${id}`);
    return c.body(null, 204);
  });
}
