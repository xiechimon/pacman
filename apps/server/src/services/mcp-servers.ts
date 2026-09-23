// 团队 MCP server 管理面（02 §7.1，r3 §5.1 record 形状保形）。
// 方向：外部 → Agent（CONTEXT.md 边界：mcpServer 唯一方向是团队接入外部工具）。
// - record wire = r3 §5.1 实测原样（records/mcp-server.ts 单源）；headers 值
//   只写不读（credentialKeys = 头名清单；值密文经 SecretBox，02 §8 at-rest）。
// - stdio 命令/参数 wire 未采 [推断]——[内部] 列承载（schema.ts 注）。
// - slug = 工具名前缀（`mcp__<slug>__<tool>`），小写字母标识符、创建后不可改
//   （MCP_SLUG_COPY canon）；团队内唯一（前缀冲突 = 工具名冲突，409）。

import type { McpEndpoint, McpServerRecord, McpTransport, SecretBox } from '@pacman/shared';
import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { mcpServer } from '../db/schema.js';
import { HttpError } from '../lib/errors.js';
import { newRecordId, nowMs } from '../lib/ids.js';

export interface McpServerDeps {
  db: Db;
  box: SecretBox;
}

type McpServerRow = typeof mcpServer.$inferSelect;

/** slug 规则 [设计]（MCP_SLUG_COPY「小写字母标识符」的可校验化；wire 正则
 * 未观测不收窄——工具名前缀安全性要求：小写字母数字与连折，字母开头）。 */
const SLUG_PATTERN = /^[a-z][a-z0-9-]*$/;

