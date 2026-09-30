// agent record——02 §6.2（r3 §4 实测原样）。
// Agent = 配了模型、职责、技能、工具、密钥、MCP 与记忆的执行角色（CONTEXT.md）；
// Agent ≠ Machine（一个是角色，一个是承载主机）。
// 端点补录（r5 §1/§8）：列表实际走 GET teams/{id}/members（memberType:"agent"
// 行内嵌 actor 全记录）；创建 POST teams/{id}/agents → 201 {id}；
// GET teams/{id}/agents 为 405。

import { z } from 'zod';
import { BRAND } from '../brand.js';
import { phaseSchema, recordId } from './common.js';
import { SECRET_MIN_CLI_VERSION } from './secret.js';

/** 观测值仅 "active"；其余状态未采到，词表不收窄外值 [推断]。 */
export const agentStatusSchema = z.enum(['active']);

/** 权限面工具 6 开关 UI 词（r3 §4 全 list，文案 canon）；wire 值未观测
 * （样本 tools:[] 恒空）[推断]——tools[] 不收窄为枚举。 */
export const AGENT_TOOL_SWITCHES = [
  '远程 shell',
  '合并分支',
  '创建标签',
  '推送分支',
  '创建技能',
  '更新技能',
] as const;

/** 权限面 6 开关各自的说明副文案（键 = AGENT_TOOL_SWITCHES 的同值域词）。
 * 文案原文实测自参考产品 Agent 详情页权限 tab（2026-09-30，#485）——r3 §4
 * 的清单只记了「远程 shell」一档，其余五档是本次直读原版补上的，不是推断。 */
export const AGENT_TOOL_COPY: Record<(typeof AGENT_TOOL_SWITCHES)[number], string> = {
  '远程 shell': '允许该 Agent 在团队中已开启 shell 访问的机器上执行命令。',
  合并分支: '允许该 Agent 通过合并分支进行发布（例如将 develop 合并进 main）。',
  创建标签: '允许该 Agent 创建 git tag，这可能触发发布流程。',
  推送分支: '允许该 Agent 随时提交并推送其工作分支（自行合并发布改动时需要）。',
  创建技能: '允许该 Agent 向团队技能库添加新技能。',
  更新技能: '允许该 Agent 修改团队技能库中已有的技能。',
};

/** 权限面其余各档的说明文案（r3 §4 原文；品牌串经 brand.ts 槽，版本门常量
 * 见 records/secret.ts）。6 开关的副文案见 AGENT_TOOL_COPY。 */
export const AGENT_PERMISSION_COPY = {
  secrets: `任务执行时，该 Agent 可在需要密钥的执行步中按需取用团队密钥，每次取用都会留下记录；密钥不预置进 shell 环境。所在机器需要 ${BRAND.cliCommandName} CLI ${SECRET_MIN_CLI_VERSION} 及以上。`,
  mcpServers:
    '该 Agent 执行任务时可使用的团队 MCP 服务器，其工具以 mcp__<服务器>__<工具> 的形式出现。',
  responsibility:
    '用一两句话说明该 Agent 的职责。该说明会注入它执行的每个任务，也会提供给总管用于分派。',
  defaultSkill: '该 Agent 执行任何任务时自动携带的团队技能，无需在消息中 @ 引用。',
} as const;

/** 兜底模型槽（XMON-44 / XMON-32 终稿第三节；leader 裁决 daemon 侧步内
 * 换模型重试，server 持配置真值）。provider null = 沿用 agent.provider
 * （preset 直投同形）；有序数组，空 = 现行为（无兜底）。 */
export const fallbackModelSchema = z.object({
  provider: z.string().nullable(),
  modelId: z.string().min(1),
});
export type FallbackModel = z.infer<typeof fallbackModelSchema>;

/** 写面去重（XMON-32 终稿「fallback 条目不得与主模型重复，server create/patch
 * 时剥离」）：null 槽先解析到主 provider 再比对；主 modelId 未配 → 无可重复，
 * 原样返回。纯函数单源——server create/patch 共用，行上不变式
 * 「fallbackModels 不含主模型」由此成立（claim/token 组装无需复查）。 */
export function stripFallbackModelDupes(
  fallbackModels: FallbackModel[],
  provider: string | null,
  modelId: string | null,
): FallbackModel[] {
  if (modelId === null) return fallbackModels;
  return fallbackModels.filter(
    (f) => (f.provider ?? provider) !== provider || f.modelId !== modelId,
  );
}

