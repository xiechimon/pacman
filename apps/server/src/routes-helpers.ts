// routes 拆分共享件（#1125）：域模块共用的守卫 / 行映射 / jsonBody / requestOrigin /
// git Basic auth 校验 / svc deps 装配。拆分是薄接线搬家，逻辑零迁移——各域模块
// （routes-core/-projects/…）从这里取共享件；机器面（routes-machine.ts，02 §5
// 词面单文件）自带同形件，不收编。

import { timingSafeEqual } from 'node:crypto';
import { type AgentRecord, BRAND, type MemoryRecord, type TagRecord } from '@pacman/shared';
import { and, eq } from 'drizzle-orm';
import type { AppContext } from './context.js';
import { agent, type agentMemory, apiKey, project, type tag } from './db/schema.js';
import { sha256Hex } from './lib/crypto.js';
import { notFound } from './lib/errors.js';

/** 会话 cookie 名 [设计]（01 §4.2：httpOnly cookie 自设；品牌槽已随 D3 切换，#109，
 * 单源 = shared BRAND.sessionCookieName）。 */
export const SESSION_COOKIE = BRAND.sessionCookieName;

/** git http 认证域 [设计]（Basic realm；品牌槽归 #44）。 */
export const GIT_AUTH_REALM = 'pacman-git';

export function requireTeam(ctx: AppContext, id: string): void {
  // team 恒 seed 一行（02 §2.2）；其余 id 一律 404。
  if (id !== ctx.team.id) throw notFound(`team ${id}`);
}

export function requireProject(ctx: AppContext, id: string): typeof project.$inferSelect {
  const row = ctx.db.select().from(project).where(eq(project.id, id)).get();
  if (!row) throw notFound(`project ${id}`);
  return row;
}

export function requireAgentRow(ctx: AppContext, teamId: string, agentId: string) {
  const row = ctx.db
    .select()
    .from(agent)
    .where(and(eq(agent.id, agentId), eq(agent.teamId, teamId)))
    .get();
  if (!row) throw notFound(`agent ${agentId}`);
  return row;
}

// agent.mcpServers[] = 本机 config 键名（spec 13/#368）：写入不做存在性校验
// ——未知键静默容忍（勾选与 ~/.claude.json 漂移、多机各读各 config 的竞态），
// 执行 daemon 解析时跳过并落降级行。

export function agentRecordOf(row: typeof agent.$inferSelect): AgentRecord {
  return {
    id: row.id,
    displayName: row.displayName,
    description: row.description,
    status: 'active', // 观测值仅 "active"（records/agent.ts，词表不收窄外值）
    avatarUrl: row.avatarUrl,
    provider: row.provider,
    modelId: row.modelId,
    thinkingLevel: row.thinkingLevel,
    tools: row.tools,
    secrets: row.secrets,
    skills: row.skills,
    mcpServers: row.mcpServers,
  };
}

export function toMemoryRecord(row: typeof agentMemory.$inferSelect): MemoryRecord {
  return {
    id: row.id,
    agentId: row.agentId,
    teamId: row.teamId,
    title: row.title,
    content: row.content,
    projectId: row.projectId,
    sourceTodoId: row.sourceTodoId,
    sourceBuildId: row.sourceBuildId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** tag 行 → record 全形（r9 §3.4 实测 wire 六位；显式投影防列面扩张外溢）。 */
export function toTagRecord(row: typeof tag.$inferSelect): TagRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    color: row.color,
    createdAt: row.createdAt,
    v: row.v,
  };
}

export async function jsonBody(c: { req: { json(): Promise<unknown> } }): Promise<unknown> {
  return c.req.json().catch(() => null);
}

/** 请求源（托管 cloneUrl 的本地主机代位段，02 §5.8 gitHostDomain 槽）。 */
export function requestOrigin(c: { req: { url: string } }): string {
  return new URL(c.req.url).origin;
}

/** git Basic auth → api_key 行 id。凭证 = key 明文（用户名位忽略，PAT 同款
 * [设计]）；校验 = sha256 哈希比对（存哈希不存可逆值，02 §8）+ gitAccess 白名单
 * （02 §6.2）。key 发行端点归 routes-resources.ts；未命中 = undefined（401 面，
 * 02 §3 凭证纪律「手动 fetch 无凭证失败」）。 */
export function verifyGitBasicAuth(ctx: AppContext, header: string): string | undefined {
  const match = /^Basic\s+(.+)$/i.exec(header);
  if (!match) return undefined;
  const decoded = Buffer.from(match[1] ?? '', 'base64').toString('utf8');
  const sep = decoded.indexOf(':');
  if (sep < 0) return undefined;
  const secret = decoded.slice(sep + 1);
  if (secret === '') return undefined;
  const hash = Buffer.from(sha256Hex(secret));
  const rows = ctx.db.select().from(apiKey).where(eq(apiKey.gitAccess, true)).all();
  return rows.find(
    (r) => r.keyHash.length === hash.byteLength && timingSafeEqual(Buffer.from(r.keyHash), hash), // 定长比较（哈希面卫生）
  )?.id;
}

/** svc deps 装配（原 routes.ts 单件 svc）：todo/build/chief/schedule/search/api-key
 * 等服务面共用。box/githubFetch（#452 写向）：createTodo 收口的自建 issue 出站
 * deps——三条创建路径（web 路由 / chief 工具 / MCP face）同律透传。 */
export function svcOf(ctx: AppContext) {
  return {
    db: ctx.db,
    hub: ctx.hub,
    machineHub: ctx.machineHub,
    user: ctx.user,
    convHub: ctx.convHub,
    // #511 审核关口材料：变更面计算位（与人的变更面同源）
    reposDir: ctx.reposDir,
    box: ctx.secretBox,
    ...(ctx.githubFetch !== undefined ? { githubFetch: ctx.githubFetch } : {}),
  };
}
