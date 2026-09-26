// step record——02 §4.2（A6 锁定）：step 队列 server 持有、机器 claim 三类步
// （规划步/执行步/合并步，r3 §1.5 观测）。wire kind 词与记录字段未采集，
// 以下为 [推断] 投影（弱证：assignment 双槽 plan/build、steps body side:"plan"、
// 合并步语义），实现期重放补采后回写 02 §11 收紧（04 §3 不判负口径）。

import { z } from 'zod';
import { epochMs, recordId } from './common.js';

/** 三类步（02 §4.2 中文语义名的 wire 投影 [推断]）+ `chief`（M4a [设计]：
 * Chief 回合 = 机器 step 为一手实测（r5 §3.1 daemon.log `claim step=…` →
 * `conv chief-…`），kind 词未采——自定等价物，04 §3 不判负口径）。 */
export const stepKindSchema = z.enum(['plan', 'build', 'merge', 'chief']);
export type StepKind = z.infer<typeof stepKindSchema>;

export const stepRecordSchema = z.object({
  id: recordId, // 观测形态 base64 样（r3 §9 `claim step=3iE_…`、r5 §3.1）
  /** 所属 build（≡ conversationId，CONTEXT.md 实体等式）。 */
  buildId: recordId,
  kind: stepKindSchema,
  /** claim 到该步的机器；未领取 null [推断]。 */
  machineId: recordId.nullable(),
  createdAt: epochMs,
  // journal 状态字段（heartbeat/tool/done 生命周期，02 §5.4；recover 细节
  // [推断]）归 M2/M3 按实现展开，不预发明。
});
export type StepRecord = z.infer<typeof stepRecordSchema>;

/** journal 状态词（02 §5.4 [内部] 展开：claimed = 机器领取未收尾）。 */
export const stepStatusSchema = z.enum(['pending', 'claimed', 'done', 'failed']);
export type StepStatus = z.infer<typeof stepStatusSchema>;

/** steps 读面/会话流 step 事件行 = record + journal 位透出 [设计]（M5 详情
 * 面进度行/分支 dialog 目标提交数据源；stepRecordSchema 最小投影不含 =
 * zod strip 下 record 对拍不漂移）。server/web 双端单源。 */
export const stepJournalRowSchema = stepRecordSchema.extend({
  status: stepStatusSchema,
  checkpointCommit: recordId.nullable(),
});
export type StepJournalRow = z.infer<typeof stepJournalRowSchema>;

/** POST /api/builds/{id}/steps body——确认回路（02 §4.2，r5 §4 实走改判）：
 * 驳回 = {action:"revision", side:"plan", feedback, clientMessageId} →
 * server 入队重规划步（同 conv continue session）→ plan v2；
 * 确认 = 同端点 {action:"confirm"}；
 * 失败面发送 = 同端点 {action:"restart", feedback, clientMessageId}（#320，
 * r9 §3.3 实测：原站 failed 态发消息触发新一轮，消息随新轮入会话；实走
 * steps 端点 body 未录——action 词与形 [设计]，语义 = 带反馈重启）。 */
export const buildStepActionBodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('revision'),
    /** 观测值仅 "plan"（r5 §4 抓包）；side 词表未采齐，不收窄以外值。 */
    side: z.literal('plan'),
    feedback: z.string(),
    clientMessageId: z.string(), // <uuid>（r5 §4 抓包）
  }),
  z.object({ action: z.literal('confirm') }),
  z.object({
    action: z.literal('restart'),
    /** 空消息不成发送（原站语义「发消息触发」）：直连 API 也收不住空稿。 */
    feedback: z.string().min(1),
    clientMessageId: z.string(), // <uuid>（revision 同形，r5 §4；server 侧现未消费）
  }),
]);
export type BuildStepActionBody = z.infer<typeof buildStepActionBodySchema>;
