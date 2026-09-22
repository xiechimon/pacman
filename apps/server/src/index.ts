// server 入口（01 §3：Hono REST + SSE + DB + git http-backend 托管 + cron；
// SPA 静态同源托管面随 web 线汇合归 M5）。

import { mkdirSync } from 'node:fs';
import { serve } from '@hono/node-server';
import pino from 'pino';
import { createApp } from './app.js';
import { loadConfig, reposDirOf } from './config.js';
import { openDbWithHandle } from './db/client.js';
import { seed } from './db/seed.js';
import { createKeyfileSecretBox } from './lib/secret-box.js';
import { TeamStreamHub } from './services/events.js';
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
const reposDir = reposDirOf(config);
mkdirSync(reposDir, { recursive: true });
const app = createApp(
  {
    db,
    hub,
    secretBox,
    user: seeded.user,
    team: seeded.team,
    pingIntervalMs: config.pingIntervalMs,
    reposDir,
  },
  logger,
);

// cron 定时闭环（02 §9.2 宿主自持）：启动即补扫 + tick 循环。
// deps 含 user（M2c 通知面）：定时轮停 review 经 build 漏斗发 build_review（r5 §7.2）。
const scheduler = createScheduler(
  { db, hub, user: seeded.user },
  { tickMs: config.schedulerTickMs },
);
scheduler.start();

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  logger.info(
    { port: info.port, dataDir: config.dataDir, teamId: seeded.team.id },
    'pacman-server online',
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
