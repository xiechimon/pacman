// MCP 薄桥单测（00/D4、02 §7.1）：per-turn 连接、工具名 `mcp__<slug>__<tool>`、
// 连接失败降级不阻断（canon 行 r3 §1.5）、两 transport（http/stdio）。
// 对拍端 = sdk McpServer（测试内起真 server；缝纪律豁免 = biome override，
// 桥的生产消费位仍唯一 backend/mcp-bridge.ts）。

import { createServer, type Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { McpEndpoint } from '@pacman/shared';
import { MCP_CONNECT_FAILED_CANON } from '@pacman/shared';
import { afterAll, describe, expect, test } from 'vitest';
import { z } from 'zod';
import { connectFailedLine, connectMcpBridge } from '../src/backend/mcp-bridge.js';

const STDIO_FIXTURE = fileURLToPath(new URL('./fixtures/stdio-mcp-server.mjs', import.meta.url));

/** stateless streamable HTTP 测试端（每请求独立 server+transport）。 */
async function startHttpMcpServer(): Promise<{ url: string; close(): Promise<void> }> {
  const http: Server = createServer((req, res) => {
    void (async () => {
      const server = new McpServer({ name: 'test-http', version: '0.0.1' });
      server.registerTool(
        'echo',
        { description: 'Echo text back.', inputSchema: { text: z.string() } },
        async ({ text }) => ({ content: [{ type: 'text', text: `echo:${text}` }] }),
      );
      server.registerTool('ping', { description: 'Ping.' }, async () => ({
        content: [{ type: 'text', text: 'pong' }],
      }));
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      await server.connect(transport);
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const body =
        chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
      res.on('close', () => {
        void transport.close();
        void server.close();
      });
      await transport.handleRequest(req, res, body);
    })();
  });
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
  const addr = http.address();
  if (!addr || typeof addr === 'string') throw new Error('no address');
  return {
    url: `http://127.0.0.1:${addr.port}/mcp`,
    close: () =>
      new Promise<void>((resolve) => {
        http.closeAllConnections();
        http.close(() => resolve());
      }),
  };
}

const servers: { close(): Promise<void> }[] = [];
afterAll(async () => {
  for (const s of servers) await s.close();
});

describe('connectMcpBridge — http transport（02 §7.1 远程形态）', () => {
  test('连接 + listTools → mcp__<slug>__<tool>；callTool 转发回文本', async () => {
    const http = await startHttpMcpServer();
    servers.push(http);
    const bridge = await connectMcpBridge([{ slug: 'r3mcp', transport: 'http', url: http.url }]);
    expect(bridge.tools.map((t) => t.name).sort()).toEqual([
      'mcp__r3mcp__echo',
      'mcp__r3mcp__ping',
    ]);
    const echo = bridge.tools.find((t) => t.name === 'mcp__r3mcp__echo');
    expect(echo?.description).toBe('Echo text back.');
    expect(await echo?.call({ text: 'hi' })).toBe('echo:hi');
    const ping = bridge.tools.find((t) => t.name === 'mcp__r3mcp__ping');
    expect(await ping?.call({})).toBe('pong');
    await bridge.close();
  });

  test('headers 透传（Authorization 等请求头键值对，r3 §5.1 表单面）', async () => {
    const seen: string[] = [];
    const http: Server = createServer((req, res) => {
      seen.push(req.headers.authorization ?? '');
      void (async () => {
        const server = new McpServer({ name: 'auth-test', version: '0.0.1' });
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        });
        await server.connect(transport);
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const body =
          chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
        res.on('close', () => {
          void transport.close();
          void server.close();
        });
        await transport.handleRequest(req, res, body);
      })();
    });
    await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
    const addr = http.address();
    if (!addr || typeof addr === 'string') throw new Error('no address');
    servers.push({
      close: () =>
        new Promise<void>((resolve) => {
          http.closeAllConnections();
          http.close(() => resolve());
        }),
    });
    const bridge = await connectMcpBridge([
      {
        slug: 'authed',
        transport: 'http',
        url: `http://127.0.0.1:${addr.port}/mcp`,
        headers: { Authorization: 'Bearer secret-header' },
      },
    ]);
    expect(seen.some((h) => h === 'Bearer secret-header')).toBe(true);
    await bridge.close();
  });

  test('连接失败 = 降级不阻断：canon 行 + 空工具面，不抛（r3 §1.5）', async () => {
    const failures: [string, string][] = [];
    const bridge = await connectMcpBridge(
      [{ slug: 'dead', transport: 'http', url: 'http://127.0.0.1:1/mcp' }],
      { onConnectFailed: (slug, reason) => failures.push([slug, reason]), timeoutMs: 2000 },
    );
    expect(bridge.tools).toEqual([]);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.[0]).toBe('dead');
    // canon 行形（r3 §1.5 实测样本 `[mcp] r3mcp: connect failed — its tools
    // are unavailable this turn: fetch failed…`）。
    const line = connectFailedLine(failures[0]![0], failures[0]![1]);
    expect(line).toBe(`dead: ${MCP_CONNECT_FAILED_CANON}: ${failures[0]?.[1]}`);
    expect(line).toContain('connect failed — its tools are unavailable this turn');
    await bridge.close();
  });

  test('单点失败不影响其余端点（逐端点独立成败）', async () => {
    const http = await startHttpMcpServer();
    servers.push(http);
    const failures: string[] = [];
    const bridge = await connectMcpBridge(
      [
        { slug: 'dead', transport: 'http', url: 'http://127.0.0.1:1/mcp' },
        { slug: 'alive', transport: 'http', url: http.url },
      ],
      { onConnectFailed: (slug) => failures.push(slug), timeoutMs: 2000 },
    );
    expect(failures).toEqual(['dead']);
    expect(bridge.tools.map((t) => t.name).sort()).toEqual([
      'mcp__alive__echo',
      'mcp__alive__ping',
    ]);
    await bridge.close();
  });
});

describe('connectMcpBridge — stdio transport（02 §7.1 本地命令形态）', () => {
  test('子进程 server 连接 + 工具调用；close 收尾', async () => {
    const bridge = await connectMcpBridge([
      { slug: 'local', transport: 'stdio', command: process.execPath, args: [STDIO_FIXTURE] },
    ]);
    expect(bridge.tools.map((t) => t.name).sort()).toEqual([
      'mcp__local__echo',
      'mcp__local__ping',
    ]);
    const echo = bridge.tools.find((t) => t.name === 'mcp__local__echo');
    expect(await echo?.call({ text: 'stdio' })).toBe('echo:stdio');
    await bridge.close();
  });

  test('命令不存在 = 降级行，不抛', async () => {
    const failures: string[] = [];
    const bridge = await connectMcpBridge(
      [{ slug: 'nope', transport: 'stdio', command: '/nonexistent/mcp-cmd', args: [] }],
      { onConnectFailed: (slug) => failures.push(slug), timeoutMs: 3000 },
    );
    expect(failures).toEqual(['nope']);
    expect(bridge.tools).toEqual([]);
    await bridge.close();
  });
});

describe('McpEndpoint 载荷形状（claim 携带面，02 §7.1）', () => {
  test('空端点集 = 空桥（无授权回合零开销）', async () => {
    const endpoints: McpEndpoint[] = [];
    const bridge = await connectMcpBridge(endpoints);
    expect(bridge.tools).toEqual([]);
    await bridge.close();
  });
});
