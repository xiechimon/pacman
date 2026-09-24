// M4a Chief 编排行为对拍（04 §4 M4 组 = r5 §2–§5 六项 + 结构契约 02 §4.3）。
// 判定口径（04 §1 A4）：策略层（措辞→spec 的具体变换文本、分派权重决策）由 LLM
// 侧产，本层测「宿主机制」——relay 工具落库/溯源、watch-wake 三触发、驳回 v2
// diff、双 Agent 分槽、绑定/记忆不迁移。[推断]/[设计] 项不冒充实测。

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CHIEF_REMOTE_TOOLS, CHIEF_TOOL_NAMES, CHIEF_WATCH_REASON_DISPATCH } from '@pacman/shared';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, test } from 'vitest';
import {
  agentMemory,
  agent as agentTable,
  build as buildTable,
  chiefMessage,
  chief as chiefTable,
  chiefThread,
  plan as planTable,
  step as stepTable,
  todo as todoTable,
} from '../src/db/schema.js';
import { HttpError } from '../src/lib/errors.js';
import { newRecordId, newUuidv7, nowMs } from '../src/lib/ids.js';
import {
  addChiefWatch,
  composeChiefSystemPrompt,
  getChiefEnvelope,
  patchChief,
  sendChiefMessage,
  triggerChiefWakes,
} from '../src/services/chief.js';
import { type ChiefToolCtx, executeChiefTool } from '../src/services/chief-tools.js';
import { planDocumentDiff } from '../src/services/documents.js';
import { getTodo, setTodoPhase } from '../src/services/todos.js';
import { bootServer, postProject, req, type TestServer } from './helpers.js';

const AGENT_ID = 'agent-chief-1';
const AGENT2_ID = 'agent-chief-2';

let s: TestServer;
let teamId: string;
let userId: string;
let chiefId: string;
let threadId: string;
let projectId: string;

function toolDeps() {
  return {
    db: s.db,
    hub: s.hub,
    machineHub: s.machineHub,
    box: s.secretBox,
    user: s.user,
    reposDir: s.reposDir,
  };
}
function ctx(over: Partial<ChiefToolCtx> = {}): ChiefToolCtx {
  return {
    teamId,
    userId,
    chiefId,
    threadId,
    chiefAgentId: AGENT_ID,
    conversationId: threadId,
    ...over,
  };
}
async function relay(name: string, params: Record<string, unknown>, over?: Partial<ChiefToolCtx>) {
  const text = await executeChiefTool(toolDeps(), ctx(over), name, params);
  return JSON.parse(text) as unknown;
}

function seedAgent(id: string, description: string, modelId = 'stub-model') {
  s.db
    .insert(agentTable)
    .values({
      id,
      teamId,
      displayName: id,
      description,
      status: 'active',
      avatarUrl: null,
      provider: 'stub-gw',
      modelId,
      thinkingLevel: null,
      tools: [],
      secrets: [],
      skills: [],
      mcpServers: [],
    })
    .run();
}

function seedChiefThread(): void {
  const now = nowMs();
  s.db
    .insert(chiefTable)
    .values({
      id: chiefId,
      userId,
      teamId,
      agentId: AGENT_ID,
      charter: '',
      watches: [],
      wakes: [],
      createdAt: now,
    })
    .run();
  s.db
    .insert(chiefThread)
    .values({
      id: threadId,
      chiefId,
      userId,
      teamId,
      title: '帮 demo 写一份…',
      createdAt: now,
      updatedAt: now,
      sessionRuntime: 'pi',
      sessionId: '',
      sessionOpenedAt: now,
      toolDefHashes: {},
      toolResultHashes: {},
    })
    .run();
}

beforeEach(async () => {
  s = bootServer();
  teamId = s.team.id;
  userId = s.user.id;
  chiefId = `chief-${userId}-${teamId}`;
  threadId = `chief-${newUuidv7()}`;
  projectId = await postProject(s.app, 'demo');
  seedAgent(AGENT_ID, '负责撰写与润色各类文档。');
  seedAgent(AGENT2_ID, '负责代码实现与工程修改。', 'stub-model-2');
  seedChiefThread();
});

// —— AC: Chief 线程面落库（chief_thread/chief_message，01 §6）———————————————

