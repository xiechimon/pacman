// 失效收敛（#717）单元面：真 QueryClient + 真 QueryObserver（挂载形态与
// useQuery 同——invalidateQueries 默认 refetchType:'active'，只有挂载者的
// 查询才会被重取，裸 fetchQuery 的查询测不出这条链）+ 受控取数 promise，
// 钉住「SSE 提示不得被查询层吞掉」这条不变量。失败方式清单（先列再写实现）：
//   1. 挂载取数（fetchStatus=fetching 且 data===undefined）在飞时到达的失效：
//      query-core 的去重路径无法取消它（cancel 以 data!==undefined 为前提，
//      query.cjs:300），失效被并进那次取数——而它的服务端读发生在事件之前，
//      落地的仍是旧快照；成功动作不重排取数（reducer success，query.cjs:438）。
//      此后无人再失效 = 界面永久停在旧值（CI 红 #717-A：plan 行已落库、相位
//      chip 已翻 confirm、方案卡 30s 不出现；XMON-60 闸门在 confirm 相位关闭、
//      ping 保住 #462 看门狗、无漏帧则 seq 空洞不触发——三层看护全盲）。
//   2. 已有数据（data 已定义）在飞时到达的失效：现行 cancelRefetch 语义
//      （取消 + 重取）必须原样保留，收敛路径不得把它降级成去重。
//   3. 挂载取数失败（data 仍 undefined、status=error）后到达的失效：收敛
//      路径必须补出一次取数（CI 负载下瞬态 5xx 与「空快照」同族收口）。
//   4. 无匹配查询：不报错、不下发请求（页面上没挂该查询）。
//   5. 收敛必须有界：一轮失效最多追加一次取数，不得自激成取数循环。
// 断言口径 = 「失效调用链 settle 后，一定有一次失效之后发出的取数落地」。

import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { invalidateConverged } from '../src/api/invalidate.js';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (v: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function makeClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** 挂载一个查询（observer + subscribe = useQuery 的取数触发路径）。 */
function mount(qc: QueryClient, queryKey: readonly unknown[], queryFn: () => Promise<unknown[]>): void {
  const observer = new QueryObserver<unknown[], Error, unknown[], unknown[], readonly unknown[]>(qc, {
    queryKey,
    queryFn,
  });
  observer.subscribe(() => {});
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('现状：query-core 原始 invalidateQueries 的可吞路径（本缝存在的理由）', () => {
  it('挂载取数在飞时，失效被并进那次取数——空快照落地后无人再取', async () => {
    const qc = makeClient();
    const mountRead = deferred<unknown[]>();
    const queryFn = vi
      .fn<() => Promise<unknown[]>>()
      .mockImplementationOnce(() => mountRead.promise)
      .mockResolvedValue([{ id: 'p0', version: 1 }]);

    mount(qc, ['plans', 'b0'], queryFn);
    const invalidated = qc.invalidateQueries({ queryKey: ['plans'] });
    mountRead.resolve([]);
    await invalidated;
    await settle();

    // 失效没有落成第二次取数：界面停在事件之前的空快照。
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(qc.getQueryData(['plans', 'b0'])).toEqual([]);
  });
});

describe('失效收敛：提示不得被查询层吞掉', () => {
  it('挂载取数在飞时到达的失效，必须在空快照落地后仍重取一次（收敛）', async () => {
    const qc = makeClient();
    const mountRead = deferred<unknown[]>();
    const queryFn = vi
      .fn<() => Promise<unknown[]>>()
      .mockImplementationOnce(() => mountRead.promise)
      .mockResolvedValue([{ id: 'p1', version: 1 }]);

    // 挂载取数：服务端读发生在 plan 行落库之前，响应迟到落地。
    mount(qc, ['plans', 'b1'], queryFn);
    // 提交后的 SSE 提示（step/todo 事件）→ 失效。
    const invalidated = invalidateConverged(qc, { queryKey: ['plans'] });
    mountRead.resolve([]);
    await invalidated;
    await settle();

    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(qc.getQueryData(['plans', 'b1'])).toEqual([{ id: 'p1', version: 1 }]);
  });

  it('已有数据在飞时到达的失效：保留取消 + 重取，取到失效后的新快照', async () => {
    const qc = makeClient();
    const slow = deferred<unknown[]>();
    const queryFn = vi
      .fn<() => Promise<unknown[]>>()
      .mockImplementationOnce(() => slow.promise)
      .mockResolvedValue([{ id: 'p2', version: 1 }]);

    mount(qc, ['plans', 'b2'], queryFn);
    // 首个取数在飞期间已有旧数据（staleTime 内缓存/前一轮快照）。
    qc.setQueryData(['plans', 'b2'], [{ id: 'old' }]);
    await invalidateConverged(qc, { queryKey: ['plans'] });
    slow.resolve([{ id: 'stale' }]);
    await settle();

    expect(qc.getQueryData(['plans', 'b2'])).toEqual([{ id: 'p2', version: 1 }]);
  });

  it('挂载取数失败（error、data 仍 undefined）后到达的失效：补出一次取数', async () => {
    const qc = makeClient();
    const queryFn = vi
      .fn<() => Promise<unknown[]>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue([{ id: 'p3', version: 1 }]);

    mount(qc, ['plans', 'b3'], queryFn);
    await settle();
    await invalidateConverged(qc, { queryKey: ['plans'] });
    await settle();

    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(qc.getQueryData(['plans', 'b3'])).toEqual([{ id: 'p3', version: 1 }]);
  });

  it('无匹配查询：不报错、不下发请求', async () => {
    const qc = makeClient();
    const queryFn = vi.fn<() => Promise<unknown[]>>().mockResolvedValue([]);
    await invalidateConverged(qc, { queryKey: ['plans'] });
    expect(queryFn).not.toHaveBeenCalled();
  });

  it('收敛有界：一次失效最多追加一轮取数，不自激', async () => {
    const qc = makeClient();
    const mountRead = deferred<unknown[]>();
    const queryFn = vi
      .fn<() => Promise<unknown[]>>()
      .mockImplementationOnce(() => mountRead.promise)
      .mockResolvedValue([{ id: 'p4', version: 1 }]);

    mount(qc, ['plans', 'b4'], queryFn);
    const invalidated = invalidateConverged(qc, { queryKey: ['plans'] });
    mountRead.resolve([]);
    await invalidated;
    await settle();
    await settle();

    expect(queryFn).toHaveBeenCalledTimes(2);
  });
});