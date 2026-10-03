// #740 conversation stream 订阅重置语义（客户端半）：流（重）建立时先清
// liveTextStore 再消费事件——服务端 subscribe 补发是「当前段快照」，客户端
// 旧缓冲（断线前 / 关抽屉前累积的）必须先作废，否则补发叠加成双份。
// 失败方式清单（票面 ① 的客户端半 + 既有面保持）：
// 1. 双份文本：进场前残留的旧缓冲未清 → 补发后 = 旧 + 补发（双份）。
// 2. 断线重连：重建流时旧缓冲未清 → 补发 + 断线前文本叠加（双份）。
// 3. 接缝：补发（快照）与后续 live 增量必须精确拼接——不重不断。
// 4. 既有面保持：message 事件仍清缓冲 + 失效重取；step 事件失效重取不动
//    缓冲；重连 resync 仍全量失效重取（#462）。
// 服务端半（hub 缓冲/补发/清空点）见 apps/server/test/conv-stream-catchup.test.ts。

import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { liveTextStore } from '../src/api/live-text.js';
import { startConversationStream } from '../src/api/sse.js';

/** 替身 EventSource：sse-connection.test.ts 同款（静态 OPEN 量必须留着）。 */
class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static instances: FakeEventSource[] = [];
  readonly url: string;
  readyState: number = FakeEventSource.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  close(): void {
    this.readyState = FakeEventSource.CLOSED;
  }
  fireOpen(): void {
    this.readyState = FakeEventSource.OPEN;
    this.onopen?.();
  }
  push(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

const CONV = 'chief-t-740';

function freshClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** 起流（清零instances 后），返回当前连接替身。 */
function startStream(qc: QueryClient): FakeEventSource {
  FakeEventSource.instances = [];
  startConversationStream(CONV, qc, {});
  const es = FakeEventSource.instances[0] as FakeEventSource;
  es.fireOpen();
  return es;
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
  liveTextStore.clear(CONV);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  liveTextStore.clear(CONV);
});

describe('进场先清：补发即快照（失败方式 1）', () => {
  it('订阅前残留的旧缓冲在首事件可能到达前已被清空', () => {
    // 关抽屉 / 上一次订阅留下的残段。
    liveTextStore.append(CONV, '旧缓冲');
    const qc = freshClient();
    FakeEventSource.instances = [];
    startConversationStream(CONV, qc, {});
    // 清点在 connect 之前：任何事件（含补发）都还没可能被消费。
    expect(liveTextStore.get(CONV)).toBe('');
    const es = FakeEventSource.instances[0] as FakeEventSource;
    es.fireOpen();
    es.push({ type: 'text_delta', text: '补发前缀' });
    expect(liveTextStore.get(CONV)).toBe('补发前缀');
  });
});

describe('断线重连：重建即清（失败方式 2）', () => {
  it('看门狗重建后旧缓冲作废，补发快照不叠加双份', () => {
    const qc = freshClient();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const es = startStream(qc);
    es.push({ type: 'text_delta', text: '断线前' });
    expect(liveTextStore.get(CONV)).toBe('断线前');

    // 完全静默 20s → 看门狗重建连接（#462 同路径：open() → onopen → resync）。
    vi.advanceTimersByTime(20_000);
    const rebuilt = FakeEventSource.instances[1] as FakeEventSource;
    expect(rebuilt).toBeDefined();
    rebuilt.fireOpen();
    // resync：清缓冲（旧段作废）+ 全量失效重取（既有 #462 面保持）。
    expect(liveTextStore.get(CONV)).toBe('');
    expect(invalidate).toHaveBeenCalled();

    // 服务端在新订阅上补发当前段快照（含断线窗口内流掉的增量）。
    rebuilt.push({ type: 'text_delta', text: '断线前后缀' });
    expect(liveTextStore.get(CONV)).toBe('断线前后缀');
  });
});

describe('接缝：补发快照 + live 增量（失败方式 3）', () => {
  it('一条补发与后续增量精确拼接——不重不断', () => {
    const qc = freshClient();
    const es = startStream(qc);
    es.push({ type: 'text_delta', text: '前缀' });
    es.push({ type: 'text_delta', text: '增量' });
    expect(liveTextStore.get(CONV)).toBe('前缀增量');
  });
});

describe('既有面保持（失败方式 4）', () => {
  it('message 事件：清缓冲 + messages/plans 失效重取', () => {
    const qc = freshClient();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const es = startStream(qc);
    es.push({ type: 'text_delta', text: '段' });
    es.push({
      type: 'message',
      message: { id: 'm1', role: 'assistant', content: '终稿', createdAt: 1 },
    });
    expect(liveTextStore.get(CONV)).toBe('');
    const keys = invalidate.mock.calls.map(([filters]) => filters as { queryKey?: string[] });
    expect(keys.some((f) => f.queryKey?.[0] === 'messages')).toBe(true);
    expect(keys.some((f) => f.queryKey?.[0] === 'plans')).toBe(true);
  });

  it('step 事件：失效重取、不动缓冲', () => {
    const qc = freshClient();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const es = startStream(qc);
    es.push({ type: 'text_delta', text: '段' });
    es.push({
      type: 'step',
      step: { id: 's1', buildId: CONV, kind: 'chief', machineId: null, createdAt: 1, status: 'claimed' },
    });
    expect(liveTextStore.get(CONV)).toBe('段');
    expect(invalidate).toHaveBeenCalled();
  });

  it('handlers 透传：onMessage/onStep 照常收到载荷', () => {
    const qc = freshClient();
    const onMessage = vi.fn();
    const onStep = vi.fn();
    FakeEventSource.instances = [];
    startConversationStream(CONV, qc, { onMessage, onStep });
    const es = FakeEventSource.instances[0] as FakeEventSource;
    es.fireOpen();
    es.push({
      type: 'message',
      message: { id: 'm1', role: 'assistant', content: '终稿', createdAt: 1 },
    });
    es.push({
      type: 'step',
      step: { id: 's1', buildId: CONV, kind: 'chief', machineId: null, createdAt: 1, status: 'done' },
    });
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'm1', role: 'assistant' }),
    );
    expect(onStep).toHaveBeenCalledWith(expect.objectContaining({ id: 's1', status: 'done' }));
  });
});
