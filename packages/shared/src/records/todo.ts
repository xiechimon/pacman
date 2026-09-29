// todo record——02 §4.1/§6.2 canonical：字段其余形状照抄 r3 §3.0
// （phaseAt/seqNum/orderIndex/tagIds/spec/assignment/agent/latestBuildId/
// lastRunAt/hasChanges/hasPlan/buildHistory/sourceTodo/v）；r5 §3.2 SSE todo
// 全文档补录溯源三字段（createdBy/ownerId/sourceBuildId）。

import { z } from 'zod';
import { epochMs, phaseSchema, recordId } from './common.js';

/** 指派槽（02 §6.2：todo.assignment 双槽 `{plan:{agentId}, build:{agentId}}`，
 * r5 §3.4/§5 实测）。槽空 = 未指派（开始 dialog Agent 可空，r3 §3.2）——
 * 槽级 null 形状 [推断]（抓包样本两槽均有值）。 */
export const assignmentSlotSchema = z.object({ agentId: recordId });
export const assignmentSchema = z.object({
  plan: assignmentSlotSchema.nullable(),
  build: assignmentSlotSchema.nullable(),
});
export type Assignment = z.infer<typeof assignmentSchema>;

/** todo 内嵌 agent 引用（r3 §3.0 `agent` 字段；字段子集 [推断]——
 * 完整 agent record 见 records/agent.ts）。 */
export const todoAgentRefSchema = z.object({
  id: recordId,
  displayName: z.string(),
});

/** 运行历史条目（r3 §3.8：`第 1 次运行 · 当前 · 43 分钟前 · 86.6k tokens`）。
 * wire 条目形状未展开采集，最小投影 {buildId, createdAt} [推断]。 */
export const buildHistoryEntrySchema = z.object({
  buildId: recordId, // buildId ≡ conversationId（CONTEXT.md/r3 §3.0）
  createdAt: epochMs,
});

/** 任务（todo record）来源种类值域（#446 / ADR 0005 D6）：任务可绑定至多
 * 一个外部出处，当前只有 github-issue 一种；出现第二种来源（PR / CI 失败 /
 * 外部工单）时重审形状（ADR 0005 重开触发条款）。常量取 TASK_ 前缀而非表
 * 名前缀：pre-commit 注释纪律黑名单按大写词面匹配，表名全大写形会误伤。 */
export const TASK_SOURCE_KINDS = ['github-issue'] as const;
export const todoSourceKindSchema = z.enum(TASK_SOURCE_KINDS);
export type TodoSourceKind = z.infer<typeof todoSourceKindSchema>;

/** 外部引用格式单源（#446：`github:owner/repo#123`）。写入面（server
 * import 服务）与断言面（测试）同吃，防格式串两处漂移。 */
export function githubIssueSourceRef(owner: string, repo: string, issueNumber: number): string {
  return `github:${owner}/${repo}#${issueNumber}`;
}

export const todoRecordSchema = z.object({
  id: recordId,
  teamId: recordId,
  projectId: recordId,
  title: z.string(),
  /** 结构化描述（r3 §3.1 创建表单四行占位；chief 措辞→spec 三段式见 02 §4.3）。 */
  spec: z.string(),
  phase: phaseSchema,
  phaseAt: epochMs,
  /** 看板序号 `#seqNum`（CONTEXT.md：todo 持久且带序号）。 */
  seqNum: z.number().int(),
  /** 列内排序位（01 §4.1 拖拽面：@dnd-kit 列内 orderIndex 排序）。 */
  orderIndex: z.number(),
  tagIds: z.array(recordId),
  assignment: assignmentSchema.nullable(),
  agent: todoAgentRefSchema.nullable(),
  latestBuildId: recordId.nullable(),
  lastRunAt: epochMs.nullable(),
  hasChanges: z.boolean(),
  hasPlan: z.boolean(),
  buildHistory: z.array(buildHistoryEntrySchema),
  /** 来源任务引用；语义未特写 [推断]（r3 §3.0 字段表列名照抄）。 */
  sourceTodo: recordId.nullable(),
  /** 记录版本号（r3 §3.0 观测值 2–4；SSE 文档事件带 seq/v，02 §1.2/r5 §7.2）。 */
  v: z.number().int(),
  // —— r5 §3.2 SSE todo doc 补录（chief 派工溯源）——
  /** 创建者 = 用户或 Chief 绑定 Agent id；人工建时的取值未分离观测 [推断]。 */
  createdBy: recordId.nullable(),
  ownerId: recordId.nullable(),
  /** 来源 build（chief 回合 id，形如 `chief-…`）；人工建时 null [推断]。 */
  sourceBuildId: z.string().nullable(),
  // —— #446 来源两列（ADR 0005 D6，溯源家族位）——
  /** 来源种类；人工建 / chief 派工 = null（至多一个来源，两列够用）。 */
  sourceKind: todoSourceKindSchema.nullable(),
  /** 外部引用（形如 `github:owner/repo#123`，githubIssueSourceRef 单源）；
   * 无来源 = null。 */
  sourceRef: z.string().nullable(),
});
export type TodoRecord = z.infer<typeof todoRecordSchema>;

/** POST /api/projects/{id}/todos body（r3 §3.1 抓包原样 {title, spec}；
 *  tagIds 携带位 = r9 §3.4 实测（观测样本空数组），#309 补录。optional =
 *  旧客户端/chief 派工路径不带位仍合法。 */
export const createTodoBodySchema = z.object({
  title: z.string(),
  spec: z.string(),
  tagIds: z.array(recordId).optional(),
});
export type CreateTodoBody = z.infer<typeof createTodoBodySchema>;
