// MCP server 面（#1125 拆分自 routes.ts）：02 §7.2，M4b——/api/mcp 路径保形；
// Bearer <apiKey> + key 级 24 工具白名单；stateless streamable HTTP
// （services/mcp-face.ts = server 侧唯一 sdk 薄桥位，00/D4）。app.all =
// 协议面动词族（POST JSON-RPC；GET/DELETE stateless 405），wire 词表对拍按
// ALL 豁免（git 面同族——独立协议边界 + 自有认证域，故不并入 REST 域模块）。

import type { Hono } from 'hono';
import type { AppContext } from './context.js';
import { handleMcpRequest } from './services/mcp-face.js';

export function registerMcpRoutes(app: Hono, ctx: AppContext): void {
  app.all('/api/mcp', (c) =>
    handleMcpRequest(
      {
        db: ctx.db,
        hub: ctx.hub,
        machineHub: ctx.machineHub,
        box: ctx.secretBox,
        user: ctx.user,
        reposDir: ctx.reposDir,
        attachmentsDir: ctx.attachmentsDir,
        mcpConfigPath: ctx.mcpConfigPath,
        skillsDir: ctx.skillsDir,
        ...(ctx.convHub !== undefined ? { convHub: ctx.convHub } : {}),
        ...(ctx.githubFetch !== undefined ? { githubFetch: ctx.githubFetch } : {}),
      },
      c.req.raw,
    ),
  );
}
