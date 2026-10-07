// transcript 行写入单源（#902 从 builds.ts 提出）：builds（过闸动作宣告行）
// 与 todos（手动改相 done 落地审计行）两个服务面共用；留在 builds.ts 会让
// todos→builds 反向依赖成环（builds 已 import todos 的 getTodo/setTodoPhase）。

import type { Db } from '../db/client.js';
import { message } from '../db/schema.js';
import type { ConversationStreamHub } from './events.js';

/** transcript 行落库 + 会话流即时推送（M5 live streaming：驳回 feedback 行/
 * 合并宣告行/🎉 行三处同形；machine 面 live 行走 machines.ts upsert 族）。
 * actor（#902）：过闸宣告行的动作主体 displayName；缺省 = 无 actor 位
 * （daemon 上传行/存量行语义），呈现层回落当前用户名。 */
export function insertMessageRow(
  deps: { db: Db; convHub?: ConversationStreamHub },
  conversationId: string,
  row: {
    id: string;
    role: 'system' | 'user' | 'assistant';
    content: unknown;
    createdAt: number;
    actor?: string | null;
  },
): void {
  deps.db
    .insert(message)
    .values({ ...row, actor: row.actor ?? null, conversationId })
    .run();
  deps.convHub?.publishMessage(conversationId, row);
}
