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

/** 合并宣告行 content canon（r3 §3.6 实测 `15:06 Xmon Dai 发起了合并` 的
 * 内容段；行形 [设计] = role user 纯文本，呈现层拼装时间/actor）。写入端
 * （server requestMerge）与呈现端（web transcript mapper）双端单源。 */
export const MERGE_ANNOUNCEMENT = '发起了合并';

/** AI 审核发起行 content canon（M7 #312 / r8 §3.1 实测 `23:42 Xmon Dai 发起了
 * AI 审核` 的内容段；行形 = role user 纯文本，呈现层拼装时间/actor）。写入端
 * （server applyBuildStepAction review 分支）与呈现端（web transcript mapper）
 * 双端单源。 */
export const REVIEW_ANNOUNCEMENT = '发起了 AI 审核';

/** AI 审核步完成占位 ack（M7 #312 票 A 占位 emit；#326 真 findings 上线后此
 * 常量保留作 step journal 行 / 测试 fixture 字面，不作真 wire emit 用）。 */
export const REVIEW_COMPLETE_PLACEHOLDER = 'AI 审核已完成';
/** AI 审核步收尾 verdict 消息 content kind（M7 #330，r8 §3.1 真 findings 上
 * 线）：system 角色 + content = `{"kind":"review_verdict","verdict":…}` JSON
 * 串（与 machine_selected 同族，server `applyBuildStepAction` 完成时 emit）。
 * verdict 形状 = records/review.ts reviewVerdictSchema（含 conclusion + 编号
 * findings，blocking 项触发自动修订回路）。 */
export const REVIEW_VERDICT_KIND = 'review_verdict';

/** chief 回合失败行 content kind（#631 [设计]）：daemon chief 步失败上报的
 * errorMessage 由 server `finishStep` chief 分支落 chief_message system 行
 * （machine_selected 同族形态——content 为 JSON 串），此前该原因被整个丢弃、
 * 线程零失败痕迹。写入端（services/machines.ts）与呈现端（web mappers /
 * chief drawer + toast）双端单源；`message` = 失败原因原文（daemon
 * errorMessage，透传不加工）。 */
export const CHIEF_TURN_ERROR_KIND = 'chief_turn_error';
export const chiefTurnErrorContentSchema = z.object({
  kind: z.literal(CHIEF_TURN_ERROR_KIND),
  message: z.string(),
});
export type ChiefTurnErrorContent = z.infer<typeof chiefTurnErrorContentSchema>;

/** 跨机续跑降级标记 canon（#862 T1）：daemon 会话续接失败
 *（SessionNotResumable，典型 = 他机认领释放步、原会话文件不在本机）回退新
 * 会话时插 transcript system 行。写入端（daemon runner 回退面）与呈现端（web
 * transcript mapper 纯文本 system→note 路）双端单源；content 恒纯文本无花括
 * 号（花括号会被呈现端当 machine_selected 同族跳过）。 */
export const RESUME_FRESH_SESSION_NOTE = '原会话不可复用，已用新会话重跑（上下文可能不完整）';

/** transcript 续跑注记行 id（daemon 写侧单源；deterministic per step，重传
 * 覆盖不叠行——transcriptPromptRowId 同律）。 */
export function transcriptResumeNoteRowId(stepId: string): string {
  return `resume-note-${stepId}`;
}

/** #931 返工回原分支——复用轮边界 note（server restart 复用旧 build 时落旧
 * conv 的 system 行；RESUME_FRESH_SESSION_NOTE 同族：纯文本、无花括号——花括
 * 号会被呈现端当 machine_selected 同族 JSON 跳过）。文本单源：server 写侧
 * （builds.ts restart 复用分支）与测试断言消费同一份。prNumber 在位点名 PR
 * （原 PR 就地更新的事实），failureReason 承接被清空的 build.errorMessage
 * 原文（失败原因不随轮界蒸发）。 */
export function buildReworkReuseNote(input: {
  prNumber: number | null;
  prUrl: string | null;
  failureReason: string | null;
}): string {
  const pr = input.prNumber !== null ? `，更新原 PR #${input.prNumber}` : '';
  const reason = input.failureReason !== null ? `上一轮失败原因：${input.failureReason}。` : '';
  return `返工回到本分支继续${pr}。${reason}`;
}

/** #931 返工另起新分支 note（原 PR 已合并/已关闭时 restart 新建 build，落新
 * conv 的 system 行）：判定显式且可见——票面失败方式 3 /验收 4，用户能看出
 * 「为什么这次是新 PR」。branch = 新 conversationId 的分支名
 * （conversationBranch 单源同式）。 */
export function buildReworkNewBranchNote(input: {
  prNumber: number | null;
  prUrl: string | null;
  branch: string;
  outcome: 'merged' | 'closed';
}): string {
  const pr = input.prNumber !== null ? `#${input.prNumber}` : (input.prUrl ?? '');
  const tail =
    input.outcome === 'merged' ? '已合并，返工在新分支上重启' : '已关闭，返工在新分支上重启';
  return `原 PR ${pr} ${tail}（${input.branch}）。`;
}

/** GET /api/conversations/{id}/messages 响应封套（r5 §3.6 原样）。 */
export const conversationMessagesResponseSchema = z.object({
  messages: z.array(transcriptRowSchema),
  /** chips/steerPending/nextCursor 细形未逐一采集 [推断]（steerPending[] 为
   * 数组形观测；steer 语义 = 回合中补充说明即送，r5 §3.6）。W3 #278 起
   * build 会话分支透出单槽 pending 内容（[pending.content]）。 */
  chips: z.unknown(),
  historyEpoch: z.number().int(),
  steerPending: z.array(z.unknown()),
  activeRun: activeRunSchema,
  nextCursor: z.unknown(),
});
export type ConversationMessagesResponse = z.infer<typeof conversationMessagesResponseSchema>;

/** 取消落账标记 canon（M7 #308，r9 §3.3 运行行「已取消」）：stop 落账写
 * build.errorMessage 槽——运行历史面（meta 拼接 + failed 样式，fixtures
 * `Cancelled` 行同形）与详情 fail 行（phase-failed 门控，取消回落不触发）
 * 双端消费同源。写入端 = server applyStoppedStep；呈现端 = web mappers。 */
export const STOP_MESSAGE = '已取消';

/** POST /api/conversations/{id}/messages 的 build 会话分支 body（W3 steer，
 * 06 册 D9 / spec #277；[设计] 自设——承 chiefSendMessageBodySchema 的
 * content 位，无 threadId（目标会话在路径位））：steer = 向运行中的步补话
 * （claimed 步门 + 单槽 pending + machine 拉取-确认投递）。 */
export const buildSteerBodySchema = z.object({
  content: z.string().min(1),
});
export type BuildSteerBody = z.infer<typeof buildSteerBodySchema>;

/** POST /api/builds/{id}/stop body（M7 #308 停止钮，r9 §3.3）：discard =
 * 确认弹层「丢弃本轮修改——方案和代码回到上一个版本」勾选位（默认 true）——
 * true 时 daemon 侧 rewind worktree 到步起点 checkpoint。[设计] 端点形自设
 * （原站 stop wire 未采，r9 §5）；路径从 builds 族（merge/steps 同族）。 */
export const buildStopBodySchema = z.object({
  discard: z.boolean(),
});
export type BuildStopBody = z.infer<typeof buildStopBodySchema>;
