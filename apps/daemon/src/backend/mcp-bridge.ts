// MCP client 面薄桥（00/D4 自建薄桥、01 §4.3「桥归 daemon：回合在 daemon 内跑」；
// 02 §7.1 运行时契约）：每回合连接已授权 server → listTools 映射为 pi 工具
// `mcp__<slug>__<tool>`（r3 §5.1 实测名形）→ callTool 转发；连接失败**降级
// 不阻断**（canon 行 `[mcp] <slug>: connect failed — its tools are unavailable
// this turn: <reason>`，r3 §1.5 daemon.log 实测）。
// 缝纪律：本模块 = daemon 侧唯一 sdk 消费位（backend/**，biome override）；
// 两 transport（http 远程 / stdio 本地命令，02 §7.1 添加表单两形态）。

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { McpEndpoint } from '@pacman/shared';
import { BRAND, MCP_CONNECT_FAILED_CANON, mcpToolName } from '@pacman/shared';
import { DAEMON_VERSION } from '../version.js';

/** 桥接产出的 pi 工具面（backend/pi.ts defineTool 消费）。 */
export interface BridgedMcpTool {
  /** `mcp__<slug>__<tool>`（r3 §5.1 实测名形）。 */
  name: string;
  description: string;
  /** 远端 inputSchema（JSON Schema 原样透传，pi customTools 接受原始 schema —
   * M4a/#81 relay 往返已坐实同族机制）。 */
  inputSchema: unknown;
  /** callTool 转发 → 结果文本（text 部件拼接；非文本部件 JSON 串 [设计]）。 */
  call(params: Record<string, unknown>): Promise<string>;
}

export interface McpBridge {
  tools: BridgedMcpTool[];
  /** 回合收尾释放（http 断流 / stdio 杀子进程）。 */
  close(): Promise<void>;
}

export interface McpBridgeOpts {
  /** canon 行出口（runner 接 logger.mcp；缺省 = 静默）。 */
  onConnectFailed?: (slug: string, reason: string) => void;
  /** 单端点连接/list 预算 [设计]（与 remoteTool 10s 超时同族量级，r5 §3.1）。 */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

async function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function contentToText(content: unknown): string {
  if (!Array.isArray(content)) return JSON.stringify(content ?? null);
  const parts: string[] = [];
  for (const item of content) {
    const part = item as { type?: string; text?: string };
    if (part?.type === 'text' && typeof part.text === 'string') parts.push(part.text);
    else parts.push(JSON.stringify(item));
  }
  return parts.join('\n');
}

async function connectOne(
  endpoint: McpEndpoint,
  timeoutMs: number,
): Promise<{ client: Client; tools: BridgedMcpTool[] }> {
  const client = new Client({ name: BRAND.cliCommandName, version: DAEMON_VERSION });
  const transport =
    endpoint.transport === 'stdio'
      ? new StdioClientTransport({
          command: endpoint.command ?? '',
          args: endpoint.args ?? [],
          stderr: 'pipe',
        })
      : new StreamableHTTPClientTransport(new URL(endpoint.url ?? ''), {
          requestInit: endpoint.headers ? { headers: endpoint.headers } : undefined,
        });
  await withTimeout(client.connect(transport), timeoutMs, `mcp ${endpoint.slug} connect`);
  const listed = await withTimeout(client.listTools(), timeoutMs, `mcp ${endpoint.slug} listTools`);
  const tools: BridgedMcpTool[] = (listed.tools ?? []).map((t) => ({
    name: mcpToolName(endpoint.slug, t.name),
    description: t.description ?? t.name,
    inputSchema: t.inputSchema,
    call: async (params) => {
      const res = await withTimeout(
        client.callTool({ name: t.name, arguments: params }),
        timeoutMs,
        `mcp ${endpoint.slug} callTool ${t.name}`,
      );
      const result = res as { content?: unknown; isError?: boolean; structuredContent?: unknown };
      const text =
        result.structuredContent !== undefined
          ? JSON.stringify(result.structuredContent)
          : contentToText(result.content);
      return result.isError ? `error: ${text}` : text;
    },
  }));
  return { client, tools };
}

/** per-turn 连接（02 §7.1）：逐端点独立成败——单点失败降级不阻断，其余照常。 */
export async function connectMcpBridge(
  endpoints: readonly McpEndpoint[],
  opts: McpBridgeOpts = {},
): Promise<McpBridge> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const tools: BridgedMcpTool[] = [];
  const clients: Client[] = [];
  for (const endpoint of endpoints) {
    try {
      const one = await connectOne(endpoint, timeoutMs);
      clients.push(one.client);
      tools.push(...one.tools);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      opts.onConnectFailed?.(endpoint.slug, reason);
    }
  }
  return {
    tools,
    async close(): Promise<void> {
      await Promise.all(
        clients.map((c) => c.close().catch(() => {})), // 收尾清理不抛（回合已完）
      );
    },
  };
}

/** canon 降级行文本（r3 §1.5 实测行形 `[mcp] <slug>: connect failed — its
 * tools are unavailable this turn: <reason>`；前缀由 logger.mcp 落）。 */
export function connectFailedLine(slug: string, reason: string): string {
  return `${slug}: ${MCP_CONNECT_FAILED_CANON}: ${reason}`;
}
