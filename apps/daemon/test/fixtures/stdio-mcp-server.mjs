// 测试用 stdio MCP server（mcp-bridge.test 的 stdio transport 对拍端）。
// 工具面 = echo（text 参数原样回显）+ ping（无参恒定）。

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'stdio-fixture', version: '0.0.1' });
server.registerTool(
  'echo',
  { description: 'Echo the text back.', inputSchema: { text: z.string() } },
  async ({ text }) => ({ content: [{ type: 'text', text: `echo:${text}` }] }),
);
server.registerTool('ping', { description: 'Ping.' }, async () => ({
  content: [{ type: 'text', text: 'pong' }],
}));
// spec 13（#368）：stdio env 透传对拍位——config 的 env 值必须到达子进程
// （MCP 本机凭证面：值只活在执行机，从不跨 wire）。
server.registerTool('envprobe', { description: 'Echo MCP_PROBE env var.' }, async () => ({
  content: [{ type: 'text', text: `env:${process.env.MCP_PROBE ?? ''}` }],
}));
await server.connect(new StdioServerTransport());
