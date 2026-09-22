// team record——02 §2.2：team 表与全部 teamId 路径段形状保留，数据恒 seed 一行；
// 真人 invite 不实现（成员区只渲染自己一行 + Agent 计数，r3 §4 观察「成员计数
// 把 Agent 计入」）。字段证据 = r2 §1.5 `tds.cache.teams-v1` 缓存值
// `[{id,name,createdAt,plan:"free",avatarStyle:"notionist..."}]`。

import { z } from 'zod';
import { agentRecordSchema } from './agent.js';
import { epochMs, recordId } from './common.js';
import { userRecordSchema } from './user.js';

/** plan 字段形状保留但不参与任何门控（02 §2.4/A3：Pro 墙整体不复刻）。
 * 观测值 "free"；全枚举未采 [推断]，不收窄。 */
export const teamPlanSchema = z.string();

export const teamRecordSchema = z.object({
  id: recordId,
  name: z.string(),
  createdAt: epochMs,
  plan: teamPlanSchema,
  /** 第三方头像风格名（素材替换计划 §3.1：随实现选型定，非 todos.dev 版权项）
   * [推断] 值域。 */
  avatarStyle: z.string().nullable(),
});
export type TeamRecord = z.infer<typeof teamRecordSchema>;

/** 成员行（r2 §1.5 members-v1 缓存样本 {id,teamId,actorId,memberType:"user",…}；
 * r5 §1：Agent 列表实际走 GET teams/{id}/members——memberType:"agent" 行内嵌
 * actor 全记录，含 activeTaskCount）。行与 actor 的未采余量字段不收窄，
 * 开放形状 [推断]。 */
export const memberTypeSchema = z.enum(['user', 'agent']);
export const teamMemberSchema = z
  .object({
    id: recordId,
    teamId: recordId,
    actorId: recordId,
    memberType: memberTypeSchema,
    actor: z.union([userRecordSchema.loose(), agentRecordSchema.loose()]).optional(),
  })
  .loose();
export type TeamMember = z.infer<typeof teamMemberSchema>;
