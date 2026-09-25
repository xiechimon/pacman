// ⌘K 搜索——02 §6.3（A12 之三，[设计] 自设）：r3 未抓到 todos.dev 搜索 wire
// 词表（r2 §8.4 只盘面板形），wire = 复刻自设，无外部真值；面板行为按
// r2 04/04b 实测态（04 册附录 A：不触发补采）。

import { z } from 'zod';
import { epochMs, phaseSchema, recordId } from '../records/common.js';

/** GET /api/search?q= 响应（02 §6.3 原样；W4 #286 todo 行 + phaseAt——面板
 * 行右缘相对时间位）；服务端 LIKE 查标题/名称。 */
export const searchResponseSchema = z.object({
  todos: z.array(
    z.object({
      id: recordId,
      seqNum: z.number().int(),
      title: z.string(),
      phase: phaseSchema,
      phaseAt: epochMs,
      projectName: z.string(),
    }),
  ),
  projects: z.array(z.object({ id: recordId, name: z.string() })),
  agents: z.array(z.object({ id: recordId, displayName: z.string() })),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;

/** 面板 placeholder（r2 04/04b 实测态）。 */
export const SEARCH_PLACEHOLDER = '搜索任务、项目、成员…';

/** 空输入「前往」组 10 项（r2 04 实测）。 */
export const SEARCH_GOTO_GROUP = [
  '看板',
  '定时',
  '团队',
  '技能',
  'MCP',
  '密钥',
  '机器',
  '模型服务',
  '帐号',
  'API 密钥',
] as const;

/** 无结果态（02 §6.3：中文弯引号 canon）。 */
export function searchNoResultsCopy(query: string): string {
  return `没有与“${query}”匹配的结果`;
}
