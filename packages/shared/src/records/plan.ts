// plan record——02 §4.2（r5 §4 实走改判）：plan 即文件（plan.md），
// 版本 = 文件版本（驳回 → v2 + plan.md 文件级 unified diff）；plan 是 build
// facet（Context / Changes / Edge cases / Verification 四段卡），非独立实体
// （CONTEXT.md）。四段为 LLM 自由文本，结构非硬 schema（r3 §3.3）。

import { z } from 'zod';
import { epochMs, recordId } from './common.js';

/** 文件名 canon（02 §4.2：plan 即文件 plan.md）。 */
export const PLAN_FILE_NAME = 'plan.md';

/** 四段卡软结构（r3 §3.3 plan 卡：Context: / Changes: / Edge cases: /
 * Verification:；Edge cases 可省略——LLM 自由文本）。 */
export const PLAN_SECTIONS = ['Context', 'Changes', 'Edge cases', 'Verification'] as const;

/** wire 记录未实测（build.planDocId 为观测触点，r5 §7.2；文档头版本 chip
 * v1/v2 + 下拉 `vN · 相对时间`，r5 §4），最小投影 [推断]。 */
export const planRecordSchema = z.object({
  /** = build.planDocId（documents/{id}/diff 的 {id} 同值）。 */
  id: recordId,
  buildId: recordId, // ≡ conversationId
  /** 文档版本（v1、v2…，r5 §4 版本机制）。 */
  version: z.number().int().min(1),
  createdAt: epochMs,
});
export type PlanRecord = z.infer<typeof planRecordSchema>;
