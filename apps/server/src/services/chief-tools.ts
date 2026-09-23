// Chief remoteTools 服务端执行面（02 §4.3「服务端定义并执行」；r5 §3.1 relay
// 位形 = POST /api/machine/tool/<stepId> {name, params} → {text}）。
// 49 词表（protocol/chief-tools.ts）逐件映射到既有服务/DB。复刻口径（02 §4.3
// 尾注 / 04 §1 A4）：Chief = 挂团队工具的 pi 会话，工具「语义」按 r1 docs 六
// 能力组 + r3/r5 行为证据黑盒逼近；params/results 细形未采到 wire 原件处一律
// [推断]，不冒充实测。返回值 = JSON 串（bundle text() 形，daemon 侧回 pi）。
//
// 溯源纪律（r5 §3.2）：create_todo 的 createdBy = Chief 绑定 Agent id、
// sourceBuildId = chief 实例 id（`chief-<userId>-<teamId>`，r5 §3.2 实测样本
// `chief-6ItyfRe7Q7hru5xFmMu-u-…`）、ownerId = 用户。
// save_memory（r5 §6）：agentId = Chief 绑定 Agent（共用存储）、三级溯源
// （sourceBuildId = chief 回合 conv id，records/memory.ts「回合 id」注）、配额 100。

import type { SecretBox, UserRecord } from '@pacman/shared';
import { isChiefConversationId, MEMORY_QUOTA_PER_AGENT } from '@pacman/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import {
  agent,
  agentMemory,
  build,
  chief,
  chiefMessage,
  machine,
  mcpServer,
  message,
  project,
  schedule,
  skill,
  step,
  todo,
  tokenUsage,
} from '../db/schema.js';
import { HttpError } from '../lib/errors.js';
import { newRecordId, nowMs } from '../lib/ids.js';
import { applyBuildStepAction, requestMerge, startBuilds } from './builds.js';
import { addChiefWatch, clearChiefWake, removeChiefWatches, setChiefWake } from './chief.js';
import type { TeamStreamHub } from './events.js';
import { isGithubRepoRef, readFile } from './git.js';
import type { MachineWakeHub } from './machines.js';
import { notifyChiefMessage } from './notifications.js';
import { createSchedule, deleteSchedule, listSchedules } from './schedules.js';
import { createSecret, deleteSecret, listSecrets, updateSecret } from './secrets.js';
import { createTodo, deleteTodo, getTodo, listTodos, setTodoPhase, updateTodo } from './todos.js';

export interface ChiefToolDeps {
  db: Db;
  hub: TeamStreamHub;
  machineHub?: MachineWakeHub;
  box: SecretBox;
  user: UserRecord;
  /** 托管 bare repo 存储根（docs relay 读文件内容 = chief「探测仓库」面，r5 §3.1
   * 回合自带只读探索的宿主等价物；A4 黑盒逼近——官方走 worktree `git show`，
   * 复刻走 server 端裸库读，能力对齐、机制不同，标 [设计]）。 */
  reposDir: string;
}

/** 单次 relay 调用的溯源上下文（step → chief thread 解析，services/machines.ts
 * 组装）。userId = seed 用户；chiefAgentId = 绑定 Agent（save_memory 溯源，
 * r5 §6）；chiefId = `chief-<userId>-<teamId>`（create_todo/save_memory 的
 * sourceBuildId，r5 §3.2 实测「sourceBuildId = chief id」样本
 * `chief-6ItyfRe7Q7hru5xFmMu-u-…`）；conversationId = `chief-<threadId>`（回合
 * conv，token_usage 记账键）。 */
export interface ChiefToolCtx {
  teamId: string;
  userId: string;
  chiefId: string;
  threadId: string;
  chiefAgentId: string | null;
  conversationId: string;
}

type Params = Record<string, unknown>;

