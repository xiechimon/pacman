// 单用户 seed + team 保形（02 §2/A2）：seed 单本地用户、启动即自动登录；
// team 表与全部 teamId 路径段形状保留，数据恒 seed 一行。幂等：已有行即返回。
// seed 内容（displayName/team name/avatarStyle）= [设计]（无观测 canon，内容自选）。
// bootstrap API key [设计]：单用户 self-host 机器注册（02 §5.2 --api-key 路径）
// 需要一把团队 API key；api-keys 管理面归 M2c——seed 首启生成一行并一次性
// 返回明文（此后只存哈希，展示规则 = r3 §6「仅显示一次」语义）。

import type { TeamRecord, UserRecord } from '@pacman/shared';
import { eq } from 'drizzle-orm';
import { newRecordId, nowMs } from '../lib/ids.js';
import { newApiKey } from '../lib/keys.js';
import type { Db } from './client.js';
import { apiKey, team, user } from './schema.js';

export interface SeedResult {
  user: UserRecord;
  team: TeamRecord;
  /** 首启一次性明文（02 §8 存哈希纪律；再次启动为 null）。 */
  bootstrapApiKey: { id: string; plain: string; masked: string } | null;
}

function seedApiKey(db: Db, teamId: string): SeedResult['bootstrapApiKey'] {
  const existing = db.select().from(apiKey).where(eq(apiKey.teamId, teamId)).all()[0];
  if (existing) return null;
  const key = newApiKey();
  const id = newRecordId();
  db.insert(apiKey)
    .values({
      id,
      teamId,
      name: 'bootstrap',
      gitAccess: false,
      mcpAccess: false,
      toolGrants: { read: [], write: [] },
      keyHash: key.hash,
      masked: key.masked,
      createdAt: nowMs(),
    })
    .run();
  return { id, plain: key.plain, masked: key.masked };
}

export function seed(db: Db): SeedResult {
  const existingTeam = db.select().from(team).all()[0];
  const existingUser = db.select().from(user).all()[0];
  if (existingTeam && existingUser) {
    return {
      user: toUserRecord(existingUser),
      team: toTeamRecord(existingTeam),
      bootstrapApiKey: seedApiKey(db, existingTeam.id),
    };
  }

  const userId = newRecordId();
  const teamId = newRecordId();
  const createdAt = nowMs();
  // 02 §2.1：seed 单本地用户。响应面补 type:"user"（r2 §1.5 me-v1 缓存样本；
  // 记录本体还是缓存封套未分离观测 [推断]，按封套处理不落列）。
  const displayName = 'Owner';
  db.insert(user).values({ id: userId, displayName, avatarUrl: null }).run();
  db.insert(team)
    .values({
      id: teamId,
      name: `${displayName}'s team`,
      createdAt,
      plan: 'free', // 形状保留、不参与门控（02 §2.4/A3）
      avatarStyle: 'notionist', // [推断] 值域（records/team.ts）
    })
    .run();

  const userRow = db.select().from(user).where(eq(user.id, userId)).get();
  const teamRow = db.select().from(team).where(eq(team.id, teamId)).get();
  if (!userRow || !teamRow) throw new Error('seed failed: rows missing after insert');
  return {
    user: toUserRecord(userRow),
    team: toTeamRecord(teamRow),
    bootstrapApiKey: seedApiKey(db, teamId),
  };
}

export function toUserRecord(row: typeof user.$inferSelect): UserRecord {
  return { type: 'user', id: row.id, displayName: row.displayName, avatarUrl: row.avatarUrl };
}

export function toTeamRecord(row: typeof team.$inferSelect): TeamRecord {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    plan: row.plan,
    avatarStyle: row.avatarStyle,
  };
}