describe('Chief 线程面落库（02 §4.3/r5 §3.6）', () => {
  test('发消息 → chief_thread + chief_message(user) 落库 + chief 步入队', async () => {
    const res = await req(s.app, 'POST', `/api/teams/${teamId}/chief/threads`, {
      content: '帮 demo 写一份 CONTRIBUTING.md 贡献指南。',
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { thread: { id: string }; message: { role: string } };
    expect(body.thread.id.startsWith('chief-')).toBe(true);
    expect(body.message.role).toBe('user');
    // 线程行落库
    const threads = s.db.select().from(chiefThread).all();
    expect(threads.length).toBeGreaterThanOrEqual(2); // seedChiefThread + 新建
    // user 消息落 chief_message
    const msgs = s.db
      .select()
      .from(chiefMessage)
      .where(eq(chiefMessage.threadId, body.thread.id))
      .all();
    expect(msgs.some((m) => m.role === 'user')).toBe(true);
    // chief 步入队（kind chief，buildId = conv id = thread id）
    const steps = s.db.select().from(stepTable).where(eq(stepTable.buildId, body.thread.id)).all();
    expect(steps).toHaveLength(1);
    expect(steps[0]!.kind).toBe('chief');
    expect(steps[0]!.status).toBe('pending');
  });

  test('GET /conversations/chief-<threadId>/messages 读 chief_message（非 message 表）', async () => {
    await sendChiefMessage(
      { db: s.db, hub: s.hub, machineHub: s.machineHub, user: s.user },
      teamId,
      { threadId, content: '第一条' },
    );
    const res = await req(s.app, 'GET', `/api/conversations/${threadId}/messages`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { messages: { role: string; content: unknown }[] };
    expect(body.messages.some((m) => m.role === 'user' && m.content === '第一条')).toBe(true);
  });

  test('未绑定 Agent → 发消息 409（门控条 canon server 半，r5 §2）', async () => {
    s.db.update(chiefTable).set({ agentId: null }).where(eq(chiefTable.id, chiefId)).run();
    expect(() =>
      sendChiefMessage({ db: s.db, hub: s.hub, machineHub: s.machineHub, user: s.user }, teamId, {
        threadId,
        content: 'x',
      }),
    ).toThrow(HttpError);
  });
});

// —— AC: 设置齿轮 4 tab 行为 + 绑定 PATCH /chief + 记忆不迁移（r5 §2/§3）——————

describe('总管设置 4 tab + PATCH /chief（r5 §2）', () => {
  test('GET /chief 封套四字段一一对应 4 tab（agent/charter/watches/wakes）', async () => {
    const res = await req(s.app, 'GET', `/api/teams/${teamId}/chief`);
    expect(res.status).toBe(200);
    const env = getChiefEnvelope(
      { db: s.db, hub: s.hub, machineHub: s.machineHub, user: s.user },
      teamId,
    );
    // Agent tab → agent 绑定 + agentActor 全记录
    expect(env.chief.agent).toEqual({ agentId: AGENT_ID });
    expect(env.agentActor?.id).toBe(AGENT_ID);
    // 章程 tab → charter
    expect(typeof env.chief.charter).toBe('string');
    // 关注与提醒 tab → watches/wakes
    expect(Array.isArray(env.watches)).toBe(true);
    expect(Array.isArray(env.wakes)).toBe(true);
    const wire = (await res.json()) as typeof env;
    expect(wire.chief.id).toBe(chiefId);
  });

  test('PATCH /chief 绑定新 Agent = 换绑（记忆不迁移：无记忆复制动作）', async () => {
    // 记忆存在原绑定 Agent 存储（r5 §6 共用）；换绑后不迁移。
    await relay('save_memory', { title: '旧记忆', content: '属于原 Agent' });
    const res = await req(s.app, 'PATCH', `/api/teams/${teamId}/chief`, {
      agent: { agentId: AGENT2_ID, thinkingLevel: null },
    });
    expect(res.status).toBe(200);
    const env = (await res.json()) as {
      chief: { agent: { agentId: string } | null };
      agentActor: { id: string } | null;
    };
    expect(env.chief.agent).toEqual({ agentId: AGENT2_ID });
    expect(env.agentActor?.id).toBe(AGENT2_ID);
    // 记忆不迁移：旧记忆仍在原 Agent（AGENT_ID）名下，未复制到 AGENT2_ID。
    const mems = s.db.select().from(agentMemory).all();
    expect(mems.every((m) => m.agentId === AGENT_ID)).toBe(true);
    expect(mems.some((m) => m.agentId === AGENT2_ID)).toBe(false);
  });

  test('PATCH /chief charter 槽落库（章程 tab 保存面 [推断]）', async () => {
    const res = await req(s.app, 'PATCH', `/api/teams/${teamId}/chief`, {
      charter: '模型路由：文档任务用 scribe。',
    });
    expect(res.status).toBe(200);
    const env = (await res.json()) as { chief: { charter: string } };
    expect(env.chief.charter).toContain('模型路由');
    const patched = patchChief(
      { db: s.db, hub: s.hub, machineHub: s.machineHub, user: s.user },
      teamId,
      { charter: '' },
    );
    expect(patched.chief.charter).toBe('');
  });

  test('PATCH /chief compactionModel 槽往返：写→GET 回显同值；缺省不动；null 清空（#203）', async () => {
    type Env = { chief: { compactionModel: { provider: string; modelId: string } | null } };
    // 默认 null（= 与 Chief 相同）。
    const fresh = (await (await req(s.app, 'GET', `/api/teams/${teamId}/chief`)).json()) as Env;
    expect(fresh.chief.compactionModel).toBeNull();
    // 写 → 响应回显同值。
    const model = { provider: 'stub-gw', modelId: 'm-fast' };
    const set = await req(s.app, 'PATCH', `/api/teams/${teamId}/chief`, {
      compactionModel: model,
    });
    expect(set.status).toBe(200);
    expect(((await set.json()) as Env).chief.compactionModel).toEqual(model);
    // GET 回显同值。
    const got = (await (await req(s.app, 'GET', `/api/teams/${teamId}/chief`)).json()) as Env;
    expect(got.chief.compactionModel).toEqual(model);
    // 缺省不动：PATCH 别的槽不清压缩模型。
    const other = await req(s.app, 'PATCH', `/api/teams/${teamId}/chief`, { charter: '不动它' });
    expect(((await other.json()) as Env).chief.compactionModel).toEqual(model);
    // null 清空 → GET 回显 null。
    const cleared = await req(s.app, 'PATCH', `/api/teams/${teamId}/chief`, {
      compactionModel: null,
    });
    expect(cleared.status).toBe(200);
    expect(((await cleared.json()) as Env).chief.compactionModel).toBeNull();
    const after = (await (await req(s.app, 'GET', `/api/teams/${teamId}/chief`)).json()) as Env;
    expect(after.chief.compactionModel).toBeNull();
  });

  test('PATCH /chief compactionModel 裸字符串/缺字段 → 400（#203）', async () => {
    const bare = await req(s.app, 'PATCH', `/api/teams/${teamId}/chief`, {
      compactionModel: 'm-fast',
    });
    expect(bare.status).toBe(400);
    const partial = await req(s.app, 'PATCH', `/api/teams/${teamId}/chief`, {
      compactionModel: { provider: 'stub-gw' },
    });
    expect(partial.status).toBe(400);
  });

  test('记忆 tab = 与绑定 Agent 共用存储（GET agents/{aid}/memories）', async () => {
    await relay('save_memory', { title: '共用记忆', content: 'chief 与 agent 同源' });
    const res = await req(s.app, 'GET', `/api/teams/${teamId}/agents/${AGENT_ID}/memories`);
    expect(res.status).toBe(200);
    const mems = (await res.json()) as { title: string; agentId: string }[];
    expect(mems.some((m) => m.title === '共用记忆' && m.agentId === AGENT_ID)).toBe(true);
  });

  test('systemPrompt 合成含 charter + 资源清单 + 记忆（02 §4.3 输入契约）', () => {
    s.db
      .update(chiefTable)
      .set({ charter: '优先文档 Agent' })
      .where(eq(chiefTable.id, chiefId))
      .run();
    const prompt = composeChiefSystemPrompt(
      { db: s.db, hub: s.hub, machineHub: s.machineHub, user: s.user },
      teamId,
    );
    expect(prompt).toContain('优先文档 Agent'); // charter
    expect(prompt).toContain('agents:'); // 团队资源清单
    expect(prompt).toContain('措辞→spec'); // 策略指引
  });
});

// —— AC r5 §3.2: 措辞→spec 三段变换（宿主机制：溯源落库）———————————————

describe('措辞→spec 三段变换 + 溯源（r5 §3.2）', () => {
  test('create_todo 落三段式 spec 原文 + 溯源 createdBy/sourceBuildId/ownerId', async () => {
    const spec = [
      '> 帮 demo 写一份 CONTRIBUTING.md 贡献指南',
      '',
      '要求：',
      '- 说明怎么给 Agent 提任务',
      '- 说明怎么验收改动',
      '',
      '补充信息（探测得出，非用户确认）：',
      '- 当前仓库仅有 README.md',
    ].join('\n');
    const created = (await relay('create_todo', {
      projectId,
      title: '编写 CONTRIBUTING.md 贡献指南',
      spec,
    })) as {
      id: string;
      createdBy: string | null;
      ownerId: string | null;
      sourceBuildId: string | null;
      spec: string;
    };
    // 三段式 spec 原样落库（宿主不改写 LLM 产出的 spec 文本）
    expect(created.spec).toContain('> 帮 demo'); // ① 用户原文 blockquote
    expect(created.spec).toContain('要求：'); // ② 要求 bullet
    expect(created.spec).toContain('补充信息（探测得出，非用户确认）：'); // ③ 补充信息段
    // 溯源三字段（r5 §3.2：sourceBuildId = chief id `chief-<userId>-<teamId>`）
    expect(created.createdBy).toBe(AGENT_ID); // = Chief 绑定 Agent id
    expect(created.ownerId).toBe(userId); // = 用户
    expect(created.sourceBuildId).toBe(chiefId); // = chief 实例 id（非 thread/conv id）
    // 落库校验
    const row = s.db.select().from(todoTable).where(eq(todoTable.id, created.id)).get()!;
    expect(row.sourceBuildId).toBe(chiefId);
    expect(row.createdBy).toBe(AGENT_ID);
  });
});

// —— AC r5 §3.3/§3.4/§5: 分派职责权重 + 单 todo 直派 + 双 Agent 分槽 ————————

describe('分派 + 单 todo 直派 + 双 Agent assignment（r5 §3.3/§3.4/§5）', () => {
  test('agents 读工具返回职责文本（分派权重输入）', async () => {
    const agents = (await relay('agents', {})) as { id: string; description: string }[];
    expect(agents.find((a) => a.id === AGENT_ID)?.description).toContain('文档');
    expect(agents.find((a) => a.id === AGENT2_ID)?.description).toContain('代码');
  });

  test('run_builds 默认 withPlan:false 直派 + triggerSource:chief + assignment 落槽', async () => {
    const todoRec = (await relay('create_todo', { projectId, title: '写文档', spec: 's' })) as {
      id: string;
    };
    const out = (await relay('run_builds', {
      todoIds: [todoRec.id],
      assignment: { build: { agentId: AGENT_ID } },
    })) as { builds: { withPlan: boolean; triggerSource: string }[] };
    expect(out.builds[0]!.withPlan).toBe(false); // 单请求单 todo 直派（跳过规划）
    expect(out.builds[0]!.triggerSource).toBe('chief');
    const row = s.db.select().from(todoTable).where(eq(todoTable.id, todoRec.id)).get()!;
    expect(row.assignment?.build?.agentId).toBe(AGENT_ID);
    expect(row.phase).toBe('queued');
    // 首步 = 执行步（withPlan:false → build，非 plan）
    const steps = s.db
      .select()
      .from(stepTable)
      .where(eq(stepTable.buildId, row.latestBuildId!))
      .all();
    expect(steps[0]!.kind).toBe('build');
  });

  test('双 Agent 分派：assignment.plan ≠ assignment.build 两槽独立落库（r5 §5）', async () => {
    const todoRec = (await relay('create_todo', {
      projectId,
      title: '规划执行分离',
      spec: 's',
    })) as { id: string };
    await relay('run_builds', {
      todoIds: [todoRec.id],
      assignment: { plan: { agentId: AGENT2_ID }, build: { agentId: AGENT_ID } },
      withPlan: true,
    });
    const row = s.db.select().from(todoTable).where(eq(todoTable.id, todoRec.id)).get()!;
    expect(row.assignment?.plan?.agentId).toBe(AGENT2_ID); // 规划 = 代码 Agent
    expect(row.assignment?.build?.agentId).toBe(AGENT_ID); // 执行 = 文档 Agent
    // 首步 = 规划步（withPlan:true）
    const steps = s.db
      .select()
      .from(stepTable)
      .where(eq(stepTable.buildId, row.latestBuildId!))
      .all();
    expect(steps[0]!.kind).toBe('plan');
  });
});

// —— AC r5 §3.5: watch/wake 三触发 ————————————————————————————————————————

describe('watch/wake 主动回路三触发（r5 §3.5）', () => {
  function seedWatchedTodo(): string {
    const id = newRecordId();
    const now = nowMs();
    s.db
      .insert(todoTable)
      .values({
        id,
        teamId,
        projectId,
        title: '被关注任务',
        spec: '',
        phase: 'todo',
        phaseAt: now,
        seqNum: 1,
        orderIndex: 0,
        assignment: null,
        latestBuildId: null,
        lastRunAt: null,
        hasChanges: false,
        hasPlan: false,
        sourceTodo: null,
        v: 1,
        createdBy: null,
        ownerId: userId,
        sourceBuildId: null,
      })
      .run();
    return id;
  }

  test('run_builds 派工即自动 watch（reason canon）', async () => {
    const todoRec = (await relay('create_todo', { projectId, title: 't', spec: 's' })) as {
      id: string;
    };
    await relay('run_builds', {
      todoIds: [todoRec.id],
      assignment: { build: { agentId: AGENT_ID } },
    });
    const env = getChiefEnvelope(
      { db: s.db, hub: s.hub, machineHub: s.machineHub, user: s.user },
      teamId,
    );
    expect(env.watches).toHaveLength(1);
    expect(env.watches[0]!.reason).toBe(CHIEF_WATCH_REASON_DISPATCH);
    expect(env.watches[0]!.todoId).toBe(todoRec.id);
  });

  test('gate 触发（停 review）→ chief wake 步入队，watch 保留', async () => {
    const todoId = seedWatchedTodo();
    const rec = getTodo({ db: s.db, hub: s.hub, user: s.user }, todoId)!;
    addChiefWatch(
      { db: s.db, hub: s.hub, machineHub: s.machineHub, user: s.user },
      { teamId, todo: rec, projectName: 'demo', threadId },
    );
    // 停驻 review（gate）
    setTodoPhase(
      { db: s.db, hub: s.hub, machineHub: s.machineHub, user: s.user },
      todoId,
      'queued',
    );
    const before = s.db
      .select()
      .from(stepTable)
      .where(eq(stepTable.buildId, threadId))
      .all().length;
    triggerChiefWakes(
      { db: s.db, hub: s.hub, machineHub: s.machineHub, user: s.user },
      getTodo({ db: s.db, hub: s.hub, user: s.user }, todoId)!,
      'review',
    );
    const after = s.db.select().from(stepTable).where(eq(stepTable.buildId, threadId)).all();
    expect(after.length).toBe(before + 1);
    expect(after.at(-1)!.kind).toBe('chief');
    expect(after.at(-1)!.prompt).toContain('[wake:gate]');
    // watch 保留（gate 不解除）
    const env = getChiefEnvelope(
      { db: s.db, hub: s.hub, machineHub: s.machineHub, user: s.user },
      teamId,
    );
    expect(env.watches).toHaveLength(1);
  });

  test('settle 触发（done）→ wake + watch 自动解除（r5 §3.5）', async () => {
    const todoId = seedWatchedTodo();
    const rec = getTodo({ db: s.db, hub: s.hub, user: s.user }, todoId)!;
    addChiefWatch(
      { db: s.db, hub: s.hub, machineHub: s.machineHub, user: s.user },
      { teamId, todo: rec, projectName: 'demo', threadId },
    );
    triggerChiefWakes(
      { db: s.db, hub: s.hub, machineHub: s.machineHub, user: s.user },
      rec,
      'done',
    );
    const steps = s.db.select().from(stepTable).where(eq(stepTable.buildId, threadId)).all();
    expect(steps.at(-1)!.prompt).toContain('[wake:settle]');
    const env = getChiefEnvelope(
      { db: s.db, hub: s.hub, machineHub: s.machineHub, user: s.user },
      teamId,
    );
    expect(env.watches).toHaveLength(0); // settle 后自动解除
  });

  test('failed 触发 → wake（法证式汇报指引）+ watch 自动解除', async () => {
    const todoId = seedWatchedTodo();
    const rec = getTodo({ db: s.db, hub: s.hub, user: s.user }, todoId)!;
    addChiefWatch(
      { db: s.db, hub: s.hub, machineHub: s.machineHub, user: s.user },
      { teamId, todo: rec, projectName: 'demo', threadId },
    );
    triggerChiefWakes(
      { db: s.db, hub: s.hub, machineHub: s.machineHub, user: s.user },
      rec,
      'failed',
    );
    const steps = s.db.select().from(stepTable).where(eq(stepTable.buildId, threadId)).all();
    expect(steps.at(-1)!.prompt).toContain('[wake:failed]');
    expect(steps.at(-1)!.prompt).toContain('machines'); // 先调 machines 工具核实环境
    const env = getChiefEnvelope(
      { db: s.db, hub: s.hub, machineHub: s.machineHub, user: s.user },
      teamId,
    );
    expect(env.watches).toHaveLength(0);
  });
});

// —— AC r5 §6: memory save_memory（指令触发 + 溯源 + 配额）———————————————

describe('save_memory 写路径（r5 §6）', () => {
  test('条目含三级溯源（sourceBuildId = chief conv id）', async () => {
    const mem = (await relay('save_memory', { title: 't', content: 'c', projectId })) as {
      agentId: string;
      sourceBuildId: string | null;
      projectId: string | null;
    };
    expect(mem.agentId).toBe(AGENT_ID); // 共用绑定 Agent 存储
    expect(mem.sourceBuildId).toBe(threadId);
    expect(mem.projectId).toBe(projectId);
  });

  test('配额 100 条/Agent（超出 → 409）', async () => {
    for (let i = 0; i < 100; i++) {
      s.db
        .insert(agentMemory)
        .values({
          id: newRecordId(),
          agentId: AGENT_ID,
          teamId,
          title: `m${i}`,
          content: 'c',
          projectId: null,
          sourceTodoId: null,
          sourceBuildId: null,
          createdAt: nowMs(),
          updatedAt: nowMs(),
        })
        .run();
    }
    let threw = false;
    try {
      await relay('save_memory', { title: 'overflow', content: 'c' });
    } catch (err) {
      threw = err instanceof HttpError && err.status === 409;
    }
    expect(threw).toBe(true);
  });

  test('memories 读回 + delete_memory', async () => {
    const mem = (await relay('save_memory', { title: 'x', content: 'y' })) as { id: string };
    const list = (await relay('memories', {})) as { id: string }[];
    expect(list.some((m) => m.id === mem.id)).toBe(true);
    await relay('delete_memory', { memoryId: mem.id });
    const after = (await relay('memories', {})) as { id: string }[];
    expect(after.some((m) => m.id === mem.id)).toBe(false);
  });
});

// —— AC r5 §4: 驳回 → plan v2 + unified diff ————————————————

describe('驳回回路 plan v2 + unified diff（r5 §4/02 §4.2）', () => {
  test('documents/{id}/diff = plan.md 文件级 unified diff（v1→v2 + hunk 头）', async () => {
    const todoRec = (await relay('create_todo', { projectId, title: 'plan diff', spec: 's' })) as {
      id: string;
    };
    const buildId = newUuidv7();
    const now = nowMs();
    s.db
      .insert(buildTable)
      .values({
        id: buildId,
        todoId: todoRec.id,
        withPlan: true,
        triggerSource: 'user',
        createdAt: now,
      })
      .run();
    const v1 = ['# 方案', '', 'Context: 后缀用「·r3-lifecycle」。', 'Changes: 改 README。'].join(
      '\n',
    );
    const v2 = [
      '# 方案',
      '',
      'Context: 后缀用「·静态演示页」，不重复项目名。',
      'Changes: 改 README。',
    ].join('\n');
    const id1 = newRecordId();
    const id2 = newRecordId();
    s.db
      .insert(planTable)
      .values({ id: id1, buildId, version: 1, content: v1, createdAt: now })
      .run();
    s.db
      .insert(planTable)
      .values({ id: id2, buildId, version: 2, content: v2, createdAt: now })
      .run();
    s.db.update(buildTable).set({ planDocId: id2 }).where(eq(buildTable.id, buildId)).run();

    const diff = planDocumentDiff(s.db, id2);
    expect(diff.fromVersion).toBe(1);
    expect(diff.toVersion).toBe(2);
    expect(diff.files).toHaveLength(1);
    expect(diff.files[0]!.path).toBe('plan.md');
    expect(diff.files[0]!.hunks[0]!.header).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@$/);
    // v2 忠实执行反馈：删「·r3-lifecycle」行、加「·静态演示页」行
    const lines = diff.files[0]!.hunks[0]!.lines;
    expect(lines.some((l) => l.startsWith('-') && l.includes('r3-lifecycle'))).toBe(true);
    expect(lines.some((l) => l.startsWith('+') && l.includes('静态演示页'))).toBe(true);
    expect(diff.files[0]!.additions).toBeGreaterThanOrEqual(1);
    expect(diff.files[0]!.deletions).toBeGreaterThanOrEqual(1);
  });

  test('驳回 → 重规划步入队携带 feedback 指令（v2 忠实执行反馈的宿主半，r5 §4）', async () => {
    const todoRec = (await relay('create_todo', { projectId, title: 't', spec: 's' })) as {
      id: string;
    };
    const out = (await relay('run_builds', {
      todoIds: [todoRec.id],
      assignment: { plan: { agentId: AGENT_ID } },
      withPlan: true,
    })) as { builds: { id: string }[] };
    const buildId = out.builds[0]!.id;
    // run_builds 已置 queued；模拟规划步成 → planning → confirm
    setTodoPhase(
      { db: s.db, hub: s.hub, machineHub: s.machineHub, user: s.user },
      todoRec.id,
      'planning',
    );
    setTodoPhase(
      { db: s.db, hub: s.hub, machineHub: s.machineHub, user: s.user },
      todoRec.id,
      'confirm',
    );
    // 驳回
    const res = await req(s.app, 'POST', `/api/builds/${buildId}/steps`, {
      action: 'revision',
      side: 'plan',
      feedback: '后缀不要重复项目名',
      clientMessageId: newUuidv7(),
    });
    expect(res.status).toBe(202);
    // 重规划步（plan）携带 feedback 指令 prompt
    const steps = s.db.select().from(stepTable).where(eq(stepTable.buildId, buildId)).all();
    const replan = steps.filter((st) => st.kind === 'plan').at(-1)!;
    expect(replan.prompt).toContain('后缀不要重复项目名');
  });
});

// —— 结构契约: 49 词表 relay 白名单 ———————————————————————————————————————

describe('49 词表 relay 执行面（02 §4.3）', () => {
  test('词表外工具名 → 400（白名单纪律，不执行）', async () => {
    let status = 0;
    try {
      await relay('not_a_tool', {});
    } catch (err) {
      status = err instanceof HttpError ? err.status : 0;
    }
    expect(status).toBe(400);
  });

  test('读工具 replaySafe 标记与执行一致（抽样 projects/todos/machines）', async () => {
    for (const name of ['projects', 'todos', 'machines']) {
      const def = CHIEF_REMOTE_TOOLS.find((t) => t.name === name)!;
      expect(def.replaySafe).toBe(true);
      expect(await relay(name, {})).toBeDefined();
    }
  });

  test('词表键集 = r5 raw toolDefHashes 全键（一手来源防漂移，node fs 面）', () => {
    const raw = resolve(
      import.meta.dirname,
      '../../../docs/research/assets/r5/raw/chief-threads-testA.json',
    );
    const doc = JSON.parse(readFileSync(raw, 'utf8')) as unknown;
    const found: string[][] = [];
    const walk = (o: unknown) => {
      if (Array.isArray(o)) return o.forEach(walk);
      if (o !== null && typeof o === 'object') {
        const rec = o as Record<string, unknown>;
        if (rec.toolDefHashes && typeof rec.toolDefHashes === 'object') {
          found.push(Object.keys(rec.toolDefHashes as Record<string, unknown>));
        }
        Object.values(rec).forEach(walk);
      }
    };
    walk(doc);
    expect(found.length).toBeGreaterThan(0);
    expect(CHIEF_TOOL_NAMES).toEqual([...(found[0] as string[])].sort());
  });
});
