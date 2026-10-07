// M4a Chief 编排行为对拍（04 §4 M4 组 = r5 §2–§5 六项 + 结构契约 02 §4.3）。
// 判定口径（04 §1 A4）：策略层（措辞→spec 的具体变换文本、分派权重决策）由 LLM
// 侧产，本层测「宿主机制」——relay 工具落库/溯源、watch-wake 三触发、驳回 v2
// diff、双 Agent 分槽、绑定/记忆不迁移。[推断]/[设计] 项不冒充实测。

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  CHIEF_REMOTE_TOOLS,
  CHIEF_TOOL_NAMES,
  CHIEF_TOOLS_ADDED,
  CHIEF_TOOLS_REMOVED,
  CHIEF_WATCH_REASON_DISPATCH,
} from '@pacman/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import {
  agentMemory,
  agent as agentTable,
  build as buildTable,
  chiefMessage,
  chief as chiefTable,
  chiefThread,
  machine as machineTable,
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
import { bootServer, issueApiKey, postProject, req, type TestServer } from './helpers.js';

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
    attachmentsDir: s.attachmentsDir,
    skillsDir: s.skillsDir,
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

// #707 models 工具的 claude-code 行：执行机上报播种（machine 行直插
// claudeCodeReport——上报语义，不读测试机真实 ~/.claude）。
function seedMachineReport(
  name: string,
  report: { installed: boolean; hostname: string; models: { id: string; name: string }[] },
): void {
  s.db
    .insert(machineTable)
    .values({ id: `machine-${name}`, teamId, name, claudeCodeReport: report })
    .run();
}

// #627 models 工具：claude-code 段 homeDir 注入位（mkdtemp 隔离目录，
// 可选写入 settings.json 钉住槽位内容）。
const claudeHomes: string[] = [];
function claudeHome(settingsJson?: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'pacman-chief-models-'));
  claudeHomes.push(dir);
  if (settingsJson !== undefined) {
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(join(dir, '.claude', 'settings.json'), settingsJson);
  }
  return dir;
}
afterAll(() => {
  for (const dir of claudeHomes.splice(0)) rmSync(dir, { recursive: true, force: true });
});

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

// —— AC: 收单回落（#774）：存量主模型槽不在候选里 → 同步愈合 + 上报 ————————