export function toMcpServerRecord(row: McpServerRow): McpServerRecord {
  return {
    teamId: row.teamId,
    label: row.label,
    slug: row.slug,
    transport: row.transport,
    url: row.url,
    hasCredential: row.hasCredential,
    credentialKeys: row.credentialKeys,
    createdBy: row.createdBy,
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function listMcpServers(deps: McpServerDeps, teamId: string): McpServerRecord[] {
  return deps.db
    .select()
    .from(mcpServer)
    .where(eq(mcpServer.teamId, teamId))
    .orderBy(asc(mcpServer.createdAt))
    .all()
    .map(toMcpServerRecord);
}

function validateSlug(slug: string): void {
  if (!SLUG_PATTERN.test(slug)) {
    throw new HttpError(400, `invalid slug: expected lowercase identifier (a-z, 0-9, -)`);
  }
}

export function createMcpServer(
  deps: McpServerDeps,
  input: {
    teamId: string;
    label: string;
    slug: string;
    transport: McpTransport;
    url?: string;
    command?: string;
    args?: string[];
    headers?: Record<string, string>;
    createdBy: string;
  },
): McpServerRecord {
  validateSlug(input.slug);
  const dup = deps.db
    .select({ id: mcpServer.id })
    .from(mcpServer)
    .where(and(eq(mcpServer.teamId, input.teamId), eq(mcpServer.slug, input.slug)))
    .get();
  if (dup) throw new HttpError(409, `mcp server slug ${input.slug} already exists`);
  // transport 必填位（r3 §5.1 表单：远程 HTTP → URL；本地 stdio → 命令+参数）。
  if (input.transport === 'http' && !input.url) {
    throw new HttpError(400, 'invalid body: transport http requires url');
  }
  if (input.transport === 'stdio' && !input.command) {
    throw new HttpError(400, 'invalid body: transport stdio requires command');
  }
  const headers = input.headers ?? {};
  const credentialKeys = Object.keys(headers);
  const id = newRecordId();
  const now = nowMs();
  deps.db
    .insert(mcpServer)
    .values({
      id,
      teamId: input.teamId,
      label: input.label,
      slug: input.slug,
      transport: input.transport,
      // stdio 无 URL 语义；wire record url 必填 → 空串占位 [推断]。
      url: input.transport === 'http' ? (input.url ?? '') : '',
      hasCredential: credentialKeys.length > 0,
      credentialKeys,
      command: input.transport === 'stdio' ? (input.command ?? null) : null,
      args: input.transport === 'stdio' ? (input.args ?? []) : [],
      headersCipher: credentialKeys.length > 0 ? deps.box.seal(JSON.stringify(headers)) : null,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  const row = deps.db.select().from(mcpServer).where(eq(mcpServer.id, id)).get();
  if (!row) throw new HttpError(500, 'mcp server insert lost');
  return toMcpServerRecord(row);
}

export function getMcpServerRow(
  deps: McpServerDeps,
  teamId: string,
  id: string,
): McpServerRow | null {
  return (
    deps.db
      .select()
      .from(mcpServer)
      .where(and(eq(mcpServer.id, id), eq(mcpServer.teamId, teamId)))
      .get() ?? null
  );
}

export function updateMcpServer(
  deps: McpServerDeps,
  teamId: string,
  id: string,
  patch: {
    label?: string;
    url?: string;
    command?: string;
    args?: string[];
    headers?: Record<string, string>;
    slug?: string;
  },
): McpServerRecord {
  const row = getMcpServerRow(deps, teamId, id);
  if (!row) throw new HttpError(404, `mcp server ${id}`);
  // 标识符创建后不可修改（r3 §5.1 文案 canon；工具名前缀稳定性）。
  if (patch.slug !== undefined && patch.slug !== row.slug) {
    throw new HttpError(400, 'slug is immutable after creation');
  }
  const sets: Partial<McpServerRow> = { updatedAt: nowMs() };
  if (patch.label !== undefined) sets.label = patch.label;
  if (patch.url !== undefined) {
    if (row.transport === 'http' && patch.url === '') {
      throw new HttpError(400, 'invalid body: transport http requires url');
    }
    sets.url = patch.url;
  }
  if (patch.command !== undefined) {
    if (row.transport !== 'stdio') {
      throw new HttpError(400, 'command applies to stdio transport only');
    }
    sets.command = patch.command;
  }
  if (patch.args !== undefined) sets.args = patch.args;
  if (patch.headers !== undefined) {
    const credentialKeys = Object.keys(patch.headers);
    sets.hasCredential = credentialKeys.length > 0;
    sets.credentialKeys = credentialKeys;
    sets.headersCipher =
      credentialKeys.length > 0 ? deps.box.seal(JSON.stringify(patch.headers)) : null;
  }
  deps.db.update(mcpServer).set(sets).where(eq(mcpServer.id, id)).run();
  const updated = deps.db.select().from(mcpServer).where(eq(mcpServer.id, id)).get();
  if (!updated) throw new HttpError(500, 'mcp server update lost');
  return toMcpServerRecord(updated);
}

export function deleteMcpServer(deps: McpServerDeps, teamId: string, id: string): boolean {
  const res = deps.db
    .delete(mcpServer)
    .where(and(eq(mcpServer.id, id), eq(mcpServer.teamId, teamId)))
    .run();
  return res.changes > 0;
}

/** claim 载荷端点解析（per-turn 连接的 server 侧半，02 §7.1）：agent.mcpServers[]
 * 勾选的 slug → mcp_server 行 → McpEndpoint（headers 密文 per-step 解析内存下发，
 * 02 §8 运行时纪律同族；stdio = command/args [内部] 列）。未知 slug 跳过
 * （授权勾选与 server 删除的竞态容忍 [设计]）。 */
export function resolveAgentMcpEndpoints(
  deps: McpServerDeps,
  teamId: string,
  slugs: readonly string[],
): McpEndpoint[] {
  const endpoints: McpEndpoint[] = [];
  for (const slug of slugs) {
    const row = deps.db
      .select()
      .from(mcpServer)
      .where(and(eq(mcpServer.teamId, teamId), eq(mcpServer.slug, slug)))
      .get();
    if (!row) continue;
    const headers = row.headersCipher
      ? (JSON.parse(deps.box.open(row.headersCipher)) as Record<string, string>)
      : undefined;
    endpoints.push({
      slug: row.slug,
      transport: row.transport,
      ...(row.transport === 'http' ? { url: row.url } : {}),
      ...(row.transport === 'stdio' && row.command ? { command: row.command, args: row.args } : {}),
      ...(headers ? { headers } : {}),
    });
  }
  return endpoints;
}
