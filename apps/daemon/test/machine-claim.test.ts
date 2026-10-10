// claim 循环与退避 + wake SSE 与在飞 claim（#1128 自 machine-loop.test.ts 拆分；共享 harness 收编位
// = ./machine-loop-harness.ts，每个测试自 boot 自停）。

import { describe, expect, test } from 'vitest';
import { nextBackoffMs } from '../src/machine-loop.js';
import { boot, CLAIMED, FakeMachineApi, fakeBackend, waitFor } from './machine-loop-harness.js';

describe('claim 循环与退避（r3 §1.5：断网指数退避封顶 30s，进程不退出）', () => {
  test('claim 网络失败 → 退避日志（基数 10ms 时标），恢复后继续挂起领取', async () => {
    const api = new FakeMachineApi();
    api.failClaims = 2;
    const { handle, lines } = await boot({ api });
    await waitFor(() => lines.filter((l) => l.includes('claim failed')).length >= 2);
    expect(lines.some((l) => l.includes('backoff 10ms'))).toBe(true);
    expect(lines.some((l) => l.includes('backoff 20ms'))).toBe(true);
    // 第三次成功挂起（长轮询 parked）——进程不退出。
    await waitFor(() => api.parked !== null);
    await handle.stop();
    await handle.done;
  });

  test('退避序列封顶 30s（CLAIM_BACKOFF_CAP_MS = r3 §1.5 实测口径）', () => {
    const seq: number[] = [];
    let b = 1_000;
    for (let i = 0; i < 8; i++) {
      seq.push(b);
      b = nextBackoffMs(b);
    }
    expect(seq).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000, 30_000]);
  });
});

describe('wake SSE 与在飞 claim（#482 裁定：客户端不消费 wake，低延迟派发归 server 侧 hold 直解）', () => {
  // 失败方式枚举（裁定依据，详 PR body）：server wake() 同轮既推 SSE 又直解
  // claim 等待者——SSE 可能先于 claim 响应到达；若客户端 abort 在飞 claim，
  // server 第二次 tryClaim 已把 step 落库 claimed 写向死 socket = 孤儿步。
  // 本测试钉住裁定：wake 事件对在飞 claim 零作用；若有人重新接线客户端
  // wake-abort，此处红。
  test('wake 事件到达时在飞 claim 不中断不重发——挂起保持，随后照常领步', async () => {
    const api = new FakeMachineApi();
    const { backend } = fakeBackend([{ type: 'done', usage: [] }]);
    const { handle, lines } = await boot({ api, backend });
    await waitFor(() => api.parked !== null); // claim 长轮询挂起（server hold 中）
    const callsBefore = api.claimCalls;

    api.onStreamEvent?.({ type: 'wake' });
    await new Promise((r) => setTimeout(r, 50)); // 给潜在 abort→重发链路留时标

    // 在飞 claim 未被中断：仍挂起、无重发、无退避日志。
    expect(api.parked).not.toBeNull();
    expect(api.claimCalls).toBe(callsBefore);
    expect(lines.some((l) => l.includes('claim failed'))).toBe(false);

    // 挂起的 claim 仍能照常收步执行（server 直解路径的客户端终点）。
    api.parked?.(CLAIMED);
    await waitFor(() => api.doneBodies.length === 1);
    expect(api.doneBodies[0]?.body.status).toBe('success');
    await handle.stop();
    await handle.done;
  });
});
