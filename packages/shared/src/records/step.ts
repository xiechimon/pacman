// step record——02 §4.2（A6 锁定）：step 队列 server 持有、机器 claim 三类步
// （规划步/执行步/合并步，r3 §1.5 观测）。wire kind 词与记录字段未采集，
// 以下为 [推断] 投影（弱证：assignment 双槽 plan/build、steps body side:"plan"、
// 合并步语义），实现期重放补采后回写 02 §11 收紧（04 §3 不判负口径）。

import { z } from 'zod';
import { epochMs, recordId } from './common.js';

/** 三类步（02 §4.2 中文语义名的 wire 投影 [推断]）+ `chief`（M4a [设计]：
 * Chief 回合 = 机器 step 为一手实测（r5 §3.1 daemon.log `claim step=…` →
 * `conv chief-…`），kind 词未采——自定等价物，04 §3 不判负口径）+ `review`
 * （M7 #312 / r8 §3.1：AI 审核步——额外 agent 步，daemon 不开 worktree 不产
 * 改动，emit findings；#326 占位 ack → 真 findings 演进而 kind 词不变）。 */
export const stepKindSchema = z.enum(['plan', 'build', 'merge', 'chief', 'review']);
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

/** journal 状态词（02 §5.4 [内部] 展开：claimed = 机器领取未收尾；
 * stopped = 用户停止钮中断（M7 #308，r9 §3.3 运行行「已取消」数据源——
 * machineDoneBody status 词表原含 stopped，此为 db/读面对位补齐）。 */
export const stepStatusSchema = z.enum(['pending', 'claimed', 'done', 'failed', 'stopped']);
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
 * 确认 = 同端点 {action:"confirm"}。
 * 审核 = {action:"review", agentId, focus?}（M7 #312 / r8 §3.1）：server 入队
 * 审核步（kind='review'）→ 审核中 chip + composer placeholder + 时间线发起
 * 行（REVIEW_ANNOUNCEMENT）；focus 可空（textarea 透传「关注什么」）。 */
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
    action: z.literal('review'),
    /** 执行审核的 Agent id（与 chief-agent-dialog 同源 memberType:"agent" 行
     * 的 actorId）。 */
    agentId: z.string(),
    /** 可选关注点 textarea 内容；空串视为未填。 */
    focus: z.string().optional(),
  }),
]);
export type BuildStepActionBody = z.infer<typeof buildStepActionBodySchema>;
