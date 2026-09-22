// server 入口（01 §3：Hono REST + SSE + DB；SPA 静态同源托管面随 web 线汇合
// 归 M5，git http-backend/cron 归 M2b）。

import { serve } from '@hono/node-server';
import pino from 'pino';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openDbWithHandle } from './db/client.js';
import { seed } from './db/seed.js';
import { TeamStreamHub } from './services/events.js';

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
    user: seeded.user,
    team: seeded.team,
    pingIntervalMs: config.pingIntervalMs,
  },
  logger,
);

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
