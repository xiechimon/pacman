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

/** 改名落盘面 body（#1031：帐号页名称行内编辑，PATCH /api/user/me）。只有
 *  displayName 一位——头像无上传面（#306 wontfix），不在此开写路径。
 *  `.trim().min(1)`：空白名不落库（身份位非空），与 agent displayName 同律
 *  但补 trim（zod 4 transform 先 trim 再校验长度，纯空白 → 空 → 拒）。 */
export const patchUserBodySchema = z.object({
  displayName: z.string().trim().min(1),
});
export type PatchUserBody = z.infer<typeof patchUserBodySchema>;

/** 会话 = httpOnly cookie 自设（01 §4.2 认证行）；session-v1 缓存中
 * token 字段留空（r2 §1.5 要点：会话走 cookie）。 */
export const AUTH_SESSION_NOTE = '单用户 seed + 自动登录（02 §2.1）；无登录页复刻';