function str(params: Params, key: string): string {
  const v = params[key];
  if (typeof v !== 'string' || v === '')
    throw new HttpError(400, `invalid params.${key}: expected non-empty string`);
  return v;
}
function optStr(params: Params, key: string): string | undefined {
  const v = params[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') throw new HttpError(400, `invalid params.${key}: expected string`);
  return v;
}
function strArr(params: Params, key: string): string[] {
  const v = params[key];
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) {
    throw new HttpError(400, `invalid params.${key}: expected string[]`);
  }
  return v as string[];
}
function bool(params: Params, key: string, fallback: boolean): boolean {
  const v = params[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== 'boolean') throw new HttpError(400, `invalid params.${key}: expected boolean`);
  return v;
}
function num(params: Params, key: string): number | undefined {
  const v = params[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new HttpError(400, `invalid params.${key}: expected number`);
  }
  return v;
}

function json(result: unknown): string {
  return JSON.stringify(result ?? null);
}

function requireProjectRow(db: Db, projectId: string) {
  const row = db.select().from(project).where(eq(project.id, projectId)).get();
  if (!row) throw new HttpError(404, `project ${projectId}`);
  return row;
}
/** todo 存在性 + 团队归属校验（纵深防御：relay 以 chief 团队身份执行，跨团队
 * id 一律 404——单租户 self-host 下恒同队（02 §2），此guard 防未来多租越权）。 */
function requireTeamTodo(db: Db, todoId: string, teamId: string) {
  const row = db
    .select()
    .from(todo)
    .where(and(eq(todo.id, todoId), eq(todo.teamId, teamId)))
    .get();
  if (!row) throw new HttpError(404, `todo ${todoId}`);
  return row;
}
/** 49 词表服务端执行。未识别工具名 = 400（词表外不执行，02 §7.2 白名单纪律
 * 同族）。返回 JSON 串。 */
