// 数据源模式闸门（M5 汇合，#83）：
// - fixture 模式 = scenario 机制存活位（dev / parity build）且 URL 带
//   `?scenario=`——parity 矩阵行与既有 reject-chain e2e 的确定性数据源。
// - live 模式 = 其余一切（生产 build 恒 live；dev 无参数 = live，经 vite
//   proxy 打到本地 server）——真 API + SSE（02 §1.2）。
// scenario 参数退役口径（#83 票面）：dev-only 存活，生产 build 编译期折叠。

import { SCENARIO_PARAM } from '../fixtures/scenario.js';

const SCENARIOS_ENABLED = import.meta.env.DEV || import.meta.env.MODE === 'parity';

/** URL 是否选中 fixture 数据源（与 fixtures/scenario.ts 的存活位同源）。 */
export function isFixtureMode(search: URLSearchParams): boolean {
  return SCENARIOS_ENABLED && search.get(SCENARIO_PARAM) != null;
}
