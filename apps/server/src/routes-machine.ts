// 机器面路由——02 §5 canonical 13 端点（词表单源 = shared MACHINE_ENDPOINTS /
// MACHINE_WIRE；对拍测试 = test/machine-wire.test.ts）。
// 认证（02 §8）：enroll = Bearer apiKey（`tds_<48hex>`）；其余 = Bearer 机器
// token（64hex，服务端存哈希比对）。错误形状 {error}（r5 §1 族）。
// 附加端点（[设计] 登记，非词表外扩协议面）：PUT /api/machine/upload/{uploadId}
// = upload-urls 预签名的落地点（self-host 无对象存储，server 自出一次性 PUT）。

import type { ToolCallRecord } from '@pacman/shared';
import {
  machineClaimBodySchema,
  machineDoneBodySchema,
  machineEnrollBodySchema,
  machineEnrollPollBodySchema,
  machineEnrollStartBodySchema,
  machinePresenceBodySchema,
  machineRecordSchema,
  machineToolBodySchema,
  machineToolRelayBodySchema,
  machineTranscriptDeltaBodySchema,
  machineUploadUrlsBodySchema,
  PLAN_FILE_NAME,
  transcriptUploadSchema,
} from '@pacman/shared';
import type { Context, Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { AppContext } from './context.js';
import type { machine as machineTable } from './db/schema.js';
import { HttpError, parseWith } from './lib/errors.js';
import { newRecordId } from './lib/ids.js';
import {
  claimStep,
  createUploadUrls,
  enrollMachine,
  executeRelayToolCall,
  findApiKeyByPlain,
  findMachineByToken,
  finishStep,
  heartbeatStep,
  markOffline,
  markPresence,
  receivePlanUpload,
  receiveUpload,
  recoverSteps,
  reportTool,
  reportTranscriptDelta,
  stepToken,
} from './services/machines.js';

/** relay 判别（machineToolBodySchema union 的分流位）：{name, params} 无 id =
 * remoteTools 执行；toolCallRecord（有 id/arguments）= live transcript 回传。 */
function isRelayBody(raw: unknown): boolean {
  return raw !== null && typeof raw === 'object' && 'params' in raw && !('id' in raw);
}

/** transcript delta 判别（第三形 [设计]，M5 live streaming）：kind 判别位。 */
function isDeltaBody(raw: unknown): boolean {
  return (
    raw !== null &&
    typeof raw === 'object' &&
    'kind' in raw &&
    (raw as { kind: unknown }).kind === 'transcript_delta'
  );
}

type MachineRow = typeof machineTable.$inferSelect;

function bearer(c: Context): string | null {
  const header = c.req.header('authorization');
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !value) return null;
  return value;
}

function unauthorized(): HttpError {
  return new HttpError(401, 'unauthorized');
}

async function jsonBody(c: Context): Promise<unknown> {
  return c.req.json().catch(() => null);
}

function originOf(c: Context): string {
  return new URL(c.req.url).origin;
}

