// mcp-server record——02 §6.2（r3 §5.1 实测原样）。
// 方向：外部 → Agent（CONTEXT.md：mcpServer 唯一方向是团队接入外部工具）。
// 授权 = per-Agent mcpServers[] 勾选（02 §7.1，B14 闭合）。

import { z } from 'zod';
import { epochMs, recordId } from './common.js';

/** 两 transport（02 §6.2/§7.1：远程 HTTP / 本地 stdio）。 */
export const mcpTransportSchema = z.enum(['http', 'stdio']);
export type McpTransport = z.infer<typeof mcpTransportSchema>;

export const mcpServerRecordSchema = z.object({
  teamId: recordId,
  label: z.string(),
  /** 小写标识符，创建后不可改，工具名前缀（r3 §5.1 文案 canon；wire 正则
   * 未观测不收窄 [推断]）。 */
  slug: z.string(),
  transport: mcpTransportSchema,
  /** http transport 连接 URL（r3 §5.1 观测样本即 http）。stdio 记录的
   * 命令/参数字段未在 record 抓取中出现（表单字段见 r2 §6.2：命令+参数），
   * wire 形状归 M2 实现期补采 [推断]。 */
  url: z.string(),
  hasCredential: z.boolean(),
  credentialKeys: z.array(z.string()),
  createdBy: recordId,
  id: recordId,
  createdAt: epochMs,
  updatedAt: epochMs,
});
export type McpServerRecord = z.infer<typeof mcpServerRecordSchema>;

/** 工具名形状 `mcp__<slug>__<tool>`（r3 §5.1 实测；02 §7.1）。 */
export function mcpToolName(slug: string, tool: string): string {
  return `mcp__${slug}__${tool}`;
}

/** 标识符说明文案 canon（r3 §5.1 原文）。 */
export const MCP_SLUG_COPY =
  '小写字母标识符，将作为工具名前缀（mcp__<标识符>__<工具>），创建后不可修改。';