export async function executeChiefTool(
  deps: ChiefToolDeps,
  ctx: ChiefToolCtx,
  name: string,
  params: Params,
): Promise<string> {
  const { db } = deps;
  const svc = { db, hub: deps.hub, machineHub: deps.machineHub, user: deps.user };
  switch (name) {
    // —— 读侧 15 ——
    case 'projects': {
      const rows = db.select().from(project).where(eq(project.teamId, ctx.teamId)).all();
      return json(
        rows.map((p) => {
          const todoCount = db
            .select({ n: sql<number>`count(*)` })
            .from(todo)
            .where(eq(todo.projectId, p.id))
            .get();
          return { id: p.id, name: p.name, repoKind: p.repoKind, todoCount: todoCount?.n ?? 0 };
        }),
      );
    }
    case 'todos': {
      const projectId = optStr(params, 'projectId');
      const phase = optStr(params, 'phase');
      let records = listTodos(svc, projectId ? { projectId } : { teamId: ctx.teamId });
      if (phase) records = records.filter((t) => t.phase === phase);
      return json(records);
    }
    case 'agents': {
      const rows = db.select().from(agent).where(eq(agent.teamId, ctx.teamId)).all();
      return json(
        rows.map((a) => ({
          id: a.id,
          displayName: a.displayName,
          description: a.description,
          provider: a.provider,
          modelId: a.modelId,
          thinkingLevel: a.thinkingLevel,
        })),
      );
    }
    case 'machines': {
      const rows = db.select().from(machine).where(eq(machine.teamId, ctx.teamId)).all();
      return json(
        rows.map((m) => ({
          id: m.id,
          name: m.name,
          online: m.online,
          maxConcurrent: m.maxConcurrent,
          latestCliVersion: m.latestCliVersion,
        })),
      );
    }
    case 'skills': {
      const rows = db.select().from(skill).where(eq(skill.teamId, ctx.teamId)).all();
      return json(rows.map((s) => ({ id: s.id, name: s.name, description: s.description })));
    }
    case 'secrets': {
      const keysvc = { db, box: deps.box };
      // 值只写不读（02 §8）：listSecrets 已剥值，仅名/描述。
      return json(listSecrets(keysvc, ctx.teamId));
    }
    case 'mcp_servers': {
      const rows = db.select().from(mcpServer).where(eq(mcpServer.teamId, ctx.teamId)).all();
      return json(
        rows.map((m) => ({
          id: m.id,
          label: m.label,
          slug: m.slug,
          transport: m.transport,
          url: m.url,
        })),
      );
    }
    case 'schedules': {
      return json(listSchedules({ db, hub: deps.hub }, ctx.teamId));
    }
    case 'docs': {
      // 读仓库文件内容（chief「探测仓库」面 = r5 §3.1 回合自带只读探索 / spec
      // 三段「先探测仓库再写事实」的宿主等价物）：走 server 端裸库读
      // （services/git.readFile，02 §3 文件浏览面同源）——A4 黑盒逼近：官方走
      // daemon worktree `git show`，复刻走 server 裸库读，能力对齐、机制不同
      // [设计]。无 path → 回项目 repo 元信息（GitHub 形态无本地存储）。
      const projectId = str(params, 'projectId');
      const row = requireProjectRow(db, projectId);
      const path = optStr(params, 'path');
      if (path === undefined) {
        return json({ projectId, name: row.name, repoKind: row.repoKind, path: null });
      }
      const file = await readFile(
        { db, reposDir: deps.reposDir },
        projectId,
        path,
        optStr(params, 'ref'),
      );
      return json({
        projectId,
        name: row.name,
        path: file.path,
        ref: file.ref,
        encoding: file.encoding,
        content: file.content,
      });
    }
    case 'usage': {
      // token_usage 无 teamId 列；单租户 self-host（02 §2 team 恒一行）下全量
      // 即本团队。buildId 给定则按其过滤。
      const buildId = optStr(params, 'buildId');
      const rows = buildId
        ? db.select().from(tokenUsage).where(eq(tokenUsage.buildId, buildId)).all()
        : db.select().from(tokenUsage).all();
      return json(rows);
    }
    case 'issues':
    case 'pull_requests':
    case 'workflow_runs': {
      // GitHub-backed 才有（02 §3/A4）；托管 repo 返回空集 [推断]。
      return json({ items: [], note: 'GitHub-backed only' });
    }
    case 'attachment': {
      return json({
        attachmentId: str(params, 'attachmentId'),
        note: 'attachment store not wired [推断]',
      });
    }
    case 'conversation': {
      const conversationId = str(params, 'conversationId');
      // chief 会话 → chief_message；build 会话 → message（同端点族，r5 §3.6）。
      if (isChiefConversationId(conversationId)) {
        const rows = db
          .select()
          .from(chiefMessage)
          .where(eq(chiefMessage.threadId, conversationId))
          .orderBy(asc(chiefMessage.createdAt))
          .all();
        return json(
          rows.map((r) => ({ id: r.id, role: r.role, content: r.content, createdAt: r.createdAt })),
        );
      }
      const rows = db
        .select()
        .from(message)
        .where(eq(message.conversationId, conversationId))
        .all();
      return json(
        rows.map((r) => ({ id: r.id, role: r.role, content: r.content, createdAt: r.createdAt })),
      );
    }

    // —— 组织侧 19 ——
    case 'create_todo': {
      // 措辞→spec 三段式（r5 §3.2）由 LLM 侧组织 spec 文本；本层落库 + 溯源。
      const projectId = str(params, 'projectId');
      requireProjectRow(db, projectId); // 存在性校验（404 面）
      const record = createTodo(svc, {
        teamId: ctx.teamId,
        projectId,
        title: str(params, 'title'),
        spec: str(params, 'spec'),
        createdBy: ctx.chiefAgentId, // r5 §3.2：createdBy = Chief 绑定 Agent id
        ownerId: ctx.userId,
      });
      // sourceBuildId = chief id（r5 §3.2 实测：「sourceBuildId = chief id」，
      // 样本 `chief-<userId>-…` = chief 实例 id，非 thread/conv id）。
      db.update(todo).set({ sourceBuildId: ctx.chiefId }).where(eq(todo.id, record.id)).run();
      return json({ ...record, sourceBuildId: ctx.chiefId });
    }
    case 'update_todo': {
      const todoId = str(params, 'todoId');
      requireTeamTodo(db, todoId, ctx.teamId); // 团队归属校验（纵深防御）
      const record = updateTodo(svc, todoId, {
        ...(optStr(params, 'title') !== undefined ? { title: optStr(params, 'title') } : {}),
        ...(optStr(params, 'spec') !== undefined ? { spec: optStr(params, 'spec') } : {}),
        ...(params.tagIds !== undefined ? { tagIds: strArr(params, 'tagIds') } : {}),
      });
      if (!record) throw new HttpError(404, `todo ${todoId}`);
      return json(record);
    }
    case 'delete_todos': {
      const ids = strArr(params, 'todoIds');
      for (const id of ids) requireTeamTodo(db, id, ctx.teamId);
      // 复用 todos 服务的级联清理（build/step 手动清 + todo 删，deleteTodo 单源，
      // 避免与 REST DELETE 面漂移）。
      const deleted = ids.filter((id) => deleteTodo(svc, id));
      return json({ deleted });
    }
    case 'close_todos':
      return json(transitionTodos(deps, ctx.teamId, strArr(params, 'todoIds'), 'closed'));
    case 'reopen_todos':
      return json(transitionTodos(deps, ctx.teamId, strArr(params, 'todoIds'), 'todo'));
    case 'complete_todos':
      return json(transitionTodos(deps, ctx.teamId, strArr(params, 'todoIds'), 'done'));
    case 'message_todo': {
      const todoId = str(params, 'todoId');
      const row = requireTeamTodo(db, todoId, ctx.teamId);
      // 消息进 todo 最新 build 会话（steer/feedback 面，r5 §3.6）。
      const conversationId = row.latestBuildId;
      if (conversationId) {
        db.insert(message)
          .values({
            id: newRecordId(),
            conversationId,
            role: 'user',
            content: str(params, 'content'),
            createdAt: nowMs(),
          })
          .run();
      }
      return json({ todoId, conversationId, posted: conversationId !== null });
    }
    case 'create_project': {
      const name = str(params, 'name');
      const repoKind = optStr(params, 'repoKind');
      const id = newRecordId();
      db.insert(project)
        .values({
          id,
          name,
          teamId: ctx.teamId,
          repoKind: repoKind === 'hosted' ? 'hosted' : null,
          repoName: null,
          githubRepo: null,
        })
        .run();
      return json({
        id,
        name,
        note: repoKind === 'hosted' ? 'hosted repo provisioning via REST face' : 'plain project',
      });
    }
    case 'update_project': {
      const projectId = str(params, 'projectId');
      requireProjectRow(db, projectId);
      const name = optStr(params, 'name');
      if (name !== undefined)
        db.update(project).set({ name }).where(eq(project.id, projectId)).run();
      return json({ id: projectId, name });
    }
    case 'connect_repo': {
      const projectId = str(params, 'projectId');
      requireProjectRow(db, projectId);
      const githubRepo = str(params, 'githubRepo');
      if (!isGithubRepoRef(githubRepo))
        throw new HttpError(400, 'invalid params.githubRepo: expected "owner/repo"');
      db.update(project)
        .set({ repoKind: 'github', githubRepo })
        .where(eq(project.id, projectId))
        .run();
      return json({ id: projectId, repoKind: 'github', githubRepo });
    }
    case 'create_agent': {
      const id = newRecordId();
      db.insert(agent)
        .values({
          id,
          teamId: ctx.teamId,
          displayName: str(params, 'displayName'),
          description: optStr(params, 'description') ?? null,
          status: 'active',
          avatarUrl: null,
          provider: optStr(params, 'provider') ?? null,
          modelId: optStr(params, 'modelId') ?? null,
          thinkingLevel: null,
          tools: [],
          secrets: [],
          skills: [],
          mcpServers: [],
        })
        .run();
      return json({ id }); // r5 §1：POST agents → 201 {id}
    }
    case 'update_agent': {
      const agentId = str(params, 'agentId');
      const row = db
        .select()
        .from(agent)
        .where(and(eq(agent.id, agentId), eq(agent.teamId, ctx.teamId)))
        .get();
      if (!row) throw new HttpError(404, `agent ${agentId}`);
      const sets: Partial<typeof row> = {};
      const dn = optStr(params, 'displayName');
      const desc = optStr(params, 'description');
      const prov = optStr(params, 'provider');
      const model = optStr(params, 'modelId');
      if (dn !== undefined) sets.displayName = dn;
      if (desc !== undefined) sets.description = desc;
      if (prov !== undefined) sets.provider = prov;
      if (model !== undefined) sets.modelId = model;
      if (Object.keys(sets).length > 0)
        db.update(agent).set(sets).where(eq(agent.id, agentId)).run();
      return json({ id: agentId, ...sets });
    }
    case 'delete_agents': {
      const ids = strArr(params, 'agentIds');
      for (const id of ids)
        db.delete(agent)
          .where(and(eq(agent.id, id), eq(agent.teamId, ctx.teamId)))
          .run();
      return json({ deleted: ids });
    }
    case 'delete_skills': {
      const ids = strArr(params, 'skillIds');
      for (const id of ids)
        db.delete(skill)
          .where(and(eq(skill.id, id), eq(skill.teamId, ctx.teamId)))
          .run();
      return json({ deleted: ids });
    }
    case 'set_secret': {
      const keysvc = { db, box: deps.box };
      const name = str(params, 'name');
      const existing = listSecrets(keysvc, ctx.teamId).find((s) => s.name === name);
      const value = str(params, 'value');
      const description = optStr(params, 'description') ?? null;
      if (existing) {
        return json(updateSecret(keysvc, ctx.teamId, existing.id, { name, value, description }));
      }
      const record = createSecret(keysvc, { teamId: ctx.teamId, name, description, value });
      return json(record);
    }
    case 'delete_secrets': {
      const keysvc = { db, box: deps.box };
      const names = strArr(params, 'names');
      const all = listSecrets(keysvc, ctx.teamId);
      const deleted: string[] = [];
      for (const n of names) {
        const hit = all.find((s) => s.name === n || s.id === n);
        if (hit && deleteSecret(keysvc, ctx.teamId, hit.id)) deleted.push(n);
      }
      return json({ deleted });
    }
    case 'set_remote_shell': {
      const agentId = str(params, 'agentId');
      const enabled = bool(params, 'enabled', true);
      const row = db
        .select()
        .from(agent)
        .where(and(eq(agent.id, agentId), eq(agent.teamId, ctx.teamId)))
        .get();
      if (!row) throw new HttpError(404, `agent ${agentId}`);
      const tools = new Set(row.tools);
      if (enabled) tools.add('远程 shell');
      else tools.delete('远程 shell');
      db.update(agent)
        .set({ tools: [...tools] })
        .where(eq(agent.id, agentId))
        .run();
      return json({ agentId, remoteShell: enabled });
    }
    case 'schedule_todo': {
      const todoId = str(params, 'todoId');
      const row = requireTeamTodo(db, todoId, ctx.teamId);
      const kind = str(params, 'kind') as 'once' | 'hourly' | 'daily' | 'weekly';
      const at = num(params, 'at');
      if (at === undefined) throw new HttpError(400, 'invalid params.at: expected number');
      const machineId = optStr(params, 'machineId') ?? null;
      const record = createSchedule(
        { db, hub: deps.hub },
        {
          teamId: ctx.teamId,
          projectId: row.projectId,
          todoId,
          kind,
          at,
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          machineId,
          createdBy: ctx.userId,
        },
      );
      return json(record);
    }
    case 'unschedule_todo': {
      const todoId = str(params, 'todoId');
      requireTeamTodo(db, todoId, ctx.teamId);
      const rows = db.select().from(schedule).where(eq(schedule.todoId, todoId)).all();
      for (const r of rows) deleteSchedule({ db, hub: deps.hub }, r.id);
      return json({ todoId, removed: rows.length });
    }

    // —— 执行侧 5 ——
    case 'run_builds': {
      // 单请求单 todo 直派（withPlan:false 默认，r5 §3.4）；assignment 双槽
      // （分派职责权重由 LLM 侧选 agentId，本层落库，r5 §3.3/§5）。
      const todoIds = strArr(params, 'todoIds');
      const withPlan = bool(params, 'withPlan', false);
      const assignmentIn = params.assignment as
        | { plan?: { agentId?: string }; build?: { agentId?: string } }
        | undefined;
      const assignment = {
        plan: assignmentIn?.plan?.agentId ? { agentId: assignmentIn.plan.agentId } : null,
        build: assignmentIn?.build?.agentId ? { agentId: assignmentIn.build.agentId } : null,
      };
      const started: unknown[] = [];
      for (const todoId of todoIds) {
        const row = requireTeamTodo(db, todoId, ctx.teamId);
        const builds = startBuilds(
          { db, hub: deps.hub, machineHub: deps.machineHub, user: deps.user },
          {
            projectId: row.projectId,
            todoIds: [todoId],
            assignment,
            withPlan,
            triggerSource: 'chief',
          },
        );
        started.push(...builds);
        // 派工即自动 watch（r5 §3.5：run_builds → watches[0] reason canon）。
        const projectName = requireProjectRow(db, row.projectId).name;
        const todoRecord = getTodo(svc, todoId);
        if (todoRecord) {
          addChiefWatch(deps, {
            teamId: ctx.teamId,
            todo: todoRecord,
            projectName,
            threadId: ctx.threadId,
          });
        }
      }
      return json({ builds: started, withPlan, triggerSource: 'chief' });
    }
    case 'run_review': {
      const buildId = str(params, 'buildId');
      return json({ buildId, note: 'independent review run not wired [推断]' });
    }
    case 'confirm_builds': {
      const buildIds = strArr(params, 'buildIds');
      for (const buildId of buildIds) confirmBuild(deps, buildId);
      return json({ confirmed: buildIds });
    }
    case 'cancel_builds': {
      const buildIds = strArr(params, 'buildIds');
      for (const buildId of buildIds) {
        db.update(build).set({ errorMessage: 'Cancelled' }).where(eq(build.id, buildId)).run();
        db.update(step)
          .set({ status: 'failed' })
          .where(and(eq(step.buildId, buildId), eq(step.status, 'pending')))
          .run();
      }
      return json({ cancelled: buildIds });
    }
    case 'merge_builds': {
      const buildIds = strArr(params, 'buildIds');
      for (const buildId of buildIds) mergeBuild(deps, buildId);
      return json({ mergeDelegated: buildIds });
    }

    // —— Chief 私有侧 10 ——
    case 'ask_user': {
      // 提问 = chief 线程内 assistant 消息 + chief_message 通知；等待下一条
      // 用户消息（本 relay 返回即 ack，回合续由 LLM 决定 [设计]）。
      return json({ asked: true, question: str(params, 'question') });
    }
    case 'notify_user': {
      const text = str(params, 'message');
      const agentRow = ctx.chiefAgentId
        ? db.select().from(agent).where(eq(agent.id, ctx.chiefAgentId)).get()
        : undefined;
      notifyChiefMessage(
        { db, hub: deps.hub, user: deps.user },
        {
          threadId: ctx.threadId,
          message: text,
          agent: agentRow
            ? { name: agentRow.displayName, avatarUrl: agentRow.avatarUrl }
            : { name: deps.user.displayName, avatarUrl: deps.user.avatarUrl },
        },
      );
      return json({ notified: true });
    }
    case 'save_memory': {
      // r5 §6：agentId = Chief 绑定 Agent（共用存储）；三级溯源；配额 100。
      if (ctx.chiefAgentId === null)
        throw new HttpError(409, 'chief agent not bound — memory has no store');
      const row = saveMemoryEntry(db, {
        agentId: ctx.chiefAgentId,
        teamId: ctx.teamId,
        title: str(params, 'title'),
        content: str(params, 'content'),
        projectId: optStr(params, 'projectId') ?? null,
        sourceTodoId: optStr(params, 'sourceTodoId') ?? null,
        sourceBuildId: ctx.conversationId, // chief 来源 = chief 回合 id（r5 §6）
      });
      return json(row);
    }
    case 'delete_memory': {
      const memoryId = str(params, 'memoryId');
      db.delete(agentMemory).where(eq(agentMemory.id, memoryId)).run();
      return json({ deleted: memoryId });
    }
    case 'memories': {
      if (ctx.chiefAgentId === null) return json([]);
      const rows = db
        .select()
        .from(agentMemory)
        .where(eq(agentMemory.agentId, ctx.chiefAgentId))
        .orderBy(asc(agentMemory.createdAt))
        .all();
      return json(rows);
    }
    case 'watch_todos': {
      const todoIds = strArr(params, 'todoIds');
      const reason = optStr(params, 'reason');
      for (const todoId of todoIds) {
        const record = getTodo(svc, todoId);
        if (!record) continue;
        const projectName = requireProjectRow(db, record.projectId).name;
        addChiefWatch(deps, {
          teamId: ctx.teamId,
          todo: record,
          projectName,
          threadId: ctx.threadId,
          ...(reason ? { reason } : {}),
        });
      }
      return json({ watched: todoIds });
    }
    case 'unwatch_todos': {
      const todoIds = strArr(params, 'todoIds');
      removeChiefWatches(deps, ctx.teamId, todoIds);
      return json({ unwatched: todoIds });
    }
    case 'wakes': {
      const row = db.select().from(chief).where(eq(chief.id, ctx.chiefId)).get();
      return json(row?.wakes ?? []);
    }
    case 'set_wake': {
      const at = num(params, 'at');
      if (at === undefined) throw new HttpError(400, 'invalid params.at: expected number');
      const wake = setChiefWake(deps, ctx.teamId, {
        at,
        ...(optStr(params, 'note') ? { note: optStr(params, 'note') } : {}),
        ...(optStr(params, 'todoId') ? { todoId: optStr(params, 'todoId') } : {}),
        threadId: ctx.threadId,
      });
      return json(wake);
    }
    case 'clear_wake': {
      const ok = clearChiefWake(deps, ctx.teamId, str(params, 'wakeId'));
      return json({ cleared: ok });
    }

    default:
      throw new HttpError(400, `unknown chief tool: ${name}`);
  }
}

