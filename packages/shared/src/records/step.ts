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

/** POST /api/builds/{id}/steps body——确认回路（02 §4.2，r5 §4 实走改判）：
 * 驳回 = {action:"revision", side:"plan", feedback, clientMessageId} →
 * server 入队重规划步（同 conv continue session）→ plan v2；
 * 确认 = 同端点 {action:"confirm"}。 */
export const buildStepActionBodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('revision'),
    /** 观测值仅 "plan"（r5 §4 抓包）；side 词表未采齐，不收窄以外值。 */
    side: z.literal('plan'),
    feedback: z.string(),
    clientMessageId: z.string(), // <uuid>（r5 §4 抓包）
  }),
  z.object({ action: z.literal('confirm') }),
]);
export type BuildStepActionBody = z.infer<typeof buildStepActionBodySchema>;
