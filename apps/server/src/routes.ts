// web REST 面组合器（#1125 拆分：routes-machine.ts 同式）——原 ~2000 行单文件
// 按域拆成 routes-<domain>.ts（各导出 register<Domain>Routes(app, ctx)），本文件
// 只做按序组合。词表单源 = shared WEB_REST_ENDPOINTS（02 §6.1 canonical；路由
// 对拍测试 = test/wire.test.ts，拆分票的硬验收 = 该文件零改动保持绿）。
// 覆盖面 = M2a 核心 CRUD + team stream + repo 双形态（02 §3/A4：托管 bare
// `git http-backend` + GitHub 接入记录面 + tree/file/branches 文件浏览）+
// schedule CRUD（02 §9.2，M2b）+ 密钥三面（provider/secret/apiKey，02 §8）+
// 搜索（02 §6.3，M2c）；machine/chief 面归 M3/M4（routes-machine.ts 已独立）。
// 拆分动机 = 车道并行冲突面（30 天 53 commit 的热点文件，~85% 处理器是薄
// 接线）——不是「文件太大」。
//
// 注册顺序纪律：registerCoreRoutes 恒第一个——它的 /api/* cookie 中间件必须
// 先于一切 /api 处理器注册（Hono 按注册序组合匹配链）；域内各自保持原有
// 相对顺序。/git/* 面最后（与 app.ts 的 SPA catch-all 之间无遮蔽）。

import type { Hono } from 'hono';
import type { AppContext } from './context.js';
import { registerAgentRoutes } from './routes-agents.js';
import { registerAttachmentRoutes } from './routes-attachments.js';
import { registerBuildRoutes } from './routes-builds.js';
import { registerChiefRoutes } from './routes-chief.js';
import { registerConversationRoutes } from './routes-conversations.js';
import { registerCoreRoutes } from './routes-core.js';
import { registerGitHostingRoutes } from './routes-git-hosting.js';
import { registerMcpRoutes } from './routes-mcp.js';
import { registerProjectRoutes } from './routes-projects.js';
import { registerResourceRoutes } from './routes-resources.js';
import { registerTodoRoutes } from './routes-todos.js';

export function registerRoutes(app: Hono, ctx: AppContext): void {
  registerCoreRoutes(app, ctx); // /api/* cookie 中间件 + seed/team/机器管理面
  registerProjectRoutes(app, ctx); // 项目 CRUD + 标签/issue 导入/文件浏览/fs 面
  registerTodoRoutes(app, ctx); // 任务 CRUD + orchestrate/reset + issue 回显
  registerBuildRoutes(app, ctx); // build 读/动作面 + 分支同步 + plans/changes/usage
  registerChiefRoutes(app, ctx); // 总管配置/线程/rewind/问答卡
  registerConversationRoutes(app, ctx); // 会话读写分流（chief/build 双消费）
  registerAgentRoutes(app, ctx); // Agent CRUD + 记忆 + 任务投影 + mcp-servers
  registerAttachmentRoutes(app, ctx); // 附件 grant → upload → read 三步
  registerResourceRoutes(app, ctx); // providers/oauth/secrets/api-keys/skills/schedules
  registerMcpRoutes(app, ctx); // MCP 协议面（Bearer apiKey）
  registerGitHostingRoutes(app, ctx); // 托管 repo git CGI 面（Basic auth）
}
