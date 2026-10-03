// SSE 对账面（XMON-60）：连接层（sse-connection.ts）只认「要不要对账」与
// 「对账做什么」两个回调，具体判据落在这里——闸门读查询缓存，动作是失效重取。
//
// 不引 React：只依赖 @tanstack/react-query 的缓存对象，所以能在 node 环境的
// 单元测试里铺真缓存验（apps/web/test/sse-guards.test.ts）。

import type { QueryClient } from '@tanstack/react-query';
import { isInFlightPhase } from '../phase.js';
import { invalidateConverged } from './invalidate.js';
import type { StreamGuards } from './sse-connection.js';

/** 对账失效面 = 两条流的事件处理器会失效的查询键并集——「当作漏掉的提示都
 * 收到了」。比全量 `invalidateQueries()` 窄：不含 session / teams / providers
 * 这些非 SSE 驱动却恒活跃的键。失效只重取活跃查询，所以真实开销 = 当页 SSE
 * 相关的那几个在挂查询，一轮；静默持续时轮次按 sse-connection.ts 的翻倍退避。 */
export const STREAM_QUERY_KEYS: readonly (readonly string[])[] = [
  ['todos'],
  ['todo'],
  ['schedules'],
  ['build'],
  ['steps'],
  ['notifications'],
  ['chiefThreads'],
  ['machines'],
  ['branchSync'],
  ['messages'],
  ['plans'],
  ['changes'],
];

/** 「有在飞的活」= 静默是否可疑的闸门（XMON-60）。判据只有一条：缓存里还有
 * 相位为 planning/building 的 todo——那两态 UI 无主按钮（phase.ts 的
 * IN_FLIGHT_PHASES），下一态只能由服务端推，所以「界面停在 planning 而流没
 * 动静」是服务端漏发的可观测证据。反过来，闲团队整场只有 ping 是常态，
 * 不加闸门的话每 20 秒一次的静默判定就退化成定频重取。
 *
 * 页面没挂 todo 查询时闸门恒关 = 不对账，行为与加本机制前一致，不误伤。 */
export function hasInFlightWork(qc: QueryClient): boolean {
  return qc
    .getQueryCache()
    .getAll()
    .some((query) => {
      const head = query.queryKey[0];
      if (head !== 'todos' && head !== 'todo') return false;
      const data = query.state.data;
      if (Array.isArray(data)) return data.some(isInFlightRow);
      return isInFlightRow(data);
    });
}

function isInFlightRow(row: unknown): boolean {
  if (typeof row !== 'object' || row === null) return false;
  const phase = (row as { phase?: unknown }).phase;
  return typeof phase === 'string' && isInFlightPhase(phase);
}

/** 两条流共用的对账面。失效走收敛缝（#717，invalidate.ts）：对账时刻若
 *  恰有挂载取数在飞，裸失效会被去重吞掉——对账自己变成又一个被吞的提示，
 *  兜底失效。 */
export function streamGuards(qc: QueryClient): StreamGuards {
  return {
    inFlight: () => hasInFlightWork(qc),
    reconcile: () => {
      for (const queryKey of STREAM_QUERY_KEYS) void invalidateConverged(qc, { queryKey });
    },
  };
}
