# #926 验证证据：daemon 重试与收敛时序显式化

票面两处从「假定」改成「声明 + 可观测」：

1. **重试面**：pi 的 `retry.*` 在 daemon 里显式设置（不再吃上游默认），runner 的零进展护栏常量 `RETRY_STORM_MAX` 与 `retry.maxRetries` 同源派生。
2. **收敛判定**：`done` 由 pi 的 `agent_settled`（「不会再自动继续」的权威信号）触发，取代旧的 `agent_end(!willRetry)` 猜测。

## 机制生效验收：实物判据

按仓内 `verify-pacman`「机制生效验收:实物判据」硬规则，声称的机制从**运行时真值**取证，不是读源码。探针 `drive-926-convergence.mts` 起真 pi 运行时打 stub LLM，产物 = `convergence-evidence.json`。

### Phase A — retry 面被 pi 实际消费（不是摆设）

`buildPiSessionSettings()` 产出的设置对象喂进 **pi 真 `SettingsManager.inMemory`**，再 `getRetrySettings()` 读回：

```
piGetRetrySettings         = { enabled: true, maxRetries: 3, baseDelayMs: 2000, maxAgentDelayMs: 60000 }
piGetProviderRetrySettings = { maxRetries: 0, maxRetryDelayMs: 60000 }
RETRY_STORM_MAX            = 3
```

读回值 == daemon 显式声明值（非 pi 内建默认回落）。`RETRY_STORM_MAX === getRetrySettings().maxRetries` —— 护栏常量与 pi 实际读到的重试预算同源，结构上不脱钩（单源 = `apps/daemon/src/backend/pi-retry.ts`）。

### Phase B — 真 pi 会话的原始事件序 + done 时机

真 `AgentSession`（daemon `materializeProvider` + `buildPiSessionSettings` + `ModelRuntime` + `createAgentSession`）打 stub LLM，订阅**原始 pi 事件**并同步过 daemon 的 `mapPiSessionEvent`：

```
raw pi events : … → turn_end → agent_end(14) → agent_settled(15)
mapped events : … → message_end → done
```

- 真 pi 先发 `agent_end`（idx 14），**再**发 `agent_settled`（idx 15）——settled 是收敛权威信号。
- 映射产出**恰好一个** `done`，且它对应的原始事件索引 == `agent_settled` 的索引（15）。
- `agent_end`（idx 14）**未**触发 done —— 旧路径会在此提前发 done（并在排队工作/溢出恢复仍要继续时 dispose 会话，掐死后续 run）。

这就是票面要的收敛对照：真 pi 的 `agent_settled` 驱动 done，`agent_end(!willRetry)` 不再驱动。

### Phase C — 映射函数确定性对照

`mapPiSessionEvent` 直接喂两种事件：

```
agent_end(willRetry=false) → []                      （不发 done）
agent_settled              → [{ type: 'done', … }]   （发 done）
```

## 单元/集成面（CI 常驻）

- `apps/daemon/test/map-pi-event.test.ts`：`agent_settled → done`、`agent_end` 恒不发 done、「模型还会继续」路径 done 不提前、usage 累积随 settled 更完整。
- `apps/daemon/test/pi-retry-config.test.ts`：retry 面显式接入（引用同一性）、显式值对齐 docs、`RETRY_STORM_MAX` 与会话设置同源。
- `apps/daemon/test/runner-error-lifecycle.test.ts`：护栏预算可注入且改变收尾行为（`retryStormMax=1 → 第 2 发即收`）。
- `integration/`（22 文件 / 62 测试）：真 daemon + 真 PiBackend + stub LLM 端到端，步收敛到完成（`finished`）——agent_settled → done 在全链运行时成立。

## 复跑

```sh
cd apps/daemon
corepack pnpm exec tsx \
  "$(git rev-parse --show-toplevel)/.claude/skills/verify-pacman/scripts/drive-926-convergence.mts"
```

探针自起 stub LLM 并自回收（scratch 目录用后即删），退出码 0 = 全部断言通过，产物刷新 `docs/verify/926/convergence-evidence.json`。回环 stub 走本机，跑前若设了代理需 `env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*'`。
