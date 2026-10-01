// machine shell wire 客户端对拍（XMON-110 R2；契约 = XMON-108 R1 machine-wire）：
// shellPrecheck → POST /api/machine/shell/{stepId} {command} → 200 {allowed, runId}
// （schema 对拍）/ 403 {error}（MachineApiError 携 server 原因原文）；
// shellResult → POST /api/machine/shell/{runId}/result（终态回写）。
// 重试语义分道：预检**不重试**——每次调用 = server 落一行审计，网络重试丢响应
// 会造出孤儿 running 行；回写按 REMOTE_TOOL_RETRY_DELAYS_MS 重试——server 终态
// 幂等（R1「重复回写 = 幂等 200 不改写」），重放安全。
// 先固化的失败场景（AGENTS.md 测试规则 3）：
//   W1 预检 200 → URL/body/Bearer 正确，响应过 schema 解析出 {allowed, runId}
//   W2 预检 403 → 抛 MachineApiError，body = server {error} 原因原文，单次不重试
//   W3 预检网络错误 → 原样上抛（shell-channel 按「预检失败」口径），不重试
//   W4 回写 200 → URL/body 正确
//   W5 回写 5xx / 网络错误 → 重试后成功（重放安全）
//   W6 回写 4xx（409 denied 行等协议错）→ 单次不重试即抛

import { describe, expect, test } from 'vitest';
import { MachineApiError, MachineClient } from '../src/machine-client.js';

function stubFetch(responses: { status: number; body: unknown }[]): {
  fetchImpl: typeof fetch;
  calls: { url: string; init: RequestInit }[];
} {
  const calls: { url: string; init: RequestInit }[] = [];
  let i = 0;
  const fetchImpl = (async (input: unknown, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : (input as URL).toString();
    calls.push({ url, init: init ?? {} });
    const rsp = responses[Math.min(i, responses.length - 1)]!;
    i += 1;
    return new Response(JSON.stringify(rsp.body), {
      status: rsp.status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

describe('MachineClient.shellPrecheck（machine shell 预检 wire 半）', () => {
  test('W1 200 → POST {command} + Bearer，解析 {allowed, runId}', async () => {
    const { fetchImpl, calls } = stubFetch([
      { status: 200, body: { allowed: true, runId: 'run-9' } },
    ]);
    const client = new MachineClient({ serverUrl: 'http://s', getToken: () => 'tok', fetchImpl });
    const out = await client.shellPrecheck('step-1', 'echo hi');
    expect(out).toEqual({ allowed: true, runId: 'run-9' });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('http://s/api/machine/shell/step-1');
    expect(calls[0]!.init.method).toBe('POST');
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ command: 'echo hi' });
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe('Bearer tok');
  });

  test('W2 403 → MachineApiError 携 server 原因原文，单次不重试', async () => {
    const reason = '机器 m1 未开启 shell 访问（机器详情页），无法执行命令';
    const { fetchImpl, calls } = stubFetch([{ status: 403, body: { error: reason } }]);
    const client = new MachineClient({ serverUrl: 'http://s', getToken: () => 'tok', fetchImpl });
    let err: unknown;
    try {
      await client.shellPrecheck('step-1', 'rm -rf /');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(MachineApiError);
    expect((err as MachineApiError).status).toBe(403);
    expect((err as MachineApiError).body).toBe(reason);
    expect(calls).toHaveLength(1);
  });

  test('W3 网络错误 → 原样上抛，不重试（预检非幂等）', async () => {
    let n = 0;
    const fetchImpl = (async () => {
      n += 1;
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    const client = new MachineClient({ serverUrl: 'http://s', getToken: () => 'tok', fetchImpl });
    await expect(client.shellPrecheck('step-1', 'echo hi')).rejects.toBeInstanceOf(TypeError);
    expect(n).toBe(1);
  });
});

describe('MachineClient.shellResult（machine shell 回写 wire 半）', () => {
  test('W4 200 → POST 终态 body 到 runId 端点', async () => {
    const { fetchImpl, calls } = stubFetch([{ status: 200, body: { ok: true } }]);
    const client = new MachineClient({ serverUrl: 'http://s', getToken: () => 'tok', fetchImpl });
    await client.shellResult('run-9', { status: 'done', exitCode: 0, output: 'hi\n' });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('http://s/api/machine/shell/run-9/result');
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      status: 'done',
      exitCode: 0,
      output: 'hi\n',
    });
  });

  test('W5 网络错误 → 重试后成功（server 终态幂等，重放安全）', async () => {
    let n = 0;
    const fetchImpl = (async () => {
      n += 1;
      if (n === 1) throw new TypeError('fetch failed');
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
    const client = new MachineClient({ serverUrl: 'http://s', getToken: () => 'tok', fetchImpl });
    await client.shellResult('run-9', { status: 'done', exitCode: 0 });
    expect(n).toBe(2);
  }, 10_000);

  test('W6 4xx（409 denied 行）→ 单次不重试即抛', async () => {
    const { fetchImpl, calls } = stubFetch([
      { status: 409, body: { error: 'shell run run-9 was denied (no result to report)' } },
    ]);
    const client = new MachineClient({ serverUrl: 'http://s', getToken: () => 'tok', fetchImpl });
    await expect(client.shellResult('run-9', { status: 'done' })).rejects.toBeInstanceOf(
      MachineApiError,
    );
    expect(calls).toHaveLength(1);
  });
});
