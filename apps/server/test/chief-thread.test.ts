// Chief 线程面落库（#1128 自 chief.test.ts 拆分；判定口径与 M4a 组头注见
// ./chief-harness.ts）。共享 harness 收编位 = ./chief-harness.ts，
// 状态经 H 单出口每用例重绑。

import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import {
  chiefMessage,
  chief as chiefTable,
  chiefThread,
  step as stepTable,
} from '../src/db/schema.js';
import { HttpError } from '../src/lib/errors.js';
import { sendChiefMessage } from '../src/services/chief.js';
import { H, registerChiefHarness } from './chief-harness.js';
import { req } from './helpers.js';

registerChiefHarness();

// —— AC: Chief 线程面落库（chief_thread/chief_message，01 §6）———————————————

describe('Chief 线程面落库（02 §4.3/r5 §3.6）', () => {
  test('发消息 → chief_thread + chief_message(user) 落库 + chief 步入队', async () => {
    const res = await req(H.s.app, 'POST', `/api/teams/${H.teamId}/chief/threads`, {
      content: '帮 demo 写一份 CONTRIBUTING.md 贡献指南。',
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { thread: { id: string }; message: { role: string } };
    expect(body.thread.id.startsWith('chief-')).toBe(true);
    expect(body.message.role).toBe('user');
    // 线程行落库
    const threads = H.s.db.select().from(chiefThread).all();
    expect(threads.length).toBeGreaterThanOrEqual(2); // seedChiefThread + 新建
    // user 消息落 chief_message
    const msgs = H.s.db
      .select()
      .from(chiefMessage)
      .where(eq(chiefMessage.threadId, body.thread.id))
      .all();
    expect(msgs.some((m) => m.role === 'user')).toBe(true);
    // chief 步入队（kind chief，buildId = conv id = thread id）
    const steps = H.s.db
      .select()
      .from(stepTable)
      .where(eq(stepTable.buildId, body.thread.id))
      .all();
    expect(steps).toHaveLength(1);
    expect(steps[0]!.kind).toBe('chief');
    expect(steps[0]!.status).toBe('pending');
  });

  test('GET /conversations/chief-<threadId>/messages 读 chief_message（非 message 表）', async () => {
    await sendChiefMessage(
      { db: H.s.db, hub: H.s.hub, machineHub: H.s.machineHub, user: H.s.user },
      H.teamId,
      { threadId: H.threadId, content: '第一条' },
    );
    const res = await req(H.s.app, 'GET', `/api/conversations/${H.threadId}/messages`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { messages: { role: string; content: unknown }[] };
    expect(body.messages.some((m) => m.role === 'user' && m.content === '第一条')).toBe(true);
  });

  test('未绑定 Agent → 发消息 409（门控条 canon server 半，r5 §2）', async () => {
    H.s.db.update(chiefTable).set({ agentId: null }).where(eq(chiefTable.id, H.chiefId)).run();
    expect(() =>
      sendChiefMessage(
        { db: H.s.db, hub: H.s.hub, machineHub: H.s.machineHub, user: H.s.user },
        H.teamId,
        {
          threadId: H.threadId,
          content: 'x',
        },
      ),
    ).toThrow(HttpError);
  });
});
