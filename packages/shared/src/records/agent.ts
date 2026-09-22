// agent record——02 §6.2（r3 §4 实测原样）。
// Agent = 配了模型、职责、技能、工具、密钥、MCP 与记忆的执行角色（CONTEXT.md）；
// Agent ≠ Machine（一个是角色，一个是承载主机）。
// 端点补录（r5 §1/§8）：列表实际走 GET teams/{id}/members（memberType:"agent"
// 行内嵌 actor 全记录）；创建 POST teams/{id}/agents → 201 {id}；
// GET teams/{id}/agents 为 405。

import { z } from 'zod';
import { BRAND } from '../brand.js';
import { recordId } from './common.js';
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

/** 6 开关说明文案（r3 §4 原文，权限 tab parity 用；品牌串经 brand.ts 槽，
 * 版本门常量见 records/secret.ts）。 */
export const AGENT_PERMISSION_COPY = {
  remoteShell: '允许该 Agent 在团队中已开启 shell 访问的机器上执行命令。',
  secrets: `任务执行时将团队密钥以环境变量注入该 Agent 的 shell。所在机器需要 ${BRAND.cliCommandName} CLI ${SECRET_MIN_CLI_VERSION} 及以上。`,
  mcpServers:
    '该 Agent 执行任务时可使用的团队 MCP 服务器，其工具以 mcp__<服务器>__<工具> 的形式出现。',
  responsibility:
    '用一两句话说明该 Agent 的职责。该说明会注入它执行的每个任务，也会提供给总管用于分派。',
  defaultSkill: '该 Agent 执行任何任务时自动携带的团队技能，无需在消息中 @ 引用。',
} as const;

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
