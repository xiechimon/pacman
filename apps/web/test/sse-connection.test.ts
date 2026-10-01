// SSE 连接对账兜底（XMON-60）单元面：替身 EventSource + 假时钟直接驱动
// connect()。替身的兴趣点是「哪一帧没送到」，不是网络栈——真浏览器侧的观测
// 环归 integration/test/sse-probe.ts（XMON-58 属地），本文件不碰。
//
// 先枚举这类系统能失败的方式，再写实现（本文件的用例就是那张清单）：
// 1. 服务端取了号却没送达（createSerialConnection 吞写错，连接仍留在 hub 订阅
//    集里）→ 连接内 seq 出现空洞。
// 2. 服务端相位/文档改了却一帧业务事件都不发（XMON-58 实测的 150 秒形态：
//    seq 1-6 是业务帧、7-16 全是 ping，无洞）→ 只有「业务帧静默」看得见。
// 3. 闲团队整场只有 ping（常态，不是故障）→ 不得触发对账、不得重建连接。
// 4. 连接真哑（连 ping 一起消失）→ 走 #462 既有静默看门狗重建 + resync。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SSE_BIZ_SILENCE_BASE_MS,
  type StreamGuards,
  connect,
} from '../src/api/sse-connection.js';

const PING_MS = 15_000; // 生产心跳节奏（TEAM_STREAM_PING_INTERVAL_MS）

