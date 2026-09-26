// tag record——CONTEXT.md：todo 的多对多标签（join = todo_tag，01 §6）；
// 端点 GET/POST /api/projects/{id}/tags（02 §6.1 + r9 §3.4 补采）、
// todo.tagIds[]（r3 §3.0）、Agent 权限「创建标签」开关（r3 §4）。
// record 形状 = r9 §3.4 实测 wire 原样 {id, projectId, name, color,
// createdAt, v}（#309 前三位缺采时的最小投影已按实测补齐）。

import { z } from 'zod';
import { epochMs, recordId } from './common.js';

export const tagRecordSchema = z.object({
  id: recordId,
  projectId: recordId,
  name: z.string(),
  /** 标签色 hex（r9 §3.4 观测样本 `#6366f1`；自由字符串不收窄 [推断]）。 */
  color: z.string(),
  createdAt: epochMs,
  /** 记录版本号（tag 无 PATCH 面观测，恒 1 [推断]；record 位在 r9 实测）。 */
  v: z.number().int(),
});
export type TagRecord = z.infer<typeof tagRecordSchema>;

/** POST /api/projects/{id}/tags body（r9 §3.4 实测 {name, color}）。
 *  color 客户端缺省 `#6366f1`（原站前端定值，r9 §3.4）。 */
export const createTagBodySchema = z.object({
  name: z.string().min(1),
  color: z.string(),
});
export type CreateTagBody = z.infer<typeof createTagBodySchema>;

/** 新建标签的客户端缺省色（r9 §3.4：color 客户端缺省 #6366f1 = indigo-500；
 *  原站前端定值、非 server 下发，消费面 = web 对话框）。 */
export const TAG_DEFAULT_COLOR = '#6366f1';