describe('收单回落：存量主模型槽不在候选里 → 同步愈合 + 上报（#774）', () => {
  function setSlot(value: { provider: string; modelId: string } | null) {
    s.db.update(chiefTable).set({ model: value }).where(eq(chiefTable.id, chiefId)).run();
  }
  function slotNow() {
    return (
      s.db
        .select({ model: chiefTable.model })
        .from(chiefTable)
        .where(eq(chiefTable.id, chiefId))
        .get()?.model ?? null
    );
  }
  function send(opts?: { homeDir?: string }) {
    return sendChiefMessage(
      { db: s.db, hub: s.hub, machineHub: s.machineHub, user: s.user },
      teamId,
      { threadId: null, content: '回落探针。' },
      opts,
    );
  }

  test('槽 null → 无动作（最常见路零语义变化）', () => {
    const res = send({ homeDir: claudeHome(JSON.stringify({ model: 'new-model' })) });
    expect(res.modelFallback).toBeNull();
    expect(slotNow()).toBeNull();
  });

  test('槽命中候选 → 保留 + modelFallback null', () => {
    setSlot({ provider: 'claude-code', modelId: 'new-model' });
    const res = send({ homeDir: claudeHome(JSON.stringify({ model: 'new-model' })) });
    expect(res.modelFallback).toBeNull();
    expect(slotNow()).toEqual({ provider: 'claude-code', modelId: 'new-model' });
  });

  test('槽 stale（claude-code 旧 id）→ 置 null + 上报原值 + 回合照常入队', () => {
    const stale = { provider: 'claude-code', modelId: 'old-model' };
    setSlot(stale);
    const res = send({ homeDir: claudeHome(JSON.stringify({ model: 'new-model' })) });
    expect(res.modelFallback).toEqual(stale);
    expect(slotNow()).toBeNull();
    // 回落不是拒收：回合照常入队，claim 读到的是愈合后的 null（= 继承）。
    const steps = s.db.select().from(stepTable).where(eq(stepTable.buildId, res.thread.id)).all();
    expect(steps).toHaveLength(1);
    expect(steps[0]!.status).toBe('pending');
  });

  test('custom provider 存量值（无对应段）→ 不动（执行面仍可用，候选面无权裁决）', () => {
    const custom = { provider: 'my-relay', modelId: 'm-x' };
    setSlot(custom);
    const res = send({ homeDir: claudeHome(JSON.stringify({ model: 'new-model' })) });
    expect(res.modelFallback).toBeNull();
    expect(slotNow()).toEqual(custom);
  });

  test('settings.json 缺失（段空）→ claude-code 存量值照样愈合', () => {
    const stale = { provider: 'claude-code', modelId: 'old-model' };
    setSlot(stale);
    const res = send({ homeDir: claudeHome() });
    expect(res.modelFallback).toEqual(stale);
    expect(slotNow()).toBeNull();
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

  test('PATCH /chief model 槽往返：写→GET 回显同值；缺省不动；null 清空回绑定 Agent 继承（#615）', async () => {
    type Env = { chief: { model: { provider: string; modelId: string } | null } };
    // 默认 null（= 继承绑定 Agent 模型）。
    const fresh = (await (await req(s.app, 'GET', `/api/teams/${teamId}/chief`)).json()) as Env;
    expect(fresh.chief.model).toBeNull();
    // 写 → 响应回显同值。
    const model = { provider: 'stub-gw', modelId: 'm-override' };
    const set = await req(s.app, 'PATCH', `/api/teams/${teamId}/chief`, { model });
    expect(set.status).toBe(200);
    expect(((await set.json()) as Env).chief.model).toEqual(model);
    // GET 回显同值。
    const got = (await (await req(s.app, 'GET', `/api/teams/${teamId}/chief`)).json()) as Env;
    expect(got.chief.model).toEqual(model);
    // 缺省不动：PATCH 别的槽不清主模型覆盖。
    const other = await req(s.app, 'PATCH', `/api/teams/${teamId}/chief`, { charter: '不动它' });
    expect(((await other.json()) as Env).chief.model).toEqual(model);
    // null 清空 → GET 回显 null（回继承）。
    const cleared = await req(s.app, 'PATCH', `/api/teams/${teamId}/chief`, { model: null });
    expect(cleared.status).toBe(200);
    expect(((await cleared.json()) as Env).chief.model).toBeNull();
    const after = (await (await req(s.app, 'GET', `/api/teams/${teamId}/chief`)).json()) as Env;
    expect(after.chief.model).toBeNull();
  });

  // #903 派发方式槽（ADR 0013）：失败方式——① 新 chief 默认不是 plan（选择权
  // 没交还给人）；② 写 false 不落库/不回显；③ PATCH 别的槽把它冲掉。
  test('PATCH /chief dispatchWithPlan 槽往返：默认 true；写→GET 回显同值；缺省不动（#903）', async () => {
    type Env = { chief: { dispatchWithPlan?: boolean } };
    // 默认 = plan（true）：两道闸是产品主张，缺省不撤销 confirm 闸（ADR 0013）。
    const fresh = (await (await req(s.app, 'GET', `/api/teams/${teamId}/chief`)).json()) as Env;
    expect(fresh.chief.dispatchWithPlan).toBe(true);
    // 写 false → 响应回显同值。
    const set = await req(s.app, 'PATCH', `/api/teams/${teamId}/chief`, {
      dispatchWithPlan: false,
    });
    expect(set.status).toBe(200);
    expect(((await set.json()) as Env).chief.dispatchWithPlan).toBe(false);
    // GET 回显同值 + 落库。
    const got = (await (await req(s.app, 'GET', `/api/teams/${teamId}/chief`)).json()) as Env;
    expect(got.chief.dispatchWithPlan).toBe(false);
    const row = s.db.select().from(chiefTable).where(eq(chiefTable.id, chiefId)).get()!;
    expect(row.dispatchWithPlan).toBe(false);
    // 缺省不动：PATCH 别的槽不翻派发方式。
    const other = await req(s.app, 'PATCH', `/api/teams/${teamId}/chief`, { charter: '不动它' });
    expect(((await other.json()) as Env).chief.dispatchWithPlan).toBe(false);
    // 翻回 true。
    const back = await req(s.app, 'PATCH', `/api/teams/${teamId}/chief`, {
      dispatchWithPlan: true,
    });
    expect(((await back.json()) as Env).chief.dispatchWithPlan).toBe(true);
  });

  test('chief 步 claim 载荷消费 model 覆盖：覆盖在 → 覆盖值；null → 绑定 Agent 模型（#615）', async () => {
    // 机器面（machine-wire 同配方）：发行 key → Bearer key enroll 拿 machine
    // token → Bearer token claim。pending step 在队时 claim 立即返回。
    const plain = await issueApiKey(s);
    const enroll = await s.app.request('/api/machine/enroll', {
      method: 'POST',
      headers: { authorization: `Bearer ${plain}`, 'content-type': 'application/json' },
      body: JSON.stringify({ teamId, name: 'chief-override-probe', cliVersion: '0.1.0' }),
    });
    expect(enroll.status).toBe(200);
    const { token } = (await enroll.json()) as { token: string };
    const claim = async () => {
      const res = await s.app.request('/api/machine/tasks/claim', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { step: { agent: { modelId: string } } | null };
      if (body.step === null) throw new Error('claim 空手：chief 步未入队或被抢');
      return body.step.agent.modelId;
    };
    const turn = async (content: string) => {
      const send = await req(s.app, 'POST', `/api/teams/${teamId}/chief/threads`, { content });
      expect(send.status).toBe(201);
    };

    // 无覆盖 → 绑定 Agent 模型（seedAgent 默认 stub-model）。
    await turn('覆盖前回合。');
    expect(await claim()).toBe('stub-model');

    // 覆盖在 → 载荷带覆盖值（provider+modelId 都换）。
    const override = await req(s.app, 'PATCH', `/api/teams/${teamId}/chief`, {
      model: { provider: 'stub-gw', modelId: 'm-override' },
    });
    expect(override.status).toBe(200);
    await turn('覆盖中回合。');
    expect(await claim()).toBe('m-override');

    // 清空 → 回绑定 Agent 模型。
    const cleared = await req(s.app, 'PATCH', `/api/teams/${teamId}/chief`, { model: null });
    expect(cleared.status).toBe(200);
    await turn('清空后回合。');
    expect(await claim()).toBe('stub-model');
  });

  test('POST /chief/threads/:tid/rewind：截断锚后消息 + 重置会话 + 锚内容重入队；activeRun 409；锚缺 404（#615 返工）', async () => {
    // 两轮：锚 A（POST 建线程）+ 后续 B（同线程续消息）。
    const created = await req(s.app, 'POST', `/api/teams/${teamId}/chief/threads`, {
      content: '锚句。',
    });
    expect(created.status).toBe(201);
    const tid = ((await created.json()) as { thread: { id: string } }).thread.id;
    sendChiefMessage({ db: s.db, hub: s.hub, machineHub: s.machineHub, user: s.user }, teamId, {
      threadId: tid,
      content: '后续句。',
    });
    const anchor = s.db
      .select()
      .from(chiefMessage)
      .where(eq(chiefMessage.threadId, tid))
      .all()
      .find((m) => m.content === '锚句。');
    expect(anchor).toBeDefined();

    // 活跃回合守门：入队后 activeRun 在位 → 409（steer 面同律，回合中不 rewind）。
    const busy = await req(s.app, 'POST', `/api/teams/${teamId}/chief/threads/${tid}/rewind`, {
      messageId: anchor!.id,
    });
    expect(busy.status).toBe(409);

    // 回合收尾态（activeRun 清）后 rewind 成立。
    s.db.update(chiefThread).set({ activeRun: null }).where(eq(chiefThread.id, tid)).run();
    const res = await req(s.app, 'POST', `/api/teams/${teamId}/chief/threads/${tid}/rewind`, {
      messageId: anchor!.id,
    });
    expect(res.status).toBe(200);
    // 截断：锚后消息（后续句）移除，锚保留。
    const msgs = s.db.select().from(chiefMessage).where(eq(chiefMessage.threadId, tid)).all();
    expect(msgs.map((m) => m.content)).toEqual(['锚句。']);
    // 会话重置：pi 会话不可倒带 → sessionId 清空，下轮 new session。
    const thread = s.db.select().from(chiefThread).where(eq(chiefThread.id, tid)).get();
    expect(thread!.sessionId).toBe('');
    // 重入队：A 步 + B 步 + rewind 步 = 3，末步 prompt = 锚内容。
    const steps = s.db.select().from(stepTable).where(eq(stepTable.buildId, tid)).all();
    expect(steps).toHaveLength(3);
    expect(steps[2]!.prompt).toBe('锚句。');
    expect(steps[2]!.status).toBe('pending');

    // 锚缺 / 他线程消息 → 404。
    const missing = await req(s.app, 'POST', `/api/teams/${teamId}/chief/threads/${tid}/rewind`, {
      messageId: 'msg-nope',
    });
    expect(missing.status).toBe(404);
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
      { db: s.db, hub: s.hub, machineHub: s.machineHub, user: s.user, skillsDir: s.skillsDir },
      teamId,
    );
    expect(prompt).toContain('优先文档 Agent'); // charter
    expect(prompt).toContain('agents:'); // 团队资源清单
    expect(prompt).toContain('措辞→spec'); // 策略指引
  });

  // #903 派发模式行按设置合成（ADR 0013）：失败方式——① 提示词仍写死
  // withPlan:false（8/8 直执行的提示词半没拆）；② 设置翻 false 后提示词
  // 还说走 plan（LLM 对用户复述的行为与实际不符）。
  test('systemPrompt 派发模式行按 dispatchWithPlan 合成，不再写死 withPlan:false（#903）', () => {
    const deps = {
      db: s.db,
      hub: s.hub,
      machineHub: s.machineHub,
      user: s.user,
      skillsDir: s.skillsDir,
    };
    const planPrompt = composeChiefSystemPrompt(deps, teamId);
    expect(planPrompt).toContain('派发模式（团队设置，服务端强制）：先规划');
    expect(planPrompt).not.toContain('withPlan:false');

    patchChief(deps, teamId, { dispatchWithPlan: false });
    const directPrompt = composeChiefSystemPrompt(deps, teamId);
    expect(directPrompt).toContain('派发模式（团队设置，服务端强制）：直接执行');
    expect(directPrompt).not.toContain('withPlan:false');
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

  // XMON-77 权限闭环读面：chief 分派要能看到每个 Agent 的授权集（合并步
  // 派给无「合并分支/推送分支」的 Agent 会在 requestMerge 403——提前可见才
  // 能挑对 Agent）。失败方式：投影缺 tools/skills/mcpServers 任一 → 分派面
  // 对权限态盲选。
  test('agents 投影携带授权集 tools/skills/mcpServers（XMON-77 分派面权限可见）', async () => {
    s.db
      .update(agentTable)
      .set({ tools: ['合并分支', '推送分支'], skills: ['slug-a'], mcpServers: ['mcp-1'] })
      .where(eq(agentTable.id, AGENT_ID))
      .run();
    const agents = (await relay('agents', {})) as {
      id: string;
      tools: string[];
      skills: string[];
      mcpServers: string[];
    }[];
    const me = agents.find((a) => a.id === AGENT_ID)!;
    expect(me.tools).toEqual(['合并分支', '推送分支']);
    expect(me.skills).toEqual(['slug-a']);
    expect(me.mcpServers).toEqual(['mcp-1']);
    // 未勾选的邻 Agent = 空集（least-privilege 可分辨，不是缺字段）。
    const other = agents.find((a) => a.id === AGENT2_ID)!;
    expect(other.tools).toEqual([]);
  });

  // XMON-84 B4：chief create_agent 无 tools 形参，落创建默认集——缺「推送
  // 分支」的 Agent 收尾推不了工作分支（daemon 软拒），chief 建的 Agent 同样
  // 要能交付。失败方式：落 [] → chief 建号即无推送权。
  test('create_agent 落创建默认集 [推送分支]（XMON-84 B4）', async () => {
    const out = (await relay('create_agent', { displayName: 'chief 建的交付号' })) as {
      id: string;
    };
    expect(s.db.select().from(agentTable).where(eq(agentTable.id, out.id)).get()!.tools).toEqual([
      '推送分支',
    ]);
  });

  // #903：withPlan 不再是 chief 工具面的调用时选择——派发模式 = 团队设置
  // （chief.dispatchWithPlan，默认 true 走 plan），服务端强制（ADR 0013）。
  // 失败方式：① 默认仍直执行（选择权没交还）；② 设置 false 后仍走 plan
  // （设置不生效）；③ 报文塞 withPlan 能推翻设置（LLM 保留单方撤销权）。
  test('run_builds 按团队设置派发：默认 dispatchWithPlan=true 走 plan + triggerSource:chief + assignment 落槽（#903）', async () => {
    const todoRec = (await relay('create_todo', { projectId, title: '写文档', spec: 's' })) as {
      id: string;
    };
    const out = (await relay('run_builds', {
      todoIds: [todoRec.id],
      assignment: { build: { agentId: AGENT_ID } },
    })) as { builds: { withPlan: boolean; triggerSource: string }[]; withPlan: boolean };
    expect(out.withPlan).toBe(true); // 响应回报生效值 = 团队设置
    expect(out.builds[0]!.withPlan).toBe(true); // 默认走 plan（方案停在确认闸）
    expect(out.builds[0]!.triggerSource).toBe('chief');
    const row = s.db.select().from(todoTable).where(eq(todoTable.id, todoRec.id)).get()!;
    expect(row.assignment?.build?.agentId).toBe(AGENT_ID);
    expect(row.phase).toBe('queued');
    // 首步 = 规划步（dispatchWithPlan:true → plan）
    const steps = s.db
      .select()
      .from(stepTable)
      .where(eq(stepTable.buildId, row.latestBuildId!))
      .all();
    expect(steps[0]!.kind).toBe('plan');
  });

  test('run_builds 设置 dispatchWithPlan=false → 直执行（首步=build）（#903）', async () => {
    patchChief({ db: s.db, hub: s.hub, machineHub: s.machineHub, user: s.user }, teamId, {
      dispatchWithPlan: false,
    });
    const todoRec = (await relay('create_todo', { projectId, title: '直接干', spec: 's' })) as {
      id: string;
    };
    const out = (await relay('run_builds', {
      todoIds: [todoRec.id],
      assignment: { build: { agentId: AGENT_ID } },
    })) as { builds: { withPlan: boolean }[]; withPlan: boolean };
    expect(out.withPlan).toBe(false);
    expect(out.builds[0]!.withPlan).toBe(false);
    const row = s.db.select().from(todoTable).where(eq(todoTable.id, todoRec.id)).get()!;
    const steps = s.db
      .select()
      .from(stepTable)
      .where(eq(stepTable.buildId, row.latestBuildId!))
      .all();
    expect(steps[0]!.kind).toBe('build');
  });

  test('run_builds 报文 withPlan 参数被忽略（服务端 clamp）：plan 设置下塞 false 仍走 plan（#903）', async () => {
    // 默认设置即 plan（beforeEach 新世界）；本测试钉的是「报文参数推翻不了设置」。
    const todoRec = (await relay('create_todo', { projectId, title: '想跳闸', spec: 's' })) as {
      id: string;
    };
    const out = (await relay('run_builds', {
      todoIds: [todoRec.id],
      assignment: { build: { agentId: AGENT_ID } },
      withPlan: false, // 工具面已无此参数；塞了也不生效
    })) as { builds: { withPlan: boolean }[]; withPlan: boolean };
    expect(out.withPlan).toBe(true);
    expect(out.builds[0]!.withPlan).toBe(true);
    const row = s.db.select().from(todoTable).where(eq(todoTable.id, todoRec.id)).get()!;
    const steps = s.db
      .select()
      .from(stepTable)
      .where(eq(stepTable.buildId, row.latestBuildId!))
      .all();
    expect(steps[0]!.kind).toBe('plan');
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
    });
    const row = s.db.select().from(todoTable).where(eq(todoTable.id, todoRec.id)).get()!;
    expect(row.assignment?.plan?.agentId).toBe(AGENT2_ID); // 规划 = 代码 Agent
    expect(row.assignment?.build?.agentId).toBe(AGENT_ID); // 执行 = 文档 Agent
    // 首步 = 规划步（默认 dispatchWithPlan=true，#903）
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
      // 默认 dispatchWithPlan=true 即走 plan（#903），无需报文参数。
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

// —— 结构契约: 51 词表 relay 白名单（raw 49 − 除名 1 + 新增 3，XMON-109/115/#627）—————

describe('51 词表 relay 执行面（02 §4.3）', () => {
  test('词表外工具名 → 400（白名单纪律，不执行）', async () => {
    let status = 0;
    try {
      await relay('not_a_tool', {});
    } catch (err) {
      status = err instanceof HttpError ? err.status : 0;
    }
    expect(status).toBe(400);
  });

  // XMON-115 回摆：set_remote_shell 写入点恢复（XMON-108 双闸预检 + XMON-110
  // daemon 工具落地后的收尾）。失败方式先于实现钉死：
  // ① 绕过 filterAgentTools 的裸 Set 写 → 存量残值不清退；② 写 wire 词
  // remote_shell 而非开关词「远程 shell」→ claim localTools 判定不认
  // （machine-shell.test.ts 对拍）；③ revoke 读改写撞掉邻档；④ enabled 缺省
  // 静默当 true（#573 前形如此——fail-open，恢复时收紧为 400）；⑤ 未知
  // agentId 不 404。
  test('set_remote_shell 授予：REST 先写邻档 → chief 增「远程 shell」→ REST GET 回读一致（验收 #2）', async () => {
    // 双入口同字段正向半：REST PATCH 先写（UI 通道语义），chief 再授予。
    const patch = await req(s.app, 'PATCH', `/api/teams/${teamId}/agents/${AGENT_ID}`, {
      tools: ['推送分支'],
    });
    expect(patch.status).toBe(200);
    const granted = (await relay('set_remote_shell', { agentId: AGENT_ID, enabled: true })) as {
      agentId: string;
      remoteShell: boolean;
      tools: string[];
    };
    // 返回体带 tools（写点回读，XMON-74 证据探针按此字段复核，见 chief-tools.ts）。
    expect(granted).toEqual({
      agentId: AGENT_ID,
      remoteShell: true,
      tools: ['推送分支', '远程 shell'],
    });
    // REST 回读（验收 #2：chief 改后 UI/API 回读一致——UI 消费同一 GET）。
    const readback = await req(s.app, 'GET', `/api/teams/${teamId}/agents/${AGENT_ID}`);
    const record = (await readback.json()) as { tools: string[] };
    expect(record.tools).toEqual(['推送分支', '远程 shell']);
  });

  test('撤销只摘「远程 shell」：邻档与顺序不动；重复授予幂等', async () => {
    s.db
      .update(agentTable)
      .set({ tools: ['远程 shell', '推送分支'] })
      .where(eq(agentTable.id, AGENT_ID))
      .run();
    const revoked = (await relay('set_remote_shell', { agentId: AGENT_ID, enabled: false })) as {
      remoteShell: boolean;
      tools: string[];
    };
    expect(revoked.remoteShell).toBe(false);
    expect(revoked.tools).toEqual(['推送分支']);
    expect(s.db.select().from(agentTable).where(eq(agentTable.id, AGENT_ID)).get()!.tools).toEqual([
      '推送分支',
    ]);
    await relay('set_remote_shell', { agentId: AGENT_ID, enabled: true });
    await relay('set_remote_shell', { agentId: AGENT_ID, enabled: true });
    expect(s.db.select().from(agentTable).where(eq(agentTable.id, AGENT_ID)).get()!.tools).toEqual([
      '推送分支',
      '远程 shell',
    ]);
  });

  test('写路径同过 filterAgentTools：存量残值随写清退（与 REST PATCH 同律）', async () => {
    s.db
      .update(agentTable)
      .set({ tools: ['自造档', '推送分支'] })
      .where(eq(agentTable.id, AGENT_ID))
      .run();
    await relay('set_remote_shell', { agentId: AGENT_ID, enabled: true });
    expect(s.db.select().from(agentTable).where(eq(agentTable.id, AGENT_ID)).get()!.tools).toEqual([
      '推送分支',
      '远程 shell',
    ]);
  });

  test('enabled 缺省/非布尔 → 400 且行未写（fail-closed；不沿用 #573 前缺省 true）', async () => {
    for (const bad of [{ agentId: AGENT_ID }, { agentId: AGENT_ID, enabled: 'yes' }]) {
      let status = 0;
      try {
        await relay('set_remote_shell', bad);
      } catch (err) {
        status = err instanceof HttpError ? err.status : 0;
      }
      expect(status).toBe(400);
    }
    expect(s.db.select().from(agentTable).where(eq(agentTable.id, AGENT_ID)).get()!.tools).toEqual(
      [],
    );
  });

  test('未知 agentId → 404（requireTeamAgent 同律，不误写）', async () => {
    let status = 0;
    let message = '';
    try {
      await relay('set_remote_shell', { agentId: 'agent-nope', enabled: true });
    } catch (err) {
      status = err instanceof HttpError ? err.status : 0;
      message = err instanceof HttpError ? err.message : '';
    }
    expect(status).toBe(404);
    expect(message).toContain('agent-nope');
  });

  // #627 models 读工具：候选清单行语义 = web toModelOptions 投影（#770 起
  // providers 段已除，只剩 model-sources 非 pi 段，first-wins 去重）。
  // 失败方式先于实现钉死：① 无 provider 且 claude-code 未装时报错而非空集；
  // ② 空 id 行漏跳 → 脏行；③ pi 段重复产行；④ claude-code 段 providerLabel
  // 落 runtime 原词而非显示名 → 与 web 候选不同义；⑤ custom provider 的
  // models[] 不再被任何候选面引用（providers 写面照常可用）。
  test('models：无 custom provider + claude-code 未装 → 空清单不报错', async () => {
    expect(await relay('models', {})).toEqual([]);
  });

  test('models：providers 写面照常，候选只出 claude-code 段（去重 + 行卫生）', async () => {
    const provRes = await req(s.app, 'POST', `/api/teams/${teamId}/providers`, {
      providerId: 'gw-a',
      label: '网关甲',
      baseUrl: 'https://a.example.com/v1',
      api: 'openai-completions',
      models: [
        { id: 'model-a', name: '模型甲' },
        { id: 'model-b', name: '' },
        { id: '', name: '空 id 行' },
      ],
    });
    expect(provRes.status).toBe(201);
    // claude-code 段：上报行（default 槽 + opus 槽同 id → 段内去重留一行）；
    // providers 段（gw-a 三行）一律不产候选行（#770）。
    seedMachineReport('exec-1', {
      installed: true,
      hostname: 'exec-host-1',
      models: [
        { id: 'claude-opus-4-5', name: 'claude-opus-4-5' },
        { id: 'claude-opus-4-5', name: 'claude-opus-4-5' },
      ],
    });
    const rows = (await relay('models', {})) as {
      provider: string;
      providerLabel: string;
      modelId: string;
      modelName: string;
    }[];
    expect(rows).toEqual([
      {
        provider: 'claude-code',
        providerLabel: 'Claude Code',
        modelId: 'claude-opus-4-5',
        modelName: 'claude-opus-4-5',
      },
    ]);
  });

  test('models：custom provider 取名 claude-code 不再遮蔽上报行（#770/#707）', async () => {
    const provRes = await req(s.app, 'POST', `/api/teams/${teamId}/providers`, {
      providerId: 'claude-code',
      label: '同名网关',
      baseUrl: 'https://cc.example.com/v1',
      api: 'openai-completions',
      models: [{ id: 'm-cc', name: '同名行' }],
    });
    expect(provRes.status).toBe(201);
    seedMachineReport('exec-1', {
      installed: true,
      hostname: 'exec-host-1',
      models: [{ id: 'm-cc', name: 'm-cc' }],
    });
    const rows = (await relay('models', {})) as {
      provider: string;
      providerLabel: string;
      modelId: string;
      modelName: string;
    }[];
    // providers 段已除：同名 provider 记录存在，但候选行取执行机上报
    // （品牌 label 'Claude Code'，name 原样）。
    expect(rows).toEqual([
      { provider: 'claude-code', providerLabel: 'Claude Code', modelId: 'm-cc', modelName: 'm-cc' },
    ]);
  });

  test('读工具 replaySafe 标记与执行一致（抽样 projects/todos/machines/models）', async () => {
    for (const name of ['projects', 'todos', 'machines', 'models']) {
      const def = CHIEF_REMOTE_TOOLS.find((t) => t.name === name)!;
      expect(def.replaySafe).toBe(true);
      expect(await relay(name, {})).toBeDefined();
    }
  });

  test('词表键集 = r5 raw toolDefHashes 全键 − 除名登记（一手来源防漂移，node fs 面）', () => {
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
    // divergence 双向登记（XMON-109/XMON-115/#627）：raw 观测 49 键冻结，现行
    // 词表 = raw − CHIEF_TOOLS_REMOVED（delete_skills）+ CHIEF_TOOLS_ADDED
    // （create_skill/update_skill，chief 免开关；models，#627 候选清单）
    // + set_remote_shell 回摆。
    const removed: readonly string[] = CHIEF_TOOLS_REMOVED;
    const added: readonly string[] = CHIEF_TOOLS_ADDED;
    const expected = (found[0] as string[]).filter(
      (name) => !removed.includes(name) && !added.includes(name),
    );
    expect(CHIEF_TOOL_NAMES).toEqual([...expected, ...added].sort());
  });
});