export const agentRecordSchema = z.object({
  id: recordId,
  displayName: z.string(),
  /** 职责；未设置时 UI 显「未设置职责」（r3 §4），null 形状 [推断]。 */
  description: z.string().nullable(),
  status: agentStatusSchema,
  avatarUrl: z.string().nullable(),
  /** provider id（r3 §4 样本 provider:"r3-gw" = BYOK 自定义服务商）。 */
  provider: z.string().nullable(),
  modelId: z.string().nullable(),
  /** 思考强度（r3 样本 null = UI「默认」；wire 值词表未采 [推断]）。 */
  thinkingLevel: z.string().nullable(),
  /** 兜底模型有序列表（XMON-44）：默认 [] = 现行为（写面已剥离主模型重复项，
   * 读面对旧行/未配置行恒给 []）。thinkingLevel 由兜底项继承 agent 现值。 */
  fallbackModels: z.array(fallbackModelSchema).default([]),
  /** 权限 6 开关的已开集 + 授予工具；wire 项形 [推断]。 */
  tools: z.array(z.string()),
  /** 团队密钥授权集（关联 secret id [推断]；值只写不读，02 §8）。 */
  secrets: z.array(z.string()),
  /** 默认携带/被授予技能（关联 skill id [推断]）。 */
  skills: z.array(z.string()),
  /** MCP 逐个勾选（关联 mcp_server id [推断]，02 §7.1）。 */
  mcpServers: z.array(z.string()),
});
export type AgentRecord = z.infer<typeof agentRecordSchema>;

/** POST /api/teams/{id}/agents body [推断]（r5 §1/§8 补录端点；字段 =
 * 上文 agentRecordSchema 配置面投影，创建弹窗 r3 §4：名称/职责/模型）。
 * fallbackModels（XMON-44）：optional 而非 default——zod v4 的 .partial() 会
 * 保留 default，带 default 的字段在 PATCH 空体上会解析成 []（「清空」语义
 * 混进「未动」位，无关字段的 PATCH 会误清兜底列表）；create 侧缺省 = 无
 * 兜底，由 server 写面落 []（空 = 现行为）。 */
export const createAgentBodySchema = z.object({
  displayName: z.string().min(1),
  description: z.string().nullish(),
  provider: z.string().nullish(),
  modelId: z.string().nullish(),
  thinkingLevel: z.string().nullish(),
  fallbackModels: z.array(fallbackModelSchema).optional(),
  tools: z.array(z.string()).optional(),
  secrets: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  mcpServers: z.array(z.string()).optional(),
});
export type CreateAgentBody = z.infer<typeof createAgentBodySchema>;

/** Agent 详情概览「进行中」段的载荷行（`GET /api/teams/{id}/agents/{aid}/tasks`）。
 *
 * 形状来源 = 参考产品 web 包里的消费组件（Expo web，`/app/_expo/static/js/web/
 * entry-*.js`，2026-09-30 直读；该端点的响应体本身仍未采），逐字读出的渲染面：
 *   api(`/api/teams/${teamId}/agents/${agentId}/tasks`) → 整包直接进 state
 *   <SectionList label={t('agent_modal.in_progress')} count={rows.length}
 *                empty={t('agent_modal.no_active_tasks')}>
 *     rows.map(r => <TaskRow task={r} key={r.buildId} onOpen={() => open(r.todo.id)} />)
 *   TaskRow（`kind === 'build'` 支）：`#${todo.seqNum}` · `todo.title`（单行截断）
 *     · PhasePill(`state === 'waiting' ? 'queued' : todo.phase`) · 右箭头。
 *   同组件另一支是墓碑行（被删条目：`label` 删除线 + 「已删除」），本仓无生产者。
 *
 * 本 schema 只收消费面真正读到的字段（01 §6：观测不到的字段不收）。
 *
 * 列表语义 = 「该 Agent 名下正在跑的 build」，**不是**「指派给它的 todo」——
 * 实测反证：参考账号 3 条 `phase=review` 且 assignment 指向该 Agent 的 todo，
 * 该端点恒返回 `[]`（2026-09-30）。同包内 `groupProgress` 的 In progress 判据
 * 亦为 `queued || BUSY_PHASES`（见 shared IN_PROGRESS_PHASES）。
 */
export const agentTaskSchema = z.object({
  /** 行种类。观测到的字面量只有 'build'（墓碑行的字面量未采 [推断]）。 */
  kind: z.literal('build'),
  /** build 自身状态。'waiting' = 已建、尚无机器领取，消费面落 PhasePill 时
   *  映射为 `queued`。非等待态的 token 未采 [推断]——本仓发 null，消费面按
   *  `todo.phase` 渲染，渲染结果与原件同（跑起来的 build，其 todo.phase 本身
   *  就是 planning/building）。 */
  state: z.literal('waiting').nullable(),
  /** 行的 key（原件 `key={r.buildId}`）；= todo.latestBuildId。 */
  buildId: recordId,
  /** 行内被渲染的字段（含点击落点 id）。 */
  todo: z.object({
    id: recordId,
    seqNum: z.number().int(),
    title: z.string(),
    phase: phaseSchema,
  }),
});
export type AgentTask = z.infer<typeof agentTaskSchema>;

/** PATCH /api/teams/{id}/agents/{aid} body [推断]（REST 同名，02 §6.1 词表内；
 * 覆盖面 = 概览/权限 tab 编辑 + per-Agent mcpServers[] 授权勾选，02 §7.1）。 */
export const patchAgentBodySchema = createAgentBodySchema.partial().extend({
  displayName: z.string().min(1).optional(),
});
export type PatchAgentBody = z.infer<typeof patchAgentBodySchema>;
