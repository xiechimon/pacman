// conversations 域（#1125 拆分自 routes.ts）：会话读写分流面（02 §1.2 + r5
// §3.6）——chief 会话（id = chief-<threadId>）与 build 会话双消费同一组端点，
// 按会话 id 前缀分流（W3 #278/06 册 D9：build 会话 POST = steer 语义）。
// SSE 会话流与 team 流（routes-core.ts）同构、各自订阅键。

import { buildSteerBodySchema, chiefSendMessageBodySchema } from '@pacman/shared';
import { eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { AppContext } from './context.js';
import { message } from './db/schema.js';
import { notFound, parseWith } from './lib/errors.js';
import { jsonBody, svcOf } from './routes-helpers.js';
import { readSteerPending, sendBuildSteer } from './services/builds.js';
import { chiefThreadMessages, getChiefThread, sendChiefMessage } from './services/chief.js';
import { createSerialConnection } from './services/events.js';
import { isChiefConversation } from './services/machines.js';

export function registerConversationRoutes(app: Hono, ctx: AppContext): void {
  const svc = svcOf(ctx);

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
        // #902 过闸宣告行的动作主体（存量行/daemon 上传行 = null）。
        actor: r.actor,
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
}
