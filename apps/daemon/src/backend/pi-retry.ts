// pi retry 面的显式单源（#926）：daemon 不再吃 pi 的内建默认（settings-manager
// getRetrySettings：maxRetries ?? 3 / baseDelayMs ?? 2000 / enabled ?? true），而是
// 把重试预算显式声明在这里，并由 runner 的零进展护栏常量从中派生——一处改、两处
// 变，结构上无法脱钩（票面「护栏常量与设置一致」）。
//
// 缝纪律（01 §5/§7.3）：本模块**不 import** `@earendil-works/*`——只放普通配置对象
// 与派生数值，好让 backend 无关的 orchestrator（runner.ts）也能消费 RETRY_STORM_MAX
// 而不被拖进 pi 实现的依赖图。pi.ts 把它当 SettingsManager.inMemory 的 retry 位消费
// （结构匹配 pi 的 RetrySettings），runner.ts 把 maxRetries 当护栏预算消费。

/** pi `retry.*` 的显式值（docs/settings.md §Network and retries）。
 *
 *  - `enabled` / `maxRetries` / `baseDelayMs` / `maxAgentDelayMs` = agent 级重试预算，
 *    即 pi `_willRetryAfterAgentEnd` 经 getRetrySettings 读的那一面——显式钉死，
 *    不再随上游默认漂移。
 *  - `provider.maxRetries: 0` = docs 的建议值（「除非确需 provider 级重试，保持 0——
 *    provider 重试会抢在 pi 自己处理 quota / usage-limit 之前」），显式写出而非吃隐式默认。
 *  - `provider.timeoutMs` **有意不设**：它默认绑定 `httpIdleTimeoutMs`（传输面空闲超时，
 *    不属于重试预算）。把它钉成固定数值会有截断长流的风险，而步级时长另由 runner 的
 *    STREAM_DURATION_CAP 守护——两个关注点不混在一处。 */
export const PI_RETRY_SETTINGS = {
  enabled: true,
  maxRetries: 3,
  baseDelayMs: 2000,
  maxAgentDelayMs: 60000,
  provider: { maxRetries: 0 },
} as const;

/** runner 零进展 auto_retry 预算上界（#708 失败方式 2），与 PI_RETRY_SETTINGS.maxRetries
 *  同源派生：预算内的重试归 pi 自己收（连接错 1→2→3 退场形不惊动本护栏）；超过它还在
 *  同一错误上空转 = 预算被某种机制重置的病态（#519 run4/6 实测 ~40 发/10min 同形重试），
 *  由 runner 从外部掐断。改 PI_RETRY_SETTINGS.maxRetries 即同步改本护栏——二者不脱钩。 */
export const RETRY_STORM_MAX = PI_RETRY_SETTINGS.maxRetries;
