// 失效收敛（#717）：SSE 提示（01 §4.1/S8 canon）在查询层不得被吞。
//
// 病灶（query-core 5.103.1 语义，行号为 node_modules/@tanstack/query-core/
// build/modern/query.cjs）：
//   - `invalidateQueries` 默认 cancelRefetch=true（queryClient.cjs:328），
//     但取消以「已有数据」为前提——`if (this.state.data !== void 0 &&
//     fetchOptions?.cancelRefetch) this.cancel(...)`（query.cjs:300）。
//   - 挂载取数（`data === undefined`、`fetchStatus === 'fetching'`）在飞时
//     到达的失效因此无法取消，被并进那次取数（同一行 else 分支返回既有
//     promise）；而那次取数的服务端读发生在事件之前，落地的仍是事件前的
//     旧快照。
//   - 成功动作不补取也不清失效标记（reducer `success`，query.cjs:438+），
//     于是提示就此丢失：缓存陈旧 + 无在飞取数 + 无待发失效。
//
// 为什么必须在这里收口：CI 红 #717-A 是该态的实测形态——plan 行已落库
// （DB plans 行 1 条）、相位 chip 已翻 confirm（team/conv 事件都活着），
// 方案卡 30s 不出现。服务端已按 XMON-59 把 step 事件发布点提前到 plan 落库
// 点（machines.ts receivePlanUpload），提示确实发了；丢失发生在浏览器查询层。
// 三层看护结构上覆盖不到这一态：XMON-60 闸门在 confirm 相位关闭（非在飞
// 相位）、#462 看门狗被 ping 保活（从不静默）、seq 空洞要求先漏帧。
//
// 修法（不改 canon）：失效是提示，提示必须换来一次「失效之后发出的取数」。
// 对调用时刻仍处于挂载取数的查询，在其 settle 后补一轮失效——那时
// `data` 已定义（或处于 error，retryer 已 rejected），取消/重取路径都成立，
// 补出的取数服务端读必然晚于事件。一轮为界（每个查询最多追加一次），
// 不自激；无匹配查询零请求。

import type { QueryClient, QueryFilters } from '@tanstack/react-query';

/** 失效 + 收敛：调用链 settle 后，凡「失效时仍在挂载取数」的查询都已重取。 */
export function invalidateConverged(qc: QueryClient, filters?: QueryFilters): Promise<void> {
  const initialInFlight = qc
    .getQueryCache()
    .findAll(filters)
    .filter((q) => q.state.fetchStatus !== 'idle' && q.state.data === undefined);
  return qc.invalidateQueries(filters).then(() => {
    for (const q of initialInFlight) {
      // 有更新的取数在飞 = 那一次本就发出于本次失效之后，无需追加。
      if (q.state.fetchStatus !== 'idle') continue;
      void qc.invalidateQueries({ queryKey: q.queryKey });
    }
  });
}
