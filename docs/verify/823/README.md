# docs/verify/823 — 发送后 skill 自动检测（claim 面路由）

Ticket: #823（纠正方向后重做：输入时 ghost 提示作废，revert #838 已合；
本票 = 发送之后 agent 侧自动检测，输入框 UI 一个不动）。

## 机制声称 → 实物

| 声称 | 实物 |
|---|---|
| claim 时服务端按用户消息检测技能，提示节进 chief.systemPrompt | `claim-a-system-prompt.txt`（claim 载荷 `chief.systemPrompt` 尾节原文） |
| 用户原文不被改写（提示节只进 systemPrompt） | `claim-a-payload.json`（`instruction` 与发送 content 逐字一致）+ `step-rows.json`（SQLite `step.prompt` 列逐字对账） |
| 普通对话不被劫持（第一失败方式） | probe B1：时间词无提醒意图 → claim 载荷零路由节 |
| UI 发送与 REST 发送同形（全入口覆盖） | probe D1/D2 + `ui-sent.png` + `send-flow.gif`（抽屉发送→落流→同一 claim 面带节） |

## 探针与结果

`probe-chief-skill-route.mjs`（随本目录进仓，可重跑；依赖新库——重验先重跑
`launch.mjs`）。隔离栈 live（server + vite dev + scratch skills 空集起步，
自种 `morning-reminder` 技能），假机器走真 machine wire（enroll → claim →
transcript PUT → done，零 daemon 零 LLM）：**11/11 PASS**（见 `result.json`）：

- A1–A5：`明早 9 点提醒我开站会` → 路由节在位（点名 morning-reminder +
  description + `set_wake` 回落），`instruction` 逐字一致；
- B1–B2：`明天的会议纪要帮我整理一下` → 零路由节，原文不动；
- C1–C2：两步 `done` 收尾，DB `step.prompt` 逐字一致；
- D1–D2：抽屉真发送 `每天早上八点叫我起床` 落流，同一 claim 面带节。

## 诚实边界

栈内无真模型：本目录证明"检测 fired 且上下文到位"（agent 侧能看到什么），
不证明"模型真调了技能"。LLM 侧"先核对再调用"由单测覆盖：
`packages/shared/test/skill-route.test.ts`（15）+
`apps/server/test/chief-skill-route.test.ts`（4）；
e2e 受影响面 `token-gate.spec.ts` 4/4（server 面变更的自动回落）。
