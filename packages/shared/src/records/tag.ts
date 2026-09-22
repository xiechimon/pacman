// tag record——CONTEXT.md：todo 的多对多标签（join = todo_tag，01 §6）；
// 端点 GET /api/projects/{id}/todos|tags（02 §6.1）、todo.tagIds[]（r3 §3.0）、
// Agent 权限「创建标签」开关（r3 §4）。wire 形状未实测，最小投影 [推断]。

import { z } from 'zod';
import { recordId } from './common.js';

export const tagRecordSchema = z.object({
  id: recordId,
  projectId: recordId,
  name: z.string(),
});
export type TagRecord = z.infer<typeof tagRecordSchema>;
