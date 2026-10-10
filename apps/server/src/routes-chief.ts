// chief 域（#1125 拆分自 routes.ts）：总管配置（GET/PATCH /chief，02 §4.3/
// r5 §2）+ 线程面（列表/新主题/rewind，#615 返工）+ #1049 问答卡答题/取消面。
// 会话读写分流面（conversations/{id}/messages|stream，chief 与 build 双消费）
// 归 routes-conversations.ts。

import {
  chiefRewindBodySchema,
  chiefSendMessageBodySchema,
  patchChiefBodySchema,
} from '@pacman/shared';
import type { Hono } from 'hono';
import type { AppContext } from './context.js';
import { notFound, parseWith } from './lib/errors.js';
import { jsonBody, requireTeam, svcOf } from './routes-helpers.js';
import {
  getChiefEnvelope,
  getChiefThread,
  listChiefThreads,
  patchChief,
  rewindChiefThread,
  sendChiefMessage,
} from './services/chief.js';
import { answerQuestion, cancelQuestion, parseAnswerBody } from './services/chief-questions.js';

export function registerChiefRoutes(app: Hono, ctx: AppContext): void {
  const svc = svcOf(ctx);

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

  // 恢复到此处（#615 返工，用户裁决恢复钮闭环不删除）：锚 = 用户消息，截断
  // 其后消息 + 重置会话 + 锚内容重入队；活跃回合 409。语义正本 = 参考站 live
  // aria「恢复到此处」+ chatbot-ui regenerate 截断重发族 + Multica 无 rewind
  // （对照负证）。wire 未采 → INFERRED_ROUTES 登记（test/wire.test.ts）。
  app.post('/api/teams/:id/chief/threads/:tid/rewind', async (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    const body = parseWith(chiefRewindBodySchema, await jsonBody(c), 'body');
    return c.json(rewindChiefThread(svc, teamId, c.req.param('tid'), body));
  });

  // —— #1049 问答卡答题面（web → server；线程归属 = requireTeam + 线程 team
  // 双校验；返回翻转后的卡 content，前端就地翻面）。answers 执法（选项 ⊆
  // label 集 / 文本题非空 / 逐题对应）在 services/chief-questions.ts 单源。
  app.post('/api/teams/:id/chief/threads/:tid/questions/:requestId/answer', async (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    const threadId = c.req.param('tid');
    const thread = getChiefThread(svc, threadId);
    if (!thread || thread.teamId !== teamId) throw notFound(`chief thread ${threadId}`);
    const answers = parseAnswerBody(await jsonBody(c));
    return c.json(
      answerQuestion(svc, {
        threadId,
        requestId: c.req.param('requestId'),
        answers,
      }),
    );
  });

  // —— #1049 问答卡取消面（用户「不答了」：卡翻 cancelled，等答的机器 hold
  // 随即返回 cancelled——模型收到后收束回合，不自动拍板（D3/D4 的用户侧出口）。
  app.post('/api/teams/:id/chief/threads/:tid/questions/:requestId/cancel', async (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    const threadId = c.req.param('tid');
    const thread = getChiefThread(svc, threadId);
    if (!thread || thread.teamId !== teamId) throw notFound(`chief thread ${threadId}`);
    cancelQuestion(svc, {
      threadId,
      requestId: c.req.param('requestId'),
      reason: '用户取消了本次提问',
    });
    return c.json({ ok: true as const });
  });
}