export function registerMachineRoutes(app: Hono, ctx: AppContext): void {
  const deps = {
    db: ctx.db,
    hub: ctx.hub,
    machineHub: ctx.machineHub,
    box: ctx.secretBox,
    user: ctx.user,
    reposDir: ctx.reposDir,
    convHub: ctx.convHub,
  };

  // 机器 token 认证中间件（enroll 三件除外——其认证 = apiKey）。
  app.use('/api/machine/*', async (c, next) => {
    const path = new URL(c.req.url).pathname;
    if (path.startsWith('/api/machine/enroll')) return next();
    const token = bearer(c);
    const row = token ? findMachineByToken(ctx.db, token) : undefined;
    if (!row) throw unauthorized();
    await next();
  });

  // 中间件已认证；处理器按 Bearer 重解析机器行（Hono Variables 不带型 [设计]）。
  const me = (c: Context): MachineRow => {
    const token = bearer(c);
    const row = token ? findMachineByToken(ctx.db, token) : undefined;
    if (!row) throw unauthorized();
    return row;
  };

  // —— POST /api/machine/enroll（02 §5.2 路径二：--api-key --team）—————————————
  app.post('/api/machine/enroll', async (c) => {
    const key = bearer(c);
    const keyRow = key ? findApiKeyByPlain(ctx.db, key) : undefined;
    if (!keyRow) throw unauthorized();
    const body = parseWith(machineEnrollBodySchema, await jsonBody(c), 'body');
    if (body.teamId !== keyRow.teamId) throw unauthorized();
    const result = enrollMachine(deps, {
      keyId: keyRow.id,
      teamId: body.teamId,
      name: body.name ?? 'machine', // --name 默认 hostname（客户端已带则覆盖）
      ...(body.cliVersion !== undefined ? { cliVersion: body.cliVersion } : {}),
      serverUrl: originOf(c),
    });
    return c.json(result); // = machine.json 形状（r3 §1.3）
  });

  // —— 浏览器授权流（02 §5.2 路径一）[设计] 骨架：web 授权页归 M5 ——————————————
  // enroll 位卫生 [设计]：TTL 10min + 容量上限 100（FIFO 淘汰），防无界增长。
  const ENROLL_TTL_MS = 600_000;
  const ENROLL_CAP = 100;
  app.post('/api/machine/enroll/start', async (c) => {
    const body = parseWith(machineEnrollStartBodySchema, await jsonBody(c), 'body');
    const now = Date.now();
    for (const [id, e] of ctx.enrollments) {
      if (now - e.createdAt > ENROLL_TTL_MS) ctx.enrollments.delete(id);
    }
    while (ctx.enrollments.size >= ENROLL_CAP) {
      const oldest = ctx.enrollments.keys().next().value;
      if (oldest === undefined) break;
      ctx.enrollments.delete(oldest);
    }
    const enrollId = newRecordId();
    ctx.enrollments.set(enrollId, { teamId: body.teamId ?? ctx.team.id, createdAt: now });
    return c.json({
      enrollId,
      url: `${originOf(c)}/app/machines/authorize?enroll=${enrollId}`,
    });
  });

  app.post('/api/machine/enroll/poll', async (c) => {
    const body = parseWith(machineEnrollPollBodySchema, await jsonBody(c), 'body');
    const pending = ctx.enrollments.get(body.enrollId);
    if (!pending || Date.now() - pending.createdAt > ENROLL_TTL_MS) {
      return c.json({ status: 'expired' });
    }
    return c.json({ status: 'pending' }); // 授权完成面归 M5（web 侧接线）
  });

  // —— GET /api/machine/me ————————————————————————————————————————————————————
  app.get('/api/machine/me', (c) => {
    const row = me(c);
    return c.json(
      machineRecordSchema.parse({
        id: row.id,
        name: row.name,
        teamId: row.teamId,
        online: row.online,
        maxConcurrent: row.maxConcurrent,
        latestCliVersion: row.latestCliVersion,
      }),
    );
  });

  // —— POST /api/machine/presence（02 §5.4 心跳）——————————————————————————————
  app.post('/api/machine/presence', async (c) => {
    const row = me(c);
    const body = parseWith(machinePresenceBodySchema, (await jsonBody(c)) ?? {}, 'body');
    markPresence(deps, row.id, body);
    return c.json({ ok: true as const });
  });

  // —— POST /api/machine/recover（步 journal 恢复 server 侧真值）———————————————
  app.post('/api/machine/recover', (c) => {
    const row = me(c);
    return c.json({ steps: recoverSteps(deps, row.id) });
  });

  // —— POST /api/machine/tasks/claim（长轮询，节奏 ~75s + wake，r3 §1.5）———————
  app.post('/api/machine/tasks/claim', async (c) => {
    const row = me(c);
    parseWith(machineClaimBodySchema, (await jsonBody(c)) ?? {}, 'body');
    const step = await claimStep(deps, row.id, row.teamId, ctx.claimHoldMs, originOf(c));
    return c.json({ step });
  });

  // —— GET /api/machine/stream（wake SSE，02 §1.2/§5.4）———————————————————————
  app.get('/api/machine/stream', (c) => {
    const row = me(c);
    return streamSSE(c, async (stream) => {
      const unsubscribe = ctx.machineHub.subscribe(row.teamId, (ev) => {
        void stream.writeSSE({ data: JSON.stringify(ev) });
      });
      let release: () => void = () => {};
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      stream.onAbort(() => {
        unsubscribe();
        // 推送通道断 = 机器下线 [设计]（daemon 停机即断连；重连窗口内
        // presence 会重新置 online）。
        markOffline(deps, row.id);
        release();
      });
      await held;
    });
  });

  // —— POST /api/machine/heartbeat/{stepId} ———————————————————————————————————
  app.post('/api/machine/heartbeat/:stepId', (c) => {
    const row = me(c);
    heartbeatStep(deps, row.id, c.req.param('stepId'));
    return c.json({ ok: true as const });
  });

  // —— POST /api/machine/tool/{stepId}（同径双形，r5 §3.1 bundle 提取）：
  // ① remoteTools relay 执行 {name, params} → {text}（chief 步服务端工具）；
  // ② live transcript 工具行回传 toolCallRecord → {ok:true}（worker 步内建工具）。
  // 分流判别：有 params 无 id = relay（machineToolBodySchema union）。———————
  app.post('/api/machine/tool/:stepId', async (c) => {
    const row = me(c);
    const raw = await jsonBody(c);
    if (isDeltaBody(raw)) {
      const delta = parseWith(machineTranscriptDeltaBodySchema, raw, 'body');
      reportTranscriptDelta(deps, row.id, c.req.param('stepId'), delta.text);
      return c.json({ ok: true as const });
    }
    if (isRelayBody(raw)) {
      const relay = parseWith(machineToolRelayBodySchema, raw, 'body');
      const text = await executeRelayToolCall(
        deps,
        row.id,
        c.req.param('stepId'),
        relay.name,
        relay.params,
      );
      return c.json({ text });
    }
    const body = parseWith(machineToolBodySchema, raw, 'body');
    reportTool(deps, row.id, c.req.param('stepId'), body as ToolCallRecord);
    return c.json({ ok: true as const });
  });

  // —— GET /api/machine/token/{stepId}（per-step 凭证下发，02 §8）——————————————
  app.get('/api/machine/token/:stepId', (c) => {
    const row = me(c);
    return c.json(stepToken(deps, row.id, c.req.param('stepId')));
  });

  // —— POST /api/machine/upload-urls/{stepId}（预签名产物上传）—————————————————
  app.post('/api/machine/upload-urls/:stepId', async (c) => {
    const row = me(c);
    const body = parseWith(machineUploadUrlsBodySchema, await jsonBody(c), 'body');
    return c.json(
      createUploadUrls(deps, row.id, c.req.param('stepId'), body.files, originOf(c), ctx.uploads),
    );
  });

  // —— PUT /api/machine/upload/{uploadId}（[设计] 预签名落地点；按登记 name
  // 分流：transcript.json = 终稿消息行集、plan.md = 方案文件版本，02 §1.3/§4.2）——
  app.put('/api/machine/upload/:uploadId', async (c) => {
    const row = me(c);
    const uploadId = c.req.param('uploadId');
    const upload = ctx.uploads.get(uploadId);
    if (!upload || upload.machineId !== row.id) throw new HttpError(404, 'upload not found');
    if (upload.name === PLAN_FILE_NAME) {
      receivePlanUpload(deps, upload, await c.req.text());
    } else {
      const body = parseWith(transcriptUploadSchema, await jsonBody(c), 'body');
      receiveUpload(deps, upload, body);
    }
    ctx.uploads.delete(uploadId); // 一次性
    return c.json({ ok: true as const });
  });

  // —— POST /api/machine/done/{stepId}（收尾 + phase 推进 + 记账 + 合并落地）———
  app.post('/api/machine/done/:stepId', async (c) => {
    const row = me(c);
    const body = parseWith(machineDoneBodySchema, await jsonBody(c), 'body');
    await finishStep(deps, row.id, c.req.param('stepId'), body);
    return c.json({ ok: true as const });
  });
}
