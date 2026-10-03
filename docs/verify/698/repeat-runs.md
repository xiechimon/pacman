# #698 m5-web-e2e 重复运行记录

环境：本机（8 核 / 16GB）；每轮 = `vitest run test/m5-web-e2e.test.ts`
（真栈：server + daemon + web dist + Chromium + stub LLM）。日志副本
见各节原始输出（本文件为摘要）。

## 修复前 · 空闲（10 轮）

目的：本机基线复现尝试。

- 迭代数：10；`Test Files  1 passed (1)` 出现 10 次、failed 0 次。
- 单轮 Duration（vitest 报告）：13.94s, 12.31s, 12.18s, 12.96s, 11.62s, 11.73s, 12.42s, 14.51s, 12.14s, 13.18s。

## 修复前 · 六核有界负载（10 轮）

负载形态：6 个 `timeout 1500s` 包裹的纯自旋燃烧器（8 核留 2 核余量），循环结束即杀并自检（orphan burners after cleanup: 0）。目的：验证「CI 资源争抢提升命中率」假设——本负载档未复现。

- 迭代数：10；`Test Files  1 passed (1)` 出现 10 次、failed 0 次。
- 单轮 Duration（vitest 报告）：13.05s, 14.00s, 12.11s, 12.57s, 13.33s, 12.90s, 12.43s, 13.08s, 13.34s, 12.68s。

## 修复后（6 轮）

- 迭代数：6；`Test Files  1 passed (1)` 出现 6 次、failed 0 次。
- 单轮 Duration（vitest 报告）：14.63s, 12.99s, 13.30s, 12.78s, 12.63s, 13.04s。
- 原始日志：`m5-loop-postfix-6.log`。

## TDD 红先行记录（修复前，runner-silent-noop.test.ts）

- 失败方式 1/2：`AssertionError: expected 'success' to be 'failed'`
  （零事件轮被按 success 收——洞 1 的失败面）。
- 失败方式 6：`Error: stream never ended — prompt() rejection swallowed`
  （prompt() 预检拒绝被吞——洞 2 的失败面，8s 超时形态）。
- 修复后同文件 5/5 绿；daemon 全量 31 文件 280 用例绿。
