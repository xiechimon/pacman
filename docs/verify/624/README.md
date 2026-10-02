# chief 抽屉输入框占位接 steer canon（#624）—— 验证记录

**结论：通过（pass）。**

验收标准原文（issue #624，live 面一条）：

> live 面：chief 回合进行中（activeRun 非空）抽屉输入框占位为 steer 词、收尾后回落空闲词。
> 用 verify-pacman live 链验证（drive-chief-drawer.mjs 发送链 + stub daemon 产真 activeRun）。

## 改动

chief 抽屉 composer 占位此前是硬编码字面量（`t('有什么可以帮你的？')`），不引 shared
canon、不随回合态切换。现在两值消费 `@pacman/shared` 的 `CHIEF_INPUT_PLACEHOLDER`
（空闲）/ `CHIEF_INPUT_PLACEHOLDER_STEERING`（回合中 steer 语义，r5 §3.6）；回合态
信号 = 活动线程 `activeRun` 非空的投影（`mapChief` 单点置 `ChiefContent.running`，
wire 本就下发，零新增轮询——刷新节奏骑 `chiefSend` 的 `invalidateAll` 与
conversation SSE 既有重取）。

## 探针

`drive-chief-steer-placeholder.mjs`（drive-chief-drawer.mjs 发送链先例的定制变体）：
seed provider/agent → PATCH chief 绑定 → board FAB 开抽屉 → 空闲面断言 → composer
填句 + Enter（真用户路径；`enqueueChiefStep` 在 POST 内同步置 `activeRun`，probe 栈
无 daemon、回合永不收尾 = activeRun 恒在位，正合判据）→ API + SQLite 双真值 +
占位断言 → SQLite 清 `activeRun`（`finishChiefTurn` 同效果面，scratch 库归 probe
所有）+ reload 重取 → 回落断言。

同一探针、同一判据（running 面 = steer canon）分别跑在两套隔离栈上：

| 栈 | 代码 | 端口 | 结果 |
|---|---|---|---|
| before | `origin/main`（一次性 detach worktree `/tmp/wt-624-before`） | 8793 / 5275 | **6/7**，唯一红项 `running-face-placeholder-steer` = 缺口本身 |
| after | 本分支 worktree | 8791 / 5273 | **7/7 全 PASS** |

before 红项 detail：`回合中占位="有什么可以帮你的？"（期望 steer canon）`——而同一时刻
`GET threads` 与 SQLite `chief_thread.activeRun` 双真值均为 `{"phase":"chief"}`
（wire 全程就位、唯独 web 零消费，票面缺口逐字复现）。

## 证据

`before/` 与 `after/` 各 6 图 + `result.json`（checks 逐条 ok/detail + 栈坐标）：

| 图 | 面 | before 实测 | after 实测 |
|---|---|---|---|
| `01-idle-face.png` / `01b-idle-composer.png` | 发送前空闲面 | 占位 = 空闲 canon | 同（不变） |
| `02-running-face.png` / `02b-running-composer.png` | **回合进行中**（activeRun 在位） | 占位 = 空闲 canon（缺口） | **占位 = steer canon** |
| `03-after-fallback.png` / `03b-fallback-composer.png` | 收尾后（activeRun = null，reload 重取） | 占位 = 空闲 canon | 占位 = 空闲 canon（回落成立） |

关键真值（`result.json` 同步收录）：

- before：thread `chief-01a0fc38-3d30-766d-b090-b59ca8c88635`，`activeRun={"phase":"chief"}`（API + SQLite 双证）
- after：thread `chief-01a0fc37-c410-7119-9b6b-c7fedced7ed0`，同上双证；收尾后 `activeRun=null`

fixture 面另有 e2e 钉（`apps/web/e2e/chief-panel.spec.ts` #624 条：scenario 113 =
steer canon、111/114 = 空闲 canon 不回退），不依赖本 live 链。
