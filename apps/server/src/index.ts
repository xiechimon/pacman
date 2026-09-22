// server 入口（01 §3：Hono REST + SSE + DB；SPA 静态同源托管面随 web 线汇合
// 归 M5，git http-backend/cron 归 M2b）。

import { serve } from '@hono/node-server';
import pino from 'pino';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openDbWithHandle } from './db/client.js';
import { seed } from './db/seed.js';
import { TeamStreamHub } from './services/events.js';
import { MachineWakeHub } from './services/machines.js';

const config = loadConfig();
const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(process.env.NODE_ENV === 'production'
    ? {}
    : { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } } }),
});

const { db, close } = openDbWithHandle(config.dbPath);
const seeded = seed(db);
const app = createApp(
  {
    db,
    hub: new TeamStreamHub(),
    machineHub: new MachineWakeHub(),
    user: seeded.user,
    team: seeded.team,
    pingIntervalMs: config.pingIntervalMs,
    claimHoldMs: config.claimHoldMs,
    uploads: new Map(),
    enrollments: new Map(),
  },
  logger,
);

// bootstrap API key 一次性明文展示（02 §8/r3 §6「仅显示一次」语义；机器注册
// `tds start --api-key <key> --team <id>`，02 §5.2 路径二）。
if (seeded.bootstrapApiKey) {
  logger.info(
    { apiKey: seeded.bootstrapApiKey.plain, teamId: seeded.team.id },
    'bootstrap API key created (shown once) — enroll a machine with: tds start --api-key <key> --team <teamId>',
  );
}

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  logger.info(
    { port: info.port, dataDir: config.dataDir, teamId: seeded.team.id },
    'pacman-server online',
  );
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close();
    close();
    process.exit(0);
  });
}