/** 批量 phase 流转（MCP server 面 complete/close/reopen 同吃，02 §7.2 六能力组
 * Manage lifecycle）。非法流转边跳过不中断 [设计]。 */
export function transitionTodos(
  deps: ChiefToolDeps,
  teamId: string,
  todoIds: string[],
  to: 'closed' | 'todo' | 'done',
): { transitioned: string[]; skipped: string[] } {
  // machineHub 在位 → setTodoPhase 漏斗可触发 chief wake（done=settle 等）。
  const svc = { db: deps.db, hub: deps.hub, machineHub: deps.machineHub, user: deps.user };
  const transitioned: string[] = [];
  const skipped: string[] = [];
  for (const id of todoIds) {
    // 团队归属校验（纵深防御）：跨团队 id 记 skipped，不中断批次。
    const owned = deps.db
      .select({ id: todo.id })
      .from(todo)
      .where(and(eq(todo.id, id), eq(todo.teamId, teamId)))
      .get();
    if (!owned) {
      skipped.push(id);
      continue;
    }
    try {
      const record = setTodoPhase(svc, id, to);
      if (record) transitioned.push(id);
      else skipped.push(id);
    } catch {
      skipped.push(id); // 非法流转边（phase.ts）→ 跳过，不中断批次 [设计]
    }
  }
  return { transitioned, skipped };
}

