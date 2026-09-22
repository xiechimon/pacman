// tokenUsage record——02 §6.2：按 `build × model × {输入,输出,缓存读,缓存写}`
// 的记账读数（r3 §3.8 分项形状实测）；值对象，无自身生命周期（CONTEXT.md）。
// wire 字段名未观测（UI 分项为中文词），以下为 [推断] 投影，可改判。

import { z } from 'zod';
import { recordId } from './common.js';

/** 四维计数分项 UI 词（r3 §3.8：`输入 12 / 输出 980 / 缓存读取 49.7k /
 * 缓存写入 25.4k`）。 */
export const TOKEN_USAGE_PARTS = ['输入', '输出', '缓存读取', '缓存写入'] as const;

export const tokenUsageSchema = z.object({
  buildId: recordId,
  /** `<provider>/<modelId>` 串（r3 §1.5 `using model r3-gw/claude-sonnet-5`、
   * §3.8 `r3-gw/claude-sonnet-5 76.1k`）。 */
  model: z.string(),
  input: z.number().int(),
  output: z.number().int(),
  cacheRead: z.number().int(),
  cacheWrite: z.number().int(),
});
export type TokenUsage = z.infer<typeof tokenUsageSchema>;
