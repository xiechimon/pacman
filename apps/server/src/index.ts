// server 入口（01 §3：Hono REST + SSE + DB + git http-backend 托管 + cron +
// SPA 静态同源托管，02/A1——webDir 见 config.ts）。

import { mkdirSync } from 'node:fs';
import { serve } from '@hono/node-server';
import pino from 'pino';
import { createApp } from './app.js';
import { loadConfig, reposDirOf } from './config.js';
import { openDbWithHandle } from './db/client.js';
import { seed } from './db/seed.js';
import { createKeyfileSecretBox } from './lib/secret-box.js';
import { ConversationStreamHub, TeamStreamHub } from './services/events.js';
import { MachineWakeHub } from './services/machines.js';
import { createScheduler } from './services/scheduler.js';

const config = loadConfig();
const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(process.env.NODE_ENV === 'production'
    ? {}
    : { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } } }),
});

const { db, close } = openDbWithHandle(config.dbPath);
// keyfile 首启生成（0600）；丢失再生成 = 存量密文报废需重录（02 §8 护栏，
// README 落文档）。坏 keyfile 启动即抛，不静默降级。
const secretBox = createKeyfileSecretBox(config.keyfilePath);
const seeded = seed(db);
const hub = new TeamStreamHub();
const convHub = new ConversationStreamHub();
const reposDir = reposDirOf(config);
mkdirSync(reposDir, { recursive: true });
const app = createApp(
  {
    db,
    hub,
    machineHub: new MachineWakeHub(),
    convHub,
    secretBox,
    user: seeded.user,
    team: seeded.team,
    pingIntervalMs: config.pingIntervalMs,
    claimHoldMs: config.claimHoldMs,
    uploads: new Map(),
    enrollments: new Map(),
    reposDir,
    webDir: config.webDir,
  },
  logger,
);

// cron 定时闭环（02 §9.2 宿主自持）：启动即补扫 + tick 循环。
// deps 含 user（M2c 通知面）：定时轮停 review 经 build 漏斗发 build_review（r5 §7.2）。
const scheduler = createScheduler(
  { db, hub, user: seeded.user, convHub },
  { tickMs: config.schedulerTickMs },
);
scheduler.start();

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  logger.info(
    { port: info.port, dataDir: config.dataDir, teamId: seeded.team.id },
    'pacman-server online — 机器注册：POST /api/teams/{id}/api-keys 取 key 后 tds start --api-key <key> --team <teamId>',
  );
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    scheduler.stop();
    server.close();
    close();
    process.exit(0);
  });
}