function buildDeps(deps: ChiefToolDeps) {
  return { db: deps.db, hub: deps.hub, machineHub: deps.machineHub, user: deps.user };
}
export function confirmBuild(deps: ChiefToolDeps, buildId: string): void {
  if (!deps.db.select().from(build).where(eq(build.id, buildId)).get()) {
    throw new HttpError(404, `build ${buildId}`);
  }
  applyBuildStepAction(buildDeps(deps), buildId, { action: 'confirm' });
}
export function mergeBuild(deps: ChiefToolDeps, buildId: string): void {
  if (!deps.db.select().from(build).where(eq(build.id, buildId)).get()) {
    throw new HttpError(404, `build ${buildId}`);
  }
  requestMerge(buildDeps(deps), buildId);
}

// —— memory 写路径共用面（02 §4.4/r5 §6，M4b）———————————————————————————————
// save_memory 单源：配额 100 + 三级溯源（agentId/teamId/projectId/sourceTodoId/
// sourceBuildId）。chief 回合与 worker 执行步中共用（「Chief 与绑定 Agent 共用
// 同一存储」r5 §2/§6 的写侧半；worker 侧 = 指令触发 + Agent 裁量，宿主不做
// 任务结束蒸馏——零自动写入语义由「无钩子调用点」结构性守住）。

