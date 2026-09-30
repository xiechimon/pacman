// 能力读面 record（XMON-16 / #499 B3 裁决 A）：daemon 引擎能力词表送到 web
// 的封套形状。参考产品的 wire 未采此面（02 §6.1 无此端点，[设计]），本仓
// 自设——动机是「思考强度」档位是 pi 引擎的事实，web 要呈现它就必须有一条
// 读面，而档位词表不能跨缝复制（daemon 的私有常量冻进 web 等于两份真值）。
//
// 形状取「封套 + 词表」最小面：web 要的恰好是有序档位集（读取面判断一个
// 存值是不是引擎认得的档位、按序呈现），故不投影 AgentBackendCapabilities
// 的其余字段（oauthProviders/compaction/sessionResume 都是 daemon 执行面
// 的事，web 无消费点）。

import { z } from 'zod';
import { thinkingLevelSchema } from '../agent-backend.js';

/** GET /api/capabilities 响应封套。字段名与 AgentBackendCapabilities 的
 *  `thinkingLevels` 同值域同序——web 读面与 daemon 声明面同词。 */
export const capabilitiesResponseSchema = z.object({
  /** 引擎认得的思考强度档位，有序（弱 → 强）。空集合法：后端可以没有档位。 */
  thinkingLevels: z.array(thinkingLevelSchema),
});
export type CapabilitiesResponse = z.infer<typeof capabilitiesResponseSchema>;
