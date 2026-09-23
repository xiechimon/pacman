// message record（transcript）——02 §1.3：build 的有序消息与工具调用记录，
// 经 upload-urls/<stepId> 预签名上传回传落库；transcript 是 build 的一面
// （facet），非独立可操作实体（CONTEXT.md）。
// 会话流 SSE = GET /api/conversations/{id}/stream（r3 §3.5 抓包见请求），
// 逐事件 wire 载荷未枚举，承载 02 §5.6 pi 流事件词表 [推断]，归 M3 对拍。
// role 词表与响应封套证据 = r5 §3.6（chief 会话实测；build 会话为同端点族
// conversations/{id}/messages，同形 [推断]）。

import { z } from 'zod';
import { activeRunSchema } from './chief.js';
import { epochMs, recordId } from './common.js';

/** role 词表（r5 §3.6 实测：system/user/assistant）。 */
export const messageRoleSchema = z.enum(['system', 'user', 'assistant']);
export type MessageRole = z.infer<typeof messageRoleSchema>;

/** 消息行。system content 为 JSON 串（r5 §3.6 实测
 * `{"kind":"machine_selected","machineId":…,"name":…}`）；assistant 正文可内联
 * 实体引用（chief 会话）；载荷尾部内嵌实体上下文 map（todos 全 doc +
 * projects/skills/machines，r5 §3.6）。工具行（`> edit README.md` / `> bash
 * <完整命令>`，r3 §3.5）= pi toolcall_end 载荷（02 §5.6），wire 细形归 M3。
 * 未采字段不发明，开放形状 [推断]。 */
export const messageRecordSchema = z
  .object({
    role: messageRoleSchema,
    content: z.unknown(),
  })
  .loose();
export type MessageRecord = z.infer<typeof messageRecordSchema>;

/** transcript 消息行（r5 §3.6 封套行实测含 id/createdAt 位；conversation
 * stream message 事件同形，protocol/sse.ts）。 */
export const transcriptRowSchema = messageRecordSchema.extend({
  id: recordId,
  createdAt: epochMs,
});
export type TranscriptRow = z.infer<typeof transcriptRowSchema>;

/** system 消息 kind 观测值（r5 §3.6；词表未采齐不收窄 [推断]）。 */
export const SYSTEM_MESSAGE_KINDS = ['machine_selected'] as const;

/** GET /api/conversations/{id}/messages 响应封套（r5 §3.6 原样）。 */
export const conversationMessagesResponseSchema = z.object({
  messages: z.array(transcriptRowSchema),
  /** chips/steerPending/nextCursor 细形未逐一采集 [推断]（steerPending[] 为
   * 数组形观测；steer 语义 = 回合中补充说明即送，r5 §3.6）。 */
  chips: z.unknown(),
  historyEpoch: z.number().int(),
  steerPending: z.array(z.unknown()),
  activeRun: activeRunSchema,
  nextCursor: z.unknown(),
});
export type ConversationMessagesResponse = z.infer<typeof conversationMessagesResponseSchema>;