/** 配额门 + 落库（r5 §6 形状原样）。超限 = 409（UI `记忆 · n/100` 同源常量）。 */
export function saveMemoryEntry(
  db: Db,
  input: {
    agentId: string;
    teamId: string;
    title: string;
    content: string;
    projectId: string | null;
    sourceTodoId: string | null;
    sourceBuildId: string | null;
  },
): typeof agentMemory.$inferSelect {
  const count = db
    .select({ n: sql<number>`count(*)` })
    .from(agentMemory)
    .where(eq(agentMemory.agentId, input.agentId))
    .get();
  if ((count?.n ?? 0) >= MEMORY_QUOTA_PER_AGENT) {
    throw new HttpError(409, `memory quota exceeded (${MEMORY_QUOTA_PER_AGENT}/agent)`);
  }
  const id = newRecordId();
  const now = nowMs();
  db.insert(agentMemory)
    .values({ id, ...input, createdAt: now, updatedAt: now })
    .run();
  const row = db.select().from(agentMemory).where(eq(agentMemory.id, id)).get();
  if (!row) throw new HttpError(500, 'memory insert lost');
  return row;
}

/** worker 步记忆工具上下文（machines.ts 从 step → build → todo → assignment
 * 解析；执行 Agent = 该步类的 assignment 槽，02 §4.2）。 */
