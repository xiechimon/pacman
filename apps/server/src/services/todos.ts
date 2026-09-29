// todo 服务面：CRUD + record 投影（wire 形状 = shared todoRecordSchema，
// 02 §4.1/§6.2 字段即契约）+ 变更即发 team stream 文档事件（r5 §7.2 双保险
// 复刻侧：SSE 文档事件直更 + 前端重取兜底）。
// 派生字段（不存列）：tagIds（todo_tag join）、agent（assignment.build 槽 →
// agent 行）、buildHistory（build 表投影 {buildId, createdAt}，records/todo.ts
// 最小投影 [推断]）。

import type {
  Assignment,
  Phase,
  SecretBox,
  TodoRecord,
  TodoSourceKind,
  UserRecord,
} from '@pacman/shared';
import {
  derivePlaceholderTitle,
  githubIssueSourceRef,
  PLACEHOLDER_TITLE_FALLBACK,
  parseGithubIssueSourceRef,
} from '@pacman/shared';
import { and, asc, eq, inArray, max, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { agent, build, project, step, tag, todo, todoTag } from '../db/schema.js';
import { HttpError } from '../lib/errors.js';
import type { FetchLike } from '../lib/github.js';
import { githubCreateIssue, githubUpdateIssueTitle } from '../lib/github.js';
import { newRecordId, nowMs } from '../lib/ids.js';
import { triggerChiefWakes } from './chief.js';
import type { TeamStreamHub } from './events.js';
import { hasGithubConnection, openGithubToken } from './github-connection.js';
import type { MachineWakeHub } from './machines.js';
import { notifyTodoPhase } from './notifications.js';
import { assertPhaseTransition, canManualMovePhase } from './phase.js';

type TodoRow = typeof todo.$inferSelect;

export interface TodoDeps {
  db: Db;
  hub: TeamStreamHub;
  /** chief wake 派发通道（triggerChiefWakes 入队即 wake，02 §5.4）。 */
  machineHub?: MachineWakeHub;
  /** 通知收件人（phase 漏斗挂 plan_ready/build_review，02 §9.1）。 */
  user: UserRecord;
  /** GitHub 写向 deps（#452 / ADR 0006：自建 issue + 标题回写）。box =
   * github_connection token 解密位；缺省 = 写向关闭（单测/纯本地形态，
   * local 项目行为逐字节不变）。 */
  box?: SecretBox;
  /** GitHub 出站注入位（AppContext.githubFetch 同族；缺省 globalThis.fetch，
   * 测试注入 mock——零真实出站）。 */
  githubFetch?: FetchLike;
}

/** phase 漏斗的通知挂接：进 confirm/review 发 in-app 事件（r5 §7.2 矩阵；
 * done/failed 无事件照抄）+ chief watch/wake 主动回路挂接（gate/settle/failed
 * 三触发，r5 §3.5）。setTodoPhase 与 updateTodo 两路共用。 */
function notifyPhaseEntry(deps: TodoDeps, record: TodoRecord, from: Phase, to: Phase): void {
  if (from === to) return;
  if (to === 'confirm' || to === 'review') notifyTodoPhase(deps, record, to);
  triggerChiefWakes(deps, record, to);
}

export function toTodoRecord(deps: TodoDeps, row: TodoRow): TodoRecord {
  const { db } = deps;
  const tagIds = db
    .select({ tagId: todoTag.tagId })
    .from(todoTag)
    .where(eq(todoTag.todoId, row.id))
    .all()
    .map((r) => r.tagId);
  const history = db
    .select({ buildId: build.id, createdAt: build.createdAt })
    .from(build)
    .where(eq(build.todoId, row.id))
    .orderBy(asc(build.createdAt))
    .all();
  // agent = assignment.build 槽引用（开始 dialog 执行侧 Agent，r5 §3.4/§5）。
  const buildAgentId = row.assignment?.build?.agentId ?? null;
  const agentRow = buildAgentId
    ? db.select().from(agent).where(eq(agent.id, buildAgentId)).get()
    : undefined;
  return {
    id: row.id,
    teamId: row.teamId,
    projectId: row.projectId,
    title: row.title,
    spec: row.spec,
    phase: row.phase,
    phaseAt: row.phaseAt,
    seqNum: row.seqNum,
    orderIndex: row.orderIndex,
    tagIds,
    assignment: row.assignment ?? null,
    agent: agentRow ? { id: agentRow.id, displayName: agentRow.displayName } : null,
    latestBuildId: row.latestBuildId,
    lastRunAt: row.lastRunAt,
    hasChanges: row.hasChanges,
    hasPlan: row.hasPlan,
    buildHistory: history,
    sourceTodo: row.sourceTodo,
    v: row.v,
    createdBy: row.createdBy,
    ownerId: row.ownerId,
    sourceBuildId: row.sourceBuildId,
    sourceKind: row.sourceKind,
    sourceRef: row.sourceRef,
  };
}

function getRow(deps: TodoDeps, id: string): TodoRow | undefined {
  return deps.db.select().from(todo).where(eq(todo.id, id)).get();
}

export function listTodos(
  deps: TodoDeps,
  filter: { teamId?: string; projectId?: string } = {},
): TodoRecord[] {
  const conds = [
    filter.teamId !== undefined ? eq(todo.teamId, filter.teamId) : undefined,
    filter.projectId !== undefined ? eq(todo.projectId, filter.projectId) : undefined,
  ].filter((c) => c !== undefined);
  const rows = deps.db
    .select()
    .from(todo)
    .where(conds.length > 0 ? and(...conds) : sql`1=1`)
    .orderBy(asc(todo.seqNum))
    .all();
  return rows.map((row) => toTodoRecord(deps, row));
}

export function getTodo(deps: TodoDeps, id: string): TodoRecord | null {
  const row = getRow(deps, id);
  return row ? toTodoRecord(deps, row) : null;
}

/** POST /api/projects/{id}/todos body {title, spec}（r3 §3.1 抓包原样）+
 *  tagIds 携带位（r9 §3.4 实测，#309）。tagIds 限本项目 tag 集——界外/未知
 *  id 400（项目边界防御 [设计]，错误语义 wire 未观测）。
 *
 *  #452 / ADR 0006 写向收口（三条创建路径共用）：已连接 GitHub 的 github
 *  形态项目，任务以 `sourceKind='github-issue-self'` + `sourceRef=null`
 *  （未建成）落库，随后**关键路径之外**（fire-and-forget，返回前零 GitHub
 *  await）出站建 issue、成功补 sourceRef。导入面显式携带 sourceKind =
 *  不触发（防双 issue）；local/hosted/未连接 = 现行为逐字节不变。 */
export function createTodo(
  deps: TodoDeps,
  input: {
    teamId: string;
    projectId: string;
    title: string;
    spec: string;
    tagIds?: string[];
    /** 人工建 = seed 用户 id；Chief 派工 = 绑定 Agent id（records/todo.ts
     * 人工建取值未分离观测 [推断]，按属主用户填）。 */
    createdBy: string | null;
    ownerId: string | null;
    /** 来源两列（#446 / ADR 0005 D6）：github issue 导入面携带；其余建任
     * 路面缺省 = null（wire 形状恒在，records/todo.ts）。 */
    sourceKind?: TodoSourceKind;
    sourceRef?: string;
  },
): TodoRecord {
  const { db, hub } = deps;
  // 去重防御：重复 id 会撞 todo_tag 复合主键（wire 语义未定义重复，UI 面
  // 恒发唯一集——非 UI 客户端的健壮位 [设计]）。
  const tagIds = [...new Set(input.tagIds ?? [])];
  if (tagIds.length > 0) {
    const owned = new Set(
      db
        .select({ id: tag.id })
        .from(tag)
        .where(and(eq(tag.projectId, input.projectId), inArray(tag.id, tagIds)))
        .all()
        .map((r) => r.id),
    );
    for (const tagId of tagIds) {
      if (!owned.has(tagId)) throw new HttpError(400, `tag ${tagId} not in project`);
    }
  }
  // seqNum = 团队内持久序号（CONTEXT.md `#seqNum`；观测 #11–#14 跨项目递增，
  // 团队级计数 [推断]）。
  const seqRow = db
    .select({ n: max(todo.seqNum) })
    .from(todo)
    .where(eq(todo.teamId, input.teamId))
    .get();
  const seqNum = (seqRow?.n ?? 0) + 1;
  // orderIndex = 「待开始」列尾（列内排序位，records/todo.ts）。
  const orderRow = db
    .select({ n: max(todo.orderIndex) })
    .from(todo)
    .where(and(eq(todo.projectId, input.projectId), eq(todo.phase, 'todo')))
    .get();
  const now = nowMs();
  const id = newRecordId();
  // spec 15 #394：标题空白 = 占位标题派生（正文首个非空行 ≤50 字符，shared
  // 单源）；正式标题由执行 agent 经 set_task_meta 回填（ADR 0002 D2/D3）。
  // 全空白 spec 的兜底文案实践中不可达（web 保存闸拦空正文；chief/mcp 面
  // 恒传显式标题）。
  const title =
    input.title.trim() || derivePlaceholderTitle(input.spec) || PLACEHOLDER_TITLE_FALLBACK;
  // #452 / ADR 0006 D1/D2：自建 issue 目标判定——纯本地读（project 形态 +
  // 连接行存在性，不解密不出站），createTodo 返回前零 GitHub await（关键
  // 路径硬约束，test/github-writeback.test.ts A6 钉死）。导入面显式带
  // sourceKind = 不触发；box 缺位的 deps（纯本地单测面）= 写向关闭。
  const selfIssue =
    input.sourceKind === undefined ? planSelfIssue(deps, input.teamId, input.projectId) : null;
  db.insert(todo)
    .values({
      id,
      teamId: input.teamId,
      projectId: input.projectId,
      title,
      spec: input.spec,
      phase: 'todo',
      phaseAt: now,
      seqNum,
      orderIndex: (orderRow?.n ?? -1) + 1,
      assignment: null,
      latestBuildId: null,
      lastRunAt: null,
      hasChanges: false,
      hasPlan: false,
      sourceTodo: null,
      v: 1,
      createdBy: input.createdBy,
      ownerId: input.ownerId,
      sourceBuildId: null,
      // 自建 issue 目标（#452）：落库即「未建成」态（sourceRef=null，ADR
      // 0006 D2 状态值不新开列），异步建成后补 ref。
      sourceKind: input.sourceKind ?? (selfIssue !== null ? 'github-issue-self' : null),
      sourceRef: input.sourceRef ?? null,
    })
    .run();
  for (const tagId of tagIds) {
    db.insert(todoTag).values({ todoId: id, tagId }).run();
  }
  const record = getTodo(deps, id);
  if (!record) throw new Error('todo missing after insert');
  hub.publishTodoDoc(input.teamId, record);
  // fire-and-forget（关键路径之外，D2 硬约束）：出站成败不影响本函数返回。
  if (selfIssue !== null) scheduleSelfIssueCreate(deps, id);
  return record;
}

/** PATCH /api/todos/{id}（[推断] REST 同名，02 §6.1 DELETE 面同规则；
 * update_todo 词表证据 r5 §3.1）。字段级 patch；任何变更 v++ 并发文档事件。 */
export function updateTodo(
  deps: TodoDeps,
  id: string,
  patch: {
    title?: string;
    spec?: string;
    phase?: Phase;
    tagIds?: string[];
    orderIndex?: number;
    /** 指派槽级 patch（#208「编辑分配」）：提供的槽覆盖，未提供的槽保持现状；
     * 槽形状 = shared assignmentSlotSchema（02 §6.2 双槽词表）。 */
    assignment?: {
      plan?: NonNullable<Assignment['plan']>;
      build?: NonNullable<Assignment['build']>;
    };
  },
  /** manualPhase = HTTP PATCH 面（#160 看板拖拽手动改相）：目标 ∈ 六列
   *  dropPhase 时绕过系统漏斗（phase.ts canManualMovePhase）；内部流不传。 */
  opts: { manualPhase?: boolean } = {},
): TodoRecord | null {
  const { db, hub } = deps;
  const row = getRow(deps, id);
  if (!row) return null;

  const sets: Partial<TodoRow> = {};
  if (patch.title !== undefined) sets.title = patch.title;
  if (patch.spec !== undefined) sets.spec = patch.spec;
  if (patch.orderIndex !== undefined) sets.orderIndex = patch.orderIndex;
  if (patch.assignment !== undefined) {
    // 槽级 merge：未提供的槽保持现状（字段级 patch 语义延伸）。真值 = todo 表
    // JSON 列（db/schema.ts assignment 列），agent 投影随 build 槽自动派生。
    sets.assignment = {
      plan:
        patch.assignment.plan !== undefined
          ? patch.assignment.plan
          : (row.assignment?.plan ?? null),
      build:
        patch.assignment.build !== undefined
          ? patch.assignment.build
          : (row.assignment?.build ?? null),
    };
  }
  let manualPhaseApplied = false;
  if (patch.phase !== undefined && patch.phase !== row.phase) {
    manualPhaseApplied = opts.manualPhase === true && canManualMovePhase(row.phase, patch.phase);
    if (!manualPhaseApplied) assertPhaseTransition(row.phase, patch.phase);
    sets.phase = patch.phase;
    sets.phaseAt = nowMs();
  }
  if (Object.keys(sets).length > 0) {
    sets.v = row.v + 1;
    db.update(todo).set(sets).where(eq(todo.id, id)).run();
  }
  if (patch.tagIds !== undefined) {
    db.delete(todoTag).where(eq(todoTag.todoId, id)).run();
    for (const tagId of patch.tagIds) {
      db.insert(todoTag).values({ todoId: id, tagId }).run();
    }
    if (Object.keys(sets).length === 0) {
      db.update(todo)
        .set({ v: row.v + 1 })
        .where(eq(todo.id, id))
        .run();
    }
  }

  const record = getTodo(deps, id);
  if (!record) return null;
  hub.publishTodoDoc(record.teamId, record);
  // 手动改相（#160 拖拽）不挂 phase 进入通知/chief wake：拖到待验收 ≠
  // 「改动就绪」，拖到已完成 ≠ 合并落地——系统漏斗流转才触发（02 §9.1）
  if (patch.phase !== undefined && !manualPhaseApplied) {
    notifyPhaseEntry(deps, record, row.phase, patch.phase);
  }
  return record;
}

/** phase 流转（服务面统一入口：流转表校验 + phaseAt/v 维护 + 文档事件）。 */
export function setTodoPhase(
  deps: TodoDeps,
  id: string,
  to: Phase,
  extra: Partial<
    Pick<TodoRow, 'hasChanges' | 'hasPlan' | 'latestBuildId' | 'lastRunAt' | 'assignment'>
  > = {},
): TodoRecord | null {
  const { db } = deps;
  const row = getRow(deps, id);
  if (!row) return null;
  assertPhaseTransition(row.phase, to);
  db.update(todo)
    .set({ ...extra, phase: to, phaseAt: nowMs(), v: row.v + 1 })
    .where(eq(todo.id, id))
    .run();
  const record = getTodo(deps, id);
  if (!record) return null;
  deps.hub.publishTodoDoc(record.teamId, record);
  notifyPhaseEntry(deps, record, row.phase, to);
  return record;
}

/** DELETE /api/todos/{id}（DELETE_FACE：REST 同名 DELETE [推断]；
 * delete_todos 词表证据 r5 §3.1）。build 经 FK cascade 随行；step 的 buildId FK
 * 已随 M4a chief 步队列复用移除（无 build 行的 chief conv），故 step 手动清
 * （按本 todo 的 build 集）；message.conversationId 本无 FK（既有面）。 */
export function deleteTodo(deps: TodoDeps, id: string): boolean {
  const { db } = deps;
  const row = getRow(deps, id);
  if (!row) return false;
  const buildIds = db
    .select({ id: build.id })
    .from(build)
    .where(eq(build.todoId, id))
    .all()
    .map((r) => r.id);
  if (buildIds.length > 0) {
    db.delete(step).where(inArray(step.buildId, buildIds)).run();
  }
  db.delete(todo).where(eq(todo.id, id)).run();
  return true;
}

// —— GitHub 写向（#452 / ADR 0006）：自建 issue + 标题回写 ————————————————
//
// 状态机（来源两列，不新开列）：
// - `sourceKind='github-issue-self'` + `sourceRef=null` = 未建成（可重试）；
// - `sourceKind='github-issue-self'` + `sourceRef='github:o/r#N'` = 已建成；
// - `sourceKind='github-issue'`（导入面，#446）不触发本段任何出站。
// 写操作穷举律（ADR 0006 premortem 护栏三）：本段是全仓仅有的两处
// api.github.com 写入消费位——githubCreateIssue（POST）与
// githubUpdateIssueTitle（PATCH），token 一律经 openGithubToken 唯一读出点。

/** 在飞自建 issue 写出册（todoId → settled promise）：fire-and-forget 与
 * 重试入口共用——重试撞在飞 = 409（A10 重试竞态护栏，不双建）；测试面经
 * flushSelfIssueWrites 确定性等待。 */
const selfIssueInFlight = new Map<string, Promise<unknown>>();

/** 等待全部在飞自建 issue 写出落定（测试确定性钩子；失败语义 = 停留未建成，
 * 本函数永不 throw）。 */
export async function flushSelfIssueWrites(): Promise<void> {
  await Promise.all([...selfIssueInFlight.values()]);
}

/** 重试面在飞判定（route 层 409 语义用）。 */
export function selfIssueWriteInFlight(todoId: string): boolean {
  return selfIssueInFlight.has(todoId);
}

/** githubRepo 列拆 owner/repo（github-issues.ts requireGithubRepo 同律；
 * 建项目时已过 isGithubRepoRef 400 闸，lib 层出站再 encodeURIComponent）。 */
function splitGithubRepo(githubRepo: string): { owner: string; repo: string } {
  const slash = githubRepo.indexOf('/');
  return { owner: githubRepo.slice(0, slash), repo: githubRepo.slice(slash + 1) };
}

/** 自建 issue 目标判定（createTodo 关键路径，纯本地读零出站）：github 形态
 * + 连接表有行 + deps 带 box（写向开启）→ 目标在；否则 null——local/hosted/
 * 未连接 = 现行为逐字节不变（A1/A8：不建、不报错、不亮失败态）。连接行只判
 * 存在性不解密：密文损坏留给异步 job 出站时降级（停留未建成，可重试）。 */
function planSelfIssue(
  deps: TodoDeps,
  teamId: string,
  projectId: string,
): { owner: string; repo: string } | null {
  if (deps.box === undefined) return null;
  const proj = deps.db
    .select({ repoKind: project.repoKind, githubRepo: project.githubRepo })
    .from(project)
    .where(eq(project.id, projectId))
    .get();
  if (proj?.repoKind !== 'github' || proj.githubRepo === null) return null;
  if (!hasGithubConnection(deps.db, teamId)) return null;
  return splitGithubRepo(proj.githubRepo);
}

/** fire-and-forget 派发（createTodo 落库后调用；返回前零 GitHub await——
 * D2/关键路径硬约束）。失败全吞：任务已是「未建成」态，重试入口兜底。 */
function scheduleSelfIssueCreate(deps: TodoDeps, todoId: string): void {
  const pending = runSelfIssueCreate(deps, todoId)
    .catch(() => undefined)
    .finally(() => {
      if (selfIssueInFlight.get(todoId) === pending) selfIssueInFlight.delete(todoId);
    });
  selfIssueInFlight.set(todoId, pending);
}

/** 自建 issue 执行体（fire-and-forget 与重试共用）：现读 todo 行——标题用
 * **当前值**（agent 可能已回填正式标题，A13/D3：重试与后建都不用过时占
 * 位）。成功 → 补 sourceRef + v++ + 文档事件（看板实时刷新，A14）。失败 →
 * HttpError 上抛由调用面分流（schedule 吞、retry 直透）。竞态防御：出站前
 * 后两次读行，任务被删 / ref 已被补（并发重试）→ 静默放弃不覆盖。 */
async function runSelfIssueCreate(deps: TodoDeps, todoId: string): Promise<TodoRecord | null> {
  const { db, hub, box } = deps;
  const row = getRow(deps, todoId);
  if (!row || row.sourceKind !== 'github-issue-self' || row.sourceRef !== null) return null;
  if (!box) throw new HttpError(502, 'github writeback unavailable (no secret box)');
  const proj = db
    .select({ repoKind: project.repoKind, githubRepo: project.githubRepo })
    .from(project)
    .where(eq(project.id, row.projectId))
    .get();
  if (proj?.repoKind !== 'github' || proj.githubRepo === null) {
    throw new HttpError(404, 'project is not github-backed');
  }
  const token = openGithubToken({ db, box }, row.teamId);
  if (token === null) throw new HttpError(404, 'github connection not found');
  const { owner, repo } = splitGithubRepo(proj.githubRepo);
  const { number } = await githubCreateIssue(deps.githubFetch ?? fetch, token, owner, repo, {
    title: row.title,
    body: row.spec,
  });
  const fresh = getRow(deps, todoId);
  if (!fresh || fresh.sourceRef !== null) return null; // 删除/已补（并发面）→ 放弃
  const ref = githubIssueSourceRef(owner, repo, number);
  db.update(todo)
    .set({ sourceRef: ref, v: fresh.v + 1 })
    .where(eq(todo.id, todoId))
    .run();
  const record = getTodo(deps, todoId);
  if (record) hub.publishTodoDoc(record.teamId, record);
  return record;
}

/** POST /api/todos/{id}/github-issue/retry 服务面（AC3 重试入口）：未建成 →
 * 同步重试建站（本请求 await 上游——重试非建任务关键路径，错误直透映射成
 * 响应状态）。已建成 → 409（A11 不建第二枚）；在飞（fire-and-forget 未落
 * 定或并发重试）→ 409（A10 竞态）；非自建来源 → 404。重试自身也进在飞册
 * ——两次并发重试只有一个出站。 */
export async function retrySelfIssueCreate(deps: TodoDeps, todoId: string): Promise<TodoRecord> {
  const row = getRow(deps, todoId);
  if (!row) throw new HttpError(404, `todo ${todoId}`);
  if (row.sourceKind !== 'github-issue-self') {
    throw new HttpError(404, 'todo has no self-created github issue');
  }
  if (row.sourceRef !== null) throw new HttpError(409, 'github issue already created');
  if (selfIssueInFlight.has(todoId)) {
    throw new HttpError(409, 'github issue creation already in flight');
  }
  const raw = runSelfIssueCreate(deps, todoId);
  const guarded = raw
    .catch(() => undefined)
    .finally(() => {
      if (selfIssueInFlight.get(todoId) === guarded) selfIssueInFlight.delete(todoId);
    });
  selfIssueInFlight.set(todoId, guarded);
  const record = await raw; // 上游失败直透（404/429/502 映射归 lib 面）
  if (!record) throw new HttpError(409, 'github issue already created');
  return record;
}

/** 回填标题写进 issue（ADR 0006 D3/D5，setTaskMeta server 侧收口调用）：
 * 仅自建已建成任务出站 PATCH；未建成静默跳过（B3：后建 issue 时自然用当前
 * 标题）。失败上抛由调用面吞（B2：本地标题已生效，relay 不回滚不报错，
 * 漂移交只读回显提示面）。 */
export async function writebackSelfIssueTitle(
  deps: TodoDeps,
  todoId: string,
  title: string,
): Promise<void> {
  const { db, box } = deps;
  if (!box) return;
  const row = getRow(deps, todoId);
  if (!row || row.sourceKind !== 'github-issue-self' || row.sourceRef === null) return;
  const parsed = parseGithubIssueSourceRef(row.sourceRef);
  if (parsed === null) return;
  const token = openGithubToken({ db, box }, row.teamId);
  if (token === null) return;
  await githubUpdateIssueTitle(
    deps.githubFetch ?? fetch,
    token,
    parsed.owner,
    parsed.repo,
    parsed.issueNumber,
    title,
  );
}
