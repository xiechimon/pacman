// user record——02 §2.1：seed 单本地用户 + 启动即自动登录，
// GET /api/auth/session、/api/user/me 端点保形返回该用户；无注册/邀请/登录页。
// 字段证据 = r2 §1.5 `tds.cache.me-v1` 缓存值 `{type:"user",id,displayName,
// avatarUrl,...}`（/api/user/me 响应的客户端缓存）；省略号段未采齐，
// 未收字段不发明 [推断]。

import { z } from 'zod';
import { recordId } from './common.js';

export const userRecordSchema = z.object({
  id: recordId,
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  /** 缓存样本含 type:"user"；属记录本体还是缓存封套未分离观测 [推断]。 */
  type: z.literal('user').optional(),
});
export type UserRecord = z.infer<typeof userRecordSchema>;

/** 会话 = httpOnly cookie 自设（01 §4.2 认证行）；session-v1 缓存中
 * token 字段留空（r2 §1.5 要点：会话走 cookie）。 */
export const AUTH_SESSION_NOTE = '单用户 seed + 自动登录（02 §2.1）；无登录页复刻';
