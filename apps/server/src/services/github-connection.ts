// github_connection 服务面（spec 12 / #359 G2-T1，#352 族）：GitHub OAuth
// 连接行的唯一读写点。纪律（02 §8 凭证族 + spec 12 story 10）：
// - accessToken 只以 SecretBox 信封密文落 accessTokenCipher 列——明文不进表
//   任何列、不进日志、不进 wire 响应；
// - token 唯一读出点 = openGithubToken（server 出站边界消费：repos 代理
//   Authorization 头；spec 12 G2-T2 起另供 daemon 执行凭证下发）；
// - 连接状态读面（login/scope，无 token 位）归 G2-T4 认证面端点封套；
// - DAO 语义：重认证 = 覆盖（teamId 单行，onConflictDoUpdate）、断开 = 删行
//   （幂等，缺行不抛）。

import type { GithubConnectionStatus, SecretBox } from '@pacman/shared';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { githubConnection } from '../db/schema.js';
import { nowMs } from '../lib/ids.js';

export interface GithubConnectionDeps {
  db: Db;
  box: SecretBox;
}

function getRow(deps: GithubConnectionDeps, teamId: string) {
  return deps.db.select().from(githubConnection).where(eq(githubConnection.teamId, teamId)).get();
}

/** 连接落库：无行 = 建、有行 = 整行覆盖（重认证语义，不增行）。 */
export function upsertGithubConnection(
  deps: GithubConnectionDeps,
  input: { teamId: string; login: string; accessToken: string; scope: string },
): void {
  const accessTokenCipher = deps.box.seal(input.accessToken);
  const createdAt = nowMs();
  deps.db
    .insert(githubConnection)
    .values({
      teamId: input.teamId,
      login: input.login,
      accessTokenCipher,
      scope: input.scope,
      createdAt,
    })
    .onConflictDoUpdate({
      target: githubConnection.teamId,
      set: { login: input.login, accessTokenCipher, scope: input.scope, createdAt },
    })
    .run();
}

/** 断开 = 删行（幂等）；返回删除前是否有行。 */
export function deleteGithubConnection(deps: GithubConnectionDeps, teamId: string): boolean {
  const existed = getRow(deps, teamId) !== undefined;
  deps.db.delete(githubConnection).where(eq(githubConnection.teamId, teamId)).run();
  return existed;
}

/** server 内部消费唯一读出点（出站 Authorization 头）；未连接 = null。
 * 密文损坏 / keyfile 不匹配 = SecretBoxError 直抛（secret-box.ts 语义）。 */
export function openGithubToken(deps: GithubConnectionDeps, teamId: string): string | null {
  const row = getRow(deps, teamId);
  if (!row) return null;
  return deps.box.open(row.accessTokenCipher);
}

/** 认证状态读面（#361 G2-T4 封套，shared githubConnectionStatusSchema 单源）：
 * 仅 login/scope——token/密文位永不出现（02 §8 只写不读出 wire）。 */
export function readGithubConnectionStatus(
  deps: GithubConnectionDeps,
  teamId: string,
): GithubConnectionStatus {
  const row = getRow(deps, teamId);
  if (!row) return { connected: false };
  return { connected: true, login: row.login, scope: row.scope };
}