/** 替身 EventSource：静态 OPEN 必须留着——connect() 的看门狗读
 *  es.readyState !== EventSource.OPEN，缺静态量会把看门狗自己关掉。 */
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

  /** 浏览器侧「建流成功」。 */
  fireOpen(): void {
    this.readyState = FakeEventSource.OPEN;
    this.onopen?.();
  }

  /** 服务端推一帧。 */
  push(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

/** 推进假时钟 `seconds` 秒，期间按生产节奏喂 ping——连接活着但不推业务帧，
 *  正是 XMON-58 那 150 秒的形态。ping 也顺带把 20 秒完全静默看门狗按住。 */
function advanceWithPings(
  es: FakeEventSource,
  seconds: number,
  clock: { t: number; seq: number },
): void {
  for (let i = 0; i < seconds; i++) {
    vi.advanceTimersByTime(1_000);
    clock.t += 1;
    if (clock.t % (PING_MS / 1_000) === 0) es.push({ type: 'ping', seq: ++clock.seq });
  }
}

const URL = '/api/teams/team-1/stream';

function openStream(
  guards: StreamGuards,
  onEvent: (ev: Record<string, unknown>) => void = () => {},
  onResync: () => void = () => {},
): { es: FakeEventSource; dispose: () => void } {
  const dispose = connect(URL, onEvent, onResync, guards);
  const es = FakeEventSource.instances[0] as FakeEventSource;
  es.fireOpen();
  return { es, dispose };
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('seq 空洞 = 证明丢帧', () => {
  it('跳过号段即对账，且不设闸门（空洞是证据不是猜测）', () => {
    const reconcile = vi.fn();
    // 闸门故意关着：空洞对账不依赖「有在飞的活」。
    const { es } = openStream({ inFlight: () => false, reconcile });

    es.push({ type: 'ping', seq: 1 });
    es.push({ type: 'todo', seq: 2, v: 1, doc: { id: 'todo-1' } });
    es.push({ type: 'ping', seq: 3 });
    expect(reconcile).not.toHaveBeenCalled();

    // 4 号帧取了号却没送达（服务端 conn.send 吞掉写错，连接仍留在订阅集里）。
    es.push({ type: 'ping', seq: 5 });
    expect(reconcile).toHaveBeenCalledTimes(1);

    // 5 号之后连续无洞 → 不再重复对账。
    es.push({ type: 'ping', seq: 6 });
    es.push({ type: 'ping', seq: 7 });
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it('空洞把静默窗口归位——有漏帧史后判定更警觉', () => {
    const reconcile = vi.fn();
    const { es } = openStream({ inFlight: () => true, reconcile });
    const clock = { t: 0, seq: 0 };

    es.push({ type: 'ping', seq: ++clock.seq });
    es.push({ type: 'todo', seq: ++clock.seq, v: 1, doc: { id: 'todo-1' } });

    // 静默到点 → 对账一次，窗口翻倍成 40s。
    advanceWithPings(es, 20, clock);
    expect(reconcile).toHaveBeenCalledTimes(1);

    // 再推一帧但跳号（被吞的那条很可能正是业务帧）→ 立即对账，且窗口归位。
    clock.seq += 2;
    es.push({ type: 'ping', seq: clock.seq });
    expect(reconcile).toHaveBeenCalledTimes(2);

    // 归位后下一轮判定在基准窗口（20s）而不是翻倍后的 40s。
    advanceWithPings(es, 19, clock);
    expect(reconcile).toHaveBeenCalledTimes(2);
    advanceWithPings(es, 1, clock);
    expect(reconcile).toHaveBeenCalledTimes(3);
  });

  it('重连后 seq 从 1 重新起算，不算空洞', () => {
    const reconcile = vi.fn();
    const { es } = openStream({ inFlight: () => false, reconcile });

    es.push({ type: 'ping', seq: 1 });
    es.push({ type: 'ping', seq: 2 });
    es.push({ type: 'ping', seq: 3 });

    // 完全静默 20s → 看门狗重建连接（新连接 = 新取号链）。
    vi.advanceTimersByTime(20_000);
    const rebuilt = FakeEventSource.instances[1] as FakeEventSource;
    rebuilt.fireOpen();
    rebuilt.push({ type: 'ping', seq: 1 });
    expect(reconcile).not.toHaveBeenCalled();
  });
});

describe('业务帧静默（ping 不计入）= XMON-58 的 150 秒形态', () => {
  it('有在飞的活时对账，且间隔翻倍——不退化成定频轮询', () => {
    const reconcile = vi.fn();
    const { es } = openStream({ inFlight: () => true, reconcile });
    const clock = { t: 0, seq: 0 };

    // 关闸那一帧本身是业务事件（相位进 planning 的 todo 文档），窗口从此刻起算。
    es.push({ type: 'ping', seq: ++clock.seq });
    es.push({ type: 'todo', seq: ++clock.seq, v: 2, doc: { id: 'todo-1' } });

    advanceWithPings(es, 19, clock);
    expect(reconcile).not.toHaveBeenCalled();

    advanceWithPings(es, 1, clock);
    expect(reconcile).toHaveBeenCalledTimes(1);

    // 第二个窗口翻倍成 40s：第 20~59 秒之间不该再对账。
    advanceWithPings(es, 39, clock);
    expect(reconcile).toHaveBeenCalledTimes(1);

    advanceWithPings(es, 1, clock);
    expect(reconcile).toHaveBeenCalledTimes(2);
  });

  it('业务帧一到就重置窗口：正常流量下零额外请求', () => {
    const reconcile = vi.fn();
    const { es } = openStream({ inFlight: () => true, reconcile });
    const clock = { t: 0, seq: 0 };

    // 每 10 秒一条业务事件——服务端在正常推，永远到不了 20 秒的静默阈值。
    for (let i = 0; i < 30; i++) {
      vi.advanceTimersByTime(10_000);
      clock.t += 10;
      es.push({ type: 'build', seq: ++clock.seq, v: 1, doc: { id: 'build-1', todoId: 't1' } });
    }

    expect(reconcile).not.toHaveBeenCalled();
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('纯 ping 流 + 没有在飞的活 → 不误触发、不重建连接', () => {
    const reconcile = vi.fn();
    const onResync = vi.fn();
    const { es } = openStream({ inFlight: () => false, reconcile }, () => {}, onResync);
    const clock = { t: 0, seq: 0 };

    advanceWithPings(es, 180, clock); // 三分钟纯心跳——闲团队的常态

    expect(reconcile).not.toHaveBeenCalled();
    expect(onResync).not.toHaveBeenCalled();
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('闸门关着时也不吞掉业务帧（onEvent 照常收到）', () => {
    const onEvent = vi.fn();
    const { es } = openStream({ inFlight: () => false, reconcile: vi.fn() }, onEvent);

    es.push({ type: 'ping', seq: 1 });
    es.push({ type: 'todo', seq: 2, v: 1, doc: { id: 'todo-1' } });

    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'todo', seq: 2, doc: { id: 'todo-1' } }),
    );
  });
});

describe('#462 既有面保持', () => {
  it('完全静默（连 ping 也没了）→ 重建连接 + 重连 resync', () => {
    const onResync = vi.fn();
    const { es } = openStream({ inFlight: () => true, reconcile: vi.fn() }, () => {}, onResync);

    es.push({ type: 'ping', seq: 1 });
    vi.advanceTimersByTime(19_000);
    expect(FakeEventSource.instances).toHaveLength(1);

    vi.advanceTimersByTime(1_000);
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(es.readyState).toBe(FakeEventSource.CLOSED);

    // 非首开的重建 = 断线窗口内的一次性事件已永久丢失 → 全量重取补齐。
    (FakeEventSource.instances[1] as FakeEventSource).fireOpen();
    expect(onResync).toHaveBeenCalledTimes(1);
  });

  it('非 OPEN（浏览器自重连中）时看门狗不接管', () => {
    const reconcile = vi.fn();
    const { es } = openStream({ inFlight: () => true, reconcile });
    es.readyState = FakeEventSource.CONNECTING;

    vi.advanceTimersByTime(60_000);

    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('dispose 后定时器不再动作', () => {
    const reconcile = vi.fn();
    const { dispose } = openStream({ inFlight: () => true, reconcile });

    dispose();
    vi.advanceTimersByTime(SSE_BIZ_SILENCE_BASE_MS * 10);

    expect(reconcile).not.toHaveBeenCalled();
    expect(FakeEventSource.instances).toHaveLength(1);
  });
});