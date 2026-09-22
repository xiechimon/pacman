// chief records（chief_thread + chief_message 投影）——02 §4.3（r5 §2/§3 实测）。
// Chief = 每「用户×团队」一个的调度与对话代理，特例 Agent 实例（记忆亦共用
// 绑定 Agent）；执行形态 = 机器 step（conv 名 `chief-<threadId>`，UUIDv7）+
// pi 会话（thread 记录 session.runtime:"pi"）。
// 复刻口径（02 §4.3 尾注）：Chief = 挂团队工具的 pi 会话，行为分毫不求同；
// 下表为平价参照而非逐条复刻清单。

import { z } from 'zod';
import { agentRecordSchema } from './agent.js';
import { epochMs, phaseSchema, recordId } from './common.js';

/** chief 实例 id 形 `chief-<userId>-<teamId>`（r5 §3.6/r2 §1.5 实测）。 */
export const chiefIdFormat = (userId: string, teamId: string) => `chief-${userId}-${teamId}`;

/** thread id 形 `chief-<uuid>`（UUIDv7，r5 §3.1/§3.6）；conversation 名同值。 */
export const CHIEF_THREAD_ID_PREFIX = 'chief-';

export const chiefRecordSchema = z.object({
  id: z.string(),
  userId: recordId,
  teamId: recordId,
  /** 绑定 Agent（走 PATCH teams/{id}/chief + 二次确认，记忆不迁移告示，
   * r5 §2）；未绑定 null。 */
  agent: z.object({ agentId: recordId }).nullable(),
  /** 章程 = 常设指示（r5 §2 章程 tab；空态「尚无章程。点击编辑，为总管添加
   * 常设指示。」）。 */
  charter: z.string().nullable(),
  lastTurnAt: epochMs.nullable(),
  createdAt: epochMs,
});
export type ChiefRecord = z.infer<typeof chiefRecordSchema>;

/** watch 条目（r5 §3.5 API 原样）：派工即自动 watch；settle 后自动解除。
 * gate 停驻/settle/failed 三类触发 wake 轮（02 §4.3）。 */
export const chiefWatchSchema = z.object({
  todoId: recordId,
  projectId: recordId,
  seqNum: z.number().int(),
  title: z.string(),
  projectName: z.string(),
  phase: phaseSchema,
  /** 派工 watch 的 reason canon（02 §4.3/r5 §3.5 原文）。 */
  reason: z.string(),
  createdAt: epochMs,
  threadId: recordId,
  threadTitle: z.string(),
});
export type ChiefWatch = z.infer<typeof chiefWatchSchema>;

/** 派工 watch reason 原文（r5 §3.5）。 */
export const CHIEF_WATCH_REASON_DISPATCH =
  'Dispatched by the chief: report back when it parks at a gate or settles.';

/** activeRun 部分观测（r5 §3.5：`{phase:"chief", tool:{toolName:"machines"}}`）；
 * 开放形状 [推断]，未采字段不收窄。 */
export const activeRunSchema = z
  .object({
    phase: z.string(),
    tool: z.object({ toolName: z.string() }).optional(),
  })
  .loose()
  .nullable();
export type ActiveRun = z.infer<typeof activeRunSchema>;

/** GET /api/teams/{id}/chief 响应封套（r5 §3.6 API 原样）。 */
export const chiefGetResponseSchema = z.object({
  chief: chiefRecordSchema,
  /** 绑定 Agent 全记录（records/agent.ts 形状）；未绑定 null。 */
  agentActor: agentRecordSchema.nullable(),
  /** context.tokens 随回合增长（r5 §3.6 两次 API 实测 27065→29866）。 */
  context: z
    .object({
      tokens: z.number().int(),
      contextWindow: z.number().int(),
    })
    .nullable(),
  watches: z.array(chiefWatchSchema),
  /** wakes[] 非空形态未实测（r5 §10：set_wake 实走遗留）[推断]，开放条目。 */
  wakes: z.array(z.record(z.string(), z.unknown())),
});
export type ChiefGetResponse = z.infer<typeof chiefGetResponseSchema>;

/** GET /api/teams/{id}/chief/threads 条目（r5 §3.6 API 原样）。
 * runtime="pi" 坐实 Chief 会话跑在 pi 引擎。 */
export const chiefThreadSchema = z.object({
  id: z.string(), // chief-<uuid>
  chiefId: recordId,
  userId: recordId,
  teamId: recordId,
  /** 首句截断 + …（r5 §3.6）。 */
  title: z.string(),
  createdAt: epochMs,
  updatedAt: epochMs,
  lastTurnAt: epochMs.nullable(),
  session: z.object({
    runtime: z.literal('pi'),
    id: z.string(),
    openedAt: epochMs,
  }),
  pendingSessionResumeAt: epochMs.nullable(),
  /** 工具定义/结果哈希表（49 词表的哈希键面，r5 §3.1；词表本体归 M4）。 */
  toolDefHashes: z.record(z.string(), z.string()),
  toolResultHashes: z.record(z.string(), z.string()),
  activeRun: activeRunSchema,
});
export type ChiefThread = z.infer<typeof chiefThreadSchema>;

/** 内联实体引用 URI 前缀（r5 §3.6 实测：assistant 正文 `[名](agent:<id>)` /
 * `[#n](todo:<id>)`，自定义 URI markdown；消息形状见 records/message.ts）。 */
export const CHIEF_ENTITY_REF_SCHEMES = ['agent', 'todo'] as const;

/** PATCH /api/teams/{id}/chief body（r5 §2 抓包原样）。 */
export const patchChiefBodySchema = z.object({
  agent: z.object({
    agentId: recordId,
    thinkingLevel: z.string().nullable(),
  }),
});
export type PatchChiefBody = z.infer<typeof patchChiefBodySchema>;

/** 换绑二次确认告示 canon（r5 §2 原文，记忆不迁移）。 */
export const CHIEF_REBIND_CONFIRM_COPY =
  '更换总管的 agent？总管的记忆保存在其运行所用的 Agent 上。切换至 <agent> 后，记忆将变为 <agent> 的记忆，当前记忆不会迁移。';

/** 设置面板 4 tab（r5 §2：面板内视图切换，非 dialog）。 */
export const CHIEF_SETTINGS_TABS = ['Agent', '章程', '记忆', '关注与提醒'] as const;

/** 关注与提醒空态 canon（02 §4.3/r5 §2 原文）。 */
export const CHIEF_WATCHES_EMPTY_COPY =
  '暂无跟进事项。总管关注某个任务，或约定到点回头核实时，会按主题列在这里。';

/** 输入框占位 canon（r5 §3.6：空闲 `有什么可以帮你的？`；回合中 steer 语义）。 */
export const CHIEF_INPUT_PLACEHOLDER = '有什么可以帮你的？';
export const CHIEF_INPUT_PLACEHOLDER_STEERING = '向 Agent 补充说明，执行过程中即可送达';
