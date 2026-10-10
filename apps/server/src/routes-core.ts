// core 域（#1125 拆分自 routes.ts）：认证保形（02 §2.1 cookie 自设，先于一切
// /api 处理器——组合器里本模块恒第一个注册）+ seed 读面（session/user/teams/
// members）+ notifications + SSE team stream（02 §1.2）+ 机器管理 web 面
// （#357/#1108）+ 能力/进度/what's-new/⌘K 搜索 + 埋点空面（02 §6.1）。

import {
  capabilitiesResponseSchema,
  PHASE_VALUES,
  patchMachineBodySchema,
  patchUserBodySchema,
  type TeamMember,
  THINKING_LEVELS,
} from '@pacman/shared';
import { eq, isNull } from 'drizzle-orm';
import type { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { streamSSE } from 'hono/streaming';
import type { AppContext } from './context.js';
import { agent, machine, notification, todo, user, whatsNew } from './db/schema.js';
import { notFound, parseWith } from './lib/errors.js';
import { agentRecordOf, jsonBody, requireTeam, SESSION_COOKIE, svcOf } from './routes-helpers.js';
import { createSerialConnection } from './services/events.js';
import { machineRunningCount, toMachineRecord } from './services/machines.js';
import { search } from './services/search.js';

export function registerCoreRoutes(app: Hono, ctx: AppContext): void {
  const svc = svcOf(ctx);

  // —— 认证保形（02 §2.1：自动登录，无登录页）———————————————————————————
  app.use('/api/*', async (c, next) => {
    if (!getCookie(c, SESSION_COOKIE)) {
      setCookie(c, SESSION_COOKIE, ctx.user.id, { httpOnly: true, path: '/' });
    }
    await next();
  });

  // —— GET 面 ————————————————————————————————————————————————————————————————
  app.get('/api/auth/session', (c) => c.json(ctx.user));
  app.get('/api/user/me', (c) => c.json(ctx.user));

  // 改名落盘面（#1031：帐号页名称行内编辑）。GET 同名 PATCH [推断]（02 §6.1
  // REST 同名规则族，wire 未采——wire.test.ts INFERRED_ROUTES 登记）。写两处：
  // DB user 行（重启后仍是新名）+ ctx.user 内存 seed 副本（GET me/session 与
  // members actor 三条读面全吃这个引用，只落库不回填内存 = PATCH 成功后读面
  // 仍报旧名）。displayName 走 patchUserBodySchema 的 trim+min(1)，空白名 400。
  app.patch('/api/user/me', async (c) => {
    const body = parseWith(patchUserBodySchema, await jsonBody(c), 'body');
    ctx.db
      .update(user)
      .set({ displayName: body.displayName })
      .where(eq(user.id, ctx.user.id))
      .run();
    ctx.user.displayName = body.displayName;
    return c.json(ctx.user);
  });

  app.get('/api/teams', (c) => c.json([ctx.team]));

  app.get('/api/teams/:id/members', (c) => {
    const id = c.req.param('id');
    requireTeam(ctx, id);
    // 成员区只渲染自己一行 + Agent 计数（02 §2.3/r3 §4；r5 §1：Agent 列表
    // 实际走 members，memberType:"agent" 行内嵌 actor 全记录）。
    const rows: TeamMember[] = [
      {
        id: `member-${ctx.user.id}`, // 行 id 合成 [推断]（member 无表位，DB_TABLES 单源）
        teamId: id,
        actorId: ctx.user.id,
        memberType: 'user',
        actor: ctx.user,
      },
    ];
    for (const row of ctx.db.select().from(agent).where(eq(agent.teamId, id)).all()) {
      rows.push({
        id: `member-${row.id}`,
        teamId: id,
        actorId: row.id,
        memberType: 'agent',
        actor: agentRecordOf(row),
      });
    }
    return c.json(rows);
  });

  app.get('/api/teams/:id/notifications', (c) => {
    const id = c.req.param('id');
    requireTeam(ctx, id);
    // {unreadThreadIds}（02 §9.1）：未读 entityId 集（todo/chief 线程）；事件面
    // = services/notifications.ts（SSE 三事件，r5 §7.2）。已读写路径无观测端点，
    // 未读集随新事件 upsert 重置（04 附录 A 补采口径）。
    const unread = ctx.db
      .selectDistinct({ entityId: notification.entityId })
      .from(notification)
      .where(isNull(notification.readAt))
      .all()
      .map((r) => r.entityId);
    return c.json({ unreadThreadIds: unread });
  });

  // —— SSE team stream（02 §1.2；事件形状 = shared teamStreamEventSchema）———————
  app.get('/api/teams/:id/stream', (c) => {
    const teamId = c.req.param('id');
    requireTeam(ctx, teamId);
    return streamSSE(c, async (stream) => {
      const conn = createSerialConnection((payload) =>
        stream.writeSSE({ data: JSON.stringify(payload) }),
      );
      const unsubscribe = ctx.hub.subscribe(teamId, conn);
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
      // 连接即发首帧 ping（seq 连接内递增，r3 §8.1 样本族）[推断：首帧时机]。
      await conn.send({ type: 'ping', seq: conn.nextSeq() });
      await held;
    });
  });

  // —— ⌘K 搜索（02 §6.3 [设计] 自设；wire 无外部真值，面板行为对 r2 04）———————
  app.get('/api/search', (c) =>
    c.json(search(svc, { teamId: ctx.team.id, q: c.req.query('q') ?? null })),
  );

  // —— M5 词表补齐面（02 §6.1 canonical 词表内、此前未实现的 GET 族；响应
  // 封套 wire 未采处 = [推断] 投影，04 §3 不判负口径，wire.test 登记）——————

  app.get('/api/teams/:id/machines', (c) => {
    const id = c.req.param('id');
    requireTeam(ctx, id);
    const rows = ctx.db.select().from(machine).where(eq(machine.teamId, id)).all();
    // #1108 runningSteps 派生随行（机器页「执行中 n/N」数据源）。
    return c.json(rows.map((r) => toMachineRecord(r, machineRunningCount(ctx.db, r.id))));
  });

  // per-runtime 开关写回（spec 11 A8/A9，#357）：enabledRuntimes 全量替换；
  // 词表外 runtime = 400（shared patchMachineBodySchema 钉 MACHINE_RUNTIMES）。
  // XMON-108 R1：shellEnabled 透传——两字段各自缺省 = 不变（单字段 PATCH 不
  // 撞掉另一字段），开关消费面 = claim 组装 + 每调用预检（机器详情页关掉秒级
  // 拒下一条命令，非 claim 期一次闸）。
  // #1108 maxConcurrent：并发上限写位（值域 1..16 = shared schema 钉，越界
  // 400）；下调不抢占在飞步——两侧闸只挡新认领，语义 =「跑完这批再收窄」。
  app.patch('/api/machines/:id', async (c) => {
    const id = c.req.param('id');
    const row = ctx.db.select().from(machine).where(eq(machine.id, id)).get();
    if (!row) throw notFound(`machine ${id}`);
    requireTeam(ctx, row.teamId);
    const body = parseWith(patchMachineBodySchema, await jsonBody(c), 'body');
    const patch = {
      ...(body.enabledRuntimes !== undefined ? { enabledRuntimes: body.enabledRuntimes } : {}),
      ...(body.shellEnabled !== undefined ? { shellEnabled: body.shellEnabled } : {}),
      ...(body.maxConcurrent !== undefined ? { maxConcurrent: body.maxConcurrent } : {}),
    };
    // 全字段缺省 = no-op PATCH（空 set 是非法 SQL，且无变更可写）。
    if (Object.keys(patch).length > 0) {
      ctx.db.update(machine).set(patch).where(eq(machine.id, id)).run();
    }
    const updated = ctx.db.select().from(machine).where(eq(machine.id, id)).get();
    if (!updated) throw notFound(`machine ${id}`);
    return c.json(toMachineRecord(updated, machineRunningCount(ctx.db, id)));
  });

  // 能力读面（XMON-16 / #499 B3 裁决 A；[设计] 面，参考产品 wire 未采此端点）：
  // 引擎能力词表送 web 的那一条。当前载荷 = 思考强度档位——web 的 Agent 详情
  // 只读行按它呈现档位，不自己另存一份七档常量。真值单源 = shared
  // `THINKING_LEVELS`（daemon 的 PI_CAPABILITIES 引同一个数组）；server 读不到
  // daemon，故编排面 = shared 常量直出，不经机器上报。队无关：能力是引擎的
  // 事实，不随团队分叉。
  app.get('/api/capabilities', (c) => {
    return c.json(capabilitiesResponseSchema.parse({ thinkingLevels: THINKING_LEVELS }));
  });

  // 进度面（词表内；载荷未采 [推断] = todo 计数按 phase 投影，用量/进度屏
  // 数据源，02 §6.1）。
  app.get('/api/teams/:id/progress', (c) => {
    const id = c.req.param('id');
    requireTeam(ctx, id);
    const rows = ctx.db.select({ phase: todo.phase }).from(todo).where(eq(todo.teamId, id)).all();
    const byPhase: Record<string, number> = Object.fromEntries(PHASE_VALUES.map((p) => [p, 0]));
    for (const r of rows) byPhase[r.phase] = (byPhase[r.phase] ?? 0) + 1;
    return c.json({ todos: { total: rows.length, byPhase } });
  });

  // whats-new（词表内：形状保留、内容自选，02 §6.1 [设计]——记录 = whats_new
  // 表 body JSON 行）。
  app.get('/api/whats-new', (c) => {
    const rows = ctx.db.select().from(whatsNew).all();
    return c.json(rows.map((r) => ({ id: r.id, createdAt: r.createdAt, ...r.body })));
  });

  // —— 埋点空实现（词表内「形状保留、可空实现」，02 §6.1：analytics/first-touch
  // + PostHog 风格 batch track；复刻无埋点后端，204 收下即弃）——————————
  app.post('/api/analytics/first-touch', () => new Response(null, { status: 204 }));
  app.post('/_mp/api/track', () => new Response(null, { status: 204 }));
}
