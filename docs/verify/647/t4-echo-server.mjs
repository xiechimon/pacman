#!/usr/bin/env node
// T4 验证夹具：最小 stdio MCP server（#647 第三面 mcpServers 的执行端）。
// JSON-RPC over stdin/stdout——initialize（回显客户端请求的 protocolVersion）/
// notifications/initialized（无响应）/ tools/list（一件 echo 工具）/ tools/call。
// 工具名经 CLI 面呈 mcp__t4echo__echo。probe 用它证明 claude-code 后端把
// claim 携带的授权 slug 映射到 SDK 原生 stdio config 并真连真调。

import { createInterface } from 'node:readline';

const TOOLS = [
  {
    name: 'echo',
    description: 'Echo the given text back, prefixed with "echo:".',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string', description: 'Text to echo back.' } },
      required: ['text'],
    },
  },
];

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (line.trim() === '') return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  if (msg.method === 'initialize') {
    reply(msg.id, {
      protocolVersion: msg.params?.protocolVersion ?? '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: 't4echo', version: '0.0.1' },
    });
    return;
  }
  if (msg.method === 'notifications/initialized') return; // 通知无响应
  if (msg.method === 'tools/list') {
    reply(msg.id, { tools: TOOLS });
    return;
  }
  if (msg.method === 'tools/call') {
    const text = String(msg.params?.arguments?.text ?? '');
    reply(msg.id, { content: [{ type: 'text', text: `echo: ${text}` }] });
    return;
  }
  if (msg.method === 'ping') {
    reply(msg.id, {});
    return;
  }
  if (msg.id !== undefined) reply(msg.id, null, -32601, `method not found: ${msg.method}`);
});

function reply(id, result, code, message) {
  const out = { jsonrpc: '2.0', id };
  if (code !== undefined) out.error = { code, message };
  else out.result = result;
  process.stdout.write(`${JSON.stringify(out)}\n`);
}
