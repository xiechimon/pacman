// 实时通道词表——02 §1.2（锁定：全 SSE 无 WebSocket，r3 §8.1 实测整场会话
// 0 条 webSocket 事件）+ r5 §7.2 team stream 实测扩充（todo/build 全文档事件
// + notification 事件）。复刻双保险（02 §1.2）：SSE 文档事件直更 + 重取兜底
// （TanStack Query invalidateQueries，01 §4.1/S8）。

import { z } from 'zod';
import { buildRecordSchema } from '../records/build.js';
import { recordId } from '../records/common.js';
import { notificationRecordSchema } from '../records/notification.js';
import { todoRecordSchema } from '../records/todo.js';

export const SSE_CHANNELS = [
  {
    id: 'team',
    endpoint: '/api/teams/{id}/stream',
    audience: 'browser',
    note: '团队流：ping/machine_presence/todo/build/notification（02 §1.2，r5 §7.2 扩充）',
  },
  {
    id: 'conversation',
    endpoint: '/api/conversations/{id}/stream',
    audience: 'browser',
    note: '会话流：transcript 实时流（r3 §3.5 抓包）；逐事件载荷未枚举，承载 pi 流词表 [推断]（protocol/executor.ts）',
  },
  {
    id: 'machine',
    endpoint: '/api/machine/stream',
    audience: 'daemon',
    note: '机器 wake：低延迟派发唤醒（r3 §1.5）',
  },
] as const;

/** ping 心跳节奏 ~15s（r3 §8.1 实测 `{"type":"ping","seq":16}`）。 */
export const TEAM_STREAM_PING_INTERVAL_MS = 15_000;

export const pingEventSchema = z.object({
  type: z.literal('ping'),
  seq: z.number().int(),
});

export const machinePresenceEventSchema = z.object({
  type: z.literal('machine_presence'),
  machineId: recordId,
  online: z.boolean(),
});

/** todo/build 全文档推送（r5 §7.2 实测：带 seq/v 版本，看板可据文档事件直更；
 * 02 §1.2 部分改判——是否并存失效重取未分离观测 [推断保留]）。 */
export const todoDocEventSchema = z.object({
  type: z.literal('todo'),
  seq: z.number().int(),
  v: z.number().int(),
  doc: todoRecordSchema,
});

export const buildDocEventSchema = z.object({
  type: z.literal('build'),
  seq: z.number().int(),
  v: z.number().int(),
  doc: buildRecordSchema,
});

/** notification 事件（r5 §7.2 事件公共形状 {type:"notification", notification:{…}}；
 * 触发矩阵三事件见 records/notification.ts）。 */
export const notificationEventSchema = z.object({
  type: z.literal('notification'),
  notification: notificationRecordSchema,
});

export const teamStreamEventSchema = z.discriminatedUnion('type', [
  pingEventSchema,
  machinePresenceEventSchema,
  todoDocEventSchema,
  buildDocEventSchema,
  notificationEventSchema,
]);
export type TeamStreamEvent = z.infer<typeof teamStreamEventSchema>;

/** 机器 wake 通道事件 = pi 词表 wake/shutdown 族（02 §5.6）；载荷细形
 * [推断]（r3 §1.5 `[wake] push channel connected` 为 daemon 侧行）。 */
export const MACHINE_STREAM_EVENT_TYPES = ['wake', 'shutdown'] as const;