export interface WorkerMemoryCtx {
  teamId: string;
  agentId: string;
  todoId: string;
  projectId: string;
  /** buildId ≡ conversationId（CONTEXT.md）= sourceBuildId 溯源位（r5 §6）。 */
  buildId: string;
}

/** worker 步 relay 白名单 = 记忆三件套（MEMORY_TOOLS 单源）；词表外 = 400
 * （chief 49 词表不外溢到 worker 步——组织/执行面是 Chief 专属，r5 §3.1）。 */
export async function executeWorkerMemoryTool(
  db: Db,
  ctx: WorkerMemoryCtx,
  name: string,
  params: Params,
): Promise<string> {
  switch (name) {
    case 'save_memory': {
      // 溯源缺省 = 运行中任务上下文（r5 §6 实测样本 sourceTodoId/sourceBuildId
      // = 当次 todo/build）；params 显式值优先（跨任务记录经验 [设计]）。
      const row = saveMemoryEntry(db, {
        agentId: ctx.agentId,
        teamId: ctx.teamId,
        title: str(params, 'title'),
        content: str(params, 'content'),
        projectId: optStr(params, 'projectId') ?? ctx.projectId,
        sourceTodoId: optStr(params, 'sourceTodoId') ?? ctx.todoId,
        sourceBuildId: ctx.buildId,
      });
      return json(row);
    }
    case 'delete_memory': {
      const memoryId = str(params, 'memoryId');
      // 越权防御：只删本 Agent 本团队条目。
      db.delete(agentMemory)
        .where(
          and(
            eq(agentMemory.id, memoryId),
            eq(agentMemory.agentId, ctx.agentId),
            eq(agentMemory.teamId, ctx.teamId),
          ),
        )
        .run();
      return json({ deleted: memoryId });
    }
    case 'memories': {
      const rows = db
        .select()
        .from(agentMemory)
        .where(and(eq(agentMemory.agentId, ctx.agentId), eq(agentMemory.teamId, ctx.teamId)))
        .orderBy(asc(agentMemory.createdAt))
        .all();
      return json(rows);
    }
    default:
      throw new HttpError(400, `tool ${name} is not relayed for worker steps`);
  }
}
