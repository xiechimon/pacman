---
labels: [wayfinder:grilling]
status: closed
owner: user
blockedBy: [02, 03]
---

# 05 · v0.1 验收标准

## Question

「跑起来了」到底指什么？定死验收，spec 的施工票才有完成条件。

- 验收形态：dev 模式跑通就算，还是要打出本机可装的 dmg？
- 首发 provider：沿用 mini-pi 的 Anthropic 兼容端点，还是直接配 OAuth（Claude Max 等），还是两条都验？
- 第一个真实使用场景：拿哪个真实任务当冒烟（例如让它在本仓改一个真实 bug）？
- 验收禁区：哪些子系统 v0.1 只要求「代码在、不启用」就算过（IM 网关？Automations？）

输入：ticket 02 的构建事实、ticket 03 的实跑结果。调用 `grilling` 与 `domain-modeling`。

## Answer

v0.1 验收标准（全部满足才算过）：

1. **形态**：dev 模式跑通即算过，不出 dmg（02 票已确认打包有缺口，dmg 归 v0.2）
2. **provider 两条都验**：
   - Anthropic 兼容端点（pi_compat 连接，沿用 mini-pi 的凭据）
   - Claude Max OAuth（浏览器授权链路；操作路径由 ticket 08 确认）
3. **冒烟场景**：dogfood——用 pacman 在 pacman 仓完成一个真实小改动（首选：改一处换皮漏网的文案，验收同时产出实际价值）
4. **重子系统**：Pages / Automations / IM 网关 / browser_tool 只要求「代码在、不启用」，不在 v0.1 验收面内（启用范围由 06 票定）
