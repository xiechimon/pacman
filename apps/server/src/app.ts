// Hono app 组装：路由 + 统一错误形状 {"error": …}（04 §3 错误形状对拍面，
// 样本 = r5 §1 实测 400）。

import { Hono } from 'hono';
import type { Logger } from 'pino';
import type { AppContext } from './context.js';
import { HttpError } from './lib/errors.js';
import { registerRoutes } from './routes.js';
import { NotFoundError } from './services/builds.js';
import { PhaseTransitionError } from './services/phase.js';

export function createApp(ctx: AppContext, logger?: Logger): Hono {
  const app = new Hono();
  registerRoutes(app, ctx);

  app.notFound((c) => c.json({ error: 'Not found' }, 404));
  app.onError((err, c) => {
    if (err instanceof HttpError) {
      return c.json({ error: err.message }, err.status as 400);
    }
    if (err instanceof NotFoundError) {
      return c.json({ error: err.message }, 404);
    }
    if (err instanceof PhaseTransitionError) {
      return c.json({ error: err.message }, 409);
    }
    logger?.error({ err }, 'unhandled error');
    return c.json({ error: 'Internal server error' }, 500);
  });
  return app;
}
